"""Install bounded brief policy with drift checks, backup and rollback; no inference/jobs."""
import argparse
import ast
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil


def sha(data):
    return hashlib.sha256(data.replace(b'\r\n', b'\n')).hexdigest()


def install(home, source, apply=False):
    import yaml
    home = home.resolve(strict=True)
    package = json.loads((source/'brief-safe-package.json').read_text())
    profiles = package['profiles']
    if len(profiles) != len(set(profiles)) or len(profiles) != 21:
        raise ValueError('PROFILE_COUNT')
    runtime = home/'helena-runtime'
    manifest_path = runtime/'quality-manifest.json'
    manifest_old = manifest_path.read_bytes()
    manifest = json.loads(manifest_old)
    plans, rows = [], []
    for name, item in package['runtime'].items():
        if Path(name).name != name:
            raise ValueError('UNSAFE_NAME')
        target = runtime/name
        old, new = target.read_bytes(), (source/name).read_bytes()
        ast.parse(new.decode())
        if sha(old) not in (item['old_sha256'], sha(new)):
            raise ValueError('RUNTIME_DRIFT:' + name)
        plans.append((target, old, new))
    for slug in profiles:
        if Path(slug).name != slug:
            raise ValueError('UNSAFE_PROFILE')
        root = home/'profiles'/slug
        config = yaml.safe_load((root/'config.yaml').read_text())
        args = config.get('mcp_servers',{}).get('helena_contracts',{}).get('args',[])
        if '/data/helena-runtime/brief_preflight.py' not in args:
            raise ValueError('PREFLIGHT_NOT_SHARED:' + slug)
        target = root/'SOUL.md'
        old = target.read_bytes()
        text = old.decode().replace('\r\n','\n')
        if package['old_rule'].strip() in text:
            text = text.replace(package['old_rule'].strip(),package['new_rule'].strip(),1)
        elif package['new_rule'].strip() not in text:
            raise ValueError('RULE_DRIFT:' + slug)
        new = text.encode()
        rows.append({'profile':slug,'rule_present':package['new_rule'].strip() in text,
                     'shared_preflight':True,'soul_sha256':sha(new)})
        plans.append((target,old,new))
        manifest.setdefault('soul_hashes',{})[slug] = hashlib.sha256(new).hexdigest()
    manifest['brief_safe_limits_version'] = 'helena-brief-safe-limits-v1'
    manifest['brief_safe_limits'] = package['limits']
    plans.append((manifest_path,manifest_old,json.dumps(manifest,ensure_ascii=False,indent=2).encode()))
    for target,old,new in plans:
        if target.is_symlink() or not target.resolve().is_relative_to(home):
            raise ValueError('UNSAFE_PATH')
        if target.read_bytes() != old:
            raise ValueError('CONCURRENT_CHANGE')
    report={'status':'VALIDATED','profiles':rows,'limits':package['limits'],
            'version':'helena-brief-safe-limits-v1','model_calls':0,'jobs_changed':False,
            'schedule_changed':False,'permissions_changed':False}
    if not apply:
        return report
    import fcntl
    with (runtime/'dispatcher.lock').open('a+') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        backup = runtime/('brief-safe-backup-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
        backup.mkdir(mode=0o700)
        written=[]
        try:
            for target,old,new in plans:
                if target.read_bytes() != old:
                    raise ValueError('CONCURRENT_CHANGE_BEFORE_WRITE')
                if old == new:
                    continue
                saved=backup/target.relative_to(home)
                saved.parent.mkdir(parents=True,exist_ok=True)
                shutil.copy2(target,saved)
                temp=target.with_suffix(target.suffix+'.brief-safe-tmp')
                with temp.open('xb') as stream:
                    os.chmod(temp,target.stat().st_mode&0o777)
                    stream.write(new)
                temp.replace(target)
                written.append((target,old))
                if target.read_bytes() != new:
                    raise ValueError('WRITE_NOT_CONFIRMED')
        except Exception:
            for target,old in reversed(written):
                target.write_bytes(old)
            raise
        report.update(status='INSTALLED',backup=str(backup),changed_files=len(written),
                      installed_at=datetime.now(timezone.utc).isoformat())
        (runtime/'brief-safe-receipt.json').write_text(json.dumps(report,indent=2))
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--home',type=Path,default=Path('/data'))
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    print(json.dumps(install(args.home,Path(__file__).resolve().parent,args.apply),ensure_ascii=False))
