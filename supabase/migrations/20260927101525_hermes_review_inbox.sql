create or replace function public.gateway_workflow(p_profile_slug text, p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  b public.agent_runtime_bindings;
  target public.agent_runtime_bindings;
  j public.agent_jobs;
  t public.tarefas;
  h public.handoffs;
  old_event public.agent_job_events;
  result jsonb;
  company text;
  key text;
  request jsonb;
  suffix text;
  new_job text;
  new_task text;
  new_handoff text;
  reviewer text;
  agent_name text;
  target_name text;
  root_id text;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>65536 then
    raise exception 'Payload invalido ou maior que 64KB' using errcode='22023';
  end if;
  select * into b from public.agent_runtime_bindings where profile_slug=p_profile_slug for share;
  if not found or b.provider<>'HERMES' or b.status<>'ACTIVE' then
    raise exception 'Perfil Hermes nao ativo' using errcode='42501';
  end if;
  select agente into agent_name from public.agentes where agent_id=b.agent_id;
  if p_action='context' then
    return jsonb_build_object('profile',to_jsonb(b),'role',(select to_jsonb(a) from public.agentes a where a.agent_id=b.agent_id),
      'checkpoint',(select jsonb_build_object('checkpoint_id',c.checkpoint_id,'resumo_executivo',c.resumo_executivo) from public.checkpoint_mestre_atual c limit 1),
      'tasks',coalesce((select jsonb_agg(x) from (select task_id,business_id,tarefa,responsavel,status,bloqueio,definicao_de_pronto,row_version from public.tarefas
        where (b.scope_type='GROUP' and b.agent_id='AGT-01' or b.scope_type='BUSINESS' and business_id=b.business_id)
          and (b.agent_id in ('AGT-01','AGT-04') or responsavel=agent_name)
        order by atualizado_em desc limit 30)x),'[]'::jsonb),
      'handoffs',coalesce((select jsonb_agg(x) from (select id,de,para,business_id_area,assunto,status,related_object_id,row_version from public.handoffs
        where (b.scope_type='GROUP' and b.agent_id='AGT-01' and scope_type<>'PERSONAL' or b.scope_type='BUSINESS' and business_id_area=b.business_id)
          and (b.agent_id in ('AGT-01','AGT-04') or para=agent_name or de=agent_name)
        order by criado_em desc limit 30)x),'[]'::jsonb),
      'pending_reviews',coalesce((select jsonb_agg(x) from (
        select job_id,task_id,agent_id,business_id,result_summary,evidence_refs,result_payload->>'reviewer_agent_id' as reviewer_agent_id
        from public.agent_jobs where status='WAITING_HELENA' and result_payload->>'review_pending'='true'
        and (b.scope_type='GROUP' and b.agent_id='AGT-01' or b.scope_type='BUSINESS' and business_id=b.business_id)
        and (b.agent_id='AGT-01' or result_payload->>'reviewer_agent_id'=b.agent_id)
        order by updated_at limit 30)x),'[]'::jsonb),
      'rules',jsonb_build_array('Ler a versao antes de alterar; conflito exige releitura e comparacao.',
        'Registrar acao, motivo, evidencia e proximo responsavel somente em marcos relevantes.',
        'Entrega aguarda revisao; handoff cria tarefa em DRAFT e nao inicia outro modelo.',
        'WIP global 1; ate 2 tentativas por job; sem loops, gastos ou mensagens externas automaticos.',
        'Dados pessoais de Laura ficam fora da fila empresarial.'));
  end if;
  if b.scope_type='PERSONAL' or (b.scope_type='GROUP' and b.agent_id<>'AGT-01') then
    raise exception 'Perfil fora do fluxo empresarial' using errcode='42501';
  end if;
  if p_action not in ('create_task','submit_delivery','review_delivery','handoff','release_job','record_memory') then
    raise exception 'Acao desconhecida' using errcode='22023';
  end if;
  key:=nullif(btrim(p_payload->>'idempotency_key'),'');
  if key is null or length(key)>120 then raise exception 'Chave estavel obrigatoria (ate 120 caracteres)' using errcode='22023'; end if;
  request:=jsonb_build_object('profile',p_profile_slug,'action',p_action,'payload',p_payload);
  -- Serializes identical requests, including first-time task creation.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_profile_slug||':'||key,0));
  if p_action='create_task' then
    if b.agent_id not in ('AGT-01','AGT-04') then raise exception 'Somente Helena ou Marina cria fila' using errcode='42501'; end if;
    company:=nullif(p_payload->>'business_id','');
    new_job:='JOB-HR-'||md5(p_profile_slug||':'||key);
    select * into old_event from public.agent_job_events where job_id=new_job and payload->>'workflow_key'=key and event_type like 'WORKFLOW_%';
  else
    select * into j from public.agent_jobs where job_id=p_payload->>'job_id' for update;
    if not found or j.business_id is null or j.task_id is null then raise exception 'Job exige tarefa e empresa' using errcode='22023'; end if;
    company:=j.business_id;
    select * into old_event from public.agent_job_events where job_id=j.job_id and payload->>'workflow_key'=key and event_type like 'WORKFLOW_%';
  end if;
  if company is null or (b.scope_type='BUSINESS' and company is distinct from b.business_id) then
    raise exception 'Empresa fora do escopo' using errcode='42501';
  end if;
  if old_event.event_id is not null then
    if old_event.payload->'request' is distinct from request then raise exception 'Chave reutilizada com conteudo diferente' using errcode='22023'; end if;
    return old_event.payload->'response';
  end if;
  if p_action<>'create_task' then
    select * into t from public.tarefas where task_id=j.task_id for update;
    if not found or t.business_id is distinct from company then raise exception 'Tarefa e empresa divergentes' using errcode='22023'; end if;
    if p_action in ('submit_delivery','handoff','record_memory') and j.agent_id<>b.agent_id then
      raise exception 'Job pertence a outro agente' using errcode='42501';
    end if;
    if p_action<>'record_memory' and (p_payload->>'expected_task_version')::bigint is distinct from t.row_version then
      raise exception 'CONFLITO_DE_VERSAO: releia e compare antes de gravar' using errcode='40001';
    end if;
  end if;
  if p_action in ('create_task','handoff') then
    if nullif(btrim(p_payload->>'objective'),'') is null or nullif(btrim(p_payload->>'definition_of_done'),'') is null then
      raise exception 'Objetivo e definicao de pronto obrigatorios' using errcode='22023';
    end if;
    select * into target from public.agent_runtime_bindings where agent_id=p_payload->>'target_agent_id'
      and (scope_type='BUSINESS' and business_id=company or scope_type='GROUP' and agent_id='AGT-01') and status in ('CONFIGURED','ACTIVE') for share;
    if not found then raise exception 'Destino sem vinculo Hermes nesta empresa' using errcode='42501'; end if;
    if p_action='handoff' then
      if j.status<>'COMPLETED' or not exists(select 1 from public.agent_job_events where job_id=j.job_id and event_type='WORKFLOW_review_delivery' and payload->'request'->'payload'->>'decision'='APPROVE') then
        raise exception 'Entrega precisa de revisao aprovada antes do handoff' using errcode='22023';
      end if;
      if target.agent_id=j.agent_id then raise exception 'Handoff para si mesmo nao permitido' using errcode='22023'; end if;
      if exists(select 1 from public.agent_job_events where job_id=j.job_id and event_type='WORKFLOW_handoff') then
        raise exception 'Esta entrega ja tem proximo responsavel; consulte o handoff existente' using errcode='22023';
      end if;
      root_id:=coalesce(j.correlation_id,j.job_id);
      if (select count(*) from public.agent_jobs where correlation_id=root_id)>=10 then
        raise exception 'Limite de 10 etapas atingido; Helena precisa replanejar' using errcode='22023';
      end if;
    end if;
    suffix:=md5(p_profile_slug||':'||key);
    new_job:='JOB-HR-'||suffix; new_task:='TSK-HR-'||suffix; new_handoff:='HND-HR-'||suffix;
    select agente into target_name from public.agentes where agent_id=target.agent_id;
    insert into public.tarefas(task_id,business_id,tarefa,tipo,responsavel,prioridade,status,definicao_de_pronto,source_system,related_object_type,related_object_id,idempotency_key)
      values(new_task,company,p_payload->>'objective','OPERACIONAL',target_name,'MEDIA','NÃO INICIADA',p_payload->>'definition_of_done','HERMES','agent_jobs',new_job,'hermes:'||suffix);
    insert into public.agent_jobs(job_id,task_id,agent_id,business_id,objective,instruction,priority,status,approval_required,approval_status,max_attempts,idempotency_key,correlation_id)
      values(new_job,new_task,target.agent_id,company,p_payload->>'objective',concat_ws(E'\n',p_payload->>'instruction',case when p_action='handoff' then 'Fonte: '||j.job_id||E'\nEntrega revisada: '||j.result_summary||E'\nEvidencias: '||j.evidence_refs::text end),'MEDIA','DRAFT',true,'PENDING',2,'hermes:'||suffix,coalesce(root_id,new_job));
    insert into public.handoffs(id,data_hora,de,para,business_id_area,assunto,contexto_essencial,pergunta_tarefa_transferida,pendencias,prioridade,status,related_object_id,scope_type)
      values(new_handoff,clock_timestamp()::text,agent_name,target_name,company,p_payload->>'objective',coalesce(j.result_summary,p_payload->>'instruction'),p_payload->>'definition_of_done','Aguardando liberacao da coordenacao','MEDIA','ABERTO',new_job,'BUSINESS');
    result:=jsonb_build_object('success',true,'job_id',new_job,'task_id',new_task,'handoff_id',new_handoff,'status','DRAFT','started',false);
  elsif p_action='submit_delivery' then
    if j.status<>'RUNNING' then raise exception 'Somente job em execucao pode entregar' using errcode='22023'; end if;
    if nullif(btrim(p_payload->>'summary'),'') is null or jsonb_typeof(p_payload->'evidence_refs') is distinct from 'array' then raise exception 'Resumo e evidencias obrigatorios' using errcode='22023'; end if;
    if jsonb_array_length(p_payload->'evidence_refs')<1 or jsonb_array_length(p_payload->'evidence_refs')>10 or exists(select 1 from jsonb_array_elements(p_payload->'evidence_refs') e where jsonb_typeof(e)<>'string' or length(btrim(e#>>'{}'))=0) then
      raise exception 'Exige 1 a 10 referencias nao vazias' using errcode='22023';
    end if;
    if j.agent_id='AGT-01' then reviewer:='FOUNDER';
    else reviewer:=case j.agent_id when 'AGT-09' then 'AGT-13' when 'AGT-11' then 'AGT-03' when 'AGT-12' then 'AGT-10' when 'AGT-14' then 'AGT-04' when 'AGT-16' then 'AGT-03' when 'AGT-17' then 'AGT-16' when 'AGT-18' then 'AGT-06' when 'AGT-20' then 'AGT-19' when 'AGT-21' then 'AGT-14' else 'AGT-01' end; end if;
    update public.agent_jobs set status='WAITING_HELENA',result_summary=p_payload->>'summary',evidence_refs=p_payload->'evidence_refs',updated_at=clock_timestamp(),result_payload=coalesce(result_payload,'{}'::jsonb)||jsonb_build_object('reviewer_agent_id',reviewer,'review_pending',true) where job_id=j.job_id;
    perform public.helena_write_record('tarefas',t.task_id,t.row_version,jsonb_build_object('status','BLOQUEADA','bloqueio','Aguardando revisao de '||reviewer,'evidencia',p_payload->>'summary'||E'\n'||(p_payload->'evidence_refs')::text));
    select agente into target_name from public.agentes where agent_id=reviewer;
    insert into public.handoffs(id,data_hora,de,para,business_id_area,assunto,contexto_essencial,pergunta_tarefa_transferida,pendencias,prioridade,status,related_object_id,scope_type)
      values('HND-REVIEW-'||md5(p_profile_slug||':'||key),clock_timestamp()::text,agent_name,coalesce(target_name,'Fundador'),company,
      'Revisar: '||j.objective,p_payload->>'summary','Conferir evidencias e definicao de pronto. Aprovar ou pedir ajustes.','Aguardando revisao','MEDIA','ABERTO',j.job_id,'BUSINESS');
    result:=jsonb_build_object('success',true,'job_id',j.job_id,'status','WAITING_HELENA','reviewer_agent_id',reviewer,'completed',false);
  elsif p_action='review_delivery' then
    if j.agent_id=b.agent_id or (b.agent_id<>'AGT-01' and b.agent_id is distinct from j.result_payload->>'reviewer_agent_id') then raise exception 'Revisor nao autorizado ou autoaprovacao' using errcode='42501'; end if;
    if j.status<>'WAITING_HELENA' or j.result_payload->>'review_pending' is distinct from 'true' then raise exception 'Entrega nao esta aguardando revisao' using errcode='22023'; end if;
    if p_payload->>'decision' not in ('APPROVE','REQUEST_CHANGES') or p_payload->>'decision' is null or nullif(btrim(p_payload->>'reason'),'') is null then raise exception 'Decisao e motivo obrigatorios' using errcode='22023'; end if;
    update public.agent_jobs set status=case when p_payload->>'decision'='APPROVE' then 'COMPLETED' else 'DRAFT' end,
      completed_at=case when p_payload->>'decision'='APPROVE' then clock_timestamp() else null end,
      approval_status=case when p_payload->>'decision'='APPROVE' then 'APPROVED' else 'PENDING' end,
      result_payload=result_payload||jsonb_build_object('review_pending',false,'reviewed_by',b.agent_id,'review_reason',p_payload->>'reason'),updated_at=clock_timestamp() where job_id=j.job_id;
    perform public.helena_write_record('tarefas',t.task_id,t.row_version,jsonb_build_object('status',case when p_payload->>'decision'='APPROVE' then 'CONCLUÍDA' else 'BLOQUEADA' end,'bloqueio',case when p_payload->>'decision'='APPROVE' then null else 'Ajustes solicitados: '||(p_payload->>'reason') end));
    for h in select * from public.handoffs where related_object_id=j.job_id and status='ABERTO' for update loop
      perform public.helena_write_record('handoffs',h.id,h.row_version,jsonb_build_object('status',case when p_payload->>'decision'='APPROVE' then 'CONCLUÍDO' else 'ABERTO' end,'retorno_conclusao',p_payload->>'reason','pendencias',case when p_payload->>'decision'='APPROVE' then null else p_payload->>'reason' end));
    end loop;
    result:=jsonb_build_object('success',true,'job_id',j.job_id,'decision',p_payload->>'decision','completed',p_payload->>'decision'='APPROVE');
  elsif p_action='release_job' then
    if b.agent_id not in ('AGT-01','AGT-04') then raise exception 'Somente coordenacao libera' using errcode='42501'; end if;
    if j.status<>'DRAFT' or coalesce(j.attempt_count,0)>=least(coalesce(j.max_attempts,2),2) then raise exception 'Job fora do estado ou limite de tentativas' using errcode='22023'; end if;
    perform 1 from public.agent_runtime_bindings where agent_id=j.agent_id and status='ACTIVE' and provider='HERMES' and (business_id=company or scope_type='GROUP' and agent_id='AGT-01') for share;
    if not found then raise exception 'Executor ainda nao esta ativo' using errcode='42501'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hermes:global-wip',0));
    if exists(select 1 from public.agent_jobs where status in ('READY','CLAIMED','RUNNING')) then raise exception 'WIP 1: outra execucao ja esta liberada' using errcode='22023'; end if;
    update public.agent_jobs set status='READY',approval_status='APPROVED',available_at=clock_timestamp(),updated_at=clock_timestamp() where job_id=j.job_id;
    perform public.helena_write_record('tarefas',t.task_id,t.row_version,jsonb_build_object('status','NÃO INICIADA','bloqueio',null));
    result:=jsonb_build_object('success',true,'job_id',j.job_id,'status','READY','started',false);
  elsif p_action='record_memory' then
    if j.status not in ('RUNNING','WAITING_HELENA') or nullif(btrim(p_payload->>'summary'),'') is null or nullif(btrim(p_payload->>'source'),'') is null then raise exception 'Memoria exige job ativo, registro e fonte' using errcode='22023'; end if;
    suffix:=md5(p_profile_slug||':'||key);
    insert into public.memoria_mestre(id,data_hora,tipo,business_id_area,agente_origem,assunto,registro,evidencia_origem,status,confianca,related_object_type,related_object_id,proxima_acao,responsavel,scope_type)
      values('MEM-HR-'||suffix,clock_timestamp()::text,'REGISTRO OPERACIONAL',company,agent_name,j.objective,p_payload->>'summary',p_payload->>'source','ATIVO','RELATO DO AGENTE','agent_jobs',j.job_id,p_payload->>'next_step',agent_name,'BUSINESS');
    result:=jsonb_build_object('success',true,'memory_id','MEM-HR-'||suffix,'job_id',j.job_id);
  end if;
  insert into public.agent_job_events(job_id,agent_id,business_id,event_type,status,message,payload,correlation_id)
    values(coalesce(j.job_id,new_job),b.agent_id,company,'WORKFLOW_'||p_action,(select status from public.agent_jobs where job_id=coalesce(j.job_id,new_job)),
      'Hermes: '||p_action,jsonb_build_object('workflow_key',key,'request',request,'response',result,'profile_slug',p_profile_slug),coalesce(j.correlation_id,new_job));
  return result;
end;
$$;

revoke all on function public.gateway_workflow(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.gateway_workflow(text,text,jsonb) to service_role;
