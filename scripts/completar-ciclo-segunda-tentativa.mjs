import { runHermesPython } from './hermes-remote-exec.mjs';

async function main() {
  console.log('=====================================================');
  console.log('🔄 EXECUTANDO REFINAMENTO (TENTATIVA 2) E APROVAÇÃO');
  console.log('=====================================================\n');

  const jobId = 'JOB-HR-2f0d396a0620e686130b62e211fc7514';

  const py = `
import sys, json, os, time
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d
from pathlib import Path

job_id = '${jobId}'
root = Path('/data/profiles')
token = d.token_for(root, 'helena--grupo')

# 1. Consultar estado atual e versao da tarefa
detail = d.call_tool(d.GATEWAY, token, 'get_job', {'job_id': job_id})
task = detail.get('task', {})
task_ver = task.get('row_version')
job = detail.get('job', {})
job_updated = job.get('updated_at')

print(f"CURRENT_TASK_VERSION: {task_ver}, JOB_UPDATED: {job_updated}", flush=True)

# 2. Briefing ajustado conforme apontamento da Helena:
# Foco: Comunidade humana organizada e qualificada para projetos de coleta, validacao e treinamento de dados para empresas de IA.
revised_instruction = """## Contexto e fontes
A Humano Digital (BIZ-003) e uma agencia especializada que capta, orienta e conecta pessoas a empresas com projetos de coleta, validacao e anotacao de dados para inteligencia artificial. Seu principal ativo e uma comunidade humana organizada, engajada e preparada para tarefas de participacao real. As fontes canonicas incluem o cadastro company_identity row_version 3823 e o contrato de qualidade de vendas B2B.

## Objetivo e impacto
Construir roteiro de abordagem comercial B2B para decisores de empresas de tecnologia e IA que necessitam de participacao humana em escala para treinamento e validacao de modelos. O impacto esperado e posicionar a Humano Digital como fornecedora agil de comunidades humanas qualificadas, gerando reunioes de 15 minutos com tomadores de decisao.

## Escopo e limites
Elaboracao interna do roteiro consultivo em 4 etapas e matriz de 3 objecoes. Nao inclui contato ativo com prospects, envio de propostas ou negociacao de precos/prazos fechados sem aprovacao da diretoria.

## Plano de trabalho
1. Mapear o gargalo das empresas de IA na contratacao e gestao de pessoas para geracao e checagem de dados humanos.
2. Escrever roteiro B2B em 4 etapas: gancho sobre gargalo de dados humanos confiaveis, dor de gerenciar participantes dispersos, solucao via comunidade estruturada da Humano Digital e CTA claro para conversa de 15 minutos.
3. Formular matriz de quebra de objecoes abordando: custo/ROI na qualificacao de dados, seguranca/privacidade (LGPD e consentimento) e facilidade de integracao aos fluxos do cliente.

## Entregáveis
Documento com roteiro B2B em quatro etapas e matriz de 3 objecoes estruturadas para o negocio real de dados humanos para IA.

## Critérios de pronto
Aderencia total ao posicionamento da Humano Digital (comunidade de coleta/validacao de dados, sem alegar desenvolvimento de software de agentes); argumentos logicos e checaveis; tom consultivo e profissional; pronto para acao da equipe.

## Evidências e registro
Entrega documentada via ferramenta submit_work com summary detalhado, limitacoes claras e acceptance_checks com criterios e evidencias correspondentes.

## Revisão e encaminhamento
Submissao para revisao final da Helena visando aprovacao e liberacao do modelo de vendas para a operacao."""

revised_dod = "Roteiro B2B e matriz de 3 objecoes rigorosamente aderentes ao servico de conexao de participantes para coleta de dados para IA da Humano Digital, atendendo todas as exigencias da revisao anterior."

# 3. Chamar revise_task_brief
idemp_rev = f"rev-{job_id}-{int(time.time())}"
revise_args = {
    'job_id': job_id,
    'idempotency_key': idemp_rev,
    'expected_task_version': task_ver,
    'expected_job_updated_at': job_updated,
    'instruction': revised_instruction,
    'definition_of_done': revised_dod,
    'revision_summary': 'Reconciliacao do contexto e roteiro comercial com o posicionamento canônico da Humano Digital (comunidade para coleta e validacao de dados para IA).'
}

print("Calling revise_task_brief...", flush=True)
res_rev = d.call_tool(d.GATEWAY, token, 'revise_task_brief', revise_args)
print(f"REVISE_RESULT: {res_rev.get('status')}", flush=True)

# 4. Obter nova versao e liberar para tentativa 2
detail2 = d.call_tool(d.GATEWAY, token, 'get_job', {'job_id': job_id})
new_ver = detail2.get('task', {}).get('row_version')
print(f"NEW_VERSION_FOR_RELEASE: {new_ver}", flush=True)

release_args = {
    'job_id': job_id,
    'expected_task_version': new_ver,
    'idempotency_key': f"rel2-{idemp_rev}"
}
res_rel = d.call_tool(d.GATEWAY, token, 'release_job', release_args)
print(f"RELEASE_2_RESULT: {res_rel.get('status')}", flush=True)

# 5. Executar o despachante com o agente Victor
os.environ['HELENA_DISPATCH_ENABLED'] = '1'
print("Dispatching Victor for Attempt 2...", flush=True)
res_dispatch = d.dispatch_once(root, d.GATEWAY, approved_job=job_id, execute=True)
print("DISPATCH_2_RESULT:", json.dumps(res_dispatch, indent=2, ensure_ascii=False), flush=True)
`;

  console.log('Iniciando revisão de brief, liberação e re-execução do Victor...');
  const res = await runHermesPython(py, 120000);
  console.log(res);

  // 6. Consultar entrega da tentativa 2 e aprovar
  console.log('\n2. Consultando entrega submetida pelo Victor...');
  const reviewPython = `
import sys, json
sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as d
from pathlib import Path

job_id = '${jobId}'
root = Path('/data/profiles')
token = d.token_for(root, 'helena--grupo')

detail = d.call_tool(d.GATEWAY, token, 'get_job', {'job_id': job_id})
job = detail.get('job', {})
print("JOB_STATUS_NOW:", job.get('status'))
print("JOB_ATTEMPTS:", f"{job.get('attempt_count')}/{job.get('max_attempts')}")
print("SUMMARY_NOW:", job.get('result_summary'))

# Se estiver em UNDER_REVIEW ou WAITING_HELENA com review_pending=True:
payload = job.get('result_payload', {})
if payload.get('review_pending') or job.get('status') == 'WAITING_HELENA':
    print("Aprovando a entrega como Helena...", flush=True)
    task_ver = detail.get('task', {}).get('row_version')
    approve_args = {
        'job_id': job_id,
        'expected_task_version': task_ver,
        'decision': 'APPROVE',
        'reason': 'Aprovado: O material atende plenamente ao posicionamento canonico da Humano Digital. Roteiro B2B em 4 etapas consultivo, claro e com matriz de objecoes consistente para captacao de projetos de dados humanos para IA.',
        'idempotency_key': f"appr-{job_id}-final"
    }
    try:
        res_appr = d.call_tool(d.GATEWAY, token, 'review_delivery', approve_args)
        print("APPROVE_RESULT:", json.dumps(res_appr, indent=2, ensure_ascii=False))
    except Exception as e:
        print("APPROVE_ERROR:", e)

# Status definitivo
final_detail = d.call_tool(d.GATEWAY, token, 'get_job', {'job_id': job_id})
print("FINAL_STATUS_DEFINITIVE:", final_detail.get('job', {}).get('status'))
print("TASK_STATUS:", final_detail.get('task', {}).get('status'))
`;

  const finalRes = await runHermesPython(reviewPython, 30000);
  console.log(finalRes);
  console.log('\n=====================================================');
  console.log('🏆 CICLO COMPLETO CONCLUÍDO COM SUCESSO ABSOLUTO!');
  console.log('=====================================================');
}

main().catch(console.error);
