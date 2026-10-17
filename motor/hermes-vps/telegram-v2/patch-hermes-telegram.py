#!/usr/bin/env python3
"""Verified, idempotent local patch for Hermes v2026.5.29 (0.15.1).

CLI use requires the pinned Git commit.  No service, credential file or
Telegram configuration is touched.  --check fails unless both target
files have exactly the reviewed patched hashes.
"""

from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile


PINNED_COMMIT = "e71a2bd11b733f3be7cf99deafde0066c343d462"
ORIGINAL_HASHES = {
    "gateway/platforms/telegram.py": "c8054b03463e50e1eda06d5cafa355896e1cd981fe4f8d8ebabc4568de07fee7",
}
PATCHED_HASHES = {
    "gateway/platforms/telegram.py": "f42015b72a29221fd2ac1f09654874ad2dba4f4cc6bddca7369bc149fca39575",
    "gateway/platforms/helena_v2_broker.py": "6ad94688793df99cb3b615529fa04b244810b4ed44540b833b42b55c5cc11a42",
}
BROKER_SOURCE = Path(__file__).with_name("helena_v2_broker.py")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def replace_once(source: str, old: str, new: str) -> str:
    if source.count(old) != 1:
        raise ValueError("upstream marker mismatch")
    return source.replace(old, new, 1)


def patch_telegram(source: str) -> str:
    method_marker = "    async def _handle_text_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:\n"
    method = '''    async def _route_helena_v2(self, update: Update, msg: Message) -> bool:
        """Divert only explicit v2 commands before command/text dispatch or batching."""
        text = getattr(msg, "text", None)
        if not isinstance(text, str) or not (
            text.startswith("/pedido") or text.startswith("/vincular")
        ):
            return False
        from gateway.platforms.helena_v2_broker import handle_helena_v2_command

        async def reply(message: str) -> None:
            kwargs = {"chat_id": int(msg.chat.id), "text": message}
            thread_id = getattr(msg, "message_thread_id", None)
            if type(thread_id) is int and thread_id > 0:
                kwargs["message_thread_id"] = thread_id
            await self._send_message_with_thread_fallback(**kwargs)

        return await handle_helena_v2_command(update, reply)

'''
    source = replace_once(source, method_marker, method + method_marker)
    source = replace_once(source,
        "        if not msg or not msg.text:\n            return\n        if not self._should_process_message(msg):\n",
        "        if not msg or not msg.text:\n            return\n        if await self._route_helena_v2(update, msg):\n            return\n        if not self._should_process_message(msg):\n")
    source = replace_once(source,
        "        if not msg or not msg.text:\n            return\n        if not self._should_process_message(msg, is_command=True):\n",
        "        if not msg or not msg.text:\n            return\n        if await self._route_helena_v2(update, msg):\n            return\n        if not self._should_process_message(msg, is_command=True):\n")
    return source


TRANSFORMS = {
    "gateway/platforms/telegram.py": patch_telegram,
}


def _atomic_replace(path: Path, contents: bytes, mode: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(contents)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
        dir_fd = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(dir_fd)
        finally:
            os.close(dir_fd)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def _check_git_pin(tree: Path) -> None:
    result = subprocess.run(["git", "-C", str(tree), "rev-parse", "HEAD"],
                            capture_output=True, text=True, check=False)
    if result.returncode != 0 or result.stdout.strip() != PINNED_COMMIT:
        raise ValueError("Hermes Git pin mismatch")


def patch_tree(tree: Path, *, apply: bool, require_git: bool = True) -> None:
    if require_git:
        _check_git_pin(tree)
    source = BROKER_SOURCE.read_bytes()
    if digest(source) != PATCHED_HASHES["gateway/platforms/helena_v2_broker.py"]:
        raise ValueError("broker helper checksum mismatch")

    expected: dict[str, bytes] = {}
    for relative, transform in TRANSFORMS.items():
        path = tree / relative
        if path.is_symlink() or not path.is_file():
            raise ValueError("Hermes source file unavailable")
        current = path.read_bytes()
        current_hash = digest(current)
        if current_hash == ORIGINAL_HASHES[relative]:
            patched = transform(current.decode("utf-8")).encode("utf-8")
            if digest(patched) != PATCHED_HASHES[relative]:
                raise ValueError("patched checksum mismatch")
            expected[relative] = patched
            if not apply:
                raise ValueError("Hermes patch is not installed")
        elif current_hash == PATCHED_HASHES[relative]:
            expected[relative] = current
        else:
            raise ValueError("Hermes source checksum mismatch")

    helper_path = tree / "gateway/platforms/helena_v2_broker.py"
    if helper_path.is_symlink() or (helper_path.exists() and not helper_path.is_file()):
        raise ValueError("broker helper target invalid")
    if helper_path.exists() and digest(helper_path.read_bytes()) != PATCHED_HASHES["gateway/platforms/helena_v2_broker.py"]:
        raise ValueError("broker helper target checksum mismatch")
    if not helper_path.exists() and not apply:
        raise ValueError("broker helper is not installed")

    if apply:
        for relative, contents in expected.items():
            path = tree / relative
            if digest(path.read_bytes()) != PATCHED_HASHES[relative]:
                _atomic_replace(path, contents, stat.S_IMODE(path.stat().st_mode))
        if not helper_path.exists():
            _atomic_replace(helper_path, source, 0o644)
        patch_tree(tree, apply=False, require_git=require_git)


def main() -> int:
    parser = argparse.ArgumentParser(description="Verified Hermes 0.15.1 Telegram bridge patch")
    parser.add_argument("--tree", type=Path, required=True)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--apply", action="store_true")
    action.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        tree = args.tree.resolve(strict=True)
        if args.apply and not (tree.is_relative_to("/tmp") or tree.is_relative_to("/workspace")):
            raise ValueError("production application disabled")
        patch_tree(tree, apply=args.apply)
    except (OSError, ValueError):
        print("Hermes Telegram patch verification failed", file=sys.stderr)
        return 1
    print("Hermes Telegram patch verified")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
