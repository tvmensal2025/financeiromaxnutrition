#!/usr/bin/env python3
"""Offline checks for the patched Hermes 0.19.0, with synthetic OAuth data only.

Run with the Hermes venv's Python after patch-hermes-auth.py. No paid API call.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest


def load_modules(root: Path, profile_name: str):
    profile = root / "profiles" / profile_name
    profile.mkdir(parents=True, exist_ok=True)
    os.environ["HERMES_HOME"] = str(profile)
    empty = root.parent / "codex-empty"
    empty.mkdir(exist_ok=True)
    os.environ["CODEX_HOME"] = str(empty)
    os.environ["HOME"] = str(root.parent / "home-empty")
    Path(os.environ["HOME"]).mkdir(exist_ok=True)
    import hermes_cli.auth as auth
    import agent.credential_pool as pool_mod
    return auth, pool_mod, profile


def write_auth(root: Path, *, pool: bool):
    old = {"access_token": "SYNTHETIC_ACCESS_OLD", "refresh_token": "SYNTHETIC_REFRESH_OLD"}
    payload = {"version": 1, "providers": {}}
    if pool:
        payload["credential_pool"] = {"openai-codex": [
            {"id": "first", "label": "synthetic", "source": "manual:device_code",
             "auth_type": "oauth", "priority": 0, **old},
            {"id": "other", "label": "independent", "source": "manual:device_code",
             "auth_type": "oauth", "priority": 1,
             "access_token": "SYNTHETIC_OTHER_ACCESS", "refresh_token": "SYNTHETIC_OTHER_REFRESH"},
        ]}
    else:
        payload["providers"]["openai-codex"] = {"tokens": old, "auth_mode": "chatgpt"}
    root.mkdir(parents=True, exist_ok=True)
    (root / "auth.json").write_text(json.dumps(payload), encoding="utf-8")


def refresh_simulated(access, refresh, *, timeout_seconds=20.0):
    if refresh != "SYNTHETIC_REFRESH_OLD":
        raise AssertionError("unexpected synthetic refresh token")
    return {"access_token": "SYNTHETIC_ACCESS_NEW",
            "refresh_token": "SYNTHETIC_REFRESH_NEW", "last_refresh": "2026-10-17T00:00:00Z"}


class OfflineAuthTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="helena-hermes-fix-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "hermes-home"
        self.auth, self.pool_mod, self.profile = load_modules(self.root, "exec-one")
        self.original_refresh = self.auth.refresh_codex_oauth_pure
        self.auth.refresh_codex_oauth_pure = refresh_simulated
        self.addCleanup(setattr, self.auth, "refresh_codex_oauth_pure", self.original_refresh)

    def read_root(self):
        return json.loads((self.root / "auth.json").read_text(encoding="utf-8"))

    def test_singleton_root_rotation_and_no_profile_auth(self):
        write_auth(self.root, pool=False)
        state = self.read_root()
        state["active_provider"] = "independent-provider"
        (self.root / "auth.json").write_text(json.dumps(state), encoding="utf-8")
        result = self.auth.resolve_codex_runtime_credentials(force_refresh=True)
        self.assertEqual(result["api_key"], "SYNTHETIC_ACCESS_NEW")
        self.assertEqual(self.read_root()["providers"]["openai-codex"]["tokens"]["refresh_token"],
                         "SYNTHETIC_REFRESH_NEW")
        self.assertEqual(self.read_root()["active_provider"], "independent-provider")
        self.assertFalse((self.profile / "auth.json").exists())

    def test_synthetic_cli_recovery_stays_at_origin(self):
        write_auth(self.root, pool=False)
        cli_home = Path(os.environ["CODEX_HOME"])
        imported = {"access_token": "SYNTHETIC_RECOVERED_ACCESS",
                    "refresh_token": "SYNTHETIC_RECOVERED_REFRESH"}
        (cli_home / "auth.json").write_text(json.dumps({"tokens": imported}), encoding="utf-8")
        original_expiry = self.auth._codex_access_token_is_expiring
        self.auth._codex_access_token_is_expiring = lambda *_args: False
        self.auth.refresh_codex_oauth_pure = lambda *_args, **_kwargs: (_ for _ in ()).throw(
            self.auth.AuthError("synthetic rejected token", provider="openai-codex",
                                code="invalid_grant", relogin_required=True))
        try:
            result = self.auth.resolve_codex_runtime_credentials(force_refresh=True)
        finally:
            self.auth._codex_access_token_is_expiring = original_expiry
        self.assertEqual(result["api_key"], imported["access_token"])
        self.assertEqual(self.read_root()["providers"]["openai-codex"]["tokens"], imported)
        self.assertFalse((self.profile / "auth.json").exists())

    def test_initial_invalid_root_login_never_imports_cli_into_profile(self):
        for pool_mode in (False, True):
            with self.subTest(pool=pool_mode):
                write_auth(self.root, pool=pool_mode)
                state = self.read_root()
                state["providers"]["openai-codex"] = {
                    "tokens": {"access_token": "SYNTHETIC_ACCESS_OLD", "refresh_token": ""},
                    "auth_mode": "chatgpt",
                }
                (self.root / "auth.json").write_text(json.dumps(state), encoding="utf-8")
                cli_home = Path(os.environ["CODEX_HOME"])
                (cli_home / "auth.json").write_text(json.dumps({"tokens": {
                    "access_token": "SYNTHETIC_CLI_ACCESS",
                    "refresh_token": "SYNTHETIC_CLI_REFRESH",
                }}), encoding="utf-8")
                if pool_mode:
                    result = self.auth.resolve_codex_runtime_credentials()
                    self.assertEqual(result["source"], "credential_pool")
                else:
                    with self.assertRaises(self.auth.AuthError):
                        self.auth.resolve_codex_runtime_credentials()
                self.assertEqual(self.read_root()["providers"]["openai-codex"]["tokens"]["refresh_token"], "")
                self.assertFalse((self.profile / "auth.json").exists())

    def test_manual_pool_root_rotation_preserves_other_account(self):
        write_auth(self.root, pool=True)
        pool = self.pool_mod.load_pool("openai-codex")
        entry = next(item for item in pool.entries() if item.id == "first")
        result = pool._refresh_entry(entry, force=True)
        self.assertEqual(result.refresh_token, "SYNTHETIC_REFRESH_NEW")
        rows = self.read_root()["credential_pool"]["openai-codex"]
        self.assertEqual(rows[0]["refresh_token"], "SYNTHETIC_REFRESH_NEW")
        self.assertEqual(rows[1]["refresh_token"], "SYNTHETIC_OTHER_REFRESH")
        self.assertFalse((self.profile / "auth.json").exists())
        # A later status persistence must not create a profile auth store.
        pool._persist()
        self.assertFalse((self.profile / "auth.json").exists())

    def test_mixed_singleton_and_manual_pool_load_stays_at_root(self):
        write_auth(self.root, pool=True)
        state = self.read_root()
        state["providers"]["openai-codex"] = {
            "tokens": {"access_token": "SYNTHETIC_SINGLETON_ACCESS",
                       "refresh_token": "SYNTHETIC_SINGLETON_REFRESH"},
            "auth_mode": "chatgpt",
        }
        (self.root / "auth.json").write_text(json.dumps(state), encoding="utf-8")
        pool = self.pool_mod.load_pool("openai-codex")
        self.assertEqual(len(pool.entries()), 3)
        rows = self.read_root()["credential_pool"]["openai-codex"]
        self.assertEqual(len(rows), 3)
        self.assertTrue(any(row["source"] == "device_code" for row in rows))
        self.assertFalse((self.profile / "auth.json").exists())

    def test_singleton_seeded_pool_load_stays_at_root(self):
        write_auth(self.root, pool=False)
        pool = self.pool_mod.load_pool("openai-codex")
        self.assertEqual(len(pool.entries()), 1)
        self.assertEqual(len(self.read_root()["credential_pool"]["openai-codex"]), 1)
        self.assertFalse((self.profile / "auth.json").exists())

    def test_remove_borrowed_entry_updates_only_root(self):
        write_auth(self.root, pool=True)
        pool = self.pool_mod.load_pool("openai-codex")
        removed = pool.remove_index(1)
        self.assertEqual(removed.id, "first")
        rows = self.read_root()["credential_pool"]["openai-codex"]
        self.assertEqual([row["id"] for row in rows], ["other"])
        self.assertFalse((self.profile / "auth.json").exists())

    def test_failed_persistence_does_not_report_success(self):
        for pool_mode in (False, True):
            with self.subTest(pool=pool_mode):
                write_auth(self.root, pool=pool_mode)
                if pool_mode:
                    pool = self.pool_mod.load_pool("openai-codex")
                    item = next(e for e in pool.entries() if e.id == "first")
                    saved = self.pool_mod._save_auth_store
                    self.pool_mod._save_auth_store = lambda *_a, **_kw: (_ for _ in ()).throw(OSError("synthetic save failure"))
                    try:
                        with self.assertRaises(OSError):
                            pool._refresh_entry(item, force=True)
                    finally:
                        self.pool_mod._save_auth_store = saved
                else:
                    saved = self.auth._save_auth_store
                    self.auth._save_auth_store = lambda *_a, **_kw: (_ for _ in ()).throw(OSError("synthetic save failure"))
                    try:
                        with self.assertRaises(OSError):
                            self.auth.resolve_codex_runtime_credentials(force_refresh=True)
                    finally:
                        self.auth._save_auth_store = saved
                self.assertFalse((self.profile / "auth.json").exists())
                self.assertEqual(self.read_root()["credential_pool"]["openai-codex"][0]["refresh_token"]
                                 if pool_mode else self.read_root()["providers"]["openai-codex"]["tokens"]["refresh_token"],
                                 "SYNTHETIC_REFRESH_OLD")

    def test_pool_refresh_auth_failure_allows_other_account(self):
        for terminal in (False, True):
            with self.subTest(terminal=terminal):
                write_auth(self.root, pool=True)
                pool = self.pool_mod.load_pool("openai-codex")
                item = next(e for e in pool.entries() if e.id == "first")
                self.auth.refresh_codex_oauth_pure = lambda *_a, **_kw: (_ for _ in ()).throw(
                    self.auth.AuthError("synthetic refresh failure", provider="openai-codex",
                                        code="invalid_grant" if terminal else "timeout",
                                        relogin_required=terminal))
                self.assertIsNone(pool._refresh_entry(item, force=True))
                rows = self.read_root()["credential_pool"]["openai-codex"]
                self.assertEqual(rows[0]["last_status"], "dead" if terminal else "exhausted")
                self.assertEqual(rows[1]["refresh_token"], "SYNTHETIC_OTHER_REFRESH")
                self.assertEqual(rows[0]["refresh_token"], "" if terminal else "SYNTHETIC_REFRESH_OLD")
                self.assertFalse((self.profile / "auth.json").exists())

    def test_pool_transport_timeout_allows_other_account(self):
        import httpx

        write_auth(self.root, pool=True)
        pool = self.pool_mod.load_pool("openai-codex")
        item = next(e for e in pool.entries() if e.id == "first")
        self.auth.refresh_codex_oauth_pure = lambda *_a, **_kw: (_ for _ in ()).throw(
            httpx.ConnectTimeout("synthetic transport timeout"))
        self.assertIsNone(pool._refresh_entry(item, force=True))
        rows = self.read_root()["credential_pool"]["openai-codex"]
        self.assertEqual(rows[0]["last_status"], "exhausted")
        self.assertEqual(rows[1]["refresh_token"], "SYNTHETIC_OTHER_REFRESH")
        self.assertFalse((self.profile / "auth.json").exists())

    def test_stale_pool_status_cannot_undo_another_rotation(self):
        write_auth(self.root, pool=True)
        pool = self.pool_mod.load_pool("openai-codex")
        root_state = self.read_root()
        root_state["credential_pool"]["openai-codex"][0]["access_token"] = "SYNTHETIC_ACCESS_NEW"
        root_state["credential_pool"]["openai-codex"][0]["refresh_token"] = "SYNTHETIC_REFRESH_NEW"
        (self.root / "auth.json").write_text(json.dumps(root_state), encoding="utf-8")
        pool._persist()
        self.assertEqual(self.read_root()["credential_pool"]["openai-codex"][0]["refresh_token"],
                         "SYNTHETIC_REFRESH_NEW")
        self.assertFalse((self.profile / "auth.json").exists())

    def test_failed_status_is_saved_only_at_origin(self):
        write_auth(self.root, pool=True)
        pool = self.pool_mod.load_pool("openai-codex")
        item = next(e for e in pool.entries() if e.id == "first")
        pool._mark_exhausted(item, 429)
        self.assertEqual(self.read_root()["credential_pool"]["openai-codex"][0]["last_status"],
                         "exhausted")
        self.assertFalse((self.profile / "auth.json").exists())

    def test_stale_profile_cannot_clear_newer_root_cooldown(self):
        write_auth(self.root, pool=True)
        stale = self.pool_mod.load_pool("openai-codex")
        fresh = self.pool_mod.load_pool("openai-codex")
        item = next(e for e in fresh.entries() if e.id == "first")
        fresh._mark_exhausted(item, 429)
        stale._persist()
        self.assertEqual(self.read_root()["credential_pool"]["openai-codex"][0]["last_status"],
                         "exhausted")
        self.assertFalse((self.profile / "auth.json").exists())

    def test_stale_profile_cannot_restore_old_root_label(self):
        write_auth(self.root, pool=True)
        stale = self.pool_mod.load_pool("openai-codex")
        state = self.read_root()
        state["credential_pool"]["openai-codex"][0]["label"] = "new label"
        (self.root / "auth.json").write_text(json.dumps(state), encoding="utf-8")
        stale._persist()
        self.assertEqual(self.read_root()["credential_pool"]["openai-codex"][0]["label"],
                         "new label")
        self.assertFalse((self.profile / "auth.json").exists())

    def test_removed_root_entry_fails_closed(self):
        write_auth(self.root, pool=True)
        pool = self.pool_mod.load_pool("openai-codex")
        root_state = self.read_root()
        root_state["credential_pool"]["openai-codex"] = []
        (self.root / "auth.json").write_text(json.dumps(root_state), encoding="utf-8")
        with self.assertRaises(RuntimeError):
            pool._persist()
        self.assertFalse((self.profile / "auth.json").exists())

    def test_explicit_profile_add_remains_local(self):
        write_auth(self.root, pool=True)
        pool = self.pool_mod.load_pool("openai-codex")
        entry = self.pool_mod.PooledCredential(
            provider="openai-codex", id="new-local", label="synthetic local",
            auth_type="oauth", priority=0, source="manual:device_code",
            access_token="SYNTHETIC_LOCAL_ACCESS", refresh_token="SYNTHETIC_LOCAL_REFRESH",
        )
        pool.add_entry(entry)
        self.assertTrue((self.profile / "auth.json").exists())
        self.assertEqual(len(self.read_root()["credential_pool"]["openai-codex"]), 2)

    def test_two_profiles_share_one_rotation(self):
        for pool_mode in (False, True):
            with self.subTest(pool=pool_mode):
                write_auth(self.root, pool=pool_mode)
                marker = Path(self.temp.name) / "refresh-marker"
                marker.unlink(missing_ok=True)
                cmd = [sys.executable, __file__, "--worker", str(self.root),
                       "pool" if pool_mode else "singleton", str(marker)]
                processes = [subprocess.Popen(cmd + [f"exec-{n}"],
                                              stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                              text=True) for n in (1, 2)]
                for proc in processes:
                    out, err = proc.communicate(timeout=30)
                    self.assertEqual(proc.returncode, 0, f"worker failed: {err}")
                    self.assertEqual(out.strip(), "ok")
                self.assertTrue(marker.exists())
                self.assertEqual(marker.read_text(), "once")
                self.assertEqual(self.read_root()["credential_pool"]["openai-codex"][0]["refresh_token"]
                                 if pool_mode else self.read_root()["providers"]["openai-codex"]["tokens"]["refresh_token"],
                                 "SYNTHETIC_REFRESH_NEW")


def worker(root: Path, pool_mode: bool, marker: Path, profile_name: str):
    auth, pool_mod, profile = load_modules(root, profile_name)

    def slow_refresh(access, refresh, *, timeout_seconds=20.0):
        fd = os.open(marker, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write("once")
        time.sleep(0.2)
        return refresh_simulated(access, refresh, timeout_seconds=timeout_seconds)

    auth.refresh_codex_oauth_pure = slow_refresh
    auth._codex_access_token_is_expiring = lambda token, _skew: token == "SYNTHETIC_ACCESS_OLD"
    pool_mod._codex_access_token_is_expiring = auth._codex_access_token_is_expiring
    if pool_mode:
        pool = pool_mod.load_pool("openai-codex")
        entry = next(item for item in pool.entries() if item.id == "first")
        result = pool._refresh_entry(entry, force=False)
        assert result.refresh_token == "SYNTHETIC_REFRESH_NEW"
    else:
        result = auth.resolve_codex_runtime_credentials()
        assert result["api_key"] == "SYNTHETIC_ACCESS_NEW"
    assert not (profile / "auth.json").exists()
    print("ok")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--worker":
        worker(Path(sys.argv[2]), sys.argv[3] == "pool", Path(sys.argv[4]), sys.argv[5])
    else:
        unittest.main(verbosity=2)
