"""Restore the approved coordinator action without reprovisioning credentials."""
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import yaml


def enable(home):
    home = Path(home).resolve(strict=True)
    plans = []
    for profile in ('helena--grupo', 'marina--biz003'):
        path = home / 'profiles' / profile / 'config.yaml'
        if path.is_symlink() or not path.resolve().is_relative_to(home):
            raise ValueError('Unexpected profile path')
        config = yaml.safe_load(path.read_text())
        included = config['mcp_servers']['helena_operacao']['tools']['include']
        assert isinstance(included, list) and 'resolve_job_block' in included
        if 'revise_task_brief' not in included:
            included.append('revise_task_brief')
            plans.append((path, config))
    backup = home / 'helena-runtime' / ('brief-tools-backup-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    backup.mkdir(mode=0o700)
    for path, config in plans:
        saved = backup / path.parent.name
        saved.mkdir(mode=0o700)
        shutil.copy2(path, saved / path.name)
        tmp = path.with_suffix('.brief-tmp')
        with tmp.open('x', encoding='utf-8') as out:
            os.chmod(tmp, 0o600)
            yaml.safe_dump(config, out, allow_unicode=True, sort_keys=False)
        tmp.replace(path)
        assert 'revise_task_brief' in yaml.safe_load(path.read_text())['mcp_servers']['helena_operacao']['tools']['include']
    print(json.dumps({'profiles_updated': len(plans), 'backup': str(backup), 'model_calls': 0, 'credentials_unchanged': True}))


if __name__ == '__main__':
    enable('/data')
