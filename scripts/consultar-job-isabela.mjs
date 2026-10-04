import { runHermesPython } from './hermes-remote-exec.mjs';

async function main() {
  const py = `
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
print("ISABELA_JOB_STATUS:", job.get('status'))
print("ATTEMPTS:", f"{job.get('attempt_count')}/{job.get('max_attempts')}")
print("SUMMARY:", job.get('result_summary'))
print("EVENTS:", [e.get('event_type') for e in detail.get('events', [])])
if job.get('result_payload'):
    print("PAYLOAD_KEYS:", list(job.get('result_payload', {}).keys()))
`;

  const res = await runHermesPython(py, 15000);
  console.log(res);
}

main().catch(console.error);
