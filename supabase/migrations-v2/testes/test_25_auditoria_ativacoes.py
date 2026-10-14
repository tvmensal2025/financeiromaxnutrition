"""O que é: prova a 0019 — histórico de ativações (quem/quando, só acréscimo) e reversão para a revisão anterior.
Como mudar: roda num banco local descartável com TODAS as migrations (integral.py); nada toca em banco remoto.
"""
from datetime import datetime, timezone

import psycopg
import pytest
from psycopg.types.json import Jsonb

import conftest as C
import sorteio as S
import test_12_configuracoes as T12
from integral import banco_integral

FUNDADOR = C.FUNDADOR_TESTE


@pytest.fixture()
def cenario(servidor):
    """Banco integral com a base técnica e DUAS revisões validadas (ainda nenhuma ativa)."""
    with banco_integral(servidor) as banco:
        bundle, digital, base = T12.bootstrap(banco)
        revisoes = []
        for numero in range(2):
            with banco.conectar(papel="authenticated") as con:
                rascunho = T12.salvar(con, bundle, nome=f"Revisão {numero}", base_id=base["id"])
            revisoes.append(T12.validar(banco, rascunho, digital))
        yield banco, bundle, digital, base, revisoes


def ativar(banco, rev, esperada=None):
    with banco.conectar(papel="authenticated") as con:
        return con.execute("select helena_v2.ativar_configuracao(%s,%s)", (rev["id"], esperada)).fetchone()[0]


def reverter(banco, esperada):
    with banco.conectar(papel="authenticated") as con:
        return con.execute("select helena_v2.reverter_configuracao(%s)", (esperada,)).fetchone()[0]


def historico(banco):
    with banco.conectar() as con:
        return [(str(c), None if a is None else str(a), str(p), t) for c, a, p, t in con.execute(
            "select configuracao_id, anterior_id, ativada_por, tipo from helena_v2.configuracao_ativacao order by id")]


def ponteiro(banco):
    with banco.conectar() as con:
        return str(con.execute("select ativa_id from helena_v2.configuracao_ponteiro").fetchone()[0])


def test_cada_ativacao_grava_linha_com_uid_do_fundador_e_anterior(cenario):
    banco, _, _, _, (r0, r1) = cenario
    assert historico(banco) == []
    antes = datetime.now(timezone.utc)
    assert ativar(banco, r0)["ativa"] is True
    assert ativar(banco, r1, r0["id"])["ativa"] is True
    depois = datetime.now(timezone.utc)
    assert historico(banco) == [(r0["id"], None, FUNDADOR, "ATIVACAO"), (r1["id"], r0["id"], FUNDADOR, "ATIVACAO")]
    with banco.conectar() as con:
        momentos = [m for (m,) in con.execute("select ativada_em from helena_v2.configuracao_ativacao order by id")]
    assert antes <= momentos[0] <= momentos[1] <= depois
    # Reativar a que já é a ativa não muda nada e não gera linha; ativação recusada também não.
    ativar(banco, r1, r1["id"])
    with banco.conectar(papel="authenticated") as con:
        with pytest.raises(psycopg.errors.SerializationFailure, match="CONFIG_ATIVA_DESATUALIZADA"):
            con.execute("select helena_v2.ativar_configuracao(%s,null)", (r0["id"],))
    assert len(historico(banco)) == 2
    # A lista do fundador traz as mais novas primeiro, com nomes e o uid de quem ativou.
    with banco.conectar(papel="authenticated") as con:
        lista = con.execute("select helena_v2.listar_ativacoes()").fetchone()[0]
        uma = con.execute("select helena_v2.listar_ativacoes(1)").fetchone()[0]
        for ruim in (0, 201, None):
            with pytest.raises(psycopg.errors.InvalidParameterValue, match="LIMITE_INVALIDO"):
                con.execute("select helena_v2.listar_ativacoes(%s)", (ruim,))
    assert [l["configuracao_id"] for l in lista] == [r1["id"], r0["id"]]
    assert lista[0]["anterior_id"] == r0["id"] and lista[0]["anterior_nome"] == "Revisão 0"
    assert lista[0]["configuracao_nome"] == "Revisão 1" and lista[0]["anterior_estado"] == "VALIDADA"
    assert lista[0]["ativada_por"] == FUNDADOR and lista[0]["tipo"] == "ATIVACAO" and lista[0]["ativada_em"]
    assert lista[1]["anterior_id"] is None
    assert [l["id"] for l in uma] == [lista[0]["id"]]


def test_reversao_restaura_ponteiro_e_cards_mantem_a_revisao(cenario):
    banco, _, _, _, (r0, r1) = cenario
    ativar(banco, r0)
    ativar(banco, r1, r0["id"])
    with banco.conectar() as con:  # depois da 0007 a porta antiga de criar card só abre para o dono do banco
        card = con.execute("select helena_v2.criar_card('config','antes-da-reversao','x','Teste',now()+interval '2 days',%s)",
                           (Jsonb(S.ROTEIRO_UMA_ETAPA),)).fetchone()[0]["card_id"]
    revertida = reverter(banco, r1["id"])
    assert revertida["id"] == r0["id"] and revertida["ativa"] is True
    assert ponteiro(banco) == r0["id"]
    assert historico(banco)[-1] == (r0["id"], r1["id"], FUNDADOR, "REVERSAO")
    with banco.conectar(papel="service_role") as con:
        assert con.execute("select helena_v2.configuracao_ativa()").fetchone()[0]["id"] == r0["id"]
    with banco.conectar() as con:
        novo = con.execute("select helena_v2.criar_card('config','depois-da-reversao','x','Teste',now()+interval '2 days',%s)",
                           (Jsonb(S.ROTEIRO_UMA_ETAPA),)).fetchone()[0]["card_id"]
        vinculo = {n: con.execute("select ordem_de_servico->>'config_revision_id' from helena_v2.card where id=%s",
                                  (i,)).fetchone()[0] for n, i in (("antes", card), ("depois", novo))}
    assert vinculo == {"antes": r1["id"], "depois": r0["id"]}
    # A reversão é uma ativação como as outras: reverter de novo volta para a que acabou de sair.
    assert reverter(banco, r0["id"])["id"] == r1["id"] and ponteiro(banco) == r1["id"]
    assert [t for *_, t in historico(banco)] == ["ATIVACAO", "ATIVACAO", "REVERSAO", "REVERSAO"]


def test_reversao_recusada_sem_anterior_com_anterior_aposentada_ou_cas_errado(cenario):
    banco, _, _, _, (r0, r1) = cenario
    with banco.conectar(papel="authenticated") as con:
        # nada ativo e nenhuma ativação: não há para onde voltar
        with pytest.raises(psycopg.errors.CheckViolation, match="CONFIG_SEM_ANTERIOR"):
            con.execute("select helena_v2.reverter_configuracao(null)")
    ativar(banco, r0)
    with banco.conectar(papel="authenticated") as con:
        # a primeira ativação não tem anterior
        with pytest.raises(psycopg.errors.CheckViolation, match="CONFIG_SEM_ANTERIOR"):
            con.execute("select helena_v2.reverter_configuracao(%s)", (r0["id"],))
    ativar(banco, r1, r0["id"])
    with banco.conectar(papel="authenticated") as con:
        # verificação otimista: quem viu outra ativa não reverte
        for errada in (None, r0["id"]):
            with pytest.raises(psycopg.errors.SerializationFailure, match="CONFIG_ATIVA_DESATUALIZADA"):
                con.execute("select helena_v2.reverter_configuracao(%s)", (errada,))
        # a anterior (inativa) pode ser aposentada; depois disso a reversão é recusada e nada muda
        assert con.execute("select helena_v2.aposentar_configuracao(%s)", (r0["id"],)).fetchone()[0]["estado"] == "APOSENTADA"
        with pytest.raises(psycopg.errors.CheckViolation, match="CONFIG_ANTERIOR_NAO_VALIDADA"):
            con.execute("select helena_v2.reverter_configuracao(%s)", (r1["id"],))
    assert ponteiro(banco) == r1["id"]
    assert [t for *_, t in historico(banco)] == ["ATIVACAO", "ATIVACAO"]


def test_ativar_continua_recusando_nao_validada_e_nao_fundador_sem_gravar_linha(cenario):
    banco, bundle, _, base, (r0, _) = cenario
    with banco.conectar(papel="authenticated") as con:
        rascunho = T12.salvar(con, bundle, nome="Só rascunho", base_id=base["id"])
        with pytest.raises(psycopg.errors.CheckViolation, match="CONFIG_NAO_VALIDADA"):
            con.execute("select helena_v2.ativar_configuracao(%s,null)", (rascunho["id"],))
        con.execute("select set_config('request.jwt.claim.sub', %s, false)", (C.OUTRA_PESSOA_TESTE,))
        with pytest.raises(psycopg.errors.InsufficientPrivilege, match="SOMENTE_FUNDADOR_AUTENTICADO"):
            con.execute("select helena_v2.ativar_configuracao(%s,null)", (r0["id"],))
    with banco.conectar(papel="service_role") as con:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute("select helena_v2.ativar_configuracao(%s,null)", (r0["id"],))
    assert historico(banco) == []


def test_ativacoes_concorrentes_continuam_com_cas_e_reversoes_concorrentes_tambem(cenario):
    banco, _, _, _, (r0, r1) = cenario
    candidatas = [r0, r1]
    resultados = T12.duas_sessoes_ao_mesmo_tempo(
        banco, lambda con, n: con.execute("select helena_v2.ativar_configuracao(%s,null)",
                                          (candidatas[n]["id"],)).fetchone()[0])
    assert sorted(tipo for tipo, _ in resultados) == ["conflito", "ok"]
    vencedora = next(valor for tipo, valor in resultados if tipo == "ok")
    assert historico(banco) == [(vencedora["id"], None, FUNDADOR, "ATIVACAO")]
    perdedora = r1 if vencedora["id"] == r0["id"] else r0
    ativar(banco, perdedora, vencedora["id"])
    # duas reversões com a mesma "ativa esperada": só uma vence, a outra vê a ativa já trocada.
    resultados = T12.duas_sessoes_ao_mesmo_tempo(
        banco, lambda con, n: con.execute("select helena_v2.reverter_configuracao(%s)",
                                          (perdedora["id"],)).fetchone()[0])
    assert sorted(tipo for tipo, _ in resultados) == ["conflito", "ok"]
    assert ponteiro(banco) == vencedora["id"]
    assert [t for *_, t in historico(banco)] == ["ATIVACAO", "ATIVACAO", "REVERSAO"]


def test_anon_membro_e_service_role_negados_e_tabela_fechada(cenario):
    banco, _, _, _, (r0, r1) = cenario
    ativar(banco, r0)
    ativar(banco, r1, r0["id"])
    chamadas = (("select helena_v2.listar_ativacoes()", ()), ("select helena_v2.reverter_configuracao(%s)", (r1["id"],)))
    for papel in ("anon", "h2t_curioso", "service_role"):
        with banco.conectar(papel=papel) as con:
            for comando, args in chamadas:
                with pytest.raises(psycopg.errors.InsufficientPrivilege):
                    con.execute(comando, args)
    with banco.conectar(papel="authenticated") as con:
        con.execute("select set_config('request.jwt.claim.sub', %s, false)", (C.OUTRA_PESSOA_TESTE,))
        for comando, args in chamadas:
            with pytest.raises(psycopg.errors.InsufficientPrivilege, match="SOMENTE_FUNDADOR_AUTENTICADO"):
                con.execute(comando, args)
    with banco.conectar(papel="authenticated") as con:  # sem identidade nenhuma
        con.execute("select set_config('request.jwt.claim.sub', '', false)")
        with pytest.raises(psycopg.errors.InsufficientPrivilege, match="SOMENTE_FUNDADOR_AUTENTICADO"):
            con.execute("select helena_v2.listar_ativacoes()")
    assert ponteiro(banco) == r1["id"] and len(historico(banco)) == 2
    with banco.conectar() as dono:
        for papel in ("public", "anon", "authenticated", "service_role", "h2t_curioso"):
            for direito in ("select", "insert", "update", "delete", "truncate", "references", "trigger"):
                assert dono.execute("select has_table_privilege(%s,'helena_v2.configuracao_ativacao',%s)",
                                    (papel, direito)).fetchone()[0] is False, (papel, direito)
        for papel, esperado in (("authenticated", True), ("public", False), ("anon", False), ("service_role", False)):
            for funcao in ("listar_ativacoes(integer)", "reverter_configuracao(uuid)", "ativar_configuracao(uuid,uuid)"):
                assert dono.execute("select has_function_privilege(%s,%s,'execute')",
                                    (papel, "helena_v2." + funcao)).fetchone()[0] is esperado, (papel, funcao)
        for papel in ("public", "anon", "authenticated", "service_role"):
            assert dono.execute("select has_function_privilege(%s,'helena_v2._config_ativacao_so_acrescenta()','execute')",
                                (papel,)).fetchone()[0] is False
    for papel in ("anon", "authenticated", "service_role"):
        with banco.conectar(papel=papel) as con:
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                con.execute("select * from helena_v2.configuracao_ativacao")


def test_tabela_so_de_acrescimo_e_restricoes_de_forma(cenario):
    banco, _, _, _, (r0, r1) = cenario
    ativar(banco, r0)
    ativar(banco, r1, r0["id"])
    antes = historico(banco)
    with banco.conectar() as dono:  # até o dono do banco fica barrado pelos gatilhos
        for comando in ("update helena_v2.configuracao_ativacao set tipo='REVERSAO'",
                        "update helena_v2.configuracao_ativacao set ativada_por=gen_random_uuid()",
                        "delete from helena_v2.configuracao_ativacao",
                        "truncate helena_v2.configuracao_ativacao"):
            with pytest.raises(psycopg.errors.InsufficientPrivilege, match="CONFIG_ATIVACAO_SO_ACRESCENTA"):
                dono.execute(comando)
        dono.execute("select set_config('request.jwt.claim.sub', %s, false)", (FUNDADOR,))
        with pytest.raises(psycopg.errors.CheckViolation):  # tipo fora da lista
            dono.execute("insert into helena_v2.configuracao_ativacao(configuracao_id,tipo) values (%s,'OUTRO')",
                         (r0["id"],))
        with pytest.raises(psycopg.errors.CheckViolation):  # anterior igual à própria revisão
            dono.execute("insert into helena_v2.configuracao_ativacao(configuracao_id,anterior_id,tipo) values (%s,%s,'ATIVACAO')",
                         (r0["id"], r0["id"]))
        with pytest.raises(psycopg.errors.ForeignKeyViolation):  # revisão que não existe
            dono.execute("insert into helena_v2.configuracao_ativacao(configuracao_id,tipo) values (gen_random_uuid(),'ATIVACAO')")
        dono.execute("select set_config('request.jwt.claim.sub', '', false)")
        with pytest.raises(psycopg.errors.NotNullViolation):  # sem pessoa, sem linha
            dono.execute("insert into helena_v2.configuracao_ativacao(configuracao_id,tipo) values (%s,'ATIVACAO')",
                         (r0["id"],))
    assert historico(banco) == antes
