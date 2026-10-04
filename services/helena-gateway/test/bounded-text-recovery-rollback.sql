begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
create temporary table recovery_test_results(label text) on commit drop;
-- Bounded text-only timeout recovery under the existing coordinator permission.
-- Preserves the original failure and remaining attempts; never executes a model.
create or replace function pg_temp.test_recovery(p_profile_slug text, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 b public.agent_runtime_bindings;
 j public.agent_jobs;
 t public.tarefas;
 e public.agent_job_events;
 k text; reason text; req jsonb; res jsonb; recovering boolean;
begin
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>16384 then raise exception 'Payload invalido' using errcode='22023'; end if;
 select * into b from public.agent_runtime_bindings where profile_slug=p_profile_slug for share;
 if not found or b.status<>'ACTIVE' or b.provider<>'HERMES' or b.agent_id not in ('AGT-01','AGT-04')
 or not (b.scope_type='BUSINESS' or (b.scope_type='GROUP' and b.agent_id='AGT-01')) then
 raise exception 'Somente Helena ou Marina ativa resolve bloqueios' using errcode='42501'; end if;
 k:=nullif(btrim(p_payload->>'idempotency_key'),''); reason:=nullif(btrim(p_payload->>'reason'),'');
 if k is null or length(k)>120 or reason is null or length(reason)>4000 then raise exception 'Chave e motivo obrigatorios' using errcode='22023'; end if;
 req:=jsonb_build_object('profile',p_profile_slug,'action','resolve_job_block','payload',p_payload);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_profile_slug||':'||k,0));
 select * into j from public.agent_jobs where job_id=p_payload->>'job_id' for update;
 if not found or j.business_id is null or j.task_id is null then raise exception 'Job exige tarefa e empresa' using errcode='22023'; end if;
 if b.scope_type='BUSINESS' and b.business_id is distinct from j.business_id then raise exception 'Empresa fora do escopo' using errcode='42501'; end if;
 select * into e from public.agent_job_events where job_id=j.job_id and payload->>'workflow_key'=k and event_type like 'WORKFLOW_%';
 if e.event_id is not null then
 if e.payload->'request' is distinct from req then raise exception 'Chave reutilizada com conteudo diferente' using errcode='22023'; end if;
 return e.payload->'response'; end if;
 select * into t from public.tarefas where task_id=j.task_id for update;
 if not found or t.business_id is distinct from j.business_id then raise exception 'Tarefa divergente' using errcode='22023'; end if;
 if (p_payload->>'expected_task_version')::bigint is distinct from t.row_version then raise exception 'CONFLITO_DE_VERSAO' using errcode='40001'; end if;
 recovering := j.status='FAILED';
 if recovering then
  -- Only the content-only pilot is enabled. Other domains require a validated recipe.
  if j.agent_id <> 'AGT-17' or j.error_code is distinct from 'HERMES_PROCESS_FAILED'
   or j.error_message is distinct from 'Execucao pontual terminou sem entrega confirmada. Diagnostico local: TIMEOUT. Verificar eventos antes de qualquer repeticao.'
   or j.attempt_count is distinct from 1
   or coalesce(j.evidence_refs,'[]'::jsonb) <> '[]'::jsonb
   or coalesce(j.result_payload,'{}'::jsonb) ? 'delivery'
   or j.result_payload->>'review_pending'='true'
   or exists(select 1 from public.agent_job_events where job_id=j.job_id and event_type='WORKFLOW_resolve_job_block' and payload->>'previous_status'='FAILED') then
   raise exception 'Falha sem receita de recuperacao validada ou resultado a reconciliar' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hermes:global-wip',0));
  if exists(select 1 from public.agent_jobs where status in ('READY','CLAIMED','RUNNING')) then
   raise exception 'WIP ocupado; aguardar sem repetir' using errcode='55000'; end if;
 else
  if j.status<>'WAITING_HELENA' or j.result_payload->>'review_pending'='true'
   or nullif(btrim(j.result_payload->>'decisao_necessaria'),'') is null then
   raise exception 'Exige bloqueio por decisao; entrega submetida exige review_delivery' using errcode='22023'; end if;
 end if;
 if coalesce(j.attempt_count,0)>=least(coalesce(j.max_attempts,2),2) then raise exception 'Limite de tentativas atingido; replanejar' using errcode='22023'; end if;
 update public.agent_jobs set status='DRAFT',approval_status='PENDING',updated_at=clock_timestamp(),
 result_payload=coalesce(result_payload,'{}'::jsonb)||jsonb_build_object('block_resolved_by',b.agent_id,'block_resolution',reason,'block_resolved_at',clock_timestamp(),'recovery_recipe',case when recovering then 'text-timeout-sol61-v1' else null end)
 where job_id=j.job_id;
 perform public.helena_write_record('tarefas',t.task_id,t.row_version,jsonb_build_object('status','NÃƒO INICIADA','bloqueio','Bloqueio resolvido; aguardando liberacao da coordenacao'));
 res:=jsonb_build_object('success',true,'job_id',j.job_id,'status','DRAFT','started',false,'completed',false,'attempt_count',j.attempt_count);
 insert into public.agent_job_events(job_id,agent_id,business_id,event_type,status,message,payload,correlation_id)
 values(j.job_id,b.agent_id,j.business_id,'WORKFLOW_resolve_job_block','DRAFT',reason,jsonb_build_object('workflow_key',k,'request',req,'response',res,'profile_slug',p_profile_slug,'previous_status',j.status,'previous_error_code',j.error_code,'previous_error_message',j.error_message,'technical_owner','AGT-09','recipe',case when recovering then 'text-timeout-sol61-v1' else null end),j.correlation_id);
 return res;
end;
$$;

do $$
declare j public.agent_jobs; t public.tarefas; p jsonb; r jsonb; r2 jsonb;
begin
 select * into strict j from public.agent_jobs where job_id='JOB-HR-84c9b8d298379035cde814191a3a6905';
 select * into strict t from public.tarefas where task_id=j.task_id;
 if j.status<>'FAILED' or j.attempt_count<>1 then raise exception 'Pilot state changed'; end if;
 p:=jsonb_build_object('job_id',j.job_id,'expected_task_version',t.row_version,'reason','Transactional test: preserve failed task and remaining attempt','idempotency_key','test-bounded-recovery-v1');
 begin
  perform pg_temp.test_recovery('isabela--biz003',p);
  raise exception 'TEST_FAIL unauthorized executor';
 exception when insufficient_privilege then insert into recovery_test_results values('executor denied'); end;
 begin
  perform pg_temp.test_recovery('helena--grupo',p||jsonb_build_object('expected_task_version',t.row_version-1));
  raise exception 'TEST_FAIL stale version';
 exception when serialization_failure then insert into recovery_test_results values('stale version denied'); end;
 begin
  update public.agent_jobs set attempt_count=2 where job_id=j.job_id;
  perform pg_temp.test_recovery('helena--grupo',p);
  raise exception 'TEST_FAIL exhausted accepted';
 exception when invalid_parameter_value then insert into recovery_test_results values('attempt limit preserved'); end;
 begin
  update public.agent_jobs set evidence_refs='["existing"]'::jsonb where job_id=j.job_id;
  perform pg_temp.test_recovery('helena--grupo',p);
  raise exception 'TEST_FAIL evidence accepted';
 exception when invalid_parameter_value then insert into recovery_test_results values('existing evidence denied'); end;
 begin
  update public.agent_jobs set error_message='UNKNOWN' where job_id=j.job_id;
  perform pg_temp.test_recovery('helena--grupo',p);
  raise exception 'TEST_FAIL uncertain result accepted';
 exception when invalid_parameter_value then insert into recovery_test_results values('unknown failure denied'); end;
 r:=pg_temp.test_recovery('helena--grupo',p);
 r2:=pg_temp.test_recovery('helena--grupo',p);
 if r is distinct from r2 or r->>'status'<>'DRAFT' or (r->>'attempt_count')::int<>1 then raise exception 'TEST_FAIL successful recovery'; end if;
 if (select attempt_count from public.agent_jobs where job_id=j.job_id)<>1 then raise exception 'TEST_FAIL attempt changed'; end if;
 insert into recovery_test_results values('same job recovered, attempt preserved, idempotent replay');
 begin
  perform pg_temp.test_recovery('helena--grupo',p||'{"reason":"different"}'::jsonb);
  raise exception 'TEST_FAIL reused key';
 exception when invalid_parameter_value then insert into recovery_test_results values('conflicting idempotency key denied'); end;
end $$;
select * from recovery_test_results;
rollback;
