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
print("ERROR_CODE:", job.get('error_code'))
print("ERROR_MESSAGE:", job.get('error_message'))
print("LAST EVENTS:", [e.get('event_type') + ': ' + str(e.get('message')) for e in detail.get('events', [])[-5:]])
`;

  const res = await runHermesPython(py, 15000);
  console.log(res);
}

main().catch(console.error);
