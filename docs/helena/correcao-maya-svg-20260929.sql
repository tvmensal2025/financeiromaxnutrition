-- Correcao pontual autorizada pelo fundador. Nao libera nem inicia IA.
-- A transacao preserva o briefing anterior e usa a resolucao oficial do bloqueio.
begin;
do $fix$
declare
  j public.agent_jobs;
  t public.tarefas;
  revised text;
  old_plan text;
  new_plan text := $plan$## Plano de trabalho
1. Ler get_job e conferir empresa BIZ-003, executor Maya AGT-12, estado RUNNING e row_version atual. Antes de criar, verificar artifact_records: reutilizar slots ja verificados; nao sobrescrever nem repetir upload de slot concluido.
2. Criar arte vetorial original para cada slot em SVG inline: post com width="1080" height="1350" e stories com width="1080" height="1920", viewBox correspondente. Usar texto legivel, hierarquia, contraste, margens e formas vetoriais consistentes. Limite de 35000 caracteres e 35 KB por SVG. Nao usar scripts, imagens/fontes externas, URLs, foreignObject ou recursos ativos.
3. Executar UMA chamada por vez de create_artifact_upload com job_id deste job, slot (post, story-1, story-2 ou story-3), version=1 para slot ainda ausente e svg com o documento completo. Aguardar a resposta antes do proximo slot. Nao agrupar quatro chamadas em uma invocacao. O Gateway converte o SVG em PNG, envia ao bucket privado e verifica os bytes. Nao solicitar URL temporaria, nao enviar PNG manualmente e nao usar terminal ou outro modelo.
4. Conferir em cada retorno verified=true, reference storage://, slot e dimensoes corretas. Se faltar confirmacao, consultar get_job antes de repetir; verify_artifact_upload pode verificar um slot existente. Em erro ou conflito, registrar bloqueio concreto, sem presumir sucesso ou consumir tentativas em loop.
5. Apos os quatro slots verificados, registrar memoria propria com fontes e decisoes de design. Reler get_job para obter row_version atual e submeter uma unica entrega com as quatro referencias storage:// reais, referencia da memoria e resumo. Aguardar Nina AGT-10 revisar; nao autoaprovar ou publicar.

$plan$;
begin
  select * into j from public.agent_jobs where job_id='JOB-HR-49eff2ead7674d06b4b59bc796f08873' for update;
  select * into t from public.tarefas where task_id=j.task_id for update;
  if exists(select 1 from public.agent_job_events where job_id=j.job_id and event_type='ADMIN_BRIEF_CORRECTION' and payload->>'correction_key'='maya-svg-unitary-20260929') then
    return;
  end if;
  if j.job_id is null or t.task_id is null or j.business_id is distinct from 'BIZ-003'
    or t.business_id is distinct from j.business_id or j.agent_id is distinct from 'AGT-12'
    or j.status is distinct from 'WAITING_HELENA' or t.status is distinct from 'BLOQUEADA'
    or t.row_version is distinct from 2709::bigint
    or j.updated_at is distinct from '2026-09-29T15:17:02.10943+00:00'::timestamptz
    or j.attempt_count is distinct from 1 or j.max_attempts is distinct from 2
    or coalesce(j.result_payload->>'review_pending','false') <> 'false'
    or coalesce(j.evidence_refs::text,'[]') <> '[]' then
    raise exception 'Estado divergiu; nenhuma correcao aplicada';
  end if;
  old_plan := substring(j.instruction from '(?s)## Plano de trabalho.*?## Entregáveis');
  if old_plan is null or position('URL temporária' in old_plan)=0 then
    raise exception 'Trecho antigo nao confere';
  end if;
  revised := replace(j.instruction, old_plan, new_plan || '## Entregáveis');
  perform public.helena_validate_professional_brief(revised);
  update public.agent_jobs set instruction=revised, updated_at=clock_timestamp() where job_id=j.job_id;
  insert into public.agent_job_events(job_id,agent_id,business_id,event_type,status,message,payload,correlation_id)
  values(j.job_id,'AGT-01',j.business_id,'ADMIN_BRIEF_CORRECTION',j.status,
    'Correcao operacional autorizada pelo fundador: SVG inline, chamadas unitarias e PNG verificado pelo Gateway. Sem revisao ficticia de entrega.',
    jsonb_build_object('correction_key','maya-svg-unitary-20260929','source','Codex: pedido explicito corrija',
      'previous_instruction',j.instruction,'instruction',revised,'previous_task_version',t.row_version,
      'previous_job_updated_at',j.updated_at,'attempt_count',j.attempt_count,'max_attempts',j.max_attempts),j.correlation_id);
  perform public.gateway_resolve_job_block('helena--grupo',jsonb_build_object(
    'job_id',j.job_id,'expected_task_version',t.row_version,'idempotency_key','maya-svg-unitary-resolve-20260929',
    'reason','Briefing corrigido para SVG inline e chamadas unitarias. Gateway gera, armazena e verifica PNG. Preservadas tentativa 1/2 e revisao Nina. Aguardar validacao e liberacao do briefing atual pelo Gateway; nao reutilizar parecer TypeSafe antigo.'));
end;
$fix$;
commit;
select j.job_id,j.status,j.approval_status,j.attempt_count,j.max_attempts,t.row_version,
  position('UMA chamada por vez' in j.instruction)>0 as protocolo_corrigido,
  position('URL temporária' in j.instruction)=0 as instrucao_antiga_removida
from public.agent_jobs j join public.tarefas t on t.task_id=j.task_id
where j.job_id='JOB-HR-49eff2ead7674d06b4b59bc796f08873';
