"""Back up and install bounded continuity; preserve cron, credentials and jobs."""
import ast
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil

FILES = ('creative_quality.py', 'hermes_execution_context.py', 'hermes_dispatch_once.py',
         'hermes_workflow_tick.py', 'hermes_pipeline.py')
POLL = '''#!/bin/sh
# Existing hourly, no-agent poll; no new schedule and no inference for an idle queue.
export HELENA_DISPATCH_ENABLED=1
exec python /data/helena-runtime/hermes_pipeline.py --execute --max-actions 6
'''


def install(home=Path('/data')):
    home = home.resolve()
    runtime, poll = home / 'helena-runtime', home / 'scripts/helena_dispatch_poll.sh'
    if not runtime.is_dir() or not poll.is_file() or poll.is_symlink():
        raise ValueError('Existing runtime and poll required')
    before = poll.read_text()
    if 'hermes_dispatch_once.py --auto --execute' not in before and before != POLL:
        raise ValueError('Poll diverged; no writes')
    plans = []
    source = Path(__file__).resolve().parent
    for name in FILES:
        target = runtime / name
        if target.is_symlink() or not target.resolve().is_relative_to(home):
            raise ValueError('Unexpected runtime target')
        data = (source / name).read_bytes()
        ast.parse(data)
        plans.append((target, data))
    plans.append((poll, POLL.encode('utf-8')))
    backup = runtime / ('pipeline-backup-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    backup.mkdir(mode=0o700)
    changed = []
    try:
        for target, data in plans:
            old = target.read_bytes() if target.exists() else None
            if old == data:
                continue
            saved = backup / target.relative_to(home)
            if old is not None:
                saved.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(target, saved)
            changed.append((target, saved if old is not None else None))
            mode = target.stat().st_mode if target.exists() else 0o600
            stage = target.with_suffix('.pipeline-tmp')
            with stage.open('xb') as stream:
                os.chmod(stage, mode)
                stream.write(data)
            stage.replace(target)
            if target.read_bytes() != data:
                raise RuntimeError('Write verification failed')
    except Exception:
        for target, saved in reversed(changed):
            if saved is None:
                target.unlink(missing_ok=True)
            else:
                shutil.copy2(saved, target)
        raise
    result = {'status': 'INSTALLED', 'backup': str(backup), 'changed_files': len(changed),
              'model_calls': 0, 'jobs_changed': False, 'schedule_changed': False,
              'permissions_changed': False, 'max_actions': 6,
              'hashes': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p, _ in plans}}
    (runtime / 'pipeline-install-receipt.json').write_text(json.dumps(result), encoding='utf-8')
    return result


if __name__ == '__main__':
    import fcntl
    with Path('/data/helena-runtime/pipeline.lock').open('a+') as pipeline, \
         Path('/data/helena-runtime/dispatcher.lock').open('a+') as executor:
        fcntl.flock(pipeline, fcntl.LOCK_EX | fcntl.LOCK_NB)
        fcntl.flock(executor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        print(json.dumps(install()))
