-- O que é: Recebimento durável da entrada comum. Ainda não cria card, tarefa, job ou proposta de IA.
-- A origem é uma declaração do cliente autenticado, não prova de pareamento de canal.

create table helena_v2.pedido_entrada (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  fundador_uid uuid not null,
  estado text not null default 'RECEBIDO' check (estado = 'RECEBIDO'),
  criado_em timestamptz not null default clock_timestamp(),
  atualizado_em timestamptz not null default clock_timestamp()
);
create index pedido_entrada_por_fundador on helena_v2.pedido_entrada
  (fundador_uid, atualizado_em desc, id desc);

create table helena_v2.pedido_entrada_evento (
  id bigint generated always as identity primary key,
  pedido_id uuid not null references helena_v2.pedido_entrada(id),
  fundador_uid uuid not null,
  origem text not null check (origem in ('SITE', 'CODEX', 'TELEGRAM')),
  evento_id text not null check (char_length(evento_id) between 1 and 160
    and evento_id ~ '[^[:space:]]'),
  texto text not null check (char_length(texto) between 1 and 10000
    and texto ~ '[^[:space:]]'),
  recebido_em timestamptz not null default clock_timestamp(),
  unique (fundador_uid, origem, evento_id)
);
create index pedido_entrada_evento_por_pedido on helena_v2.pedido_entrada_evento (pedido_id, id);

alter table helena_v2.pedido_entrada enable row level security;
alter table helena_v2.pedido_entrada_evento enable row level security;
-- Sem políticas ou concessões diretas: somente as RPCs abaixo atravessam as tabelas.

create function helena_v2._resumo_pedido_entrada(p_pedido_id uuid, p_com_eventos boolean)
returns jsonb language sql stable security definer set search_path = pg_catalog, pg_temp as $f$
  select jsonb_build_object(
    'pedido_id', p.id, 'request_id', p.request_id, 'estado', p.estado,
    'texto_inicial', primeiro.texto, 'origem_inicial', primeiro.origem,
    'total_eventos', (select count(*) from helena_v2.pedido_entrada_evento e where e.pedido_id = p.id),
    'criado_em', p.criado_em, 'atualizado_em', p.atualizado_em,
    'perguntas', '[]'::jsonb, 'proposta_helena', null,
    'empresa_id', null, 'empresa_confirmada', false,
    'config_revision_id', null, 'card_id', null
  ) || case when p_com_eventos then jsonb_build_object(
    'eventos', coalesce((select jsonb_agg(jsonb_build_object(
      'origem', e.origem, 'evento_id', e.evento_id, 'texto', e.texto,
      'recebido_em', e.recebido_em) order by e.id)
      from helena_v2.pedido_entrada_evento e where e.pedido_id = p.id), '[]'::jsonb)
  ) else '{}'::jsonb end
  from helena_v2.pedido_entrada p
  left join lateral (
    select e.texto, e.origem from helena_v2.pedido_entrada_evento e
    where e.pedido_id = p.id order by e.id limit 1
  ) primeiro on true
  where p.id = p_pedido_id;
$f$;

create function helena_v2.receber_pedido_entrada(
  p_request_id uuid, p_origem text, p_evento_id text, p_texto text
) returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, pg_temp as $f$
declare
  v_uid uuid := auth.uid();
  v_pedido_id uuid;
  v_dono uuid;
  v_request_existente uuid;
  v_texto_existente text;
  v_evento_id bigint;
  v_novo_pedido boolean := false;
  v_novo_evento boolean := false;
begin
  if v_uid is null or not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  if p_request_id is null or p_origem is null or p_evento_id is null or p_texto is null
     or p_origem not in ('SITE', 'CODEX', 'TELEGRAM')
     or char_length(p_evento_id) not between 1 and 160
     or p_evento_id !~ '[^[:space:]]'
     or char_length(p_texto) not between 1 and 10000
     or p_texto !~ '[^[:space:]]' then
    raise exception 'ENTRADA_INVALIDA' using errcode = '22023';
  end if;

  -- A chave do canal é independente do request_id. Reenvio idêntico recebe o mesmo pedido;
  -- trocar texto ou request_id sob a mesma chave é conflito, nunca uma nova ordem.
  select e.pedido_id, p.request_id, e.texto
    into v_pedido_id, v_request_existente, v_texto_existente
    from helena_v2.pedido_entrada_evento e
    join helena_v2.pedido_entrada p on p.id = e.pedido_id
    where e.fundador_uid = v_uid and e.origem = p_origem and e.evento_id = p_evento_id;
  if found then
    if v_request_existente is distinct from p_request_id
       or v_texto_existente is distinct from p_texto then
      raise exception 'ENTRADA_EVENTO_DIVERGENTE' using errcode = '23505';
    end if;
    return helena_v2._resumo_pedido_entrada(v_pedido_id, false)
      || jsonb_build_object('novo_pedido', false, 'novo_evento', false);
  end if;

  insert into helena_v2.pedido_entrada (request_id, fundador_uid)
    values (p_request_id, v_uid) on conflict (request_id) do nothing
    returning id into v_pedido_id;
  v_novo_pedido := found;
  if not v_novo_pedido then
    select p.id, p.fundador_uid into v_pedido_id, v_dono
      from helena_v2.pedido_entrada p where p.request_id = p_request_id for update;
    if v_dono is distinct from v_uid then
      raise exception 'ENTRADA_REQUEST_ID_INDISPONIVEL' using errcode = '23505';
    end if;
  end if;

  insert into helena_v2.pedido_entrada_evento
    (pedido_id, fundador_uid, origem, evento_id, texto)
    values (v_pedido_id, v_uid, p_origem, p_evento_id, p_texto)
    on conflict (fundador_uid, origem, evento_id) do nothing
    returning id into v_evento_id;
  v_novo_evento := found;
  if not v_novo_evento then
    select e.pedido_id, e.texto into v_pedido_id, v_texto_existente
      from helena_v2.pedido_entrada_evento e
      where e.fundador_uid = v_uid and e.origem = p_origem and e.evento_id = p_evento_id;
    if v_pedido_id is distinct from
       (select p.id from helena_v2.pedido_entrada p where p.request_id = p_request_id)
       or v_texto_existente is distinct from p_texto then
      raise exception 'ENTRADA_EVENTO_DIVERGENTE' using errcode = '23505';
    end if;
  else
    update helena_v2.pedido_entrada p
      set atualizado_em = greatest(p.atualizado_em, clock_timestamp())
      where p.id = v_pedido_id;
  end if;
  return helena_v2._resumo_pedido_entrada(v_pedido_id, false)
    || jsonb_build_object('novo_pedido', v_novo_pedido, 'novo_evento', v_novo_evento);
end;
$f$;

create function helena_v2.ler_pedido_entrada(p_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare v_pedido_id uuid;
begin
  if auth.uid() is null or not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'ENTRADA_INVALIDA' using errcode = '22023';
  end if;
  select p.id into v_pedido_id from helena_v2.pedido_entrada p
    where p.request_id = p_request_id and p.fundador_uid = auth.uid();
  if not found then return null; end if;
  return helena_v2._resumo_pedido_entrada(v_pedido_id, true);
end;
$f$;

create function helena_v2.listar_pedidos_entrada(p_limite integer default 50) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare v_itens jsonb;
begin
  if auth.uid() is null or not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  if p_limite is null or p_limite not between 1 and 100 then
    raise exception 'LIMITE_INVALIDO' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(helena_v2._resumo_pedido_entrada(p.id, false)
    order by p.atualizado_em desc, p.id desc), '[]'::jsonb)
    into v_itens from (
      select id, atualizado_em from helena_v2.pedido_entrada
      where fundador_uid = auth.uid()
      order by atualizado_em desc, id desc limit p_limite
    ) p;
  return jsonb_build_object('limite', p_limite, 'itens', v_itens);
end;
$f$;

revoke all on helena_v2.pedido_entrada, helena_v2.pedido_entrada_evento from public, anon, authenticated, service_role;
revoke all on sequence helena_v2.pedido_entrada_evento_id_seq from public, anon, authenticated, service_role;
revoke all on function helena_v2._resumo_pedido_entrada(uuid,boolean),
  helena_v2.receber_pedido_entrada(uuid,text,text,text),
  helena_v2.ler_pedido_entrada(uuid), helena_v2.listar_pedidos_entrada(integer)
  from public, anon, authenticated, service_role;
grant execute on function helena_v2.receber_pedido_entrada(uuid,text,text,text),
  helena_v2.ler_pedido_entrada(uuid), helena_v2.listar_pedidos_entrada(integer)
  to authenticated;
