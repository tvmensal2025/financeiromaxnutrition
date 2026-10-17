-- Tabela TEMPORÁRIA de transporte: só INSERT pela API (anon); RLS ligado; apagada em limpar.sql.
create table if not exists public.helena_v2_instalacao_pedacos (
  arquivo text not null, parte integer not null, conteudo text not null,
  criado_em timestamptz not null default now(), primary key (arquivo, parte));
alter table public.helena_v2_instalacao_pedacos enable row level security;
grant insert on public.helena_v2_instalacao_pedacos to anon;
drop policy if exists transporte_insere on public.helena_v2_instalacao_pedacos;
create policy transporte_insere on public.helena_v2_instalacao_pedacos for insert to anon with check (true);
