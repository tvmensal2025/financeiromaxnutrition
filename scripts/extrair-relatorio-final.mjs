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
result_payload = job.get('result_payload', {})

summary = {
    'job_id': job_id,
    'agent_id': job.get('agent_id'),
    'external_agent_id': job.get('external_agent_id'),
    'business_id': job.get('business_id'),
    'job_status': job.get('status'),
    'job_approval_status': job.get('approval_status'),
    'task_id': job.get('task_id'),
    'task_status': task.get('status'),
    'task_row_version': task.get('row_version'),
    'objective': job.get('objective'),
    'delivery_title': result_payload.get('delivery', {}).get('title'),
    'delivery_content': result_payload.get('delivery', {}).get('content'),
    'delivery_limitations': result_payload.get('delivery', {}).get('limitations'),
    'delivery_next_steps': result_payload.get('delivery', {}).get('next_steps'),
    'acceptance_checks': result_payload.get('delivery', {}).get('acceptance_checks'),
    'events_chronological': [
        {
            'order': i + 1,
            'event_type': e.get('event_type'),
            'status': e.get('status'),
            'agent_id': e.get('agent_id'),
            'created_at': e.get('created_at'),
            'message': e.get('message')
        }
        for i, e in enumerate(events)
    ]
}

print(json.dumps(summary, indent=2, ensure_ascii=False))
`;

async function main() {
  const res = await runHermesPython(py, 20000);
  console.log(res);
}

main().catch(console.error);
