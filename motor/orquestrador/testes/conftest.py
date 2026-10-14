"""Reusa exatamente o cluster e as migrations dos testes do banco v2."""
from contextlib import contextmanager
import importlib.util
import sys
from pathlib import Path

import psycopg
import pytest
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo
from sqlalchemy.engine import URL

RAIZ = Path(__file__).resolve().parents[3]
for parte in ('orquestrador', 'executor', 'validador', 'ferramentas'):
    sys.path.insert(0, str(RAIZ / 'motor' / parte))
ARQUIVO = RAIZ / 'supabase' / 'migrations-v2' / 'testes' / 'conftest.py'
spec = importlib.util.spec_from_file_location('suporte_banco_v2', ARQUIVO)
suporte = importlib.util.module_from_spec(spec)
spec.loader.exec_module(suporte)
servidor = suporte.servidor


@contextmanager
def banco_proprio(servidor):
    """Um banco descartável do Motor com resposta durável da coordenadora; apagado ao sair."""
    b = suporte.montar_banco(servidor, papeis_de_teste=suporte.PAPEIS_DE_TESTE)
    try:
        with b.conectar() as con:
            con.execute((RAIZ / 'supabase/migrations-v2/0008_resposta_coordenacao.sql').read_text())
        yield b
    finally:
        suporte.derrubar_banco(b)


@contextmanager
def url_dbos_propria(servidor, prefixo='helena_dbos_t_'):
    """Um banco vazio só para as tabelas do DBOS; devolve a URL e o apaga ao sair."""
    import secrets
    nome = prefixo + secrets.token_hex(5)
    with psycopg.connect(servidor, autocommit=True) as con:
        con.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(nome)))
    args = conninfo_to_dict(servidor)
    args['dbname'] = nome
    url = URL.create('postgresql+psycopg', username=args.get('user'), password=args.get('password'),
                     host=args.get('host'), port=int(args['port']) if args.get('port') else None,
                     database=nome).render_as_string(hide_password=False)
    try:
        yield url
    finally:
        with psycopg.connect(servidor, autocommit=True) as con:
            con.execute(sql.SQL('DROP DATABASE IF EXISTS {} WITH (FORCE)').format(sql.Identifier(nome)))


@pytest.fixture(scope='session')
def banco(servidor):
    """O banco compartilhado pela sessão: quem muda a configuração ou cria dados deve usar `banco_proprio`."""
    with banco_proprio(servidor) as b:
        yield b


@pytest.fixture(scope='session')
def url_dbos(servidor):
    with url_dbos_propria(servidor) as url:
        yield url
