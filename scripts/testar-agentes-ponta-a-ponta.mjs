import { runHermesCommand, runHermesPython } from './hermes-remote-exec.mjs';
import { validateBriefStructure } from '../services/helena-gateway/src/brief-contract.mjs';

async function main() {
  console.log('=====================================================');
  console.log('🚀 TESTE DE PONTA A PONTA: HELENA + AGENTES NO HERMES');
  console.log('=====================================================\n');

  const targetAgentId = 'AGT-15'; // Victor (Vendas B2B)
  const businessId = 'BIZ-003';   // Humano Digital
  const objective = 'Elaborar roteiro de abordagem comercial B2B e matriz de quebra de 3 principais objeções para a Humano Digital.';
  const definitionOfDone = 'Documento de vendas estruturado com gancho, qualificação de dor, proposta de valor e matriz com 3 objeções respondidas de forma lógica e profissional, pronto para uso da equipe.';

  const instruction = `## Contexto e fontes
A Humano Digital (BIZ-003) desenvolve e opera agentes de inteligencia artificial autonomos integrados a fluxos empresariais complexos. As fontes canonicas incluem o posicionamento oficial da empresa, o contrato de qualidade operacional e os parametros vigentes de atendimento e vendas B2B.

## Objetivo e impacto
Construir uma abordagem comercial consultiva e direta para tomadores de decisao em medias e grandes empresas, posicionando a automacao inteligente da Humano Digital. O impacto esperado e qualificar oportunidades comerciais e acelerar o ciclo de vendas inicial sem atrito tecnico desnecessario.

## Escopo e limites
O trabalho e estritamente de elaboracao interna de modelo de abordagem comercial e matriz de quebra de objecoes. Nao inclui contato ativo externo, disparo de mensagens a leads reais, envio de propostas comerciais formais ou negociacao contratual.

## Plano de trabalho
1. Mapear as tres dores primarias enfrentadas por diretores operacionais e fundadores na gestao de equipes sobrecarregadas.
2. Estruturar o roteiro de abordagem comercial B2B em quatro etapas: gancho de atencao, dor concreta, solucao comprovada e chamada clara para conversa de 15 minutos.
3. Desenvolver matriz tatica de quebra das tres maiores objecoes: custo vs ROI, seguranca da informacao e facilidade de integracao aos sistemas legados.

## Entregáveis
Um documento de abordagem comercial B2B contendo o roteiro de abordagem estruturado e a matriz detalhada com as tres principais objecoes e respectivas argumentacoes recomendadas para fechamento.

## Critérios de pronto
O material deve conter linguagem profissional, natural e persuasiva; a estrutura deve seguir rigorosamente as quatro etapas da abordagem; as respostas as objecoes devem conter dados e argumentos logicos verificaveis; e todo o texto deve ser utilizavel imediatamente pela equipe.

## Evidências e registro
Todas as referencias devem ser registradas na entrega oficial do Gateway via ferramenta submit_work, incluindo title, content completo, limitacoes do escopo e os criterios de aceitacao validados.

## Revisão e encaminhamento
A entrega sera submetida para revisao independente da Helena ou da coordenacao designada para validacao de conformidade com o posicionamento da Humano Digital antes de qualquer utilizacao em producao.`;

  console.log('1. Validando contrato do Briefing Profissional...');
  validateBriefStructure(instruction);
  console.log(`   ✅ Briefing validado com sucesso (${instruction.length} caracteres, 8 seções completas).\n`);

  // 2. Criar a tarefa e liberar via Helena no Gateway/Hermes
  console.log('2. Conectando ao Hermes para orquestrar via Helena (AGT-01)...');
  const runPayload = {
    businessId,
    targetAgentId,
    objective,
    definitionOfDone,
    instruction,
    ts: Date.now()
  };

  const payloadB64 = Buffer.from(JSON.stringify(runPayload), 'utf-8').toString('base64');

  const setupPython = `
import sys, json, os, time, base64
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d
from pathlib import Path

payload = json.loads(base64.b64decode('${payloadB64}').decode('utf-8'))
root = Path('/data/profiles')
token = d.token_for(root, 'helena--grupo')

# 1. Criar tarefa e job em DRAFT
idemp = f"pilot-test-{payload['targetAgentId']}-{payload['ts']}"
print(f"Creating task_job with idempotency_key: {idemp}...", flush=True)

task_job_args = {
    'business_id': payload['businessId'],
    'target_agent_id': payload['targetAgentId'],
    'objective': payload['objective'],
    'definition_of_done': payload['definitionOfDone'],
    'instruction': payload['instruction'],
    'idempotency_key': idemp
}

res_create = d.call_tool(d.GATEWAY, token, 'create_task_job', task_job_args)
job_id = res_create.get('job_id')
task_id = res_create.get('task_id')
print(f"CREATE_SUCCESS: job_id={job_id}, task_id={task_id}", flush=True)

# 2. Obter versão da tarefa para liberação
detail = d.call_tool(d.GATEWAY, token, 'get_job', {'job_id': job_id})
task_ver = detail.get('task', {}).get('row_version', 1)

# 3. Liberar job para READY via release_job
print(f"Releasing job {job_id} with version {task_ver}...", flush=True)
release_args = {
    'job_id': job_id,
    'expected_task_version': task_ver,
    'idempotency_key': f"rel-{idemp}"
}
res_release = d.call_tool(d.GATEWAY, token, 'release_job', release_args)
print(f"RELEASE_SUCCESS: status={res_release.get('status')}", flush=True)

out = {
    'job_id': job_id,
    'task_id': task_id,
    'status': res_release.get('status'),
    'ready': res_release.get('status') == 'READY'
}
with open('/data/helena-runtime/current-test-job.json', 'w') as f:
    json.dump(out, f, indent=2)
print("JOB_PREPARED_AND_READY", flush=True)
`;

  const setupRes = await runHermesPython(setupPython, 20000);
  console.log(setupRes);

  if (!setupRes.includes('JOB_PREPARED_AND_READY')) {
    console.error('❌ Falha ao preparar o job de teste!');
    return;
  }

  // 3. Executar o despachante com o job criado
  console.log('\n3. Disparando o despachante do Hermes para execução do agente...');
  const dispatchPython = `
import sys, json, os, subprocess
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d
from pathlib import Path

with open('/data/helena-runtime/current-test-job.json') as f:
    info = json.load(f)
job_id = info['job_id']
print(f"DISPATCHING_JOB: {job_id}", flush=True)

root = Path('/data/profiles')
binary = d.resolve_hermes_binary()

# Executar despachante para esse job com flag de execucao autorizada
os.environ['HELENA_DISPATCH_ENABLED'] = '1'
res = d.dispatch_once(root, d.GATEWAY, approved_job=job_id, execute=True)
print("DISPATCH_RESULT:", json.dumps(res, indent=2, ensure_ascii=False), flush=True)

# Consultar status do job apos execucao
token = d.token_for(root, 'helena--grupo')
detail = d.call_tool(d.GATEWAY, token, 'get_job', {'job_id': job_id})
job = detail.get('job', {})
print(f"FINAL_JOB_STATUS: {job.get('status')}", flush=True)
print(f"RESULT_SUMMARY: {job.get('result_summary')}", flush=True)
`;

  // Timeout generoso para o modelo pensar e gerar a entrega (120 segundos)
  console.log('   ⏳ Executando modelo no Hermes CLI e aguardando submissão de trabalho...');
  const dispatchRes = await runHermesPython(dispatchPython, 120000);
  console.log(dispatchRes);

  console.log('\n4. Verificando resultado final da execução...');
  const checkStatusPython = `
import sys, json
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d
from pathlib import Path

with open('/data/helena-runtime/current-test-job.json') as f:
    info = json.load(f)
job_id = info['job_id']

token = d.token_for(Path('/data/profiles'), 'helena--grupo')
detail = d.call_tool(d.GATEWAY, token, 'get_job', {'job_id': job_id})
print("JOB_FULL_DETAILS:", json.dumps({
    'job_id': job_id,
    'status': detail.get('job', {}).get('status'),
    'agent_id': detail.get('job', {}).get('agent_id'),
    'result_summary': detail.get('job', {}).get('result_summary'),
    'events_count': len(detail.get('events', []))
}, indent=2, ensure_ascii=False))
`;

  const finalRes = await runHermesPython(checkStatusPython, 15000);
  console.log(finalRes);
  console.log('\n=====================================================');
  console.log('🏁 CICLO DE TESTE CONCLUÍDO COM SUCESSO');
  console.log('=====================================================');
}

main().catch(console.error);
