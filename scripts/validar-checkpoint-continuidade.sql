-- Somente leitura; falha se o retrato não reproduzir as fontes verificadas.
begin isolation level repeatable read;
do $validation$
declare
  snap jsonb; v_checkpoint public.checkpoint_mestre%rowtype;
  v_count record; atual jsonb; n bigint; divergencias jsonb:='[]'::jsonb;
  fontes jsonb; campos bigint; mapeados bigint;
begin
  select * into strict v_checkpoint from public.checkpoint_mestre_atual;
  snap:=v_checkpoint.snapshot;
  if (select count(*) from public.checkpoint_mestre where status='ATIVO')<>1
    or v_checkpoint.versao<>(select max(versao) from public.checkpoint_mestre) then
    raise exception 'Checkpoint ativo inválido';
  end if;
  if exists(select 1 from (
    select versao,checkpoint_anterior_id,lag(checkpoint_id) over(order by versao) anterior,lag(versao) over(order by versao) versao_anterior
    from public.checkpoint_mestre
  ) c where (versao>1 and (checkpoint_anterior_id is distinct from anterior or versao<>versao_anterior+1))) then
    raise exception 'Histórico de versões descontínuo';
  end if;
  for v_count in select key,value from jsonb_each(snap->'contagens') loop
    execute format('select count(*) from public.%I',v_count.key) into n;
    if v_count.value is distinct from to_jsonb(n) then divergencias:=divergencias||jsonb_build_array('contagem:'||v_count.key); end if;
  end loop;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.agent_id),'[]'::jsonb) into atual from (select agent_id,agente,cargo_funcao,missao,quando_ativar,ler_antes_de_responder,pode_atualizar,saida_obrigatoria,escalar_para,prompt_base,status,versao_prompt,estado_execucao,atualizado_em from public.agentes)x;
  if snap->'agentes' is distinct from atual then divergencias:=divergencias||jsonb_build_array('projecao:agentes'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.task_id),'[]'::jsonb) into atual from (select task_id,tarefa,business_id,project_id,responsavel,status,prioridade,prazo,definicao_de_pronto,bloqueio,atualizado_em from public.tarefas)x;
  if snap->'tarefas' is distinct from atual then divergencias:=divergencias||jsonb_build_array('projecao:tarefas'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.project_id),'[]'::jsonb) into atual from (select project_id,projeto,business_id,objetivo,status,responsavel,criterio_de_conclusao from public.projetos)x;
  if snap->'projetos' is distinct from atual then divergencias:=divergencias||jsonb_build_array('projecao:projetos'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.business_id),'[]'::jsonb) into atual from (select business_id,negocio,ativo,estagio,objetivo_atual,principal_gargalo,kpi_principal,responsavel_executivo,proxima_entrega,riscos,atualizado_em from public.portfolio)x;
  if snap->'portfolio' is distinct from atual then divergencias:=divergencias||jsonb_build_array('projecao:portfolio'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.decision_id),'[]'::jsonb) into atual from (select decision_id,business_id,tipo,decisao,motivo,decisor,status,substitui_decision_id,atualizado_em from public.decisoes)x;
  if snap->'decisoes_vigentes' is distinct from atual then divergencias:=divergencias||jsonb_build_array('projecao:decisoes_vigentes'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.registro_id),'[]'::jsonb) into atual from (select registro_id,area,item,estado_atual,proxima_acao,fonte,confirmacao,responsavel,related_id,atualizado_em from public.estado_mestre)x;
  if snap->'estado_mestre' is distinct from atual then divergencias:=divergencias||jsonb_build_array('projecao:estado_mestre'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into atual from (select id,tipo,business_id_area,agente_origem,assunto,status,related_object_id,proxima_acao,atualizado_em from public.memoria_mestre)x;
  if snap->'memorias_recentes' is distinct from atual then divergencias:=divergencias||jsonb_build_array('projecao:memorias_recentes'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into atual from (select id,de,para,business_id_area,assunto,status,prioridade,prazo,atualizado_em from public.handoffs)x;
  if snap->'handoffs' is distinct from atual then divergencias:=divergencias||jsonb_build_array('projecao:handoffs'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into atual from (select id,frente,status,responsavel,criterio_de_saida,atualizado_em from public.foco_executivo)x;
  if snap->'foco_executivo' is distinct from atual then divergencias:=divergencias||jsonb_build_array('projecao:foco_executivo'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.agent_id),'[]'::jsonb) into atual from (select agent_id,provider,connection_status,last_seen_at,last_tested_at,updated_at from public.agent_connections)x;
  if snap->'conexoes_agentes' is distinct from atual then divergencias:=divergencias||jsonb_build_array('projecao:conexoes_agentes'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.job_id),'[]'::jsonb) into atual from (select job_id,task_id,agent_id,business_id,status,attempt_count,max_attempts,approval_status,updated_at from public.agent_jobs)x;
  if snap->'agent_jobs' is distinct from atual then divergencias:=divergencias||jsonb_build_array('projecao:agent_jobs'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.event_id),'[]'::jsonb) into atual from (select event_id,job_id,agent_id,business_id,event_type,status,created_at from public.agent_job_events)x;
  if snap->'agent_job_events' is distinct from atual then divergencias:=divergencias||jsonb_build_array('projecao:agent_job_events'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.integration_id),'[]'::jsonb) into atual from (select integration_id,sistema,objeto,direcao,business_id,dono,status,ultima_sync,source_system,frequencia,observacoes,atualizado_em from public.integracoes)x;
  if snap->'integracoes' is distinct from atual then divergencias:=divergencias||jsonb_build_array('projecao:integracoes'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.automation_id),'[]'::jsonb) into atual from (select automation_id,nome,business_id,status,responsavel,gatilho,condicao,acao,frequencia,external_automation_id,integration_id,ultima_execucao,proxima_execucao,observacoes,atualizado_em from public.automacoes)x;
  if snap->'automacoes' is distinct from atual then divergencias:=divergencias||jsonb_build_array('projecao:automacoes'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.recurrence_id),'[]'::jsonb) into atual from (select recurrence_id,nome,business_id,status,responsavel,frequencia,regra_rrule,timezone,automation_id,integration_id,external_id,gerar_automaticamente,horario_confirmado,proxima_ocorrencia,observacoes,atualizado_em from public.recorrencias)x;
  if snap->'recorrencias' is distinct from atual then divergencias:=divergencias||jsonb_build_array('projecao:recorrencias'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.risk_id),'[]'::jsonb) into atual from (select risk_id,business_id,project_id,categoria,risco,probabilidade,impacto,status,responsavel,prevencao_mitigacao,atualizado_em from public.riscos)x;
  if snap->'riscos' is distinct from atual then divergencias:=divergencias||jsonb_build_array('projecao:riscos'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.milestone_id),'[]'::jsonb) into atual from (select milestone_id,project_id,business_id,status,responsavel from public.marcos)x;
  if snap->'marcos' is distinct from atual then divergencias:=divergencias||jsonb_build_array('projecao:marcos'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.event_id),'[]'::jsonb) into atual from (select event_id,task_id,business_id,event_type,changed_fields,status_before,status_after,actor_role,occurred_at from public.task_activity)x;
  if snap->'task_activity' is distinct from atual then divergencias:=divergencias||jsonb_build_array('projecao:task_activity'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.protocolo_id),'[]'::jsonb) into atual from (select protocolo_id,versao,secao,regra,aplicacao,responsavel,status,atualizado_em from public.protocolo_agentes)x;
  if snap->'protocolo_agentes' is distinct from atual then divergencias:=divergencias||jsonb_build_array('projecao:protocolo_agentes'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.governance_id),'[]'::jsonb) into atual from (select governance_id,ritual,escopo,cadencia,dono,pauta_fixa,entrega_esperada,dia_hora,recurrence_id,status,observacoes,atualizado_em from public.governanca)x;
  if snap->'governanca' is distinct from atual then divergencias:=divergencias||jsonb_build_array('projecao:governanca'); end if;
  select jsonb_agg('public.'||c.relname order by c.relname) into fontes
    from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='public' and c.relkind in('r','p','v','m');
  if snap->'fontes' is distinct from fontes then divergencias:=divergencias||jsonb_build_array('fontes'); end if;
  select count(*) into campos from information_schema.columns where table_schema='public';
  select count(*) into mapeados from information_schema.columns c
    where c.table_schema='public' and exists(select 1 from public.helena_campos h where h.tabela=c.table_name and h.coluna=c.column_name);
  if campos<>mapeados or exists(select 1 from public.helena_campos h where not exists(
    select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=h.tabela and c.column_name=h.coluna))
    or exists(select 1 from public.helena_campos group by tabela,coluna having count(*)>1) then
    raise exception 'Mapeamento incompleto, obsoleto ou duplicado';
  end if;
  if (snap->'mapeamento_supabase'->>'campos')::bigint is distinct from campos
    or (snap->'mapeamento_supabase'->>'campos_mapeados')::bigint is distinct from mapeados then
    divergencias:=divergencias||jsonb_build_array('mapeamento_snapshot');
  end if;
  if cardinality(public.helena_concurrency_tables())<>54 or exists(
    select 1 from unnest(public.helena_concurrency_tables()) t(nome)
    where not exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=t.nome and c.column_name='row_version')
      or not exists(select 1 from pg_trigger g where g.tgrelid=to_regclass('public.'||t.nome) and g.tgname='zz_helena_version_guard' and g.tgenabled='O')
  ) then raise exception 'Contrato de concorrência incompleto'; end if;
  if not exists(select 1 from public.protocolo_agentes where protocolo_id='PAG-V9-020' and status='ATIVA')
    or snap->'controle_concorrencia' is distinct from (select registro::jsonb from public.memoria_mestre where id='MEM-CONCORRENCIA-20260926')
    or snap->'supervisao_em_lote' is distinct from (select registro::jsonb from public.memoria_mestre where id='MEM-SUPERVISAO-CHAT-20260926') then
    divergencias:=divergencias||jsonb_build_array('regras_e_memoria_concorrencia');
  end if;
  if snap->'planejamento' is distinct from (select registro::jsonb->'planejamento' from public.memoria_mestre where id='MEM-PLANO-20260926') then
    divergencias:=divergencias||jsonb_build_array('planejamento');
  end if;
  if not exists(select 1 from public.recorrencias r join public.automacoes a on a.automation_id=r.automation_id
    join public.integracoes i on i.integration_id=a.integration_id where r.recurrence_id='REC-0001'
      and a.automation_id='AUTO-0006' and i.integration_id='INT-0011'
      and r.external_id=a.external_automation_id and r.gerar_automaticamente='NÃO') then
    raise exception 'Agenda inconsistente ou com risco de duplicação';
  end if;
  if (select count(*) from public.foco_executivo where status='EM EXECUÇÃO')<>1 then raise exception 'WIP inválido'; end if;
  if exists(select 1 from public.estado_mestre where registro_id in(2,13) and related_id is distinct from 'FOC-004') then raise exception 'Referência de foco inconsistente'; end if;
  if jsonb_array_length(divergencias)>0 then raise exception 'Divergências: %',divergencias; end if;
  perform set_config('helena.validacao',jsonb_build_object(
    'checkpoint',v_checkpoint.checkpoint_id,'versao',v_checkpoint.versao,'status','CARREGADO E VALIDADO',
    'escopo','Contagens, 20 projeções, fontes, planejamento, agenda, cadeia de versões e foco. Não homologa execução externa.',
    'divergencias',divergencias,'fontes',jsonb_array_length(fontes),
    'tabelas_contadas',(select count(*) from jsonb_object_keys(snap->'contagens')),'campos',campos,'campos_mapeados',mapeados,
    'tarefas',snap->'contagens'->'tarefas','integracoes',snap->'contagens'->'integracoes',
    'automacoes',snap->'contagens'->'automacoes','jobs_sem_task_id',snap->'lacunas_operacionais'->'jobs_sem_task_id',
    'verificado_em',now()
  )::text,true);
end;
$validation$;
select current_setting('helena.validacao')::jsonb as validacao;
rollback;
