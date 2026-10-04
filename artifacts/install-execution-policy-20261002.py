import ast
import base64
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import zlib

bundle = json.loads(zlib.decompress(base64.b64decode('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')))
runtime = Path('/data/helena-runtime').resolve()
allowed = {'execution_policy.py', 'hermes_workflow_tick.py', 'hermes_dispatch_once.py'}
assert set(bundle['patch']) == allowed
stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup = runtime / ('execution-policy-backup-' + stamp)
digest = lambda s: hashlib.sha256(s.encode('utf-8')).hexdigest()
with (runtime / 'dispatcher.lock').open('a+') as lock:
    deadline = time.monotonic() + 90
    while True:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            break
        except BlockingIOError:
            if time.monotonic() >= deadline:
                raise RuntimeError('DISPATCHER_BUSY: no changes')
            time.sleep(1)
    plans = []
    for name, spec in bundle['patch'].items():
        target = runtime / name
        assert not target.is_symlink() and target.resolve().parent == runtime
        old = target.read_text(encoding='utf-8') if target.exists() else None
        assert (digest(old) if old is not None else None) == spec['before'], 'SOURCE_CHANGED: ' + name
        new = spec['content'] if old is None else old
        if old is not None:
            for start, end, value in reversed(spec['edits']):
                new = new[:start] + value + new[end:]
        assert digest(new) == spec['after'], 'PATCH_CHANGED: ' + name
        ast.parse(new)
        plans.append((target, new, old))
    backup.mkdir()
    test_dir = backup / 'tests'
    test_dir.mkdir()
    for name, content in bundle['tests'].items():
        assert name in {'execution_policy_test.py', 'hermes_workflow_tick_test.py'}
        ast.parse(content)
        (test_dir / name).write_text(content, encoding='utf-8')
    changed = []
    try:
        for target, new, old in plans:
            if old is not None:
                shutil.copy2(target, backup / target.name)
            temporary = target.with_name(target.name + '.install-' + stamp)
            temporary.write_text(new, encoding='utf-8')
            if target.exists():
                os.chmod(temporary, target.stat().st_mode)
            os.replace(temporary, target)
            changed.append((target, old))
        result = subprocess.run(['/opt/hermes/.venv/bin/python', '-m', 'unittest', 'discover',
            '-s', str(test_dir), '-p', '*_test.py'], cwd=str(runtime), capture_output=True,
            text=True, timeout=60, env={**os.environ, 'PYTHONPATH': str(runtime)})
        (backup / 'tests-result.txt').write_text(result.stdout + result.stderr, encoding='utf-8')
        if result.returncode:
            print((result.stdout + result.stderr)[-6000:])
            raise RuntimeError('TESTS_FAILED: rolling back')
        hashes = {target.name:digest(target.read_text(encoding='utf-8')) for target, _, _ in plans}
        assert all(hashes[name] == spec['after'] for name, spec in bundle['patch'].items())
        receipt = {'status':'INSTALLED', 'at':datetime.now(timezone.utc).isoformat(),
            'commit':'f758ba243508f1b0742a4b7364862d7c643cca2c', 'pull_request':9,
            'backup':str(backup), 'files':hashes, 'tests':(result.stdout + result.stderr).strip(),
            'model_started':False, 'jobs_changed':False, 'attempts_changed':False}
        (runtime / 'execution-policy-install.json').write_text(json.dumps(receipt, indent=2), encoding='utf-8')
        print(json.dumps(receipt))
    except BaseException:
        for target, old in reversed(changed):
            if old is None:
                if target.exists():
                    os.replace(target, backup / (target.name + '.failed-install'))
            else:
                shutil.copy2(backup / target.name, target)
        raise
