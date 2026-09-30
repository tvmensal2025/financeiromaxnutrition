-- Founder rejected the blank legacy PNGs. Preserve all files/history and reopen review.
-- This is a version-guarded data repair, not a schema migration or deletion.
begin;
do $$
declare j public.agent_jobs; t public.tarefas;
begin
  if exists(select 1 from public.agent_job_events where job_id='JOB-HR-d4b5b488e4716e749cb7b1392e308424'
    and event_type='QUALITY_APPROVAL_REVOKED' and payload->>'repair_key'='blank-art-20260930-v1') then return; end if;
  select * into strict j from public.agent_jobs where job_id='JOB-HR-d4b5b488e4716e749cb7b1392e308424' for update;
  select * into strict t from public.tarefas where task_id=j.task_id for update;
  if j.status<>'COMPLETED' or j.business_id<>'BIZ-003' or j.agent_id<>'AGT-12' or t.row_version<>2888
    or j.updated_at<>'2026-09-30 05:52:42.887625+00'::timestamptz then
    raise exception 'Versao ou escopo mudou: nenhuma alteracao aplicada';
  end if;
  insert into public.agent_job_events(job_id,agent_id,business_id,event_type,status,message,payload,correlation_id)
    values(j.job_id,'AGT-01',j.business_id,'QUALITY_APPROVAL_REVOKED','WAITING_HELENA',
      'Fundador rejeitou PNGs vazios. Aprovacao tecnica anterior invalidada; exige nova revisao visual independente.',
      jsonb_build_object('repair_key','blank-art-20260930-v1','source','Solicitacao explicita do fundador neste chat, com imagens da entrega vazia',
        'before_job',to_jsonb(j),'before_task',to_jsonb(t)),j.correlation_id);
  update public.agent_jobs set status='WAITING_HELENA',approval_status='PENDING',completed_at=null,updated_at=clock_timestamp(),
    result_payload=(coalesce(result_payload,'{}'::jsonb)-'reviewed_by'-'review_reason')||jsonb_build_object(
      'review_pending',true,'reviewer_agent_id','AGT-10','approval_invalidated',true,
      'invalidation_reason','Fundador rejeitou artes vazias; nao reutilizar como material publicavel')
    where job_id=j.job_id;
  perform public.helena_write_record('tarefas',t.task_id,t.row_version,jsonb_build_object(
    'status','BLOQUEADA','bloqueio','Arte rejeitada pelo fundador: nova revisao visual de Nina antes de qualquer uso.'));
end $$;
select job_id,status,approval_status,result_payload->>'reviewer_agent_id' as revisor
from public.agent_jobs where job_id='JOB-HR-d4b5b488e4716e749cb7b1392e308424';
commit;
