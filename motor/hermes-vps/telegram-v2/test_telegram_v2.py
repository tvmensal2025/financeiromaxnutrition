import importlib.util
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import httpx


DIRECTORY = Path(__file__).resolve().parent
BROKER_URL = "https://wxkgrykduqtsgmjkzlou.supabase.co/functions/v1/helena-v2-telegram"
SECRET = "synthetic-broker-secret-32-characters-long"
RECEIPT = "Pedido recebido. Estado: RECEBIDO. Protocolo: 12345678-1234-4123-8123-123456789abc."


def load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, DIRECTORY / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


broker = load_module("helena_v2_broker_test", "helena_v2_broker.py")
patcher = load_module("helena_v2_patcher_test", "patch-hermes-telegram.py")


class FakeUpdate:
    def __init__(self, text="/pedido Comprar equipamentos", *, chat_type="private", user_id=103,
                 is_bot=False, update_id=101, message_id=102):
        self.update_id = update_id
        self.message = SimpleNamespace(
            text=text, message_id=message_id,
            chat=SimpleNamespace(id=103, type=chat_type),
            from_user=SimpleNamespace(id=user_id, is_bot=is_bot),
        )

    def to_dict(self):
        return {
            "update_id": self.update_id,
            "message": {"message_id": self.message.message_id,
                        "chat": {"id": self.message.chat.id, "type": self.message.chat.type},
                        "from": {"id": self.message.from_user.id, "is_bot": self.message.from_user.is_bot},
                        "text": self.message.text},
        }


class BrokerTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.sent = []
        self.requests = []
        self.environment = patch.dict(os.environ, {
            "HELENA_V2_TELEGRAM_BROKER_URL": BROKER_URL,
            "HELENA_V2_TELEGRAM_BROKER_SECRET": SECRET,
        })
        self.environment.start()

    async def asyncTearDown(self):
        self.environment.stop()

    async def reply(self, text):
        self.sent.append(text)

    async def post(self, url, **kwargs):
        self.requests.append((url, kwargs))
        return httpx.Response(200, json={"ok": True, "respostas": [RECEIPT]})

    async def test_command_routes_same_raw_update_without_leaking_secret_to_reply(self):
        original = FakeUpdate()
        self.assertTrue(await broker.handle_helena_v2_command(original, self.reply, post=self.post))
        self.assertEqual(self.sent, [RECEIPT])
        self.assertEqual(len(self.requests), 1)
        url, kwargs = self.requests[0]
        self.assertEqual(url, BROKER_URL)
        self.assertEqual(kwargs["json"], original.to_dict())
        self.assertEqual(kwargs["headers"]["X-Telegram-Bot-Api-Secret-Token"], SECRET)
        self.assertNotIn(SECRET, repr(self.sent))

    async def test_normal_conversation_group_bot_and_unsafe_id_continue_original_path(self):
        for update in (FakeUpdate("oi"), FakeUpdate(chat_type="group"),
                       FakeUpdate(user_id=104), FakeUpdate(is_bot=True),
                       FakeUpdate(update_id=2**53), FakeUpdate(message_id=0)):
            self.assertFalse(await broker.handle_helena_v2_command(update, self.reply, post=self.post))
        self.assertEqual(self.requests, [])
        self.assertEqual(self.sent, [])

    async def test_two_attempts_reuse_update_then_return_receipt(self):
        async def sometimes_fails(url, **kwargs):
            self.requests.append((url, kwargs))
            if len(self.requests) == 1:
                raise httpx.ReadTimeout("synthetic timeout")
            return httpx.Response(200, json={"ok": True, "respostas": [RECEIPT]})

        self.assertTrue(await broker.handle_helena_v2_command(FakeUpdate(), self.reply, post=sometimes_fails))
        self.assertEqual(len(self.requests), 2)
        self.assertEqual(self.requests[0][1]["json"], self.requests[1][1]["json"])
        self.assertEqual(self.sent, [RECEIPT])

    async def test_failure_is_handled_and_never_falls_through_to_model(self):
        async def unavailable(url, **kwargs):
            self.requests.append((url, kwargs))
            return httpx.Response(503, json={"ok": False})

        self.assertTrue(await broker.handle_helena_v2_command(FakeUpdate(), self.reply, post=unavailable))
        self.assertEqual(len(self.requests), 2)
        self.assertEqual(len(self.sent), 1)
        self.assertIn("Não foi possível confirmar", self.sent[0])

    async def test_malformed_command_variants_do_not_reach_model(self):
        for text in ("/pedidoXYZ", "/pedido\ttexto", "/vincularXYZ"):
            self.assertTrue(await broker.handle_helena_v2_command(
                FakeUpdate(text), self.reply, post=self.post))
        self.assertEqual(len(self.requests), 3)

    async def test_invalid_config_fails_closed_without_http(self):
        with patch.dict(os.environ, {"HELENA_V2_TELEGRAM_BROKER_SECRET": "weak"}):
            self.assertTrue(await broker.handle_helena_v2_command(FakeUpdate(), self.reply, post=self.post))
        self.assertEqual(self.requests, [])
        self.assertEqual(len(self.sent), 1)
        self.assertFalse(broker._valid_broker_url("https://another.supabase.co/functions/v1/helena-v2-telegram"))
        self.assertFalse(broker._valid_broker_url(BROKER_URL + "?token=synthetic"))
        self.assertFalse(broker._valid_broker_url("https://wxkgrykduqtsgmjkzlou.supabase.co:bad/functions/v1/helena-v2-telegram"))

    async def test_reply_failure_still_marks_command_handled(self):
        async def send_fails(text):
            raise RuntimeError("synthetic send failure")
        self.assertTrue(await broker.handle_helena_v2_command(FakeUpdate(), send_fails, post=self.post))


class PatcherTests(unittest.TestCase):
    def setUp(self):
        self.source = Path(os.environ.get("HELENA_HERMES_015_SOURCE", "/tmp/helena-hermes-015-source"))
        if not self.source.is_dir():
            self.skipTest("Pinned official source unavailable; set HELENA_HERMES_015_SOURCE")
        self.temporary = tempfile.TemporaryDirectory(prefix="hermes-015-patch-test-")
        self.tree = Path(self.temporary.name)
        for relative in patcher.ORIGINAL_HASHES:
            target = self.tree / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(self.source / relative, target)

    def tearDown(self):
        if hasattr(self, "temporary"):
            self.temporary.cleanup()

    def test_official_hashes_idempotent_patch_and_check(self):
        for relative, expected in patcher.ORIGINAL_HASHES.items():
            self.assertEqual(patcher.digest((self.tree / relative).read_bytes()), expected)
        with self.assertRaisesRegex(ValueError, "not installed"):
            patcher.patch_tree(self.tree, apply=False, require_git=False)
        patcher.patch_tree(self.tree, apply=True, require_git=False)
        patcher.patch_tree(self.tree, apply=True, require_git=False)
        patcher.patch_tree(self.tree, apply=False, require_git=False)
        for relative, expected in patcher.PATCHED_HASHES.items():
            content = (self.tree / relative).read_bytes()
            self.assertEqual(patcher.digest(content), expected)
            compile(content, relative, "exec")
        telegram = (self.tree / "gateway/platforms/telegram.py").read_text()
        self.assertEqual(telegram.count("if await self._route_helena_v2(update, msg):"), 2)

    def test_incompatible_file_refused_before_any_change(self):
        path = self.tree / "gateway/platforms/telegram.py"
        path.write_bytes(path.read_bytes() + b"\n# incompatible\n")
        with self.assertRaisesRegex(ValueError, "checksum mismatch"):
            patcher.patch_tree(self.tree, apply=True, require_git=False)
        self.assertFalse((self.tree / "gateway/platforms/helena_v2_broker.py").exists())


if __name__ == "__main__":
    unittest.main()
