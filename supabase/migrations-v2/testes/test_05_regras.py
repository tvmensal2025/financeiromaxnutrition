# -*- coding: utf-8 -*-
"""(e) As 13 regras de ferro: para cada uma, um teste que TENTA violar e o banco recusa, e um que mostra o caso permitido passando.

O QUE É: as travas do 0004 (CHECK, índice único, gatilho, exclusão) e a função única, uma regra por vez.
Quando a regra só cabe em teste (2 e 12), o teste diz isso. Há também testes de DEFEITO PLANTADO: a tabela de passagens é
estragada de propósito (num banco à parte) e o banco tem de recusar o movimento mesmo assim, porque a trava é a segunda chave.
Tentar "como a função" quer dizer: o teste liga a chave de gravação (helena_v2.funcao_unica) à mão, como faria um programa
com defeito dentro da função única, e mostra que a trava de baixo segura.

COMO MUDAR: regra nova ganha teste novo aqui; nenhuma trava entra no 0004 sem um teste que tente violá-la.
"""
import copy
from contextlib import contextmanager

import pytest
from psycopg import errors as E
from psycopg.types.json import Jsonb

import ajudas as A
import gerar_passagens as G
import sorteio as S

P = A.P

UMA = S.ROTEIRO_UMA_ETAPA
DUAS = S.ROTEIRO_DUAS_COM_JURIDICO
ROTEIRO_DEPENDENTE = {"etapas": [
    {"id": "E1", "autor": "CAIO", "revisores": ["CLARA", "HELENA"], "depende_de": [], "julga": [], "pulavel": True,
     "acoes_permitidas": ["ENTREGAR", "PERGUNTAR", "REGISTRAR_FALHA"]},
    {"id": "E2", "autor": "ISABELA", "revisores": ["CAIO", "FUNDADOR"], "depende_de": ["E1"], "julga": [], "acoes_permitidas": ["ENTREGAR"]}]}


def novo(con, roteiro=UMA, pedido_grande=False, vocab=None, tab=None):
    j = {"id": "regras", "roteiro": roteiro, "automatico": False, "card": {"pedido_grande": pedido_grande, "plano_valido": True}}
    return A.Mundo(con, j, vocab, tab)


def criar_direto(con, roteiro):
    """Chama criar_card sem passar pelo provar (para roteiros que o próprio provar já recusa)."""
    return con.execute("select helena_v2.criar_card('teste', %s, 'x', 'y', %s, %s)",
                       (f"direto-{id(roteiro)}-{A.datetime.now().timestamp()}", A.PRAZO_DO_CARD, Jsonb(roteiro))).fetchone()[0]


@contextmanager
def como_funcao(con, papel=None, evento=None):
    """Liga a chave de gravação à mão (como um programa com defeito dentro da função única) e desfaz tudo no fim."""
    con.execute("begin")
    try:
        con.execute("select set_config('helena_v2.funcao_unica', 'sim', true)")
        if papel:
            con.execute("select set_config('helena_v2.papel_evento', %s, true)", (papel,))
        if evento:
            con.execute("select set_config('helena_v2.evento_atual', %s, true)", (evento,))
        yield
    finally:
        con.execute("rollback")


@contextmanager
def descartavel(con):
    con.execute("begin")
    try:
        yield
    finally:
        con.execute("rollback")


def banco_com_defeito(fabrica, mutar):
    """Um banco à parte cuja tabela de passagens foi estragada de propósito (o resto do esquema é o de verdade)."""
    vocab, tab = P.carregar()
    mutar(vocab, tab)
    texto = G.gerar(vocab, tab, estrita=False)["0002_passagens_geradas.sql"]
    return fabrica({"0002_passagens_geradas.sql": texto}), vocab, tab


def linha_da_tabela(tab, maquina, rid):
    return next(ln for ln in tab["linhas"][maquina] if ln["id"] == rid)


# ============================================================================== REGRA 1: dono e prazo
def test_r01_tentar_estado_aberto_sem_dono_ou_sem_prazo_e_recusado(con):
    m = novo(con)
    m.em_andamento()
    for coluna in ("dono", "prazo_ate"):
        with como_funcao(con), pytest.raises(E.CheckViolation, match="regra01"):
            con.execute(f"update helena_v2.card set {coluna} = null where id = %s", (m.card,))
        with como_funcao(con), pytest.raises(E.CheckViolation, match="regra01"):
            con.execute(f"update helena_v2.etapa set {coluna} = null where card_id = %s", (m.card,))
    with como_funcao(con), pytest.raises(E.CheckViolation, match="regra01"):
        con.execute("insert into helena_v2.card (titulo, prazo) values ('sem dono', now())")


def test_r01_o_caso_permitido_todo_estado_aberto_tem_dono_e_prazo_e_o_final_nao_precisa(con):
    m = novo(con, DUAS)
    m.em_andamento()
    m.ate_aprovada("E1")
    for tabela in ("card", "etapa"):
        abertos = m.linhas(f"select estado, dono, prazo_ate from helena_v2.{tabela} t where t.estado not in "
                           f"(select estado from helena_v2.estado_def where maquina = %s and final) and "
                           + ("id = %s" if tabela == "card" else "card_id = %s"), (tabela, m.card))
        assert abertos and all(r["dono"] and r["prazo_ate"] for r in abertos), (tabela, abertos)
    # o dono acompanha o estado: na fila é o autor; esperando as anteriores é a Helena
    assert m.linha_da_etapa("E1")["dono"] == "HELENA"          # APROVADA: dona é a Helena (card ainda aberto)
    assert m.linha_da_etapa("E2")["dono"] == "HELENA"          # AGUARDANDO_ANTERIORES
    m.um("MOTOR", "DEPENDENCIAS_PRONTAS", "E2")
    assert m.linha_da_etapa("E2")["dono"] == "CLARA" and m.estado_da("E2") == "NA_FILA"
    m.um("MOTOR", "INICIAR_EXECUCAO", "E2")
    assert m.linha_da_etapa("E2")["dono"] == "CLARA"
    # o prazo do card é seu: ao mudar, o prazo de quem espera dentro do card acompanha
    antes = m.linha_da_etapa("E1")["prazo_ate"]
    m.um("FUNDADOR", "MUDAR_PRAZO", "card")
    depois = m.linha_da_etapa("E1")["prazo_ate"]
    assert depois > antes and depois == m.linhas("select prazo from helena_v2.card where id = %s", (m.card,))[0]["prazo"]
    # estados com tempo escrito no YAML ("15 min", "até 60 s") ganham a hora de verdade
    rasc = A.Mundo(con, {"id": "r", "roteiro": UMA, "automatico": False, "card": {"pedido_grande": True}})
    c = rasc.linhas("select prazo_ate - now() as falta from helena_v2.card where id = %s", (rasc.card,))[0]["falta"]
    assert 14 * 60 <= c.total_seconds() <= 15 * 60 + 1
    # final: sem dono e sem prazo
    m.um("FUNDADOR", "CANCELAR", "card")
    final = m.linhas("select dono, prazo_ate from helena_v2.card where id = %s", (m.card,))[0]
    assert final == {"dono": None, "prazo_ate": None}


# ============================================================================== REGRA 2: final não volta (a metade que cabe numa trava)
def test_r02_tentar_fazer_um_final_voltar_a_andar_e_recusado(con):
    m = novo(con)
    m.um("FUNDADOR", "CANCELAR", "card")
    assert m.estado_da("card") == "CANCELADO"
    with como_funcao(con), pytest.raises(E.CheckViolation, match="REGRA 2"):
        con.execute("update helena_v2.card set estado = 'RASCUNHO' where id = %s", (m.card,))
    with como_funcao(con), pytest.raises(E.CheckViolation, match="REGRA 2"):
        con.execute("update helena_v2.etapa set estado = 'NA_FILA' where card_id = %s", (m.card,))
    # e a função única não tem saída de final: nenhum evento de nenhum papel muda um card cancelado
    antes = m.foto()
    for papel, evs in m.vocab["acoes"].items():
        for ev in evs:
            r = m.um(papel, ev, "card", {k: v[0] for k, v in m.me.parametros.get((papel, ev), {}).items()} or None)
            assert r is None or r["resultado"] != "APLICADO", (papel, ev, r)
    assert m.foto() == antes or m.foto()["card"] == antes["card"]


def test_r02_a_outra_metade_todo_caminho_termina_nao_cabe_numa_trava(con):
    """Honesto: 'todo card termina' depende do tempo (o relógio dos prazos) e é provado pelo provar.py, não por uma trava.
    O que o banco garante é que o card termina por um destes caminhos e que o final é para sempre."""
    m = novo(con)
    m.em_andamento()
    m.ate_aprovada("E1")
    m.um("MOTOR", "TODAS_PRONTAS", "card")
    assert m.estado_da("card") == "PRONTO" and m.estado_da("E1") == "PRONTA"
    gatilhos = {r[0] for r in con.execute("select tgname from pg_trigger where not tgisinternal and tgrelid = 'helena_v2.card'::regclass")}
    assert not any("termina" in g for g in gatilhos)


# ============================================================================== REGRA 3: uma execução viva; só a chave atual grava
def test_r03_tentar_gravar_com_chave_antiga_e_recusado(con):
    m = novo(con)
    m.em_andamento()
    m.executando()
    antes = m.linha_da_etapa()
    r = m.um("AUTOR", "ENTREGAR", "E1", {"parecer": "OK", "acao_externa": "NENHUMA", "usou_internet": "NAO"}, chave="antiga")
    assert r["resultado"] == "RECUSADO"
    depois = m.linha_da_etapa()
    assert depois["estado"] == "EXECUTANDO" and depois["execucao_atual"] == antes["execucao_atual"]
    assert m.chamar("select count(*) from helena_v2.entrega where etapa_id = %s", (antes["id"],)) == 0
    # o mesmo vale para o revisor e para a Helena
    m.um("AUTOR", "ENTREGAR", "E1", {"parecer": "OK", "acao_externa": "NENHUMA", "usou_internet": "NAO"})
    m.revisao()
    assert m.um("REVISOR", "APROVAR", "E1", chave="antiga")["resultado"] == "RECUSADO"
    assert m.estado_da("E1") == "REVISAO"
    h = novo(con, pedido_grande=True)
    assert h.um("HELENA", "LER_DE_VOLTA", "card", chave="antiga")["resultado"] == "RECUSADO"
    assert h.estado_da("card") == "RASCUNHO"


def test_r03_tentar_ter_duas_execucoes_vivas_ou_viva_sem_numero_e_recusado(con):
    m = novo(con)
    m.em_andamento()
    m.executando()
    e = m.linha_da_etapa()
    with como_funcao(con), pytest.raises(E.UniqueViolation, match="execucao_uma_viva_por_etapa"):
        con.execute("insert into helena_v2.execucao (tipo, card_id, etapa_id) values ('AUTOR', %s, %s)", (m.card, e["id"]))
    m2 = novo(con)
    with como_funcao(con), pytest.raises(E.CheckViolation, match="regra03"):
        con.execute("update helena_v2.etapa set exec_viva = 1 where card_id = %s", (m2.card,))
    with como_funcao(con), pytest.raises(E.CheckViolation, match="regra03"):
        con.execute("update helena_v2.etapa set execucao_atual = null where id = %s", (e["id"],))


def test_r03_tentar_gravar_entrega_de_outra_execucao_e_recusado(con):
    m = novo(con)
    m.em_andamento()
    m.executando()
    e = m.linha_da_etapa()
    with como_funcao(con):
        n = con.execute("insert into helena_v2.execucao (tipo, card_id, etapa_id, estado) values ('AUTOR', %s, %s, 'MORTA') returning numero",
                        (m.card, e["id"])).fetchone()[0]
        with pytest.raises(E.CheckViolation, match="REGRA 3"):
            con.execute("insert into helena_v2.entrega (card_id, etapa_id, etapa_codigo, versao, numero_execucao, autor) "
                        "values (%s, %s, 'E1', 1, %s, 'CAIO')", (m.card, e["id"], n))


def test_r03_o_numero_da_execucao_so_sobe_nunca_zera_nem_com_rodada_nova(con):
    m = novo(con)
    m.em_andamento()
    m.executando()
    n1 = m.linha_da_etapa()["execucao_atual"]
    # decisão nova: NOVA_RODADA zera os contadores de tentativa, mas não o número da execução
    assert m.um("MOTOR", "DECISAO_MUDOU", "card")["resultado"] == "APLICADO"
    e = m.linha_da_etapa()
    assert e["estado"] == "NA_FILA" and e["execucoes"] == 0 and e["execucao_atual"] is None
    assert m.chamar("select estado from helena_v2.execucao where numero = %s", (n1,)) == "MORTA"
    m.um("MOTOR", "INICIAR_EXECUCAO", "E1")
    n2 = m.linha_da_etapa()["execucao_atual"]
    assert n2 > n1
    # mesmo que alguém reinicie a sequência, o gatilho recusa um número que não passa do maior
    m.passos([("AUTOR", "ENTREGAR", "E1", {"parecer": "OK", "acao_externa": "NENHUMA", "usou_internet": "NAO"}),
              ("MOTOR", "PORTAO1_RECUSOU", "E1")])
    with descartavel(con):
        con.execute("alter sequence helena_v2.seq_numero_execucao restart with 1")
        with pytest.raises(E.CheckViolation, match="nunca zera"):
            m.um("MOTOR", "INICIAR_EXECUCAO", "E1")


def test_r03_o_caso_permitido_a_chave_atual_grava_uma_vez_so(con):
    m = novo(con)
    m.em_andamento()
    m.executando()
    n = m.linha_da_etapa()["execucao_atual"]
    assert m.entregar()["resultado"] == "APLICADO"
    assert m.chamar("select numero_execucao from helena_v2.entrega where etapa_id = %s", (m.linha_da_etapa()["id"],)) == n
    # a mesma resposta outra vez (repetida) não grava duas entregas
    assert m.entregar()["resultado"] in ("RECUSADO", "CONVERTIDO")
    assert m.chamar("select count(*) from helena_v2.entrega where etapa_id = %s", (m.linha_da_etapa()["id"],)) == 1


# ============================================================================== REGRA 4: o revisor
def test_r04_o_plano_do_banco_tem_os_mesmos_revisores_validos_do_provar(con):
    """Quem pode revisar cada etapa (regra 4) é calculado pelo banco ao criar o card: igual ao perfis_do_roteiro do provar."""
    import glob
    import yaml
    from pathlib import Path
    roteiros = [S.P.ROTEIRO_DE_PROVA, UMA, DUAS, ROTEIRO_DEPENDENTE]
    for f in sorted(glob.glob(str(A.RAIZ / "helena-v2" / "casos" / "*" / "jornada*.yaml"))):
        r = yaml.safe_load(Path(f).read_text(encoding="utf-8")).get("roteiro")
        if r:
            roteiros.append(r)
    vocab, tab = P.carregar()
    for roteiro in roteiros:
        m = A.Mundo(con, {"id": "p", "roteiro": roteiro, "automatico": False}, vocab, tab)
        for perfil in P.perfis_do_roteiro(roteiro, tab, vocab):
            e = m.linha_da_etapa(perfil["id"])
            assert list(e["revisores_validos"]) == perfil["revisores_validos"], perfil["id"]
            assert list(e["julgadores"]) == perfil["julgadores"], perfil["id"]
            for chave, valor in perfil["cfg"].items():
                assert e[chave] == valor, (perfil["id"], chave)
            assert e["autor"] == perfil["autor"] and list(e["depende_de"]) == perfil["depende_de"] and list(e["julga"]) == perfil["julga"]


def test_r04_tentar_pôr_o_autor_ou_quem_julga_depois_como_revisor_e_recusado(con):
    m = novo(con, DUAS)
    m.em_andamento()
    m.executando("E1")
    m.entregar("E1")
    # E1 é julgada pela E2 (autora CLARA, revisora possível HELENA): nem o autor, nem a Clara, nem a Helena
    for proibido in ("ISABELA", "CLARA", "HELENA"):
        r = m.um("MOTOR", "PORTAO1_OK", "E1", {"escolhido": proibido})
        assert r["resultado"] == "RECUSADO", proibido
        assert m.estado_da("E1") == "VALIDACAO"
    assert m.linha_da_etapa("E1")["revisor"] == "NENHUM"
    r = m.um("MOTOR", "PORTAO1_OK", "E1", {"escolhido": "CAIO"})
    assert r["resultado"] == "APLICADO" and m.linha_da_etapa("E1")["revisor"] == "CAIO"


def test_r04_tentar_gravar_revisor_invalido_direto_e_recusado(con):
    m = novo(con, DUAS)
    for revisor in ("ISABELA", "CLARA", "HELENA", "RAVI"):    # autor, quem julga, quem pode julgar, e quem nem está na ficha
        with como_funcao(con), pytest.raises(E.CheckViolation, match="regra04"):
            con.execute("update helena_v2.etapa set revisor = %s where card_id = %s and codigo = 'E1'", (revisor, m.card))


def test_r04_so_o_revisor_designado_responde(con):
    m = novo(con)
    m.em_andamento()
    m.executando()
    m.entregar()
    m.revisao()      # designado: CLARA
    assert m.linha_da_etapa()["revisor"] == "CLARA"
    for outro in ("CAIO", "HELENA", "RAVI"):
        assert m.um("REVISOR", "APROVAR", "E1", ator=outro)["resultado"] == "RECUSADO", outro
    assert m.estado_da("E1") == "REVISAO"
    assert m.um("REVISOR", "APROVAR", "E1", ator="CLARA")["resultado"] == "APLICADO"


def test_r04_so_os_21_agentes_podem_ser_autor_ou_revisor(con):
    ruim = copy.deepcopy(UMA)
    ruim["etapas"][0]["autor"] = "SIRLENE"           # personagem do produto, nunca funcionário
    with pytest.raises(E.RaiseException, match="REGRA 4"):
        criar_direto(con, ruim)
    ruim = copy.deepcopy(UMA)
    ruim["etapas"][0]["revisores"] = ["ALEX"]
    with pytest.raises(E.RaiseException, match="REGRA 4"):
        criar_direto(con, ruim)
    m = novo(con)
    with como_funcao(con), pytest.raises(E.InsufficientPrivilege, match="REGRA 4/6"):      # a ficha não muda depois que o card nasce
        con.execute("update helena_v2.etapa set autor = 'DOUTOR_VITAL' where card_id = %s", (m.card,))
    with como_funcao(con), pytest.raises(E.CheckViolation, match="ck_etapa_autor"):         # e ninguém de fora dos 21 entra
        con.execute("insert into helena_v2.etapa (card_id, codigo, ordem, autor, estado, dono, prazo_ate) "
                    "values (%s, 'E9', 9, 'DOUTOR_VITAL', 'AGUARDANDO_ANTERIORES', 'HELENA', now())", (m.card,))


# ============================================================================== REGRA 5: teto e ajuste volta ao autor
def test_r05_tentar_passar_do_teto_de_qualquer_contador_e_recusado(con):
    m = novo(con)
    m.em_andamento()
    vocab, tab = P.carregar()
    maqs = P.montar(vocab, tab)
    for nome, tabela in (("card", "card"), ("etapa", "etapa"), ("acao_externa", None)):
        if tabela is None:
            continue
        for var, teto in maqs[nome].teto_var.items():
            if nome == "etapa" and var in maqs[nome].compartilhadas:
                continue
            with como_funcao(con), pytest.raises(E.CheckViolation, match=f"ck_{nome}_{var}"):
                con.execute(f"update helena_v2.{tabela} set {var} = {teto + 1} where " + ("id" if nome == "card" else "card_id") + " = %s", (m.card,))


def test_r05_seis_execucoes_por_rodada_e_a_setima_nao_existe_mas_o_seu_ajuste_nao_gasta_o_teto(con):
    m = novo(con)
    m.em_andamento()
    for volta in range(6):
        m.passos([("MOTOR", "INICIAR_EXECUCAO", "E1")] if volta else [("MOTOR", "DEPENDENCIAS_PRONTAS", "E1"), ("MOTOR", "INICIAR_EXECUCAO", "E1")])
        m.entregar()
        assert m.um("MOTOR", "PORTAO1_RECUSOU", "E1")["resultado"] == "APLICADO"
    e = m.linha_da_etapa()
    assert e["execucoes"] == 6 and e["estado"] == "NA_FILA"
    assert m.um("MOTOR", "INICIAR_EXECUCAO", "E1")["resultado"] == "RECUSADO"      # a 7ª não existe
    assert m.um("MOTOR", "TETO_EXECUCOES", "E1")["resultado"] == "APLICADO"        # no teto a etapa vai para em resolução
    assert m.estado_da("E1") == "EM_RESOLUCAO"
    # o seu pedido de ajuste abre rodada nova e não gasta esse limite
    m2 = novo(con, DUAS)
    m2.em_andamento()
    m2.executando("E1")
    m2.entregar("E1")
    m2.um("MOTOR", "PORTAO1_OK", "E1", {"escolhido": "FUNDADOR"})
    assert m2.estado_da("E1") == "ESPERANDO_FUNDADOR"
    assert m2.um("FUNDADOR", "PEDIR_AJUSTE", "E1", {"motivo_ajuste": "TOM"})["resultado"] == "APLICADO"
    e2 = m2.linha_da_etapa("E1")
    assert e2["estado"] == "NA_FILA" and e2["execucoes"] == 0 and m2.linhas("select ordens from helena_v2.card where id = %s", (m2.card,))[0]["ordens"] == 1


def test_r05_tentar_mandar_o_ajuste_para_quem_nao_e_o_autor_e_recusado(con):
    m = novo(con)
    m.em_andamento()
    m.executando()
    m.entregar()
    m.revisao()
    with como_funcao(con, papel="REVISOR", evento="REPROVAR"), pytest.raises(E.CheckViolation, match="REGRA 5"):
        con.execute("update helena_v2.etapa set estado = 'ESPERANDO_FUNDADOR' where id = %s", (m.linha_da_etapa()["id"],))
    # o caso permitido: reprovar volta para a fila do autor
    assert m.um("REVISOR", "REPROVAR", "E1")["resultado"] == "APLICADO"
    e = m.linha_da_etapa()
    assert e["estado"] == "NA_FILA" and e["dono"] == "CAIO" and e["reprovacoes"] == 1


def test_r05_defeito_plantado_sem_guarda_do_teto_o_banco_recusa_a_setima(fabrica):
    def estraga(vocab, tab):
        linha_da_tabela(tab, "etapa", "E10").pop("guarda")        # a tabela deixa iniciar uma 7ª execução
    b, vocab, tab = banco_com_defeito(fabrica, estraga)
    with b.conectar() as con:
        m = novo(con, UMA, vocab=vocab, tab=tab)
        m.em_andamento()
        m.passos([("MOTOR", "DEPENDENCIAS_PRONTAS", "E1")])
        for volta in range(6):
            m.um("MOTOR", "INICIAR_EXECUCAO", "E1")
            m.entregar()
            m.um("MOTOR", "PORTAO1_RECUSOU", "E1")
        assert m.linha_da_etapa()["execucoes"] == 6
        m.um("MOTOR", "INICIAR_EXECUCAO", "E1")          # a tabela estragada deixa
        with pytest.raises(E.CheckViolation, match="ck_etapa_execucoes"):
            m.entregar()                                  # mas o contador não passa de 6: o banco recusa o movimento
        assert m.linha_da_etapa()["execucoes"] == 6


# ============================================================================== REGRA 6: sem ciclo, ninguém anda sem a anterior, card ativo
def test_r06_tentar_criar_card_com_ciclo_ou_dependencia_que_nao_existe_e_recusado(con):
    ciclo = {"etapas": [
        {"id": "E1", "autor": "CAIO", "revisores": ["CLARA"], "depende_de": ["E2"]},
        {"id": "E2", "autor": "ISABELA", "revisores": ["CAIO"], "depende_de": ["E1"]}]}
    with pytest.raises(E.CheckViolation, match="REGRA 6: ciclo"):
        criar_direto(con, ciclo)
    sozinha = {"etapas": [{"id": "E1", "autor": "CAIO", "revisores": ["CLARA"], "depende_de": ["E1"]}]}
    with pytest.raises(E.CheckViolation, match="REGRA 6: ciclo"):
        criar_direto(con, sozinha)
    with pytest.raises(E.RaiseException, match="REGRA 6"):
        criar_direto(con, {"etapas": [{"id": "E1", "autor": "CAIO", "revisores": ["CLARA"], "depende_de": ["E9"]}]})
    with pytest.raises(E.RaiseException, match="REGRA 6"):
        criar_direto(con, {"etapas": [{"id": "E1", "autor": "CAIO", "revisores": ["CLARA"]},
                                      {"id": "E2", "autor": "ISABELA", "revisores": ["CAIO"], "julga": ["E1"]}]})


def test_r06_ninguem_trabalha_sem_a_anterior_aprovada_e_etapa_so_anda_com_card_ativo(con):
    m = novo(con, ROTEIRO_DEPENDENTE)
    # card ainda em RASCUNHO: a etapa não anda, nem pelo motor
    assert m.um("MOTOR", "DEPENDENCIAS_PRONTAS", "E1")["resultado"] == "RECUSADO"
    m.em_andamento()
    # E2 depende de E1: sem E1 aprovada o motor não a libera
    assert m.um("MOTOR", "DEPENDENCIAS_PRONTAS", "E2")["resultado"] == "RECUSADO"
    assert m.estado_da("E2") == "AGUARDANDO_ANTERIORES"
    m.ate_aprovada("E1")
    assert m.um("MOTOR", "DEPENDENCIAS_PRONTAS", "E2")["resultado"] == "APLICADO"
    # card parado esperando você: a etapa que estava esperando as anteriores continua sem andar sozinha no card cancelado
    m.um("FUNDADOR", "CANCELAR", "card")
    assert m.estado_da("E2") == "CANCELADA"


def test_r06_a_trava_adiada_pega_etapa_andando_sem_a_anterior_mesmo_se_um_programa_errar(con):
    m = novo(con, ROTEIRO_DEPENDENTE)
    m.em_andamento()
    m3 = novo(con)             # card em RASCUNHO com etapa andando
    with como_funcao(con):
        con.execute("update helena_v2.etapa set estado = 'NA_FILA', dono = 'ISABELA' where card_id = %s and codigo = 'E2'", (m.card,))
        with pytest.raises(E.CheckViolation, match="REGRA 6"):
            con.execute("set constraints all immediate")
    with como_funcao(con):
        con.execute("update helena_v2.etapa set estado = 'NA_FILA', dono = 'CAIO' where card_id = %s", (m3.card,))
        with pytest.raises(E.CheckViolation, match="REGRA 6"):
            con.execute("set constraints all immediate")


def test_r06_etapa_com_falha_faz_o_card_perguntar_e_sub_card_esta_desligado(con):
    m = novo(con, ROTEIRO_DEPENDENTE)
    m.em_andamento()
    m.executando("E1")
    m.um("AUTOR", "PERGUNTAR", "E1", {"usou_internet": "NAO"})
    assert m.estado_da("E1") == "ESPERANDO_FUNDADOR"
    m.passos([("RELOGIO", "LEMBRETE_24H", "E1"), ("RELOGIO", "LEMBRETE_48H", "E1"), ("RELOGIO", "PRAZO_ESPERA_VENCIDO", "E1")])
    assert m.estado_da("E1") == "CANCELADA"                  # o padrão cancela, nunca aprova
    assert m.um("MOTOR", "PERGUNTAR_AO_FUNDADOR", "card")["resultado"] == "APLICADO"
    c = m.linhas("select estado, motivo from helena_v2.card where id = %s", (m.card,))[0]
    assert c == {"estado": "ESPERANDO_FUNDADOR", "motivo": "DEPENDENCIA"}
    # sub-card desligado: a ação existe no vocabulário, mas nenhuma linha a aceita; vira formato errado
    s = novo(con)
    s.em_andamento()
    s.executando()
    r = s.um("AUTOR", "PEDIR_SUBCARD", "E1", {"usou_internet": "NAO"})
    assert r["resultado"] == "CONVERTIDO" and r["convertido_em"] == "MOTOR FALHA"
    assert s.linha_da_etapa()["formato"] == 1 and s.estado_da("E1") == "NA_FILA"
    assert s.chamar("select count(*) from helena_v2.card where card_pai_id = %s", (s.card,)) == 0


def test_r06_defeito_plantado_liberar_dependente_sem_conferir_a_anterior_o_banco_recusa(fabrica):
    def estraga(vocab, tab):
        linha_da_tabela(tab, "etapa", "E01").pop("guarda")
    b, vocab, tab = banco_com_defeito(fabrica, estraga)
    with b.conectar() as con:
        m = novo(con, ROTEIRO_DEPENDENTE, vocab=vocab, tab=tab)
        m.em_andamento()
        with pytest.raises(E.CheckViolation, match="REGRA 6"):
            m.um("MOTOR", "DEPENDENCIAS_PRONTAS", "E2")
        assert m.estado_da("E2") == "AGUARDANDO_ANTERIORES"


# ============================================================================== REGRA 7: prioridade e prazo são seus
def test_r07_tentar_mudar_prioridade_ou_prazo_sem_ser_o_fundador_e_recusado(con):
    m = novo(con)
    prazo, prio = m.linhas("select prazo, prioridade from helena_v2.card where id = %s", (m.card,))[0].values()
    for campo, valor in (("prazo", "2030-01-01"), ("prioridade", "9")):
        with pytest.raises(E.InsufficientPrivilege, match="REGRA 7"):
            with como_funcao(con):
                con.execute(f"update helena_v2.card set {campo} = %s where id = %s", (valor, m.card))
    # pela função: nenhum outro papel tem linha nem reação para mudar o campo
    for papel in ("MOTOR", "HELENA", "RELOGIO", "VIGIA"):
        for ev in ("MUDAR_PRAZO", "MUDAR_PRIORIDADE"):
            if ev in m.vocab["acoes"].get(papel, {}):
                m.evento({"papel": papel, "evento": ev, "alvo": "card"})
    atual = m.linhas("select prazo, prioridade from helena_v2.card where id = %s", (m.card,))[0]
    assert (atual["prazo"], atual["prioridade"]) == (prazo, prio)
    # a conta do motor também não pode dizer que é o fundador (ver test_r07_a_conta_so_diz_o_papel_que_tem)
    m.em_andamento()
    # a Helena só sugere: vira reação, o prazo original continua
    m.em_andamento()
    assert m.um("HELENA", "SUGERIR_PRAZO", "card")["resultado"] == "REACAO"
    assert m.linhas("select prazo from helena_v2.card where id = %s", (m.card,))[0]["prazo"] == prazo


def test_r07_o_fundador_muda_o_prazo_e_a_prioridade_e_rearma_os_avisos(con):
    m = novo(con)
    m.em_andamento()
    m.passos([("RELOGIO", "PRAZO_80", "card"), ("RELOGIO", "PRAZO_VENCIDO", "card")])
    assert m.linhas("select nivel_prazo from helena_v2.card where id = %s", (m.card,))[0]["nivel_prazo"] == 2
    antes = m.linhas("select prazo from helena_v2.card where id = %s", (m.card,))[0]["prazo"]
    assert m.um("FUNDADOR", "MUDAR_PRAZO", "card")["resultado"] == "APLICADO"
    c = m.linhas("select prazo, nivel_prazo, mudancas_prazo from helena_v2.card where id = %s", (m.card,))[0]
    assert c["prazo"] > antes and c["nivel_prazo"] == 0 and c["mudancas_prazo"] == 1
    assert m.um("FUNDADOR", "MUDAR_PRIORIDADE", "card")["resultado"] == "REACAO"
    assert m.linhas("select prioridade from helena_v2.card where id = %s", (m.card,))[0]["prioridade"] == m.contador_prazo + 1
    # no teto de mudanças (3) o campo ainda muda, mas os avisos ficam como estão (reação)
    m.passos([("FUNDADOR", "MUDAR_PRAZO", "card"), ("FUNDADOR", "MUDAR_PRAZO", "card")])
    ultimo = m.linhas("select prazo from helena_v2.card where id = %s", (m.card,))[0]["prazo"]
    assert m.um("FUNDADOR", "MUDAR_PRAZO", "card")["resultado"] == "REACAO"
    assert m.linhas("select prazo from helena_v2.card where id = %s", (m.card,))[0]["prazo"] > ultimo


def test_r07_a_conta_so_diz_o_papel_que_tem(banco):
    """O app (authenticated) é o fundador e só ele; o motor (service_role) é o resto, nunca o fundador."""
    with banco.conectar() as dono:
        m = novo(dono)
        m.em_andamento()
        card = m.card
        prazo = {"prazo": "2031-01-01T00:00:00+00:00"}
        consulta = "select helena_v2.aplicar_evento('card', %s, %s, 'MUDAR_PRAZO', '{}'::jsonb, null, null, %s, %s)"
        versao = m.versao_do_alvo("card", card)
        with banco.conectar("service_role") as motor:
            with pytest.raises(E.InsufficientPrivilege, match="PAPEL_NAO_PERMITIDO"):
                motor.execute(consulta, (card, "FUNDADOR", versao, Jsonb(prazo)))
        with banco.conectar("authenticated") as app:
            with pytest.raises(E.InsufficientPrivilege, match="PAPEL_NAO_PERMITIDO"):
                app.execute("select helena_v2.aplicar_evento('card', %s, 'MOTOR', 'TODAS_PRONTAS')", (card,))
            r = app.execute(consulta, (card, "FUNDADOR", versao, Jsonb(prazo))).fetchone()[0]
            assert r["resultado"] == "APLICADO"
        assert m.linhas("select prazo from helena_v2.card where id = %s", (card,))[0]["prazo"].year == 2031


# ============================================================================== REGRA 8: nada externo sem o seu ok, só pelo motor, uma vez
def _card_com_acao(con, tipo="PELO_MOTOR", **kw):
    m = novo(con, UMA, **kw)
    m.em_andamento()
    m.ate_aprovada("E1", acao=tipo)
    m.um("MOTOR", "TODAS_PRONTAS", "card")
    assert m.estado_da("card") == "PRONTO" and m.estado_da("E1") == "PRONTA"
    return m


def test_r08_a_acao_so_nasce_do_card_pronto_uma_por_etapa_e_nunca_foi_executada_sem_ok(con):
    m = _card_com_acao(con)
    a = m.linhas("select * from helena_v2.acao_externa where card_id = %s", (m.card,))
    assert len(a) == 1 and a[0]["codigo"] == "A1" and a[0]["estado"] == "PROPOSTA" and a[0]["tem_ferramenta"] is True
    assert a[0]["ok_registrado"] == 0 and a[0]["tentativas"] == 0 and a[0]["dono"] == "FUNDADOR"
    # nenhuma ação nasce enquanto o card não está pronto, nem de entrega que não propõe
    n = novo(con)
    n.em_andamento()
    n.ate_aprovada("E1", acao="PELO_MOTOR")
    assert n.chamar("select count(*) from helena_v2.acao_externa where card_id = %s", (n.card,)) == 0
    z = _card_com_acao(con, tipo="NENHUMA")
    assert z.chamar("select count(*) from helena_v2.acao_externa where card_id = %s", (z.card,)) == 0


def test_r08_tentar_uma_segunda_acao_para_a_mesma_etapa_e_recusado(con):
    m = _card_com_acao(con)
    e = m.linha_da_etapa()
    with como_funcao(con), pytest.raises(E.UniqueViolation, match="acao_uma_por_etapa"):
        con.execute("insert into helena_v2.acao_externa (card_id, codigo, etapa_id, etapa_codigo, tipo, dono, prazo_ate) "
                    "values (%s, 'A2', %s, 'E1', 'PELO_MOTOR', 'FUNDADOR', now())", (m.card, e["id"]))


def test_r08_tentar_executar_sem_o_ok_ou_pelo_fundador_ou_duas_vezes_e_recusado(con):
    m = _card_com_acao(con)
    # sem o seu ok registrado, o motor não executa (AUTORIZADA só vem do seu Aprovar)
    assert m.um("MOTOR", "EXECUTAR_ACAO", "A1")["resultado"] == "RECUSADO"
    with como_funcao(con, papel="MOTOR"), pytest.raises(E.CheckViolation, match="regra08"):
        con.execute("update helena_v2.acao_externa set tentativas = 1 where card_id = %s", (m.card,))
    with como_funcao(con, papel="RELOGIO"), pytest.raises(E.CheckViolation, match="REGRA 8"):
        con.execute("update helena_v2.acao_externa set ok_registrado = 1 where card_id = %s", (m.card,))
    with como_funcao(con, papel="FUNDADOR"), pytest.raises(E.CheckViolation, match="REGRA 8"):
        con.execute("update helena_v2.acao_externa set tentativas = 1, ok_registrado = 1 where card_id = %s", (m.card,))
    # o caso permitido, passo a passo: seu ok -> o motor executa -> concluída; e a segunda execução nunca existe
    assert m.um("FUNDADOR", "APROVAR", "A1")["resultado"] == "APLICADO"
    a = m.linhas("select * from helena_v2.acao_externa where card_id = %s", (m.card,))[0]
    assert a["estado"] == "AUTORIZADA" and a["ok_registrado"] == 1 and a["tentativas"] == 0
    assert m.um("MOTOR", "EXECUTAR_ACAO", "A1")["resultado"] == "APLICADO"
    a = m.linhas("select * from helena_v2.acao_externa where card_id = %s", (m.card,))[0]
    assert a["estado"] == "EXECUTANDO_ACAO" and a["tentativas"] == 1
    assert m.um("MOTOR", "EXECUTAR_ACAO", "A1")["resultado"] == "RECUSADO"
    assert m.um("MOTOR", "ACAO_CONCLUIDA", "A1")["resultado"] == "APLICADO"
    assert m.linhas("select estado from helena_v2.acao_externa where card_id = %s", (m.card,))[0]["estado"] == "EXECUTADA"
    assert m.um("MOTOR", "EXECUTAR_ACAO", "A1")["resultado"] == "RECUSADO"           # depois de executada, nunca mais


def test_r08_acao_sem_ferramenta_nao_pode_ser_aprovada_e_incerta_nunca_vira_falha_sozinha(con):
    s = _card_com_acao(con, tipo="SO_FUNDADOR")
    assert s.um("FUNDADOR", "APROVAR", "A1")["resultado"] == "COMENTARIO_NO_CARD"      # só você faz: sem ferramenta, não autoriza o motor
    assert s.um("FUNDADOR", "RESPONDER", "A1", {"opcao": "FEITO_POR_MIM"})["resultado"] == "APLICADO"
    m = _card_com_acao(con)
    m.passos([("FUNDADOR", "APROVAR", "A1"), ("MOTOR", "EXECUTAR_ACAO", "A1"), ("RELOGIO", "TEMPO_ESGOTADO", "A1")])
    assert m.linhas("select estado from helena_v2.acao_externa where card_id = %s", (m.card,))[0]["estado"] == "INCERTA"
    assert m.um("MOTOR", "ACAO_FALHOU", "A1")["resultado"] == "RECUSADO"                # só a sua confirmação a faz falha
    assert m.um("FUNDADOR", "RESPONDER", "A1", {"opcao": "NAO_ACONTECEU"})["resultado"] == "APLICADO"


def test_r08_defeito_plantado_o_fundador_executando_a_acao_o_banco_recusa(fabrica):
    def estraga(vocab, tab):
        vocab["acoes"]["FUNDADOR"]["EXECUTAR_ACAO"] = {"efeito": "interno", "parametros": {}}
        tab["linhas"]["acao_externa"].append({"id": "X10F", "de": "AUTORIZADA", "evento": "EXECUTAR_ACAO", "papel": "FUNDADOR",
                                              "guarda": "ok_registrado == 1 and tentativas < TETO_EXECUCOES_ACAO",
                                              "efeito": {"tentativas": "+1"}, "para": "EXECUTANDO_ACAO"})
    b, vocab, tab = banco_com_defeito(fabrica, estraga)
    with b.conectar() as con:
        m = _card_com_acao(con, vocab=vocab, tab=tab)
        m.um("FUNDADOR", "APROVAR", "A1")
        with pytest.raises(E.CheckViolation, match="regra08|REGRA 8"):
            m.um("FUNDADOR", "EXECUTAR_ACAO", "A1")
        assert m.linhas("select estado, tentativas from helena_v2.acao_externa where card_id = %s", (m.card,))[0] == {"estado": "AUTORIZADA", "tentativas": 0}


# ============================================================================== REGRA 9: aprovada só com os portões
def test_r09_tentar_aprovar_sem_ser_revisor_ou_fundador_ou_sem_o_portao_e_recusado(con):
    m = novo(con)
    m.em_andamento()
    m.executando()
    m.entregar()
    m.um("MOTOR", "PORTAO1_OK", "E1", {"escolhido": "CLARA"})
    e = m.linha_da_etapa()
    for papel in ("RELOGIO", "MOTOR", "VIGIA", "HELENA"):
        with como_funcao(con, papel=papel, evento="PRAZO_ESPERA_VENCIDO"), pytest.raises(E.CheckViolation, match="REGRA 9"):
            con.execute("update helena_v2.etapa set estado = 'APROVADA', portao1_ok = true where id = %s", (e["id"],))
    with como_funcao(con, papel="REVISOR", evento="APROVAR"), pytest.raises(E.CheckViolation, match="regra09"):
        con.execute("update helena_v2.etapa set estado = 'APROVADA', portao1_ok = false where id = %s", (e["id"],))
    # padrão (relógio) nunca aprova: cancela
    m2 = novo(con)
    m2.em_andamento()
    m2.executando()
    m2.um("AUTOR", "PERGUNTAR", "E1", {"usou_internet": "NAO"})
    m2.passos([("RELOGIO", "LEMBRETE_24H", "E1"), ("RELOGIO", "LEMBRETE_48H", "E1"), ("RELOGIO", "PRAZO_ESPERA_VENCIDO", "E1")])
    assert m2.estado_da("E1") == "CANCELADA"


def test_r09_o_parecer_juridico_so_vale_com_o_seu_aprovar(con):
    m = novo(con, DUAS)
    m.em_andamento()
    m.ate_aprovada("E1")
    m.um("MOTOR", "DEPENDENCIAS_PRONTAS", "E2")
    m.um("MOTOR", "INICIAR_EXECUCAO", "E2")
    m.entregar("E2")
    m.revisao("E2", "HELENA")
    assert m.um("REVISOR", "APROVAR", "E2")["resultado"] == "APLICADO"
    assert m.estado_da("E2") == "ESPERANDO_FUNDADOR"                 # o revisor de IA sozinho não aprova o jurídico
    e = m.linha_da_etapa("E2")
    with como_funcao(con, papel="REVISOR", evento="APROVAR"), pytest.raises(E.CheckViolation, match="REGRA 9"):
        con.execute("update helena_v2.etapa set estado = 'APROVADA' where id = %s", (e["id"],))
    assert m.um("FUNDADOR", "APROVAR", "E2")["resultado"] == "APLICADO"
    assert m.estado_da("E2") == "APROVADA"


def test_r09_tentar_fechar_o_card_pronto_sem_todas_aprovadas_e_recusado(con):
    m = novo(con, DUAS)
    m.em_andamento()
    assert m.um("MOTOR", "TODAS_PRONTAS", "card")["resultado"] == "RECUSADO"
    with como_funcao(con):
        con.execute("update helena_v2.card set estado = 'PRONTO', dono = null, prazo_ate = null where id = %s", (m.card,))
        with pytest.raises(E.CheckViolation, match="REGRA"):
            con.execute("set constraints all immediate")


def test_r09_defeito_plantado_o_portao_1_aprovando_sozinho_o_banco_recusa(fabrica):
    def estraga(vocab, tab):
        linha_da_tabela(tab, "etapa", "E40")["para"] = "APROVADA"
    b, vocab, tab = banco_com_defeito(fabrica, estraga)
    with b.conectar() as con:
        m = novo(con, UMA, vocab=vocab, tab=tab)
        m.em_andamento()
        m.executando()
        m.entregar()
        with pytest.raises(E.CheckViolation, match="REGRA 9"):
            m.um("MOTOR", "PORTAO1_OK", "E1", {"escolhido": "CLARA"})
        assert m.estado_da("E1") == "VALIDACAO"


def test_r09_defeito_plantado_card_pronto_sem_guarda_o_banco_recusa(fabrica):
    def estraga(vocab, tab):
        linha_da_tabela(tab, "card", "C12").pop("guarda")
    b, vocab, tab = banco_com_defeito(fabrica, estraga)
    with b.conectar() as con:
        m = novo(con, DUAS, vocab=vocab, tab=tab)
        m.em_andamento()
        with pytest.raises(E.CheckViolation, match="REGRA"):
            m.um("MOTOR", "TODAS_PRONTAS", "card")
        assert m.estado_da("card") == "EM_ANDAMENTO"


# ============================================================================== REGRA 10: nada pronto com informação velha
def test_r10_decisao_nova_faz_refazer_o_que_estava_aprovado(con):
    m = novo(con)
    m.em_andamento()
    m.ate_aprovada("E1")
    assert m.linha_da_etapa()["entrega_fresca"] is True
    assert m.um("MOTOR", "DECISAO_MUDOU", "card")["resultado"] == "APLICADO"
    e = m.linha_da_etapa()
    assert e["estado"] == "NA_FILA" and e["entrega_fresca"] is False and e["portao1_ok"] is False and e["semaforo"] == "NENHUM"
    # só uma execução nova torna a entrega fresca de novo, e só o portão 1 de novo a deixa passar
    m.um("MOTOR", "INICIAR_EXECUCAO", "E1")
    assert m.linha_da_etapa()["entrega_fresca"] is True
    assert m.um("MOTOR", "TODAS_PRONTAS", "card")["resultado"] == "RECUSADO"


def test_r10_tentar_aprovar_ou_fechar_com_entrega_velha_e_recusado(con):
    m = novo(con)
    m.em_andamento()
    m.ate_aprovada("E1")
    e = m.linha_da_etapa()
    with como_funcao(con), pytest.raises(E.CheckViolation, match="regra09"):
        con.execute("update helena_v2.etapa set entrega_fresca = false where id = %s", (e["id"],))
    m.um("MOTOR", "TODAS_PRONTAS", "card")
    assert m.estado_da("E1") == "PRONTA"
    with como_funcao(con), pytest.raises(E.CheckViolation, match="regra10"):
        con.execute("update helena_v2.etapa set entrega_fresca = false where id = %s", (e["id"],))


def test_r10_defeito_plantado_dependencia_que_mudou_e_a_etapa_continua_aprovada_o_banco_recusa(fabrica):
    def estraga(vocab, tab):
        linha_da_tabela(tab, "etapa", "E115")["para"] = "MESMO"       # a decisão nova não derruba a aprovada
    b, vocab, tab = banco_com_defeito(fabrica, estraga)
    with b.conectar() as con:
        m = novo(con, UMA, vocab=vocab, tab=tab)
        m.em_andamento()
        m.ate_aprovada("E1")
        with pytest.raises(E.CheckViolation, match="regra09|regra10"):
            m.um("MOTOR", "DECISAO_MUDOU", "card")
        assert m.estado_da("E1") == "APROVADA"


# ============================================================================== REGRA 11: toque gravado uma vez e com destino
def test_r11_a_mesma_mensagem_duas_vezes_cria_um_card_so(con):
    args = ("whatsapp", "msg-unica-777", "Faz a legenda", "Legenda", A.PRAZO_DO_CARD, Jsonb(UMA))
    a = con.execute("select helena_v2.criar_card(%s, %s, %s, %s, %s, %s)", args).fetchone()[0]
    b = con.execute("select helena_v2.criar_card(%s, %s, %s, %s, %s, %s)", args).fetchone()[0]
    assert a["novo"] is True and b["novo"] is False and a["card_id"] == b["card_id"]
    assert con.execute("select count(*) from helena_v2.mensagem where canal = 'whatsapp' and numero = 'msg-unica-777'").fetchone()[0] == 1
    assert con.execute("select count(*) from helena_v2.card where mensagem_id = (select id from helena_v2.mensagem where numero = 'msg-unica-777')").fetchone()[0] == 1
    # direto, o índice único recusa
    with como_funcao(con), pytest.raises(E.UniqueViolation, match="mensagem_numero_unico"):
        con.execute("insert into helena_v2.mensagem (canal, numero) values ('whatsapp', 'msg-unica-777')")
    # outro canal com o mesmo número é outra mensagem
    c = con.execute("select helena_v2.criar_card('app', 'msg-unica-777', 'x', 'y', %s, %s)", (A.PRAZO_DO_CARD, Jsonb(UMA))).fetchone()[0]
    assert c["novo"] is True and c["card_id"] != a["card_id"]


def test_r11_o_mesmo_toque_duas_vezes_nao_repete_o_efeito(con):
    m = novo(con)
    m.em_andamento()
    c = m.card
    v = m.versao_do_alvo("card", c)
    sql = "select helena_v2.aplicar_evento('card', %s, 'FUNDADOR', 'MUDAR_PRAZO', '{}'::jsonb, null, null, %s, %s, 'toque-123')"
    a = con.execute(sql, (c, v, Jsonb({"prazo": "2032-01-01T00:00:00+00:00"}))).fetchone()[0]
    b = con.execute(sql, (c, v, Jsonb({"prazo": "2033-01-01T00:00:00+00:00"}))).fetchone()[0]
    assert a["resultado"] == "APLICADO" and b["resultado"] == "REPETIDO" and a["historico_id"] == b["historico_id"]
    assert m.linhas("select prazo, mudancas_prazo from helena_v2.card where id = %s", (c,))[0]["mudancas_prazo"] == 1
    assert m.linhas("select prazo from helena_v2.card where id = %s", (c,))[0]["prazo"].year == 2032


def test_r11_todo_toque_seu_tem_destino(con):
    # aberto: comentário, sem mudar nada
    m = novo(con)
    m.em_andamento()
    antes = m.foto()
    r = m.um("FUNDADOR", "USAR_COMO_EXEMPLO", "E1")
    assert r["resultado"] == "COMENTARIO_NO_CARD" and m.foto() == antes
    # versão velha: comentário (a peça mudou), nunca muda estado
    n = novo(con)
    n.em_andamento()
    n.executando()
    n.entregar()
    n.revisao()
    antes = n.foto()
    r = n.um("FUNDADOR", "APROVAR", "E1", versao_vista="antiga")
    assert r["resultado"] == "COMENTARIO_NO_CARD" and n.foto() == antes
    # card fechado: Pedir ajuste abre card novo ligado; Aprovar vira comentário
    p = _card_com_acao(con)
    assert p.um("FUNDADOR", "PEDIR_AJUSTE", "card", {"motivo_ajuste": "TOM"})["resultado"] == "REACAO"
    assert p.chamar("select count(*) from helena_v2.card where card_pai_id = %s", (p.card,)) == 1
    assert p.um("FUNDADOR", "APROVAR", "card")["resultado"] == "REACAO"
    c = _cancelado(con)
    assert c.um("FUNDADOR", "RESPONDER", "card", {"opcao": "REFAZER"})["resultado"] == "CARD_NOVO_LIGADO"
    assert c.um("FUNDADOR", "PEDIR_AJUSTE", "E1", {"motivo_ajuste": "TOM"})["resultado"] == "CARD_NOVO_LIGADO"
    assert c.chamar("select count(*) from helena_v2.card where card_pai_id = %s", (c.card,)) == 2
    novo_card = c.linhas("select * from helena_v2.card where card_pai_id = %s limit 1", (c.card,))[0]
    assert novo_card["estado"] == "RASCUNHO" and novo_card["titulo"] == "card de teste"
    # resposta tardia a etapa que o padrão já encerrou, com o card aberto: guardada
    t = novo(con, ROTEIRO_DEPENDENTE)
    t.em_andamento()
    t.executando("E1")
    t.um("AUTOR", "PERGUNTAR", "E1", {"usou_internet": "NAO"})
    t.passos([("RELOGIO", "LEMBRETE_24H", "E1"), ("RELOGIO", "LEMBRETE_48H", "E1"), ("RELOGIO", "PRAZO_ESPERA_VENCIDO", "E1")])
    r = t.um("FUNDADOR", "RESPONDER", "E1", {"opcao": "RESPOSTA_A"})
    assert r["resultado"] == "RESPOSTA_GUARDADA" and list(t.linha_da_etapa()["respostas_guardadas"]) == ["RESPOSTA_A"]


def _cancelado(con):
    m = novo(con)
    m.em_andamento()
    m.um("FUNDADOR", "CANCELAR", "card")
    return m


def test_r11_tentar_gravar_toque_do_fundador_sem_destino_e_recusado(con):
    m = novo(con)
    with como_funcao(con), pytest.raises(E.CheckViolation, match="regra11"):
        con.execute("insert into helena_v2.historico (card_id, maquina, alvo_id, alvo_codigo, papel, evento, resultado, conta) "
                    "values (%s, 'card', %s, 'card', 'FUNDADOR', 'APROVAR', 'RECUSADO', 'x')", (m.card, m.card))
    # fora do vocabulário é recusa honesta (não é um botão), e fica no histórico
    r = m.evento({"papel": "FUNDADOR", "evento": "DANCAR", "alvo": "card"})
    assert r is None


# ============================================================================== REGRA 12: falha de infraestrutura (não cabe numa trava)
def test_r12_falha_de_infraestrutura_nao_gasta_tentativa_tem_teto_e_no_teto_chama_o_fundador(con):
    """Honesto: o banco não consegue saber a ORIGEM da falha (o motor lê no registro de uso do Hermes); por isso não há trava.
    O que a tabela garante, e este teste prova no banco: classes de infraestrutura não gastam execucoes, e na 3ª o fundador é chamado."""
    m = novo(con)
    m.em_andamento()
    m.executando()
    for classe in ("PROVEDOR", "QUEDA"):
        assert m.um("MOTOR", "FALHA_INFRA", "E1", {"classe": classe})["resultado"] == "APLICADO"
        e = m.linha_da_etapa()
        assert e["estado"] == "NA_FILA" and e["execucoes"] == 0, classe
        m.um("MOTOR", "INICIAR_EXECUCAO", "E1")
    assert m.linha_da_etapa()["infra"] == 2
    assert m.um("MOTOR", "FALHA_INFRA", "E1", {"classe": "FERRAMENTA"})["resultado"] == "APLICADO"
    e = m.linha_da_etapa()
    assert (e["estado"], e["motivo"], e["espera"], e["execucoes"], e["infra"], e["dono"]) == ("ESPERANDO_FUNDADOR", "INFRA", "INTERNA", 0, 3, "FUNDADOR")
    n_gatilhos = m.chamar("select count(*) from pg_trigger t join pg_proc p on p.oid = t.tgfoid where not t.tgisinternal and p.prosrc ilike '%%REGRA 12%%'")
    assert n_gatilhos == 0


def test_r12_falha_de_formato_gasta_tentativa_ao_contrario_da_infra(con):
    m = novo(con)
    m.em_andamento()
    m.executando()
    m.um("MOTOR", "FALHA", "E1", {"classe": "FORMATO_ERRADO"})
    e = m.linha_da_etapa()
    assert e["execucoes"] == 1 and e["formato"] == 1 and e["estado"] == "NA_FILA"


# ============================================================================== REGRA 13: histórico só de acréscimo, uma linha por evento, reconstrói
def test_r13_tentar_mexer_no_historico_e_recusado_ate_com_a_chave_ligada(con):
    m = novo(con)
    m.em_andamento()
    with como_funcao(con):
        with pytest.raises(E.InsufficientPrivilege, match="REGRA 13"):
            con.execute("update helena_v2.historico set evento = 'OUTRO' where card_id = %s", (m.card,))
    with como_funcao(con):
        with pytest.raises(E.InsufficientPrivilege, match="REGRA 13"):
            con.execute("delete from helena_v2.historico where card_id = %s", (m.card,))
    for tabela in ("historico", "card", "etapa", "entrega", "execucao", "mensagem", "acao_externa"):
        with descartavel(con), pytest.raises(E.InsufficientPrivilege, match="REGRA 13"):
            con.execute(f"truncate helena_v2.{tabela} cascade")
    with como_funcao(con), pytest.raises(E.InsufficientPrivilege, match="REGRA 13"):
        con.execute("update helena_v2.mensagem set conteudo = 'trocado'")


def test_r13_cada_evento_e_uma_linha_e_o_historico_bate_com_o_card(con):
    m = novo(con)
    m.em_andamento()
    m.executando()
    m.entregar()
    n = m.chamar("select count(*) from helena_v2.historico where card_id = %s", (m.card,))
    assert n == 1 + 1 + 2 + 2 + 1   # criação + etapa criada + (leitura, plano) + (dependências, iniciar) + entregar
    assert m.linhas("select * from helena_v2.conferir_historico(%s)", (m.card,)) == []
    # se alguém mexer no card por fora do histórico (um programa com defeito), a conferência acusa
    with como_funcao(con):
        con.execute("update helena_v2.etapa set formato = 1 where card_id = %s", (m.card,))
        dif = con.execute("select alvo, campo from helena_v2.conferir_historico(%s)", (m.card,)).fetchall()
        assert ("E1", "formato") in dif


def test_o_vigia_acha_o_que_um_programa_com_defeito_deixou_errado_e_nao_acusa_card_sadio(con):
    """O vigia (função que o motor chama a cada 5 minutos) devolve uma linha por problema; vazio = tudo certo."""
    sadio = novo(con)
    sadio.em_andamento()
    sadio.executando()
    quebrado = novo(con)
    quebrado.em_andamento()
    consulta = "select regra, mensagem from helena_v2.vigia() where card_id = %s"
    assert con.execute(consulta, (sadio.card,)).fetchall() == [] and con.execute(consulta, (quebrado.card,)).fetchall() == []
    assert con.execute("select count(*) from helena_v2.vigia() where regra = 'TABELA'").fetchone()[0] == 0
    # um programa com defeito muda um contador por fora do histórico: a regra 13 acusa
    with como_funcao(con):
        con.execute("update helena_v2.etapa set formato = 1 where card_id = %s", (quebrado.card,))
        achados = con.execute(consulta, (quebrado.card,)).fetchall()
        assert achados and achados[0][0] == "13" and "formato" in achados[0][1]
        assert con.execute(consulta, (sadio.card,)).fetchall() == []
    # e uma etapa andando sem a anterior (regra 6) também
    dependente = novo(con, ROTEIRO_DEPENDENTE)
    dependente.em_andamento()
    with como_funcao(con):
        con.execute("update helena_v2.etapa set estado = 'NA_FILA', dono = 'ISABELA' where card_id = %s and codigo = 'E2'", (dependente.card,))
        achados = con.execute(consulta, (dependente.card,)).fetchall()
        assert any(r[0] == "6" for r in achados), achados


def test_r13_cada_passagem_guarda_a_origem_dos_sinais(con):
    m = novo(con)
    m.em_andamento()
    m.um("FUNDADOR", "CANCELAR", "card")
    linhas = m.linhas("select id, papel, evento, origem, origem_id, linha_id from helena_v2.historico where card_id = %s order by id", (m.card,))
    cancela = next(l for l in linhas if l["evento"] == "CANCELAR")
    filho = next(l for l in linhas if l["evento"] == "CANCELADO_PAI")
    assert cancela["linha_id"].startswith("C22") and filho["origem"] == "SINAL" and filho["origem_id"] == cancela["id"] and filho["linha_id"] == "E04"


def test_r13_defeito_plantado_duas_linhas_para_o_mesmo_evento_o_banco_recusa(fabrica):
    def estraga(vocab, tab):
        copia = copy.deepcopy(linha_da_tabela(tab, "etapa", "E10"))
        copia["id"] = "E10B"
        tab["linhas"]["etapa"].append(copia)
    b, vocab, tab = banco_com_defeito(fabrica, estraga)
    with b.conectar() as con:
        m = novo(con, UMA, vocab=vocab, tab=tab)
        m.em_andamento()
        m.um("MOTOR", "DEPENDENCIAS_PRONTAS", "E1")
        with pytest.raises(E.RaiseException, match="REGRA 13: duas linhas"):
            m.um("MOTOR", "INICIAR_EXECUCAO", "E1")
        assert m.estado_da("E1") == "NA_FILA"


def test_defeito_plantado_um_final_que_anda_na_tabela_o_banco_recusa(fabrica):
    def estraga(vocab, tab):
        tab["linhas"]["etapa"].append({"id": "E200", "de": "CANCELADA", "evento": "DEPENDENCIAS_PRONTAS", "papel": "MOTOR", "efeito": {}, "para": "NA_FILA"})
    b, vocab, tab = banco_com_defeito(fabrica, estraga)
    with b.conectar() as con:
        m = novo(con, UMA, vocab=vocab, tab=tab)
        m.em_andamento()
        m.um("FUNDADOR", "CANCELAR", "card")
        assert m.um("MOTOR", "DEPENDENCIAS_PRONTAS", "E1")["resultado"] == "RECUSADO"      # card cancelado: a regra geral já segura
        with como_funcao(con), pytest.raises(E.CheckViolation, match="REGRA 2"):
            con.execute("update helena_v2.etapa set estado = 'NA_FILA' where card_id = %s", (m.card,))


def test_defeito_plantado_estado_sem_dono_o_banco_recusa_a_entrada_nele(fabrica):
    def estraga(vocab, tab):
        tab["estados"]["etapa"]["NA_FILA"].pop("dono")
    b, vocab, tab = banco_com_defeito(fabrica, estraga)
    with b.conectar() as con:
        m = novo(con, UMA, vocab=vocab, tab=tab)
        m.em_andamento()
        with pytest.raises(E.CheckViolation, match="regra01"):
            m.um("MOTOR", "DEPENDENCIAS_PRONTAS", "E1")


def test_defeito_plantado_ajuste_que_nao_volta_ao_autor_o_banco_recusa(fabrica):
    def estraga(vocab, tab):
        linha_da_tabela(tab, "etapa", "E57")["para"] = "ESPERANDO_FUNDADOR"
    b, vocab, tab = banco_com_defeito(fabrica, estraga)
    with b.conectar() as con:
        m = novo(con, UMA, vocab=vocab, tab=tab)
        m.em_andamento()
        m.executando()
        m.entregar()
        m.revisao()
        with pytest.raises(E.CheckViolation, match="REGRA 5"):
            m.um("REVISOR", "REPROVAR", "E1")
        assert m.estado_da("E1") == "REVISAO"


def test_defeito_plantado_execucao_viva_sem_numero_o_banco_recusa(fabrica):
    def estraga(vocab, tab):
        linha_da_tabela(tab, "etapa", "E10")["efeito"] = {"exec_viva": 0}       # vai para EXECUTANDO sem execução viva
    b, vocab, tab = banco_com_defeito(fabrica, estraga)
    with b.conectar() as con:
        m = novo(con, UMA, vocab=vocab, tab=tab)
        m.em_andamento()
        m.um("MOTOR", "DEPENDENCIAS_PRONTAS", "E1")
        with pytest.raises(E.CheckViolation, match="regra03"):
            m.um("MOTOR", "INICIAR_EXECUCAO", "E1")      # a tabela estragada deixaria; o banco não
        assert m.estado_da("E1") == "NA_FILA"
