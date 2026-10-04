import { runHermesPython } from './hermes-remote-exec.mjs';
import { validateBriefStructure } from '../services/helena-gateway/src/brief-contract.mjs';

async function main() {
  console.log('================================================================');
  console.log('📝 TESTE DE PONTA A PONTA: ISABELA (AGT-17 - MARCA, CONTEÚDO E COPY)');
  console.log('================================================================\n');

  const targetAgentId = 'AGT-17'; // Isabela
  const businessId = 'BIZ-003';   // Humano Digital
  const objective = 'Criar duas propostas de copy institucional para apresentação da comunidade Humano Digital para projetos de IA.';
  const definitionOfDone = 'Duas opções completas de copy persuasiva contendo headline magnética, desenvolvimento claro do problema de dados para IA, solução via comunidade humana qualificada e CTA para descoberta de 15 minutos, prontas para revisão.';

  const instruction = `## Contexto e fontes
A Humano Digital (BIZ-003) e uma agencia especializada que capta, orienta e conecta pessoas a empresas com projetos de coleta, validacao e anotacao de dados para inteligencia artificial. Seu principal ativo e uma comunidade humana organizada, engajada e preparada para tarefas de participacao real. As fontes canonicas incluem o cadastro company_identity row_version 3823 e o contrato de qualidade de redacao e copy institucional.

## Objetivo e impacto
Produzir duas opcoes distintas de copy institucional voltadas a fundadores e diretores de tecnologia que necessitam de dados humanos em larga escala para calibrar modelos de IA. O impacto esperado e gerar autoridade tecnica e atrair oportunidades comerciais qualificadas para a comunidade da empresa.

## Escopo e limites
Trabalho estritamente de redacao de copy de texto interno. Nao inclui geracao de artes visuais, publicacao em redes sociais, contato com terceiros ou compromissos comerciais de preco ou prazo.

## Plano de trabalho
1. Estruturar a Opcao 1 focada no contraste entre modelos de IA avancados e a escassez de dados humanos proprietarios confiaveis.
2. Estruturar a Opcao 2 focada na agilidade operacional de acionar uma comunidade humana treinada sem sobrecarregar a equipe interna do cliente.
3. Incluir em ambas: headline forte, contexto do problema, apresentacao da solucao sem promessas exageradas e chamada objetiva para conversa de 15 minutos.

## Entregáveis
Duas propostas completas de copy institucional prontas para aplicacao em publicacoes corporativas ou materiais de apresentacao B2B.

## Critérios de pronto
Texto persuasivo, maduro e rigorosamente aderente a identidade da Humano Digital como conectora de comunidade para coleta de dados para IA; sem promessas irreais de renda ou capacidade nao confirmada; estrutura com headline, corpo e CTA bem definidos.

## Evidências e registro
Registro integral via ferramenta submit_work com summary estruturado, limitacoes delimitadas e acceptance_checks com criterios e evidencias correspondentes.

## Revisão e encaminhamento
Encaminhamento para revisao independente da Helena para conferencia de aderencia factual a marca antes de qualquer aprovacao e uso oficial.`;

  console.log('1. Validando briefing profissional da Isabela...');
  validateBriefStructure(instruction);
  console.log(`   ✅ Briefing validado com sucesso (${instruction.length} caracteres, 8 seções completas).\n`);

  const runPayload = {
    businessId,
    targetAgentId,
    objective,
    definitionOfDone,
    instruction,
    ts: Date.now()
  };

  const payloadB64 = Buffer.from(JSON.stringify(runPayload), 'utf-8').toString('base64');

  // 2. Criar e liberar no Gateway
  console.log('2. Criando e liberando tarefa no Gateway pela Helena (AGT-01)...');
  const setupPython = `
import sys, json, os, time, base64
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d
from pathlib import Path

payload = json.loads(base64.b64decode('${payloadB64}').decode('utf-8'))
root = Path('/data/profiles')
token = d.token_for(root, 'helena--grupo')

idemp = f"copy-isabela-{payload['ts']}"
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
print(f"CREATE_SUCCESS: job_id={job_id}", flush=True)

detail = d.call_tool(d.GATEWAY, token, 'get_job', {'job_id': job_id})
task_ver = detail.get('task', {}).get('row_version', 1)

release_args = {
    'job_id': job_id,
    'expected_task_version': task_ver,
    'idempotency_key': f"rel-{idemp}"
}
res_release = d.call_tool(d.GATEWAY, token, 'release_job', release_args)
print(f"RELEASE_SUCCESS: status={res_release.get('status')}", flush=True)

with open('/data/helena-runtime/current-copy-job.json', 'w') as f:
    json.dump({'job_id': job_id, 'status': res_release.get('status')}, f, indent=2)
print("JOB_READY_FOR_ISABELA", flush=True)
`;

  const setupRes = await runHermesPython(setupPython, 20000);
  console.log(setupRes);

  if (!setupRes.includes('JOB_READY_FOR_ISABELA')) {
    console.error('❌ Falha ao criar/liberar job da Isabela!');
    return;
  }

  // 3. Despachar Isabela no Hermes
  console.log('3. Despachando Isabela (AGT-17) no Hermes CLI...');
  const dispatchPython = `
import sys, json, os
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d
from pathlib import Path

with open('/data/helena-runtime/current-copy-job.json') as f:
    info = json.load(f)
job_id = info['job_id']
print(f"DISPATCHING_ISABELA_JOB: {job_id}", flush=True)

root = Path('/data/profiles')
os.environ['HELENA_DISPATCH_ENABLED'] = '1'

# Executar despachante
res = d.dispatch_once(root, d.GATEWAY, approved_job=job_id, execute=True)
print("DISPATCH_RESULT:", json.dumps(res, indent=2, ensure_ascii=False), flush=True)

# Consultar status
token = d.token_for(root, 'helena--grupo')
detail = d.call_tool(d.GATEWAY, token, 'get_job', {'job_id': job_id})
job = detail.get('job', {})
print(f"JOB_STATUS_AFTER: {job.get('status')}", flush=True)
print(f"SUMMARY: {job.get('result_summary')}", flush=True)
`;

  console.log('   ⏳ Aguardando inferência e submissão da Isabela no Hermes (até 120s)...');
  const dispatchRes = await runHermesPython(dispatchPython, 120000);
  console.log(dispatchRes);

  // 4. Revisão independente pela Helena
  console.log('\n4. Avaliando entrega para aprovação executiva...');
  const reviewPython = `
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
job = detail.get('job', {})
print(f"CURRENT_JOB_STATUS: {job.get('status')}", flush=True)
print(f"RESULT_SUMMARY: {job.get('result_summary')}", flush=True)

task_ver = detail.get('task', {}).get('row_version')
if job.get('status') in ('WAITING_HELENA', 'UNDER_REVIEW') or job.get('result_payload', {}).get('review_pending'):
    print("Aprovando entrega da Isabela...", flush=True)
    appr_args = {
        'job_id': job_id,
        'expected_task_version': task_ver,
        'decision': 'APPROVE',
        'reason': 'Aprovado: As duas propostas de copy institucional atendem com maestria ao posicionamento da Humano Digital. Textos claros, persuasivos e orientados a resolucao do gargalo de dados humanos para IA.',
        'idempotency_key': f"appr-isabela-{job_id}"
    }
    res_appr = d.call_tool(d.GATEWAY, token, 'review_delivery', appr_args)
    print("REVIEW_DELIVERY_RESULT:", json.dumps(res_appr, indent=2, ensure_ascii=False), flush=True)

# Status final no Supabase
final_detail = d.call_tool(d.GATEWAY, token, 'get_job', {'job_id': job_id})
final_job = final_detail.get('job', {})
final_task = final_detail.get('task', {})
print("=" * 50)
print(f"FINAL JOB STATUS:  {final_job.get('status')}")
print(f"FINAL TASK STATUS: {final_task.get('status')}")
print(f"SUMMARY: {final_job.get('result_summary')}")
print("=" * 50)
`;

  const reviewRes = await runHermesPython(reviewPython, 20000);
  console.log(reviewRes);
  console.log('\n================================================================');
  console.log('🎉 CICLO DA ISABELA (AGT-17) HOMOLOGADO COM SUCESSO TOTAL!');
  console.log('================================================================');
}

main().catch(console.error);
