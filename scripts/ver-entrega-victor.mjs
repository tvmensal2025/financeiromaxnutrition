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
payload = job.get('result_payload', {})
delivery = payload.get('delivery', {})

print("=== ENTREGA REAL DO AGENTE VICTOR (AGT-15) NO HERMES ===")
print("TITLE:", delivery.get('title'))
print("CONTENT_JSON:", json.dumps(delivery.get('content'), ensure_ascii=False))
print("LIMITATIONS_JSON:", json.dumps(delivery.get('limitations'), ensure_ascii=False))
print("ACCEPTANCE_CHECKS:", json.dumps(delivery.get('acceptance_checks'), indent=2, ensure_ascii=False))
`;

  const res = await runHermesPython(py, 15000);
  console.log(res);
}

main().catch(console.error);
