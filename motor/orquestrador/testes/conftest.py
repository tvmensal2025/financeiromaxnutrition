"""Reusa exatamente o cluster e as migrations dos testes do banco v2."""
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


@pytest.fixture(scope='session')
def banco(servidor):
    """Banco descartável do Motor com resposta durável da coordenadora."""
    b = suporte.montar_banco(servidor, papeis_de_teste=suporte.PAPEIS_DE_TESTE)
    try:
        with b.conectar() as con:
            con.execute((RAIZ / 'supabase/migrations-v2/0008_resposta_coordenacao.sql').read_text())
        yield b
    finally:
        suporte.derrubar_banco(b)


@pytest.fixture(scope='session')
def url_dbos(servidor):
    import secrets
    nome = 'helena_dbos_t_' + secrets.token_hex(5)
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
