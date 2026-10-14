-- Patch incremental para a base Helena EXISTENTE. Não é um bootstrap do banco.
-- Revisar e testar em staging. A origem não inclui o esquema inicial completo.
-- Nenhuma ativação de agente, cron, envio externo ou declaração de homologação.
begin;

do $$ begin
  if to_regclass('public.tarefas') is null or to_regclass('public.portfolio') is null
    or to_regclass('public.app_access') is null or to_regclass('public.agent_runtime_bindings') is null
    or to_regclass('public.agent_job_events') is null or to_regprocedure('public.helena_write_record(text,text,bigint,jsonb,boolean)') is null then
    raise exception 'Base canônica e controle de versão ausentes. Não aplicar em banco vazio.';
  end if;
end $$;

create table if not exists public.helena_commands (
  command_id text primary key check(command_id ~ '^[A-Za-z0-9_-]{16,120}$'),
  user_id uuid not null references auth.users(id),
  business_id text references public.portfolio(business_id),
  original text not null check(length(original) between 1 and 20000),
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  state text not null check(state in ('RECEIVED','CAPABILITY_PENDING','RESOLVING','BLOCKED','DRAFT','QUEUED','RUNNING','REVIEW','DELIVERED','RECORDED','FAILED')),
  task_id text references public.tarefas(task_id),
  job_id text references public.agent_jobs(job_id),
  finance_id text,
  reason text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
-- Upgrade the existing patch's state constraint transactionally too.
alter table public.helena_commands drop constraint if exists helena_commands_state_check;
alter table public.helena_commands add constraint helena_commands_state_check
 check(state in ('RECEIVED','CAPABILITY_PENDING','RESOLVING','BLOCKED','DRAFT','QUEUED','RUNNING','REVIEW','DELIVERED','RECORDED','FAILED'));
create index if not exists helena_commands_business_created on public.helena_commands(business_id,created_at desc);
create index if not exists helena_commands_user on public.helena_commands(user_id);
create unique index if not exists helena_commands_task_unique on public.helena_commands(task_id) where task_id is not null;
alter table public.helena_commands enable row level security;
revoke all on public.helena_commands from anon, authenticated;
grant select on public.helena_commands to authenticated;
grant all on public.helena_commands to service_role;
drop policy if exists helena_commands_read on public.helena_commands;
create policy helena_commands_read on public.helena_commands for select to authenticated
using (exists(select 1 from public.app_access a where a.user_id=(select auth.uid()) and a.active)
 and ((select private.is_founder()) or (user_id=(select auth.uid()) and business_id is not null and private.user_has_business_access(business_id))));

create or replace function private.helena_command_receipt(c public.helena_commands)
returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('command_id',c.command_id,'business_id',c.business_id,'task_id',c.task_id,'job_id',c.job_id,
   'finance_id',c.finance_id,'state',c.state,'reason',c.reason,'verified',true);
$$;

-- Toda autorização é verificada no servidor. Metadados editáveis de usuário nunca autorizam.
create or replace function private.helena_require_access(p_business text, p_founder_only boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r text;
begin
 if u is null then raise exception 'Sessão obrigatória' using errcode='42501'; end if;
 select a.role into r from public.app_access a where a.user_id=u and a.active=true;
 if r is null or r not in ('founder','admin','member') then raise exception 'Acesso inativo' using errcode='42501'; end if;
 if p_founder_only and r<>'founder' then raise exception 'Somente o fundador pode realizar esta operação' using errcode='42501'; end if;
 if p_business is not null and (p_business !~ '^BIZ-[0-9]{3,}$' or not exists(select 1 from public.portfolio where business_id=p_business and ativo='SIM')) then
   raise exception 'Empresa não ativa no cadastro' using errcode='22023'; end if;
 if p_business is not null and r<>'founder' and not exists(select 1 from public.user_business_access where user_id=u and business_id=p_business and active=true) then
   raise exception 'Empresa fora do acesso autorizado' using errcode='42501'; end if;
 return u;
end; $$;

-- Transação única: recibo, lançamento/empresa ou missão + handoff. Privilegiada apenas no esquema privado.
create or replace function private.helena_receive_command(p_command_id text,p_business_id text,p_command jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; c public.helena_commands; k text; biz text:=p_business_id; tid text; hid text; fid text; nm text;
 cents numeric; f jsonb; account public.contas_financeiras; due date; tdate date;
begin
 if p_command_id is null or p_command_id !~ '^[A-Za-z0-9_-]{16,120}$' or jsonb_typeof(p_command) is distinct from 'object'
   or octet_length(p_command::text)>65536 or p_command->>'schema_version' is distinct from '1'
   or length(coalesce(p_command->>'original','')) not between 1 and 20000 then raise exception 'Comando inválido' using errcode='22023'; end if;
 k:=p_command->>'kind';
 if k is null or k not in ('TASK','FINANCE','BUSINESS','IDEA') then raise exception 'Tipo de comando não suportado' using errcode='22023'; end if;
 if k<>'BUSINESS' and biz is null then raise exception 'Empresa obrigatória' using errcode='22023'; end if;
 if k='BUSINESS' and biz is not null then raise exception 'Cadastro de empresa não aceita empresa implícita' using errcode='22023'; end if;
 if (p_command->>'business_id') is distinct from p_business_id then raise exception 'Empresa do pedido divergente' using errcode='22023'; end if;
 u:=private.helena_require_access(biz,k in ('BUSINESS','FINANCE'));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('helena-command:'||p_command_id,0));
 select * into c from public.helena_commands where command_id=p_command_id for update;
 if found then
   if c.user_id<>u or c.payload is distinct from p_command then raise exception 'Identificação reutilizada com pedido diferente. Consulte o recibo original.' using errcode='40001'; end if;
   return private.helena_command_receipt(c);
 end if;
 if k='BUSINESS' then
   nm:=btrim(p_command->>'business_name');
   if nm is null or length(nm) not between 2 and 120 then raise exception 'Nome de empresa inválido' using errcode='22023'; end if;
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('helena-business-catalog',0));
   select business_id into biz from public.portfolio where lower(btrim(negocio))=lower(nm) limit 1;
   if biz is null then
     select 'BIZ-'||lpad((coalesce(max(substring(business_id from 5)::bigint),0)+1)::text,
       greatest(3,length((coalesce(max(substring(business_id from 5)::bigint),0)+1)::text)),'0') into biz
       from public.portfolio where business_id ~ '^BIZ-[0-9]+$';
     insert into public.portfolio(business_id,negocio,ativo,estagio,source_system) values(biz,nm,'SIM','VALIDAÇÃO','HELENA_COMMAND');
   end if;
   insert into public.helena_commands(command_id,user_id,business_id,original,payload,state,reason)
     values(p_command_id,u,biz,p_command->>'original',p_command,'RECORDED','Cadastro confirmado; não comprova equipe, integração ou execução ativa.') returning * into c;
 elsif k='FINANCE' then
   f:=p_command->'finance';
   if jsonb_typeof(f) is distinct from 'object' or jsonb_typeof(f->'cents') is distinct from 'number' then raise exception 'Valor inválido' using errcode='22023'; end if;
   cents:=(f->>'cents')::numeric;
   if cents<>trunc(cents) or cents<=0 or cents>9007199254740991 then raise exception 'Valor fora da precisão segura' using errcode='22023'; end if;
   if f->>'flow' is null or f->>'flow' not in ('ENTRADA','SAÍDA') or f->>'status' is null or f->>'status' not in ('ABERTO','PAGO','RECEBIDO')
     or (f->>'flow'='ENTRADA' and f->>'status'='PAGO') or (f->>'flow'='SAÍDA' and f->>'status'='RECEBIDO') then raise exception 'Fluxo ou situação inválida' using errcode='22023'; end if;
   select * into account from public.contas_financeiras where conta_id=f->>'account_id' and business_id=biz and ativa='SIM' for share;
   if not found or account.moeda is distinct from 'BRL' then raise exception 'Conta ativa em BRL da mesma empresa é obrigatória' using errcode='22023'; end if;
   if coalesce(f->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Data do lançamento obrigatória' using errcode='22023'; end if;
   tdate:=(f->>'date')::date;
   if to_char(tdate,'YYYY-MM-DD')<>f->>'date' then raise exception 'Data inválida' using errcode='22023'; end if;
   if f->>'status' in ('PAGO','RECEBIDO') and tdate>(clock_timestamp() at time zone 'America/Sao_Paulo')::date then raise exception 'Liquidação realizada não pode ter data futura' using errcode='22023'; end if;
   fid:='FIN-CMD-'||md5(p_command_id);
   insert into public.financeiro(finance_id,business_id,fluxo,valor_original,moeda,conta_id,status,descricao,competencia,liquidacao,source_system,idempotency_key)
     values(fid,biz,f->>'flow',cents/100,'BRL',account.conta_id,f->>'status',p_command->>'original',to_char(tdate,'YYYY-MM'),
       case when f->>'status' in ('PAGO','RECEBIDO') then tdate::text else null end,'HELENA_COMMAND',p_command_id);
   insert into public.helena_commands(command_id,user_id,business_id,original,payload,state,finance_id,reason)
     values(p_command_id,u,biz,p_command->>'original',p_command,'RECORDED',fid,'Lançamento confirmado. Não executa pagamento, transferência bancária ou publicação.') returning * into c;
 elsif k='IDEA' then
   insert into public.ideias(id,data,business_id,ideia,decisao,responsavel,source_system)
     values('IDEA-CMD-'||md5(p_command_id),(clock_timestamp() at time zone 'America/Sao_Paulo')::date::text,biz,p_command->>'original','PRECISA VALIDAR','Helena','HELENA_COMMAND');
   insert into public.helena_commands(command_id,user_id,business_id,original,payload,state,reason)
     values(p_command_id,u,biz,p_command->>'original',p_command,'RECORDED','Ideia registrada. Nenhum job, projeto ou gasto criado.') returning * into c;
 else
   if p_command->>'deadline' is not null then
     if p_command->>'deadline' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Prazo exige data concreta' using errcode='22023'; end if;
     due:=(p_command->>'deadline')::date;
   end if;
   if length(btrim(coalesce(p_command->>'definition_of_done',''))) < 20 then raise exception 'Definição de pronto obrigatória' using errcode='22023'; end if;
   tid:='TSK-CMD-'||md5(p_command_id); hid:='HND-CMD-'||md5(p_command_id);
   insert into public.tarefas(task_id,business_id,tarefa,tipo,responsavel,prioridade,prazo,status,definicao_de_pronto,source_system,idempotency_key)
     values(tid,biz,p_command->>'original',case when k='IDEA' then 'IDEIA' else 'OPERACIONAL' end,'Helena',case when p_command->>'priority'='ALTA' then 'ALTA' else 'MEDIA' end,
       due::text,'NÃO INICIADA',p_command->>'definition_of_done','HELENA_COMMAND',p_command_id);
   insert into public.handoffs(id,data_hora,de,para,business_id_area,assunto,contexto_essencial,pergunta_tarefa_transferida,status,prioridade,pendencias,related_object_id,scope_type)
     values(hid,clock_timestamp()::text,'Fundador','Helena',biz,left(p_command->>'original',240),'Pedido integral preservado na tarefa '||tid,
       'Conferir capacidade, preparar execução e devolver entrega revisada.','ABERTO','MEDIA','Aguardando preparação do serviço operacional.',tid,'BUSINESS');
   insert into public.helena_commands(command_id,user_id,business_id,original,payload,state,task_id,reason)
     values(p_command_id,u,biz,p_command->>'original',p_command,'RECEIVED',tid,
       case when k='IDEA' then 'Ideia registrada, sem liberação automática.' else 'Pedido recebido; o Gateway deve confirmar capacidade e preparar a ordem. Nenhum agente iniciado.' end) returning * into c;
 end if;
 return private.helena_command_receipt(c);
end; $$;

create or replace function public.helena_submit_command(p_command_id text,p_business_id text,p_command jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select private.helena_receive_command(p_command_id,p_business_id,p_command);
$$;
create or replace function public.helena_create_business(p_name text,p_command_id text)
returns jsonb language sql security invoker set search_path='' as $$
 select public.helena_submit_command(p_command_id,null,jsonb_build_object('schema_version',1,'kind','BUSINESS','original','Cadastrar empresa: '||p_name,'business_name',p_name,'business_id',null));
$$;

-- Worker autenticado por service_role: somente prepara DRAFT; não libera nem chama IA.
create or replace function public.helena_prepare_command(p_command_id text,p_instruction text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.helena_commands; t public.tarefas; jid text; missing text[]; req text[];
begin
 select * into c from public.helena_commands where command_id=p_command_id for update;
 if not found then raise exception 'Pedido inexistente' using errcode='22023'; end if;
 if c.state not in ('RECEIVED','CAPABILITY_PENDING') or c.payload->>'kind'='IDEA' then return private.helena_command_receipt(c); end if;
 if not exists(select 1 from public.app_access where user_id=c.user_id and active=true) or not exists(select 1 from public.portfolio where business_id=c.business_id and ativo='SIM')
   or not (exists(select 1 from public.app_access where user_id=c.user_id and active and role='founder')
      or exists(select 1 from public.user_business_access where user_id=c.user_id and business_id=c.business_id and active)) then
   update public.helena_commands set state='CAPABILITY_PENDING',reason='Solicitante ou empresa inativos; despacho não autorizado.',updated_at=clock_timestamp() where command_id=p_command_id returning * into c;
   return private.helena_command_receipt(c);
 end if;
 req:=array['AGT-01'];
 if c.payload->'requested'->>'posts' is not null or c.payload->'requested'->>'stories' is not null then req:=req||array['AGT-03','AGT-16','AGT-17','AGT-12','AGT-10','AGT-13']; end if;
 select array_agg(a) into missing from unnest(req) a where not exists(select 1 from public.agent_runtime_bindings b where b.agent_id=a and b.provider='HERMES' and b.status='ACTIVE'
   and ((b.scope_type='BUSINESS' and b.business_id=c.business_id) or (a='AGT-01' and b.scope_type='GROUP')));
 if coalesce(cardinality(missing),0)>0 then
   update public.helena_commands set state='CAPABILITY_PENDING',reason='Perfis não confirmados nesta empresa: '||array_to_string(missing,', ')||'. Theo resolve a capacidade; Helena coordena.',updated_at=case when state<>'CAPABILITY_PENDING' or reason is distinct from 'Perfis não confirmados nesta empresa: '||array_to_string(missing,', ')||'. Theo resolve a capacidade; Helena coordena.' then clock_timestamp() else updated_at end
     where command_id=p_command_id returning * into c;
   select * into t from public.tarefas where task_id=c.task_id for update;
   if t.bloqueio is distinct from c.reason then perform public.helena_write_record('tarefas',t.task_id,t.row_version,jsonb_build_object('status','EM EXECUÇÃO','bloqueio','EM RESOLUÇÃO: '||c.reason),false); end if;
   return private.helena_command_receipt(c);
 end if;
 if p_instruction is null or length(p_instruction) not between 700 and 7000 then raise exception 'Briefing profissional deve ter 700 a 7000 caracteres' using errcode='22023'; end if;
 select * into t from public.tarefas where task_id=c.task_id and business_id=c.business_id for update;
 if not found or t.status in ('CONCLUÍDA','CANCELADA') then raise exception 'Tarefa não elegível' using errcode='22023'; end if;
 select job_id into jid from public.agent_jobs where task_id=c.task_id;
 if jid is null then
   jid:='JOB-HR-'||md5('command:'||c.command_id);
   insert into public.agent_jobs(job_id,task_id,agent_id,business_id,objective,instruction,priority,status,approval_required,approval_status,max_attempts,idempotency_key,correlation_id,result_payload)
     values(jid,c.task_id,'AGT-01',c.business_id,left(c.original,240),p_instruction,'MEDIA','DRAFT',true,'PENDING',2,'command:'||c.command_id,jid,
       jsonb_build_object('command_id',c.command_id,'mission_contract',c.payload));
   insert into public.agent_job_events(job_id,agent_id,business_id,event_type,status,message,payload,correlation_id)
     values(jid,'AGT-01',c.business_id,'COMMAND_PREPARED','DRAFT','Missão vinculada à coordenação. Não iniciou modelo.',jsonb_build_object('command_id',c.command_id,'task_id',c.task_id),jid);
 end if;
 perform public.helena_write_record('tarefas',t.task_id,t.row_version,jsonb_build_object('status','NÃO INICIADA','bloqueio',null),false);
 update public.helena_commands set state='DRAFT',job_id=jid,reason='Ordem preparada. Liberação, consumo, execução e revisão seguem o fluxo autorizado existente.',updated_at=clock_timestamp() where command_id=p_command_id returning * into c;
 return private.helena_command_receipt(c);
end; $$;

-- Projeção de estado não concede aprovação e não inventa evidência. Só avança com o job real.
create or replace function private.helena_project_command_status()
returns trigger language plpgsql security definer set search_path='' as $$
declare st text;
begin
 st:=case new.status when 'DRAFT' then 'DRAFT' when 'READY' then 'QUEUED' when 'CLAIMED' then 'RUNNING' when 'RUNNING' then 'RUNNING'
    when 'WAITING_HELENA' then case when new.result_payload->>'review_pending'='true' then 'REVIEW' else 'RESOLVING' end when 'FAILED' then 'FAILED' when 'COMPLETED' then 'REVIEW' else null end;
 if st is not null then update public.helena_commands set state=st,reason=case when new.status='COMPLETED' then 'Trabalho encerrado no motor; missão aguarda aceite final do fundador e verificação do pacote completo.' else coalesce(new.error_message,'Estado projetado do motor; consulte eventos e evidências.') end,updated_at=clock_timestamp() where job_id=new.job_id and state<>'DELIVERED'; end if;
 return new;
end; $$;
drop trigger if exists helena_project_command_status on public.agent_jobs;
create trigger helena_project_command_status after update of status,result_payload,evidence_refs on public.agent_jobs for each row execute function private.helena_project_command_status();

-- Aceite humano explícito: não se faz passar por um especialista e preserva versões.
create or replace function private.helena_review_command(p_command_id text,p_expected_updated_at timestamptz,p_expected_task_version bigint,p_decision text,p_reason text,p_checks jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.helena_commands; j public.agent_jobs; t public.tarefas; u uuid; refs jsonb; posts integer; stories integer; actual_posts integer; actual_stories integer;
begin
 select * into c from public.helena_commands where command_id=p_command_id;
 if not found then raise exception 'Pedido inexistente' using errcode='22023'; end if;
 u:=private.helena_require_access(c.business_id,true);
 -- Mesma ordem de lock do motor: job -> recibo -> tarefa.
 select * into j from public.agent_jobs where job_id=c.job_id for update;
 if not found then raise exception 'Ordem não encontrada' using errcode='22023'; end if;
 select * into c from public.helena_commands where command_id=p_command_id for update;
 if c.updated_at is distinct from p_expected_updated_at then raise exception 'A entrega mudou; releia antes de decidir' using errcode='40001'; end if;
 if c.state<>'REVIEW' or j.business_id<>c.business_id or j.task_id<>c.task_id or j.status not in ('WAITING_HELENA','COMPLETED') then raise exception 'Pedido não está em revisão' using errcode='22023'; end if;
 if j.agent_id='AGT-01' and j.result_payload->>'reviewer_agent_id' is distinct from 'FOUNDER' then raise exception 'Revisão humana não designada' using errcode='42501'; end if;
 if p_decision is null or p_decision not in ('APPROVE','REQUEST_CHANGES') or length(btrim(coalesce(p_reason,'')))<80 then raise exception 'Decisão e parecer específico de no mínimo 80 caracteres obrigatórios' using errcode='22023'; end if;
 select * into t from public.tarefas where task_id=c.task_id for update;
 if not found or t.row_version is distinct from p_expected_task_version then raise exception 'Tarefa mudou; releia antes de decidir' using errcode='40001'; end if;
 if p_decision='APPROVE' then
   if coalesce(j.result_payload->>'delivery_stage',j.result_payload->'delivery'->>'stage','')<>'FINAL'
     or length(coalesce(j.result_payload->'delivery'->>'content',''))<40 or jsonb_typeof(j.evidence_refs) is distinct from 'array' or jsonb_array_length(j.evidence_refs)<1 then raise exception 'Pacote final e evidências obrigatórios; relatório intermediário não conclui missão' using errcode='22023'; end if;
   if jsonb_typeof(p_checks) is distinct from 'object' or p_checks->>'requirements_met' is distinct from 'true' or p_checks->>'company' is distinct from c.business_id
     then raise exception 'Conferência explícita de requisitos e empresa obrigatória' using errcode='22023'; end if;
   posts:=(c.payload->'requested'->>'posts')::integer; stories:=(c.payload->'requested'->>'stories')::integer;
   if (posts is not null and (p_checks->>'posts')::integer is distinct from posts) or (stories is not null and (p_checks->>'stories')::integer is distinct from stories) then raise exception 'Quantidades não correspondem ao pedido' using errcode='22023'; end if;
   select coalesce(jsonb_agg(distinct e.value),'[]'::jsonb) into refs from jsonb_array_elements_text(j.evidence_refs) as e(value) where e.value like 'storage://helena-deliveries/'||c.business_id||'/%';
   -- Count distinct logical pieces, not self-reported amounts or duplicate versions.
   if coalesce(posts,0)+coalesce(stories,0)>0 then
     if exists(select 1 from jsonb_array_elements_text(refs) r(value) where r.value !~
       ('^storage://helena-deliveries/'||c.business_id||'/JOB-HR-[a-f0-9]{32}/(post|(?:post|story)-(?:[1-9][0-9]?|100))-v[1-5]\.png$')) then
       raise exception 'Referência de arquivo fora do contrato' using errcode='22023';
     end if;
     if exists(select 1 from jsonb_array_elements_text(refs) r(value) where not exists(
       select 1 from public.agent_job_events ev join public.agent_jobs source_job on source_job.job_id=ev.job_id
       where ev.event_type='ARTIFACT_VERIFIED' and ev.business_id=c.business_id and source_job.business_id=c.business_id
         and coalesce(source_job.correlation_id,source_job.job_id)=coalesce(j.correlation_id,j.job_id)
         and ev.payload->>'reference'=r.value and ev.payload->>'sha256' ~ '^[a-f0-9]{64}$'
         and ev.payload->>'width'='1080' and ev.payload->>'bytes' ~ '^[1-9][0-9]*$'
         and ev.payload->>'height'=case when r.value ~ '/post(-[0-9]+)?-v[1-5]\.png$' then '1350' else '1920' end
     )) then raise exception 'Arquivo sem evento de verificação nesta missão; recibo textual não comprova arquivo' using errcode='22023'; end if;
     select count(*) filter(where v ~ '^post(-[0-9]+)?-v[1-5]\.png$'),
            count(*) filter(where v ~ '^story-[0-9]+-v[1-5]\.png$')
       into actual_posts,actual_stories from (select distinct
         regexp_replace(regexp_replace(regexp_replace(value,'^.*/',''),'^post-v','post-1-v'),'-v[1-5]\.png$','-v1.png') v
         from jsonb_array_elements_text(refs)) pieces;
     if actual_posts is distinct from coalesce(posts,0) or actual_stories is distinct from coalesce(stories,0) then
       raise exception 'Arquivos não correspondem às quantidades de posts e stories do pedido' using errcode='22023'; end if;
   end if;
   if coalesce(posts,0)+coalesce(stories,0)>0 and (jsonb_array_length(refs)<>coalesce(posts,0)+coalesce(stories,0)
      or p_checks->>'text_readable' is distinct from 'true' or p_checks->>'brand_matches' is distinct from 'true'
      or p_checks->>'copy_matches' is distinct from 'true' or p_checks->>'composition_approved' is distinct from 'true') then raise exception 'Arquivos e inspeção visual humana obrigatórios para todas as peças' using errcode='22023'; end if;
 end if;
 update public.agent_jobs set status=case when p_decision='APPROVE' then 'COMPLETED' else 'DRAFT' end,
   approval_status=case when p_decision='APPROVE' then 'APPROVED' else 'PENDING' end,
   completed_at=case when p_decision='APPROVE' then clock_timestamp() else null end,updated_at=clock_timestamp(),
   result_payload=coalesce(result_payload,'{}'::jsonb)||jsonb_build_object('review_pending',false,'reviewed_by','FOUNDER:'||u::text,'review_reason',p_reason,
     'delivery_audience','FOUNDER','delivery_stage',case when p_decision='APPROVE' then 'FINAL' else null end,'human_review',p_checks,
     'visual_review',case when p_decision='APPROVE' and jsonb_array_length(refs)>0 then p_checks||jsonb_build_object('inspected_references',refs,'findings',p_reason) else null end)
   where job_id=j.job_id;
 -- O motor pode projetar o estado na tarefa. Releitura aqui não mascara conflitos de usuário: o job e tarefa já estão bloqueados nesta transação.
 select * into t from public.tarefas where task_id=c.task_id;
 perform public.helena_write_record('tarefas',t.task_id,t.row_version,jsonb_build_object('status',case when p_decision='APPROVE' then 'CONCLUÍDA' else 'EM EXECUÇÃO' end,'bloqueio',case when p_decision='APPROVE' then null else 'EM RESOLUÇÃO: '||p_reason end),false);
 insert into public.agent_job_events(job_id,agent_id,business_id,event_type,status,message,payload,correlation_id)
   values(j.job_id,'AGT-01',c.business_id,'FOUNDER_MISSION_REVIEW',case when p_decision='APPROVE' then 'COMPLETED' else 'DRAFT' end,
     'Decisão humana explícita do fundador; não é uma revisão automática.',jsonb_build_object('actor_user_id',u,'decision',p_decision,'reason',p_reason,'checks',p_checks),j.correlation_id);
 update public.helena_commands set state=case when p_decision='APPROVE' then 'DELIVERED' else 'DRAFT' end,
   reason=case when p_decision='APPROVE' then 'Missão aceita pelo fundador com evidência. Nenhuma publicação ou envio externo autorizado.' else 'Correção solicitada: '||p_reason end,updated_at=clock_timestamp()
   where command_id=p_command_id returning * into c;
 return private.helena_command_receipt(c);
end; $$;
create or replace function public.helena_review_command(p_command_id text,p_expected_updated_at timestamptz,p_expected_task_version bigint,p_decision text,p_reason text,p_checks jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select private.helena_review_command(p_command_id,p_expected_updated_at,p_expected_task_version,p_decision,p_reason,p_checks);
$$;
revoke all on function private.helena_review_command(text,timestamptz,bigint,text,text,jsonb),public.helena_review_command(text,timestamptz,bigint,text,text,jsonb) from public,anon;
grant execute on function private.helena_review_command(text,timestamptz,bigint,text,text,jsonb),public.helena_review_command(text,timestamptz,bigint,text,text,jsonb) to authenticated;

-- Defesa no banco: UI genérica não pode concluir sem evidência nem ignorar job/revisão.
create or replace function private.helena_task_completion_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status='CONCLUÍDA' and (tg_op='INSERT' or old.status is distinct from new.status) then
   if length(btrim(coalesce(new.evidencia,'')))<20 or length(btrim(coalesce(new.definicao_de_pronto,'')))<20 then raise exception 'Conclusão exige critério e evidência verificável' using errcode='22023'; end if;
   if exists(select 1 from public.agent_jobs j where j.task_id=new.task_id and (j.status<>'COMPLETED' or j.approval_status<>'APPROVED' or coalesce(j.result_payload->>'review_pending','true')<>'false')) then
     raise exception 'Tarefa automatizada exige conclusão revisada pelo motor' using errcode='22023'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists helena_task_completion_guard on public.tarefas;
create trigger helena_task_completion_guard before insert or update of status on public.tarefas for each row execute function private.helena_task_completion_guard();

-- Exposição mínima: wrappers invoker; rotinas privilegiadas permanecem no esquema não exposto.
revoke all on function private.helena_require_access(text,boolean) from public,anon,authenticated;
revoke all on function private.helena_receive_command(text,text,jsonb) from public,anon;
revoke all on function private.helena_command_receipt(public.helena_commands) from public,anon;
revoke all on function private.helena_project_command_status() from public,anon,authenticated;
revoke all on function private.helena_task_completion_guard() from public,anon,authenticated;
revoke all on function public.helena_submit_command(text,text,jsonb) from public,anon;
revoke all on function public.helena_create_business(text,text) from public,anon;
revoke all on function public.helena_prepare_command(text,text) from public,anon,authenticated;
grant usage on schema private to authenticated,service_role;
grant execute on function private.helena_receive_command(text,text,jsonb),private.helena_command_receipt(public.helena_commands) to authenticated,service_role;
grant execute on function public.helena_submit_command(text,text,jsonb),public.helena_create_business(text,text) to authenticated;
grant execute on function public.helena_prepare_command(text,text) to service_role;
-- Recupera o pedido já existente sem duplicar o cartão, briefing ou histórico.
create or replace function private.helena_adopt_mission(p_task_id text,p_expected_version bigint,p_command_id text,p_requested jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.tarefas; c public.helena_commands; u uuid; req jsonb; due date; n text;
begin
 if p_command_id is null or p_command_id !~ '^[A-Za-z0-9_-]{16,120}$' or jsonb_typeof(p_requested) is distinct from 'object' then raise exception 'Identificação e quantidades estruturadas obrigatórias' using errcode='22023'; end if;
 select * into t from public.tarefas where task_id=p_task_id;
 if not found then raise exception 'Tarefa não encontrada' using errcode='22023'; end if;
 u:=private.helena_require_access(t.business_id,true);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('helena-command:'||p_command_id,0));
 select * into c from public.helena_commands where command_id=p_command_id for update;
 if found then
   if c.task_id is distinct from p_task_id or c.user_id is distinct from u or c.payload->'requested' is distinct from p_requested then raise exception 'Identificação reutilizada com outro pedido' using errcode='40001'; end if;
   return private.helena_command_receipt(c);
 end if;
 select * into t from public.tarefas where task_id=p_task_id for update;
 if t.row_version is distinct from p_expected_version then raise exception 'A tarefa mudou; releia sem sobrescrever a versão' using errcode='40001'; end if;
 if t.status in ('CONCLUÍDA','CANCELADA','EM EXECUÇÃO') or coalesce(t.responsavel,'') not in ('Helena','AGT-01','Helena / AGT-01','AGT-01 Helena') then raise exception 'Adoção exige pedido não executado atribuído à Helena; não muda titularidade silenciosamente' using errcode='22023'; end if;
 if exists(select 1 from public.agent_jobs where task_id=t.task_id) or exists(select 1 from public.helena_commands where task_id=t.task_id) then raise exception 'Tarefa já vinculada: consulte a ordem e o recibo existentes' using errcode='23505'; end if;
 if length(btrim(coalesce(t.definicao_de_pronto,'')))<20 then raise exception 'Complete os critérios de pronto antes de preparar a missão' using errcode='22023'; end if;
 foreach n in array array['posts','stories'] loop
   if p_requested->>n is not null and (p_requested->>n !~ '^[1-9][0-9]{0,2}$' or (p_requested->>n)::integer>100) then raise exception 'Quantidade de peças inválida' using errcode='22023'; end if;
 end loop;
 if upper(btrim(coalesce(t.prazo,'')))='HOJE' then due:=(t.criado_em at time zone 'America/Sao_Paulo')::date;
 elsif t.prazo ~ '^\d{4}-\d{2}-\d{2}$' then due:=t.prazo::date; end if;
 req:=jsonb_build_object('schema_version',1,'kind','TASK','original',t.tarefa,'business_id',t.business_id,'title',left(t.tarefa,240),
   'definition_of_done',t.definicao_de_pronto,'target_agent_id','AGT-01','priority',t.prioridade,'deadline',due,'deadline_original',t.prazo,
   'timezone','America/Sao_Paulo','requested',p_requested,'adopted_task_version',t.row_version);
 insert into public.helena_commands(command_id,user_id,business_id,original,payload,state,task_id,reason)
 values(p_command_id,u,t.business_id,t.tarefa,req,'RECEIVED',t.task_id,'Pedido existente adotado. Cartão, autor, texto e histórico preservados; nenhuma execução iniciada.') returning * into c;
 if due is not null and t.prazo is distinct from due::text then perform public.helena_write_record('tarefas',t.task_id,t.row_version,jsonb_build_object('prazo',due::text),false); end if;
 insert into public.handoffs(id,data_hora,de,para,business_id_area,assunto,contexto_essencial,pergunta_tarefa_transferida,status,prioridade,pendencias,related_object_id,scope_type)
 values('HND-ADOPT-'||md5(p_command_id),clock_timestamp()::text,'Fundador','Helena',t.business_id,'Retomar pedido existente '||t.task_id,
   'Recibo '||p_command_id||'; texto integral e critérios preservados em '||t.task_id,'Conferir capacidade e preparar a mesma missão, sem duplicar.','ABERTO','ALTA','Aguardando preparação autorizada.',t.task_id,'BUSINESS');
 return private.helena_command_receipt(c);
end; $$;
create or replace function public.helena_adopt_mission(p_task_id text,p_expected_version bigint,p_command_id text,p_requested jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select private.helena_adopt_mission(p_task_id,p_expected_version,p_command_id,p_requested); $$;
revoke all on function private.helena_adopt_mission(text,bigint,text,jsonb),public.helena_adopt_mission(text,bigint,text,jsonb) from public,anon;
grant execute on function private.helena_adopt_mission(text,bigint,text,jsonb),public.helena_adopt_mission(text,bigint,text,jsonb) to authenticated;

commit;
