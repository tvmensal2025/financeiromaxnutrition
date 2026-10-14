-- O QUE É: confere a solicitação original também para cards reais ligados.
-- Cada salto exige o CARD_CRIADO por sinal, a passagem ou reação de origem,
-- e a mesma empresa, ordem e revisão pinada; fontes são relidas na raiz.
-- COMO MUDAR: ao criar outro tipo de card ligado, vincular seu sinal e origem
-- no histórico e ampliar os testes adversariais antes de alterar este leitor.

create or replace function helena_v2._real_conferir_card_vinculado(p_card_id uuid)
returns boolean
language plpgsql volatile security definer set search_path = pg_catalog, pg_temp
set lock_timeout = '5s' as $f$
declare
  p helena_v2.solicitacao_card_real;
  c helena_v2.card;
  pai helena_v2.card;
  criacao helena_v2.historico;
  origem helena_v2.historico;
  ordem jsonb;
  v_estado text;
  v_saltos integer := 0;
  v_visitados uuid[] := '{}'::uuid[];
  v_criacoes integer;
begin
  select * into c from helena_v2.card where id=p_card_id for share;
  if c.id is null then
    raise exception 'CARD_REAL_NAO_ENCONTRADO' using errcode='22023';
  end if;
  loop
    if c.id=any(v_visitados) then
      raise exception 'CARD_REAL_CADEIA_CICLICA' using errcode='42501';
    end if;
    v_visitados := array_append(v_visitados,c.id);
    select * into p from helena_v2.solicitacao_card_real
      where card_id=c.id and consumida_em is not null for share;
    exit when found;
    if c.card_pai_id is null or v_saltos >= 16 then
      raise exception 'CARD_REAL_SEM_SOLICITACAO_CONSUMIDA' using errcode='22023';
    end if;
    select * into pai from helena_v2.card where id=c.card_pai_id for share;
    if pai.id is null or pai.id=c.id
       or c.empresa is distinct from pai.empresa
       or c.ordem_de_servico is distinct from pai.ordem_de_servico
       or c.ordem_de_servico ->> 'config_revision_id' is distinct from
          pai.ordem_de_servico ->> 'config_revision_id'
       or c.titulo is distinct from pai.titulo then
      raise exception 'CARD_REAL_CADEIA_DIVERGENTE' using errcode='42501';
    end if;
    select count(*) into v_criacoes from helena_v2.historico h
      where h.card_id=c.id and h.evento='CARD_CRIADO';
    if v_criacoes<>1 then
      raise exception 'CARD_REAL_CRIACAO_DIVERGENTE' using errcode='42501';
    end if;
    select * into criacao from helena_v2.historico h
      where h.card_id=c.id and h.maquina='card' and h.alvo_id=c.id
        and h.papel='MOTOR' and h.evento='CARD_CRIADO' and h.resultado='APLICADO'
        and h.origem='SINAL' and h.conteudo ->> 'ligado_a'=pai.id::text;
    if criacao.id is null or criacao.origem_id is null then
      raise exception 'CARD_REAL_CRIACAO_DIVERGENTE' using errcode='42501';
    end if;
    select * into origem from helena_v2.historico h
      where h.id=criacao.origem_id and h.card_id=pai.id;
    if origem.id is null or (
      (origem.maquina='card' and origem.alvo_id=pai.id)
      or (origem.maquina='etapa' and exists
          (select 1 from helena_v2.etapa e
           where e.id=origem.alvo_id and e.card_id=pai.id))
      or (origem.maquina='acao_externa' and exists
          (select 1 from helena_v2.acao_externa a
           where a.id=origem.alvo_id and a.card_id=pai.id))
    ) is distinct from true then
      raise exception 'CARD_REAL_ORIGEM_DIVERGENTE' using errcode='42501';
    end if;
    if (
      (origem.resultado='REACAO' and origem.papel='FUNDADOR'
       and criacao.conteudo ->> 'motivo'='REACAO ' || origem.evento
       and exists (select 1 from helena_v2.reacao r
                   where r.maquina=origem.maquina and r.papel=origem.papel
                     and r.evento=origem.evento and r.abre_card_ligado))
      or (origem.resultado='CARD_NOVO_LIGADO' and origem.papel='FUNDADOR'
          and criacao.conteudo ->> 'motivo'=origem.papel || ' ' || origem.evento)
      or (origem.resultado in ('APLICADO','CONVERTIDO')
          and exists (select 1 from helena_v2.passagem t
                      join helena_v2.ligacao l
                        on l.nome=any(t.sinais) and l.no_card='criar_card_ligado'
                      where t.maquina=origem.maquina and t.linha_id=origem.linha_id
                        and t.evento=origem.evento and t.papel=origem.papel
                        and l.nome=criacao.conteudo ->> 'motivo'))
    ) is distinct from true then
      raise exception 'CARD_REAL_ORIGEM_DIVERGENTE' using errcode='42501';
    end if;
    c := pai;
    v_saltos := v_saltos+1;
  end loop;

  if c.card_pai_id is not null then
    raise exception 'CARD_REAL_RAIZ_DIVERGENTE' using errcode='42501';
  end if;
  ordem := p.plano || jsonb_build_object(
    'config_revision_id',p.config_revision_id,'modo_contexto','real',
    'origem',p.origem,'chave_origem',p.chave_origem,'pedido_original',p.pedido_original,
    'business_id',p.business_id,'dados_reais',p.dados_reais);
  if c.empresa is distinct from p.business_id
     or c.ordem_de_servico is distinct from ordem
     or c.ordem_de_servico ->> 'config_revision_id' is distinct from
        p.config_revision_id::text then
    raise exception 'CARD_REAL_VINCULO_DIVERGENTE' using errcode='42501';
  end if;
  select estado into v_estado from helena_v2.configuracao
    where id=p.config_revision_id for share;
  if v_estado is null or v_estado not in ('VALIDADA','APOSENTADA') then
    raise exception 'CONFIG_PIN_REAL_INVALIDO' using errcode='42501';
  end if;
  if not helena_v2._real_confirmacao_valida(p.dados_reais,p.prazo) then
    raise exception 'CARD_REAL_SEM_CONFIRMACAO' using errcode='42501';
  end if;
  perform helena_v2._real_conferir_captura(p.chave_origem,p.plano,p.dados_reais);
  return true;
end;
$f$;

revoke execute on function helena_v2._real_conferir_card_vinculado(uuid)
from public,anon,authenticated,service_role;
