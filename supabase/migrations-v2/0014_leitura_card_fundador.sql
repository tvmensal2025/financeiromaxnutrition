-- O QUE É: leitura de volta aplicada e durável, projetada para confirmação.
-- A chave vem do histórico C01, pois chamada_helena é limpa após aplicar.

create function helena_v2.ler_leitura_card_fundador(p_card_id uuid) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
declare
  c helena_v2.card;
  h helena_v2.historico;
  v_salva jsonb;
  v_resultado jsonb;
  v_texto jsonb;
  v_entendi jsonb;
  v_pronto jsonb;
  v_nao_pode jsonb;
  v_leitura jsonb;
  v_escolha jsonb;
  v_total integer;
  v_validos boolean;
begin
  if not helena_v2.sou_fundador() then
    raise exception 'SOMENTE_FUNDADOR_AUTENTICADO' using errcode='42501';
  end if;
  select * into c from helena_v2.card where id=p_card_id;
  if c.id is null or c.estado is distinct from 'ESPERANDO_CONFIRMACAO'
     or (c.motivo is distinct from 'NENHUM'
         and c.motivo is distinct from 'VALIDADOR_FALHOU') then
    return null;
  end if;

  select * into h from helena_v2.historico
    where card_id=c.id and maquina='card' and alvo_id=c.id
      and papel='HELENA' and evento='LER_DE_VOLTA'
      and linha_id='C01' and resultado='APLICADO'
      and estado_antes='RASCUNHO' and estado_depois='ESPERANDO_CONFIRMACAO'
    order by id desc limit 1;
  if h.id is null or h.chave is null then return null; end if;
  select s.resposta,r.resultado into v_salva,v_resultado
    from helena_v2.resultado_coordenacao r
    join helena_v2.resposta_coordenacao s on s.numero=r.numero
    join helena_v2.execucao x on x.numero=r.numero
    where r.numero=h.chave and r.historico_id=h.id
      and x.card_id=c.id and x.etapa_id is null
      and x.tipo='HELENA' and x.estado='RESPONDIDA';
  if jsonb_typeof(v_salva) is distinct from 'object'
     or jsonb_typeof(v_salva -> 'texto') is distinct from 'string'
     or jsonb_typeof(v_salva -> 'config_revision_id') is distinct from 'string'
     or v_salva ->> 'card_id' is distinct from c.id::text
     or v_salva ->> 'config_revision_id' is distinct from
        c.ordem_de_servico ->> 'config_revision_id'
     or v_resultado ->> 'resultado' is distinct from 'APLICADO'
     or v_resultado ->> 'linha' is distinct from 'C01'
     or v_resultado ->> 'historico_id' is distinct from h.id::text then
    return null;
  end if;
  begin
    v_texto := (v_salva ->> 'texto')::jsonb;
  exception when invalid_text_representation then
    return null;
  end;
  if jsonb_typeof(v_texto) is distinct from 'object'
     or h.conteudo is distinct from jsonb_build_object('resposta',v_texto) then
    return null;
  end if;

  v_entendi := v_texto -> 'entendi_assim';
  if v_entendi is not null then
    if jsonb_typeof(v_entendi) is distinct from 'object'
       or octet_length(v_entendi::text)>16000
       or jsonb_typeof(v_entendi -> 'o_que_quer') is distinct from 'string'
       or char_length(btrim(v_entendi ->> 'o_que_quer')) not between 10 and 400
       or jsonb_typeof(v_entendi -> 'como_e_o_pronto') is distinct from 'array'
       or jsonb_typeof(v_entendi -> 'nao_pode') is distinct from 'array' then
      return null;
    end if;
    select count(*),bool_and(coalesce(
        jsonb_typeof(i.valor)='object'
        and jsonb_typeof(i.valor -> 'texto')='string'
        and char_length(btrim(i.valor ->> 'texto')) between 3 and 200,false)),
        jsonb_agg(to_jsonb(i.valor ->> 'texto') order by i.ord)
      into v_total,v_validos,v_pronto
      from jsonb_array_elements(v_entendi -> 'como_e_o_pronto')
        with ordinality i(valor,ord);
    if v_total not between 1 and 5 or v_validos is distinct from true then
      return null;
    end if;
    select count(*),coalesce(bool_and(coalesce(
        jsonb_typeof(i.valor)='string'
        and char_length(btrim(i.valor #>> '{}')) between 3 and 200,false)),true),
        coalesce(jsonb_agg(i.valor order by i.ord),'[]'::jsonb)
      into v_total,v_validos,v_nao_pode
      from jsonb_array_elements(v_entendi -> 'nao_pode')
        with ordinality i(valor,ord);
    if v_total>20 or v_validos is distinct from true then return null; end if;
    v_leitura := jsonb_build_object('o_que_quer',v_entendi ->> 'o_que_quer',
      'como_e_o_pronto',v_pronto,'nao_pode',v_nao_pode);
  else
    v_leitura := coalesce(v_texto -> 'leitura_de_volta',v_texto -> 'resumo');
    if jsonb_typeof(v_leitura) is distinct from 'string'
       or char_length(btrim(v_leitura #>> '{}')) not between 1 and 2000 then
      return null;
    end if;
  end if;

  v_escolha := v_texto -> 'escolha';
  if jsonb_typeof(v_escolha)='object'
     and v_escolha ->> 'tipo' in ('SERVICO','ROTEIRO')
     and jsonb_typeof(v_escolha -> 'id')='string'
     and char_length(v_escolha ->> 'id') between 1 and 80
     and v_escolha ->> 'id' ~ '^[A-Za-z0-9-]+$' then
    v_escolha := jsonb_build_object('tipo',v_escolha ->> 'tipo',
                                    'id',v_escolha ->> 'id');
  else
    v_escolha := null;
  end if;
  return jsonb_build_object('card_id',c.id,'versao',c.versao,
    'chave',h.chave,'historico_id',h.id,'momento',h.momento,
    'motivo_atual',c.motivo,'leitura_de_volta',v_leitura,
    'escolha',v_escolha);
end;
$f$;

revoke execute on function helena_v2.ler_leitura_card_fundador(uuid)
from public,anon,authenticated,service_role;
grant execute on function helena_v2.ler_leitura_card_fundador(uuid)
to authenticated;
