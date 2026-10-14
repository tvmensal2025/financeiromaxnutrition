"""O que é: teste 8 do plano, versão local — a cópia completa do banco da v2 volta inteira em outro banco descartável.

Faz pg_dump de um banco com cards, histórico e pedido de publicação, restaura em um banco novo (tempo medido),
e confere: mesmas linhas em toda tabela, tabela de regras com a mesma impressão, `vigia()` vazio, prazos preservados,
privilégios preservados. Um defeito plantado (linha apagada na cópia) tem de ser pego pelas mesmas conferências.
Nunca toca em banco remoto: usa só o servidor de teste local.
Como mudar: se criar tabela nova no esquema helena_v2 ela entra sozinha na conferência (a lista vem do catálogo).
"""

import os
import secrets
import subprocess
import time

import psycopg
import pytest
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict
from psycopg.types.json import Jsonb

import conftest as C
import sorteio as S

TEMPO_MAXIMO_DA_COPIA_DE_TESTE_S = 120      # banco de teste pequeno; em produção o tempo real é medido no ensaio de restauração


def _bin(nome):
    return os.path.join(C._achar_bin(), nome)


def _ambiente_do(url):
    info = conninfo_to_dict(url)
    env = {"PATH": os.environ.get("PATH", ""), "PGHOST": info.get("host", "127.0.0.1"), "PGPORT": str(info.get("port", 5432)),
           "PGUSER": info.get("user", "postgres")}
    if info.get("password"):
        env["PGPASSWORD"] = info["password"]
    return env, info


def _rodar(args, env):
    return subprocess.run(args, env=env, check=True, capture_output=True, text=True)


def _tabelas(con):
    return [r[0] for r in con.execute(
        "select tablename from pg_tables where schemaname = 'helena_v2' order by 1").fetchall()]


def _contagens(con):
    return {t: con.execute(sql.SQL("select count(*) from helena_v2.{}").format(sql.Identifier(t))).fetchone()[0]
            for t in _tabelas(con)}


def _privilegios(con):
    return con.execute("""select p.proname, r.rolname, has_function_privilege(r.oid, p.oid, 'execute')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace, pg_roles r
        where n.nspname = 'helena_v2' and r.rolname in ('anon','authenticated','service_role') order by 1,2""").fetchall()


@pytest.fixture()
def banco_com_dados(fabrica):
    banco = fabrica({})
    with banco.conectar() as con:
        for empresa in ("BIZ-001", "BIZ-002", "BIZ-003"):
            numero = "backup-" + secrets.token_hex(6)
            con.execute("select helena_v2.criar_card('teste',%s,'pedido falso','Card de teste',now()+interval '2 days',%s,%s)",
                        (numero, Jsonb(S.ROTEIRO_UMA_ETAPA), empresa))
    with banco.conectar("authenticated") as fundador:
        fundador.execute("select helena_v2.pedir_publicacao()")
    return banco


def _copiar_e_restaurar(banco, servidor, tmp_path):
    env, info = _ambiente_do(banco.url)
    arquivo = str(tmp_path / "copia.dump")
    inicio = time.monotonic()
    _rodar([_bin("pg_dump"), "--format=custom", "--file", arquivo, "--dbname", banco.nome], env)
    tempo_da_copia = time.monotonic() - inicio
    nome = "helena_v2_restaurado_" + secrets.token_hex(5)
    with psycopg.connect(banco.url_admin, autocommit=True) as adm:
        adm.execute(sql.SQL("create database {}").format(sql.Identifier(nome)))
    restaurado = C.Banco(banco.url_admin, nome, [])
    inicio = time.monotonic()
    _rodar([_bin("pg_restore"), "--no-owner", "--exit-on-error", "--dbname", nome, arquivo], env)
    tempo_da_restauracao = time.monotonic() - inicio
    return restaurado, tempo_da_copia, tempo_da_restauracao


def test_copia_completa_volta_inteira_em_banco_descartavel(banco_com_dados, servidor, tmp_path):
    original = banco_com_dados
    restaurado, t_copia, t_restauracao = _copiar_e_restaurar(original, servidor, tmp_path)
    try:
        assert t_copia < TEMPO_MAXIMO_DA_COPIA_DE_TESTE_S and t_restauracao < TEMPO_MAXIMO_DA_COPIA_DE_TESTE_S
        print(f"\nTEMPO MEDIDO (banco de teste): cópia {t_copia:.2f} s, restauração {t_restauracao:.2f} s")
        with original.conectar() as a, restaurado.conectar() as b:
            antes, depois = _contagens(a), _contagens(b)
            assert antes == depois and sum(antes.values()) > 0, (antes, depois)
            assert antes["card"] == 3 and antes["publicacoes"] == 1
            # a tabela de regras voltou idêntica (a impressão guardada confere com o cálculo)
            assert b.execute("select helena_v2.tabela_confere()").fetchone()[0] is True
            assert (a.execute("select helena_v2.calcular_hash_das_linhas()").fetchone()[0]
                    == b.execute("select helena_v2.calcular_hash_das_linhas()").fetchone()[0])
            # as 13 regras: o vigia não acha nada (vigia() é só do service_role)
            assert _privilegios(a) == _privilegios(b)
        with restaurado.conectar("service_role") as servico:
            assert servico.execute("select count(*) from helena_v2.vigia()").fetchone()[0] == 0
        # o relógio dos cards (prazo, criação) voltou com os mesmos valores
        with original.conectar() as a, restaurado.conectar() as b:
            consulta = "select id, prazo, criado_em, estado from helena_v2.card order by id"
            assert a.execute(consulta).fetchall() == b.execute(consulta).fetchall()
        # a função única continua funcionando no banco restaurado: o card avança
        with restaurado.conectar() as b:
            card = b.execute("select id from helena_v2.card order by id limit 1").fetchone()[0]
            assert b.execute("select estado from helena_v2.card where id = %s", (card,)).fetchone()[0]
        # e a publicação do dia continua barrando o segundo pedido
        with restaurado.conectar("authenticated") as fundador:
            assert fundador.execute("select helena_v2.pedir_publicacao()").fetchone()[0] is not None
            assert fundador.execute("select count(*) from helena_v2.publicacoes").fetchone()[0] == 1
    finally:
        C.derrubar_banco(restaurado)


def test_copia_incompleta_e_pega_pelas_mesmas_conferencias(banco_com_dados, servidor, tmp_path):
    """Defeito plantado: uma linha some do histórico na cópia. As conferências de contagem e o vigia têm de acusar."""
    original = banco_com_dados
    restaurado, _t1, _t2 = _copiar_e_restaurar(original, servidor, tmp_path)
    try:
        with restaurado.conectar() as b:
            b.execute("alter table helena_v2.historico disable trigger user")
            b.execute("delete from helena_v2.historico where id = (select max(id) from helena_v2.historico)")
        with original.conectar() as a, restaurado.conectar() as b:
            assert _contagens(a) != _contagens(b)                 # a contagem acusa
        with restaurado.conectar("service_role") as servico:
            achados = servico.execute("select regra from helena_v2.vigia()").fetchall()
            assert achados, "o vigia deveria acusar histórico que não reconstrói o card (regra 13)"
    finally:
        C.derrubar_banco(restaurado)
