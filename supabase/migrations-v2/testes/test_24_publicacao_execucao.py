"""O que é: prova da migration 0018 (estados do pedido de publicação e as quatro portas do trabalhador), em bancos locais
descartáveis com a forma do projeto canônico e TODAS as migrations (`banco_integral`). Não publica nada: não há destino real.
Como mudar: estado ou transição nova entra em ESTADOS/LEGAIS e nos casos abaixo; porta nova entra em SO_SERVICO.
"""
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest
from psycopg import errors as E

import conftest as C
from integral import banco_integral

ESTADOS = ("PEDIDA", "EM_EXECUCAO", "PUBLICADA", "FALHOU", "REVERTIDA")
LEGAIS = {("PEDIDA", "EM_EXECUCAO"), ("EM_EXECUCAO", "PUBLICADA"), ("EM_EXECUCAO", "FALHOU"), ("PUBLICADA", "REVERTIDA")}
SO_SERVICO = ("reivindicar_publicacao()", "concluir_publicacao(bigint,text,text)",
              "falhar_publicacao(bigint,text)", "reverter_publicacao(bigint)")
CHAMADAS_DO_TRABALHADOR = ("select helena_v2.reivindicar_publicacao()",
                           "select helena_v2.concluir_publicacao(1,'FALSO_DE_TESTE','v1')",
                           "select helena_v2.falhar_publicacao(1,'erro')",
                           "select helena_v2.reverter_publicacao(1)")
# Cada estado com exatamente os campos que cabem nele (para tentar o salto na mão, sem ferir o CHECK).
SET_DO_ESTADO = {
    "PEDIDA": "estado='PEDIDA', iniciada_em=null, concluida_em=null, falhou_em=null, revertida_em=null, destino=null, versao_publicada=null, erro=null",
    "EM_EXECUCAO": "estado='EM_EXECUCAO', iniciada_em=now(), concluida_em=null, falhou_em=null, revertida_em=null, destino=null, versao_publicada=null, erro=null",
    "PUBLICADA": "estado='PUBLICADA', iniciada_em=now(), concluida_em=now(), falhou_em=null, revertida_em=null, destino='x', versao_publicada='v', erro=null",
    "FALHOU": "estado='FALHOU', iniciada_em=now(), concluida_em=null, falhou_em=now(), revertida_em=null, destino=null, versao_publicada=null, erro='x'",
    "REVERTIDA": "estado='REVERTIDA', iniciada_em=now(), concluida_em=now(), falhou_em=null, revertida_em=now(), destino='x', versao_publicada='v', erro=null",
}


@pytest.fixture()
def integral(servidor):
    with banco_integral(servidor) as banco:
        yield banco


# ---------------------------------------------------------------------------------------------------------- ajudas
def servico(banco, consulta, *args):
    with banco.conectar("service_role") as con:
        return con.execute(consulta, args).fetchone()[0]


def pedir(banco):
    with banco.conectar("authenticated") as fundador:
        return fundador.execute("select helena_v2.pedir_publicacao()").fetchone()[0]


def situacao(banco, uid=None):
    with banco.conectar("authenticated") as pessoa:
        if uid:
            pessoa.execute("select set_config('request.jwt.claim.sub', %s, false)", (uid,))
        return pessoa.execute("select helena_v2.situacao_publicacao()").fetchone()[0]


def linha(banco, pid):
    with banco.conectar() as dono:
        dono.execute("set time zone 'UTC'")
        return dono.execute("select estado,destino,versao_publicada,iniciada_em,concluida_em,falhou_em,revertida_em,erro "
                            "from helena_v2.publicacoes where id=%s", (pid,)).fetchone()


def levar_ate(banco, estado):
    """Pede (como o fundador) e leva o pedido de hoje até `estado`, só pelas portas reais. Devolve o id."""
    pid = pedir(banco)["pedido"]["id"]
    if estado == "PEDIDA":
        return pid
    assert servico(banco, "select helena_v2.reivindicar_publicacao()")["id"] == pid
    if estado == "FALHOU":
        servico(banco, "select helena_v2.falhar_publicacao(%s,%s)", pid, "erro de teste")
    elif estado in ("PUBLICADA", "REVERTIDA"):
        servico(banco, "select helena_v2.concluir_publicacao(%s,%s,%s)", pid, "FALSO_DE_TESTE", "v-1")
        if estado == "REVERTIDA":
            servico(banco, "select helena_v2.reverter_publicacao(%s)", pid)
    return pid


def semear(banco, idades_em_horas, quem=C.FUNDADOR_TESTE):
    """Pedidos PEDIDA de dias diferentes (o dono insere direto; cada um com `idade` em horas). Devolve os ids na ordem dada."""
    ids = []
    with banco.conectar() as dono:
        for i, idade in enumerate(idades_em_horas):
            ids.append(dono.execute(
                "insert into helena_v2.publicacoes (solicitado_por, pedido_em, dia_brasilia) values "
                "(%s, now() - make_interval(hours => %s), (now() at time zone 'America/Sao_Paulo')::date - %s) returning id",
                (quem, idade, i + 1)).fetchone()[0])
    return ids


# --------------------------------------------------------------------------------------------------- permissões
def test_matriz_das_portas_catalogo(integral):
    with integral.conectar() as dono:
        for assinatura in SO_SERVICO:
            funcao = "helena_v2." + assinatura
            for papel in ("public", "anon", "authenticated", "h2t_curioso", "h2t_fundador", "h2t_motor"):
                assert dono.execute("select has_function_privilege(%s,%s,'execute')", (papel, funcao)).fetchone()[0] is False, (papel, funcao)
            assert dono.execute("select has_function_privilege('service_role',%s,'execute')", (funcao,)).fetchone()[0] is True
        for assinatura in ("pedir_publicacao()", "situacao_publicacao()", "sou_fundador()"):
            funcao = "helena_v2." + assinatura
            assert dono.execute("select has_function_privilege('authenticated',%s,'execute')", (funcao,)).fetchone()[0] is True
            for papel in ("public", "anon", "service_role"):
                assert dono.execute("select has_function_privilege(%s,%s,'execute')", (papel, funcao)).fetchone()[0] is False, (papel, funcao)
        # as funções internas (gatilho e retrato) não são porta de ninguém
        for funcao in ("helena_v2.trg_publicacao_transicao()", "helena_v2._publicacao_json(helena_v2.publicacoes)"):
            for papel in ("public", "anon", "authenticated", "service_role"):
                assert dono.execute("select has_function_privilege(%s,%s,'execute')", (papel, funcao)).fetchone()[0] is False, (papel, funcao)
        novas = dono.execute("""select p.proname, p.prosecdef, p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
            where n.nspname='helena_v2' and p.proname in ('reivindicar_publicacao','concluir_publicacao','falhar_publicacao',
              'reverter_publicacao','situacao_publicacao')""").fetchall()
        assert len(novas) == 5
        for nome, secdef, config in novas:
            assert secdef is True, nome
            assert [c.replace(" ", "") for c in config] == ["search_path=pg_catalog,pg_temp"], nome


def test_anon_authenticated_e_estranho_nao_chamam_as_portas_do_trabalhador(integral):
    pid = levar_ate(integral, "EM_EXECUCAO")
    antes = linha(integral, pid)
    for papel in ("anon", "authenticated", "h2t_curioso", "h2t_fundador"):
        with integral.conectar(papel) as con:
            for consulta in CHAMADAS_DO_TRABALHADOR:
                with pytest.raises(E.InsufficientPrivilege):
                    con.execute(consulta)
    with integral.conectar("authenticated") as membro:           # o membro (não fundador) também não
        membro.execute("select set_config('request.jwt.claim.sub', %s, false)", (C.OUTRA_PESSOA_TESTE,))
        for consulta in CHAMADAS_DO_TRABALHADOR:
            with pytest.raises(E.InsufficientPrivilege):
                membro.execute(consulta)
    assert linha(integral, pid) == antes


def test_servico_nao_pede_nem_ve_como_fundador_e_ninguem_escreve_na_tabela_direto(integral):
    pid = levar_ate(integral, "PEDIDA")
    with integral.conectar("service_role") as motor:
        with pytest.raises(E.InsufficientPrivilege):
            motor.execute("select helena_v2.pedir_publicacao()")
        with pytest.raises(E.InsufficientPrivilege):
            motor.execute("select helena_v2.situacao_publicacao()")
        assert motor.execute("select count(*) from helena_v2.publicacoes").fetchone()[0] == 1       # o motor só lê
    for papel in ("authenticated", "service_role"):
        with integral.conectar(papel) as con:
            for escrita in ("update helena_v2.publicacoes set estado='PUBLICADA'",
                            "delete from helena_v2.publicacoes",
                            "insert into helena_v2.publicacoes(solicitado_por,pedido_em,dia_brasilia) values (gen_random_uuid(), now(), current_date - 40)"):
                with pytest.raises(E.InsufficientPrivilege):
                    con.execute(escrita)
    for papel in ("anon", "h2t_curioso"):
        with integral.conectar(papel) as con:
            with pytest.raises(E.InsufficientPrivilege):
                con.execute("select count(*) from helena_v2.publicacoes")
    assert linha(integral, pid)[0] == "PEDIDA"


def test_fundador_so_pede_e_ve_o_proprio_pedido(integral):
    pedido = pedir(integral)
    with integral.conectar("authenticated") as fundador:
        assert fundador.execute("select count(*) from helena_v2.publicacoes").fetchone()[0] == 1
    semear(integral, [30], quem=C.OUTRA_PESSOA_TESTE)                    # um pedido de outra pessoa
    with integral.conectar("authenticated") as fundador:
        assert [r[0] for r in fundador.execute("select id from helena_v2.publicacoes")] == [pedido["pedido"]["id"]]
    with integral.conectar("authenticated") as membro:
        membro.execute("select set_config('request.jwt.claim.sub', %s, false)", (C.OUTRA_PESSOA_TESTE,))
        assert membro.execute("select count(*) from helena_v2.publicacoes").fetchone()[0] == 0         # membro não é fundador
        with pytest.raises(E.InsufficientPrivilege):
            membro.execute("select helena_v2.pedir_publicacao()")
        visto = membro.execute("select helena_v2.situacao_publicacao()").fetchone()[0]
        assert visto["fundador"] is False and visto["pedido"] is None


# ----------------------------------------------------------------------------- 1 pedido por dia continua valendo
@pytest.mark.parametrize("estado", ESTADOS)
def test_um_pedido_por_dia_vale_em_todo_estado(integral, estado):
    pid = levar_ate(integral, estado)
    outra_vez = pedir(integral)
    assert outra_vez["ja_usado_hoje"] is True and outra_vez["pedido"]["id"] == pid
    with integral.conectar() as dono:
        assert dono.execute("select count(*) from helena_v2.publicacoes").fetchone()[0] == 1
    assert situacao(integral)["pedido"]["estado"] == estado


def test_pedidos_concorrentes_registram_um_unico_pedido(integral):
    def pedir_um(_):
        return pedir(integral)

    with ThreadPoolExecutor(max_workers=8) as fila:
        pedidos = list(fila.map(pedir_um, range(8)))
    assert len({p["pedido"]["id"] for p in pedidos}) == 1
    assert sum(not p["ja_usado_hoje"] for p in pedidos) == 1
    with integral.conectar() as dono:
        assert dono.execute("select count(*) from helena_v2.publicacoes").fetchone()[0] == 1


@pytest.mark.parametrize("fuso", ["Pacific/Kiritimati", "Pacific/Pago_Pago", "UTC"])
def test_dia_do_pedido_e_da_situacao_usa_brasilia_independente_da_sessao(integral, fuso):
    with integral.conectar("authenticated") as fundador:
        fundador.execute("select set_config('TimeZone', %s, false)", (fuso,))
        antes = datetime.now(ZoneInfo("America/Sao_Paulo")).date()
        pedido = fundador.execute("select helena_v2.pedir_publicacao()").fetchone()[0]
        depois = datetime.now(ZoneInfo("America/Sao_Paulo")).date()
        dia = fundador.execute("select (pedido_em at time zone 'America/Sao_Paulo')::date::text from helena_v2.publicacoes where id=%s",
                               (pedido["pedido"]["id"],)).fetchone()[0]
        assert pedido["dia_brasilia"] == pedido["pedido"]["dia_brasilia"] == dia
        assert date.fromisoformat(dia) in {antes, depois}
        atual = fundador.execute("select helena_v2.situacao_publicacao()").fetchone()[0]
        assert atual["dia_brasilia"] == dia and atual["pedido"]["id"] == pedido["pedido"]["id"] and atual["pedido"]["estado"] == "PEDIDA"
        assert fundador.execute("select helena_v2.pedir_publicacao()").fetchone()[0]["ja_usado_hoje"] is True


def test_pedido_de_ontem_nao_e_o_de_hoje_e_hoje_aceita_um_novo(integral):
    ontem = semear(integral, [26])[0]                                      # semear põe o primeiro no dia de Brasília anterior
    assert situacao(integral)["pedido"] is None                            # a tela oferece o botão
    novo = pedir(integral)
    assert novo["ja_usado_hoje"] is False and novo["pedido"]["id"] != ontem
    assert situacao(integral)["pedido"]["id"] == novo["pedido"]["id"]


def test_pedir_publicacao_e_dia_brasilia_ficam_iguais_aos_da_0005(servidor):
    def retrato(banco):
        with banco.conectar() as con:
            funcao = con.execute("""select p.prosrc, p.prosecdef, p.provolatile, p.proconfig, p.prorettype::regtype::text,
                pg_get_function_arguments(p.oid) from pg_proc p where p.oid='helena_v2.pedir_publicacao()'::regprocedure""").fetchone()
            coluna = con.execute("""select data_type, is_nullable from information_schema.columns where table_schema='helena_v2'
                and table_name='publicacoes' and column_name='dia_brasilia'""").fetchone()
            unica = con.execute("""select pg_get_constraintdef(oid) from pg_constraint
                where conrelid='helena_v2.publicacoes'::regclass and contype='u'""").fetchall()
            acessos = [con.execute("select has_function_privilege(%s,'helena_v2.pedir_publicacao()','execute')", (papel,)).fetchone()[0]
                       for papel in ("public", "anon", "authenticated", "service_role")]
            return funcao, coluna, unica, acessos

    with banco_integral(servidor, ate=5) as da_0005, banco_integral(servidor) as completo:
        assert retrato(da_0005) == retrato(completo)
        assert retrato(completo)[3] == [False, False, True, False]


# ------------------------------------------------------------------------------------------ situação verdadeira
def test_situacao_diz_a_verdade_em_cada_estado(integral):
    pid = levar_ate(integral, "PEDIDA")
    p = situacao(integral)["pedido"]
    assert p["id"] == pid and p["estado"] == "PEDIDA"
    assert p["iniciada_em"] is p["concluida_em"] is p["versao_publicada"] is p["destino"] is p["erro"] is None

    assert servico(integral, "select helena_v2.reivindicar_publicacao()")["id"] == pid
    p = situacao(integral)["pedido"]
    assert p["estado"] == "EM_EXECUCAO" and p["iniciada_em"] is not None
    assert p["concluida_em"] is p["versao_publicada"] is p["destino"] is p["erro"] is None      # em execução NÃO é no ar

    servico(integral, "select helena_v2.concluir_publicacao(%s,%s,%s)", pid, "FALSO_DE_TESTE", "v-77")
    p = situacao(integral)["pedido"]
    assert p["estado"] == "PUBLICADA" and p["destino"] == "FALSO_DE_TESTE" and p["versao_publicada"] == "v-77"
    assert p["concluida_em"] is not None and p["revertida_em"] is None and p["erro"] is None

    servico(integral, "select helena_v2.reverter_publicacao(%s)", pid)
    p = situacao(integral)["pedido"]
    assert p["estado"] == "REVERTIDA" and p["revertida_em"] is not None and p["versao_publicada"] == "v-77"


def test_situacao_de_pedido_que_falhou_nunca_parece_publicado(integral):
    pid = levar_ate(integral, "FALHOU")
    p = situacao(integral)["pedido"]
    assert p["id"] == pid and p["estado"] == "FALHOU" and p["erro"] == "erro de teste" and p["falhou_em"] is not None
    assert p["versao_publicada"] is None and p["destino"] is None and p["concluida_em"] is None and p["revertida_em"] is None
    with integral.conectar("service_role") as motor:                          # FALHOU não volta nem conclui
        for consulta in ("select helena_v2.concluir_publicacao(%s,'FALSO_DE_TESTE','v1')", "select helena_v2.reverter_publicacao(%s)"):
            with pytest.raises(E.CheckViolation):
                motor.execute(consulta, (pid,))
        assert motor.execute("select helena_v2.reivindicar_publicacao()").fetchone()[0] is None
    assert situacao(integral)["pedido"]["estado"] == "FALHOU"


def test_pedido_novo_nasce_pedida_e_nao_aparece_como_no_ar(integral):
    resposta = pedir(integral)
    assert set(resposta["pedido"]) == {"id", "pedido_em", "dia_brasilia"}           # pedir_publicacao não mudou de forma
    p = situacao(integral)["pedido"]
    assert p["estado"] == "PEDIDA" and p["versao_publicada"] is None and p["concluida_em"] is None


# ------------------------------------------------------------------------------------ transições ilegais barradas
@pytest.mark.parametrize("antigo", ESTADOS)
def test_salto_ilegal_na_mao_e_barrado_pelo_gatilho(integral, antigo):
    pid = levar_ate(integral, antigo)
    antes = linha(integral, pid)
    with integral.conectar() as dono:                                             # o próprio dono também é barrado
        for novo in ESTADOS:
            consulta = f"update helena_v2.publicacoes set {SET_DO_ESTADO[novo]} where id=%s"
            if (antigo, novo) in LEGAIS:
                continue
            with pytest.raises(E.CheckViolation, match="transição"):
                dono.execute(consulta, (pid,))
    assert linha(integral, pid) == antes


def test_gatilho_e_o_que_barra_o_salto_defeito_plantado(integral):
    """Sem o gatilho, só o CHECK de coerência sobra, e ele aceita FALHOU -> PUBLICADA: a prova acima depende do gatilho."""
    pid = levar_ate(integral, "FALHOU")
    with integral.conectar() as dono:
        dono.execute("alter table helena_v2.publicacoes disable trigger b_publicacao_transicao")
        dono.execute("update helena_v2.publicacoes set estado='PUBLICADA', falhou_em=null, erro=null, concluida_em=now(), "
                     "destino='x', versao_publicada='v' where id=%s", (pid,))
    assert linha(integral, pid)[0] == "PUBLICADA"


@pytest.mark.parametrize("estado", ESTADOS)
def test_portas_recusam_transicao_ilegal_e_o_pedido_nao_muda(integral, estado):
    pid = levar_ate(integral, estado)
    antes = linha(integral, pid)
    chamadas = {"EM_EXECUCAO": ["select helena_v2.concluir_publicacao(%s,'FALSO_DE_TESTE','v1')", "select helena_v2.falhar_publicacao(%s,'e')"],
                "PUBLICADA": ["select helena_v2.reverter_publicacao(%s)"]}
    with integral.conectar("service_role") as motor:
        for dono_da_chamada, consultas in chamadas.items():
            if dono_da_chamada == estado:
                continue                                                          # essas são as transições legais
            for consulta in consultas:
                with pytest.raises(E.CheckViolation):
                    motor.execute(consulta, (pid,))
        if estado != "PEDIDA":
            assert motor.execute("select helena_v2.reivindicar_publicacao()").fetchone()[0] is None     # nunca devolve o que já andou
        if estado != "EM_EXECUCAO":
            with pytest.raises(E.CheckViolation):
                motor.execute("select helena_v2.concluir_publicacao(%s,'FALSO_DE_TESTE','v1')", (pid,))
    assert linha(integral, pid) == antes


def test_em_execucao_nunca_volta_a_pedida_nem_e_reivindicado_de_novo(integral):
    pid = levar_ate(integral, "EM_EXECUCAO")
    with integral.conectar() as dono:
        with pytest.raises(E.CheckViolation, match="transição"):
            dono.execute("update helena_v2.publicacoes set estado='PEDIDA', iniciada_em=null where id=%s", (pid,))
    assert servico(integral, "select helena_v2.reivindicar_publicacao()") is None
    assert linha(integral, pid)[0] == "EM_EXECUCAO"


def test_pedido_inexistente_e_parametros_invalidos(integral):
    pid = levar_ate(integral, "EM_EXECUCAO")
    with integral.conectar("service_role") as motor:
        for consulta in ("select helena_v2.concluir_publicacao(999,'FALSO_DE_TESTE','v1')", "select helena_v2.falhar_publicacao(999,'e')",
                         "select helena_v2.reverter_publicacao(999)", "select helena_v2.reverter_publicacao(null)"):
            with pytest.raises(E.NoDataFound):
                motor.execute(consulta)
        for destino, versao in (("", "v1"), ("   ", "v1"), ("FALSO_DE_TESTE", ""), ("FALSO_DE_TESTE", None), (None, "v1"), ("x" * 121, "v1"), ("d", "v" * 121)):
            with pytest.raises(E.InvalidParameterValue):
                motor.execute("select helena_v2.concluir_publicacao(%s,%s,%s)", (pid, destino, versao))
    assert linha(integral, pid)[0] == "EM_EXECUCAO"                                # nada concluído por parâmetro ruim


def test_identidade_e_historico_do_pedido_nao_se_reescrevem(integral):
    pid = levar_ate(integral, "PUBLICADA")
    antes = linha(integral, pid)
    with integral.conectar() as dono:
        for mudanca in ("solicitado_por=gen_random_uuid()", "pedido_em=pedido_em + interval '1 hour'", "dia_brasilia=dia_brasilia - 1"):
            with pytest.raises(E.CheckViolation, match="não mudam"):
                dono.execute(f"update helena_v2.publicacoes set {mudanca}, estado='REVERTIDA', revertida_em=now() where id=%s", (pid,))
        with pytest.raises(E.CheckViolation, match="não é reescrito"):
            dono.execute("update helena_v2.publicacoes set estado='REVERTIDA', revertida_em=now(), versao_publicada='outra' where id=%s", (pid,))
        with pytest.raises(E.CheckViolation, match="não é reescrito"):
            dono.execute("update helena_v2.publicacoes set estado='REVERTIDA', revertida_em=now(), concluida_em=now() + interval '1 day' where id=%s", (pid,))
    assert linha(integral, pid) == antes


def test_check_de_coerencia_barra_campos_que_nao_cabem_no_estado(integral):
    pid = levar_ate(integral, "PEDIDA")
    with integral.conectar() as dono:
        for mudanca in ("estado='EM_EXECUCAO'",                                    # sem iniciada_em
                        "estado='EM_EXECUCAO', iniciada_em=now(), versao_publicada='v'",
                        "estado='EM_EXECUCAO', iniciada_em=now(), erro='e'"):
            with pytest.raises(E.CheckViolation) as erro:
                dono.execute(f"update helena_v2.publicacoes set {mudanca} where id=%s", (pid,))
            assert erro.value.diag.constraint_name == "ck_publicacoes_campos_do_estado"
        with pytest.raises(E.CheckViolation, match="nasce PEDIDA"):
            dono.execute("insert into helena_v2.publicacoes(solicitado_por,pedido_em,dia_brasilia,estado,iniciada_em,concluida_em,destino,versao_publicada) "
                         "values (%s, now(), current_date - 50, 'PUBLICADA', now(), now(), 'x', 'v')", (C.FUNDADOR_TESTE,))
        with pytest.raises(E.CheckViolation):
            dono.execute("update helena_v2.publicacoes set estado='lixo' where id=%s", (pid,))
    assert linha(integral, pid)[0] == "PEDIDA"


# ------------------------------------------------------------------------------- reivindicar: fila e concorrência
def test_reivindicar_pega_o_mais_antigo_pelo_pedido_em_e_para_quando_acaba(integral):
    ids = semear(integral, [2, 50, 10])                  # ids 1,2,3; o mais antigo é o id 2 (50 h), depois o 3 (10 h), depois o 1
    achados = [servico(integral, "select helena_v2.reivindicar_publicacao()") for _ in range(4)]
    assert [a["id"] for a in achados[:3]] == [ids[1], ids[2], ids[0]]
    assert achados[3] is None
    assert all(a["estado"] == "EM_EXECUCAO" and a["iniciada_em"] is not None for a in achados[:3])


def test_dois_trabalhadores_concorrentes_so_um_reivindica(integral):
    unico = semear(integral, [1])[0]
    barreira = threading.Barrier(8)

    def tentar(_):
        with integral.conectar("service_role") as motor:
            barreira.wait(timeout=30)
            return motor.execute("select helena_v2.reivindicar_publicacao()").fetchone()[0]

    with ThreadPoolExecutor(max_workers=8) as fila:
        resultados = list(fila.map(tentar, range(8)))
    ganhadores = [r for r in resultados if r is not None]
    assert [g["id"] for g in ganhadores] == [unico]
    assert linha(integral, unico)[0] == "EM_EXECUCAO"


def test_varios_pedidos_e_varios_trabalhadores_nenhum_pedido_vai_a_dois(integral):
    ids = semear(integral, [6, 5, 4, 3, 2, 1])
    barreira = threading.Barrier(12)

    def tentar(_):
        with integral.conectar("service_role") as motor:
            barreira.wait(timeout=30)
            return motor.execute("select helena_v2.reivindicar_publicacao()").fetchone()[0]

    with ThreadPoolExecutor(max_workers=12) as fila:
        resultados = list(fila.map(tentar, range(12)))
    vindos = sorted(r["id"] for r in resultados if r is not None)
    assert vindos == sorted(ids)                                        # cada pedido levado uma única vez, nenhum perdido
    with integral.conectar() as dono:
        assert dono.execute("select count(*) from helena_v2.publicacoes where estado='EM_EXECUCAO'").fetchone()[0] == 6


def test_reivindicar_pula_o_pedido_travado_por_outro_trabalhador_sem_esperar(integral):
    ids = semear(integral, [30, 20, 10])
    a = integral.conectar("service_role")
    try:
        a.execute("begin")
        primeiro = a.execute("select helena_v2.reivindicar_publicacao()").fetchone()[0]       # ainda sem confirmar
        assert primeiro["id"] == ids[0]
        with integral.conectar("service_role") as b:
            b.execute("set lock_timeout='3s'")                                               # esperar demais seria falha
            segundo = b.execute("select helena_v2.reivindicar_publicacao()").fetchone()[0]
        assert segundo["id"] == ids[1]
        a.execute("rollback")                                                                # o primeiro volta a PEDIDA
    finally:
        a.close()
    assert linha(integral, ids[0])[0] == "PEDIDA"
    assert servico(integral, "select helena_v2.reivindicar_publicacao()")["id"] == ids[0]


# ------------------------------------------------------------------------------------------- erro sem segredo
def test_erro_curto_sem_segredo_e_nunca_vazio(integral):
    # valores montados aqui só para o teste; nenhum é segredo real
    fala = ("falhou ao entrar em postgresql://usuario:" + "SENHA_FALSA_9" + "@host.exemplo/db; senha=" + "EXEMPLO_NAO_REAL_1" +
            " chave sk-" + "A" * 24 + " jwt eyJ" + "a" * 10 + "." + "b" * 10 + "." + "c" * 10 + " Bearer " + "d" * 30 + " token: " + "EXEMPLO_NAO_REAL_2" +
            "\nlinha\ttab " + "x" * 400)
    pid = levar_ate(integral, "EM_EXECUCAO")
    guardado = servico(integral, "select helena_v2.falhar_publicacao(%s,%s)", pid, fala)["erro"]
    assert len(guardado) <= 300 and "\n" not in guardado and "\t" not in guardado
    for segredo in ("SENHA_FALSA_9", "EXEMPLO_NAO_REAL_1", "EXEMPLO_NAO_REAL_2", "sk-" + "A" * 24, "d" * 30, "a" * 10):
        assert segredo not in guardado, segredo
    assert guardado.startswith("falhou ao entrar em [REMOVIDO:URL_COM_SENHA]")
    assert linha(integral, pid)[0] == "FALHOU"


@pytest.mark.parametrize("texto,esperado", [(None, "ERRO_NAO_INFORMADO"), ("", "ERRO_NAO_INFORMADO"), ("   \n ", "ERRO_NAO_INFORMADO"),
                                            ("x" * 1000, "x" * 300)])
def test_erro_vazio_vira_marcador_e_longo_e_cortado(integral, texto, esperado):
    pid = levar_ate(integral, "EM_EXECUCAO")
    assert servico(integral, "select helena_v2.falhar_publicacao(%s,%s)", pid, texto)["erro"] == esperado


# ------------------------------------------------------------------------------------------- linhas antigas
def test_linhas_antigas_sem_estado_viram_pedida_e_continuam_funcionando(servidor):
    with banco_integral(servidor, ate=16) as banco:
        with banco.conectar("authenticated") as fundador:
            hoje = fundador.execute("select helena_v2.pedir_publicacao()").fetchone()[0]["pedido"]["id"]
        with banco.conectar() as dono:
            antigo = dono.execute(
                "insert into helena_v2.publicacoes(solicitado_por,pedido_em,dia_brasilia) values "
                "(%s, now() - interval '3 days', (now() at time zone 'America/Sao_Paulo')::date - 3) returning id", (C.FUNDADOR_TESTE,)).fetchone()[0]
            assert not dono.execute("select 1 from information_schema.columns where table_schema='helena_v2' and table_name='publicacoes' and column_name='estado'").fetchone()
            dono.execute(C.ler_sql("0018_publicacao_execucao.sql"))                                # a migration em cima de linhas antigas
            assert dono.execute("select id, estado from helena_v2.publicacoes order by id").fetchall() == [(hoje, "PEDIDA"), (antigo, "PEDIDA")]
        atual = situacao(banco)["pedido"]
        assert atual["id"] == hoje and atual["estado"] == "PEDIDA" and atual["versao_publicada"] is None
        with banco.conectar("authenticated") as fundador:
            assert fundador.execute("select helena_v2.pedir_publicacao()").fetchone()[0]["ja_usado_hoje"] is True
        assert servico(banco, "select helena_v2.reivindicar_publicacao()")["id"] == antigo       # o mais antigo primeiro
