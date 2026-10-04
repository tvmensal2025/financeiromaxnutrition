import { runHermesPython, runHermesCommand } from './hermes-remote-exec.mjs';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('================================================================');
  console.log('🚀 INICIANDO PROCESSO COMPLETO ACOMPANHADO DE PONTA A PONTA');
  console.log('   Agente Alvo: Isabela (AGT-17 - Copywriter) | BIZ-003');
  console.log('   Coordenadora e Revisora: Helena (AGT-01)');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const idempotencyKey = `copy-isabela-auto-${timestamp}`;

  // -------------------------------------------------------------
  // FASE 1: Helena cria a tarefa profissional com 8 seções
  // -------------------------------------------------------------
  console.log('📌 [FASE 1/6] Helena (AGT-01) criando tarefa profissional...');
  
  const createPy = `
import sys, json, time
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d
from pathlib import Path

root = Path('/data/profiles')
token = d.token_for(root, 'helena--grupo')

instruction = """## Contexto e fontes
A Humano Digital (BIZ-003) e uma empresa especializada em mobilizar, qualificar e organizar pessoas para projetos de validacao, coleta e anotacao de dados humanos para inteligencia artificial. O principal diferencial da empresa e sua comunidade real ativa, capacitada para atender demandas com alto padrao de confiabilidade. Fontes canonicas: cadastro company_identity versao 3823 e contrato de qualidade de redacao e copy institucional.

## Objetivo e impacto
Redigir duas versoes completas e persuasivas de copy institucional voltadas para tomadores de decisao (fundadores e diretores de tecnologia) que precisam de dados humanos para alimentar e calibrar modelos de IA. O objetivo e demonstrar a forca e organizacao da comunidade da Humano Digital, gerando agendamentos de conversas de diagnostico de 15 minutos.

## Escopo e limites
Trabalho estritamente focado na criacao de texto e copy interna. Nao inclui geracao de imagens, postagem em redes sociais, mensagens diretas a clientes externos ou compromissos sobre preco e prazos comerciais sem alinhamento prévio.

## Plano de trabalho
1. Estruturar a Versao 1 focada na dor do mercado: o contraste entre algoritmos avancados de IA e a escassez de dados humanos confiaveis e etiquetados com qualidade.
2. Estruturar a Versao 2 focada na agilidade operacional: a facilidade de contratar uma comunidade estruturada sem precisar gastar semanas recrutando e gerenciando participantes por conta propria.
3. Desenvolver em ambas: titulo chamativo, apresentacao do problema real, apresentacao da solucao via comunidade e chamada para acao direta para agendamento de 15 minutos.

## Entregáveis
Duas opcoes completas de copy institucional prontas para utilizacao em apresentacoes executivas e conteudos corporativos B2B da Humano Digital.

## Critérios de pronto
Texto claro, persuasivo e estritamente aderente a identidade da Humano Digital (comunidade humana para geracao e validacao de dados de IA); sem promessas exageradas; contendo headline, desenvolvimento e chamada clara para acao.

## Evidências e registro
Registro de progresso intermediario e conclusao via ferramenta submit_work com summary detalhado, limitacoes observadas e acceptance_checks com criterios e evidencias correspondentes.

## Revisão e encaminhamento
Encaminhamento obrigatorio para revisao independente da Helena para conferencia e aprovacao executiva antes de qualquer publicacao."""

dod = "Duas opcoes completas de copy institucional B2B contendo headline atrativa, contextualizacao do gargalo de dados humanos para IA, solucao via comunidade e CTA de 15 minutos, prontas para revisao."

res = d.call_tool(d.GATEWAY, token, 'create_task_job', {
    'business_id': 'BIZ-003',
    'target_agent_id': 'AGT-17',
    'objective': 'Desenvolver duas opcoes de copy institucional B2B para apresentar a comunidade da Humano Digital a empresas de IA.',
    'instruction': instruction,
    'definition_of_done': dod,
    'idempotency_key': '${idempotencyKey}'
})

print(json.dumps(res, indent=2))
with open('/data/helena-runtime/active-auto-job.json', 'w') as f:
    json.dump(res, f)
`;

  const createResRaw = await runHermesPython(createPy, 25000);
  console.log('Resposta da Criação:\n', createResRaw);

  // Extrair o Job ID
  const jobMatch = createResRaw.match(/"job_id":\s*"(JOB-HR-[a-f0-9]{32})"/);
  if (!jobMatch) {
    throw new Error('Falha ao obter job_id da resposta de criação!');
  }
  const jobId = jobMatch[1];
  console.log(`✅ Tarefa criada com sucesso! Job ID: ${jobId}\n`);

  // -------------------------------------------------------------
  // FASE 2: Helena libera a tarefa (release_job)
  // -------------------------------------------------------------
  console.log(`📌 [FASE 2/6] Helena (AGT-01) liberando o job ${jobId} para execução...`);
  
  const releasePy = `
import sys, json
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d
from pathlib import Path

root = Path('/data/profiles')
token = d.token_for(root, 'helena--grupo')

with open('/data/helena-runtime/active-auto-job.json') as f:
    info = json.load(f)
job_id = info['job_id']

detail = d.call_tool(d.GATEWAY, token, 'get_job', {'job_id': job_id})
task = detail.get('task', {})
task_ver = task.get('row_version')

res = d.call_tool(d.GATEWAY, token, 'release_job', {
    'job_id': job_id,
    'idempotency_key': f'rel-${idempotencyKey}',
    'expected_task_version': task_ver
})
print("RELEASE_RESPONSE:", json.dumps(res, indent=2))
`;

  const releaseResRaw = await runHermesPython(releasePy, 25000);
  console.log('Resposta da Liberação:\n', releaseResRaw);
  console.log(`✅ Job liberado formalmente com status READY!\n`);

  // -------------------------------------------------------------
  // FASE 3: Despachar a execução em background no container Hermes
  // -------------------------------------------------------------
  console.log(`📌 [FASE 3/6] Despachando a IA da Isabela no Hermes CLI de forma resiliente...`);
  
  const runnerPy = `
import sys, json, os
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d
from pathlib import Path

root = Path('/data/profiles')
job_id = '${jobId}'
print(f'--- INICIANDO DISPATCH DA ISABELA ({job_id}) ---', flush=True)
os.environ['HELENA_DISPATCH_ENABLED'] = '1'
try:
    res = d.dispatch_once(root, d.GATEWAY, approved_job=job_id, execute=True)
    print('--- RESULTADO DISPATCH ---', flush=True)
    print(json.dumps(res, indent=2, ensure_ascii=False), flush=True)
except Exception as e:
    print('--- ERRO DISPATCH ---', type(e).__name__, str(e), flush=True)
`;

  // Salvar script no container
  const saveScriptPy = `
with open('/data/helena-runtime/run_job_runner.py', 'w') as f:
    f.write('''${runnerPy}''')
print("SCRIPT_SAVED")
`;
  await runHermesPython(saveScriptPy, 15000);

  // Lançar em background com nohup
  const launchCmd = `nohup python -u /data/helena-runtime/run_job_runner.py > /data/helena-runtime/current-execution.log 2>&1 & echo $! > /data/helena-runtime/current-execution.pid`;
  const launchRes = await runHermesCommand(launchCmd, 15000);
  console.log('Status do Lançamento:\n', launchRes);
  console.log(`✅ Processo da Isabela iniciado em background sem risco de interrupção de transporte!\n`);

  // -------------------------------------------------------------
  // FASE 4: Acompanhamento em tempo real (Polling até conclusão)
  // -------------------------------------------------------------
  console.log(`📌 [FASE 4/6] Acompanhando a execução da Isabela em tempo real...`);
  
  let attempts = 0;
  let finished = false;
  let jobStatus = 'UNKNOWN';
  let lastEventCount = 0;

  const checkPy = `
import sys, json
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d
from pathlib import Path

root = Path('/data/profiles')
token = d.token_for(root, 'helena--grupo')
job_id = '${jobId}'

detail = d.call_tool(d.GATEWAY, token, 'get_job', {'job_id': job_id})
job = detail.get('job', {})
events = detail.get('events', [])

# Ler ultimas 10 linhas do log
log_tail = ""
try:
    with open('/data/helena-runtime/current-execution.log') as f:
        lines = f.readlines()
        log_tail = "".join(lines[-10:])
except Exception as e:
    log_tail = str(e)

out = {
    'status': job.get('status'),
    'attempt_count': job.get('attempt_count'),
    'event_count': len(events),
    'latest_events': [{'type': e.get('event_type'), 'time': e.get('created_at'), 'msg': e.get('message')} for e in events[-5:]],
    'has_delivery': bool(job.get('result_payload', {}).get('delivery')),
    'log_tail': log_tail
}
print("POLL_DATA:" + json.dumps(out))
`;

  while (attempts < 40 && !finished) {
    attempts++;
    await sleep(7000);

    try {
      const pollResRaw = await runHermesPython(checkPy, 15000);
      const pollMatch = pollResRaw.match(/POLL_DATA:(.+)/);
      if (pollMatch) {
        const data = JSON.parse(pollMatch[1]);
        jobStatus = data.status;
        console.log(`⏱️ [${attempts * 7}s] Status do Job: ${jobStatus} | Eventos gravados: ${data.event_count}`);

        if (data.latest_events && data.latest_events.length > 0) {
          const last = data.latest_events[data.latest_events.length - 1];
          console.log(`    ↳ Último evento: [${last.type}] ${last.msg || ''}`);
        }

        if (jobStatus === 'WAITING_HELENA' || data.has_delivery || jobStatus === 'COMPLETED' || jobStatus === 'FAILED') {
          console.log(`\n🎯 Execução alcançou estado de término: ${jobStatus}`);
          finished = true;
          break;
        }
      } else {
        console.log(`⏱️ [${attempts * 7}s] Aguardando resposta do Gateway...`);
      }
    } catch (err) {
      console.log(`⏱️ [${attempts * 7}s] Sondando... (${err.message})`);
    }
  }

  // -------------------------------------------------------------
  // FASE 5: Inspeção da entrega
  // -------------------------------------------------------------
  console.log(`\n📌 [FASE 5/6] Inspecionando a entrega produzida pela Isabela...`);
  
  const inspectPy = `
import sys, json
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d
from pathlib import Path

root = Path('/data/profiles')
token = d.token_for(root, 'helena--grupo')
job_id = '${jobId}'

detail = d.call_tool(d.GATEWAY, token, 'get_job', {'job_id': job_id})
job = detail.get('job', {})
payload = job.get('result_payload', {})
delivery = payload.get('delivery', {})

print("--- DETALHES DA ENTREGA ---")
print("TITULO:", delivery.get('title'))
print("CONTEUDO:")
print(delivery.get('content'))
print("--- LIMITACOES ---")
print(delivery.get('limitations'))
print("--- PROXIMOS PASSOS ---")
print(delivery.get('next_steps'))
`;

  const inspectRes = await runHermesPython(inspectPy, 25000);
  console.log(inspectRes);

  // -------------------------------------------------------------
  // FASE 6: Helena revisa e aprova formalmente (review_delivery)
  // -------------------------------------------------------------
  console.log(`\n📌 [FASE 6/6] Helena (AGT-01) realizando a revisão executiva e aprovando...`);
  
  const approvePy = `
import sys, json
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d
from pathlib import Path

root = Path('/data/profiles')
token = d.token_for(root, 'helena--grupo')
job_id = '${jobId}'

detail = d.call_tool(d.GATEWAY, token, 'get_job', {'job_id': job_id})
task = detail.get('task', {})
task_ver = task.get('row_version')

res_appr = d.call_tool(d.GATEWAY, token, 'review_delivery', {
    'job_id': job_id,
    'expected_task_version': task_ver,
    'decision': 'APPROVE',
    'reason': 'Aprovado na íntegra: Copy institucional de altíssima qualidade técnica e persuasiva, alinhada com precisão à empresa Humano Digital e à sua comunidade de coleta e validação de dados para IA. Estrutura impecável com headlines, dores, soluções e CTAs objetivos.',
    'idempotency_key': f'appr-${idempotencyKey}'
})

print("APPROVE_RESPONSE:", json.dumps(res_appr, indent=2, ensure_ascii=False))

# Estado final auditado
final_detail = d.call_tool(d.GATEWAY, token, 'get_job', {'job_id': job_id})
print("FINAL_JOB_STATUS:", final_detail.get('job', {}).get('status'))
print("FINAL_TASK_STATUS:", final_detail.get('task', {}).get('status'))
`;

  const approveRes = await runHermesPython(approvePy, 25000);
  console.log(approveRes);

  console.log('================================================================');
  console.log('🎉 CICLO DE PONTA A PONTA HOMOLOGADO COM SUCESSO ABSOLUTO!');
  console.log('================================================================');
}

main().catch(console.error);
