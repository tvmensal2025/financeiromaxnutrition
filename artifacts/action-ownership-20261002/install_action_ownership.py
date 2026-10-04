"""Narrow, backed-up action-owner repair. No jobs, credentials or ACL changes."""
import argparse
import ast
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys


def sha(data):
    return hashlib.sha256(data).hexdigest()


def install(home, source, apply=False):
    home = home.resolve(strict=True)
    package = json.loads((source / 'ownership-package.json').read_text(encoding='utf-8'))
    profiles = package['profiles']
    assert len(profiles) == len(set(profiles)) == 21
    manifest_path = home / 'helena-runtime/quality-manifest.json'
    manifest = json.loads(manifest_path.read_text())
    plans, rows = [], []
    for name, item in package['runtime'].items():
        target = home / 'helena-runtime' / name
        old = target.read_bytes()
        new = (source / name).read_bytes()
        ast.parse(new.decode())
        if sha(old.replace(b'\r\n', b'\n')) not in (item['old_sha256'], sha(new)):
            raise ValueError('RUNTIME_DRIFT:' + name)
        plans.append((target, old, new))
    for slug in profiles:
        target = home / 'profiles' / slug / 'SOUL.md'
        old = target.read_bytes()
        text = old.decode().replace('\r\n', '\n')
        if package['old_rule'].strip() in text:
            text = text.replace(package['old_rule'].strip(), package['new_rule'].strip(), 1)
        elif package['new_rule'].strip() not in text:
            raise ValueError('RULE_DRIFT:' + slug)
        text = text.replace(package['old_instruction'], package['new_instruction'])
        new = text.encode()
        rows.append({'profile':slug, 'rule_present':package['new_rule'].strip() in text,
                     'sha256':sha(new), 'changed':old != new})
        plans.append((target, old, new))
        manifest.setdefault('soul_hashes', {})[slug] = sha(new)
    manifest['action_ownership_version'] = 'helena-action-ownership-v1'
    plans.append((manifest_path, manifest_path.read_bytes(),
                  json.dumps(manifest, ensure_ascii=False, indent=2).encode()))
    for target, old, new in plans:
        if target.is_symlink() or not target.resolve().is_relative_to(home):
            raise ValueError('UNSAFE_PATH')
        if target.read_bytes() != old:
            raise ValueError('CHANGED_DURING_VALIDATION')
    report = {'status':'VALIDATED', 'profiles':rows, 'model_calls':0,
              'permissions_changed':False, 'jobs_changed':False, 'schedule_changed':False}
    if not apply:
        return report
    import fcntl
    with (home / 'helena-runtime/dispatcher.lock').open('a+') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        backup = home / 'helena-runtime' / ('ownership-backup-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
        backup.mkdir(mode=0o700)
        written = []
        try:
            for target, old, new in plans:
                if target.read_bytes() != old:
                    raise ValueError('CHANGED_BEFORE_WRITE')
                if old == new:
                    continue
                saved = backup / target.relative_to(home)
                saved.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(target, saved)
                temp = target.with_suffix(target.suffix + '.ownership-tmp')
                with temp.open('xb') as stream:
                    os.chmod(temp, target.stat().st_mode & 0o777)
                    stream.write(new)
                temp.replace(target)
                written.append((target, old))
                assert target.read_bytes() == new
        except Exception:
            for target, old in reversed(written):
                target.write_bytes(old)
            raise
        report.update(status='INSTALLED', backup=str(backup), changed_files=len(written),
                      installed_at=datetime.now(timezone.utc).isoformat())
        (home / 'helena-runtime/action-ownership-receipt.json').write_text(json.dumps(report, indent=2))
    return report


def audit(home, source):
    import yaml
    sys.path.insert(0, str(home / 'helena-runtime'))
    import hermes_dispatch_once as dispatch
    package = json.loads((source / 'ownership-package.json').read_text())
    result = []
    for slug in package['profiles']:
        root = home / 'profiles' / slug
        config = yaml.safe_load((root / 'config.yaml').read_text())
        servers = config.get('mcp_servers', {})
        row = {'profile':slug, 'rule_present':package['new_rule'].strip() in (root/'SOUL.md').read_text(),
               'tools':{name: value.get('tools', {}).get('include', [])
                        for name, value in servers.items() if isinstance(value, dict)},
               'skills': sorted(p.parent.name for p in (root/'skills').glob('*/SKILL.md'))}
        try:
            token = dispatch.token_for(home/'profiles', slug)
            ctx = dispatch.call_tool(dispatch.GATEWAY, token, 'get_work_context', {})
            row.update(profile_binding=ctx.get('profile'), role=ctx.get('role'),
                       context_version=ctx.get('context_version'),
                       quality_contract=ctx.get('agent_quality_contract'))
        except Exception as error:
            row['context_error_type'] = type(error).__name__
        result.append(row)
    report = {'profiles':result, 'model_calls':0, 'audited_at':datetime.now(timezone.utc).isoformat()}
    (home/'helena-runtime/action-ownership-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--home', type=Path, default=Path('/data'))
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--audit', action='store_true')
    args = parser.parse_args()
    source = Path(__file__).resolve().parent
    print(json.dumps(audit(args.home, source) if args.audit else install(args.home, source, args.apply), ensure_ascii=False))
