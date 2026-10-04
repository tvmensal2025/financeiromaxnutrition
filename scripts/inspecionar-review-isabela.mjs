import { runHermesPython } from './hermes-remote-exec.mjs';

const py = `
import sys, json
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d
from pathlib import Path

root = Path('/data/profiles')
token = d.token_for(root, 'helena--grupo')
job_id = 'JOB-HR-17f267d394b82642eb360b0eca01d840'

detail = d.call_tool(d.GATEWAY, token, 'get_job', {'job_id': job_id})
job = detail.get('job', {})
task = detail.get('task', {})
events = detail.get('events', [])

print("JOB_STATUS:", job.get('status'))
print("JOB_APPROVAL_STATUS:", job.get('approval_status'))
print("TASK_STATUS:", task.get('status'))
print("TASK_ROW_VERSION:", task.get('row_version'))
print("RESULT_SUMMARY:", job.get('result_summary'))
print("LATEST_EVENTS:")
for e in events[-5:]:
    print(f"  - [{e.get('event_type')}] {e.get('created_at')}: {e.get('message')}")
`;

async function main() {
  const res = await runHermesPython(py, 15000);
  console.log(res);
}

main().catch(console.error);
