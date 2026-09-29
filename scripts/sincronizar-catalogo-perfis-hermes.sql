-- Executar uma vez apos a migracao de agent_runtime_bindings.
-- O catalogo Helena lista campos existentes; nao concede permissao de escrita.
insert into public.helena_campos
  (tabela, aba_planilha, coluna, nome_na_planilha, chave, calculado, como_usar)
select
  c.table_name,
  'Agent_Runtime_Bindings',
  c.column_name,
  initcap(replace(c.column_name, '_', ' ')),
  case when c.column_name in ('agent_id', 'scope_key') then 'SIM' else 'NAO' end,
  'SIM',
  'Mapeamento tecnico de consulta. Perfil Hermes por agente e escopo; ativacao somente pelo fluxo autorizado. Tipo PostgreSQL: ' || c.data_type
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'agent_runtime_bindings'
  and not exists (
    select 1 from public.helena_campos h
    where h.tabela = c.table_name and h.coluna = c.column_name
  );
