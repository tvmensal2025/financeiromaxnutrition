-- Completa o mapa físico e a leitura de supervisão; não executa jobs.
create policy helena_supervisao_select on public.agent_jobs
  for select to authenticated using (public.user_has_business_access(business_id));
create policy helena_supervisao_select on public.agent_job_events
  for select to authenticated using (public.user_has_business_access(business_id));
create policy helena_supervisao_select on public.notification_outbox
  for select to authenticated using (public.user_has_business_access(business_id));
create policy helena_supervisao_select on public.processos
  for select to authenticated using (public.user_has_business_access(business_id));
grant select on public.agent_jobs, public.agent_job_events, public.notification_outbox, public.processos to authenticated;

-- Preserva os rótulos e regras existentes. Campos novos são de consulta.
lock table public.helena_campos in share row exclusive mode;
insert into public.helena_campos(tabela,aba_planilha,coluna,nome_na_planilha,chave,calculado,como_usar)
select c.table_name,
  coalesce((select h.aba_planilha from public.helena_campos h where h.tabela=c.table_name order by h.id limit 1),initcap(c.table_name)),
  c.column_name, initcap(replace(c.column_name,'_',' ')),
  case when exists (
    select 1 from pg_constraint k join pg_attribute a on a.attrelid=k.conrelid and a.attnum=any(k.conkey)
    where k.contype='p' and k.conrelid=format('public.%I',c.table_name)::regclass and a.attname=c.column_name
  ) then 'SIM' else 'NAO' end,
  'SIM', 'Mapeamento técnico de consulta. Escrita somente pelo fluxo autorizado da origem; tipo PostgreSQL: ' || c.data_type
from information_schema.columns c
where c.table_schema='public'
  and not exists(select 1 from public.helena_campos h where h.tabela=c.table_name and h.coluna=c.column_name)
order by c.table_name,c.ordinal_position;

create or replace function public.helena_auditar_cobertura()
returns jsonb
language plpgsql stable security invoker
set search_path = pg_catalog, public
set statement_timeout = '15s'
as $fn$
declare
  r record; v_total bigint; v_error text; v_columns jsonb;
  v_sources jsonb := '[]'::jsonb; v_counts jsonb := '{}'::jsonb;
  v_checkpoint jsonb; v_differences jsonb; v_integrity jsonb;
begin
  if not public.is_founder() then
    raise exception 'A auditoria consolidada exige fundador ativo.' using errcode='42501';
  end if;
  for r in
    select c.oid,c.relname,c.relkind,c.relrowsecurity,
      coalesce(c.reloptions,'{}') @> array['security_invoker=true'] as invoker
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p','v','m')
    order by c.relname
  loop
    v_total := null; v_error := null;
    begin
      execute format('select count(*) from public.%I',r.relname) into v_total;
    exception when insufficient_privilege then
      v_error := '42501';
    end;
    select jsonb_agg(jsonb_build_object(
      'nome',a.attname,'tipo',format_type(a.atttypid,a.atttypmod),
      'mapeado',exists(select 1 from public.helena_campos h where h.tabela=r.relname and h.coluna=a.attname)
    ) order by a.attnum) into v_columns
    from pg_attribute a where a.attrelid=r.oid and a.attnum>0 and not a.attisdropped;
    v_sources := v_sources || jsonb_build_array(jsonb_build_object(
      'tabela',r.relname,'tipo',case when r.relkind in ('v','m') then 'view' else 'tabela' end,
      'rls',r.relrowsecurity,'security_invoker',r.invoker,'registros',v_total,'erro',v_error,
      'politicas_leitura',(select count(*) from pg_policies p where p.schemaname='public' and p.tablename=r.relname and p.cmd in ('SELECT','ALL') and p.roles && array['authenticated','public']::name[]),
      'colunas',coalesce(v_columns,'[]'::jsonb)
    ));
    v_counts := v_counts || jsonb_build_object(r.relname,v_total);
  end loop;

  select jsonb_build_object('id',checkpoint_id,'versao',versao,'atualizado_em',atualizado_em,'contagens',snapshot->'contagens')
  into v_checkpoint from public.checkpoint_mestre_atual limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('tabela',k.key,'checkpoint',k.value,'atual',v_counts->k.key)),'[]'::jsonb)
  into v_differences
  from jsonb_each(coalesce(v_checkpoint->'contagens','{}'::jsonb)) k
  where v_counts ? k.key and k.value is distinct from v_counts->k.key;

  v_integrity := jsonb_build_object(
    'jobs_sem_tarefa',(select count(*) from public.agent_jobs j where j.task_id is not null and not exists(select 1 from public.tarefas t where t.task_id=j.task_id)),
    'jobs_sem_agente',(select count(*) from public.agent_jobs j where not exists(select 1 from public.agentes a where a.agent_id=j.agent_id)),
    'eventos_sem_job',(select count(*) from public.agent_job_events e where e.job_id is not null and not exists(select 1 from public.agent_jobs j where j.job_id=e.job_id)),
    'tarefas_sem_projeto',(select count(*) from public.tarefas t where t.project_id like 'PRJ-%' and not exists(select 1 from public.projetos p where p.project_id=t.project_id)),
    'tarefas_sem_empresa',(select count(*) from public.tarefas t where t.business_id like 'BIZ-%' and not exists(select 1 from public.portfolio p where p.business_id=t.business_id)),
    'jobs_empresa_divergente',(select count(*) from public.agent_jobs j join public.tarefas t on t.task_id=j.task_id where j.business_id is distinct from t.business_id),
    'eventos_empresa_divergente',(select count(*) from public.agent_job_events e join public.agent_jobs j on j.job_id=e.job_id where e.business_id is distinct from j.business_id)
  );
  return jsonb_build_object('verificado_em',statement_timestamp(),'fontes',v_sources,
    'checkpoint',v_checkpoint,'divergencias_checkpoint',v_differences,'integridade',v_integrity,
    'campos_obsoletos',(select count(*) from public.helena_campos h where not exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=h.tabela and c.column_name=h.coluna)));
end;
$fn$;
revoke all on function public.helena_auditar_cobertura() from public, anon;
grant execute on function public.helena_auditar_cobertura() to authenticated;
comment on function public.helena_auditar_cobertura() is 'Auditoria somente leitura do catálogo, mapeamento, contagens visíveis e vínculos. Restrita ao fundador. Não mede consumo do Grok nem comprova ações externas.';
