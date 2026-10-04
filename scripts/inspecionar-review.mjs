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
events = detail.get('events', [])
for e in events:
    if 'review' in e.get('event_type', '').lower():
        print("REVIEW EVENT:", json.dumps(e, indent=2, ensure_ascii=False))

payload = detail.get('job', {}).get('result_payload', {})
print("REVIEW_REASON:", payload.get('review_reason'))
print("REVIEW_PENDING:", payload.get('review_pending'))
print("REVIEWED_BY:", payload.get('reviewed_by'))
`;

  const res = await runHermesPython(py, 15000);
  console.log(res);
}

main().catch(console.error);
