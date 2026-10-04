import { runHermesPython } from './hermes-remote-exec.mjs';

async function main() {
  const py = `
import sys, json
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d
from pathlib import Path

token = d.token_for(Path('/data/profiles'), 'helena--grupo')
jobs = [
    'JOB-HR-93e0b4b10425f364e9ddb0c4a27c52a1',
    'JOB-HR-14d3fa88fd5522f2140b832e92a88b2b',
    'JOB-HR-0fdefd52311b7b9488542bbc2928ae76',
    'JOB-HR-fa4e7ff6a34fa4214239d884cfdfd19d'
]

results = {}
for jid in jobs:
    detail = d.call_tool(d.GATEWAY, token, 'get_job', {'job_id': jid})
    job = detail.get('job', {})
    results[jid] = {
        'status': job.get('status'),
        'agent_id': job.get('agent_id'),
        'result_summary': job.get('result_summary'),
        'attempt_count': job.get('attempt_count'),
        'max_attempts': job.get('max_attempts')
    }

print(json.dumps(results, indent=2, ensure_ascii=False))
`;

  const res = await runHermesPython(py, 15000);
  console.log(res);
}

main().catch(console.error);
