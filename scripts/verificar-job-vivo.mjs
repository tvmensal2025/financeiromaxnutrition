import { runHermesPython } from './hermes-remote-exec.mjs';

async function main() {
  const py = `
import sys, json
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d
from pathlib import Path

token = d.token_for(Path('/data/profiles'), 'helena--grupo')
job_id = 'JOB-HR-2f0d396a0620e686130b62e211fc7514'

detail = d.call_tool(d.GATEWAY, token, 'get_job', {'job_id': job_id})
job = detail.get('job', {})
print("STATUS:", job.get('status'))
print("AGENT:", job.get('agent_id'))
print("SUMMARY:", job.get('result_summary'))
print("ATTEMPTS:", f"{job.get('attempt_count')}/{job.get('max_attempts')}")
print("EVENTS:", [e.get('event_type') for e in detail.get('events', [])])
if job.get('result_payload'):
    print("PAYLOAD_KEYS:", list(job.get('result_payload', {}).keys()))
`;

  const res = await runHermesPython(py, 15000);
  console.log(res);
}

main().catch(console.error);
