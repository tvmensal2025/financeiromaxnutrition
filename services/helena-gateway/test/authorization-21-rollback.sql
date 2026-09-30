begin;
set local statement_timeout='25s';
do $audit$
declare b record; r jsonb; p jsonb; ctx jsonb; j text; t text; v bigint; reviewer text; expected text; memory_id text;
brief text := '';
title text;
begin
 if has_function_privilege('anon','public.gateway_workflow(text,text,jsonb)','EXECUTE')
 or has_function_privilege('authenticated','public.gateway_workflow(text,text,jsonb)','EXECUTE') then raise exception 'RPC exposed'; end if;
 if (select count(*) from public.agent_runtime_bindings where provider='HERMES' and status='ACTIVE')<>21 then raise exception 'Expected 21 active profiles'; end if;
 foreach title in array array['Contexto e fontes','Objetivo e impacto','Escopo e limites','Plano de trabalho','Entregáveis','Critérios de pronto','Evidências e registro','Revisão e encaminhamento'] loop
 brief:=brief||E'\n## '||title||E'\n'||title||': Fixture isolada de autorizacao com fonte local de teste, sem IA, sem publicacao e com rollback integral ao terminar. Conferir somente permissao e transicao.';
 end loop;
 for b in select * from public.agent_runtime_bindings where provider='HERMES' and status='ACTIVE' order by agent_id loop
 ctx:=public.gateway_context(b.profile_slug);
 if ctx->>'context_version'<>'hermes-context-v2' or ctx->>'truncated'<>'false' or ctx->'profile'->>'agent_id'<>b.agent_id then raise exception 'Wrong context %',b.agent_id; end if;
 p:=jsonb_build_object('idempotency_key','auth-audit-'||b.agent_id,'business_id','BIZ-003','target_agent_id',b.agent_id,'objective','AUDITORIA ROLLBACK: permissao de '||b.agent_id,'instruction',brief,'definition_of_done','Comprovar somente permissoes, revisao independente e isolamento; fixture privada de banco apagada pelo rollback integral.');
 if b.agent_id not in ('AGT-01','AGT-04') then
   begin perform public.gateway_workflow(b.profile_slug,'create_task',p);
     raise exception 'Specialist created queue %',b.agent_id;
   exception when insufficient_privilege then null; end;
 end if;
 if b.scope_type='PERSONAL' then continue; end if;
 r:=public.gateway_workflow('marina--biz003','create_task',p);
 if r->>'success'<>'true' then raise exception 'Creation failed'; end if;
 if public.gateway_workflow('marina--biz003','create_task',p)<>r then raise exception 'Duplicate replay'; end if;
 j:=r->>'job_id';t:=r->>'task_id';
 select row_version into v from public.tarefas where task_id=t;
 p:=jsonb_build_object('job_id',j,'expected_task_version',v,'idempotency_key','release-audit-'||b.agent_id);
 if b.agent_id not in ('AGT-01','AGT-04') then
   begin perform public.gateway_workflow(b.profile_slug,'release_job',p);
     raise exception 'Specialist released queue %',b.agent_id;
   exception when insufficient_privilege then null; end;
 end if;
 perform public.gateway_workflow('marina--biz003','release_job',p);
 update public.agent_jobs set available_at=now() where job_id=j;
 perform public.gateway_claim_agent_job(j,b.agent_id);
 perform public.gateway_start_agent_job(j,b.agent_id);
 select row_version into v from public.tarefas where task_id=t;
 p:=jsonb_build_object('job_id',j,'idempotency_key','memory-audit-'||b.agent_id,
   'summary','Material ficticio estritamente para teste transacional de permissoes; nao usar como entrega real.',
   'source','Fixture privada de homologacao, sem inferencia e com rollback integral.',
   'next_step','Aguardar revisao independente da entrega simulada.');
 r:=public.gateway_workflow(b.profile_slug,'record_memory',p);
 memory_id:=r->>'memory_id';
 if memory_id is null or public.gateway_workflow(b.profile_slug,'record_memory',p)<>r then raise exception 'Memory replay failed %',b.agent_id; end if;
 p:=jsonb_build_object('job_id',j,'expected_task_version',v,'idempotency_key','submit-audit-'||b.agent_id,'summary','Fixture de teste; nenhuma entrega comercial.',
  'evidence_refs',jsonb_build_array(memory_id),
  'delivery',jsonb_build_object('schema_version',1,'title','Entrega simulada de homologacao',
    'content','Material ficticio estritamente para teste transacional de permissoes; nao usar como entrega real.',
    'next_steps','Aguardar revisao independente da entrega simulada.','limitations','Nenhum modelo, publicacao ou contato externo foi acionado.',
    'acceptance_checks',jsonb_build_array(jsonb_build_object('criterion','Registrar evidencia propria da tarefa',
      'evidence_ref',memory_id,'finding','Memoria registrada pelo proprio perfil e vinculada a esta tarefa simulada.'))));
 r:=public.gateway_workflow(b.profile_slug,'submit_delivery',p);
 if public.gateway_workflow(b.profile_slug,'submit_delivery',p)<>r then raise exception 'Submission replay failed %',b.agent_id; end if;
 expected:=case b.agent_id when 'AGT-01' then 'FOUNDER' when 'AGT-09' then 'AGT-13' when 'AGT-11' then 'AGT-03' when 'AGT-12' then 'AGT-10' when 'AGT-14' then 'AGT-04' when 'AGT-16' then 'AGT-03' when 'AGT-17' then 'AGT-16' when 'AGT-18' then 'AGT-06' when 'AGT-20' then 'AGT-19' when 'AGT-21' then 'AGT-14' else 'AGT-01' end;
 if r->>'reviewer_agent_id' is distinct from expected then raise exception 'Wrong reviewer %',b.agent_id; end if;
 select row_version into v from public.tarefas where task_id=t;
 p:=jsonb_build_object('job_id',j,'expected_task_version',v,'idempotency_key','review-audit-'||b.agent_id,'decision','REQUEST_CHANGES','reason','Teste transacional: devolver ajustes para comprovar o controle de permissao e a retomada do mesmo job.');
 begin perform public.gateway_workflow(b.profile_slug,'review_delivery',p);
   raise exception 'Self review accepted %',b.agent_id;
 exception when insufficient_privilege then null; end;
 if expected<>'FOUNDER' then
  select profile_slug into reviewer from public.agent_runtime_bindings where agent_id=expected and status='ACTIVE' and (business_id='BIZ-003' or scope_type='GROUP') limit 1;
  r:=public.gateway_workflow(reviewer,'review_delivery',p);
  if (select status from public.agent_jobs where job_id=j)<>'DRAFT' then raise exception 'Review did not return draft'; end if;
 end if;
 end loop;
 begin perform public.gateway_workflow('marina--biz003','create_task',jsonb_build_object('idempotency_key','audit-other-biz','business_id','BIZ-OTHER','target_agent_id','AGT-18'));
 raise exception 'Cross business accepted'; exception when insufficient_privilege then null; end;
end;
$audit$;
select 'PASS' as status,21 as profiles,20 as execution_review_routes,'FOUNDER remains human; Laura remains personal; no models' as scope;
rollback;
