"""O que é: matriz de privilégios do Bloco 1 em PostgreSQL local descartável.
Como mudar: ao criar outra porta de manutenção, incluí-la na lista e no ensaio integral.
"""

import secrets

import psycopg
import pytest
from psycopg import sql
from psycopg import errors as E
from psycopg.types.json import Jsonb

import conftest as C
import sorteio as S
from integral import banco_integral


MANUTENCAO = (
    "disparar_automaticos(uuid,text[])",
    "abrir_chamada_helena(text,uuid)",
    "calcular_hash_das_linhas()",
    "tabela_confere()",
    "conferir_historico(uuid)",
    "vigia()",
    "conferir_card(uuid)",
    "situacao_efetiva(helena_v2.etapa)",
)
# Portas de serviço criadas depois da 0016 (já nascem só para service_role).
SO_SERVICO_DEPOIS_DE_0016 = (
    "eventos_devidos(timestamp with time zone)",   # 0017, o relógio dos prazos
)

# Portas do trabalhador de publicação (0018): só o service_role executa; o fundador só pede e lê.
PUBLICACAO_SO_SERVICO = (
    "reivindicar_publicacao()",
    "concluir_publicacao(bigint,text,text)",
    "falhar_publicacao(bigint,text)",
    "reverter_publicacao(bigint)",
)


@pytest.fixture()
def banco_seguro(fabrica):
    banco = fabrica({})
    with banco.conectar() as con:
        # Reprodução do grant de 0004 antes de aplicar a correção.
        assert all(con.execute(
            "select has_function_privilege('authenticated', %s, 'execute')",
            ("helena_v2." + assinatura,)).fetchone()[0]
                   for assinatura in MANUTENCAO)
        con.execute(C.ler_sql("0016_manutencao_so_servico.sql"))
    return banco


def _card(con, empresa):
    numero = "bloco1-" + secrets.token_hex(8)
    resultado = con.execute(
        "select helena_v2.criar_card('teste',%s,'pedido falso','Card de teste',now()+interval '2 days',%s,%s)",
        (numero, Jsonb(S.ROTEIRO_UMA_ETAPA), empresa)).fetchone()[0]
    return resultado["card_id"]


def _identidade(con, uid):
    con.execute("select set_config('request.jwt.claim.sub', %s, false)", (uid,))


def test_manutencao_so_service_e_portas_da_tela_preservadas(banco_seguro):
    with banco_seguro.conectar() as dono:
        for assinatura in MANUTENCAO:
            funcao = "helena_v2." + assinatura
            for papel in ("public", "anon", "authenticated", "h2t_curioso"):
                assert dono.execute("select has_function_privilege(%s, %s, 'execute')",
                                    (papel, funcao)).fetchone()[0] is False, (papel, funcao)
            assert dono.execute("select has_function_privilege('service_role', %s, 'execute')",
                                (funcao,)).fetchone()[0] is True
        for assinatura in ("aplicar_evento(text,uuid,text,text,jsonb,text,bigint,integer,jsonb,text,boolean,text[],timestamptz)",
                           "pedir_publicacao()", "listar_configuracoes()"):
            assert dono.execute("select has_function_privilege('authenticated', %s, 'execute')",
                                ("helena_v2." + assinatura,)).fetchone()[0] is True
    with banco_seguro.conectar("service_role") as servico:
        assert servico.execute("select helena_v2.tabela_confere()").fetchone()[0] is True
        assert servico.execute("select count(*) from helena_v2.vigia()").fetchone()[0] == 0


def test_matriz_anon_estranho_fundador_membro_revogado_service(banco_seguro):
    with banco_seguro.conectar() as dono:
        card_a = _card(dono, "BIZ-001")
        card_b = _card(dono, "BIZ-002")
    for papel in ("anon", "h2t_curioso"):
        with banco_seguro.conectar(papel) as con:
            assert con.execute("select has_schema_privilege(current_user, 'helena_v2', 'usage')").fetchone()[0] is False
            with pytest.raises(E.InsufficientPrivilege):
                con.execute("select id from helena_v2.card")
            with pytest.raises(E.InsufficientPrivilege):
                con.execute("select * from helena_v2.vigia()")
    with banco_seguro.conectar("authenticated") as fundador:
        assert {str(r[0]) for r in fundador.execute("select id from helena_v2.card where id in (%s,%s)",
                                                    (card_a, card_b))} == {card_a, card_b}
        assert fundador.execute("select helena_v2.sou_fundador()").fetchone()[0] is True
        with pytest.raises(E.InsufficientPrivilege):
            fundador.execute("select * from helena_v2.vigia()")
    for uid in (C.OUTRA_PESSOA_TESTE, C.FUNDADOR_TESTE):
        with banco_seguro.conectar() as dono:
            if uid == C.FUNDADOR_TESTE:
                dono.execute("update public.app_access set active=false where user_id=%s", (uid,))
        with banco_seguro.conectar("authenticated") as pessoa:
            _identidade(pessoa, uid)
            assert pessoa.execute("select helena_v2.sou_fundador()").fetchone()[0] is False
            assert pessoa.execute("select count(*) from helena_v2.card where id in (%s,%s)",
                                  (card_a, card_b)).fetchone()[0] == 0
            with pytest.raises(E.InsufficientPrivilege):
                pessoa.execute("select helena_v2.pedir_publicacao()")
            with pytest.raises(E.InsufficientPrivilege):
                pessoa.execute("select * from helena_v2.conferir_historico(%s)", (card_b,))
    with banco_seguro.conectar("service_role") as servico:
        assert {str(r[0]) for r in servico.execute("select id from helena_v2.card where id in (%s,%s)",
                                                   (card_a, card_b))} == {card_a, card_b}
        with pytest.raises(E.InsufficientPrivilege):
            servico.execute("select helena_v2.pedir_publicacao()")


def test_erros_de_acesso_nao_repetem_segredo_falso(banco_seguro, capsys, caplog):
    marcador = "TOKEN_FALSO_BLOCO1_" + secrets.token_hex(12)
    with banco_seguro.conectar() as dono:
        numero = "segredo-falso-" + secrets.token_hex(8)
        card = dono.execute(
            "select helena_v2.criar_card('teste',%s,%s,'Card privado',now()+interval '2 days',%s,'BIZ-002')",
            (numero, marcador, Jsonb(S.ROTEIRO_UMA_ETAPA))).fetchone()[0]["card_id"]
    with banco_seguro.conectar("authenticated") as membro:
        _identidade(membro, C.OUTRA_PESSOA_TESTE)
        for sql, args in (("select * from helena_v2.vigia()", ()),
                          ("select * from helena_v2.conferir_historico(%s)", (card,)),
                          ("select helena_v2.conferir_card(%s)", (card,))):
            with pytest.raises(E.InsufficientPrivilege) as erro:
                membro.execute(sql, args)
            assert marcador not in str(erro.value)
    saida = capsys.readouterr()
    assert marcador not in saida.out + saida.err + caplog.text


def test_search_path_fixado_em_todas_as_security_definer(banco_seguro):
    with banco_seguro.conectar() as con:
        funcoes = con.execute("""select p.proname,p.proconfig from pg_proc p
            join pg_namespace n on n.oid=p.pronamespace
            where n.nspname='helena_v2' and p.prosecdef""").fetchall()
    assert funcoes
    assert all(any(c.replace(" ", "").endswith("pg_catalog,pg_temp")
                   for c in (config or []) if c.startswith("search_path="))
               for _, config in funcoes)


def test_defeito_plantado_sem_revogacao_do_vigia_e_detectado(fabrica):
    sql = C.ler_sql("0016_manutencao_so_servico.sql")
    trecho = "  helena_v2.vigia(),\n"
    assert sql.count(trecho) == 2
    defeituoso = sql.replace(trecho, "", 1)
    banco = fabrica({})
    with banco.conectar() as con:
        con.execute(defeituoso)
        # A mesma verificação da matriz reprovaria esta migration defeituosa.
        assert con.execute("select has_function_privilege('authenticated', 'helena_v2.vigia()', 'execute')").fetchone()[0] is True


@pytest.fixture()
def banco_integral_prod_shape(servidor):
    # Refaz o formato relevante do projeto canônico, sem dados ou acesso remoto.
    url = C.exigir_banco_local(servidor)
    nome = "helena_v2_integral_" + secrets.token_hex(5)
    with psycopg.connect(url, autocommit=True) as admin:
        admin.execute("select pg_advisory_lock(84219075)")
        try:
            papeis = C.criar_papeis(admin, C.PAPEIS_DO_SUPABASE)
            admin.execute(sql.SQL("create database {}").format(sql.Identifier(nome)))
        finally:
            admin.execute("select pg_advisory_unlock(84219075)")
    banco = C.Banco(url, nome, papeis)
    try:
        with banco.conectar() as con:
            con.execute("create schema auth")
            con.execute("""create function auth.uid() returns uuid language sql stable as $$
                select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$""")
            con.execute("""create table public.app_access (
                user_id uuid primary key, role text not null, active boolean not null,
                created_at timestamptz default now(), updated_at timestamptz default now())""")
            con.execute("insert into public.app_access(user_id,role,active) values (%s,'founder',true),(%s,'member',true)",
                        (C.FUNDADOR_TESTE, C.OUTRA_PESSOA_TESTE))
            con.execute("create schema extensions")
            con.execute("create extension pgcrypto with schema extensions")
            con.execute("""create table public.checkpoint_mestre (
                checkpoint_id text primary key, versao integer, status text, resumo_executivo text,
                validado_em timestamptz, atualizado_em timestamptz, checkpoint_anterior_id text)""")
            con.execute("""create view public.checkpoint_mestre_atual as
                select checkpoint_id,versao,status,resumo_executivo,validado_em,
                       atualizado_em,checkpoint_anterior_id from public.checkpoint_mestre
                where status='ATIVO' order by versao desc limit 1""")
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
            for numero in range(1, 18):
                arquivos = sorted(C.MIGRACOES.glob(f"{numero:04d}_*.sql"))
                assert len(arquivos) == 1, numero
                con.execute(arquivos[0].read_text(encoding="utf-8"))
        yield banco
    finally:
        C.derrubar_banco(banco)


def test_instalacao_integral_0001_a_0017_preserva_rpcs_e_isolamento(banco_integral_prod_shape):
    banco = banco_integral_prod_shape
    with banco.conectar() as dono:
        assert dono.execute("select extnamespace::regnamespace::text from pg_extension where extname='pgcrypto'").fetchone()[0] == "extensions"
        assert [r[0] for r in dono.execute("""select column_name from information_schema.columns
            where table_schema='public' and table_name='app_access' order by ordinal_position""")] == [
                "user_id", "role", "active", "created_at", "updated_at"]
        assert dono.execute("select helena_v2.tabela_confere()").fetchone()[0] is True
        for assinatura in MANUTENCAO + SO_SERVICO_DEPOIS_DE_0016:
            nome = "helena_v2." + assinatura
            assert dono.execute("select has_function_privilege('authenticated', %s, 'execute')",
                                (nome,)).fetchone()[0] is False, nome
            assert dono.execute("select has_function_privilege('service_role', %s, 'execute')",
                                (nome,)).fetchone()[0] is True, nome
        for assinatura in ("ler_leitura_card_fundador(uuid)", "listar_acoes_card(uuid)",
                           "pedir_publicacao()", "listar_configuracoes()"):
            assert dono.execute("select has_function_privilege('authenticated', %s, 'execute')",
                                ("helena_v2." + assinatura,)).fetchone()[0] is True
    with banco.conectar("authenticated") as fundador:
        assert fundador.execute("select helena_v2.sou_fundador()").fetchone()[0] is True
        with pytest.raises(E.InsufficientPrivilege):
            fundador.execute("select * from helena_v2.vigia()")
    with banco.conectar("authenticated") as fundador, pytest.raises(E.InsufficientPrivilege):
        fundador.execute("select * from helena_v2.eventos_devidos()")
    with banco.conectar("service_role") as servico:
        assert servico.execute("select count(*) from helena_v2.vigia()").fetchone()[0] == 0
        assert servico.execute("select count(*) from helena_v2.eventos_devidos()").fetchone()[0] == 0


def test_instalacao_completa_portas_de_publicacao_so_do_servico_e_search_path_fixado(servidor):
    with banco_integral(servidor) as banco, banco.conectar() as dono:
        for assinatura in PUBLICACAO_SO_SERVICO:
            nome = "helena_v2." + assinatura
            for papel in ("public", "anon", "authenticated", "h2t_curioso"):
                assert dono.execute("select has_function_privilege(%s, %s, 'execute')",
                                    (papel, nome)).fetchone()[0] is False, (papel, nome)
            assert dono.execute("select has_function_privilege('service_role', %s, 'execute')",
                                (nome,)).fetchone()[0] is True, nome
        for assinatura in ("pedir_publicacao()", "situacao_publicacao()"):
            assert dono.execute("select has_function_privilege('authenticated', %s, 'execute')",
                                ("helena_v2." + assinatura,)).fetchone()[0] is True, assinatura
        funcoes = dono.execute("""select p.proname, p.proconfig from pg_proc p
            join pg_namespace n on n.oid=p.pronamespace
            where n.nspname='helena_v2' and p.prosecdef""").fetchall()
        assert {nome for nome, _ in funcoes} >= {a.split("(")[0] for a in PUBLICACAO_SO_SERVICO}
        assert all(any(c.replace(" ", "").endswith("pg_catalog,pg_temp")
                       for c in (config or []) if c.startswith("search_path="))
                   for _, config in funcoes)
