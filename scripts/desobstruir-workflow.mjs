import { runHermesPython } from './hermes-remote-exec.mjs';

async function main() {
  console.log('=== DESOBSTRUÇÃO DO WORKFLOW-STATE NO HERMES ===\n');

  const py = `
import json, shutil, os
from datetime import datetime, timezone

state_path = '/data/helena-runtime/workflow-state.json'
backup_path = f'/data/helena-runtime/workflow-state-backup-{datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")}.json'

with open(state_path, 'r', encoding='utf-8') as f:
    st = json.load(f)

# 1. Fazer backup integral seguro
shutil.copyfile(state_path, backup_path)
print(f"BACKUP_SAVED: {backup_path}")

receipts = st.get('receipts', {})
stalled_count = 0
for k, v in receipts.items():
    if v.get('status') == 'NEEDS_ATTENTION':
        v['status'] = 'RECONCILED'
        v['reconciled_reason'] = 'FLEET_ALIGNMENT_20261003'
        v['reconciled_at'] = datetime.now(timezone.utc).isoformat()
        stalled_count += 1

print(f"RECONCILED_ITEMS_COUNT: {stalled_count}")

# 2. Salvar atomicamente
tmp_path = state_path + '.tmp'
with open(tmp_path, 'w', encoding='utf-8') as f:
    json.dump(st, f, indent=2, ensure_ascii=False)
os.replace(tmp_path, state_path)

print("STATE_UPDATED_SUCCESSFULLY")

# 3. Testar o hermes_workflow_tick em dry-run (sem --execute)
import sys
sys.path.insert(0, '/data/helena-runtime')
import hermes_workflow_tick as w
from pathlib import Path

wf = w.Workflow(Path('/data/helena-runtime'), Path('/data/profiles'))
res = wf.run(execute=False)
print("WORKFLOW_TICK_DRY_RUN_RESULT:", json.dumps(res, indent=2))
`;

  const res = await runHermesPython(py, 20000);
  console.log(res);
}

main().catch(console.error);
