-- O que é: Transporte Telegram v2. Aplicar depois de 0022; nenhum poller é ativado aqui.
-- Somente a Edge (service_role) chama estas RPCs. A credencial administrativa
-- e o token Telegram ficam na Edge; a capability entregue ao worker autoriza
-- somente um subconjunto fixo das operações HTTP da Edge.

create table helena_v2.telegram_inbox (
  update_id bigint primary key check (update_id > 0),
  bruto jsonb not null,
  bruto_hash bytea not null check (octet_length(bruto_hash) = 32),
  tipo text not null check (tipo in ('IGNORADO','VINCULAR','PEDIDO','CONVERSA','MIDIA','CALLBACK')),
  chat_id bigint,
  usuario_id bigint,
  fundador_uid uuid,
  vinculo_id bigint,
  request_id uuid,
  recebido_em timestamptz not null default clock_timestamp(),
  check (jsonb_typeof(bruto) = 'object')
);
create table helena_v2.telegram_trabalho (
  update_id bigint primary key references helena_v2.telegram_inbox(update_id),
  estado text not null default 'PENDENTE' check (estado in ('PENDENTE','EM_CURSO','CONCLUIDO')),
  tentativas integer not null default 0,
  lease_token uuid,
  lease_ate timestamptz,
  disponivel_em timestamptz not null default clock_timestamp(),
  proposta jsonb,
  concluido_em timestamptz
);
create table helena_v2.telegram_saida (
  id uuid primary key default gen_random_uuid(),
  update_id bigint not null references helena_v2.telegram_inbox(update_id),
  tipo text not null check (tipo in ('RECIBO','RESPOSTA','AVISO')),
  chave_evento text not null default '' check (char_length(chave_evento) <= 160),
  texto text not null check (char_length(texto) between 1 and 4096),
  criado_em timestamptz not null default clock_timestamp(),
  estado text not null default 'PENDENTE' check (estado in ('PENDENTE','EM_CURSO','ENTREGUE')),
  tentativas integer not null default 0,
  lease_token uuid,
  lease_ate timestamptz,
  disponivel_em timestamptz not null default clock_timestamp(),
  telegram_message_id bigint,
  entregue_em timestamptz,
  unique (update_id,tipo,chave_evento)
);
create index telegram_trabalho_pendente on helena_v2.telegram_trabalho(disponivel_em,update_id)
  where estado <> 'CONCLUIDO';
create index telegram_saida_pendente on helena_v2.telegram_saida(disponivel_em,update_id)
  where estado <> 'ENTREGUE';
alter table helena_v2.telegram_inbox enable row level security;
alter table helena_v2.telegram_trabalho enable row level security;
alter table helena_v2.telegram_saida enable row level security;

-- Telegram pode aninhar mensagens citadas, fixadas e callbacks. Redigir em
-- qualquer profundidade somente o token de pareamento de 48 hex após
-- /vincular; manter o restante do Update para auditoria.
create function helena_v2._redigir_codigo_telegram(p_value jsonb) returns jsonb
language plpgsql immutable set search_path = pg_catalog, pg_temp as $f$
declare
  v_result jsonb;
  v_key text;
  v_item jsonb;
  v_text text;
begin
  if p_value is null then return null; end if;
  case jsonb_typeof(p_value)
    when 'object' then
      v_result := '{}'::jsonb;
      for v_key,v_item in select key,value from jsonb_each(p_value) loop
        v_result := v_result || jsonb_build_object(v_key,
          helena_v2._redigir_codigo_telegram(v_item));
      end loop;
      return v_result;
    when 'array' then
      v_result := '[]'::jsonb;
      for v_item in select value from jsonb_array_elements(p_value) loop
        v_result := v_result || jsonb_build_array(helena_v2._redigir_codigo_telegram(v_item));
      end loop;
      return v_result;
    when 'string' then
      v_text := p_value #>> '{}';
      return to_jsonb(regexp_replace(v_text,
        '(/vincular[[:space:]]+)[0-9a-fA-F]{48}([^0-9a-fA-F]|$)',
        '\1[redigido]\2','gi'));
    else
      return p_value;
  end case;
end;
$f$;

-- O registro, a classificação, o pedido e o recibo são uma transação única.
-- Updates desconhecidos continuam registrados para auditoria e não são
-- convertidos em comandos. A função de 0022 valida pareamento e deduplica pedido.
create function helena_v2.registrar_update_telegram(p_update jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare
  v_id bigint;
  v_msg jsonb;
  v_chat bigint;
  v_user bigint;
  v_mid bigint;
  v_texto text;
  v_tipo text := 'IGNORADO';
  v_uid uuid;
  v_link bigint;
  v_codigo text;
  v_bruto jsonb;
  v_hash bytea;
  v_recibo jsonb;
  v_existente helena_v2.telegram_inbox;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode='42501';
  end if;
  if jsonb_typeof(p_update) <> 'object' or (p_update->>'update_id') !~ '^[1-9][0-9]{0,15}$' then
    raise exception 'TELEGRAM_UPDATE_INVALIDO' using errcode='22023';
  end if;
  v_id := (p_update->>'update_id')::bigint;
  if v_id > 9007199254740991 then
    raise exception 'TELEGRAM_UPDATE_INVALIDO' using errcode='22023';
  end if;
  v_hash := extensions.digest(p_update::text,'sha256');
  v_bruto := helena_v2._redigir_codigo_telegram(p_update);
  insert into helena_v2.telegram_inbox(update_id,bruto,bruto_hash,tipo)
    values(v_id,v_bruto,v_hash,'IGNORADO') on conflict (update_id) do nothing;
  if not found then
    select * into v_existente from helena_v2.telegram_inbox where update_id=v_id;
    if v_existente.bruto_hash is distinct from v_hash then
      raise exception 'TELEGRAM_UPDATE_DIVERGENTE' using errcode='23505';
    end if;
    return jsonb_build_object('update_id',v_id::text,'tipo',v_existente.tipo,
      'request_id',v_existente.request_id,'novo',false);
  end if;

  v_msg := p_update->'message';
  if jsonb_typeof(v_msg) is distinct from 'object'
     or v_msg->'chat'->>'type' is distinct from 'private'
     or v_msg->'from'->>'is_bot' is distinct from 'false'
     or (v_msg->'chat'->>'id') !~ '^[1-9][0-9]{0,15}$'
     or (v_msg->'from'->>'id') !~ '^[1-9][0-9]{0,15}$'
     or (v_msg->>'message_id') !~ '^[1-9][0-9]{0,15}$' then
    if p_update ? 'callback_query' then
      update helena_v2.telegram_inbox set tipo='CALLBACK' where update_id=v_id;
      v_tipo := 'CALLBACK';
    end if;
    return jsonb_build_object('update_id',v_id::text,'tipo',v_tipo,'novo',true);
  end if;
  v_chat := (v_msg->'chat'->>'id')::bigint;
  v_user := (v_msg->'from'->>'id')::bigint;
  v_mid := (v_msg->>'message_id')::bigint;
  if v_chat <> v_user or greatest(v_chat,v_mid) > 9007199254740991 then
    return jsonb_build_object('update_id',v_id::text,'tipo',v_tipo,'novo',true);
  end if;
  update helena_v2.telegram_inbox set chat_id=v_chat,usuario_id=v_user where update_id=v_id;

  v_texto := v_msg->>'text';
  if v_texto ~ '^/vincular [0-9a-fA-F]{48}$' then
    v_codigo := lower(split_part(v_texto,' ',2));
    begin
      perform helena_v2.vincular_telegram(v_codigo,v_chat,v_user);
      select id, fundador_uid into v_link,v_uid from helena_v2.telegram_vinculo
        where chat_id=v_chat and usuario_id=v_user and revogado_em is null;
      v_tipo := 'VINCULAR';
      update helena_v2.telegram_inbox set tipo=v_tipo, fundador_uid=v_uid,
        vinculo_id=v_link where update_id=v_id;
      insert into helena_v2.telegram_saida(update_id,tipo,texto)
        values(v_id,'RECIBO','Vínculo confirmado. Confira o status no site.');
    exception when insufficient_privilege then
      -- O código errado/expirado não deve revelar a identidade ou desfazer inbox.
      null;
    end;
    return jsonb_build_object('update_id',v_id::text,'tipo',v_tipo,'novo',true);
  end if;

  -- O texto de pedido também é persistido por 0022. Encaminhar só a cópia
  -- redigida, inclusive quando /vincular aparece no meio de um pedido.
  v_texto := v_bruto->'message'->>'text';

  select v.fundador_uid,v.id into v_uid,v_link from helena_v2.telegram_vinculo v
    join public.app_access a on a.user_id=v.fundador_uid and a.role='founder' and a.active
    where v.chat_id=v_chat and v.usuario_id=v_user and v.revogado_em is null;
  if v_uid is null then
    return jsonb_build_object('update_id',v_id::text,'tipo',v_tipo,'novo',true);
  end if;
  if v_texto is not null and char_length(v_texto) > 10000 then
    return jsonb_build_object('update_id',v_id::text,'tipo',v_tipo,'novo',true);
  end if;
  if v_texto ~ '^/pedido[[:space:]]+' and char_length(trim(substring(v_texto from 9))) between 1 and 10000 then
    v_texto := trim(substring(v_texto from 9));
    v_recibo := helena_v2.receber_pedido_telegram(v_chat,v_user,v_id,v_mid,v_texto,null);
    v_tipo := 'PEDIDO';
    update helena_v2.telegram_inbox set tipo=v_tipo, fundador_uid=v_uid,
      vinculo_id=v_link,
      request_id=(v_recibo->>'request_id')::uuid where update_id=v_id;
    insert into helena_v2.telegram_saida(update_id,tipo,texto) values
      (v_id,'RECIBO','Pedido recebido. Estado: RECEBIDO. Protocolo: ' ||
       (v_recibo->>'request_id') || '. A Helena ainda vai analisar o pedido.');
  elsif v_msg ? 'photo' or v_msg ? 'document' or v_msg ? 'voice'
      or v_msg ? 'video' or v_msg ? 'audio' or v_msg ? 'sticker' then
    v_tipo := 'MIDIA';
    update helena_v2.telegram_inbox set tipo=v_tipo, fundador_uid=v_uid,
      vinculo_id=v_link where update_id=v_id;
  elsif v_texto is not null and btrim(v_texto) <> '' then
    v_tipo := 'CONVERSA';
    update helena_v2.telegram_inbox set tipo=v_tipo, fundador_uid=v_uid,
      vinculo_id=v_link where update_id=v_id;
  else
    return jsonb_build_object('update_id',v_id::text,'tipo',v_tipo,'novo',true);
  end if;
  insert into helena_v2.telegram_trabalho(update_id) values(v_id);
  return jsonb_build_object('update_id',v_id::text,'tipo',v_tipo,'request_id',
    v_recibo->>'request_id','novo',true);
end;
$f$;

create function helena_v2.reivindicar_trabalho_telegram() returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare v helena_v2.telegram_trabalho; v_inbox helena_v2.telegram_inbox;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode='42501';
  end if;
  select t.* into v from helena_v2.telegram_trabalho t
    join helena_v2.telegram_inbox i on i.update_id=t.update_id
    join helena_v2.telegram_vinculo x on x.id=i.vinculo_id
      and x.fundador_uid=i.fundador_uid and x.chat_id=i.chat_id
      and x.usuario_id=i.usuario_id and x.revogado_em is null
    join public.app_access a on a.user_id=x.fundador_uid and a.role='founder' and a.active
    where t.estado <> 'CONCLUIDO' and t.disponivel_em <= clock_timestamp()
      and (t.estado='PENDENTE' or t.lease_ate < clock_timestamp())
    order by t.disponivel_em,t.update_id for update of t skip locked limit 1;
  if not found then return '{}'::jsonb; end if;
  update helena_v2.telegram_trabalho set estado='EM_CURSO',tentativas=tentativas+1,
    lease_token=gen_random_uuid(),lease_ate=clock_timestamp()+interval '2 minutes'
    where update_id=v.update_id returning * into v;
  select * into v_inbox from helena_v2.telegram_inbox where update_id=v.update_id;
  return jsonb_build_object('update_id',v.update_id::text,'lease_token',v.lease_token,
    'tipo',v_inbox.tipo,'request_id',v_inbox.request_id,'update',v_inbox.bruto,'tentativas',v.tentativas);
end;
$f$;

create function helena_v2.concluir_trabalho_telegram(
  p_update_id bigint,p_lease_token uuid,p_resposta text,p_proposta jsonb default null
) returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare v helena_v2.telegram_trabalho; i helena_v2.telegram_inbox;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode='42501';
  end if;
  select * into v from helena_v2.telegram_trabalho where update_id=p_update_id for update;
  if not found or v.estado <> 'EM_CURSO' or v.lease_token is distinct from p_lease_token
     or v.lease_ate <= clock_timestamp() then
    raise exception 'TELEGRAM_LEASE_INVALIDO' using errcode='42501';
  end if;
  if p_resposta is not null and char_length(p_resposta) not between 1 and 4096 then
    raise exception 'TELEGRAM_RESPOSTA_INVALIDA' using errcode='22023';
  end if;
  if p_proposta is not null and (jsonb_typeof(p_proposta) <> 'object'
     or octet_length(p_proposta::text) > 16384) then
    raise exception 'TELEGRAM_PROPOSTA_INVALIDA' using errcode='22023';
  end if;
  select * into i from helena_v2.telegram_inbox where update_id=p_update_id;
  if i.fundador_uid is null or not exists (
    select 1 from helena_v2.telegram_vinculo x join public.app_access a
      on a.user_id=x.fundador_uid and a.role='founder' and a.active
    where x.id=i.vinculo_id and x.fundador_uid=i.fundador_uid and x.chat_id=i.chat_id
      and x.usuario_id=i.usuario_id and x.revogado_em is null
  ) then
    raise exception 'TELEGRAM_VINCULO_REVOGADO' using errcode='42501';
  end if;
  update helena_v2.telegram_trabalho set estado='CONCLUIDO',lease_token=null,
    lease_ate=null,proposta=p_proposta,concluido_em=clock_timestamp()
    where update_id=p_update_id;
  if p_resposta is not null then
    insert into helena_v2.telegram_saida(update_id,tipo,texto)
      values(p_update_id,'RESPOSTA',p_resposta);
  end if;
  return jsonb_build_object('ok',true,'update_id',p_update_id::text);
end;
$f$;

create function helena_v2.renovar_trabalho_telegram(
  p_update_id bigint,p_lease_token uuid
) returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare v helena_v2.telegram_trabalho;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode='42501';
  end if;
  select * into v from helena_v2.telegram_trabalho where update_id=p_update_id for update;
  if not found or v.estado <> 'EM_CURSO' or v.lease_token is distinct from p_lease_token
     or v.lease_ate <= clock_timestamp() then
    raise exception 'TELEGRAM_LEASE_INVALIDO' using errcode='42501';
  end if;
  update helena_v2.telegram_trabalho set lease_ate=clock_timestamp()+interval '2 minutes'
    where update_id=p_update_id;
  return jsonb_build_object('ok',true);
end;
$f$;

create function helena_v2.reivindicar_saida_telegram() returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare v helena_v2.telegram_saida; v_inbox helena_v2.telegram_inbox;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode='42501';
  end if;
  select s.* into v from helena_v2.telegram_saida s
    join helena_v2.telegram_inbox i on i.update_id=s.update_id
    join helena_v2.telegram_vinculo x on x.id=i.vinculo_id and x.fundador_uid=i.fundador_uid
      and x.chat_id=i.chat_id and x.usuario_id=i.usuario_id and x.revogado_em is null
    join public.app_access a on a.user_id=x.fundador_uid and a.role='founder' and a.active
    where s.estado <> 'ENTREGUE' and s.disponivel_em <= clock_timestamp()
      and (s.estado='PENDENTE' or s.lease_ate < clock_timestamp())
      and not exists (
        select 1 from helena_v2.telegram_saida r where r.update_id=s.update_id
          and r.estado <> 'ENTREGUE'
          and (r.criado_em,r.id) < (s.criado_em,s.id))
    order by s.disponivel_em,s.update_id,s.criado_em for update of s skip locked limit 1;
  if not found then return '{}'::jsonb; end if;
  update helena_v2.telegram_saida set estado='EM_CURSO',tentativas=tentativas+1,
    lease_token=gen_random_uuid(),lease_ate=clock_timestamp()+interval '2 minutes'
    where id=v.id returning * into v;
  select * into v_inbox from helena_v2.telegram_inbox where update_id=v.update_id;
  return jsonb_build_object('id',v.id,'lease_token',v.lease_token,'chat_id',v_inbox.chat_id::text,
    'texto',v.texto,'update_id',v.update_id::text);
end;
$f$;

create function helena_v2.concluir_saida_telegram(
  p_id uuid,p_lease_token uuid,p_message_id bigint default null
) returns jsonb language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare v helena_v2.telegram_saida;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode='42501';
  end if;
  select * into v from helena_v2.telegram_saida where id=p_id for update;
  if not found or v.estado <> 'EM_CURSO' or v.lease_token is distinct from p_lease_token
     or v.lease_ate <= clock_timestamp() or p_message_id is null or p_message_id <= 0 then
    raise exception 'TELEGRAM_LEASE_INVALIDO' using errcode='42501';
  end if;
  update helena_v2.telegram_saida set estado='ENTREGUE',lease_token=null,lease_ate=null,
    telegram_message_id=p_message_id,entregue_em=clock_timestamp() where id=p_id;
  return jsonb_build_object('ok',true);
end;
$f$;

create function helena_v2.reagendar_saida_telegram(p_id uuid,p_lease_token uuid) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare v helena_v2.telegram_saida;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_SERVICO' using errcode='42501';
  end if;
  select * into v from helena_v2.telegram_saida where id=p_id for update;
  if not found or v.estado <> 'EM_CURSO' or v.lease_token is distinct from p_lease_token then
    raise exception 'TELEGRAM_LEASE_INVALIDO' using errcode='42501';
  end if;
  update helena_v2.telegram_saida set estado='PENDENTE',lease_token=null,lease_ate=null,
    disponivel_em=clock_timestamp()+least(interval '1 hour',
      make_interval(secs=>least(3600, power(2,least(tentativas,10))::integer)))
    where id=p_id;
  return jsonb_build_object('ok',true);
end;
$f$;

revoke all on helena_v2.telegram_inbox,helena_v2.telegram_trabalho,helena_v2.telegram_saida
  from public,anon,authenticated,service_role;
revoke all on function helena_v2._redigir_codigo_telegram(jsonb),
  helena_v2.registrar_update_telegram(jsonb),
  helena_v2.reivindicar_trabalho_telegram(),
  helena_v2.concluir_trabalho_telegram(bigint,uuid,text,jsonb),
  helena_v2.renovar_trabalho_telegram(bigint,uuid),
  helena_v2.reivindicar_saida_telegram(),
  helena_v2.concluir_saida_telegram(uuid,uuid,bigint),
  helena_v2.reagendar_saida_telegram(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function helena_v2.registrar_update_telegram(jsonb),
  helena_v2.reivindicar_trabalho_telegram(),
  helena_v2.concluir_trabalho_telegram(bigint,uuid,text,jsonb),
  helena_v2.renovar_trabalho_telegram(bigint,uuid),
  helena_v2.reivindicar_saida_telegram(),
  helena_v2.concluir_saida_telegram(uuid,uuid,bigint),
  helena_v2.reagendar_saida_telegram(uuid,uuid) to service_role;
