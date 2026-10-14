# -*- coding: utf-8 -*-
"""O relógio dos prazos (0017): helena_v2.eventos_devidos(p_agora) diz o que venceu; aplicar_evento (papel RELOGIO) aplica.

O que é: viagem no tempo passando p_agora. Cada evento aparece no instante certo (e não um microssegundo antes), não
reaparece depois de aplicado (nem depois de RECUSADO), não sai para alvo em estado errado, só service_role executa e,
aplicado de verdade, muda o estado e os contadores como a tabela de passagens manda.
Como mudar: instante novo no 0017 ganha caso aqui. Banco: testes/integral.py (todas as migrations, forma do canônico).
"""
from datetime import datetime, timedelta, timezone

import pytest
from psycopg import errors as E
from psycopg.types.json import Jsonb

import ajudas as A
import sorteio as S
from integral import banco_integral

VOCAB, TAB = A.carregar_yaml()
US = timedelta(microseconds=1)
ETAPA = dict(S.ROTEIRO_UMA_ETAPA["etapas"][0], tempo_maximo_s=900, prazo_revisao_s=1200)
ROTEIRO = {"etapas": [ETAPA]}
ROTEIRO_EXTERNA = {"etapas": [dict(ETAPA, prazo_de_terceiro=True)]}
ESPERA = {"LEMBRETE_24H", "LEMBRETE_48H", "PRAZO_ESPERA_VENCIDO"}


@pytest.fixture(scope="module")
def bi(servidor):
    with banco_integral(servidor) as banco:
        yield banco


@pytest.fixture()
def con(bi):
    c = bi.conectar()
    yield c
    c.close()


class Mundo(A.Mundo):
    """O Mundo dos testes, com o prazo do card relativo a agora (10 dias), para a escada não depender da data do dia."""

    def criar(self, canal, numero, pedido_grande):
        r = self.chamar("select helena_v2.criar_card(%s, %s, %s, %s, now() + interval '10 days', %s, %s, %s, %s, %s)",
                        (canal, numero, "mensagem de teste", "card do relógio", Jsonb(self.roteiro), "eLiving™",
                         Jsonb({}), 0, pedido_grande))
        return r["card_id"]


def novo(con, roteiro=ROTEIRO, pedido_grande=False):
    return Mundo(con, {"id": "relogio", "roteiro": roteiro, "automatico": False,
                       "card": {"pedido_grande": pedido_grande}}, VOCAB, TAB)


def devidos(con, agora, card=None):
    """[(maquina, alvo_id, evento, vencimento)] na ordem devolvida, só do card pedido."""
    linhas = con.execute("""select t.maquina, t.alvo_id, t.card_id, t.evento, t.vencimento
                              from helena_v2.eventos_devidos(%s) with ordinality
                                   as t(maquina, alvo_id, card_id, evento, vencimento, n) order by t.n""", (agora,)).fetchall()
    return [(m, str(a), e, v) for m, a, c, e, v in linhas if card is None or str(c) == str(card)]


def pelo_relogio(con, maquina, alvo, evento, automaticos=False):
    return con.execute("""select helena_v2.aplicar_evento(%s, %s, 'RELOGIO', %s, p_automaticos => %s,
                                                         p_nao_disparar => array['PLANO_VALIDO'])""",
                       (maquina, alvo, evento, automaticos)).fetchone()[0]


def um(con, sql, args=()):
    return con.execute(sql, args).fetchone()[0]


def entrada(con, alvo, estado):
    return um(con, """select momento from helena_v2.historico where alvo_id = %s and estado_depois = %s
                        and estado_antes is distinct from estado_depois and resultado = 'APLICADO' order by id desc limit 1""",
              (alvo, estado))


# ---------------------------------------------------------------------------------------------- nada vencido
def test_nada_vencido_devolve_vazio(con):
    m = novo(con)
    c = m.linhas("select * from helena_v2.card where id = %s", (m.card,))[0]
    assert c["estado"] == "RASCUNHO"
    assert devidos(con, c["criado_em"], m.card) == []
    assert devidos(con, c["prazo_ate"] - US, m.card) == []        # leitura de volta: 15 min, ainda não
    m.em_andamento()
    assert devidos(con, c["prazo_ate"] + timedelta(days=7), m.card) == []   # 80% do prazo de 10 dias só no 8º dia


# ---------------------------------------------------------------------------------------------- 1. vencimento simples
def test_tempo_esgotado_no_instante_certo_no_card_e_na_etapa(con):
    m = novo(con)
    ate = um(con, "select prazo_ate from helena_v2.card where id = %s", (m.card,))
    assert devidos(con, ate - US, m.card) == []
    assert devidos(con, ate, m.card) == [("card", m.card, "TEMPO_ESGOTADO", ate)]

    m.em_andamento()
    m.executando("E1")
    e1 = m.linha_da_etapa("E1")
    assert e1["estado"] == "EXECUTANDO"
    assert e1["prazo_ate"] - e1["atualizado_em"] == timedelta(seconds=900)       # o tempo da ficha
    assert devidos(con, e1["prazo_ate"] - US, m.card) == []
    assert devidos(con, e1["prazo_ate"], m.card) == [("etapa", str(e1["id"]), "TEMPO_ESGOTADO", e1["prazo_ate"])]

    m.entregar("E1")
    e1 = m.linha_da_etapa("E1")
    assert e1["estado"] == "VALIDACAO"                                             # na hora: 60 s
    assert devidos(con, e1["prazo_ate"] - US, m.card) == []
    assert devidos(con, e1["prazo_ate"], m.card) == [("etapa", str(e1["id"]), "TEMPO_ESGOTADO", e1["prazo_ate"])]


# ---------------------------------------------------------------------------------------------- 2. escada do card
def test_escada_do_prazo_do_card_cada_degrau_uma_vez_e_mudar_prazo_rearma(con):
    m = novo(con)
    m.em_andamento()
    p80, prazo = con.execute("select criado_em + (prazo - criado_em) * 0.8::float8, prazo from helena_v2.card where id = %s",
                             (m.card,)).fetchone()
    c = m.card
    assert devidos(con, p80 - US, c) == []
    assert devidos(con, p80, c) == [("card", c, "PRAZO_80", p80)]
    assert devidos(con, prazo, c) == [("card", c, "PRAZO_80", p80), ("card", c, "PRAZO_VENCIDO", prazo)]
    mais1h = prazo + timedelta(hours=1)
    assert devidos(con, mais1h - US, c) == [("card", c, "PRAZO_80", p80), ("card", c, "PRAZO_VENCIDO", prazo)]
    assert devidos(con, mais1h, c) == [("card", c, "PRAZO_80", p80), ("card", c, "PRAZO_VENCIDO", prazo),
                                       ("card", c, "PRAZO_MAIS_1H", mais1h)]
    for (_m, _a, evento, _v), linha, nivel in zip(devidos(con, mais1h, c), ("C23", "C24", "C25"), (1, 2, 3)):
        r = pelo_relogio(con, "card", c, evento)
        assert r["resultado"] == "APLICADO" and r["linha"] == f"{linha}@EM_ANDAMENTO", r
        assert um(con, "select nivel_prazo from helena_v2.card where id = %s", (c,)) == nivel
    assert devidos(con, mais1h + timedelta(days=30), c) == []                     # cada degrau disparou uma vez

    # o fundador muda o prazo: os 3 avisos rearmam para o prazo novo
    versao = um(con, "select versao from helena_v2.card where id = %s", (c,))
    novo_prazo = datetime.now(timezone.utc) + timedelta(days=20)
    r = con.execute("""select helena_v2.aplicar_evento('card', %s, 'FUNDADOR', 'MUDAR_PRAZO', '{}'::jsonb, null, null, %s, %s,
                                                       p_automaticos => false)""",
                    (c, versao, Jsonb({"prazo": novo_prazo.isoformat()}))).fetchone()[0]
    assert r["resultado"] == "APLICADO" and r["linha"] == "C26@EM_ANDAMENTO", r
    n80, prazo2, nivel = con.execute("""select criado_em + (prazo - criado_em) * 0.8::float8, prazo, nivel_prazo
                                          from helena_v2.card where id = %s""", (c,)).fetchone()
    assert nivel == 0 and prazo2 > prazo
    assert devidos(con, mais1h + timedelta(days=1), c) == []                      # o prazo velho não vale mais
    assert devidos(con, prazo2, c) == [("card", c, "PRAZO_80", n80), ("card", c, "PRAZO_VENCIDO", prazo2)]


# ---------------------------------------------------------------------------------------------- sem repetição
def test_aplicado_nao_reaparece_e_recusado_nao_vira_linha_a_cada_volta(con):
    m = novo(con)
    ate = um(con, "select prazo_ate from helena_v2.card where id = %s", (m.card,))
    r = pelo_relogio(con, "card", m.card, devidos(con, ate, m.card)[0][2])
    assert r["resultado"] == "APLICADO" and r["linha"] == "C05", r
    c = m.linhas("select estado, motivo from helena_v2.card where id = %s", (m.card,))[0]
    assert c == {"estado": "ESPERANDO_CONFIRMACAO", "motivo": "HELENA_FALHOU"}
    assert devidos(con, ate, m.card) == []

    # revisão sem revisor iniciado (exec_viva 0): a tabela não tem saída do relógio; uma recusa só, não uma por volta
    n = novo(con)
    n.em_andamento()
    n.executando("E1")
    n.entregar("E1")
    assert n.um("MOTOR", "PORTAO1_OK", "E1")["resultado"] == "APLICADO"
    e1 = n.linha_da_etapa("E1")
    assert (e1["estado"], e1["exec_viva"]) == ("REVISAO", 0)
    alvo = str(e1["id"])
    assert devidos(con, e1["prazo_ate"], n.card) == [("etapa", alvo, "TEMPO_ESGOTADO", e1["prazo_ate"])]
    r = pelo_relogio(con, "etapa", alvo, "TEMPO_ESGOTADO")
    assert r["resultado"] == "RECUSADO" and r["motivo"] == "SEM_PASSAGEM_NESTE_ESTADO", r
    for depois in (timedelta(0), timedelta(days=1)):
        assert [d for d in devidos(con, e1["prazo_ate"] + depois, n.card) if d[0] == "etapa"] == []
    assert um(con, "select count(*) from helena_v2.historico where alvo_id = %s and papel = 'RELOGIO'", (alvo,)) == 1
    # o revisor começa: a mudança aplicada recalcula o vencimento e o relógio volta a valer para o vencimento novo
    assert n.um("MOTOR", "INICIAR_REVISAO", "E1")["resultado"] == "APLICADO"
    e1 = n.linha_da_etapa("E1")
    assert e1["exec_viva"] == 1
    assert devidos(con, e1["prazo_ate"] - US, n.card) == []
    assert devidos(con, e1["prazo_ate"], n.card) == [("etapa", alvo, "TEMPO_ESGOTADO", e1["prazo_ate"])]
    r = pelo_relogio(con, "etapa", alvo, "TEMPO_ESGOTADO")
    assert r["resultado"] == "APLICADO" and r["linha"] == "E65", r
    e1 = n.linha_da_etapa("E1")
    assert (e1["estado"], e1["tempo"], e1["exec_viva"]) == ("REVISAO", 1, 0)


# ---------------------------------------------------------------------------------------------- estado errado
def test_alvo_em_estado_errado_nao_e_emitido(con):
    m = novo(con)
    m.em_andamento()
    assert m.um("MOTOR", "DEPENDENCIAS_PRONTAS", "E1")["resultado"] == "APLICADO"
    e1 = m.linha_da_etapa("E1")
    prazo = um(con, "select prazo from helena_v2.card where id = %s", (m.card,))
    assert e1["estado"] == "NA_FILA" and e1["prazo_ate"] == prazo                  # o prazo da fila é o do card
    longe = prazo + timedelta(days=30)
    assert {d[0] for d in devidos(con, longe, m.card)} == {"card"}                # a etapa na fila não recebe evento
    assert {d[2] for d in devidos(con, longe, m.card)} == {"PRAZO_80", "PRAZO_VENCIDO", "PRAZO_MAIS_1H"}
    assert m.um("FUNDADOR", "CANCELAR", "card")["resultado"] == "APLICADO"
    assert m.estado_da("card") == "CANCELADO" and m.estado_da("E1") == "CANCELADA"
    assert devidos(con, longe, m.card) == []                                       # final não tem prazo


# ---------------------------------------------------------------------------------------------- 3. espera por você
def test_lembretes_da_espera_interna_e_nada_na_externa_nem_padrao(con):
    m = novo(con, pedido_grande=True)
    assert m.um("HELENA", "LER_DE_VOLTA", "card")["linha"] == "C01"
    t0 = entrada(con, m.card, "ESPERANDO_CONFIRMACAO")
    c = m.card
    assert devidos(con, t0 + timedelta(hours=24) - US, c) == []
    assert devidos(con, t0 + timedelta(hours=24), c) == [("card", c, "LEMBRETE_24H", t0 + timedelta(hours=24))]
    assert devidos(con, t0 + timedelta(hours=48), c) == [("card", c, "LEMBRETE_24H", t0 + timedelta(hours=24)),
                                                          ("card", c, "LEMBRETE_48H", t0 + timedelta(hours=48))]
    for evento, linha in (("LEMBRETE_24H", "C07"), ("LEMBRETE_48H", "C08")):
        r = pelo_relogio(con, "card", c, evento)
        assert r["resultado"] == "APLICADO" and r["linha"] == f"{linha}@ESPERANDO_CONFIRMACAO", r
    assert um(con, "select lembretes from helena_v2.card where id = %s", (c,)) == 2
    # o padrão (PRAZO_ESPERA_VENCIDO) não sai: o instante não está na especificação
    assert [d for d in devidos(con, t0 + timedelta(hours=1000), c) if d[2] in ESPERA] == []

    # etapa: pergunta interna -> 24 h e 48 h
    n = novo(con)
    n.em_andamento()
    n.executando("E1")
    assert n.um("AUTOR", "PERGUNTAR", "E1", {"usou_internet": "NAO"})["linha"] == "E21"
    e1 = n.linha_da_etapa("E1")
    assert (e1["estado"], e1["espera"]) == ("ESPERANDO_FUNDADOR", "INTERNA")
    alvo, t1 = str(e1["id"]), entrada(con, e1["id"], "ESPERANDO_FUNDADOR")
    assert devidos(con, t1 + timedelta(hours=24) - US, n.card) == []
    assert devidos(con, t1 + timedelta(hours=24), n.card) == [("etapa", alvo, "LEMBRETE_24H", t1 + timedelta(hours=24))]
    assert pelo_relogio(con, "etapa", alvo, "LEMBRETE_24H")["linha"] == "E89"
    assert devidos(con, t1 + timedelta(hours=24), n.card) == []
    assert devidos(con, t1 + timedelta(hours=48), n.card) == [("etapa", alvo, "LEMBRETE_48H", t1 + timedelta(hours=48))]
    assert pelo_relogio(con, "etapa", alvo, "LEMBRETE_48H")["linha"] == "E90"
    assert n.linha_da_etapa("E1")["lembretes"] == 2
    assert [d for d in devidos(con, t1 + timedelta(hours=1000), n.card) if d[0] == "etapa"] == []

    # etapa: pergunta com prazo de terceiro (externa) -> nenhum lembrete (o instante "antes do prazo" não está escrito)
    x = novo(con, ROTEIRO_EXTERNA)
    x.em_andamento()
    x.executando("E1")
    assert x.um("AUTOR", "PERGUNTAR", "E1", {"usou_internet": "NAO"})["linha"] == "E120"
    assert x.linha_da_etapa("E1")["espera"] == "EXTERNA"
    assert [d for d in devidos(con, datetime.now(timezone.utc) + timedelta(hours=1000), x.card) if d[0] == "etapa"] == []


def test_acao_externa_ok_vencido_execucao_sem_confirmacao_e_incerta(con):
    m = novo(con)
    m.em_andamento()
    m.ate_aprovada("E1", acao="PELO_MOTOR")
    m.um("MOTOR", "TODAS_PRONTAS", "card")
    assert m.estado_da("card") == "PRONTO"
    a1 = m.acao_id("A1")
    longe = datetime.now(timezone.utc) + timedelta(hours=1000)
    assert devidos(con, longe, m.card) == []                       # PROPOSTA: lembrete "antes do prazo" não sai (NÃO FEITO)
    assert m.um("FUNDADOR", "APROVAR", "A1")["linha"] == "X01"
    ate = um(con, "select prazo_ate from helena_v2.acao_externa where id = %s", (a1,))
    assert devidos(con, ate - US, m.card) == []
    assert devidos(con, ate, m.card) == [("acao_externa", str(a1), "TEMPO_ESGOTADO", ate)]   # o ok vence em 60 s
    assert m.um("MOTOR", "EXECUTAR_ACAO", "A1")["linha"] == "X10"
    ate = um(con, "select prazo_ate from helena_v2.acao_externa where id = %s", (a1,))
    assert devidos(con, ate, m.card) == [("acao_externa", str(a1), "TEMPO_ESGOTADO", ate)]
    r = pelo_relogio(con, "acao_externa", a1, "TEMPO_ESGOTADO")
    assert r["resultado"] == "APLICADO" and r["linha"] == "X22" and r["estado"] == "INCERTA", r
    t0 = entrada(con, a1, "INCERTA")
    assert devidos(con, t0 + timedelta(hours=48), m.card) == [
        ("acao_externa", str(a1), "LEMBRETE_24H", t0 + timedelta(hours=24)),
        ("acao_externa", str(a1), "LEMBRETE_48H", t0 + timedelta(hours=48))]
    assert [pelo_relogio(con, "acao_externa", a1, e)["linha"] for e in ("LEMBRETE_24H", "LEMBRETE_48H")] == ["X32", "X33"]
    assert devidos(con, t0 + timedelta(hours=1000), m.card) == []          # sem o padrão: fica esperando você


# ---------------------------------------------------------------------------------------------- permissões e só leitura
def test_so_service_role_executa_e_a_funcao_so_le(bi, con):
    funcao = "helena_v2.eventos_devidos(timestamp with time zone)"
    for papel in ("public", "anon", "authenticated", "h2t_curioso"):
        assert um(con, "select has_function_privilege(%s, %s, 'execute')", (papel, funcao)) is False, papel
    assert um(con, "select has_function_privilege('service_role', %s, 'execute')", (funcao,)) is True
    definer, volatil, config = con.execute("select prosecdef, provolatile, proconfig from pg_proc where oid = %s::regprocedure",
                                           (funcao,)).fetchone()
    assert definer is True and volatil == "s" and config == ["search_path=pg_catalog, pg_temp"]
    for papel in ("anon", "authenticated"):
        with bi.conectar(papel) as outro, pytest.raises(E.InsufficientPrivilege):
            outro.execute("select * from helena_v2.eventos_devidos()")
    with bi.conectar("service_role") as servico:
        servico.execute("begin transaction read only")
        servico.execute("select * from helena_v2.eventos_devidos()").fetchall()
        servico.execute("select * from helena_v2.eventos_devidos(now() + interval '3650 days')").fetchall()
        servico.execute("rollback")
        with pytest.raises(E.InvalidParameterValue, match="AGORA_INVALIDO"):
            servico.execute("select * from helena_v2.eventos_devidos(null)")
        with pytest.raises(E.InvalidParameterValue, match="AGORA_INVALIDO"):
            servico.execute("select * from helena_v2.eventos_devidos('infinity')")


# ---------------------------------------------------------------------------------------------- aplicar de verdade
def test_aplicar_de_verdade_como_service_role_ate_nao_sobrar_nada(bi, con):
    m = novo(con)
    agora = um(con, "select prazo from helena_v2.card where id = %s", (m.card,))   # o relógio ficou parado 10 dias
    voltas = []
    with bi.conectar("service_role") as servico:
        for _ in range(5):
            lote = devidos(servico, agora, m.card)
            if not lote:
                break
            voltas.append([d[2] for d in lote])
            for maquina, alvo, evento, _venc in lote:
                r = servico.execute("""select helena_v2.aplicar_evento(%s, %s, 'RELOGIO', %s,
                                                                       p_nao_disparar => array['PLANO_VALIDO'])""",
                                    (maquina, alvo, evento)).fetchone()[0]
                assert r["resultado"] == "APLICADO", (evento, r)
    assert voltas == [["TEMPO_ESGOTADO", "PRAZO_80", "PRAZO_VENCIDO"], ["LEMBRETE_24H", "LEMBRETE_48H"]]
    c = m.linhas("select estado, motivo, nivel_prazo, lembretes from helena_v2.card where id = %s", (m.card,))[0]
    assert c == {"estado": "ESPERANDO_CONFIRMACAO", "motivo": "HELENA_FALHOU", "nivel_prazo": 2, "lembretes": 2}
    assert m.linhas("""select linha_id, conta from helena_v2.historico where card_id = %s and papel = 'RELOGIO' order by id""",
                    (m.card,)) == [{"linha_id": l, "conta": "service_role"} for l in
                                   ("C05", "C23@ESPERANDO_CONFIRMACAO", "C24@ESPERANDO_CONFIRMACAO",
                                    "C07@ESPERANDO_CONFIRMACAO", "C08@ESPERANDO_CONFIRMACAO")]
    assert con.execute("select * from helena_v2.conferir_historico(%s)", (m.card,)).fetchall() == []
    # mais uma hora: só o último degrau do prazo; o padrão da espera nunca sai sozinho
    assert devidos(con, agora + timedelta(hours=1), m.card) == [("card", m.card, "PRAZO_MAIS_1H", agora + timedelta(hours=1))]
