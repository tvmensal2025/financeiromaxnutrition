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

bundle = json.loads(zlib.decompress(base64.b64decode('__PAYLOAD__')))
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
