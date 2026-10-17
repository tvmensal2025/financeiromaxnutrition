#!/usr/bin/env python3
"""Apply Helena's narrow Codex OAuth fix to the verified Hermes 0.19.0 wheel.

No auth store is read here. Unknown upstream source is rejected before writing.
"""

from __future__ import annotations

import hashlib
import importlib.metadata
import os
from pathlib import Path
import stat
import sys
import tempfile


# Both originals match the official PyPI hermes_agent-0.19.0-py3-none-any.whl
# (wheel SHA-256 bd0bac012aee38a60894781f4597dc29ee7bedb3448540249921f10d3bef327f).
# The wheel digest was checked over HTTPS with normal TLS verification.
ORIGINAL = {
    "hermes_cli/auth.py": "dfab38acf45f7db0ceaa993597bf45e15ea759f24bcedbd43d18dd6c596a1164",
    "agent/credential_pool.py": "f80c8e408835e8cd7d0f5ed857570b5e46e2856080a8db48bb18e019aa862302",
}
# Expected exact outputs make re-runs safe and reject an unreviewed transform.
PATCHED = {
    "hermes_cli/auth.py": "7a6171dc308d9c57745752d1833d1c4f962b3755adac63541919d9ede40ef747",
    "agent/credential_pool.py": "d8f1d92bf404e15807fc2b098ac724852b8e0aad7136d38ec4cb795d451e4562",
}


def replace_once(source: str, old: str, new: str) -> str:
    if source.count(old) != 1:
        raise ValueError("upstream source marker mismatch")
    return source.replace(old, new, 1)


def patch_auth(source: str) -> str:
    source = replace_once(source,
        "def _provider_state_transaction(provider_id: str):",
        "def _provider_state_transaction(provider_id: str, *, timeout_seconds: float = AUTH_LOCK_TIMEOUT_SECONDS):")
    start = source.index("def _provider_state_transaction(")
    end = source.index("\ndef _load_provider_state(", start)
    block = source[start:end].replace("with _auth_store_lock():", "with _auth_store_lock(timeout_seconds=timeout_seconds):", 1)
    block = block.replace("with _auth_store_lock(target_path=source_path):", "with _auth_store_lock(timeout_seconds=timeout_seconds, target_path=source_path):", 1)
    source = source[:start] + block + source[end:]

    source = replace_once(source,
        "    removed_ids: Optional[Iterable[str]] = None,\n) -> Path:\n    \"\"\"Persist one provider's credential pool under auth.json.",
        "    removed_ids: Optional[Iterable[str]] = None,\n    target_path: Optional[Path] = None,\n) -> Path:\n    \"\"\"Persist one provider's credential pool under auth.json.")
    start = source.index("def write_credential_pool(")
    end = source.index("\ndef suppress_credential_source(", start)
    block = source[start:end]
    block = replace_once(block, "with _auth_store_lock():\n        auth_store = _load_auth_store()", "with _auth_store_lock(target_path=target_path):\n        auth_store = _load_auth_store(target_path)")
    block = replace_once(block, "return _save_auth_store(auth_store)", "return _save_auth_store(auth_store, target_path=target_path)")
    source = source[:start] + block + source[end:]

    source = replace_once(source,
        "def _save_codex_tokens(tokens: Dict[str, str], last_refresh: str = None, label: str = None) -> None:",
        "def _save_codex_tokens(tokens: Dict[str, str], last_refresh: str = None, label: str = None, *, target_path: Optional[Path] = None) -> None:")
    start = source.index("def _save_codex_tokens(")
    end = source.index("\ndef _recover_codex_tokens_from_cli(", start)
    block = source[start:end]
    block = replace_once(block,
        "with _auth_store_lock():\n        auth_store = _load_auth_store()\n        state = _load_provider_state(auth_store, \"openai-codex\") or {}",
        "with _auth_store_lock(target_path=target_path):\n        auth_store = _load_auth_store(target_path)\n        if target_path is None:\n            state = _load_provider_state(auth_store, \"openai-codex\") or {}\n        else:\n            state = auth_store.get(\"providers\", {}).get(\"openai-codex\") or {}")
    block = replace_once(block,
        '_save_provider_state(auth_store, "openai-codex", state)',
        'if target_path is None:\n            _save_provider_state(auth_store, "openai-codex", state)\n        else:\n            _store_provider_state(auth_store, "openai-codex", state, set_active=False)')
    block = replace_once(block, "_save_auth_store(auth_store)", "_save_auth_store(auth_store, target_path=target_path)")
    source = source[:start] + block + source[end:]

    source = replace_once(source,
        "def _recover_codex_tokens_from_cli(reason: str) -> Optional[Dict[str, str]]:",
        "def _recover_codex_tokens_from_cli(reason: str, *, target_path: Optional[Path] = None) -> Optional[Dict[str, str]]:")
    start = source.index("def _recover_codex_tokens_from_cli(")
    end = source.index("\ndef refresh_codex_oauth_pure(", start)
    block = source[start:end]
    block = replace_once(block, "_save_codex_tokens(imported)", "_save_codex_tokens(imported, target_path=target_path)")
    source = source[:start] + block + source[end:]

    source = replace_once(source,
        "def _refresh_codex_auth_tokens(\n    tokens: Dict[str, str],\n    timeout_seconds: float,\n) -> Dict[str, str]:",
        "def _refresh_codex_auth_tokens(\n    tokens: Dict[str, str],\n    timeout_seconds: float,\n    *,\n    target_path: Optional[Path] = None,\n) -> Dict[str, str]:")
    start = source.index("def _refresh_codex_auth_tokens(")
    end = source.index("\ndef _import_codex_cli_tokens(", start)
    block = source[start:end]
    block = replace_once(block, "_save_codex_tokens(updated_tokens)", "_save_codex_tokens(updated_tokens, target_path=target_path)")
    block = replace_once(block,
        '''        imported = _recover_codex_tokens_from_cli(
            f"refresh_token rejected: {getattr(exc, 'code', None) or 'auth_error'}"
        )''',
        '''        imported = _recover_codex_tokens_from_cli(
            f"refresh_token rejected: {getattr(exc, 'code', None) or 'auth_error'}",
            target_path=target_path,
        )''')
    source = source[:start] + block + source[end:]

    old = '''        # Re-read under lock to avoid racing with other Hermes processes
        with _auth_store_lock(timeout_seconds=max(float(AUTH_LOCK_TIMEOUT_SECONDS), refresh_timeout_seconds + 5.0)):
            data = _read_codex_tokens(_lock=False)
            tokens = dict(data["tokens"])
            access_token = str(tokens.get("access_token", "") or "").strip()

            should_refresh = bool(force_refresh)
            if (not should_refresh) and refresh_if_expiring:
                should_refresh = _codex_access_token_is_expiring(access_token, refresh_skew_seconds)

            if should_refresh:
                tokens = _refresh_codex_auth_tokens(tokens, refresh_timeout_seconds)
                access_token = str(tokens.get("access_token", "") or "").strip()
'''
    new = '''        # Hold the originating auth store lock through the single-use OAuth POST
        # and atomic save. Profiles borrow root credentials without copying them.
        with _provider_state_transaction(
            "openai-codex",
            timeout_seconds=max(float(AUTH_LOCK_TIMEOUT_SECONDS), refresh_timeout_seconds + 5.0),
        ) as (_profile_store, state, source_path):
            if not isinstance(state, dict) or not isinstance(state.get("tokens"), dict):
                raise AuthError("Codex auth state is missing tokens.", provider="openai-codex",
                                code="codex_auth_invalid_shape", relogin_required=True)
            tokens = dict(state["tokens"])
            access_token = str(tokens.get("access_token", "") or "").strip()
            if not access_token or not str(tokens.get("refresh_token", "") or "").strip():
                raise AuthError("Codex auth state is missing tokens.", provider="openai-codex",
                                code="codex_auth_invalid_shape", relogin_required=True)
            data = {"tokens": tokens, "last_refresh": state.get("last_refresh")}

            # An in-flight refresh in another profile may already have won.
            should_refresh = tokens == data_before_lock and (
                force_refresh or (refresh_if_expiring and
                                  _codex_access_token_is_expiring(access_token, refresh_skew_seconds))
            )
            if should_refresh:
                tokens = _refresh_codex_auth_tokens(tokens, refresh_timeout_seconds,
                                                    target_path=source_path)
                access_token = str(tokens.get("access_token", "") or "").strip()
'''
    # Snapshot the pair observed before the transaction. Force refresh should
    # not consume a second token if a concurrent process has already rotated it.
    source = replace_once(source, "    if should_refresh:\n" + old, "    if should_refresh:\n        data_before_lock = dict(tokens)\n" + new)
    source = replace_once(source,
        '''            imported = _recover_codex_tokens_from_cli(str(getattr(exc, "code", None) or "auth_error"))
            if imported:
''',
        '''            # An isolated profile must never import CLI credentials into
            # its temporary auth.json. A malformed inherited login requires
            # repair at the root, where the operator controls authentication.
            imported = None if _global_auth_file_path() is not None else (
                _recover_codex_tokens_from_cli(str(getattr(exc, "code", None) or "auth_error"))
            )
            if imported:
''')
    source = replace_once(source,
        '''        with _auth_store_lock():
            auth_store = _load_auth_store()
        pool = auth_store.get("credential_pool")
        if not isinstance(pool, dict):
            return ""
        entries = pool.get("openai-codex")
        if not isinstance(entries, list):
            return ""
''',
        '''        entries = read_credential_pool("openai-codex")
        if not isinstance(entries, list):
            return ""
''')
    start = source.index("def _codex_pool_rate_limit_status(")
    end = source.index("\ndef _pool_codex_access_token(", start)
    block = source[start:end]
    block = replace_once(block,
        '''        with _auth_store_lock():
            auth_store = _load_auth_store()
        pool = auth_store.get("credential_pool")
        if not isinstance(pool, dict):
            return None
        entries = pool.get("openai-codex")
        if not isinstance(entries, list):
            return None
''',
        '''        entries = read_credential_pool("openai-codex")
        if not isinstance(entries, list):
            return None
''')
    source = source[:start] + block + source[end:]
    return source


def patch_pool(source: str) -> str:
    source = replace_once(source,
        "    def __init__(self, provider: str, entries: List[PooledCredential]):\n        self.provider = provider",
        "    def __init__(self, provider: str, entries: List[PooledCredential], *, borrowed_root: bool = False):\n        self.provider = provider\n        self._borrowed_root = borrowed_root\n        self._borrowed_snapshot = {}")
    old = '''    def _persist(self, *, removed_ids: Optional[List[str]] = None) -> None:
        write_credential_pool(
            self.provider,
            [entry.to_dict() for entry in self._entries],
            removed_ids=removed_ids,
        )
'''
    new = '''    def _persist(self, *, removed_ids: Optional[List[str]] = None) -> None:
        if self.provider == "openai-codex" and self._borrowed_root:
            # Borrowed entries remain in their owning root store, including
            # status updates and removal of the last entry.
            with _auth_store_lock():
                active = _load_auth_store().get("credential_pool", {}).get(self.provider, [])
                root_path = auth_mod._global_auth_file_path()
                if active or root_path is None:
                    raise RuntimeError("Borrowed Codex credential source changed")
                with _auth_store_lock(target_path=root_path):
                    root = _load_auth_store(root_path).get("credential_pool", {}).get(self.provider, [])
                    root_by_id = {item.get("id"): item for item in root if isinstance(item, dict)}
                    if not all(item.id in root_by_id for item in self._entries):
                        raise RuntimeError("Borrowed Codex credential source changed")
                    # Merge only fields this pool changed since its snapshot.
                    # Root wins conflicts, so stale status and metadata cannot
                    # undo another profile's newer write.
                    latest = []
                    for item in self._entries:
                        disk = root_by_id[item.id]
                        snapshot = self._borrowed_snapshot.get(item.id)
                        if (snapshot is None or
                                disk.get("refresh_token") != snapshot.get("refresh_token") or
                                disk.get("access_token") != snapshot.get("access_token")):
                            item = PooledCredential.from_dict(self.provider, disk)
                        else:
                            merged = dict(disk)
                            for key, value in item.to_dict().items():
                                if value != snapshot.get(key) and disk.get(key) == snapshot.get(key):
                                    merged[key] = value
                            item = PooledCredential.from_dict(self.provider, merged)
                        latest.append(item)
                    write_credential_pool(
                        self.provider, [item.to_dict() for item in latest],
                        removed_ids=removed_ids, target_path=root_path,
                    )
                    self._entries = latest
                    final_rows = _load_auth_store(root_path).get("credential_pool", {}).get(self.provider, [])
                    self._borrowed_snapshot = {
                        row.get("id"): dict(row) for row in final_rows if isinstance(row, dict)
                    }
                    return
        write_credential_pool(
            self.provider,
            [entry.to_dict() for entry in self._entries],
            removed_ids=removed_ids,
        )
'''
    source = replace_once(source, old, new)
    source = replace_once(source,
        '''    def add_entry(self, entry: PooledCredential) -> PooledCredential:
        entry = replace(entry, priority=_next_priority(self._entries))
        self._entries.append(entry)
        self._persist()
        return entry
''',
        '''    def add_entry(self, entry: PooledCredential) -> PooledCredential:
        entry = replace(entry, priority=_next_priority(self._entries))
        self._entries.append(entry)
        # An explicit add in a profile deliberately starts a local pool.
        borrowed = self._borrowed_root
        self._borrowed_root = False
        try:
            self._persist()
        except Exception:
            self._borrowed_root = borrowed
            self._entries.remove(entry)
            raise
        return entry
''')
    source = replace_once(source,
        '''        write_credential_pool(
            self.provider,
            [entry.to_dict() for entry in self._entries],
            removed_ids=[removed.id],
        )
        if self._current_id == removed.id:
''',
        '''        self._persist(removed_ids=[removed.id])
        if self._current_id == removed.id:
''')
    old = '''        if self.provider in ("openai-codex", "xai-oauth"):
            sync_entry = (
'''
    new = '''        if self.provider == "openai-codex":
            return self._refresh_codex_entry_in_source(entry, force=force)
        if self.provider == "xai-oauth":
            sync_entry = (
'''
    source = replace_once(source, old, new)
    marker = "    def _refresh_entry(self, entry: PooledCredential, *, force: bool) -> Optional[PooledCredential]:\n"
    helper = '''    def _refresh_codex_entry_in_source(
        self, entry: PooledCredential, *, force: bool
    ) -> Optional[PooledCredential]:
        """Rotate one borrowed Codex grant in its owning store, under its lock."""
        timeout = self._single_use_refresh_lock_timeout()
        with _auth_store_lock(timeout_seconds=timeout):
            active_path = auth_mod._auth_file_path()
            active = _load_auth_store()
            active_entries = active.get("credential_pool", {}).get(self.provider, [])
            source_path = active_path
            if not any(isinstance(row, dict) and row.get("id") == entry.id for row in active_entries):
                source_path = auth_mod._global_auth_file_path()
            if source_path is None:
                raise RuntimeError("Codex credential source is unavailable")
            with _auth_store_lock(timeout_seconds=timeout, target_path=source_path):
                source_store = _load_auth_store(source_path)
                rows = source_store.get("credential_pool", {}).get(self.provider, [])
                row = next((item for item in rows if isinstance(item, dict)
                            and item.get("id") == entry.id), None)
                if row is None:
                    raise RuntimeError("Codex credential source changed")
                current = PooledCredential.from_dict(self.provider, row)
                if (current.refresh_token != entry.refresh_token or
                        current.access_token != entry.access_token):
                    self._replace_entry(entry, current)
                    return current
                if not force and not self._entry_needs_refresh(current):
                    self._replace_entry(entry, current)
                    return current
                try:
                    refreshed = auth_mod.refresh_codex_oauth_pure(
                        current.access_token, current.refresh_token
                    )
                except Exception as exc:
                    terminal = auth_mod._is_terminal_codex_oauth_refresh_error(exc)
                    failed = replace(
                        current,
                        access_token="" if terminal else current.access_token,
                        refresh_token="" if terminal else current.refresh_token,
                        last_status=STATUS_DEAD if terminal else STATUS_EXHAUSTED,
                        last_status_at=time.time(),
                        last_error_code=None,
                        last_error_reason=str(getattr(exc, "code", "") or "auth_error"),
                        last_error_message=None,
                        last_error_reset_at=None,
                    )
                    for index, item in enumerate(rows):
                        if isinstance(item, dict) and item.get("id") == entry.id:
                            rows[index] = failed.to_dict()
                            break
                    if terminal and current.source == "device_code":
                        state = source_store.get("providers", {}).get(self.provider)
                        if isinstance(state, dict) and isinstance(state.get("tokens"), dict):
                            if state["tokens"].get("refresh_token") == current.refresh_token:
                                state["tokens"] = {}
                    _save_auth_store(source_store, target_path=source_path)
                    self._replace_entry(entry, failed)
                    return None
                updated = replace(
                    current,
                    access_token=refreshed["access_token"],
                    refresh_token=refreshed["refresh_token"],
                    last_refresh=refreshed.get("last_refresh"),
                    last_status=STATUS_OK,
                    last_status_at=None,
                    last_error_code=None,
                    last_error_reason=None,
                    last_error_message=None,
                    last_error_reset_at=None,
                )
                for index, item in enumerate(rows):
                    if isinstance(item, dict) and item.get("id") == entry.id:
                        rows[index] = updated.to_dict()
                        break
                # Only a singleton-seeded alias may update providers.*.
                if current.source == "device_code":
                    state = source_store.get("providers", {}).get(self.provider)
                    if isinstance(state, dict) and isinstance(state.get("tokens"), dict):
                        old = state["tokens"]
                        if old.get("refresh_token") == current.refresh_token:
                            state["tokens"] = dict(old, access_token=updated.access_token,
                                                   refresh_token=updated.refresh_token)
                            state["last_refresh"] = updated.last_refresh
                _save_auth_store(source_store, target_path=source_path)
                self._replace_entry(entry, updated)
                return updated

'''
    source = replace_once(source, marker, helper + marker)
    old = '''    if changed:
        new_ids = {entry.id for entry in entries}
        write_credential_pool(
            provider,
            [entry.to_dict() for entry in sorted(entries, key=lambda item: item.priority)],
            removed_ids=disk_ids - new_ids,
        )
    return CredentialPool(provider, entries)
'''
    new = '''    borrowed_root = False
    if provider == "openai-codex" and (raw_entries or entries):
        with _auth_store_lock():
            active_store = _load_auth_store()
            active_pool = active_store.get("credential_pool", {}).get(provider, [])
            active_state = active_store.get("providers", {}).get(provider)
            root_path = auth_mod._global_auth_file_path()
            if root_path and not active_pool and not active_state:
                with _auth_store_lock(target_path=root_path):
                    root_store = _load_auth_store(root_path)
                    root_pool = root_store.get("credential_pool", {}).get(provider, [])
                    root_state = root_store.get("providers", {}).get(provider)
                    root_ids = {item.get("id") for item in root_pool if isinstance(item, dict)}
                    borrowed_root = disk_ids <= root_ids and bool(root_ids or root_state)
    if changed:
        new_ids = {entry.id for entry in entries}
        can_seed_root = borrowed_root and all(
            item.id in root_ids or (item.source == "device_code" and root_state)
            for item in entries
        )
        if can_seed_root:
            with _auth_store_lock():
                with _auth_store_lock(target_path=root_path):
                    root_store = _load_auth_store(root_path)
                    root_pool = root_store.get("credential_pool", {}).get(provider, [])
                    root_by_id = {item.get("id"): item for item in root_pool if isinstance(item, dict)}
                    root_state = root_store.get("providers", {}).get(provider)
                    safe_entries = []
                    for item in entries:
                        disk = root_by_id.get(item.id)
                        if disk is None:
                            tokens = root_state.get("tokens") if isinstance(root_state, dict) else None
                            if (item.source != "device_code" or not isinstance(tokens, dict)
                                    or tokens.get("refresh_token") != item.refresh_token):
                                raise RuntimeError("Borrowed Codex credential source changed")
                        elif (disk.get("refresh_token") != item.refresh_token or
                              disk.get("access_token") != item.access_token or
                              any(disk.get(key) != next(
                                  (raw.get(key) for raw in raw_entries
                                   if isinstance(raw, dict) and raw.get("id") == item.id), None)
                                  for key in ("last_status", "last_status_at", "last_error_code",
                                              "last_error_reason", "last_error_message", "last_error_reset_at"))):
                            item = PooledCredential.from_dict(provider, disk)
                        safe_entries.append(item)
                    entries = safe_entries
                    write_credential_pool(
                        provider, [item.to_dict() for item in sorted(entries, key=lambda item: item.priority)],
                        removed_ids=disk_ids - new_ids, target_path=root_path,
                    )
        else:
            borrowed_root = False
            write_credential_pool(
                provider,
                [entry.to_dict() for entry in sorted(entries, key=lambda item: item.priority)],
                removed_ids=disk_ids - new_ids,
            )
    result = CredentialPool(provider, entries, borrowed_root=borrowed_root)
    if borrowed_root:
        with _auth_store_lock():
            with _auth_store_lock(target_path=root_path):
                final_rows = _load_auth_store(root_path).get("credential_pool", {}).get(provider, [])
                final_by_id = {row.get("id"): row for row in final_rows if isinstance(row, dict)}
                if not all(item.id in final_by_id for item in entries):
                    raise RuntimeError("Borrowed Codex credential source changed")
                result._entries = [PooledCredential.from_dict(provider, final_by_id[item.id])
                                   for item in entries]
                result._borrowed_snapshot = {key: dict(row) for key, row in final_by_id.items()}
    return result
'''
    source = replace_once(source, old, new)
    return source


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def validate_site_packages(site_packages: Path) -> Path:
    if importlib.metadata.version("hermes-agent") != "0.19.0":
        raise ValueError("Hermes version mismatch")
    site_packages = site_packages.resolve(strict=True)
    if not site_packages.is_relative_to(Path(sys.prefix).resolve(strict=True)):
        raise ValueError("target is outside the active venv")
    return site_packages


def check(site_packages: Path) -> None:
    site_packages = validate_site_packages(site_packages)
    for relative, expected in PATCHED.items():
        path = site_packages / relative
        if path.is_symlink() or not path.is_file() or sha256(path.read_bytes()) != expected:
            raise ValueError("Hermes auth patch checksum mismatch")


def install(site_packages: Path) -> None:
    site_packages = validate_site_packages(site_packages)
    transforms = {"hermes_cli/auth.py": patch_auth, "agent/credential_pool.py": patch_pool}
    pending = []
    for relative, transform in transforms.items():
        path = site_packages / relative
        if path.is_symlink() or not path.is_file():
            raise ValueError("Hermes source file missing or linked")
        original = path.read_bytes()
        digest = sha256(original)
        if digest == PATCHED[relative]:
            continue
        if digest != ORIGINAL[relative]:
            raise ValueError("Hermes source checksum mismatch")
        modified = transform(original.decode("utf-8")).encode("utf-8")
        if sha256(modified) != PATCHED[relative]:
            raise ValueError("patched source checksum mismatch")
        compile(modified, str(path), "exec")
        pending.append((path, modified))
    for path, data in pending:
        fd, tmp_name = tempfile.mkstemp(prefix=".helena-hermes-", dir=path.parent)
        try:
            with os.fdopen(fd, "wb") as handle:
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            os.chmod(tmp_name, stat.S_IMODE(path.stat().st_mode))
            os.replace(tmp_name, path)
            dir_fd = os.open(path.parent, os.O_RDONLY)
            try:
                os.fsync(dir_fd)
            finally:
                os.close(dir_fd)
        finally:
            if os.path.exists(tmp_name):
                os.unlink(tmp_name)


if __name__ == "__main__":
    try:
        if len(sys.argv) == 3 and sys.argv[1] == "--check":
            check(Path(sys.argv[2]))
        elif len(sys.argv) == 2:
            install(Path(sys.argv[1]))
        else:
            raise ValueError("expected site-packages path")
    except Exception as exc:
        print(f"Hermes auth patch refused: {type(exc).__name__}", file=sys.stderr)
        raise SystemExit(1)
