"""Backed-up installation of pure preflight and rules; no inference or job mutations."""
import ast
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import yaml
from autonomy_protocol import RULE, MARKER, EVOLUTION_RULE, EVOLUTION_MARKER


def install(home, source):
    home = home.resolve(strict=True)
    profiles = json.loads((source / 'autonomy-profiles.json').read_text(encoding='utf-8'))
    if len(profiles) != 21 or len(set(profiles)) != 21 or any(not isinstance(p, str) or '/' in p or '\\' in p or '..' in p for p in profiles):
        raise ValueError('Unexpected fleet registry')
    runtime = home / 'helena-runtime'
    plans = []
    for name in ('brief_preflight.py', 'autonomy_protocol.py', 'hermes_mcp_preflight.py'):
        content = (source / name).read_text(encoding='utf-8')
        ast.parse(content)
        plans.append((runtime / name, content.encode('utf-8')))
    imported = 'from autonomy_protocol import RULE as AUTONOMY_RULE\n'
    for name, anchor, insertion in (
        ('hermes_dispatch_once.py', "    context = call_tool(GATEWAY, profile_token, 'get_work_context', {})", '    prompt += AUTONOMY_RULE\n'),
        ('hermes_workflow_tick.py', "    if phase == 'REVIEW':", '    base += AUTONOMY_RULE\n'),
    ):
        path = runtime / name
        content = path.read_text(encoding='utf-8')
        if 'from autonomy_protocol import RULE' not in content:
            assert content.count('from hermes_execution_context import packet_prompt\n') == 1
            content = content.replace('from hermes_execution_context import packet_prompt\n', 'from hermes_execution_context import packet_prompt\n' + imported)
        if insertion not in content:
            assert content.count(anchor) == 1
            content = content.replace(anchor, insertion + anchor)
        lines = content.splitlines(keepends=True)
        for index, line in enumerate(lines):
            if '--toolsets' in line and 'helena_contracts' not in line:
                line = line.replace('helena_operacao,helena_visual', 'helena_operacao,helena_visual,helena_contracts')
                line = line.replace('"helena_operacao"', '"helena_operacao,helena_contracts"').replace("'helena_operacao'", "'helena_operacao,helena_contracts'")
                lines[index] = line
        content = ''.join(lines)
        ast.parse(content)
        plans.append((path, content.encode('utf-8')))
    server = {'command': '/opt/hermes/.venv/bin/python',
              'args': ['/data/helena-runtime/brief_preflight.py'], 'enabled': True,
              'timeout': 15, 'connect_timeout': 15,
              'tools': {'include': ['check_task_brief'], 'prompts': False}}
    for profile in profiles:
        root = home / 'profiles' / profile
        config_path, soul_path = root / 'config.yaml', root / 'SOUL.md'
        config = yaml.safe_load(config_path.read_text(encoding='utf-8'))
        previous = config.get('mcp_servers', {}).get('helena_contracts')
        if previous is not None and previous != server:
            raise ValueError('Preflight connector diverged: ' + profile)
        if previous is None:
            config.setdefault('mcp_servers', {})['helena_contracts'] = server
            plans.append((config_path, yaml.safe_dump(config, allow_unicode=True, sort_keys=False).encode('utf-8')))
        soul = soul_path.read_text(encoding='utf-8')
        if MARKER not in soul:
            plans.append((soul_path, (soul.rstrip() + '\n' + RULE).encode('utf-8')))
        elif RULE.strip() not in soul:
            raise ValueError('Existing autonomy rule diverged: ' + profile)
        if EVOLUTION_MARKER not in soul:
            updated = soul.rstrip() + '\n' + (RULE if MARKER not in soul else '') + EVOLUTION_RULE
            plans = [(p, v) for p, v in plans if p != soul_path]
            plans.append((soul_path, updated.encode('utf-8')))
        elif EVOLUTION_RULE.strip() not in soul:
            raise ValueError('Existing evolution rule diverged: ' + profile)
    for path, _ in plans:
        if path.is_symlink() or not path.resolve().is_relative_to(home):
            raise ValueError('Unexpected path')
    backup = runtime / ('autonomy-backup-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    backup.mkdir(mode=0o700)
    saved = []
    try:
        for path, data in plans:
            old = path.read_bytes() if path.exists() else None
            if old == data:
                continue
            if old is not None:
                target = backup / path.relative_to(home)
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(path, target)
                os.chmod(target, 0o600)
            saved.append((path, old))
            temporary = path.with_suffix('.autonomy-tmp')
            with temporary.open('xb') as stream:
                os.chmod(temporary, 0o600)
                stream.write(data)
            temporary.replace(path)
            if path.read_bytes() != data:
                raise RuntimeError('Write verification failed')
    except Exception:
        for path, old in reversed(saved):
            if old is None:
                path.unlink(missing_ok=True)
            else:
                path.write_bytes(old)
        raise
    result = {'status': 'INSTALLED', 'profiles_checked': len(profiles), 'changed_files': len(saved),
              'backup': str(backup), 'model_calls': 0, 'jobs_changed': False, 'schedule_changed': False,
              'gateway_permissions_changed': False, 'new_tool': 'read-only check_task_brief'}
    (runtime / 'autonomy-install-receipt.json').write_text(json.dumps(result), encoding='utf-8')
    return result


if __name__ == '__main__':
    import fcntl
    with Path('/data/helena-runtime/dispatcher.lock').open('a+') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        print(json.dumps(install(Path('/data'), Path(__file__).resolve().parent)))
