import { runHermesPython } from './hermes-remote-exec.mjs';

async function main() {
  console.log('=====================================================');
  console.log('⚡ DISPARO E EXECUÇÃO DO JOB PILOTO NO HERMES');
  console.log('=====================================================\n');

  const py = `
import sys, json, os, subprocess
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d
from pathlib import Path

with open('/data/helena-runtime/current-test-job.json') as f:
    info = json.load(f)
job_id = info['job_id']
print(f"TARGET_JOB_ID: {job_id}", flush=True)

root = Path('/data/profiles')
binary = d.resolve_hermes_binary()
print(f"HERMES_BINARY: {binary}", flush=True)

# 1. Verificar preflight de uso e cotas antes da execucao
print("Checking usage preflight...", flush=True)
usage = d.usage_preflight(binary, 'victor--biz003')
print(f"USAGE_STATUS: {usage.get('status')}", flush=True)

# 2. Executar o despachante com autorizacao explcita
os.environ['HELENA_DISPATCH_ENABLED'] = '1'
print("Calling dispatch_once with execute=True...", flush=True)

res = d.dispatch_once(root, d.GATEWAY, approved_job=job_id, execute=True)
print("DISPATCH_RETURN_RAW:", json.dumps(res, indent=2, ensure_ascii=False), flush=True)

# 3. Consultar estado canonico apos execucao
token = d.token_for(root, 'helena--grupo')
detail = d.call_tool(d.GATEWAY, token, 'get_job', {'job_id': job_id})
job = detail.get('job', {})
print(f"JOB_STATUS_AFTER: {job.get('status')}", flush=True)
print(f"RESULT_SUMMARY: {job.get('result_summary')}", flush=True)
print(f"ATTEMPTS: {job.get('attempt_count')}/{job.get('max_attempts')}", flush=True)
`;

  // Timeout de 150 segundos para cobrir toda a inferência do modelo e envio de entrega
  console.log('Iniciando dispatch no Hermes com monitoramento de até 150s...');
  const res = await runHermesPython(py, 150000);
  console.log(res);
}

main().catch(console.error);
