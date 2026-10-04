import { runHermesPython } from './hermes-remote-exec.mjs';

const pyCode = `
import sys, json
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d
from pathlib import Path

with open('/data/helena-runtime/current-copy-job.json') as f:
    info = json.load(f)
job_id = info['job_id']
root = Path('/data/profiles')
token = d.token_for(root, 'helena--grupo')

detail = d.call_tool(d.GATEWAY, token, 'get_job', {'job_id': job_id})
job = detail.get('job', {})
task = detail.get('task', {})

print("STATUS:", job.get('status'))
print("ATTEMPT_COUNT:", job.get('attempt_count'))
print("MAX_ATTEMPTS:", job.get('max_attempts'))
print("TASK_ROW_VERSION:", task.get('row_version'))

# Tenta liberar para tentativa 2
try:
    res = d.call_tool(d.GATEWAY, token, 'release_job', {
        'job_id': job_id,
        'idempotency_key': f'rel-isabela-retry2-{int(task.get("row_version", 1))}',
        'expected_task_version': int(task.get('row_version', 1))
    })
    print("RELEASE_RESULT:", json.dumps(res, indent=2))
except Exception as e:
    print("RELEASE_ERROR:", type(e).__name__, str(e))
`;

async function main() {
  const res = await runHermesPython(pyCode, 15000);
  console.log(res);
}

main().catch(console.error);
