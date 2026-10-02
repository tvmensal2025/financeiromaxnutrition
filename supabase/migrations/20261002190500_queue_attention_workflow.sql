-- Install/upgrade the deterministic queue, including stalled review and handoff.
-- A historical failed receipt is not a current incident after the snapshot moves.
create or replace function public.gateway_list_recovery_candidates(
 p_profile_slug text,p_limit integer default 25,p_after_job_id text default null,p_created_after timestamptz default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.agent_runtime_bindings; result jsonb;
begin
 select * into b from public.agent_runtime_bindings where profile_slug=p_profile_slug for share;
 if not found or b.status<>'ACTIVE' or b.provider<>'HERMES' or b.agent_id not in ('AGT-01','AGT-04')
 or not (b.scope_type='BUSINESS' or (b.scope_type='GROUP' and b.agent_id='AGT-01')) then
 raise exception 'Coordenacao ativa obrigatoria' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 25 then raise exception 'Limite invalido' using errcode='22023'; end if;
 select coalesce(jsonb_agg(x order by x.job_id),'[]'::jsonb) into result from (
 select j.job_id,j.task_id,j.agent_id,j.business_id,j.status,j.created_at,j.updated_at,j.attempt_count,j.max_attempts,j.error_code,
 case when exists(select 1 from public.agent_workflow_runs q where q.job_id=j.job_id
   and q.job_updated_at=j.updated_at and q.task_version=t.row_version
   and (q.status='NEEDS_ATTENTION' or (q.status='STARTED' and q.lease_until<clock_timestamp()))) then 'WORKFLOW_STALLED'
 when j.status='FAILED' then 'FAILURE' when j.status in ('CLAIMED','RUNNING') then 'STALE_EXECUTION'
 when j.result_payload->>'review_pending'='true' then 'PENDING_REVIEW' else 'MANAGER_DECISION' end as attention_kind
 from public.agent_jobs j join public.tarefas t on t.task_id=j.task_id and t.business_id=j.business_id
 where j.task_id is not null and j.business_id is not null
 and ((b.scope_type='GROUP' and b.agent_id='AGT-01') or j.business_id=b.business_id)
 and (p_after_job_id is null or j.job_id>p_after_job_id)
 and (p_created_after is null or j.created_at>=p_created_after)
 and (exists(select 1 from public.agent_workflow_runs q where q.job_id=j.job_id
   and q.job_updated_at=j.updated_at and q.task_version=t.row_version
   and (q.status='NEEDS_ATTENTION' or (q.status='STARTED' and q.lease_until<clock_timestamp())))
 or j.status in ('FAILED','WAITING_HELENA') or (j.status in ('CLAIMED','RUNNING')
 and j.updated_at<clock_timestamp()-interval '30 minutes')) order by j.job_id limit p_limit+1
 ) x;
 return jsonb_build_object('success',true,'candidates',(select coalesce(jsonb_agg(v order by ord),'[]'::jsonb)
 from jsonb_array_elements(result) with ordinality a(v,ord) where ord<=p_limit),
 'next_cursor',case when jsonb_array_length(result)>p_limit then result->(p_limit-1)->>'job_id' else null end);
end; $$;
revoke all on function public.gateway_list_recovery_candidates(text,integer,text,timestamptz) from public,anon,authenticated;
grant execute on function public.gateway_list_recovery_candidates(text,integer,text,timestamptz) to service_role;

create or replace function public.gateway_record_queue_attention(p_profile_slug text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.agent_runtime_bindings; j public.agent_jobs; e public.agent_job_events;
 k text; req jsonb; res jsonb; reason text;
begin
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>4096 then
 raise exception 'Payload invalido' using errcode='22023'; end if;
 select * into b from public.agent_runtime_bindings where profile_slug=p_profile_slug for share;
 if not found or b.status<>'ACTIVE' or b.provider<>'HERMES' or b.agent_id not in ('AGT-01','AGT-04')
 or not (b.scope_type='BUSINESS' or (b.scope_type='GROUP' and b.agent_id='AGT-01')) then
 raise exception 'Coordenacao ativa obrigatoria' using errcode='42501'; end if;
 k:=nullif(btrim(p_payload->>'idempotency_key'),'');
 if k is null or length(k)>120 then raise exception 'Chave obrigatoria' using errcode='22023'; end if;
 req:=jsonb_build_object('profile',p_profile_slug,'payload',p_payload);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_profile_slug||':'||k,0));
 select * into j from public.agent_jobs where job_id=p_payload->>'job_id' for update;
 if not found or j.task_id is null or j.business_id is null then raise exception 'Job exige tarefa e empresa' using errcode='22023'; end if;
 if b.scope_type='BUSINESS' and b.business_id is distinct from j.business_id then
 raise exception 'Empresa fora do escopo' using errcode='42501'; end if;
 select * into e from public.agent_job_events where job_id=j.job_id and event_type='QUEUE_ATTENTION'
 and payload->>'workflow_key'=k limit 1;
 if e.event_id is not null then
 if e.payload->'request' is distinct from req then raise exception 'Chave reutilizada com conteudo diferente' using errcode='22023'; end if;
 return e.payload->'response'; end if;
 if p_payload->>'expected_status' is distinct from j.status
 or (p_payload->>'expected_updated_at')::timestamptz is distinct from j.updated_at then
 raise exception 'SNAPSHOT_CHANGED' using errcode='40001'; end if;
 if exists(select 1 from public.agent_workflow_runs q join public.tarefas t on t.task_id=j.task_id
   where q.job_id=j.job_id and q.job_updated_at=j.updated_at and q.task_version=t.row_version
   and (q.status='NEEDS_ATTENTION' or (q.status='STARTED' and q.lease_until<clock_timestamp()))) then
 reason:='Revisao ou coordenacao interrompida: Helena e Theo conferem o recibo, a causa e os efeitos antes de retomar. Nao repetir IA nem alterar tentativas automaticamente.';
 elsif j.status='FAILED' then reason:='Falha tecnica: Theo diagnostica; Helena decide retomada apos prova. Resultado incerto nao autoriza repetir IA.';
 elsif j.status in ('CLAIMED','RUNNING') and j.updated_at<clock_timestamp()-interval '30 minutes' then
 reason:='Execucao antiga: Theo confirma processo e efeitos; Helena reconcilia antes de liberar WIP ou repetir.';
 elsif j.status='WAITING_HELENA' and coalesce(j.attempt_count,0)>=least(coalesce(j.max_attempts,2),2)
 and j.result_payload->>'review_pending' is distinct from 'true' then
 reason:='Limite de tentativas: Helena avalia causa; preservar tentativas e historico.';
 else raise exception 'Estado sem motivo para alerta tecnico' using errcode='22023'; end if;
 res:=jsonb_build_object('success',true,'job_id',j.job_id,'status',j.status,'recorded',true,'model_started',false,'jobs_changed',false);
 insert into public.agent_job_events(job_id,agent_id,business_id,event_type,status,message,payload,correlation_id)
 values(j.job_id,b.agent_id,j.business_id,'QUEUE_ATTENTION',j.status,reason,
 jsonb_build_object('workflow_key',k,'request',req,'response',res,'next_responsible','AGT-01','technical_responsible','AGT-09','automatic_retry',false),j.correlation_id);
 return res;
end; $$;
revoke all on function public.gateway_record_queue_attention(text,jsonb) from public,anon,authenticated;
grant execute on function public.gateway_record_queue_attention(text,jsonb) to service_role;
