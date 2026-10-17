#!/usr/bin/env python3
"""Verified, idempotent local patch for Hermes v2026.5.29 (0.15.1).

CLI use requires the pinned Git commit.  No service, credential file or
Telegram credentials are not touched. --check fails unless all three target
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
    "gateway/run.py": "9e3a780cfa36ac8931ad42481a56d4c55d9643efc1f7ec9b595fa886967d0a3f",
    "gateway/config.py": "2e6b35ab61883868da9129774ebc68eb18c8028a6bc57e86b5b4f97fab2f4424",
}
PATCHED_HASHES = {
    "gateway/run.py": "1f4180acbc79b4ac362fc204db960b673e1c38231f520d2a07ea86956336bf41",
    "gateway/config.py": "0e23b2d104e6d0c5b5432234cd68461be25b268b24af15c638306fb7d2850b81",
    "gateway/platforms/helena_v2_inbox.py": "b4ef2021b4ef63365627b28f06b11a7de5135555165897eac9a5ddd5c7430640",
}
BROKER_SOURCE = Path(__file__).with_name("helena_v2_inbox.py")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def replace_once(source: str, old: str, new: str) -> str:
    if source.count(old) != 1:
        raise ValueError("upstream marker mismatch")
    return source.replace(old, new, 1)


def patch_run(source: str) -> str:
    marker = "        if platform == Platform.TELEGRAM:\n            from gateway.platforms.telegram import TelegramAdapter, check_telegram_requirements\n"
    replacement = '''        if platform == Platform.TELEGRAM:
            if os.getenv("HELENA_V2_TELEGRAM_MODE") == "inbox-worker":
                from gateway.platforms.helena_v2_inbox import HelenaV2InboxAdapter
                return HelenaV2InboxAdapter(config)
            from gateway.platforms.telegram import TelegramAdapter, check_telegram_requirements
'''
    return replace_once(source, marker, replacement)


def patch_config(source: str) -> str:
    marker = "    # Telegram\n    telegram_token = os.getenv(\"TELEGRAM_BOT_TOKEN\")\n"
    replacement = '''    # Telegram
    if os.getenv("HELENA_V2_TELEGRAM_MODE") == "inbox-worker":
        config.platforms.setdefault(Platform.TELEGRAM, PlatformConfig()).enabled = True
    telegram_token = os.getenv("TELEGRAM_BOT_TOKEN")
'''
    return replace_once(source, marker, replacement)


TRANSFORMS = {
    "gateway/run.py": patch_run,
    "gateway/config.py": patch_config,
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
    if digest(source) != PATCHED_HASHES["gateway/platforms/helena_v2_inbox.py"]:
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

    helper_path = tree / "gateway/platforms/helena_v2_inbox.py"
    if helper_path.is_symlink() or (helper_path.exists() and not helper_path.is_file()):
        raise ValueError("broker helper target invalid")
    if helper_path.exists() and digest(helper_path.read_bytes()) != PATCHED_HASHES["gateway/platforms/helena_v2_inbox.py"]:
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
