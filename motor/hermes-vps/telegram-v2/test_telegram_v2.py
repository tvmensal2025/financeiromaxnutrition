"""Pinned Hermes 0.15.1 adapter integration, with synthetic Edge/LLM only."""

import asyncio
import importlib.util
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace


HERE = Path(__file__).resolve().parent
SOURCE = Path(os.environ.get("HERMES_015_SOURCE", "/tmp/helena-hermes-015-source"))


def load_patcher():
    spec = importlib.util.spec_from_file_location("helena_v2_patcher_test", HERE / "patch-hermes-telegram.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@unittest.skipUnless((SOURCE / "gateway/run.py").exists(), "pinned Hermes source unavailable")
class PinnedHermesInboxTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.patcher = load_patcher()
        cls.tmp = tempfile.TemporaryDirectory(prefix="helena-v2-hermes-test-")
        cls.tree = Path(cls.tmp.name)
        shutil.copytree(SOURCE / "gateway", cls.tree / "gateway")
        cls.patcher.patch_tree(cls.tree, apply=True, require_git=False)
        cls.patcher.patch_tree(cls.tree, apply=False, require_git=False)
        sys.path.insert(0, str(cls.tree))
        sys.path.insert(1, str(SOURCE))
        from gateway.run import GatewayRunner
        from gateway.config import Platform, PlatformConfig
        cls.runner_type = GatewayRunner
        cls.platform = Platform
        cls.platform_config = PlatformConfig

    @classmethod
    def tearDownClass(cls):
        sys.path.remove(str(cls.tree))
        sys.path.remove(str(SOURCE))
        cls.tmp.cleanup()

    def setUp(self):
        self.previous = {name: os.environ.get(name) for name in (
            "HELENA_V2_TELEGRAM_MODE", "HELENA_V2_TELEGRAM_BROKER_URL",
            "HELENA_V2_TELEGRAM_WORKER_SECRET")}
        os.environ["HELENA_V2_TELEGRAM_MODE"] = "inbox-worker"
        os.environ["HELENA_V2_TELEGRAM_BROKER_URL"] = (
            "https://wxkgrykduqtsgmjkzlou.supabase.co/functions/v1/helena-v2-telegram")
        os.environ["HELENA_V2_TELEGRAM_WORKER_SECRET"] = "synthetic_worker_secret_32_characters_long"

    def tearDown(self):
        for name, value in self.previous.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value

    def adapter(self, token=None):
        runner = object.__new__(self.runner_type)
        runner.config = SimpleNamespace(group_sessions_per_user=True, thread_sessions_per_user=False)
        return runner._create_adapter(self.platform.TELEGRAM,
                                      self.platform_config(enabled=True, token=token))

    def test_source_hash_fail_closed_and_no_polling_patch(self):
        self.assertEqual(self.patcher.PINNED_COMMIT,
                         "e71a2bd11b733f3be7cf99deafde0066c343d462")
        self.assertEqual((self.tree / "gateway/platforms/telegram.py").read_bytes(),
                         (SOURCE / "gateway/platforms/telegram.py").read_bytes())
        run = self.tree / "gateway/run.py"
        original = run.read_bytes()
        run.write_bytes(original + b"\n# unexpected edit\n")
        with self.assertRaises(ValueError):
            self.patcher.patch_tree(self.tree, apply=False, require_git=False)
        run.write_bytes(original)
        self.patcher.patch_tree(self.tree, apply=False, require_git=False)

    def test_actual_gateway_factory_dispatch_and_session_key(self):
        from telegram import Message
        from gateway.platforms.telegram import TelegramAdapter
        from gateway.platforms.base import MessageType
        from gateway.session import build_session_key

        adapter = self.adapter()
        self.assertEqual(type(adapter).__name__, "HelenaV2InboxAdapter")
        raw = {"update_id": 101, "message": {"message_id": 102, "date": 1760700000,
               "chat": {"id": 103, "type": "private", "first_name": "Ana"},
               "from": {"id": 103, "is_bot": False, "first_name": "Ana"}, "text": "Bom dia"}}
        captured = []
        calls = []

        async def fake_model(event):
            captured.append(event)
            return "Resposta sintética do Hermes"

        async def fake_edge(path, payload=None):
            calls.append((path, payload))
            return {"ok": True}

        adapter.set_message_handler(fake_model)
        adapter._post = fake_edge
        asyncio.run(adapter._dispatch_job({
            "update_id": "101", "lease_token": "lease-1", "tipo": "CONVERSA", "update": raw}))
        self.assertEqual(len(captured), 1)
        self.assertEqual(calls, [("/worker/complete", {
            "update_id": "101", "lease_token": "lease-1",
            "resposta": "Resposta sintética do Hermes", "proposta": None})])
        official = TelegramAdapter(self.platform_config(enabled=True, token=None))
        expected = official._build_message_event(Message.de_json(raw["message"], None),
                                                  MessageType.TEXT, update_id=101)
        key = lambda e: build_session_key(e.source, group_sessions_per_user=True,
                                          thread_sessions_per_user=False)
        self.assertEqual(key(captured[0]), key(expected))
        self.assertEqual(captured[0].platform_update_id, 101)

    def test_no_bot_token_and_media_is_not_claimed_as_read(self):
        adapter = self.adapter(token="123:synthetic-token")
        self.assertFalse(asyncio.run(adapter.connect()))
        adapter = self.adapter()
        calls = []

        async def fake_edge(path, payload=None):
            calls.append((path, payload))
            return {"ok": True}

        adapter._post = fake_edge
        raw = {"update_id": 200, "message": {"message_id": 201,
               "chat": {"id": 103, "type": "private"},
               "from": {"id": 103, "is_bot": False},
               "photo": [{"file_id": "opaque-test-id"}]}}
        asyncio.run(adapter._dispatch_job({
            "update_id": "200", "lease_token": "lease-2", "tipo": "MIDIA", "update": raw}))
        self.assertEqual(calls[0][0], "/worker/complete")
        self.assertIn("Ainda não consigo ler", calls[0][1]["resposta"])
        self.assertIsNone(calls[0][1]["proposta"])

    def test_outbox_drains_while_inbox_is_empty(self):
        adapter = self.adapter()
        calls = []

        async def fake_edge(path, payload=None):
            calls.append(path)
            if path == "/worker/claim":
                return {"ok": True, "job": None}
            return {"ok": True}

        adapter._post = fake_edge

        async def run_once():
            task = asyncio.create_task(adapter._loop())
            await asyncio.sleep(0.01)
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task

        asyncio.run(run_once())
        self.assertGreaterEqual(calls.count("/drain"), 1)
        self.assertGreaterEqual(calls.count("/worker/claim"), 1)

    def test_config_loader_and_full_gateway_start_without_bot_token(self):
        from gateway.config import load_gateway_config
        from gateway.platforms.helena_v2_inbox import HelenaV2InboxAdapter

        raw = {"update_id": 701, "message": {"message_id": 702, "date": 1760700000,
               "chat": {"id": 103, "type": "private", "first_name": "Ana"},
               "from": {"id": 103, "is_bot": False, "first_name": "Ana"}, "text": "Olá"}}
        job = {"update_id": "701", "lease_token": "lease-701", "tipo": "CONVERSA", "update": raw}
        calls = []
        queued = []
        delivered = asyncio.Event()

        async def fake_edge(_self, path, payload=None):
            calls.append((path, payload))
            if path == "/worker/claim":
                return {"ok": True, "job": queued.pop(0) if queued else None}
            if path == "/worker/complete":
                delivered.set()
            return {"ok": True}

        async def fake_model(event):
            self.assertEqual(event.source.chat_id, "103")
            return "Resposta com gateway iniciado"

        async def run():
            cfg = load_gateway_config()
            self.assertTrue(cfg.platforms[self.platform.TELEGRAM].enabled)
            self.assertIsNone(cfg.platforms[self.platform.TELEGRAM].token)
            runner = self.runner_type(cfg)
            runner._handle_message = fake_model
            try:
                self.assertTrue(await asyncio.wait_for(runner.start(), timeout=20))
                adapter = runner.adapters[self.platform.TELEGRAM]
                self.assertIsInstance(adapter, HelenaV2InboxAdapter)
                queued.append(job)
                await asyncio.wait_for(delivered.wait(), timeout=8)
                self.assertTrue(any(path == "/drain" for path, _ in calls))
                completed = [payload for path, payload in calls if path == "/worker/complete"]
                self.assertEqual(completed[0]["resposta"], "Resposta com gateway iniciado")
            finally:
                await asyncio.wait_for(runner.stop(), timeout=20)

        previous_token = os.environ.pop("TELEGRAM_BOT_TOKEN", None)
        previous_home = os.environ.get("HERMES_HOME")
        previous_allow = os.environ.get("TELEGRAM_ALLOWED_USERS")
        try:
            with tempfile.TemporaryDirectory(prefix="helena-v2-hermes-home-") as home:
                os.environ["HERMES_HOME"] = home
                os.environ["TELEGRAM_ALLOWED_USERS"] = "103"
                with patch.object(HelenaV2InboxAdapter, "_post", fake_edge):
                    asyncio.run(run())
        finally:
            if previous_token is not None:
                os.environ["TELEGRAM_BOT_TOKEN"] = previous_token
            if previous_home is None:
                os.environ.pop("HERMES_HOME", None)
            else:
                os.environ["HERMES_HOME"] = previous_home
            if previous_allow is None:
                os.environ.pop("TELEGRAM_ALLOWED_USERS", None)
            else:
                os.environ["TELEGRAM_ALLOWED_USERS"] = previous_allow


if __name__ == "__main__":
    unittest.main()
