-- One authorized founder clarification, not a retry/reset or a schema migration.
begin;
do $clarify$
declare
 j public.agent_jobs;
 t public.tarefas;
 updated_task jsonb;
 note text := E'\n\nComplemento autorizado pelo fundador em 01/10/2026: "Somente revisão interna; sem link ou publicação". Este lote é uma prova privada. A ausência de destino do CTA não impede criar e revisar internamente as quatro peças; não inserir link, contato, QR code ou ação clicável, nem divulgar. Preservar a copy aprovada e informar a restrição de uso nas instruções de entrega, fora da arte. A aprovação interna não autoriza publicação. Evidência técnica desta etapa: Maya/helena_visual e Nina/MCP retornaram READY sem IA em 01/10/2026 14:08-14:10 UTC. Cinco testes do renderizador instalado passaram no Hermes Linux, incluindo composição até a borda, logo único em área segura e reaproveitamento de PNG sem nova geração. Isso comprova capacidade técnica, não qualidade das próximas imagens: Nina deve abrir os quatro arquivos finais e revisar cada um.';
begin
 if exists(select 1 from public.agent_job_events where job_id='JOB-HR-fd62fc9a1659086444127a218432d958'
    and event_type='FOUNDER_SCOPE_CLARIFIED' and payload->>'operation_key'='private-review-20261001') then return; end if;
 select * into strict j from public.agent_jobs where job_id='JOB-HR-fd62fc9a1659086444127a218432d958' for update;
 select * into strict t from public.tarefas where task_id=j.task_id for update;
 if j.business_id<>'BIZ-003' or t.business_id<>j.business_id or j.status<>'DRAFT'
    or coalesce(j.attempt_count,0)<>0 or t.row_version<>3655
    or j.updated_at<>'2026-10-01T11:58:01.327413+00:00'::timestamptz then
   raise exception 'Snapshot changed; no clarification applied';
 end if;
 if exists(select 1 from public.agent_workflow_runs where job_id=j.job_id and status='STARTED') then
   raise exception 'Coordination still active; no edit';
 end if;
 if char_length(j.instruction||note)>8000 then raise exception 'Brief size exceeds contract'; end if;
 perform public.helena_validate_professional_brief(j.instruction||note);
 update public.agent_jobs set instruction=j.instruction||note, updated_at=clock_timestamp() where job_id=j.job_id;
 updated_task:=public.helena_write_record('tarefas',t.task_id,t.row_version,
    jsonb_build_object('definicao_de_pronto',t.definicao_de_pronto||E'\nUso autorizado: revisão interna, sem link ou publicação. Aprovação das peças não autoriza divulgar.'));
 insert into public.agent_job_events(job_id,agent_id,business_id,event_type,status,message,payload,correlation_id)
 values(j.job_id,'FOUNDER',j.business_id,'FOUNDER_SCOPE_CLARIFIED','DRAFT',
  'Fundador confirmou revisão interna sem link/publicação; preflight técnico verificado.',
  jsonb_build_object('operation_key','private-review-20261001','source','Explicit founder response in Codex',
    'previous_instruction',j.instruction,'previous_definition_of_done',t.definicao_de_pronto,
    'previous_task_version',t.row_version,'task_version',updated_task->'row_version',
    'clarification',note,'attempts_reset',false,'released',false),j.correlation_id);
end;
$clarify$;
select j.job_id,j.status,j.attempt_count,t.row_version,
 exists(select 1 from public.agent_job_events e where e.job_id=j.job_id and e.event_type='FOUNDER_SCOPE_CLARIFIED') as clarification_saved
from public.agent_jobs j join public.tarefas t on t.task_id=j.task_id
where j.job_id='JOB-HR-fd62fc9a1659086444127a218432d958';
commit;
