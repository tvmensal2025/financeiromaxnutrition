-- Resposta da coordenadora persistida antes de LER_DE_VOLTA. Nenhuma execução
-- externa é iniciada pelo banco; a transição continua em aplicar_evento.
create table helena_v2.resposta_coordenacao (
  numero bigint primary key references helena_v2.execucao(numero),
  resposta jsonb not null,
  gravada_em timestamptz not null default clock_timestamp()
);
create table helena_v2.resultado_coordenacao (
  numero bigint primary key references helena_v2.resposta_coordenacao(numero),
  resultado jsonb not null,
  historico_id bigint not null unique references helena_v2.historico(id),
  aplicada_em timestamptz not null default clock_timestamp()
);

create function helena_v2._coordenacao_imutavel() returns trigger
language plpgsql security definer set search_path = pg_catalog, pg_temp as $f$
begin
  raise exception 'COORDENACAO_IMUTAVEL' using errcode = '42501';
end;
$f$;
create trigger resposta_coordenacao_imutavel before update or delete on helena_v2.resposta_coordenacao
  for each row execute function helena_v2._coordenacao_imutavel();
create trigger resposta_coordenacao_sem_truncate before truncate on helena_v2.resposta_coordenacao
  for each statement execute function helena_v2._coordenacao_imutavel();
create trigger resultado_coordenacao_imutavel before update or delete on helena_v2.resultado_coordenacao
  for each row execute function helena_v2._coordenacao_imutavel();
create trigger resultado_coordenacao_sem_truncate before truncate on helena_v2.resultado_coordenacao
  for each statement execute function helena_v2._coordenacao_imutavel();

-- O harness sintético instala 0008 sobre 0006. Na instalação real, 0007 já
-- existe e a solicitação consumida identifica o card mesmo se o modo sumir.
create function helena_v2._coordenacao_card_real(p_card_id uuid, p_ordem jsonb) returns boolean
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
declare v_ligado boolean;
begin
  if p_ordem ->> 'modo_contexto' = 'real' then return true; end if;
  if to_regclass('helena_v2.solicitacao_card_real') is null then return false; end if;
  execute 'select exists(select 1 from helena_v2.solicitacao_card_real where card_id=$1)'
    into v_ligado using p_card_id;
  return v_ligado;
end;
$f$;

-- A porta geral de eventos continua autorizada para outras passagens. Em
-- cards reais, LER_DE_VOLTA só entra se a resposta da chave atual já está
-- persistida e se o histórico da própria transição contém o mesmo conteúdo.
create function helena_v2._coordenacao_proteger_leitura_real() returns trigger
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp
set lock_timeout = '5s' as $f$
declare v_resposta jsonb; v_conteudo jsonb;
begin
  if old.estado <> 'RASCUNHO'
     or current_setting('helena_v2.evento_atual',true) is distinct from 'LER_DE_VOLTA'
     or not helena_v2._coordenacao_card_real(old.id,old.ordem_de_servico) then
    return new;
  end if;
  if new.estado not in ('ESPERANDO_CONFIRMACAO','VALIDANDO_PLANO') then
    raise exception 'LER_DE_VOLTA_ESTADO_INESPERADO' using errcode = '23514';
  end if;
  select resposta into v_resposta from helena_v2.resposta_coordenacao
    where numero=old.chamada_helena for share;
  if v_resposta is null then
    raise exception 'RESPOSTA_COORDENACAO_AUSENTE' using errcode = '42501';
  end if;
  v_conteudo := jsonb_build_object('resposta',(v_resposta ->> 'texto')::jsonb);
  perform 1 from helena_v2.historico h where h.card_id=old.id and h.alvo_id=old.id
    and h.maquina='card' and h.papel='HELENA' and h.evento='LER_DE_VOLTA'
    and h.chave=old.chamada_helena and h.conteudo=v_conteudo and h.resultado='APLICADO';
  if not found then
    raise exception 'LER_DE_VOLTA_SEM_RESPOSTA_PERSISTIDA' using errcode = '42501';
  end if;
  perform helena_v2._real_conferir_card_vinculado(old.id);
  return new;
end;
$f$;
create trigger b_coordenacao_leitura_real before update on helena_v2.card
  for each row execute function helena_v2._coordenacao_proteger_leitura_real();

-- O card é travado antes de conferir/abrir a chamada. Repetir após queda
-- preserva a chave e a resposta já salva.
create function helena_v2.obter_chamada_coordenacao(p_card_id uuid) returns bigint
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp
set lock_timeout = '5s' as $f$
declare c helena_v2.card; v_num bigint;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  select * into c from helena_v2.card where id=p_card_id for update;
  if c.id is null or c.estado <> 'RASCUNHO' then
    raise exception 'COORDENACAO_FORA_DO_RASCUNHO' using errcode = '42501';
  end if;
  if helena_v2._coordenacao_card_real(c.id,c.ordem_de_servico) then
    perform helena_v2._real_conferir_card_vinculado(p_card_id);
  end if;
  select x.numero into v_num from helena_v2.execucao x
    where x.numero=c.chamada_helena and x.card_id=c.id and x.etapa_id is null
      and x.tipo='HELENA' and x.estado='VIVA' for update;
  if v_num is not null then return v_num; end if;
  return helena_v2.abrir_chamada_helena('card',p_card_id);
end;
$f$;

create function helena_v2.ler_resposta_coordenacao(p_numero bigint) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare v_resposta jsonb;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  select resposta into v_resposta from helena_v2.resposta_coordenacao where numero=p_numero;
  return v_resposta;
end;
$f$;

create function helena_v2.registrar_resposta_coordenacao(p_numero bigint, p_resposta jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp
set lock_timeout = '5s' as $f$
declare x helena_v2.execucao; c helena_v2.card; v_antiga jsonb; v_texto jsonb;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  if jsonb_typeof(p_resposta) is distinct from 'object'
     or jsonb_typeof(p_resposta -> 'texto') is distinct from 'string'
     or btrim(p_resposta ->> 'texto') = ''
     or jsonb_typeof(p_resposta -> 'evidencias') is distinct from 'object'
     or jsonb_typeof(p_resposta -> 'config_revision_id') is distinct from 'string'
     or jsonb_typeof(p_resposta -> 'card_id') is distinct from 'string'
     or (p_resposta - 'texto' - 'evidencias' - 'config_revision_id' - 'card_id') <> '{}'::jsonb
     or octet_length(p_resposta::text) > 1000000 then
    raise exception 'RESPOSTA_COORDENACAO_INVALIDA' using errcode = '22023';
  end if;
  begin
    v_texto := (p_resposta ->> 'texto')::jsonb;
  exception when invalid_text_representation then
    raise exception 'RESPOSTA_COORDENACAO_INVALIDA' using errcode = '22023';
  end;
  if jsonb_typeof(v_texto) is distinct from 'object' then
    raise exception 'RESPOSTA_COORDENACAO_INVALIDA' using errcode = '22023';
  end if;
  select * into x from helena_v2.execucao where numero=p_numero;
  if x.numero is null or x.tipo <> 'HELENA' or x.etapa_id is not null then
    raise exception 'CHAMADA_COORDENACAO_INVALIDA' using errcode = '42501';
  end if;
  select * into c from helena_v2.card where id=x.card_id for update;
  perform 1 from helena_v2.execucao where numero=p_numero for update;
  if p_resposta ->> 'card_id' is distinct from c.id::text
     or p_resposta ->> 'config_revision_id' is distinct from c.ordem_de_servico ->> 'config_revision_id' then
    raise exception 'RESPOSTA_COORDENACAO_SEM_PIN' using errcode = '42501';
  end if;
  select resposta into v_antiga from helena_v2.resposta_coordenacao where numero=p_numero for share;
  if found then
    if v_antiga is distinct from p_resposta then
      raise exception 'RESPOSTA_COORDENACAO_DIVERGENTE' using errcode = '23505';
    end if;
    return v_antiga;
  end if;
  if c.estado <> 'RASCUNHO' or c.chamada_helena is distinct from p_numero or x.estado <> 'VIVA' then
    raise exception 'CHAMADA_COORDENACAO_NAO_ATUAL' using errcode = '42501';
  end if;
  if helena_v2._coordenacao_card_real(c.id,c.ordem_de_servico) then
    perform helena_v2._real_conferir_card_vinculado(c.id);
  end if;
  insert into helena_v2.resposta_coordenacao(numero,resposta) values(p_numero,p_resposta);
  return p_resposta;
end;
$f$;

-- A resposta e o resultado pertencem à mesma chave. Se o commit ocorreu e o
-- checkpoint DBOS não, a repetição comprova o histórico e devolve o resultado.
create function helena_v2.aplicar_resposta_coordenacao(p_numero bigint) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp
set lock_timeout = '5s' as $f$
declare x helena_v2.execucao; c helena_v2.card; v_resposta jsonb; v_conteudo jsonb;
        v_resultado jsonb; v_hist bigint; v_salvo helena_v2.resultado_coordenacao;
begin
  if helena_v2._conta() <> 'service_role' then
    raise exception 'SOMENTE_MOTOR' using errcode = '42501';
  end if;
  select * into x from helena_v2.execucao where numero=p_numero;
  if x.numero is null or x.tipo <> 'HELENA' or x.etapa_id is not null then
    raise exception 'CHAMADA_COORDENACAO_INVALIDA' using errcode = '42501';
  end if;
  select * into c from helena_v2.card where id=x.card_id for update;
  perform 1 from helena_v2.execucao where numero=p_numero for update;
  select resposta into v_resposta from helena_v2.resposta_coordenacao where numero=p_numero for share;
  if v_resposta is null then
    raise exception 'RESPOSTA_COORDENACAO_AUSENTE' using errcode = '42501';
  end if;
  v_conteudo := jsonb_build_object('resposta',(v_resposta ->> 'texto')::jsonb);
  select * into v_salvo from helena_v2.resultado_coordenacao where numero=p_numero for share;
  if found then
    perform 1 from helena_v2.historico h where h.id=v_salvo.historico_id
      and h.card_id=x.card_id and h.alvo_id=x.card_id and h.maquina='card'
      and h.papel='HELENA' and h.evento='LER_DE_VOLTA' and h.chave=p_numero
      and h.conteudo=v_conteudo and h.resultado=v_salvo.resultado ->> 'resultado';
    if not found then
      raise exception 'RESULTADO_COORDENACAO_SEM_HISTORICO' using errcode = '23514';
    end if;
    return v_salvo.resultado;
  end if;
  -- Outra chamada autorizada pode ter aplicado o mesmo evento após salvar a
  -- resposta, mas antes do wrapper gravar seu marcador. Recupera apenas se o
  -- histórico comprova card, chave, evento e conteúdo exatos.
  if c.estado <> 'RASCUNHO' then
    select h.id, jsonb_build_object('resultado',h.resultado,'linha',h.linha_id,
      'historico_id',h.id,'estado',h.estado_depois,'convertido_em',h.convertido_em)
      into v_hist,v_resultado from helena_v2.historico h
      where h.card_id=x.card_id and h.alvo_id=x.card_id and h.maquina='card'
        and h.papel='HELENA' and h.evento='LER_DE_VOLTA' and h.chave=p_numero
        and h.conteudo=v_conteudo and h.resultado in ('APLICADO','CONVERTIDO')
      order by h.id desc limit 1;
    if v_hist is null then
      raise exception 'CHAMADA_COORDENACAO_NAO_ATUAL' using errcode = '42501';
    end if;
    insert into helena_v2.resultado_coordenacao(numero,resultado,historico_id)
      values(p_numero,v_resultado,v_hist);
    return v_resultado;
  end if;
  if c.estado <> 'RASCUNHO' or c.chamada_helena is distinct from p_numero or x.estado <> 'VIVA'
     or v_resposta ->> 'card_id' is distinct from c.id::text
     or v_resposta ->> 'config_revision_id' is distinct from c.ordem_de_servico ->> 'config_revision_id' then
    raise exception 'CHAMADA_COORDENACAO_NAO_ATUAL' using errcode = '42501';
  end if;
  if helena_v2._coordenacao_card_real(c.id,c.ordem_de_servico) then
    perform helena_v2._real_conferir_card_vinculado(c.id);
  end if;
  v_resultado := helena_v2.aplicar_evento('card',c.id,'HELENA','LER_DE_VOLTA',
    '{}'::jsonb,null,p_numero,null,v_conteudo,null,true,array['PLANO_VALIDO']::text[]);
  if v_resultado ->> 'resultado' not in ('APLICADO','CONVERTIDO') then
    raise exception 'LER_DE_VOLTA_NAO_APLICADA' using errcode = '23514';
  end if;
  v_hist := (v_resultado ->> 'historico_id')::bigint;
  insert into helena_v2.resultado_coordenacao(numero,resultado,historico_id)
    values(p_numero,v_resultado,v_hist);
  return v_resultado;
end;
$f$;

revoke all on helena_v2.resposta_coordenacao, helena_v2.resultado_coordenacao
  from public,anon,authenticated,service_role;
revoke execute on function helena_v2._coordenacao_imutavel(),
  helena_v2._coordenacao_card_real(uuid,jsonb),
  helena_v2._coordenacao_proteger_leitura_real(),
  helena_v2.obter_chamada_coordenacao(uuid), helena_v2.ler_resposta_coordenacao(bigint),
  helena_v2.registrar_resposta_coordenacao(bigint,jsonb), helena_v2.aplicar_resposta_coordenacao(bigint)
  from public,anon,authenticated,service_role;
grant execute on function helena_v2.obter_chamada_coordenacao(uuid),
  helena_v2.ler_resposta_coordenacao(bigint), helena_v2.registrar_resposta_coordenacao(bigint,jsonb),
  helena_v2.aplicar_resposta_coordenacao(bigint) to service_role;
