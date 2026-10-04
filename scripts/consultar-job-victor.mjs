import { runHermesPython } from './hermes-remote-exec.mjs';

const py = `
import sys, json
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d
from pathlib import Path

job_id = 'JOB-HR-2f0d396a0620e686130b62e211fc7514'
root = Path('/data/profiles')
token = d.token_for(root, 'helena--grupo')

detail = d.call_tool(d.GATEWAY, token, 'get_job', {'job_id': job_id})
job = detail.get('job', {})
task = detail.get('task', {})
print('VICTOR_JOB_STATUS:', job.get('status'))
print('VICTOR_ATTEMPTS:', f"{job.get('attempt_count')}/{job.get('max_attempts')}")
print('TASK_STATUS:', task.get('status'))
print('TASK_ROW_VERSION:', task.get('row_version'))
print('RESULT_PAYLOAD_KEYS:', list(job.get('result_payload', {}).keys()))
`;

async function main() {
  const res = await runHermesPython(py, 15000);
  console.log(res);
}

main().catch(console.error);
