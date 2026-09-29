-- Version checks are mandatory for UPDATE/DELETE on the domain records below.
-- SECURITY INVOKER preserves the existing RLS and column privileges.
-- Runtime queues, auth, connection/config stores and event streams retain their separate protocols.
create sequence public.helena_record_revision_seq as bigint;
revoke all on sequence public.helena_record_revision_seq from public, anon;
grant usage on sequence public.helena_record_revision_seq to authenticated, service_role;

create function public.helena_concurrency_tables() returns text[]
language sql immutable set search_path = '' as $$
  select array['equipe','sistema_vivo','listas_dominio','helena_guia','backups','acessos','comunicacoes','pessoas','fundador','financeiro','documentos','marketing','obrigacoes','atendimento','clientes','riscos','crm','contas_financeiras','contratos','handoffs','portfolio','governanca','estado_mestre','foco_executivo','fluxo_caixa','recorrencias','decisoes','agentes','memoria_mestre','consentimentos','auditoria_sistema','regras_formula','orcamento','guia_operacao','entidades','ativos','societario','metas_kpis','incidentes','fornecedores','produto','automacoes','projetos','calendario','tarefas','ideias','processos','dicionario_dados','integracoes','plano_contas','dre_mensal','protocolo_agentes','marcos','configuracao' ]::text[];
$$;
revoke all on function public.helena_concurrency_tables() from public, anon;
grant execute on function public.helena_concurrency_tables() to authenticated, service_role;

create function public.helena_guard_record_write() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare guard jsonb; old_row jsonb; new_row jsonb;
begin
  if TG_OP='INSERT' then
    NEW.row_version:=nextval('public.helena_record_revision_seq');
    return NEW;
  end if;
  old_row:=to_jsonb(OLD);
  guard:=nullif(current_setting('helena.write_guard',true),'')::jsonb;
  if guard is null or guard->>'table' is distinct from TG_TABLE_NAME
    or guard->>'id' is distinct from old_row->>TG_ARGV[0]
    or guard->>'version' is distinct from old_row->>'row_version'
    or guard->>'operation' is distinct from TG_OP then
    raise exception 'Gravação sem versão verificada. Leia o registro e use helena_write_record.'
      using errcode='P0001',hint='Não reaplique a alteração automaticamente.';
  end if;
  if TG_OP='DELETE' then return OLD; end if;
  new_row:=to_jsonb(NEW);
  if new_row->>TG_ARGV[0] is distinct from old_row->>TG_ARGV[0] then
    raise exception 'A chave do registro não pode ser alterada' using errcode='22023';
  end if;
  NEW.row_version:=nextval('public.helena_record_revision_seq');
  if new_row ? 'atualizado_em' then
    NEW:=jsonb_populate_record(NEW,jsonb_build_object('atualizado_em',clock_timestamp()));
  end if;
  if new_row ? 'updated_at' then
    NEW:=jsonb_populate_record(NEW,jsonb_build_object('updated_at',clock_timestamp()));
  end if;
  return NEW;
end;
$$;
revoke all on function public.helena_guard_record_write() from public, anon, authenticated;

alter table public.equipe add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.equipe
  for each row execute function public.helena_guard_record_write('agent_id');
alter table public.sistema_vivo add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.sistema_vivo
  for each row execute function public.helena_guard_record_write('registro_id');
alter table public.listas_dominio add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.listas_dominio
  for each row execute function public.helena_guard_record_write('id');
alter table public.helena_guia add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.helena_guia
  for each row execute function public.helena_guard_record_write('ordem');
alter table public.backups add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.backups
  for each row execute function public.helena_guard_record_write('backup_id');
alter table public.acessos add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.acessos
  for each row execute function public.helena_guard_record_write('access_id');
alter table public.comunicacoes add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.comunicacoes
  for each row execute function public.helena_guard_record_write('communication_id');
alter table public.pessoas add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.pessoas
  for each row execute function public.helena_guard_record_write('person_id');
alter table public.fundador add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.fundador
  for each row execute function public.helena_guard_record_write('registro_id');
alter table public.financeiro add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.financeiro
  for each row execute function public.helena_guard_record_write('finance_id');
alter table public.documentos add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.documentos
  for each row execute function public.helena_guard_record_write('document_id');
alter table public.marketing add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.marketing
  for each row execute function public.helena_guard_record_write('campaign_id');
alter table public.obrigacoes add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.obrigacoes
  for each row execute function public.helena_guard_record_write('obligation_id');
alter table public.atendimento add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.atendimento
  for each row execute function public.helena_guard_record_write('ticket_id');
alter table public.clientes add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.clientes
  for each row execute function public.helena_guard_record_write('customer_id');
alter table public.riscos add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.riscos
  for each row execute function public.helena_guard_record_write('risk_id');
alter table public.crm add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.crm
  for each row execute function public.helena_guard_record_write('opportunity_id');
alter table public.contas_financeiras add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.contas_financeiras
  for each row execute function public.helena_guard_record_write('conta_id');
alter table public.contratos add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.contratos
  for each row execute function public.helena_guard_record_write('contract_id');
alter table public.handoffs add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.handoffs
  for each row execute function public.helena_guard_record_write('id');
alter table public.portfolio add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.portfolio
  for each row execute function public.helena_guard_record_write('business_id');
alter table public.governanca add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.governanca
  for each row execute function public.helena_guard_record_write('governance_id');
alter table public.estado_mestre add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.estado_mestre
  for each row execute function public.helena_guard_record_write('registro_id');
alter table public.foco_executivo add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.foco_executivo
  for each row execute function public.helena_guard_record_write('id');
alter table public.fluxo_caixa add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.fluxo_caixa
  for each row execute function public.helena_guard_record_write('cashflow_id');
alter table public.recorrencias add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.recorrencias
  for each row execute function public.helena_guard_record_write('recurrence_id');
alter table public.decisoes add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.decisoes
  for each row execute function public.helena_guard_record_write('decision_id');
alter table public.agentes add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.agentes
  for each row execute function public.helena_guard_record_write('agent_id');
alter table public.memoria_mestre add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.memoria_mestre
  for each row execute function public.helena_guard_record_write('id');
alter table public.consentimentos add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.consentimentos
  for each row execute function public.helena_guard_record_write('consent_id');
alter table public.auditoria_sistema add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.auditoria_sistema
  for each row execute function public.helena_guard_record_write('test_id');
alter table public.regras_formula add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.regras_formula
  for each row execute function public.helena_guard_record_write('id');
alter table public.orcamento add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.orcamento
  for each row execute function public.helena_guard_record_write('budget_id');
alter table public.guia_operacao add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.guia_operacao
  for each row execute function public.helena_guard_record_write('registro_id');
alter table public.entidades add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.entidades
  for each row execute function public.helena_guard_record_write('entity_id');
alter table public.ativos add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.ativos
  for each row execute function public.helena_guard_record_write('asset_id');
alter table public.societario add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.societario
  for each row execute function public.helena_guard_record_write('stake_id');
alter table public.metas_kpis add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.metas_kpis
  for each row execute function public.helena_guard_record_write('kpi_id');
alter table public.incidentes add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.incidentes
  for each row execute function public.helena_guard_record_write('incident_id');
alter table public.fornecedores add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.fornecedores
  for each row execute function public.helena_guard_record_write('supplier_id');
alter table public.produto add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.produto
  for each row execute function public.helena_guard_record_write('product_item_id');
alter table public.automacoes add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.automacoes
  for each row execute function public.helena_guard_record_write('automation_id');
alter table public.projetos add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.projetos
  for each row execute function public.helena_guard_record_write('project_id');
alter table public.calendario add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.calendario
  for each row execute function public.helena_guard_record_write('event_id');
alter table public.tarefas add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.tarefas
  for each row execute function public.helena_guard_record_write('task_id');
alter table public.ideias add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.ideias
  for each row execute function public.helena_guard_record_write('id');
alter table public.processos add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.processos
  for each row execute function public.helena_guard_record_write('process_id');
alter table public.dicionario_dados add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.dicionario_dados
  for each row execute function public.helena_guard_record_write('registro_id');
alter table public.integracoes add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.integracoes
  for each row execute function public.helena_guard_record_write('integration_id');
alter table public.plano_contas add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.plano_contas
  for each row execute function public.helena_guard_record_write('plano_conta_id');
alter table public.dre_mensal add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.dre_mensal
  for each row execute function public.helena_guard_record_write('dre_id');
alter table public.protocolo_agentes add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.protocolo_agentes
  for each row execute function public.helena_guard_record_write('protocolo_id');
alter table public.marcos add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.marcos
  for each row execute function public.helena_guard_record_write('milestone_id');
alter table public.configuracao add column row_version bigint not null default nextval('public.helena_record_revision_seq');
create trigger zz_helena_version_guard before insert or update or delete on public.configuracao
  for each row execute function public.helena_guard_record_write('registro_id');

create function public.helena_write_record(
  p_table text, p_id text, p_expected_version bigint,
  p_changes jsonb default '{}'::jsonb, p_delete boolean default false
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  pk text; pk_type text; before_row jsonb; after_row jsonb; changes jsonb;
  assignments text; previous_guard text; field text;
begin
  if p_table is null or not(p_table=any(public.helena_concurrency_tables())) then
    raise exception 'Tabela fora do contrato de escrita protegida' using errcode='22023';
  end if;
  if p_id is null or p_expected_version is null or p_expected_version<1 or p_delete is null
    or jsonb_typeof(p_changes) is distinct from 'object' then
    raise exception 'Identificador, versão lida e alterações válidas são obrigatórios' using errcode='22023';
  end if;
  select a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod) into strict pk,pk_type
    from pg_catalog.pg_constraint c join pg_catalog.pg_class t on t.oid=c.conrelid
    join pg_catalog.pg_namespace ns on ns.oid=t.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid=t.oid and a.attnum=c.conkey[1]
    where ns.nspname='public' and t.relname=p_table and c.contype='p' and cardinality(c.conkey)=1;
  execute format('select to_jsonb(t) from public.%I t where %I=$1::%s for update',p_table,pk,pk_type)
    into before_row using p_id;
  if before_row is null then
    raise exception 'Registro indisponível para este acesso' using errcode='42501';
  end if;
  if (before_row->>'row_version')::bigint<>p_expected_version then
    raise exception 'Outra conversa ou pessoa alterou este registro. Seu rascunho foi preservado; releia e compare antes de salvar.'
      using errcode='40001',hint='CONFLITO_DE_VERSAO: não atualizar a versão e repetir automaticamente.';
  end if;
  if p_delete and p_table=any(array['memoria_mestre','decisoes','auditoria_sistema','helena_guia','protocolo_agentes']) then
    raise exception 'Preserve o histórico: encerre ou substitua o registro, sem excluir' using errcode='42501';
  end if;
  changes:=p_changes;
  if changes ? pk then
    if changes->>pk is distinct from p_id then
      raise exception 'A chave do registro não pode ser alterada' using errcode='22023';
    end if;
    changes:=changes-pk;
  end if;
  for field in select jsonb_object_keys(changes) loop
    if field=any(array['row_version','criado_em','created_at','atualizado_em','updated_at']) or not exists(
      select 1 from pg_catalog.pg_attribute a join pg_catalog.pg_class t on t.oid=a.attrelid
        join pg_catalog.pg_namespace n on n.oid=t.relnamespace
      where n.nspname='public' and t.relname=p_table and a.attname=field and a.attnum>0
        and not a.attisdropped and a.attgenerated='' and a.attidentity=''
    ) then raise exception 'Campo não editável: %',field using errcode='22023'; end if;
  end loop;
  if not p_delete and changes='{}'::jsonb then return before_row; end if;
  previous_guard:=current_setting('helena.write_guard',true);
  perform set_config('helena.write_guard',jsonb_build_object(
    'table',p_table,'id',p_id,'version',p_expected_version::text,
    'operation',case when p_delete then 'DELETE' else 'UPDATE' end
  )::text,true);
  if p_delete then
    execute format('delete from public.%I where %I=$1::%s returning to_jsonb(%I.*)',p_table,pk,pk_type,p_table)
      into after_row using p_id;
  else
    select string_agg(format('%I=(jsonb_populate_record(null::public.%I,$1)).%I',k,p_table,k),', ' order by k)
      into assignments from jsonb_object_keys(changes) k;
    execute format('update public.%I set %s where %I=$2::%s returning to_jsonb(%I.*)',p_table,assignments,pk,pk_type,p_table)
      into after_row using changes,p_id;
  end if;
  perform set_config('helena.write_guard',coalesce(previous_guard,''),true);
  if after_row is null then raise exception 'Alteração não autorizada para este acesso' using errcode='42501'; end if;
  return after_row;
end;
$$;
revoke all on function public.helena_write_record(text,text,bigint,jsonb,boolean) from public, anon;
grant execute on function public.helena_write_record(text,text,bigint,jsonb,boolean) to authenticated, service_role;

comment on function public.helena_write_record(text,text,bigint,jsonb,boolean)
is 'CAS obrigatório: use row_version da leitura que originou a alteração. Em 40001, preservar rascunho e comparar; nunca recarregar versão e repetir silenciosamente. Preserva RLS. Administradores do banco continuam capazes de alterar a estrutura.';

-- Register physical columns in the existing inventory without copying business data.
lock table public.helena_campos in share row exclusive mode;
insert into public.helena_campos (tabela,aba_planilha,coluna,nome_na_planilha,como_usar,chave,calculado)
select c.table_name,
 coalesce((select h.aba_planilha from public.helena_campos h where h.tabela=c.table_name order by h.id limit 1),initcap(c.table_name)),
 c.column_name,'Versão de concorrência','Somente leitura; enviar a versão lida a helena_write_record. Não atualizar e repetir automaticamente após conflito.','NAO','SIM'
from information_schema.columns c
where c.table_schema='public' and c.column_name='row_version'
 and c.table_name=any(public.helena_concurrency_tables())
 and not exists(select 1 from public.helena_campos h where h.tabela=c.table_name and h.coluna=c.column_name);

-- Calendar projections are derived inside the same transaction as their source.
create function public.helena_calendar_day(p_value text) returns text
language sql immutable set search_path='' as $$
 select case when p_value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then left(p_value,10)
   when p_value ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}' then substring(p_value,7,4)||'-'||substring(p_value,4,2)||'-'||left(p_value,2)
   else null end;
$$;
revoke all on function public.helena_calendar_day(text) from public,anon;
grant execute on function public.helena_calendar_day(text) to authenticated,service_role;

create function public.helena_sync_calendar(p_source text,p_id text,p_expected_version bigint) returns void
language plpgsql security invoker set search_path='' as $$
declare source_row jsonb; plans jsonb; plan jsonb; desired jsonb; existing_row jsonb; day_value text; source_pk text;
begin
 if p_source not in ('tarefas','crm') or p_source is null or p_expected_version is null then
   raise exception 'Fonte e versão obrigatórias para sincronizar a agenda' using errcode='22023';
 end if;
 source_pk:=case when p_source='tarefas' then 'task_id' else 'opportunity_id' end;
 execute format('select to_jsonb(t) from public.%I t where %I=$1 for update',p_source,source_pk)
   into source_row using p_id;
 if source_row is null then raise exception 'Fonte indisponível para este acesso' using errcode='42501'; end if;
 if (source_row->>'row_version')::bigint<>p_expected_version then
   raise exception 'A fonte da agenda mudou. Releia antes de sincronizar.' using errcode='40001';
 end if;
 if p_source='tarefas' then
   day_value:=coalesce(public.helena_calendar_day(source_row->>'prazo'),public.helena_calendar_day(source_row->>'occurrence_date'),public.helena_calendar_day(source_row->>'created_at'));
   plans:=jsonb_build_array(jsonb_build_object('id','EVT-TSK-'||p_id,'day',day_value,'hour','09','end','10','title',source_row->>'tarefa',
      'description',concat_ws(' · ',nullif(source_row->>'status',''),nullif(source_row->>'prioridade',''),nullif(source_row->>'bloqueio',''))));
 else
   plans:=jsonb_build_array(
     jsonb_build_object('id','EVT-CRM-'||p_id||'-PROX','day',public.helena_calendar_day(source_row->>'data_proxima_acao'),'hour','09','end','10',
       'title','Follow-up: '||coalesce(source_row->>'empresa_lead',''),'description',coalesce(source_row->>'proxima_acao','Próxima ação do pipeline')),
     jsonb_build_object('id','EVT-CRM-'||p_id||'-FECH','day',public.helena_calendar_day(source_row->>'fechamento_previsto'),'hour','14','end','15',
       'title','Previsão fechamento: '||coalesce(source_row->>'empresa_lead',''),'description',coalesce(source_row->>'proxima_acao','Data prevista de fechamento')));
 end if;
 for plan in select value from jsonb_array_elements(plans) loop
   select to_jsonb(c) into existing_row from public.calendario c where event_id=plan->>'id' for update;
   if existing_row is not null and (
     existing_row->>'related_object_type' is distinct from p_source or
     existing_row->>'related_object_id' is distinct from p_id
   ) then raise exception 'Identificador da agenda pertence a outra origem' using errcode='23505'; end if;
   if plan->>'day' is null then
     if existing_row is not null then
       perform public.helena_write_record('calendario',plan->>'id',(existing_row->>'row_version')::bigint,'{}',true);
     end if;
     continue;
   end if;
   desired:=jsonb_build_object('event_id',plan->>'id','business_id',source_row->>'business_id',
     'tipo',case when p_source='tarefas' then 'TAREFA' else 'CRM' end,
     'titulo',plan->>'title','descricao',plan->>'description',
     'inicio',(plan->>'day')||'T'||(plan->>'hour')||':00:00',
     'fim',(plan->>'day')||'T'||(plan->>'end')||':00:00',
     'status',case when p_source='tarefas' then coalesce(source_row->>'status','ABERTO') else 'ABERTO' end,
     'related_object_type',p_source,'related_object_id',p_id,'source_system','HELENA');
   if existing_row is null then
     insert into public.calendario(event_id,business_id,tipo,titulo,descricao,inicio,fim,status,related_object_type,related_object_id,source_system)
       select x.event_id,x.business_id,x.tipo,x.titulo,x.descricao,x.inicio,x.fim,x.status,x.related_object_type,x.related_object_id,x.source_system
       from jsonb_populate_record(null::public.calendario,desired) x;
   elsif not(existing_row @> desired) then
     perform public.helena_write_record('calendario',plan->>'id',(existing_row->>'row_version')::bigint,desired,false);
   end if;
 end loop;
end;
$$;
revoke all on function public.helena_sync_calendar(text,text,bigint) from public,anon;
grant execute on function public.helena_sync_calendar(text,text,bigint) to authenticated,service_role;

create function public.helena_project_calendar() returns trigger
language plpgsql security invoker set search_path='' as $$
declare source_id text; event_row record;
begin
 if TG_OP='DELETE' then
   source_id:=to_jsonb(OLD)->>TG_ARGV[0];
   for event_row in select event_id,row_version from public.calendario
     where related_object_type=TG_TABLE_NAME and related_object_id=source_id order by event_id for update loop
     perform public.helena_write_record('calendario',event_row.event_id,event_row.row_version,'{}',true);
   end loop;
   return OLD;
 end if;
 source_id:=to_jsonb(NEW)->>TG_ARGV[0];
 perform public.helena_sync_calendar(TG_TABLE_NAME,source_id,NEW.row_version);
 return NEW;
end;
$$;
revoke all on function public.helena_project_calendar() from public,anon,authenticated;
create trigger helena_calendar_projection after insert or update or delete on public.tarefas
 for each row execute function public.helena_project_calendar('task_id');
create trigger helena_calendar_projection after insert or update or delete on public.crm
 for each row execute function public.helena_project_calendar('opportunity_id');

-- History cannot be replaced or removed through routine SQL/API writes.
create function public.helena_append_only() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 raise exception 'Histórico imutável: acrescente um novo registro de correção' using errcode='42501';
end;
$$;
revoke all on function public.helena_append_only() from public,anon,authenticated;
create trigger helena_audit_append_only before update or delete on public.auditoria
 for each row execute function public.helena_append_only();
create trigger helena_task_history_append_only before update or delete on public.task_activity
 for each row execute function public.helena_append_only();
create trigger helena_job_history_append_only before update or delete on public.agent_job_events
 for each row execute function public.helena_append_only();

-- Prevent two conversations from publishing a checkpoint based on the same predecessor.
create unique index helena_one_active_checkpoint on public.checkpoint_mestre(status) where status='ATIVO';
create unique index helena_one_executive_focus on public.foco_executivo(status) where status='EM EXECUÇÃO';
create function public.helena_guard_checkpoint() returns trigger
language plpgsql security invoker set search_path='' as $$
declare expected text;
begin
 expected:=nullif(current_setting('helena.checkpoint_predecessor',true),'');
 if expected is null then raise exception 'Use helena_publish_checkpoint com o predecessor lido' using errcode='P0001'; end if;
 if TG_OP='DELETE' then raise exception 'Versões do checkpoint não podem ser excluídas' using errcode='42501'; end if;
 if TG_OP='UPDATE' then
   if OLD.checkpoint_id<>expected or OLD.status<>'ATIVO' or NEW.status<>'SUPERADO'
     or (to_jsonb(NEW)-'status'-'atualizado_em') is distinct from (to_jsonb(OLD)-'status'-'atualizado_em') then
     raise exception 'Checkpoint histórico imutável' using errcode='42501';
   end if;
 elsif NEW.status<>'ATIVO' or NEW.checkpoint_anterior_id is distinct from expected
   or not exists(select 1 from public.checkpoint_mestre c where c.checkpoint_id=expected and c.status='SUPERADO' and c.versao+1=NEW.versao) then
   raise exception 'Predecessor do checkpoint inconsistente' using errcode='40001';
 end if;
 return NEW;
end;
$$;
revoke all on function public.helena_guard_checkpoint() from public,anon,authenticated;
create trigger helena_checkpoint_guard before insert or update or delete on public.checkpoint_mestre
 for each row execute function public.helena_guard_checkpoint();

create function public.helena_publish_checkpoint(
 p_expected_checkpoint_id text,p_titulo text,p_resumo_executivo text,p_conteudo_markdown text,p_snapshot jsonb,
 p_mudancas_desde_anterior jsonb default '[]',p_fontes jsonb default '[]',
 p_criado_por text default 'AGT-01 Helena',p_motivo text default null
) returns public.checkpoint_mestre
language plpgsql security invoker set search_path='' as $$
declare current_id text; result public.checkpoint_mestre; previous_guard text;
begin
 lock table public.checkpoint_mestre in share row exclusive mode;
 select checkpoint_id into current_id from public.checkpoint_mestre where status='ATIVO';
 if p_expected_checkpoint_id is null or current_id is distinct from p_expected_checkpoint_id then
   raise exception 'Outro chat publicou um checkpoint. Releia e reconcilie antes de publicar.' using errcode='40001';
 end if;
 previous_guard:=current_setting('helena.checkpoint_predecessor',true);
 perform set_config('helena.checkpoint_predecessor',current_id,true);
 select * into result from public.registrar_checkpoint_mestre(
   p_titulo,p_resumo_executivo,p_conteudo_markdown,p_snapshot,p_mudancas_desde_anterior,p_fontes,p_criado_por,p_motivo);
 perform set_config('helena.checkpoint_predecessor',coalesce(previous_guard,''),true);
 return result;
end;
$$;
revoke all on function public.helena_publish_checkpoint(text,text,text,text,jsonb,jsonb,jsonb,text,text) from public,anon;
grant execute on function public.helena_publish_checkpoint(text,text,text,text,jsonb,jsonb,jsonb,text,text) to authenticated,service_role;

notify pgrst,'reload schema';
