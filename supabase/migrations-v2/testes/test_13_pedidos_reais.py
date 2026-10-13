"""Solicitações reais: autorização, captura conferida e consumo único em banco local."""
import copy
import hashlib
import json
from pathlib import Path

import psycopg
import pytest
from psycopg.types.json import Jsonb

import conftest as C
import sorteio as S


SQL = Path(__file__).resolve().parents[1] / "0007_pedidos_reais.sql"
TAREFA = "TASK-TESTE"
EMPRESA = "BIZ-TESTE"
DECISAO = "DEC-TESTE"
JOB = "JOB-TESTE"
ORIGEM = "TASK-ORIGEM-TESTE"


@pytest.fixture()
def banco_real(servidor):
    banco = C.montar_banco(servidor)
    try:
        with banco.conectar() as con:
            con.execute("""create table public.checkpoint_mestre (
                checkpoint_id text primary key, versao bigint, status text, resumo_executivo text,
                validado_em timestamptz, atualizado_em timestamptz, checkpoint_anterior_id text)""")
            con.execute("""create table public.checkpoint_mestre_atual (
                checkpoint_id text primary key, versao bigint, status text, resumo_executivo text,
                validado_em timestamptz, atualizado_em timestamptz, checkpoint_anterior_id text)""")
            con.execute("""create table public.portfolio (
                business_id text primary key, negocio text, estagio text, ativo text, publico text,
                row_version bigint, brand_identity jsonb)""")
            con.execute("""create table public.tarefas (
                task_id text primary key, business_id text, tarefa text, status text, prioridade text,
                prazo text, definicao_de_pronto text, row_version bigint, criado_em timestamptz,
                atualizado_em timestamptz)""")
            con.execute("""create table public.decisoes (
                decision_id text primary key, decisao text, row_version bigint, status text,
                business_id text)""")
            con.execute("""create table public.agent_jobs (
                job_id text primary key, task_id text, business_id text, agent_id text, status text,
                approval_status text, result_payload jsonb, result_summary text,
                evidence_refs jsonb, updated_at timestamptz)""")
            con.execute("""insert into public.checkpoint_mestre values
                ('CKP-TESTE',1,'ATIVO','Teste',now(),now(),null)""")
            con.execute("""insert into public.checkpoint_mestre_atual
                select * from public.checkpoint_mestre""")
            con.execute("""insert into public.portfolio values
                (%s,'Empresa de Teste','TESTE','SIM','TESTE',4,'{}')""", (EMPRESA,))
            con.execute("""insert into public.tarefas values
                (%s,%s,'Calcule o valor de teste.','NÃO INICIADA','NORMAL',null,
                 'Conta verificada',7,now(),now())""", (TAREFA, EMPRESA))
            con.execute("""insert into public.tarefas values
                (%s,%s,'Documento de origem de teste.','EM EXECUÇÃO','NORMAL',null,
                 'Documento revisto',3,now(),now())""", (ORIGEM, EMPRESA))
            con.execute("""insert into public.decisoes values
                (%s,'Usar dados de teste.',2,'VIGENTE',%s)""", (DECISAO, EMPRESA))
            con.execute("""insert into public.agent_jobs values
                (%s,%s,%s,'AGT-01','COMPLETED','APPROVED',%s,'Resultado de teste',
                 '["REF-TESTE"]',now())""", (JOB, ORIGEM, EMPRESA, Jsonb({
                     "review_pending": False, "reviewed_by": "Revisor de teste",
                     "reviewer_agent_id": "AGT-02",
                     "delivery": {"content": "Documento de teste com evidência."},
                     "quality_review": {"requirements_met": True,
                                        "inspected_evidence_refs": ["REF-TESTE"]}})))
            config_id = con.execute("""insert into helena_v2.configuracao
                (nome,conteudo,estado,hash_sha256,validada_em)
                values ('Configuração de teste','{}','VALIDADA',repeat('a',64),now()) returning id""").fetchone()[0]
            con.execute("update helena_v2.configuracao_ponteiro set ativa_id=%s where unico", (config_id,))
            con.execute(SQL.read_text(encoding="utf-8"))
        yield banco, config_id
    finally:
        C.derrubar_banco(banco)


def parametros(banco, config_id):
    with banco.conectar() as con:
        checkpoint = con.execute("select to_jsonb(c) from public.checkpoint_mestre_atual c").fetchone()[0]
        tarefa = con.execute("select to_jsonb(t) from public.tarefas t where task_id=%s", (TAREFA,)).fetchone()[0]
        empresa = con.execute("""select jsonb_build_object('business_id',p.business_id,'negocio',p.negocio,
            'estagio',p.estagio,'ativo',p.ativo,'publico',p.publico,
            'portfolio_row_version',p.row_version,'brand_identity',p.brand_identity)
            from public.portfolio p where business_id=%s""", (EMPRESA,)).fetchone()[0]
        decisao = con.execute("select to_jsonb(d) from public.decisoes d where decision_id=%s", (DECISAO,)).fetchone()[0]
        job = con.execute("select to_jsonb(j) from public.agent_jobs j where job_id=%s", (JOB,)).fetchone()[0]
    captura = {"fonte": "management_read_only", "projeto": {"ref": "wxkgrykduqtsgmjkzlou"},
               "observado_em": "2026-10-13T00:00:00+00:00", "checkpoint": checkpoint,
               "business_id": EMPRESA, "empresa": empresa, "tarefa": tarefa,
               "decisoes": [decisao], "entradas_externas": {"documento": job},
               "proveniencia": {"tarefa": {"pk": TAREFA, "row_version": tarefa["row_version"]},
                               "empresa": {"pk": EMPRESA, "row_version": 4}}}
    canonico = lambda x: json.dumps(x, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    captura["proveniencia"]["hash_sha256"] = hashlib.sha256(canonico({
        k: v for k, v in captura.items() if k != "proveniencia"}).encode()).hexdigest()
    plano = {"etapas": [{"id": "E1", "servico": "SRV-CALCULO"}], "empresas": [EMPRESA],
             "decisoes": [DECISAO], "entradas_externas": {"documento": JOB}}
    fonte_job = "FON-JOB-" + JOB
    fontes = {"FON-PEDIDO-" + TAREFA: tarefa["tarefa"],
              "FON-PACOTE-" + EMPRESA: canonico(empresa),
              fonte_job: canonico({"delivery": job["result_payload"]["delivery"],
                                  "quality_review": job["result_payload"]["quality_review"],
                                  "review_reason": None, "evidence_refs": job["evidence_refs"]})}
    pacote = {"empresa": EMPRESA, "nome": empresa["negocio"], "estado": "CONFIRMADO",
              "fonte_importada_id": "FON-PACOTE-" + EMPRESA, "dados_do_portfolio": empresa,
              "decisoes": [DECISAO]}
    ordem = {"empresa": EMPRESA, "pedido_original": tarefa["tarefa"], "o_que_quer": tarefa["tarefa"],
             "prazo": tarefa["prazo"], "prioridade_na_fonte": tarefa["prioridade"],
             "definicao_de_pronto_na_fonte": tarefa["definicao_de_pronto"],
             "fontes_que_pode_ler": [], "como_e_o_pronto": [], "nao_pode": []}
    pedido = {"empresa": EMPRESA, "criado_em": tarefa["criado_em"], "ordem_de_servico": ordem,
              "plano": plano, "pacote_da_empresa": pacote}
    dados = {"captura": captura, "pedido": pedido, "fontes_importadas": fontes,
             "decisoes": [{"id": DECISAO, "versao": 2, "row_version": 2, "texto": decisao["decisao"]}],
             "entradas_externas": {"documento": {"job_id": JOB, "fonte_ids": [fonte_job],
                                                   "conteudo": job["result_payload"]["delivery"],
                                                   "evidence_refs": job["evidence_refs"],
                                                   "updated_at": job["updated_at"]}},
             "proveniencia": {"project_ref": "wxkgrykduqtsgmjkzlou",
                              "checkpoint_id": checkpoint["checkpoint_id"],
                              "observado_em": captura["observado_em"], "tarefa_id": TAREFA,
                              "tarefa_row_version": tarefa["row_version"], "business_id": EMPRESA,
                              "hash_sha256": captura["proveniencia"]["hash_sha256"]}}
    return (TAREFA, "2026-10-20T12:00:00+00:00", Jsonb(plano), Jsonb(dados),
            config_id, "CHAVE-TESTE")


def solicitar(con, args):
    return con.execute("select helena_v2.solicitar_card_real(%s,%s,%s,%s,%s,%s)", args).fetchone()[0]


def test_fundador_solicita_idempotencia_e_motor_consome_uma_vez(banco_real):
    banco, config_id = banco_real
    args = parametros(banco, config_id)
    with banco.conectar(papel="authenticated") as con:
        pedido = solicitar(con, args)
        assert pedido["origem"] == "supabase" and pedido["chave_origem"] == TAREFA
        assert pedido["id"] == solicitar(con, args)["id"]
        assert pedido["business_id"] == EMPRESA and pedido["config_revision_id"] == str(config_id)
        assert pedido["titulo"] == "Calcule o valor de teste."
        with pytest.raises(psycopg.errors.UniqueViolation):
            solicitar(con, (*args[:1], "2026-10-21T12:00:00+00:00", *args[2:]))
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute("select helena_v2.ler_solicitacao_card_real(%s)", (pedido["id"],))
    with banco.conectar(papel="service_role") as con:
        lido = con.execute("select helena_v2.ler_solicitacao_card_real(%s)", (pedido["id"],)).fetchone()[0]
        assert lido["dados_reais"] == args[3].obj
        criado = con.execute("select helena_v2.consumir_solicitacao_card_real(%s,%s)",
                             (pedido["id"], Jsonb(S.ROTEIRO_UMA_ETAPA))).fetchone()[0]
        assert criado["novo"] is True
        repetido = con.execute("select helena_v2.consumir_solicitacao_card_real(%s,%s)",
                               (pedido["id"], Jsonb(S.ROTEIRO_UMA_ETAPA))).fetchone()[0]
        assert repetido["card_id"] == criado["card_id"] and repetido["novo"] is False
        ordem = con.execute("select ordem_de_servico from helena_v2.card where id=%s",
                            (criado["card_id"],)).fetchone()[0]
        assert ordem["modo_contexto"] == "real" and ordem["config_revision_id"] == str(config_id)
        assert ordem["dados_reais"] == args[3].obj


def test_solicitacao_recusa_conta_sem_fundador_e_captura_desatualizada(banco_real):
    banco, config_id = banco_real
    args = parametros(banco, config_id)
    with banco.conectar(papel="authenticated") as con:
        con.execute("select set_config('request.jwt.claim.sub', %s, false)", (C.OUTRA_PESSOA_TESTE,))
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            solicitar(con, (*args[:-1], "CHAVE-OUTRO"))
    with banco.conectar() as con:
        con.execute("update public.tarefas set row_version=row_version+1 where task_id=%s", (TAREFA,))
    with banco.conectar(papel="authenticated") as con:
        with pytest.raises(psycopg.errors.SerializationFailure):
            solicitar(con, (*args[:-1], "CHAVE-STALE"))


def test_portas_antigas_e_mutacao_direta_fechadas(banco_real):
    banco, config_id = banco_real
    with banco.conectar(papel="service_role") as con:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute("select helena_v2.criar_card('x','y','z','Teste',now()+interval '2 days',%s)",
                        (Jsonb(S.ROTEIRO_UMA_ETAPA),))
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute("update helena_v2.solicitacao_card_real set consumida_em=now()")
    with banco.conectar(papel="anon") as con:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute("select helena_v2.solicitar_card_real(%s,%s,%s,%s,%s,%s)",
                        parametros(banco, config_id))
    with banco.conectar(papel="authenticated") as con:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute("select helena_v2.criar_card('x','y','z','Teste',now()+interval '2 days',%s)",
                        (Jsonb(S.ROTEIRO_UMA_ETAPA),))


@pytest.mark.parametrize("mutacao", [
    lambda d: d["fontes_importadas"].update({"FON-PACOTE-" + EMPRESA: '{"inventado":true}'}),
    lambda d: d["fontes_importadas"].update({"FON-JOB-" + JOB: '{"inventado":true}'}),
    lambda d: d["decisoes"][0].update({"texto": "Decisão inventada"}),
    lambda d: d["decisoes"][0].update({"extra": "invenção"}),
    lambda d: d["pedido"]["pacote_da_empresa"].update({"nome": "Outra empresa"}),
    lambda d: d["entradas_externas"].update({"inventada": {"job_id": "JOB-INVENTADO"}}),
    lambda d: d["proveniencia"].update({"tarefa_id": "TASK-OUTRA"}),
])
def test_dados_derivados_nao_podem_inventar_fonte_ou_decisao(banco_real, mutacao):
    banco, config_id = banco_real
    args = list(parametros(banco, config_id))
    dados = copy.deepcopy(args[3].obj)
    mutacao(dados)
    args[3] = Jsonb(dados)
    with banco.conectar(papel="authenticated") as con:
        with pytest.raises(psycopg.errors.InvalidParameterValue):
            solicitar(con, args)


def test_concorrencia_logica_revalida_fontes_e_roteiro_no_consumo(banco_real):
    banco, config_id = banco_real
    args = parametros(banco, config_id)
    with banco.conectar(papel="authenticated") as con:
        pedido = solicitar(con, args)
    with banco.conectar(papel="service_role") as con:
        roteiro_outro = copy.deepcopy(S.ROTEIRO_UMA_ETAPA)
        roteiro_outro["etapas"][0]["id"] = "E2"
        with pytest.raises(psycopg.errors.InvalidParameterValue, match="ROTEIRO_REAL"):
            con.execute("select helena_v2.consumir_solicitacao_card_real(%s,%s)",
                        (pedido["id"], Jsonb(roteiro_outro)))
    with banco.conectar() as con:
        con.execute("update public.agent_jobs set approval_status='PENDING' where job_id=%s", (JOB,))
    with banco.conectar(papel="service_role") as con:
        with pytest.raises(psycopg.errors.SerializationFailure, match="JOB_REAL_MUDOU"):
            con.execute("select helena_v2.consumir_solicitacao_card_real(%s,%s)",
                        (pedido["id"], Jsonb(S.ROTEIRO_UMA_ETAPA)))
        assert con.execute("select count(*) from helena_v2.card").fetchone()[0] == 0


def test_checkpoint_ambiguo_recusado_e_captura_maior_versao_exigida(banco_real):
    banco, config_id = banco_real
    args = parametros(banco, config_id)
    with banco.conectar() as con:
        con.execute("""insert into public.checkpoint_mestre values
            ('CKP-OUTRO',2,'ATIVO','Outro',now(),now(),null)""")
    with banco.conectar(papel="authenticated") as con:
        with pytest.raises(psycopg.errors.SerializationFailure, match="CHECKPOINT_REAL_AMBIGUO"):
            solicitar(con, args)


def test_replay_mesma_chave_retorna_pedido_original_apos_mudanca_na_fonte(banco_real):
    banco, config_id = banco_real
    args = parametros(banco, config_id)
    with banco.conectar(papel="authenticated") as con:
        primeiro = solicitar(con, args)
    with banco.conectar() as con:
        con.execute("update public.tarefas set row_version=row_version+1 where task_id=%s", (TAREFA,))
    with banco.conectar(papel="authenticated") as con:
        assert solicitar(con, args)["id"] == primeiro["id"]
        with pytest.raises(psycopg.errors.UniqueViolation, match="CHAVE_IDEMPOTENCIA"):
            solicitar(con, (*args[:1], "2026-10-21T12:00:00+00:00", *args[2:]))


def test_tarefa_de_origem_do_job_mudou_de_empresa_antes_do_consumo(banco_real):
    banco, config_id = banco_real
    args = parametros(banco, config_id)
    with banco.conectar(papel="authenticated") as con:
        pedido = solicitar(con, args)
    with banco.conectar() as con:
        con.execute("update public.tarefas set business_id='BIZ-OUTRA' where task_id=%s", (ORIGEM,))
    with banco.conectar(papel="service_role") as con:
        with pytest.raises(psycopg.errors.SerializationFailure, match="JOB_ORIGEM_MUDOU"):
            con.execute("select helena_v2.consumir_solicitacao_card_real(%s,%s)",
                        (pedido["id"], Jsonb(S.ROTEIRO_UMA_ETAPA)))
