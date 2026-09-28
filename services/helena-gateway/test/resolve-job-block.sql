begin;
do $test$
declare j public.agent_jobs; v bigint; p jsonb; r jsonb; a jsonb; cnt bigint;
begin
 select * into j from public.agent_jobs where job_id='JOB-HR-ed135142c0c6f852af3c7728e440a5b8';
 select row_version into v from public.tarefas where task_id=j.task_id;
 p:=jsonb_build_object('job_id',j.job_id,'expected_task_version',v,'reason','Teste transacional revertido','idempotency_key','test-resolve-rollback-20260928');
 begin
 perform public.gateway_resolve_job_block('augusto--biz003',p);
 raise exception 'TEST_FAIL agente resolveu proprio bloqueio';
 exception when insufficient_privilege then null; end;
 begin
 perform public.gateway_resolve_job_block('marina--biz003',p||jsonb_build_object('expected_task_version',v-1));
 raise exception 'TEST_FAIL versao antiga aceita';
 exception when serialization_failure then null; end;
 update public.agent_jobs set result_payload=result_payload||'{"review_pending":true}'::jsonb where job_id=j.job_id;
 begin
 perform public.gateway_resolve_job_block('marina--biz003',p);
 raise exception 'TEST_FAIL entrega desviada da revisao';
 exception when invalid_parameter_value then null; end;
 update public.agent_jobs set result_payload=j.result_payload,attempt_count=2 where job_id=j.job_id;
 begin
 perform public.gateway_resolve_job_block('marina--biz003',p);
 raise exception 'TEST_FAIL limite ignorado';
 exception when invalid_parameter_value then null; end;
 update public.agent_jobs set attempt_count=j.attempt_count where job_id=j.job_id;
 select row_version into v from public.tarefas where task_id=j.task_id;
 p:=p||jsonb_build_object('expected_task_version',v);
 r:=public.gateway_resolve_job_block('marina--biz003',p);
 a:=public.gateway_resolve_job_block('marina--biz003',p);
 if r is distinct from a or r->>'status'<>'DRAFT' or (r->>'attempt_count')::int<>1 then raise exception 'TEST_FAIL resultado/idempotencia'; end if;
 select count(*) into cnt from public.agent_job_events where job_id=j.job_id and payload->>'workflow_key'='test-resolve-rollback-20260928';
 if cnt<>1 then raise exception 'TEST_FAIL evento duplicado'; end if;
 begin
 perform public.gateway_resolve_job_block('marina--biz003',p||'{"reason":"conteudo diferente"}'::jsonb);
 raise exception 'TEST_FAIL chave reutilizada aceita';
 exception when invalid_parameter_value then null; end;
end;
$test$;
rollback;
