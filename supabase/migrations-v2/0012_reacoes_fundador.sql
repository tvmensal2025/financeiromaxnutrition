-- O QUE É: aplica versão vista e domínio do vocabulário também aos toques
-- do fundador sem passagem, antes de reação ou card ligado.
-- Redefine apenas a porta pública; a máquina gerada em 0003 permanece intacta.

create or replace function helena_v2.aplicar_evento(
  p_maquina text, p_alvo uuid, p_papel text, p_evento text,
  p_parametros jsonb default '{}'::jsonb, p_ator text default null,
  p_chave bigint default null, p_versao_vista integer default null,
  p_conteudo jsonb default null, p_toque text default null,
  p_automaticos boolean default true, p_nao_disparar text[] default '{}'::text[],
  p_prazo_espera timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = helena_v2, pg_catalog, pg_temp as $f$
declare
  r jsonb;
  v_card uuid;
  v_alvo jsonb;
  v_dominio jsonb;
  v_regra jsonb;
  v_parametros jsonb := coalesce(p_parametros, '{}'::jsonb);
  v_versao_antiga boolean := false;
  v_parametros_invalidos boolean := false;
  v_resultado text;
  v_hist bigint;
begin
  perform helena_v2._entrar();
  perform helena_v2._conferir_conta(array[p_papel]);
  if p_prazo_espera is not null and not helena_v2._prazo_valido(p_prazo_espera) then
    raise exception 'PRAZO_ESPERA_INVALIDO' using errcode = '23514';
  end if;

  if p_papel = 'FUNDADOR' and p_evento in ('APROVAR','PEDIR_AJUSTE','RESPONDER') then
    select o_card,o_v into v_card,v_alvo
      from helena_v2._carregar(p_maquina,p_alvo);
    perform 1 from helena_v2.card where id=v_card for update;
    select o_card,o_v into v_card,v_alvo
      from helena_v2._carregar(p_maquina,p_alvo);

    -- O toque já gravado é idempotente mesmo se a ficha ou o card mudou.
    if p_toque is null or not exists
        (select 1 from helena_v2.historico h
         where h.card_id=v_card and h.numero_toque=p_toque) then
      select valor into v_regra from helena_v2.regra_geral
        where chave='toques_do_fundador_exigem_versao_vista';
      if coalesce(v_regra ? p_evento,false) then
        v_versao_antiga := p_versao_vista is distinct from (v_alvo ->> 'versao')::integer;
      end if;

      select parametros into v_dominio from helena_v2.vocab_evento
        where papel=p_papel and evento=p_evento;
      if jsonb_typeof(v_dominio) is distinct from 'object'
         or jsonb_typeof(v_parametros) is distinct from 'object' then
        v_parametros_invalidos := true;
      else
        v_parametros_invalidos := exists (
          select 1 from jsonb_each(v_dominio) d
          where jsonb_typeof(d.value) is distinct from 'array'
             or not (v_parametros ? d.key)
             or jsonb_typeof(v_parametros -> d.key) is distinct from 'string'
             or not coalesce(d.value ? (v_parametros ->> d.key),false)
        ) or exists (
          select 1 from jsonb_object_keys(v_parametros) k(chave)
          where not (v_dominio ? k.chave)
        );
      end if;

      if v_versao_antiga or v_parametros_invalidos then
        select valor into v_regra from helena_v2.regra_geral
          where chave='recusa_do_fundador';
        v_resultado := case when v_versao_antiga then v_regra ->> 'versao_antiga'
                            else v_regra ->> 'aberto' end;
        if v_resultado is distinct from 'COMENTARIO_NO_CARD' then
          raise exception 'RECUSA_FUNDADOR_NAO_INERTE' using errcode='23514';
        end if;
        insert into helena_v2.historico
          (card_id,maquina,alvo_id,alvo_codigo,papel,evento,parametros,ator,chave,
           versao_vista,conteudo,resultado,motivo,origem,estado_antes,estado_depois,
           vars_antes,vars_depois,numero_toque,conta)
        values
          (v_card,p_maquina,p_alvo,
           case when p_maquina='card' then 'card' else v_alvo ->> 'codigo' end,
           p_papel,p_evento,v_parametros,p_ator,p_chave,p_versao_vista,p_conteudo,
           v_resultado,v_resultado,'EXTERNO',v_alvo ->> 'estado',v_alvo ->> 'estado',
           helena_v2._so_variaveis(p_maquina,v_alvo),
           helena_v2._so_variaveis(p_maquina,v_alvo),p_toque,helena_v2._conta())
        returning id into v_hist;
        r := jsonb_build_object('resultado',v_resultado,'historico_id',v_hist,'motivo',v_resultado);
      end if;
    end if;
  end if;

  if r is null then
    r := helena_v2._aplicar(p_maquina,p_alvo,p_papel,p_evento,p_parametros,p_ator,
                            p_chave,p_versao_vista,p_conteudo,'EXTERNO',null,p_toque,p_prazo_espera);
  end if;
  if p_automaticos and r ->> 'resultado' in ('APLICADO','CONVERTIDO') then
    select o_card into v_card from helena_v2._carregar(p_maquina,p_alvo);
    perform helena_v2._automaticos(v_card,p_nao_disparar,(r ->> 'historico_id')::bigint);
  end if;
  set constraints all immediate;
  set constraints all deferred;
  perform helena_v2._sair();
  return r;
end;
$f$;
