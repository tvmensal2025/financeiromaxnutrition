-- 0017 — O RELÓGIO DOS PRAZOS: helena_v2.eventos_devidos(p_agora) diz quais eventos de tempo (papel RELOGIO) venceram.
-- O que é: SÓ LEITURA. Devolve (maquina, alvo_id, card_id, evento, vencimento) na ordem em que devem ser aplicados.
--          Quem aplica é o emissor motor/orquestrador/orquestrador/relogio.py, um por um, por helena_v2.aplicar_evento com
--          o papel RELOGIO. Esta função não muda nada: a guarda e o efeito continuam na tabela de passagens (0002).
-- De onde vem: helena-v2/maquina/passagens.yaml (bloco "prazos" e as linhas com papel RELOGIO), estado_def.prazo -> prazo_def.
--   1. Vencimento simples: estado aberto cujo prazo tem tratado_em nulo e origem diferente de 'espera', com
--      prazo_ate <= p_agora -> prazo_def.evento (TEMPO_ESGOTADO). Etapa só com o card ativo (regra 6).
--   2. Escada do prazo do card (estados abertos do card): PRAZO_80 em criado_em + 80% de (prazo - criado_em),
--      PRAZO_VENCIDO no prazo, PRAZO_MAIS_1H uma hora depois. Só os degraus acima de nivel_prazo; MUDAR_PRAZO zera e rearma.
--   3. Lembretes da espera INTERNA por você: LEMBRETE_24H e LEMBRETE_48H, 24 e 48 horas depois de o alvo ENTRAR no estado
--      de espera (o momento vem do histórico). Vale onde a tabela tem a escada 24h/48h (card e ação INCERTA) e, na etapa,
--      só com espera = 'INTERNA'. Só os degraus acima de lembretes.
--   NÃO entram (a especificação não diz o instante sem adivinhar): PRAZO_ESPERA_VENCIDO (o padrão), o lembrete da espera
--   externa e o da ação proposta ("antes do prazo"), AVISO_1H e ESPERA_6H (fila por capacidade).
-- Sem repetição: um (alvo, evento) que o relógio já mandou DEPOIS da última mudança APLICADA no alvo não volta. Toda
--   mudança aplicada recalcula prazo_ate; assim o mesmo vencimento nunca é devolvido duas vezes (nem vira RECUSADO a cada
--   volta), e um vencimento novo no mesmo estado (ex.: revisão reiniciada) volta a valer.
-- Como mudar: instantes e escadas moram aqui; quem pode o quê continua no YAML. Só service_role executa (como o vigia, 0016).

create or replace function helena_v2.eventos_devidos(p_agora timestamptz default clock_timestamp())
returns table (maquina text, alvo_id uuid, card_id uuid, evento text, vencimento timestamptz)
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $f$
#variable_conflict use_column
begin
  if p_agora is null or not isfinite(p_agora) then
    raise exception 'AGORA_INVALIDO: eventos_devidos precisa de um instante finito' using errcode = '22023';
  end if;
  return query
  with alvo as (
    select 'card'::text as maq, 1 as maq_ordem, c.id as alvo, c.id as card, c.estado as est, c.prazo_ate as ate,
           c.lembretes as lemb, null::text as esp
      from helena_v2.card c
    union all
    select 'etapa', 2, e.id, e.card_id, e.estado, e.prazo_ate, e.lembretes, e.espera from helena_v2.etapa e
    union all
    select 'acao_externa', 3, a.id, a.card_id, a.estado, a.prazo_ate, a.lembretes, null from helena_v2.acao_externa a
  ),
  aberto as (
    select x.*, d.prazo as prazo_nome
      from alvo x
      join helena_v2.estado_def d on d.maquina = x.maq and d.estado = x.est and not d.final
  ),
  candidato as (
    -- 1. vencimento simples (tempo da ficha, na hora, leitura de volta, recomendação, execução da ação)
    select x.maq, x.maq_ordem, x.alvo, x.card, x.est, pz.evento as ev, x.ate as venc, 0 as degrau
      from aberto x
      join helena_v2.prazo_def pz on pz.nome = x.prazo_nome
     where pz.tratado_em is null and pz.origem <> 'espera' and pz.papel = 'RELOGIO'
       and x.ate <= p_agora
    union all
    -- 2. escada do prazo do card: cada degrau dispara uma vez (nivel_prazo)
    select 'card', 1, c.id, c.id, c.estado, g.ev, g.venc, g.degrau
      from helena_v2.card c
      join helena_v2.estado_def d on d.maquina = 'card' and d.estado = c.estado and not d.final
      cross join lateral (values
        (1, 'PRAZO_80'::text, c.criado_em + (c.prazo - c.criado_em) * 0.8::float8),
        (2, 'PRAZO_VENCIDO'::text, c.prazo),
        (3, 'PRAZO_MAIS_1H'::text, c.prazo + interval '1 hour')) g(degrau, ev, venc)
     where c.nivel_prazo < g.degrau and g.venc <= p_agora
    union all
    -- 3. lembretes da espera interna: 24 h e 48 h depois de entrar no estado de espera
    select x.maq, x.maq_ordem, x.alvo, x.card, x.est, g.ev, ent.momento + g.depois, g.degrau
      from aberto x
      join helena_v2.prazo_def pz on pz.nome = x.prazo_nome and pz.origem = 'espera'
      cross join lateral (
        select h.momento, h.estado_depois from helena_v2.historico h
         where h.alvo_id = x.alvo and h.resultado in ('APLICADO', 'CONVERTIDO')
           and h.estado_antes is distinct from h.estado_depois
         order by h.id desc limit 1) ent
      cross join lateral (values
        (1, 'LEMBRETE_24H'::text, interval '24 hours'),
        (2, 'LEMBRETE_48H'::text, interval '48 hours')) g(degrau, ev, depois)
     where ent.estado_depois = x.est
       and x.lemb < g.degrau and ent.momento + g.depois <= p_agora
       and (x.maq <> 'etapa' or x.esp = 'INTERNA')
       and exists (select 1 from helena_v2.passagem p
                    where p.maquina = x.maq and p.de = x.est and p.papel = 'RELOGIO' and p.evento = 'LEMBRETE_48H')
  )
  select k.maq, k.alvo, k.card, k.ev, k.venc
    from candidato k
    join helena_v2.card cc on cc.id = k.card
   -- a tabela tem linha do RELOGIO para este evento neste estado
   where exists (select 1 from helena_v2.passagem p
                  where p.maquina = k.maq and p.de = k.est and p.papel = 'RELOGIO' and p.evento = k.ev)
     -- regra 6: etapa só anda com o card ativo
     and (k.maq <> 'etapa' or cc.estado in (
           select jsonb_array_elements_text(g.valor -> 'card_ativo') from helena_v2.regra_geral g
            where g.chave = 'etapa_so_anda_com_card_ativo'))
     -- sem repetição: nada do mesmo evento mandado pelo relógio depois da última mudança aplicada no alvo
     and not exists (
           select 1 from helena_v2.historico h
            where h.alvo_id = k.alvo and h.papel = 'RELOGIO' and h.evento = k.ev
              and h.id > coalesce((select max(u.id) from helena_v2.historico u
                                    where u.alvo_id = k.alvo and u.resultado in ('APLICADO', 'CONVERTIDO')), 0))
   order by k.venc, k.card, k.maq_ordem, k.alvo, k.degrau;
end;
$f$;

comment on function helena_v2.eventos_devidos(timestamptz) is
  'Relógio dos prazos (só leitura): eventos RELOGIO devidos em p_agora, na ordem de aplicar. Ver 0017_relogio.sql.';

revoke execute on function helena_v2.eventos_devidos(timestamptz) from public, anon, authenticated;
grant execute on function helena_v2.eventos_devidos(timestamptz) to service_role;
