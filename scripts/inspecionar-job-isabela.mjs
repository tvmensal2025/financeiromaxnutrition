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
failed_events = [e for e in detail.get('events', []) if e.get('event_type') in ('FAILED', 'PROGRESS')]
print(json.dumps(failed_events, indent=2, ensure_ascii=False))
`;

async function main() {
  const res = await runHermesPython(pyCode, 15000);
  console.log(res);
}

main().catch(console.error);
