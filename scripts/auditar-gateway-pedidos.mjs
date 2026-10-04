import { runHermesPython } from './hermes-remote-exec.mjs';

const py = `
import sys, json
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d
from pathlib import Path

root = Path('/data/profiles')
token = d.token_for(root, 'helena--grupo')

# 1. Consultar estatísticas da fila e jobs no Gateway
queue_sum = d.call_tool(d.GATEWAY, token, 'queue_summary', {})
ready_jobs = d.call_tool(d.GATEWAY, token, 'list_ready_jobs', {'limit': 20})
jobs_list = ready_jobs.get('jobs', [])
kanban = d.call_tool(d.GATEWAY, token, 'kanban_snapshot', {'limit': 20})

# 2. Consultar foco executivo e contexto geral da Helena
context = d.call_tool(d.GATEWAY, token, 'get_work_context', {})
foco = context.get('foco_executivo', {})

# 3. Consultar agentes e conexões
# Vamos verificar o resumo do preflight
with open('/data/helena-runtime/preflight-summary.json') as f:
    preflight = json.load(f)

# 4. Consultar jobs recentes no Gateway (Victor, Isabela, etc.)
recent_jobs = [
    'JOB-HR-17f267d394b82642eb360b0eca01d840', # Isabela mais recente (COMPLETED)
    'JOB-HR-066aa229ff06ad1d9a9245493c6f450a', # Isabela teste 1 (FAILED por transporte)
    'JOB-HR-2f0d396a0620e686130b62e211fc7514', # Victor (FAILED por timeout anterior, mas entrega gravada)
]

job_details = []
for jid in recent_jobs:
    try:
        det = d.call_tool(d.GATEWAY, token, 'get_job', {'job_id': jid})
        j = det.get('job', {})
        t = det.get('task', {})
        job_details.append({
            'job_id': jid,
            'agent_id': j.get('agent_id'),
            'business_id': j.get('business_id'),
            'job_status': j.get('status'),
            'approval_status': j.get('approval_status'),
            'task_id': j.get('task_id'),
            'task_status': t.get('status'),
            'has_delivery': bool(j.get('result_payload', {}).get('delivery')),
            'result_summary': j.get('result_summary')[:120] if j.get('result_summary') else None
        })
    except Exception as e:
        job_details.append({'job_id': jid, 'error': str(e)})

audit = {
    'gateway_online': True,
    'queue_summary': queue_sum,
    'ready_jobs_count': len(jobs_list),
    'kanban_snapshot_sample': kanban.get('items', [])[:5],
    'total_profiles_homologados': len(preflight),
    'active_profiles_count': sum(1 for p in preflight if p.get('status') == 'ACTIVE'),
    'recent_jobs': job_details,
    'foco_executivo_ativo': foco
}

print(json.dumps(audit, indent=2, ensure_ascii=False))
`;

async function main() {
  const res = await runHermesPython(py, 20000);
  console.log(res);
}

main().catch(console.error);
