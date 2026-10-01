"""Operator repair: install the dispatcher and its matching packet builder atomically."""
import ast
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil


def install(runtime=Path('/data/helena-runtime')):
    source = Path(__file__).resolve().parent
    plans = []
    for name in ('hermes_execution_context.py', 'hermes_dispatch_once.py'):
        target = runtime / name
        if not target.is_file() or target.is_symlink():
            raise ValueError('Unexpected target; no writes')
        data = (source / name).read_bytes()
        ast.parse(data)
        plans.append((target, data))
    backup = runtime / ('packet-contract-backup-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    backup.mkdir(mode=0o700)
    changed = []
    try:
        for target, data in plans:
            if target.read_bytes() == data:
                continue
            saved = backup / target.name
            shutil.copy2(target, saved)
            changed.append((target, saved))
            temp = target.with_suffix('.packet-tmp')
            with temp.open('xb') as stream:
                os.chmod(temp, 0o600)
                stream.write(data)
            temp.replace(target)
            if target.read_bytes() != data:
                raise RuntimeError('Write verification failed')
    except Exception:
        for target, saved in reversed(changed):
            shutil.copy2(saved, target)
        raise
    result = {'installed': True, 'backup': str(backup), 'model_calls': 0,
              'jobs_changed': False, 'changed_files': len(changed),
              'hashes': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p, _ in plans}}
    (runtime / 'packet-contract-install.json').write_text(json.dumps(result), encoding='utf-8')
    print(json.dumps(result))


if __name__ == '__main__':
    import fcntl
    with Path('/data/helena-runtime/dispatcher.lock').open('a+') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        install()
