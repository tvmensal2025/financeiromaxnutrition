"""Operator-only, backed-up repair of Maya's existing stdio identity.

Stage the three runtime files beside this script before running on Hermes.
No job, model, schedule or credential file is modified.
"""
import ast
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import yaml


def install(home=Path('/data')):
    home = home.resolve(strict=True)
    runtime = home / 'helena-runtime'
    sys.path.insert(0, str(runtime))
    from hermes_dispatch_once import token_for
    profile = home / 'profiles/maya--biz003'
    config_path = profile / 'config.yaml'
    config = yaml.safe_load(config_path.read_text(encoding='utf-8'))
    visual = config['mcp_servers']['helena_visual']
    expected = {'command': '/opt/hermes/.venv/bin/python',
                'args': ['/data/helena-runtime/hermes_visual.py'], 'enabled': True,
                'timeout': 300, 'connect_timeout': 20,
                'tools': {'include': ['generate_design'], 'prompts': False}}
    token = token_for(profile.parent, profile.name)
    binding = {'HERMES_HOME': str(profile), 'HELENA_GATEWAY_PROFILE_TOKEN': token}
    allowed = [expected, {**expected, 'env': binding},
               {**expected, 'env': binding,
                'tools': {'include': ['generate_design', 'check_visual_runtime'], 'prompts': False}},
               {**expected, 'env': binding,
                'tools': {'include': ['generate_design', 'check_visual_runtime', 'reuse_design'], 'prompts': False}},
               {**expected, 'env': binding,
                'tools': {'include': ['generate_design', 'check_visual_runtime', 'reuse_design', 'recompose_design'], 'prompts': False}}]
    if visual not in allowed:
        raise ValueError('Unexpected visual connector; no writes')
    config['mcp_servers']['helena_visual'] = allowed[-1]
    plans = [(config_path, yaml.safe_dump(config, allow_unicode=True, sort_keys=False).encode('utf-8'))]
    source = Path(__file__).resolve().parent
    for name in ('creative_quality.py', 'hermes_visual.py', 'hermes_mcp_preflight.py', 'hermes_dispatch_once.py'):
        data = (source / name).read_bytes(); ast.parse(data)
        plans.append((runtime / name, data))
    for path, _ in plans:
        if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(home):
            raise ValueError('Unexpected target; no writes')
    backup = runtime / ('visual-identity-backup-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    backup.mkdir(mode=0o700)
    changed = []
    try:
        for path, data in plans:
            if path.read_bytes() == data: continue
            copy = backup / path.relative_to(home)
            copy.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, copy); os.chmod(copy, 0o600)
            changed.append((path, copy))
            temp = path.with_name(path.name + '.identity-tmp')
            try:
                with temp.open('xb') as stream:
                    os.chmod(temp, 0o600); stream.write(data)
                temp.replace(path)
            finally:
                temp.unlink(missing_ok=True)
            if path.read_bytes() != data: raise RuntimeError('Write verification failed')
    except Exception:
        for path, copy in reversed(changed): shutil.copy2(copy, path)
        raise
    result = {'installed': True, 'profile': profile.name, 'backup': str(backup),
              'changed_files': len(changed), 'model_calls': 0, 'jobs_changed': False,
              'schedule_changed': False, 'credential_files_changed': False,
              'hashes': {path.name: hashlib.sha256(path.read_bytes()).hexdigest()
                         for path, _ in plans if path.parent == runtime}}
    receipt = runtime / 'visual-identity-install.json'
    receipt.write_text(json.dumps(result, indent=2), encoding='utf-8'); os.chmod(receipt, 0o600)
    print(json.dumps(result))
    return result


if __name__ == '__main__':
    import fcntl
    with Path('/data/helena-runtime/dispatcher.lock').open('a+') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        install()
