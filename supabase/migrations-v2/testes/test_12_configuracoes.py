"""O que é: prova revisões, validação interna e vínculo durável com cards.

Como mudar: use o bundle real de helena-v2 e teste cada nova porta e trava no banco local.
"""
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier

import psycopg
import pytest
import yaml
from psycopg.types.json import Jsonb

import conftest as C
import sorteio as S


RAIZ = Path(__file__).resolve().parents[3] / "helena-v2"


def bundle_real():
    paths = [RAIZ / n for n in ("servicos.yaml", "organograma.yaml", "models.yaml")]
    for pasta, ext in (("agents", "*.yaml"), ("deliverables", "*.yaml"),
                       ("playbooks", "*.yaml"), ("schemas", "*.json")):
        paths.extend(sorted((RAIZ / pasta).glob(ext)))
    paths.extend(RAIZ / "maquina" / n for n in
                 ("vocabulario.yaml", "passagens.yaml", "jornada.schema.json"))
    return {"helena-v2/" + str(p.relative_to(RAIZ)):
            json.loads(p.read_text()) if p.suffix == ".json" else yaml.safe_load(p.read_text())
            for p in paths}


def bootstrap(banco):
    bundle = bundle_real()
    with banco.conectar(papel="service_role") as con:
        digital = con.execute("select impressao_digital from helena_v2.meta_tabela").fetchone()[0]
        rev = con.execute("select helena_v2.registrar_configuracao_tecnica(%s,%s,%s)",
                          ("Configuração técnica do repositório", Jsonb(bundle), digital)).fetchone()[0]
    return bundle, digital, rev


def salvar(con, bundle, nome="Configuração editável", **kw):
    return con.execute("select helena_v2.salvar_rascunho(%s,%s,%s,%s,%s)",
                       (nome, Jsonb(bundle), kw.get("id"), kw.get("versao_esperada"),
                        kw.get("base_id"))).fetchone()[0]


def validar(banco, rev, digital):
    with banco.conectar(papel="authenticated") as con:
        req = con.execute("select helena_v2.solicitar_validacao_config(%s,%s)",
                          (rev["id"], rev["versao"])).fetchone()[0]
        assert req["validacao_pendente"] is True
    with banco.conectar(papel="service_role") as con:
        fila = con.execute("select helena_v2.listar_validacoes_pendentes()").fetchone()[0]
        pedido = next(p for p in fila if p["id"] == rev["id"])
        return con.execute("select helena_v2.registrar_validacao_config(%s,%s,%s,%s)",
                           (pedido["id"], pedido["versao"], pedido["hash_sha256"],
                            digital)).fetchone()[0]


def duas_sessoes_ao_mesmo_tempo(banco, operacao):
    barreira = Barrier(2)

    def chamar(numero):
        with banco.conectar(papel="authenticated") as con:
            barreira.wait(timeout=10)
            try:
                return ("ok", operacao(con, numero))
            except psycopg.errors.SerializationFailure:
                return ("conflito", None)

    with ThreadPoolExecutor(max_workers=2) as executor:
        futuros = [executor.submit(chamar, numero) for numero in (0, 1)]
        return [f.result(timeout=30) for f in futuros]


def test_bootstrap_tecnico_real_idempotente_e_sem_ativacao(fabrica):
    banco = fabrica({})
    bundle, digital, rev = bootstrap(banco)
    assert rev["estado"] == "VALIDADA" and rev["ativa"] is False
    assert rev["conteudo"] == bundle and len(rev["hash_sha256"]) == 64
    with banco.conectar(papel="service_role") as con:
        assert con.execute("select helena_v2.configuracao_ativa()").fetchone()[0] is None
        outra = con.execute("select helena_v2.registrar_configuracao_tecnica(%s,%s,%s)",
                            ("mesma base", Jsonb(bundle), digital)).fetchone()[0]
        assert outra["id"] == rev["id"]
    with banco.conectar(papel="authenticated") as con:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute("select helena_v2.registrar_configuracao_tecnica(%s,%s,%s)",
                        ("ilegítimo", Jsonb(bundle), digital))
        with pytest.raises(psycopg.errors.InsufficientPrivilege, match="CONFIG_SEM_ATIVACAO"):
            con.execute("select helena_v2.criar_card('config','pre-ativacao','x','Teste',now()+interval '2 days',%s,null,%s,0,false)",
                        (Jsonb(S.ROTEIRO_UMA_ETAPA), Jsonb({"config_revision_id": rev["id"]})))


def test_bootstrap_recusa_maquina_inventada_com_impressao_correta(fabrica):
    banco = fabrica({})
    bundle = bundle_real()
    bundle["helena-v2/maquina/vocabulario.yaml"] = {"alterado": True}
    with banco.conectar(papel="service_role") as con:
        digital = con.execute("select impressao_digital from helena_v2.meta_tabela").fetchone()[0]
        with pytest.raises(psycopg.errors.InvalidParameterValue, match="CONFIG_BUNDLE_INVALIDO"):
            con.execute("select helena_v2.registrar_configuracao_tecnica(%s,%s,%s)",
                        ("base inventada", Jsonb(bundle), digital))


def test_rascunho_cas_fila_erro_cancelamento_e_validacao(fabrica):
    banco = fabrica({})
    bundle, digital, base = bootstrap(banco)
    with banco.conectar(papel="authenticated") as con:
        rev = salvar(con, bundle, base_id=base["id"])
        assert rev["estado"] == "RASCUNHO" and rev["versao"] == 1
        with pytest.raises(psycopg.errors.SerializationFailure):
            salvar(con, bundle, id=rev["id"], versao_esperada=0)
        req = con.execute("select helena_v2.solicitar_validacao_config(%s,%s)",
                          (rev["id"], 1)).fetchone()[0]
        assert req["validacao_pendente"] is True
    with banco.conectar(papel="service_role") as con:
        pedido = con.execute("select helena_v2.listar_validacoes_pendentes()").fetchone()[0][0]
        erro = con.execute("select helena_v2.registrar_resultado_validacao(%s,%s,%s,%s)",
                           (pedido["id"], pedido["versao"], pedido["hash_sha256"],
                            Jsonb({"ok": False, "erros": ["referência inválida"]}))).fetchone()[0]
        assert erro["resultado_validacao"]["ok"] is False
    with banco.conectar(papel="authenticated") as con:
        con.execute("select helena_v2.solicitar_validacao_config(%s,%s)", (rev["id"], 1))
        rev2 = salvar(con, bundle, id=rev["id"], versao_esperada=1)
        assert rev2["versao"] == 2 and rev2["validacao_pendente"] is False
        with pytest.raises(psycopg.errors.SerializationFailure):
            con.execute("select helena_v2.solicitar_validacao_config(%s,%s)", (rev["id"], 1))
    validada = validar(banco, rev2, digital)
    assert validada["estado"] == "VALIDADA"
    with banco.conectar(papel="authenticated") as con:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            salvar(con, bundle, id=rev["id"], versao_esperada=2)


def test_duas_sessoes_editam_mesma_versao_so_uma_grava(fabrica):
    banco = fabrica({})
    bundle = bundle_real()
    with banco.conectar(papel="authenticated") as con:
        rev = salvar(con, bundle)

    resultados = duas_sessoes_ao_mesmo_tempo(
        banco, lambda con, n: salvar(con, bundle, nome=f"Edição {n}",
                                    id=rev["id"], versao_esperada=1))
    assert sorted(tipo for tipo, _ in resultados) == ["conflito", "ok"]
    vencedora = next(valor for tipo, valor in resultados if tipo == "ok")
    with banco.conectar(papel="authenticated") as con:
        final = con.execute("select helena_v2.ler_configuracao(%s)", (rev["id"],)).fetchone()[0]
    assert final["versao"] == vencedora["versao"] == 2
    assert final["nome"] == vencedora["nome"]


def test_apenas_fundador_ativa_cas_e_maquina_fixa(fabrica):
    banco = fabrica({})
    bundle, digital, base = bootstrap(banco)
    with banco.conectar(papel="authenticated") as con:
        con.execute("select set_config('request.jwt.claim.sub', %s, false)", (C.OUTRA_PESSOA_TESTE,))
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            salvar(con, bundle)
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute("select helena_v2.listar_configuracoes()")
    with banco.conectar(papel="service_role") as con:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute("select helena_v2.ativar_configuracao(%s,null)", (base["id"],))
    with banco.conectar(papel="authenticated") as con:
        ativa = con.execute("select helena_v2.ativar_configuracao(%s,null)", (base["id"],)).fetchone()[0]
        assert ativa["ativa"] is True
        with pytest.raises(psycopg.errors.SerializationFailure):
            con.execute("select helena_v2.ativar_configuracao(%s,null)", (base["id"],))
        with pytest.raises(psycopg.errors.CheckViolation):
            con.execute("select helena_v2.aposentar_configuracao(%s)", (base["id"],))
        outro = dict(bundle)
        outro["helena-v2/maquina/vocabulario.yaml"] = {"alterado": True}
        draft = salvar(con, outro)
    with banco.conectar(papel="authenticated") as con:
        con.execute("select helena_v2.solicitar_validacao_config(%s,%s)", (draft["id"], 1))
    with banco.conectar(papel="service_role") as con:
        pend = con.execute("select helena_v2.listar_validacoes_pendentes()").fetchone()[0][0]
        with pytest.raises(psycopg.errors.CheckViolation, match="CONFIG_MAQUINA_EXIGE_MIGRACAO"):
            con.execute("select helena_v2.registrar_validacao_config(%s,%s,%s,%s)",
                        (draft["id"], 1, pend["hash_sha256"], digital))


def test_duas_ativacoes_concorrentes_so_uma_vence(fabrica):
    banco = fabrica({})
    bundle, digital, base = bootstrap(banco)
    candidatas = []
    for numero in (0, 1):
        with banco.conectar(papel="authenticated") as con:
            rascunho = salvar(con, bundle, nome=f"Candidata {numero}", base_id=base["id"])
        candidatas.append(validar(banco, rascunho, digital))
    assert all(rev["estado"] == "VALIDADA" for rev in candidatas)

    resultados = duas_sessoes_ao_mesmo_tempo(
        banco, lambda con, n: con.execute(
            "select helena_v2.ativar_configuracao(%s,null)", (candidatas[n]["id"],)
        ).fetchone()[0])
    assert sorted(tipo for tipo, _ in resultados) == ["conflito", "ok"]
    vencedora = next(valor for tipo, valor in resultados if tipo == "ok")
    with banco.conectar(papel="authenticated") as con:
        lista = con.execute("select helena_v2.listar_configuracoes()").fetchone()[0]
    assert [rev["id"] for rev in lista if rev["ativa"]] == [vencedora["id"]]
    with banco.conectar() as con:
        ponteiros = con.execute("select count(*) from helena_v2.configuracao_ponteiro "
                                "where ativa_id = %s", (vencedora["id"],)).fetchone()[0]
    assert ponteiros == 1


def test_card_fixa_revisao_e_revisao_antiga_permanece_legivel(fabrica):
    banco = fabrica({})
    bundle, digital, base = bootstrap(banco)
    with banco.conectar(papel="authenticated") as con:
        primeira = salvar(con, bundle, base_id=base["id"])
    primeira = validar(banco, primeira, digital)
    with banco.conectar(papel="authenticated") as con:
        con.execute("select helena_v2.ativar_configuracao(%s,null)", (primeira["id"],))
    with banco.conectar(papel="service_role") as con:
        card = con.execute("select helena_v2.criar_card('config','primeiro','x','Teste',now()+interval '2 days',%s,null,%s,0,false)",
                           (Jsonb(S.ROTEIRO_UMA_ETAPA), Jsonb({"config_revision_id": primeira["id"]}))).fetchone()[0]
        row = con.execute("select ordem_de_servico from helena_v2.card where id=%s", (card["card_id"],)).fetchone()[0]
        assert row["config_revision_id"] == primeira["id"]
    with banco.conectar(papel="authenticated") as con:
        draft = salvar(con, bundle, base_id=base["id"])
    nova = validar(banco, draft, digital)
    with banco.conectar(papel="authenticated") as con:
        con.execute("select helena_v2.ativar_configuracao(%s,%s)", (nova["id"], primeira["id"]))
        with pytest.raises(psycopg.errors.CheckViolation):
            con.execute("select helena_v2.aposentar_configuracao(%s)", (nova["id"],))
        aposentada = con.execute("select helena_v2.aposentar_configuracao(%s)", (primeira["id"],)).fetchone()[0]
        assert aposentada["estado"] == "APOSENTADA"
    with banco.conectar(papel="service_role") as con:
        card2 = con.execute("select helena_v2.criar_card('config','segundo','x','Teste',now()+interval '2 days',%s)",
                            (Jsonb(S.ROTEIRO_UMA_ETAPA),)).fetchone()[0]
        row2 = con.execute("select ordem_de_servico from helena_v2.card where id=%s", (card2["card_id"],)).fetchone()[0]
        assert row2["config_revision_id"] == nova["id"]
        assert con.execute("select helena_v2.ler_configuracao(%s)", (primeira["id"],)).fetchone()[0]["id"] == primeira["id"]
    # A ficha antiga pode continuar gerando um filho vinculado à revisão aposentada.
    with banco.conectar() as con:
        con.execute("begin")
        con.execute("select set_config('helena_v2.funcao_unica','sim',true)")
        con.execute("savepoint pin")
        with pytest.raises(psycopg.errors.InsufficientPrivilege, match="CONFIG_VINCULO_IMUTAVEL"):
            con.execute("update helena_v2.card set ordem_de_servico = %s where id=%s",
                        (Jsonb({"config_revision_id": nova["id"]}), card["card_id"]))
        con.execute("rollback to savepoint pin")
        filho = con.execute("insert into helena_v2.card(titulo,empresa,ordem_de_servico,prioridade,prazo,"
                            "card_pai_id,pedido_grande,dono,prazo_ate) "
                            "select titulo,empresa,'{}'::jsonb,prioridade,prazo,id,pedido_grande,dono,prazo_ate "
                            "from helena_v2.card where id=%s returning ordem_de_servico",
                            (card["card_id"],)).fetchone()[0]
        assert filho["config_revision_id"] == primeira["id"]
        con.execute("rollback")


def test_historico_nao_apaga_e_rpc_internas_nao_expostas(fabrica):
    banco = fabrica({})
    bundle, _, base = bootstrap(banco)
    with banco.conectar(papel="authenticated") as con:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute("select helena_v2._config_json(%s,true)", (base["id"],))
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute("select * from helena_v2.configuracao")
    with banco.conectar() as con:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute("delete from helena_v2.configuracao where id=%s", (base["id"],))
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute("truncate helena_v2.configuracao_validacao")
