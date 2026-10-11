# -*- coding: utf-8 -*-
"""(f) UPDATE direto do estado é recusado; DELETE do histórico e TRUNCATE também; os papéis comuns só chamam a função.

O QUE É: tenta mudar o estado "por fora" de todas as formas (dono do banco, anon, authenticated, service_role e papéis de
teste) e mostra que só helena_v2.aplicar_evento (e criar_card, abrir_chamada_helena, disparar_automaticos) escreve.
COMO MUDAR: papel novo no Supabase entra em helena_v2.conta_papel (ver README); aqui só se confere que nada escreve direto.
"""
import pytest
from psycopg import errors as E
from psycopg.types.json import Jsonb

import test_05_regras as R

TABELAS_DE_MOVIMENTO = ["card", "etapa", "acao_externa", "historico", "entrega", "execucao", "mensagem"]
UMA_COLUNA = {"card": "titulo", "etapa": "nome", "acao_externa": "tipo", "historico": "evento", "entrega": "autor", "execucao": "tipo",
              "mensagem": "conteudo", "passagem": "nota", "teto": "por_que", "conta_papel": "papel"}


def _card_no_meio(con):
    m = R.novo(con)
    m.em_andamento()
    m.executando()
    m.entregar()
    return m


def test_o_dono_do_banco_tambem_nao_muda_o_estado_por_fora(con):
    m = _card_no_meio(con)
    for comando, args in (
        ("update helena_v2.card set estado = 'PRONTO' where id = %s", (m.card,)),
        ("update helena_v2.etapa set estado = 'APROVADA' where card_id = %s", (m.card,)),
        ("update helena_v2.etapa set execucoes = 0 where card_id = %s", (m.card,)),
        ("update helena_v2.etapa set exec_viva = 0, execucao_atual = null where card_id = %s", (m.card,)),
        ("update helena_v2.card set ordens = 0 where id = %s", (m.card,)),
        ("update helena_v2.card set dono = 'FUNDADOR' where id = %s", (m.card,)),
        ("delete from helena_v2.etapa where card_id = %s", (m.card,)),
        ("delete from helena_v2.card where id = %s", (m.card,)),
        ("insert into helena_v2.card (titulo, prazo, dono, prazo_ate) values ('fora', now(), 'HELENA', now())", ()),
        ("insert into helena_v2.execucao (tipo, card_id) values ('HELENA', %s)", (m.card,)),
        ("insert into helena_v2.historico (card_id, maquina, alvo_id, alvo_codigo, papel, evento, resultado, conta) "
         "values (%s, 'card', %s, 'card', 'MOTOR', 'X', 'APLICADO', 'eu')", (m.card, m.card)),
    ):
        with pytest.raises(E.InsufficientPrivilege, match="REGRA 13"):
            con.execute(comando, args)
    assert m.estado_da("E1") == "VALIDACAO" and m.estado_da("card") == "EM_ANDAMENTO"


def test_delete_do_historico_e_truncate_sao_recusados(con):
    m = _card_no_meio(con)
    n = m.chamar("select count(*) from helena_v2.historico where card_id = %s", (m.card,))
    with pytest.raises(E.InsufficientPrivilege, match="REGRA 13"):
        con.execute("delete from helena_v2.historico where card_id = %s", (m.card,))
    with pytest.raises(E.InsufficientPrivilege, match="REGRA 13"):
        con.execute("update helena_v2.historico set resultado = 'RECUSADO' where card_id = %s", (m.card,))
    for tabela in TABELAS_DE_MOVIMENTO:
        with pytest.raises(E.InsufficientPrivilege, match="REGRA 13"):
            con.execute(f"truncate helena_v2.{tabela} cascade")
    assert m.chamar("select count(*) from helena_v2.historico where card_id = %s", (m.card,)) == n


@pytest.mark.parametrize("papel", ["anon", "authenticated", "service_role", "h2t_curioso"])
def test_nenhum_papel_comum_escreve_nas_tabelas(banco, con, papel):
    m = _card_no_meio(con)
    with banco.conectar(papel) as c:
        for tabela in TABELAS_DE_MOVIMENTO + ["passagem", "teto", "conta_papel"]:
            col = UMA_COLUNA[tabela]
            for comando in (f"update helena_v2.{tabela} set {col} = {col}", f"delete from helena_v2.{tabela}", f"truncate helena_v2.{tabela} cascade"):
                with pytest.raises(E.InsufficientPrivilege):
                    c.execute(comando)
        with pytest.raises(E.InsufficientPrivilege):
            c.execute("update helena_v2.etapa set estado = 'APROVADA' where card_id = %s", (m.card,))
        with pytest.raises(E.InsufficientPrivilege):
            c.execute("insert into helena_v2.card (titulo, prazo) values ('x', now())")
        # as funções internas ninguém chama
        with pytest.raises(E.InsufficientPrivilege):
            c.execute("select helena_v2._aplicar('card', %s, 'MOTOR', 'X', '{}'::jsonb, null, null, null, null, 'EXTERNO', null, null, null)", (m.card,))
        with pytest.raises(E.InsufficientPrivilege):
            c.execute("select helena_v2._gravar('card', %s, '{}'::jsonb)", (m.card,))


def test_anon_nao_ve_nada_e_authenticated_e_service_role_so_leem(banco, con):
    m = _card_no_meio(con)
    with banco.conectar("anon") as c:
        with pytest.raises(E.InsufficientPrivilege):
            c.execute("select count(*) from helena_v2.card")
        with pytest.raises(E.InsufficientPrivilege):
            c.execute("select helena_v2.aplicar_evento('card', %s, 'FUNDADOR', 'CANCELAR')", (m.card,))
    for papel in ("authenticated", "service_role"):
        with banco.conectar(papel) as c:
            assert c.execute("select estado from helena_v2.card where id = %s", (m.card,)).fetchone()[0] == "EM_ANDAMENTO"
            assert c.execute("select count(*) from helena_v2.historico where card_id = %s", (m.card,)).fetchone()[0] > 0
            with pytest.raises(E.InsufficientPrivilege):
                c.execute("select * from helena_v2.conta_papel")      # quem pode dizer qual papel não é público
            assert c.execute("select helena_v2.tabela_confere()").fetchone()[0] is True


def test_os_papeis_comuns_so_chamam_a_funcao_e_so_com_o_papel_que_tem(banco, con):
    m = R.novo(con)
    m.em_andamento()
    m.executando()
    n_antes = m.chamar("select count(*) from helena_v2.historico where card_id = %s", (m.card,))
    etapa = m.etapa_id("E1")
    # o motor (service_role) entrega pela função, como AUTOR; não pode dizer que é o fundador
    with banco.conectar("service_role") as motor:
        chave = motor.execute("select execucao_atual from helena_v2.etapa where id = %s", (etapa,)).fetchone()[0]
        r = motor.execute("select helena_v2.aplicar_evento('etapa', %s, 'AUTOR', 'ENTREGAR', %s, 'CAIO', %s, null, %s)",
                          (etapa, Jsonb({"parecer": "OK", "acao_externa": "NENHUMA", "usou_internet": "NAO"}), chave, Jsonb({"x": 1}))).fetchone()[0]
        assert r["resultado"] == "APLICADO"
        with pytest.raises(E.InsufficientPrivilege, match="PAPEL_NAO_PERMITIDO"):
            motor.execute("select helena_v2.aplicar_evento('card', %s, 'FUNDADOR', 'CANCELAR')", (m.card,))
    # o app (authenticated) cancela como fundador, pela função
    with banco.conectar("authenticated") as app:
        r = app.execute("select helena_v2.aplicar_evento('card', %s, 'FUNDADOR', 'CANCELAR')", (m.card,)).fetchone()[0]
        assert r["resultado"] == "APLICADO"
        with pytest.raises(E.InsufficientPrivilege, match="PAPEL_NAO_PERMITIDO"):
            app.execute("select helena_v2.aplicar_evento('etapa', %s, 'AUTOR', 'ENTREGAR', '{}'::jsonb, 'CAIO', 1)", (etapa,))
    assert m.estado_da("card") == "CANCELADO"
    assert m.chamar("select conta from helena_v2.historico where card_id = %s and evento = 'ENTREGAR'", (m.card,)) == "service_role"
    assert m.chamar("select conta from helena_v2.historico where card_id = %s and evento = 'CANCELAR'", (m.card,)) == "authenticated"
    assert m.chamar("select count(*) from helena_v2.historico where card_id = %s", (m.card,)) > n_antes


def test_um_papel_de_teste_com_grant_mas_sem_papel_declarado_nao_age(banco, con):
    """Dar EXECUTE a um papel novo não basta: ele precisa estar em conta_papel (a conta diz o papel que tem)."""
    m = R.novo(con)
    con.execute("grant usage on schema helena_v2 to h2t_motor")
    con.execute("grant execute on function helena_v2.aplicar_evento(text, uuid, text, text, jsonb, text, bigint, integer, jsonb, text, boolean, text[], timestamptz) to h2t_motor")
    with banco.conectar("h2t_motor") as c:
        with pytest.raises(E.InsufficientPrivilege, match="PAPEL_NAO_PERMITIDO"):
            c.execute("select helena_v2.aplicar_evento('card', %s, 'MOTOR', 'TODAS_PRONTAS')", (m.card,))
    con.execute("insert into helena_v2.conta_papel values ('h2t_motor', 'HELENA')")
    with banco.conectar("h2t_motor") as c:
        with pytest.raises(E.InsufficientPrivilege, match="PAPEL_NAO_PERMITIDO"):
            c.execute("select helena_v2.aplicar_evento('card', %s, 'MOTOR', 'TODAS_PRONTAS')", (m.card,))
        r = c.execute("select helena_v2.aplicar_evento('card', %s, 'HELENA', 'LER_DE_VOLTA', '{}'::jsonb, null, 1)", (m.card,)).fetchone()[0]
        assert r["resultado"] == "RECUSADO"       # papel permitido; a chamada 1 não é a atual, então a chave antiga não grava
    con.execute("delete from helena_v2.conta_papel where conta = 'h2t_motor'")
