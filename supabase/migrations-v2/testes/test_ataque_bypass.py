# -*- coding: utf-8 -*-
"""(g) Ataque 2: tentar furar a função única e as 13 regras. Tudo aqui é regressão: o banco recusou.

O QUE É: casos de ataque que o banco aguentou (escrita direta, papel de outra pessoa, chave velha, JSON malformado,
texto com aspas e SQL, variável de sessão forjada por papel comum, funções internas, regras de ferro).
O que o banco NÃO aguentou não está aqui: foi para o relato do ataque (achados), para não deixar teste vermelho no CI.
DE ONDE VEM: escrito à mão, usa só as ajudas dos outros testes. Nenhuma regra mora aqui: quem decide é o banco.
COMO MUDAR: caso novo = uma função test_ nova. Se um achado for corrigido no SQL, o teste dele entra aqui.
"""
import pytest
from psycopg import errors as E
from psycopg.types.json import Jsonb

import test_05_regras as R

PARAMS_ENTREGA = {"parecer": "OK", "acao_externa": "NENHUMA", "usou_internet": "NAO"}
GUCS = {"helena_v2.funcao_unica": "sim", "helena_v2.profundidade": "5", "helena_v2.papel_evento": "FUNDADOR",
        "helena_v2.evento_atual": "APROVAR", "helena_v2.campo_do_fundador": "sim", "helena_v2.migrando": "sim"}


def _card_executando(con):
    m = R.novo(con)
    m.em_andamento()
    m.executando()
    et = m.etapa_id("E1")
    chave = m.chamar("select execucao_atual from helena_v2.etapa where id = %s", (et,))
    return m, et, chave


def _n_historico(con, card):
    return con.execute("select count(*) from helena_v2.historico where card_id = %s", (card,)).fetchone()[0]


def _aplicar(c, maq, alvo, papel, evento, params=None, ator=None, chave=None, vv=None, cont=None, toque=None):
    return c.execute("select helena_v2.aplicar_evento(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                     (maq, alvo, papel, evento, Jsonb(params if params is not None else {}), ator, chave, vv,
                      Jsonb(cont) if cont is not None else None, toque)).fetchone()[0]


# ------------------------------------------------------------------ escrita por fora
@pytest.mark.parametrize("papel", ["authenticated", "service_role", "h2t_curioso"])
def test_papel_comum_nao_trava_nem_altera_a_estrutura(banco, con, papel):
    m = R.novo(con)
    with banco.conectar(papel) as c:
        c.execute("begin")
        with pytest.raises(E.InsufficientPrivilege):
            c.execute("lock table helena_v2.card in access exclusive mode")
        c.execute("rollback")
        for comando in ("select * from helena_v2.card for update",
                        "alter table helena_v2.card disable trigger all",
                        "drop trigger a_so_pela_funcao on helena_v2.card",
                        "alter table helena_v2.etapa drop constraint ck_etapa_regra04_revisor",
                        "create table helena_v2.intruso (x int)",
                        "create or replace function helena_v2.aplicar_evento() returns void language sql as 'select 1'",
                        "alter function helena_v2.aplicar_evento(text, uuid, text, text, jsonb, text, bigint, integer, jsonb, text, boolean, text[], timestamptz) security invoker",
                        "set session_replication_role = replica"):
            with pytest.raises((E.InsufficientPrivilege, E.UndefinedFunction, E.WrongObjectType)):
                c.execute(comando)
        try:
            c.execute("grant all on helena_v2.card to public")      # de quem não é dono, só dá aviso: nada é concedido
        except E.InsufficientPrivilege:
            pass
    assert con.execute("select has_table_privilege('public', 'helena_v2.card', 'update')").fetchone()[0] is False
    assert m.estado_da("card") == "RASCUNHO"


def test_variavel_de_sessao_forjada_por_papel_comum_nao_abre_nada(banco, con):
    m = R.novo(con)
    m.em_andamento()
    antes = m.chamar("select count(*) from helena_v2.historico where card_id = %s", (m.card,))
    for papel in ("authenticated", "service_role"):
        with banco.conectar(papel) as c:
            for g, v in GUCS.items():
                c.execute("select set_config(%s, %s, false)", (g, v))
            for comando in ("update helena_v2.card set estado = 'PRONTO'", "delete from helena_v2.historico",
                            "update helena_v2.passagem set para = 'PRONTO'", "truncate helena_v2.historico",
                            "insert into helena_v2.card (titulo, prazo, estado, dono, prazo_ate) values ('x', now(), 'PRONTO', null, null)"):
                with pytest.raises(E.InsufficientPrivilege):
                    c.execute(comando)
            with pytest.raises(E.InsufficientPrivilege):
                c.execute("select helena_v2.selar_tabela()")
            with pytest.raises(E.InsufficientPrivilege):
                c.execute("select helena_v2._entrar()")
    assert m.chamar("select count(*) from helena_v2.historico where card_id = %s", (m.card,)) == antes
    assert m.chamar("select helena_v2.tabela_confere()") is True


def test_variavel_de_sessao_forjada_nao_muda_o_resultado_de_uma_chamada_permitida(banco, con):
    """O fundador forja o papel e o evento antes de chamar: a função grava os dela por cima, e o que era proibido continua proibido."""
    m = R.novo(con)
    m.em_andamento()
    with banco.conectar("authenticated") as c:
        for g, v in GUCS.items():
            c.execute("select set_config(%s, %s, false)", (g, v))
        with pytest.raises(E.InsufficientPrivilege, match="PAPEL_NAO_PERMITIDO"):
            _aplicar(c, "etapa", m.etapa_id("E1"), "REVISOR", "APROVAR", ator="CLARA", chave=1)
        r = _aplicar(c, "card", m.card, "FUNDADOR", "MUDAR_PRIORIDADE", cont={"prioridade": 7}, vv=m.versao_do_alvo("card", m.card))
        assert r["resultado"] in ("APLICADO", "REACAO")
    assert m.chamar("select prioridade from helena_v2.card where id = %s", (m.card,)) == 7


def test_funcoes_de_seguranca_definer_tem_caminho_fixo_e_ninguem_chama_as_internas(banco, con):
    sem_caminho = con.execute("""select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'helena_v2' and p.prosecdef and not coalesce(p.proconfig::text ilike '%search_path%', false)""").fetchall()
    assert sem_caminho == []
    quem_chama = con.execute("""select p.proname, r from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
        unnest(array['public', 'anon', 'authenticated', 'service_role']) r
        where n.nspname = 'helena_v2' and (p.proname like '\\_%' or p.proname like 'trg\\_%' or p.proname in ('selar_tabela', 'guarda'))
          and has_function_privilege(r, p.oid, 'execute')""").fetchall()
    assert quem_chama == []
    anon_ou_public = con.execute("""select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'helena_v2' and (has_function_privilege('public', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))""").fetchall()
    assert anon_ou_public == []


# ------------------------------------------------------------------ papel de outra pessoa, chave velha
def test_cada_conta_so_diz_o_papel_que_tem_mesmo_com_escrita_estranha(banco, con):
    m, et, chave = _card_executando(con)
    n = _n_historico(con, m.card)
    with banco.conectar("authenticated") as app:
        for papel in ("MOTOR", "AUTOR", "REVISOR", "HELENA", "RELOGIO", "VIGIA", "", "motor", "fundador", "FUNDADOR ", "FUNDADOR'--", None):
            with pytest.raises(E.InsufficientPrivilege, match="PAPEL_NAO_PERMITIDO"):
                _aplicar(app, "card", m.card, papel, "CANCELAR")
    with banco.conectar("service_role") as motor:
        with pytest.raises(E.InsufficientPrivilege, match="PAPEL_NAO_PERMITIDO"):
            _aplicar(motor, "card", m.card, "FUNDADOR", "CANCELAR")
    assert _n_historico(con, m.card) == n and m.estado_da("card") == "EM_ANDAMENTO"


def test_chave_velha_futura_nula_negativa_ou_de_outra_etapa_nao_grava(banco, con):
    m, et, chave = _card_executando(con)
    outro = R.novo(con)
    outro.em_andamento()
    outro.executando()
    chave_outro = outro.chamar("select execucao_atual from helena_v2.etapa where id = %s", (outro.etapa_id("E1"),))
    with banco.conectar("service_role") as motor:
        for k in (chave - 1, chave + 100, None, -1, chave_outro):
            r = _aplicar(motor, "etapa", et, "AUTOR", "ENTREGAR", PARAMS_ENTREGA, "CAIO", k)
            assert r["resultado"] == "RECUSADO"
        # o autor errado com a chave certa também não grava; o revisor com a chave do autor também não
        assert _aplicar(motor, "etapa", et, "AUTOR", "ENTREGAR", PARAMS_ENTREGA, "HELENA", chave)["resultado"] == "RECUSADO"
        assert _aplicar(motor, "etapa", et, "REVISOR", "APROVAR", {}, "CLARA", chave)["resultado"] == "RECUSADO"
    assert m.estado_da("E1") == "EXECUTANDO"
    with banco.conectar("service_role") as motor:
        assert _aplicar(motor, "etapa", et, "AUTOR", "ENTREGAR", PARAMS_ENTREGA, "CAIO", chave)["resultado"] == "APLICADO"
        # a mesma chave uma segunda vez: morreu
        assert _aplicar(motor, "etapa", et, "AUTOR", "ENTREGAR", PARAMS_ENTREGA, "CAIO", chave)["resultado"] == "RECUSADO"
    assert m.chamar("select count(*) from helena_v2.entrega where etapa_id = %s", (et,)) == 1


def test_etapa_nao_anda_com_o_card_cancelado_e_final_nao_volta(banco, con):
    m, et, chave = _card_executando(con)
    with banco.conectar("authenticated") as app:
        assert _aplicar(app, "card", m.card, "FUNDADOR", "CANCELAR", vv=m.versao_do_alvo("card", m.card))["resultado"] == "APLICADO"
    with banco.conectar("service_role") as motor:
        for evento, papel, params in (("ENTREGAR", "AUTOR", PARAMS_ENTREGA), ("INICIAR_EXECUCAO", "MOTOR", {}), ("PLANO_VALIDO", "MOTOR", {})):
            alvo = ("etapa", et) if papel == "AUTOR" or evento == "INICIAR_EXECUCAO" else ("card", m.card)
            r = _aplicar(motor, alvo[0], alvo[1], papel, evento, params, "CAIO" if papel == "AUTOR" else None, chave)
            assert r["resultado"] == "RECUSADO"
    assert m.estado_da("card") == "CANCELADO" and m.estado_da("E1") == "CANCELADA"


# ------------------------------------------------------------------ JSON malformado e texto com SQL
@pytest.mark.parametrize("params", [[], "x", None, 5, True, {"parecer": 1, "acao_externa": "NENHUMA", "usou_internet": "NAO"},
                                    {"parecer": {"a": 1}, "acao_externa": "NENHUMA", "usou_internet": "NAO"},
                                    {"parecer": None, "acao_externa": "NENHUMA", "usou_internet": "NAO"},
                                    {**PARAMS_ENTREGA, "extra": "x"}, {"parecer": "OK"},
                                    {"parecer": "OK'; drop table helena_v2.card;--", "acao_externa": "NENHUMA", "usou_internet": "NAO"}])
def test_parametro_malformado_ou_com_sql_e_recusado_sem_mexer_no_estado(banco, con, params):
    m, et, chave = _card_executando(con)
    with banco.conectar("service_role") as motor:
        r = _aplicar(motor, "etapa", et, "AUTOR", "ENTREGAR", params, "CAIO", chave)
    assert r["resultado"] in ("RECUSADO", "CONVERTIDO")       # resposta torta do autor vira FORMATO_ERRADO, nunca entrega
    assert m.estado_da("E1") in ("EXECUTANDO", "NA_FILA") and m.chamar("select count(*) from helena_v2.entrega where etapa_id = %s", (et,)) == 0
    assert m.chamar("select to_regclass('helena_v2.card') is not null")


def test_texto_com_aspas_e_sql_nos_outros_campos_e_so_texto(banco, con):
    m, et, chave = _card_executando(con)
    sujo = "x'); drop table helena_v2.card;--"
    with banco.conectar("service_role") as motor:
        for maquina in (sujo, "card; drop table helena_v2.card", "ETAPA"):
            with pytest.raises(Exception):
                _aplicar(motor, maquina, et, "MOTOR", "INICIAR_EXECUCAO")
        r = _aplicar(motor, "etapa", et, "MOTOR", sujo)
        assert r["motivo"] == "FORA_DO_VOCABULARIO"
        with pytest.raises(E.InsufficientPrivilege, match="PAPEL_NAO_PERMITIDO"):
            _aplicar(motor, "etapa", et, sujo, "ENTREGAR")
        assert _aplicar(motor, "etapa", et, "AUTOR", "ENTREGAR", PARAMS_ENTREGA, sujo, chave)["resultado"] == "RECUSADO"
        r = _aplicar(motor, "etapa", et, "AUTOR", "ENTREGAR", PARAMS_ENTREGA, "CAIO", chave, cont={"resposta": sujo}, toque=sujo)
        assert r["resultado"] == "APLICADO"
    assert m.chamar("select conteudo ->> 'resposta' from helena_v2.entrega where etapa_id = %s", (et,)) == sujo
    assert m.chamar("select numero_toque from helena_v2.historico where card_id = %s and numero_toque is not null", (m.card,)) == sujo
    for t in ("card", "etapa", "historico", "entrega", "passagem"):
        assert m.chamar("select to_regclass(%s) is not null", (f"helena_v2.{t}",))


def test_criar_card_com_texto_sujo_guarda_texto_e_roteiro_malformado_nao_deixa_resto(banco, con):
    sujo = "o'rei'; drop table helena_v2.card;--"
    with banco.conectar("authenticated") as app:
        r = app.execute("select helena_v2.criar_card(%s, %s, %s, %s, now() + interval '3 day', %s, %s)",
                        (sujo, sujo, sujo, sujo, Jsonb(R.UMA), sujo)).fetchone()[0]
        assert r["novo"] is True
        n_cards = con.execute("select count(*) from helena_v2.card").fetchone()[0]
        n_msgs = con.execute("select count(*) from helena_v2.mensagem").fetchone()[0]
        for i, roteiro in enumerate(([], "x", None, {"etapas": "x"}, {"etapas": []}, {"etapas": [1]}, {"etapas": [{"id": "E1"}]},
                                     {"etapas": [{"id": "e1; drop", "autor": "CAIO", "revisores": []}]},
                                     {"etapas": [{"id": "E1", "autor": "FUNDADOR", "revisores": []}]},
                                     {"etapas": [{"id": "E1", "autor": "CAIO", "revisores": ["NINGUEM"]}]},
                                     {"etapas": [{"id": "E1", "autor": "CAIO", "revisores": [], "depende_de": ["E1"]}]},
                                     {"etapas": [{"id": "E1", "autor": "CAIO", "revisores": [], "julga": ["E9"]}]},
                                     {"etapas": [{"id": "E1", "autor": "CAIO", "revisores": [], "tempo_maximo_s": -5}]})):
            with pytest.raises(Exception):
                app.execute("select helena_v2.criar_card('c', %s, 'x', 't', now() + interval '1 day', %s)", (f"mal-{i}", Jsonb(roteiro)))
        with pytest.raises(Exception):
            app.execute("select helena_v2.criar_card('c', 'sem-prazo', 'x', 't', null, %s)", (Jsonb(R.UMA),))
    assert con.execute("select count(*) from helena_v2.card").fetchone()[0] == n_cards
    assert con.execute("select count(*) from helena_v2.mensagem").fetchone()[0] == n_msgs
    assert con.execute("select titulo from helena_v2.card where id = %s", (r["card_id"],)).fetchone()[0] == sujo


def test_alvo_trocado_ou_inexistente_nao_deixa_resto(banco, con):
    m, et, chave = _card_executando(con)
    n = con.execute("select count(*) from helena_v2.historico").fetchone()[0]
    with banco.conectar("service_role") as motor:
        for maq, alvo in (("card", et), ("etapa", m.card), ("acao_externa", et), ("card", "00000000-0000-0000-0000-000000000000")):
            with pytest.raises(Exception):
                _aplicar(motor, maq, alvo, "MOTOR", "PLANO_VALIDO")
    assert con.execute("select count(*) from helena_v2.historico").fetchone()[0] == n


# ------------------------------------------------------------------ as 13 regras pela porta da função
def test_r04_revisor_escolhido_fora_da_regra_e_recusado(banco, con):
    m = R.novo(con)
    m.em_andamento()
    m.executando()
    m.entregar()
    et = m.etapa_id("E1")
    with banco.conectar("service_role") as motor:
        for escolhido in ("CAIO", "NENHUM", "LAURA", "caio", "CLARA'; --"):
            r = _aplicar(motor, "etapa", et, "MOTOR", "PORTAO1_OK", {"escolhido": escolhido})
            assert r["resultado"] == "RECUSADO"
    assert m.estado_da("E1") == "VALIDACAO"


def test_r09_aprovar_antes_do_portao_ou_pelo_papel_errado_e_recusado(banco, con):
    m = R.novo(con)
    m.em_andamento()
    m.executando()
    m.entregar()
    et = m.etapa_id("E1")
    with banco.conectar("service_role") as motor:
        for papel, evento in (("REVISOR", "APROVAR"), ("AUTOR", "APROVAR"), ("MOTOR", "APROVAR"), ("RELOGIO", "APROVAR"), ("VIGIA", "APROVAR")):
            r = _aplicar(motor, "etapa", et, papel, evento, {}, "CLARA", 1)
            assert r["resultado"] == "RECUSADO"
    with banco.conectar("authenticated") as app:
        r = _aplicar(app, "etapa", et, "FUNDADOR", "APROVAR", vv=m.versao_do_alvo("etapa", et))
        assert r["resultado"] != "APLICADO"
    assert m.estado_da("E1") == "VALIDACAO"
    with banco.conectar("service_role") as motor:
        assert _aplicar(motor, "card", m.card, "MOTOR", "TODAS_PRONTAS")["resultado"] == "RECUSADO"
    assert m.estado_da("card") == "EM_ANDAMENTO"


def test_r07_so_o_fundador_muda_prazo_e_prioridade(banco, con):
    m = R.novo(con)
    m.em_andamento()
    antes = con.execute("select prazo, prioridade from helena_v2.card where id = %s", (m.card,)).fetchone()
    with banco.conectar("service_role") as motor:
        for papel in ("MOTOR", "HELENA", "AUTOR", "REVISOR", "RELOGIO", "VIGIA"):
            for evento in ("MUDAR_PRAZO", "MUDAR_PRIORIDADE"):
                r = _aplicar(motor, "card", m.card, papel, evento, cont={"prazo": "2030-01-01", "prioridade": 99}, vv=1)
                assert r["resultado"] == "RECUSADO" and r["motivo"] == "FORA_DO_VOCABULARIO"
        assert _aplicar(motor, "card", m.card, "HELENA", "SUGERIR_PRAZO", cont={"prazo": "2030-01-01"})["resultado"] in ("REACAO", "RECUSADO")
    assert con.execute("select prazo, prioridade from helena_v2.card where id = %s", (m.card,)).fetchone() == antes


def test_r08_nada_externo_sem_o_ok_e_nunca_duas_vezes(banco, con):
    m = R._card_com_acao(con)
    ac = m.acao_id("A1")
    with banco.conectar("service_role") as motor:
        r = _aplicar(motor, "acao_externa", ac, "MOTOR", "EXECUTAR_ACAO")
        assert r["resultado"] == "RECUSADO"
        with pytest.raises(E.InsufficientPrivilege, match="PAPEL_NAO_PERMITIDO"):
            _aplicar(motor, "acao_externa", ac, "FUNDADOR", "APROVAR", vv=1)
    with banco.conectar("authenticated") as app:
        with pytest.raises(E.InsufficientPrivilege, match="PAPEL_NAO_PERMITIDO"):
            _aplicar(app, "acao_externa", ac, "MOTOR", "EXECUTAR_ACAO")
        assert _aplicar(app, "acao_externa", ac, "FUNDADOR", "APROVAR", vv=0)["resultado"] != "APLICADO"   # versão que ele não viu
    assert con.execute("select estado, ok_registrado, tentativas from helena_v2.acao_externa where id = %s", (ac,)).fetchone() == ("PROPOSTA", 0, 0)


def test_r11_mesmo_toque_e_mesma_mensagem_uma_vez_so_mesmo_vindo_de_dois_caminhos(banco, con):
    with banco.conectar("authenticated") as app:
        a = app.execute("select helena_v2.criar_card('app', 'dup-1', 'x', 't', now() + interval '2 day', %s)", (Jsonb(R.UMA),)).fetchone()[0]
        b = app.execute("select helena_v2.criar_card('app', 'dup-1', 'outro texto', 'outro', now() + interval '9 day', %s)", (Jsonb(R.UMA),)).fetchone()[0]
    assert a["novo"] is True and b["novo"] is False and a["card_id"] == b["card_id"]
    m = R.novo(con)
    m.em_andamento()
    with banco.conectar("authenticated") as app:
        vv = m.versao_do_alvo("card", m.card)
        r1 = _aplicar(app, "card", m.card, "FUNDADOR", "MUDAR_PRIORIDADE", cont={"prioridade": 3}, vv=vv, toque="t-1")
        r2 = _aplicar(app, "card", m.card, "FUNDADOR", "MUDAR_PRIORIDADE", cont={"prioridade": 9}, vv=vv, toque="t-1")
    assert r2["resultado"] == "REPETIDO" and r1["resultado"] in ("APLICADO", "REACAO")
    assert m.chamar("select prioridade from helena_v2.card where id = %s", (m.card,)) == 3


def test_r13_o_banco_so_cresce_e_o_vigia_do_dono_fica_vazio_depois_de_ataques(banco, con):
    m, et, chave = _card_executando(con)
    with banco.conectar("service_role") as motor:
        for k in (chave - 1, chave + 5, None):
            _aplicar(motor, "etapa", et, "AUTOR", "ENTREGAR", PARAMS_ENTREGA, "CAIO", k)
        _aplicar(motor, "etapa", et, "AUTOR", "ENTREGAR", [], "CAIO", chave)
    assert con.execute("select count(*) from helena_v2.vigia() where card_id = %s", (m.card,)).fetchone()[0] == 0
    assert con.execute("select count(*) from helena_v2.conferir_historico(%s)", (m.card,)).fetchone()[0] == 0
    assert con.execute("""select count(*) from helena_v2.historico h where h.card_id = %s and h.resultado = 'RECUSADO'""", (m.card,)).fetchone()[0] >= 3
