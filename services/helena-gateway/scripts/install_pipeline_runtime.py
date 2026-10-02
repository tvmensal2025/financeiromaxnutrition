"""Back up and install bounded continuity; preserve cron, credentials and jobs."""
import ast
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil

FILES = ('creative_quality.py', 'hermes_execution_context.py', 'hermes_dispatch_once.py',
         'hermes_workflow_tick.py', 'hermes_pipeline.py', 'hermes_queue_watchdog.py', 'execution_policy.py', 'autonomy_protocol.py')
LEGACY_POLL = '''#!/bin/sh
# Existing hourly, no-agent poll; no new schedule and no inference for an idle queue.
export HELENA_DISPATCH_ENABLED=1
exec python /data/helena-runtime/hermes_pipeline.py --execute --max-actions 6
'''
PRE_WATCHDOG_POLL = '''#!/bin/sh
# Existing no-agent schedule. Use the same verified launcher in cron and CLI.
export HELENA_DISPATCH_ENABLED=1
export HERMES_BIN=/opt/hermes/.venv/bin/hermes
export HERMES_PYTHON=/opt/hermes/.venv/bin/python
exec /opt/hermes/.venv/bin/python /data/helena-runtime/hermes_pipeline.py --execute --max-actions 6
'''
POLL = PRE_WATCHDOG_POLL.replace('exec /opt/',
    '/opt/hermes/.venv/bin/python /data/helena-runtime/hermes_queue_watchdog.py --execute >/dev/null || true\nexec /opt/')


def install(home=Path('/data')):
    home = home.resolve()
    runtime, poll = home / 'helena-runtime', home / 'scripts/helena_dispatch_poll.sh'
    if not runtime.is_dir() or not poll.is_file() or poll.is_symlink():
        raise ValueError('Existing runtime and poll required')
    before = poll.read_text()
    if 'hermes_dispatch_once.py --auto --execute' not in before and before not in (POLL, PRE_WATCHDOG_POLL, LEGACY_POLL):
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
    from autonomy_protocol import RULE, MARKER, EVOLUTION_RULE, EVOLUTION_MARKER
    import hermes_dispatch_once as dispatch
    config_path = runtime / 'workflow-config.json'
    config = json.loads(config_path.read_text())
    token = dispatch.token_for(home / 'profiles', 'helena--grupo')
    probe = dispatch.call_tool(dispatch.GATEWAY, token, 'workflow_candidates', {
        'created_after': config['new_jobs_after'], 'adopt_job_ids': config.get('adopt_job_ids', []), 'limit': 1})
    if probe.get('success') is not True:
        raise RuntimeError('Canonical Gateway not ready; no installation')
    profiles = json.loads((source / 'autonomy-profiles.json').read_text())
    if len(profiles) != 21 or len(set(profiles)) != 21 or any('/' in p or '\\' in p or '..' in p for p in profiles):
        raise ValueError('Fleet registry diverged')
    for profile in profiles:
        soul_path = home / 'profiles' / profile / 'SOUL.md'
        soul = soul_path.read_text()
        if MARKER not in soul:
            soul = soul.rstrip() + '\n' + RULE
        elif RULE.strip() not in soul:
            raise ValueError('Autonomy rule diverged: ' + profile)
        if EVOLUTION_MARKER not in soul:
            soul = soul.rstrip() + '\n' + EVOLUTION_RULE
        elif EVOLUTION_RULE.strip() not in soul:
            raise ValueError('Evolution rule diverged: ' + profile)
        plans.append((soul_path, soul.encode('utf-8')))
    config['durable_continuity'] = True
    plans.append((config_path, json.dumps(config, ensure_ascii=False, indent=2).encode('utf-8')))
    for target, _ in plans:
        if target.is_symlink() or not target.resolve().is_relative_to(home):
            raise ValueError('Unexpected target')
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
              'permissions_changed': False, 'max_actions': 6, 'durable_continuity': True, 'evolution_profiles': 21,
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
