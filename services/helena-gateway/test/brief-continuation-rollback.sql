-- Run after the migration inside a transaction and ROLLBACK. Never calls models.
do $test$
declare j public.agent_jobs; t public.tarefas; p jsonb; r jsonb; again jsonb;
begin
 select * into j from public.agent_jobs where job_id='JOB-HR-6e9e2c7f008a9993f7689e5e0defb53f';
 select * into t from public.tarefas where task_id=j.task_id;
 if j.status<>'DRAFT' or t.status<>'NÃO INICIADA' then raise exception 'Reproduction state changed; do not run fixture'; end if;
 p:=jsonb_build_object('job_id',j.job_id,'expected_task_version',t.row_version,'expected_job_updated_at',j.updated_at,
  'idempotency_key','rollback-second-edit-20260930','instruction',j.instruction,'definition_of_done',t.definicao_de_pronto,
  'revision_summary','Teste com rollback: continuar edicao do mesmo briefing sem liberar ou iniciar IA.');
 begin perform public.gateway_revise_task_brief('nina--biz003',p);raise exception 'Specialist revised brief';
 exception when insufficient_privilege then null; end;
 r:=public.gateway_revise_task_brief('helena--grupo',p);
 if r->>'success'<>'true' or r->>'status'<>'DRAFT' or r->>'started'<>'false' or r->>'released'<>'false'
   or r->>'attempt_count'<>j.attempt_count::text then raise exception 'Revision changed execution';end if;
 again:=public.gateway_revise_task_brief('helena--grupo',p);
 if again<>r then raise exception 'Non-idempotent replay';end if;
 begin perform public.gateway_revise_task_brief('helena--grupo',p||jsonb_build_object('idempotency_key','rollback-stale-edit'));
 raise exception 'Stale version accepted';exception when serialization_failure then null;end;
 select * into j from public.agent_jobs where job_id=j.job_id;
 select * into t from public.tarefas where task_id=j.task_id;
 update public.agent_jobs set instruction=instruction||E'\nUntracked fixture change' where job_id=j.job_id;
 select * into j from public.agent_jobs where job_id=j.job_id;
 p:=p||jsonb_build_object('idempotency_key','rollback-untracked-edit','expected_task_version',t.row_version,'expected_job_updated_at',j.updated_at);
 begin perform public.gateway_revise_task_brief('helena--grupo',p);raise exception 'Untracked draft accepted';
 exception when invalid_parameter_value then null;end;
end;
$test$;
select 'PASS' as status,'second edit; idempotent replay; stale, unauthorized and untracked denied; no IA' as checks;
