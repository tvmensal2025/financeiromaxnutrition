"""Install the review consumer on the existing Hermes runtime; preserve cron and state."""
import ast
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import runpy

source = Path(__file__).resolve().parent
runtime = Path('/data/helena-runtime')
poll = Path('/data/scripts/helena_dispatch_poll.sh')
assert runtime.is_dir() and poll.is_file() and not poll.is_symlink()
assert 'hermes_dispatch_once.py --auto --execute' in poll.read_text()
assert (runtime / 'hermes_dispatch_once.py').is_file()
incoming = (source / 'hermes_workflow_tick.py').read_text()
ast.parse(incoming)
backup = runtime / ('workflow-backup-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
backup.mkdir()
shutil.copy2(poll, backup / poll.name)
target = runtime / 'hermes_workflow_tick.py'
if target.exists(): shutil.copy2(target, backup / target.name)
temporary = target.with_suffix('.tmp')
temporary.write_text(incoming, encoding='utf-8', newline='\n')
temporary.replace(target)
probe_source = source / 'hermes_mcp_preflight.py'
if probe_source.exists():
    probe = runtime / probe_source.name
    updated_probe = probe_source.read_text()
    ast.parse(updated_probe)
    if probe.exists(): shutil.copy2(probe, backup / probe.name)
    staging = probe.with_suffix('.tmp')
    staging.write_text(updated_probe, encoding='utf-8', newline='\n')
    staging.replace(probe)
dispatcher_source = source / 'hermes_dispatch_once.py'
if dispatcher_source.exists():
    dispatcher = runtime / dispatcher_source.name
    updated = dispatcher_source.read_text()
    ast.parse(updated)
    assert 'has_current_release' in updated and 'view=manifest' in updated
    shutil.copy2(dispatcher, backup / dispatcher.name)
    staging = dispatcher.with_suffix('.tmp')
    staging.write_text(updated, encoding='utf-8', newline='\n')
    staging.replace(dispatcher)
config_path = runtime / 'workflow-config.json'
if not config_path.exists():
    config = json.loads((source / 'workflow-config-template.json').read_text())
    config['new_jobs_after'] = datetime.now(timezone.utc).isoformat()
    config_path.write_text(json.dumps(config, ensure_ascii=False), encoding='utf-8')
replacement = poll.with_suffix('.tmp')
replacement.write_text((source / poll.name).read_text(), encoding='utf-8', newline='\n')
replacement.chmod(poll.stat().st_mode)
replacement.replace(poll)
brief_tools_patch = source / 'enable_brief_revision.py'
if brief_tools_patch.exists():
    runpy.run_path(str(brief_tools_patch), run_name='__main__')
print(json.dumps({'status':'INSTALLED','backup':str(backup),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
                  'model_calls':0,'schedule_changed':False,'state_preserved':True}))
