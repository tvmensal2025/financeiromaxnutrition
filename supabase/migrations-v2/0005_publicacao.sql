-- O que é: pedido de publicação da V2 e resposta durável do executor. Não publica nem chama serviços externos.
-- A pessoa do fundador é conferida no cadastro existente do app com o JWT autenticado.

create or replace function helena_v2.sou_fundador() returns boolean
language sql stable security definer set search_path = pg_catalog, pg_temp as $f$
  select helena_v2._conta() = 'authenticated'
     and auth.uid() is not null
     and exists (select 1 from public.app_access a
                 where a.user_id = auth.uid() and a.role = 'founder' and a.active = true);
$f$;

create table helena_v2.publicacoes (
  id bigint generated always as identity primary key,
  solicitado_por uuid not null,
  pedido_em timestamptz not null,
  dia_brasilia date not null unique
);
create index publicacoes_por_pessoa on helena_v2.publicacoes (solicitado_por, pedido_em desc);
alter table helena_v2.publicacoes enable row level security;
create policy publicacoes_do_fundador on helena_v2.publicacoes for select to authenticated
  using (solicitado_por = auth.uid() and helena_v2.sou_fundador());

create or replace function helena_v2.situacao_publicacao() returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare
  v_dia date := (now() at time zone 'America/Sao_Paulo')::date;
  v_pedido jsonb;
begin
  if not helena_v2.sou_fundador() then
    return jsonb_build_object('fundador', false, 'dia_brasilia', v_dia, 'pedido', null);
  end if;
  select jsonb_build_object('id', p.id, 'pedido_em', p.pedido_em, 'dia_brasilia', p.dia_brasilia)
    into v_pedido from helena_v2.publicacoes p where p.dia_brasilia = v_dia;
  return jsonb_build_object('fundador', true, 'dia_brasilia', v_dia, 'pedido', v_pedido);
end;
$f$;

create or replace function helena_v2.pedir_publicacao() returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare
  v_agora timestamptz := clock_timestamp();
  v_dia date := (v_agora at time zone 'America/Sao_Paulo')::date;
  v_pedido jsonb;
  v_novo boolean := false;
begin
  if not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  insert into helena_v2.publicacoes (solicitado_por, pedido_em, dia_brasilia)
    values (auth.uid(), v_agora, v_dia) on conflict (dia_brasilia) do nothing;
  v_novo := found;
  select jsonb_build_object('id', p.id, 'pedido_em', p.pedido_em, 'dia_brasilia', p.dia_brasilia)
    into v_pedido from helena_v2.publicacoes p where p.dia_brasilia = v_dia;
  return jsonb_build_object('fundador', true, 'dia_brasilia', v_dia, 'pedido', v_pedido,
                            'ja_usado_hoje', not v_novo);
end;
$f$;

-- Só o fundador lê os dados que a tela do card consome; o motor conserva leitura pelo service_role.
alter table helena_v2.card enable row level security;
alter table helena_v2.etapa enable row level security;
alter table helena_v2.entrega enable row level security;
create policy card_fundador on helena_v2.card for select to authenticated using (helena_v2.sou_fundador());
create policy etapa_fundador on helena_v2.etapa for select to authenticated using (helena_v2.sou_fundador());
create policy entrega_fundador on helena_v2.entrega for select to authenticated using (helena_v2.sou_fundador());
create policy card_motor on helena_v2.card for select to service_role using (true);
create policy etapa_motor on helena_v2.etapa for select to service_role using (true);
create policy entrega_motor on helena_v2.entrega for select to service_role using (true);

-- Resposta gravada antes do portão 1. O número é a chave da execução, e o conteúdo é imutável.
create table helena_v2.resposta_execucao (
  numero bigint primary key references helena_v2.execucao(numero),
  resposta jsonb not null,
  gravada_em timestamptz not null default clock_timestamp()
);

create or replace function helena_v2.registrar_resposta_execucao(p_numero bigint, p_resposta jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare
  v_resposta jsonb;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  if p_resposta is null then
    raise exception 'RESPOSTA_VAZIA' using errcode = '22023';
  end if;
  perform 1 from helena_v2.execucao x join helena_v2.etapa e on e.id = x.etapa_id
    where x.numero = p_numero and x.tipo in ('AUTOR', 'REVISOR') and x.estado = 'VIVA'
      and e.execucao_atual = x.numero
      and ((x.tipo = 'AUTOR' and e.estado = 'EXECUTANDO')
        or (x.tipo = 'REVISOR' and e.estado = 'REVISAO')) for update of x;
  if not found then
    raise exception 'EXECUCAO_NAO_ATUAL' using errcode = '42501';
  end if;
  insert into helena_v2.resposta_execucao (numero, resposta) values (p_numero, p_resposta)
    on conflict (numero) do nothing;
  select r.resposta into v_resposta from helena_v2.resposta_execucao r where r.numero = p_numero;
  if v_resposta is distinct from p_resposta then
    raise exception 'RESPOSTA_JA_REGISTRADA' using errcode = '42501';
  end if;
  return v_resposta;
end;
$f$;

create or replace function helena_v2.ler_resposta_execucao(p_numero bigint) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare v_resposta jsonb;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  select r.resposta into v_resposta from helena_v2.resposta_execucao r where r.numero = p_numero;
  return v_resposta;
end;
$f$;

revoke all on helena_v2.publicacoes, helena_v2.resposta_execucao from public, anon, authenticated, service_role;
revoke all on function helena_v2.sou_fundador(), helena_v2.situacao_publicacao(),
  helena_v2.pedir_publicacao(), helena_v2.registrar_resposta_execucao(bigint,jsonb),
  helena_v2.ler_resposta_execucao(bigint) from public, anon, authenticated, service_role;
grant select on helena_v2.publicacoes to authenticated;
grant select on helena_v2.card, helena_v2.etapa, helena_v2.entrega to authenticated;
grant execute on function helena_v2.sou_fundador(), helena_v2.situacao_publicacao(),
  helena_v2.pedir_publicacao() to authenticated;
grant execute on function helena_v2.registrar_resposta_execucao(bigint,jsonb),
  helena_v2.ler_resposta_execucao(bigint) to service_role;
