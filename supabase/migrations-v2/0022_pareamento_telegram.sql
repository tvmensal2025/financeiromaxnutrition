-- O que é: Telegram entra só por um vínculo criado pelo fundador no site e consumido pelo backend.
-- O código é aleatório (192 bits), vence em 10 minutos e só seu SHA-256 fica no banco.
-- Origem, chat privado e autenticidade do webhook também são conferidos pela Edge Function.

create table helena_v2.telegram_pareamento_codigo (
  fundador_uid uuid primary key,
  codigo_hash bytea not null unique,
  gerado_em timestamptz not null,
  expira_em timestamptz not null check (expira_em > gerado_em)
);

create table helena_v2.telegram_vinculo (
  id bigint generated always as identity primary key,
  fundador_uid uuid not null,
  chat_id bigint not null check (chat_id > 0),
  usuario_id bigint not null check (usuario_id > 0 and usuario_id = chat_id),
  vinculado_em timestamptz not null default clock_timestamp(),
  revogado_em timestamptz,
  check (revogado_em is null or revogado_em >= vinculado_em)
);
create unique index telegram_vinculo_fundador_ativo on helena_v2.telegram_vinculo (fundador_uid)
  where revogado_em is null;
create unique index telegram_vinculo_chat_ativo on helena_v2.telegram_vinculo (chat_id)
  where revogado_em is null;
create unique index telegram_vinculo_usuario_ativo on helena_v2.telegram_vinculo (usuario_id)
  where revogado_em is null;

-- update_id é único por bot, inclusive depois de revogar e parear com outra pessoa.
-- O request_id fica aqui para recuperar exatamente o UUID gerado num reenvio sem UUID.
create table helena_v2.telegram_update_recebido (
  update_id bigint primary key check (update_id > 0),
  fundador_uid uuid not null,
  chat_id bigint not null,
  usuario_id bigint not null,
  mensagem_id bigint not null check (mensagem_id > 0),
  texto text not null,
  request_id uuid not null,
  recebido_em timestamptz not null default clock_timestamp()
);

alter table helena_v2.telegram_pareamento_codigo enable row level security;
alter table helena_v2.telegram_vinculo enable row level security;
alter table helena_v2.telegram_update_recebido enable row level security;

-- A implementação de 0021 passa a aceitar uma identidade explícita APENAS por esta porta
-- privada. Ela é invoker; as duas RPCs SECURITY DEFINER fazem os checks de identidade.
create function helena_v2._receber_pedido_explicit_uid(
  p_fundador_uid uuid, p_request_id uuid, p_origem text, p_evento_id text, p_texto text
) returns jsonb language plpgsql volatile set search_path = pg_catalog, pg_temp as $f$
declare
  v_pedido_id uuid;
  v_dono uuid;
  v_request_existente uuid;
  v_texto_existente text;
  v_evento_id bigint;
  v_novo_pedido boolean := false;
  v_novo_evento boolean := false;
begin
  if p_fundador_uid is null or p_request_id is null or p_origem is null
     or p_evento_id is null or p_texto is null
     or p_origem not in ('SITE', 'CODEX', 'TELEGRAM')
     or char_length(p_evento_id) not between 1 and 160
     or p_evento_id !~ '[^[:space:]]'
     or char_length(p_texto) not between 1 and 10000
     or p_texto !~ '[^[:space:]]' then
    raise exception 'ENTRADA_INVALIDA' using errcode = '22023';
  end if;

  select e.pedido_id, p.request_id, e.texto
    into v_pedido_id, v_request_existente, v_texto_existente
    from helena_v2.pedido_entrada_evento e
    join helena_v2.pedido_entrada p on p.id = e.pedido_id
    where e.fundador_uid = p_fundador_uid and e.origem = p_origem and e.evento_id = p_evento_id;
  if found then
    if v_request_existente is distinct from p_request_id
       or v_texto_existente is distinct from p_texto then
      raise exception 'ENTRADA_EVENTO_DIVERGENTE' using errcode = '23505';
    end if;
    return helena_v2._resumo_pedido_entrada(v_pedido_id, false)
      || jsonb_build_object('novo_pedido', false, 'novo_evento', false);
  end if;

  insert into helena_v2.pedido_entrada (request_id, fundador_uid)
    values (p_request_id, p_fundador_uid) on conflict (request_id) do nothing
    returning id into v_pedido_id;
  v_novo_pedido := found;
  if not v_novo_pedido then
    select p.id, p.fundador_uid into v_pedido_id, v_dono
      from helena_v2.pedido_entrada p where p.request_id = p_request_id for update;
    if v_dono is distinct from p_fundador_uid then
      raise exception 'ENTRADA_REQUEST_ID_INDISPONIVEL' using errcode = '23505';
    end if;
  end if;

  insert into helena_v2.pedido_entrada_evento
    (pedido_id, fundador_uid, origem, evento_id, texto)
    values (v_pedido_id, p_fundador_uid, p_origem, p_evento_id, p_texto)
    on conflict (fundador_uid, origem, evento_id) do nothing
    returning id into v_evento_id;
  v_novo_evento := found;
  if not v_novo_evento then
    select e.pedido_id, e.texto into v_pedido_id, v_texto_existente
      from helena_v2.pedido_entrada_evento e
      where e.fundador_uid = p_fundador_uid and e.origem = p_origem and e.evento_id = p_evento_id;
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

create or replace function helena_v2.receber_pedido_entrada(
  p_request_id uuid, p_origem text, p_evento_id text, p_texto text
) returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, pg_temp as $f$
begin
  if auth.uid() is null or not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  return helena_v2._receber_pedido_explicit_uid(
    auth.uid(), p_request_id, p_origem, p_evento_id, p_texto);
end;
$f$;

create function helena_v2._estado_pareamento_telegram(p_fundador_uid uuid) returns jsonb
language sql volatile security definer set search_path = pg_catalog, pg_temp as $f$
  select jsonb_build_object(
    'vinculado', v.id is not null,
    'chat_id', v.chat_id::text, 'usuario_id', v.usuario_id::text,
    'vinculado_em', v.vinculado_em,
    'codigo_pendente', c.fundador_uid is not null,
    'codigo_expira_em', c.expira_em
  ) from (select p_fundador_uid as fundador_uid) base
  left join helena_v2.telegram_vinculo v
    on v.fundador_uid = base.fundador_uid and v.revogado_em is null
  left join helena_v2.telegram_pareamento_codigo c
    on c.fundador_uid = base.fundador_uid and c.expira_em > clock_timestamp() and v.id is null;
$f$;

create function helena_v2.gerar_pareamento_telegram() returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare
  v_uid uuid := auth.uid();
  v_codigo text;
  v_agora timestamptz := clock_timestamp();
begin
  if v_uid is null or not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  -- Ordem única dos locks: app_access, código, vínculo. Evita gerar código já inútil
  -- enquanto a Edge consome o anterior ou o fundador revoga.
  perform 1 from public.app_access a
    where a.user_id = v_uid and a.role = 'founder' and a.active = true for update;
  if not found then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  perform 1 from helena_v2.telegram_vinculo
    where fundador_uid = v_uid and revogado_em is null for share;
  if found then
    raise exception 'PAREAMENTO_JA_VINCULADO' using errcode = '23505';
  end if;
  v_codigo := encode(extensions.gen_random_bytes(24), 'hex');
  insert into helena_v2.telegram_pareamento_codigo
    (fundador_uid, codigo_hash, gerado_em, expira_em)
    values (v_uid, extensions.digest(v_codigo, 'sha256'), v_agora, v_agora + interval '10 minutes')
    on conflict (fundador_uid) do update
      set codigo_hash = excluded.codigo_hash, gerado_em = excluded.gerado_em,
          expira_em = excluded.expira_em;
  return jsonb_build_object('codigo', v_codigo, 'expira_em', v_agora + interval '10 minutes');
end;
$f$;

create function helena_v2.consultar_pareamento_telegram() returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
begin
  if auth.uid() is null or not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  return helena_v2._estado_pareamento_telegram(auth.uid());
end;
$f$;

create function helena_v2.revogar_pareamento_telegram() returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  perform 1 from public.app_access a
    where a.user_id = v_uid and a.role = 'founder' and a.active = true for update;
  if not found then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode = '42501';
  end if;
  delete from helena_v2.telegram_pareamento_codigo where fundador_uid = v_uid;
  update helena_v2.telegram_vinculo
    set revogado_em = clock_timestamp()
    where fundador_uid = v_uid and revogado_em is null;
  return helena_v2._estado_pareamento_telegram(v_uid);
end;
$f$;

create function helena_v2.vincular_telegram(
  p_codigo text, p_chat_id bigint, p_usuario_id bigint
) returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, pg_temp as $f$
declare
  v_codigo helena_v2.telegram_pareamento_codigo;
  v_vinculo helena_v2.telegram_vinculo;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode = '42501';
  end if;
  if p_chat_id is null or p_usuario_id is null or p_chat_id <= 0
     or p_chat_id is distinct from p_usuario_id then
    raise exception 'PAREAMENTO_INVALIDO' using errcode = '22023';
  end if;
  if p_codigo is null or p_codigo !~ '^[0-9a-f]{48}$' then
    raise exception 'PAREAMENTO_NAO_VALIDO' using errcode = '42501';
  end if;
  -- Descobre o fundador sem travar o código; depois trava app_access antes do código.
  select * into v_codigo from helena_v2.telegram_pareamento_codigo
    where codigo_hash = extensions.digest(p_codigo, 'sha256');
  if not found then
    raise exception 'PAREAMENTO_NAO_VALIDO' using errcode = '42501';
  end if;
  perform 1 from public.app_access a
    where a.user_id = v_codigo.fundador_uid and a.role = 'founder' and a.active = true
    for update;
  if not found then
    raise exception 'PAREAMENTO_NAO_VALIDO' using errcode = '42501';
  end if;
  select * into v_codigo from helena_v2.telegram_pareamento_codigo
    where codigo_hash = extensions.digest(p_codigo, 'sha256') for update;
  if not found or v_codigo.expira_em <= clock_timestamp() then
    raise exception 'PAREAMENTO_NAO_VALIDO' using errcode = '42501';
  end if;
  begin
    insert into helena_v2.telegram_vinculo (fundador_uid, chat_id, usuario_id)
      values (v_codigo.fundador_uid, p_chat_id, p_usuario_id)
      returning * into v_vinculo;
  exception when unique_violation then
    raise exception 'PAREAMENTO_NAO_VALIDO' using errcode = '42501';
  end;
  delete from helena_v2.telegram_pareamento_codigo
    where fundador_uid = v_codigo.fundador_uid;
  return jsonb_build_object('vinculado', true, 'chat_id', v_vinculo.chat_id::text,
    'usuario_id', v_vinculo.usuario_id::text, 'vinculado_em', v_vinculo.vinculado_em);
end;
$f$;

create function helena_v2.receber_pedido_telegram(
  p_chat_id bigint, p_usuario_id bigint, p_update_id bigint,
  p_mensagem_id bigint, p_texto text, p_request_id uuid default null
) returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, pg_temp as $f$
declare
  v_uid uuid;
  v_update helena_v2.telegram_update_recebido;
  v_request_id uuid;
  v_novo_update boolean;
  v_recibo jsonb;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode = '42501';
  end if;
  if p_chat_id is null or p_usuario_id is null or p_update_id is null
     or p_mensagem_id is null or p_texto is null
     or p_chat_id <= 0 or p_chat_id is distinct from p_usuario_id
     or p_update_id <= 0 or p_mensagem_id <= 0
     or char_length(p_texto) not between 1 and 10000
     or p_texto !~ '[^[:space:]]' then
    raise exception 'TELEGRAM_ENTRADA_INVALIDA' using errcode = '22023';
  end if;

  -- Primeiro a identidade, depois o vínculo: mesma ordem da geração/revogação.
  select v.fundador_uid into v_uid from helena_v2.telegram_vinculo v
    where v.chat_id = p_chat_id and v.usuario_id = p_usuario_id and v.revogado_em is null;
  if not found then
    raise exception 'TELEGRAM_NAO_VINCULADO' using errcode = '42501';
  end if;
  perform 1 from public.app_access a
    where a.user_id = v_uid and a.role = 'founder' and a.active = true for share;
  if not found then
    raise exception 'TELEGRAM_NAO_VINCULADO' using errcode = '42501';
  end if;
  perform 1 from helena_v2.telegram_vinculo v
    where v.fundador_uid = v_uid and v.chat_id = p_chat_id
      and v.usuario_id = p_usuario_id and v.revogado_em is null for share;
  if not found then
    raise exception 'TELEGRAM_NAO_VINCULADO' using errcode = '42501';
  end if;

  v_request_id := coalesce(p_request_id, gen_random_uuid());
  insert into helena_v2.telegram_update_recebido
    (update_id, fundador_uid, chat_id, usuario_id, mensagem_id, texto, request_id)
    values (p_update_id, v_uid, p_chat_id, p_usuario_id, p_mensagem_id, p_texto, v_request_id)
    on conflict (update_id) do nothing;
  v_novo_update := found;
  if not v_novo_update then
    select * into v_update from helena_v2.telegram_update_recebido
      where update_id = p_update_id for update;
    if v_update.fundador_uid is distinct from v_uid
       or v_update.chat_id is distinct from p_chat_id
       or v_update.usuario_id is distinct from p_usuario_id
       or v_update.mensagem_id is distinct from p_mensagem_id
       or v_update.texto is distinct from p_texto
       or (p_request_id is not null and v_update.request_id is distinct from p_request_id) then
      raise exception 'TELEGRAM_UPDATE_DIVERGENTE' using errcode = '23505';
    end if;
    v_request_id := v_update.request_id;
  end if;

  v_recibo := helena_v2._receber_pedido_explicit_uid(
    v_uid, v_request_id, 'TELEGRAM', 'telegram:update:' || p_update_id::text, p_texto);
  return v_recibo || jsonb_build_object('update_id', p_update_id::text,
    'mensagem_id', p_mensagem_id::text);
end;
$f$;

revoke all on helena_v2.telegram_pareamento_codigo, helena_v2.telegram_vinculo,
  helena_v2.telegram_update_recebido from public, anon, authenticated, service_role;
revoke all on sequence helena_v2.telegram_vinculo_id_seq from public, anon, authenticated, service_role;
revoke all on function helena_v2._receber_pedido_explicit_uid(uuid,uuid,text,text,text),
  helena_v2._estado_pareamento_telegram(uuid),
  helena_v2.gerar_pareamento_telegram(), helena_v2.consultar_pareamento_telegram(),
  helena_v2.revogar_pareamento_telegram(),
  helena_v2.vincular_telegram(text,bigint,bigint),
  helena_v2.receber_pedido_telegram(bigint,bigint,bigint,bigint,text,uuid)
  from public, anon, authenticated, service_role;
grant execute on function helena_v2.gerar_pareamento_telegram(),
  helena_v2.consultar_pareamento_telegram(), helena_v2.revogar_pareamento_telegram()
  to authenticated;
grant execute on function helena_v2.vincular_telegram(text,bigint,bigint),
  helena_v2.receber_pedido_telegram(bigint,bigint,bigint,bigint,text,uuid)
  to service_role;
