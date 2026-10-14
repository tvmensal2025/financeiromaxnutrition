-- O QUE É: leitura mínima de um toque próprio e da pergunta atual ao fundador.
-- Não expõe histórico, resposta integral do agente nem dados de execução.

alter table helena_v2.historico add column solicitante_uid uuid;

create function helena_v2._vincular_toque_fundador() returns trigger
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp as $f$
begin
  if new.papel='FUNDADOR' and new.conta='authenticated' then
    if auth.uid() is null or not helena_v2.sou_fundador() then
      raise exception 'FUNDADOR_NAO_AUTORIZADO' using errcode='42501';
    end if;
    new.solicitante_uid := auth.uid();
  else
    new.solicitante_uid := null;
  end if;
  return new;
end;
$f$;

create trigger a0_vincular_toque_fundador
before insert on helena_v2.historico
for each row execute function helena_v2._vincular_toque_fundador();

create function helena_v2.consultar_toque_fundador(p_card_id uuid, p_toque text)
returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare v_linha jsonb;
begin
  if not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode='42501';
  end if;
  if p_card_id is null or p_toque is null or octet_length(p_toque) not between 1 and 200
     or btrim(p_toque)='' then
    raise exception 'TOQUE_INVALIDO' using errcode='22023';
  end if;
  select jsonb_build_object('historico_id',h.id,'resultado',h.resultado,
      'momento',h.momento,'maquina',h.maquina,'alvo_id',h.alvo_id,
      'evento',h.evento)
    into v_linha from helena_v2.historico h
    where h.card_id=p_card_id and h.numero_toque=p_toque
      and h.papel='FUNDADOR' and h.conta='authenticated'
      and h.solicitante_uid=auth.uid();
  return v_linha;
end;
$f$;

create function helena_v2.ler_pergunta_etapa_fundador(p_etapa_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare
  e helena_v2.etapa;
  h helena_v2.historico;
  v_resposta jsonb;
  v_salva jsonb;
  v_texto jsonb;
  v_opcoes jsonb;
  v_total integer;
  v_validas boolean;
begin
  if not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode='42501';
  end if;
  select * into e from helena_v2.etapa where id=p_etapa_id
    and atual and estado='ESPERANDO_FUNDADOR' and motivo='PERGUNTA';
  if not found then return null; end if;

  -- Última transição efetiva da etapa deve ser a pergunta desta geração.
  select * into h from helena_v2.historico
    where card_id=e.card_id and maquina='etapa' and alvo_id=e.id
      and resultado in ('APLICADO','CONVERTIDO')
      and estado_antes is distinct from estado_depois
    order by id desc limit 1;
  if h.id is null or h.papel is distinct from 'AUTOR'
     or h.evento is distinct from 'PERGUNTAR'
     or (h.linha_id is distinct from 'E21' and h.linha_id is distinct from 'E120')
     or h.resultado is distinct from 'APLICADO'
     or h.estado_depois is distinct from 'ESPERANDO_FUNDADOR'
     or h.chave is null
     or not exists (select 1 from helena_v2.execucao x
                    where x.numero=h.chave and x.card_id=e.card_id
                      and x.etapa_id=e.id and x.tipo='AUTOR'
                      and x.estado='RESPONDIDA') then
    return null;
  end if;

  v_resposta := h.conteudo -> 'resposta';
  select resposta into v_salva from helena_v2.resposta_execucao
    where numero=h.chave;
  if jsonb_typeof(v_salva) is distinct from 'object'
     or jsonb_typeof(v_salva -> 'texto') is distinct from 'string'
     or jsonb_typeof(v_salva -> 'config_revision_id') is distinct from 'string'
     or v_salva ->> 'config_revision_id' is distinct from
        (select c.ordem_de_servico ->> 'config_revision_id'
         from helena_v2.card c where c.id=e.card_id) then
    return null;
  end if;
  begin
    v_texto := (v_salva ->> 'texto')::jsonb;
  exception when invalid_text_representation then
    return null;
  end;
  if v_texto is distinct from v_resposta then return null; end if;
  if jsonb_typeof(v_resposta) is distinct from 'object'
     or v_resposta ->> 'acao' is distinct from 'PERGUNTAR'
     or jsonb_typeof(v_resposta -> 'pergunta') is distinct from 'string'
     or char_length(btrim(v_resposta ->> 'pergunta')) not between 10 and 300
     or jsonb_typeof(v_resposta -> 'opcoes') is distinct from 'array' then
    return null;
  end if;
  select count(*),bool_and(coalesce(
      jsonb_typeof(o.valor)='object'
      and jsonb_typeof(o.valor -> 'letra')='string'
      and o.valor ->> 'letra'=substr('ABC',o.ord::integer,1)
      and jsonb_typeof(o.valor -> 'texto')='string'
      and char_length(btrim(o.valor ->> 'texto')) between 1 and 500
      and jsonb_typeof(o.valor -> 'consequencia')='string'
      and char_length(btrim(o.valor ->> 'consequencia')) between 1 and 500,false)),
      jsonb_agg(jsonb_build_object('letra',o.valor ->> 'letra',
          'texto',o.valor ->> 'texto',
          'consequencia',o.valor ->> 'consequencia') order by o.ord)
    into v_total,v_validas,v_opcoes
    from jsonb_array_elements(v_resposta -> 'opcoes') with ordinality o(valor,ord);
  if v_total not between 2 and 3 or v_validas is distinct from true then
    return null;
  end if;
  return jsonb_build_object('card_id',e.card_id,'etapa_id',e.id,
    'versao',e.versao,'chave',h.chave,'historico_id',h.id,
    'pergunta',v_resposta ->> 'pergunta','opcoes',v_opcoes);
end;
$f$;

revoke execute on function helena_v2._vincular_toque_fundador(),
  helena_v2.consultar_toque_fundador(uuid,text),
  helena_v2.ler_pergunta_etapa_fundador(uuid)
from public,anon,authenticated,service_role;
grant execute on function helena_v2.consultar_toque_fundador(uuid,text),
  helena_v2.ler_pergunta_etapa_fundador(uuid) to authenticated;
