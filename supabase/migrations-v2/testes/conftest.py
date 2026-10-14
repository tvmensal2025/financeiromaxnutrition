# -*- coding: utf-8 -*-
"""Base dos testes do banco da v2: sobe (e derruba) um PostgreSQL LOCAL só para o teste.

O QUE É: a fixture `banco`. Ela cria um banco novo, aplica os quatro arquivos SQL em ordem
(0001 esquema, 0002 gerado do YAML, 0003 função única, 0004 travas) e entrega ao teste.

DE ONDE VEM O BANCO:
  - Se existir a variável HELENA_V2_TESTE_DATABASE_URL (é o que o CI usa, com um service container
    postgres:16), o teste usa esse servidor e cria nele um banco descartável.
  - Se não existir, o teste sobe o próprio cluster PostgreSQL 16 numa pasta temporária
    (/tmp/pg-helena-v2-*), na porta 54329, só em 127.0.0.1, com um usuário e uma senha de TESTE
    que nascem aqui na memória (nunca vão para arquivo do repositório) e morrem com o teste.
  Nunca conecta em Supabase, EasyPanel, Hostinger ou qualquer endereço de fora.

COMO MUDAR: se o PostgreSQL estiver em outra pasta, aponte HELENA_V2_PG_BIN para a pasta bin dele.
"""
import glob
import os
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
from pathlib import Path

import psycopg
import pytest
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo

AQUI = Path(__file__).resolve().parent
MIGRACOES = AQUI.parent
sys.path.insert(0, str(MIGRACOES))
sys.path.insert(0, str(AQUI))

ARQUIVOS_SQL = ["0001_esquema.sql", "0002_passagens_geradas.sql", "0003_funcao_unica.sql", "0004_travas_e_permissoes.sql", "0005_publicacao.sql", "0006_configuracoes.sql"]
PAPEIS_DO_SUPABASE = ["anon", "authenticated", "service_role"]
HOSTS_LOCAIS = {"127.0.0.1", "localhost", "::1", ""}
FUNDADOR_TESTE = "00000000-0000-4000-8000-000000000001"
OUTRA_PESSOA_TESTE = "00000000-0000-4000-8000-000000000002"


def _achar_bin():
    if os.environ.get("HELENA_V2_PG_BIN"):
        return os.environ["HELENA_V2_PG_BIN"]
    candidatos = sorted(glob.glob("/usr/lib/postgresql/*/bin"), reverse=True)
    for c in candidatos:
        if (Path(c) / "initdb").exists():
            return c
    achado = shutil.which("initdb")
    if achado:
        return str(Path(achado).parent)
    raise RuntimeError("PostgreSQL não encontrado: instale o postgresql-16 ou aponte HELENA_V2_PG_BIN para a pasta bin")


def _porta_livre(inicio=54329):
    for porta in range(inicio, inicio + 30):
        with socket.socket() as s:
            s.settimeout(0.2)
            if s.connect_ex(("127.0.0.1", porta)) != 0:
                return porta
    raise RuntimeError("nenhuma porta livre perto de 54329")


class ClusterLocal:
    """Um PostgreSQL de teste: pasta temporária, porta 54329, só 127.0.0.1, senha que nasce e morre aqui."""

    def __init__(self):
        self.bin = _achar_bin()
        self.pasta = tempfile.mkdtemp(prefix="pg-helena-v2-", dir="/tmp")
        self.root = hasattr(os, "geteuid") and os.geteuid() == 0
        if self.root:
            shutil.chown(self.pasta, user="postgres")
        self.senha = secrets.token_urlsafe(18)
        self.porta = _porta_livre()
        self.dados = os.path.join(self.pasta, "dados")
        self.url = f"postgresql://postgres:{self.senha}@127.0.0.1:{self.porta}/postgres"

    def _rodar(self, args, **kw):
        cmd = (["runuser", "-u", "postgres", "--"] if self.root else []) + args
        return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw)

    def subir(self):
        arq_senha = os.path.join(self.pasta, "senha.txt")
        Path(arq_senha).write_text(self.senha, encoding="utf-8")
        os.chmod(arq_senha, 0o600)
        if self.root:
            shutil.chown(arq_senha, user="postgres")
        locale = ["--locale=C.UTF-8"] if subprocess.run(["locale", "-a"], capture_output=True, text=True).stdout.count("C.utf8") else ["--no-locale"]
        self._rodar([f"{self.bin}/initdb", "-D", self.dados, "-U", "postgres", "-A", "scram-sha-256", f"--pwfile={arq_senha}", "-E", "UTF8", *locale])
        os.remove(arq_senha)
        opcoes = (f"-p {self.porta} -c listen_addresses=127.0.0.1 -c unix_socket_directories={self.pasta} "
                  "-c fsync=off -c synchronous_commit=off -c full_page_writes=off -c max_connections=40")
        self._rodar([f"{self.bin}/pg_ctl", "-D", self.dados, "-o", opcoes, "-l", os.path.join(self.pasta, "log.txt"), "-w", "-t", "60", "start"])

    def derrubar(self):
        try:
            self._rodar([f"{self.bin}/pg_ctl", "-D", self.dados, "-m", "immediate", "-w", "stop"])
        except Exception:
            pass
        shutil.rmtree(self.pasta, ignore_errors=True)


class Banco:
    """Um servidor + um banco descartável com o esquema aplicado."""

    def __init__(self, url_admin, nome_db, papeis_criados):
        self.url_admin = url_admin
        self.nome = nome_db
        self.papeis_criados = papeis_criados
        d = conninfo_to_dict(url_admin)
        d["dbname"] = nome_db
        self.url = make_conninfo(**d)

    def conectar(self, papel=None, autocommit=True):
        """Uma conexão nova. `papel` faz SET ROLE (é assim que o Supabase entra com anon, authenticated e service_role)."""
        con = psycopg.connect(self.url, autocommit=autocommit)
        if papel:
            con.execute(sql.SQL("set role {}").format(sql.Identifier(papel)))
            if papel == "authenticated":
                con.execute("select set_config('request.jwt.claim.sub', %s, false)", (FUNDADOR_TESTE,))
        return con


def exigir_banco_local(url):
    """Trava de segurança: estes testes criam e apagam bancos e papéis. Só rodam em PostgreSQL da própria máquina ou do CI."""
    info = conninfo_to_dict(url)
    if info.get("service") or os.environ.get("PGSERVICE"):
        raise RuntimeError("Serviço libpq não é permitido nos testes do banco v2.")
    for host in (info.get("host"), os.environ.get("PGHOST")):
        if host and host not in HOSTS_LOCAIS and not host.startswith("/"):
            raise RuntimeError("Host remoto não é permitido nos testes do banco v2.")
    for addr in (info.get("hostaddr"), os.environ.get("PGHOSTADDR")):
        if addr and addr not in {"127.0.0.1", "::1"}:
            raise RuntimeError("hostaddr remoto não é permitido nos testes do banco v2.")
    return url


def criar_papeis(con_admin, nomes):
    criados = []
    for n in nomes:
        existe = con_admin.execute("select 1 from pg_roles where rolname = %s", (n,)).fetchone()
        if not existe:
            con_admin.execute(sql.SQL("create role {} nologin").format(sql.Identifier(n)))
            criados.append(n)
    return criados


def aplicar_sql(con, textos):
    """Aplica os textos SQL em ordem, cada um numa transação só."""
    for t in textos:
        con.execute(t)


def ler_sql(nome, substituicoes=None):
    t = (MIGRACOES / nome).read_text(encoding="utf-8")
    if substituicoes and nome in substituicoes:
        t = substituicoes[nome]
    return t


def montar_banco(url_admin, substituicoes=None, papeis_de_teste=()):
    """Cria um banco novo no servidor e aplica os quatro SQL (com `substituicoes` = {arquivo: texto} para plantar defeitos)."""
    url_admin = exigir_banco_local(url_admin)
    nome = "helena_v2_t_" + secrets.token_hex(5)
    with psycopg.connect(url_admin, autocommit=True) as adm:
        # Papéis são globais ao servidor. Serializa a criação para duas suítes locais
        # não disputarem o mesmo papel; o banco descartável continua independente.
        adm.execute("select pg_advisory_lock(84219075)")
        try:
            criados = criar_papeis(adm, PAPEIS_DO_SUPABASE + list(papeis_de_teste))
            adm.execute(sql.SQL("create database {}").format(sql.Identifier(nome)))
        finally:
            adm.execute("select pg_advisory_unlock(84219075)")
    banco = Banco(url_admin, nome, criados)
    try:
        with banco.conectar() as con:
            con.execute("create schema auth")
            con.execute("""create function auth.uid() returns uuid language sql stable as $$
                select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$""")
            con.execute("""create table public.app_access (
                user_id uuid primary key, role text not null, active boolean not null)""")
            con.execute("insert into public.app_access values (%s, 'founder', true), (%s, 'member', true)",
                        (FUNDADOR_TESTE, OUTRA_PESSOA_TESTE))
            aplicar_sql(con, [ler_sql(a, substituicoes) for a in ARQUIVOS_SQL])
    except Exception:
        derrubar_banco(banco)
        raise
    return banco


def derrubar_banco(banco):
    with psycopg.connect(banco.url_admin, autocommit=True) as adm:
        adm.execute(sql.SQL("drop database if exists {} with (force)").format(sql.Identifier(banco.nome)))
        # Nunca apaga papéis globais no servidor compartilhado: outra suíte pode
        # estar montando um banco que depende deles. Um cluster próprio cai inteiro.


PAPEIS_DE_TESTE = ["h2t_curioso", "h2t_fundador", "h2t_motor"]


@pytest.fixture(scope="session")
def servidor():
    """Devolve a URL de administração do servidor de teste (o do CI, ou um cluster local que sobe e cai aqui)."""
    url = os.environ.get("HELENA_V2_TESTE_DATABASE_URL")
    cluster = None
    if url:
        yield exigir_banco_local(url)
        return
    cluster = ClusterLocal()
    try:
        cluster.subir()
        yield cluster.url
    finally:
        cluster.derrubar()


def imprimir_cobertura(banco):
    """Com HELENA_V2_COBERTURA=1: quantas linhas da tabela de passagens os testes todos exercitaram (e quais faltaram)."""
    with banco.conectar() as c:
        usadas = {(m, b) for m, b in c.execute(
            "select distinct p.maquina, p.base_id from helena_v2.historico h join helena_v2.passagem p "
            "on p.maquina = h.maquina and p.linha_id = h.linha_id")}
        todas = {(m, b) for m, b in c.execute("select distinct maquina, base_id from helena_v2.passagem")}
    por = {}
    for m, b in sorted(todas):
        a = por.setdefault(m, [0, 0])
        a[1] += 1
        a[0] += (m, b) in usadas
    print(f"\nCOBERTURA de todos os testes no banco principal: {len(usadas)}/{len(todas)} linhas da tabela | " +
          ", ".join(f"{m} {a}/{t}" for m, (a, t) in por.items()))
    print("linhas que nenhum teste do banco principal exercitou:", ", ".join(b for _m, b in sorted(todas - usadas)))


@pytest.fixture(scope="session")
def banco(servidor):
    """O banco de teste com os quatro arquivos SQL aplicados do zero."""
    b = montar_banco(servidor, papeis_de_teste=PAPEIS_DE_TESTE)
    try:
        yield b
    finally:
        if os.environ.get("HELENA_V2_COBERTURA"):
            imprimir_cobertura(b)
        derrubar_banco(b)


@pytest.fixture(scope="session")
def fabrica(servidor):
    """Para os testes que plantam defeito na tabela: monta um banco extra com SQL trocado e derruba no fim."""
    feitos = []

    def montar(substituicoes):
        b = montar_banco(servidor, substituicoes=substituicoes, papeis_de_teste=PAPEIS_DE_TESTE)
        feitos.append(b)
        return b

    yield montar
    for b in feitos:
        derrubar_banco(b)


@pytest.fixture()
def con(banco):
    """Uma conexão do dono do banco (superusuário de teste) em autocommit."""
    c = banco.conectar()
    yield c
    c.close()
