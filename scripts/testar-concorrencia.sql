-- Testes transacionais: toda alteração de exemplo é revertida.
begin;
select set_config('request.jwt.claims',jsonb_build_object('sub',
 (select user_id from public.app_access where role='founder' and active limit 1),'role','authenticated')::text,true);
set local role authenticated;
do $test$
declare initial_row jsonb; saved_row jsonb; current_row jsonb; checks integer:=0;
 task_id_test text:='TSK-QA-'||gen_random_uuid()::text; task_row jsonb;
 cp public.checkpoint_mestre; cp_new public.checkpoint_mestre;
begin
 insert into public.configuracao(chave,valor,tipo) values('QA_CONCORRENCIA','antes','TESTE_TRANSACIONAL')
   returning to_jsonb(configuracao.*) into initial_row;
 saved_row:=public.helena_write_record('configuracao',initial_row->>'registro_id',(initial_row->>'row_version')::bigint,'{"valor":"primeira conversa"}');
 if saved_row->>'valor'<>'primeira conversa' or (saved_row->>'row_version')::bigint<=(initial_row->>'row_version')::bigint then
   raise exception 'Falha na gravação válida' using errcode='P9999';
 end if; checks:=checks+1;
 begin
   perform public.helena_write_record('configuracao',initial_row->>'registro_id',(initial_row->>'row_version')::bigint,'{"valor":"segunda conversa antiga"}');
 exception when serialization_failure then checks:=checks+1; end;
 begin
   perform public.helena_write_record('configuracao',initial_row->>'registro_id',(initial_row->>'row_version')::bigint,'{}',true);
 exception when serialization_failure then checks:=checks+1; end;
 begin
   update public.configuracao set valor='escrita direta' where registro_id=(initial_row->>'registro_id')::bigint;
 exception when SQLSTATE 'P0001' then checks:=checks+1; end;
 begin
   delete from public.configuracao where registro_id=(initial_row->>'registro_id')::bigint;
 exception when SQLSTATE 'P0001' then checks:=checks+1; end;
 begin
   perform public.helena_write_record('configuracao',initial_row->>'registro_id',null,'{"valor":"sem versão"}');
 exception when invalid_parameter_value then checks:=checks+1; end;
 select to_jsonb(c) into current_row from public.configuracao c where registro_id=(initial_row->>'registro_id')::bigint;
 if current_row is distinct from saved_row then raise exception 'Conteúdo vencedor foi sobrescrito' using errcode='P9999'; end if;
 checks:=checks+1;

 insert into public.tarefas(task_id,business_id,tarefa,status,prazo)
 values(task_id_test,'BIZ-001','QA transacional da concorrência','NÃO INICIADA','2026-10-05')
 returning to_jsonb(tarefas.*) into task_row;
 if not exists(select 1 from public.calendario where event_id='EVT-TSK-'||task_id_test and inicio='2026-10-05T09:00:00') then
  raise exception 'Agenda não criada atomicamente' using errcode='P9999'; end if;
 checks:=checks+1;
 saved_row:=public.helena_write_record('tarefas',task_id_test,(task_row->>'row_version')::bigint,'{"prazo":"2026-10-06"}');
 begin
  perform public.helena_write_record('tarefas',task_id_test,(task_row->>'row_version')::bigint,'{"prazo":"2026-10-07"}');
 exception when serialization_failure then checks:=checks+1; end;
 if not exists(select 1 from public.calendario where event_id='EVT-TSK-'||task_id_test and inicio='2026-10-06T09:00:00') then
  raise exception 'Agenda sobrescrita pelo rascunho antigo' using errcode='P9999'; end if;
 checks:=checks+1;
 begin
  perform public.helena_sync_calendar('tarefas',task_id_test,(task_row->>'row_version')::bigint);
 exception when serialization_failure then checks:=checks+1; end;
 perform public.helena_write_record('tarefas',task_id_test,(saved_row->>'row_version')::bigint,'{}',true);
 if exists(select 1 from public.calendario where event_id='EVT-TSK-'||task_id_test) then
   raise exception 'Evento órfão após exclusão autorizada' using errcode='P9999'; end if;
 checks:=checks+1;

 -- Reusing an identifier must not revive an obsolete version (ABA).
 insert into public.tarefas(task_id,business_id,tarefa,status)
 values(task_id_test,'BIZ-001','Outro registro com o mesmo identificador','NÃO INICIADA');
 begin
  perform public.helena_write_record('tarefas',task_id_test,(saved_row->>'row_version')::bigint,'{"tarefa":"rascunho anterior à exclusão"}');
 exception when serialization_failure then checks:=checks+1; end;

 select * into cp from public.checkpoint_mestre_atual;
 begin
  perform public.helena_publish_checkpoint('PREDECESSOR_ANTIGO','QA','QA','QA','{}');
 exception when serialization_failure then checks:=checks+1; end;
 select * into cp_new from public.helena_publish_checkpoint(cp.checkpoint_id,'QA reversível','QA','QA','{"qa":true}');
 if cp_new.checkpoint_anterior_id<>cp.checkpoint_id or cp_new.versao<>cp.versao+1 then
  raise exception 'Cadeia de checkpoint inválida' using errcode='P9999'; end if;
 checks:=checks+1;
 begin
  perform public.helena_publish_checkpoint(cp.checkpoint_id,'Outra conversa','QA','QA','{}');
 exception when serialization_failure then checks:=checks+1; end;
 begin
  update public.checkpoint_mestre set resumo_executivo='reescrever' where checkpoint_id=cp.checkpoint_id;
 exception when SQLSTATE 'P0001' then checks:=checks+1; end;
 if checks<>17 then raise exception 'Esperados 17 controles de founder; passaram %',checks using errcode='P9999'; end if;
 perform set_config('helena.concurrency_test',jsonb_build_object('passed',checks,'role','founder','fixtures','ROLLBACK','coverage','CAS, stale delete, direct writes, missing version, atomic calendar, stale projection, checkpoint predecessor and history')::text,true);
end;
$test$;
reset role;
-- Check immutable-history triggers as the SQL operator as well, without RLS
-- filtering UPDATE into a harmless zero-row operation before a trigger can run.
do $history$
declare checks integer:=0; history_table text; field_name text;
begin
 foreach history_table in array array['auditoria','task_activity','agent_job_events'] loop
  field_name:=case when history_table='auditoria' then 'acao' else 'event_type' end;
  begin
   execute format('update public.%I set %I=%I where ctid in (select ctid from public.%I limit 1)',history_table,field_name,field_name,history_table);
  exception when insufficient_privilege then checks:=checks+1; end;
 end loop;
 if checks<>3 then raise exception 'Esperados 3 históricos imutáveis; passaram %',checks; end if;
 perform set_config('helena.concurrency_test',(current_setting('helena.concurrency_test')::jsonb || jsonb_build_object('passed',20,'immutable_histories',checks))::text,true);
end;
$history$;
select current_setting('helena.concurrency_test')::jsonb as result;
rollback;
