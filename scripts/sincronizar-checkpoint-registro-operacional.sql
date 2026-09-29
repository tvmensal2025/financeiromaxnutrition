-- Executar após 20260926170000_agent_progress_contract.sql.
-- Preserva versões anteriores e registra a regra comum e o RPC, sem declarar bots homologados.
begin isolation level repeatable read;
select set_config('request.jwt.claim.sub',
  (select user_id::text from public.app_access where role='founder' and active order by created_at limit 1), true);
set local role authenticated;
lock table public.checkpoint_mestre in share row exclusive mode;
do $sync$
declare
  v_anterior public.checkpoint_mestre%rowtype;
  v_snapshot jsonb;
  v_counts jsonb := '{}'::jsonb;
  v_total bigint;
  v_tabela record;
begin
  select * into strict v_anterior from public.checkpoint_mestre_atual;
  if v_anterior.snapshot->>'marcador_registro_operacional' = 'helena_motivo_por_marco_20260926' then return; end if;
  if not exists (select 1 from public.protocolo_agentes where protocolo_id='PAG-V9-019' and status='ATIVA')
     or to_regprocedure('public.gateway_record_agent_progress(text,text,text,text,text,text,jsonb,jsonb)') is null then
    raise exception 'Regra e RPC precisam estar disponíveis antes da sincronização';
  end if;

  for v_tabela in select jsonb_object_keys(v_anterior.snapshot->'contagens') as tabela loop
    execute format('select count(*) from public.%I', v_tabela.tabela) into v_total;
    v_counts := v_counts || jsonb_build_object(v_tabela.tabela, v_total);
  end loop;

  v_snapshot := v_anterior.snapshot || jsonb_build_object(
    'marcador_registro_operacional','helena_motivo_por_marco_20260926',
    'gerado_em',now(),
    'contagens',v_counts,
    'registro_operacional',jsonb_build_object(
      'protocolo','PAG-V9-019',
      'aplicacao','TODOS',
      'rpc','gateway_record_agent_progress',
      'marcos_com_motivo',(select count(*) from public.agent_job_events where event_type='PROGRESS' and nullif(payload->>'reason','') is not null),
      'jobs_sem_task_id',(select count(*) from public.agent_jobs where task_id is null),
      'gateway_remoto','NAO_HOMOLOGADO',
      'identidade_bot_por_agente','NAO_VINCULADA'
    ),
    'lacunas_operacionais',coalesce(v_anterior.snapshot->'lacunas_operacionais','{}'::jsonb) || jsonb_build_object(
      'gateway_remoto','NAO_HOMOLOGADO',
      'identidade_bot_por_agente','NAO_VINCULADA',
      'marcos_historicos','NAO_RECONSTRUIDOS'
    ),
    'pendencias',coalesce(v_anterior.snapshot->'pendencias','[]'::jsonb) || jsonb_build_array(
      'Publicar e homologar o Gateway atualizado antes de afirmar que bots registram marcos via record_progress.',
      'Vincular identidade autenticada de cada bot ao agent_id; o bearer atual não comprova essa relação.',
      'Os 27 jobs legados não têm task_id; não atribuir tarefa sem evidência de origem.'
    )
  );

  perform public.registrar_checkpoint_mestre(
    p_titulo => 'Checkpoint Mestre — registro operacional dos agentes',
    p_resumo_executivo => 'Regra PAG-V9-019 ativa para todos os agentes e RPC de marcos no Supabase, com ação, motivo e próximo passo. Gateway e bots externos ainda não homologados nesta versão; jobs legados permanecem sem task_id.',
    p_conteudo_markdown => $texto$# Continuidade do Sistema Helena

Fonte canônica: Supabase ecosistemadossonhos. Estado real do banco prevalece sobre este retrato.

## Mudança material
O Protocolo_Agentes agora define registro enxuto de marcos relevantes para todos os agentes. O RPC gateway_record_agent_progress valida job RUNNING e agente, grava ação, motivo de negócio, próximo passo, evidências disponíveis e contexto da empresa/tarefa; repetições da mesma step_key retornam o mesmo evento.

## Limites
O Gateway local foi alterado, mas sua publicação externa e o uso por cada Grok Bot não foram homologados. O token autentica o cliente, porém ainda não vincula de forma comprovada cada identidade externa a um agent_id. A regra não reconstrói eventos antigos. Os 27 jobs atuais continuam sem task_id. Não há supervisão contínua de IA nem cobertura operacional comprovada de todos os agentes.

## Continuidade
Homologar um fluxo real por agente e empresa, verificar eventos no Supabase, resolver identidade do executor e vincular novas execuções à tarefa canônica. Registrar só marcos relevantes para poupar cota do Grok.$texto$,
    p_snapshot => v_snapshot,
    p_mudancas_desde_anterior => jsonb_build_array(
      'Regra comum PAG-V9-019 acrescenta ação, motivo, próximo passo e evidência em marcos relevantes.',
      'RPC gateway_record_agent_progress grava eventos idempotentes e valida job RUNNING e agente.',
      'Sala de comando local mostra o motivo e o próximo passo quando houver PROGRESS.'
    ),
    p_fontes => coalesce(v_anterior.fontes,'[]'::jsonb) || jsonb_build_array(
      'public.protocolo_agentes:PAG-V9-019',
      'public.gateway_record_agent_progress',
      'supabase/migrations/20260926170000_agent_progress_contract.sql'
    ),
    p_criado_por => 'Codex — implementação autorizada pelo fundador',
    p_motivo => 'Pedido de regra explícita para registrar no Supabase o que cada agente faz e por quê, com baixo custo.'
  );
end;
$sync$;
select checkpoint_id,versao,status,checkpoint_anterior_id from public.checkpoint_mestre_atual;
commit;
