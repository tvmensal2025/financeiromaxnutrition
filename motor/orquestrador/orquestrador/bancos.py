"""Gates locais dos destinos e papéis do runtime real; nenhuma conexão é aberta aqui."""

from __future__ import annotations

import os
import re
from urllib.parse import parse_qsl, unquote, urlsplit


PROJECT_REF = 'wxkgrykduqtsgmjkzlou'
DBOS_SCHEMA = 'dbos_helena_v2'
APP_SCHEMA = 'helena_v2'
_DIRECT_HOST = f'db.{PROJECT_REF}.supabase.co'
_POOLER = re.compile(r'[a-z0-9]+(?:-[a-z0-9]+)*\.pooler\.supabase\.com\Z')
_ROLE = re.compile(r'[a-z_][a-z0-9_]{0,62}\Z')
_ADMIN = frozenset({'postgres', 'supabase_admin', 'authenticator', 'service_role',
                    'supabase_auth_admin', 'supabase_storage_admin'})
_PG_OVERRIDE_NAMES = frozenset({
    'PGHOST', 'PGHOSTADDR', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD',
    'PGPASSFILE', 'PGSERVICE', 'PGSERVICEFILE', 'PGSSLMODE', 'PGSSLROOTCERT',
    'PGOPTIONS', 'PGSYSCONFDIR',
})


class DestinoRealInvalido(ValueError):
    """Falha sem URL, host fornecido, usuário ou credencial no texto."""


class PapelRuntimeInvalido(ValueError):
    """Papel do runtime excessivo ou fora do contrato."""


def _validar_url(url: str) -> None:
    if not isinstance(url, str) or not url or len(url) > 4096:
        raise DestinoRealInvalido('DSN real ausente ou inválido')
    try:
        partes = urlsplit(url)
        host = partes.hostname
        porta = partes.port
        usuario = unquote(partes.username or '', errors='strict')
        banco = unquote(partes.path.lstrip('/'), errors='strict')
        params = parse_qsl(partes.query, keep_blank_values=True, strict_parsing=True)
    except (TypeError, ValueError, UnicodeError):
        raise DestinoRealInvalido('DSN real malformado') from None
    if (partes.scheme not in ('postgresql', 'postgresql+psycopg') or partes.fragment
            or not host or host != host.lower() or porta != 5432 or banco != 'postgres'
            or not usuario or not _ROLE.fullmatch(usuario.split('.')[0])
            or len(params) != 1 or params[0] != ('sslmode', 'verify-full')):
        raise DestinoRealInvalido('DSN fora do formato PostgreSQL canônico com TLS verificado')
    if host == _DIRECT_HOST:
        if '.' in usuario:
            raise DestinoRealInvalido('usuário direto deve ser papel ordinário sem sufixo')
        papel = usuario
    elif _POOLER.fullmatch(host):
        papel, separador, referencia = usuario.partition('.')
        if not separador or referencia != PROJECT_REF:
            raise DestinoRealInvalido('usuário do session pooler não identifica o projeto canônico')
    else:
        raise DestinoRealInvalido('host não pertence ao projeto Supabase canônico')
    if papel.lower() in _ADMIN or not _ROLE.fullmatch(papel):
        raise DestinoRealInvalido('DSN usa papel administrativo ou inválido')
    if partes.password is None or not partes.password:
        raise DestinoRealInvalido('DSN deve trazer credencial explícita')


def validar_destinos_reais(url_banco: str, url_dbos: str) -> dict:
    """Valida duas URLs explícitas; permite o mesmo banco com schemas separados.

    Validação de hostname não prova a identidade SQL do banco: o Motor deve
    confrontar marker/RPC do schema e a referência observada na API oficial.
    """
    if any(nome in os.environ for nome in _PG_OVERRIDE_NAMES):
        raise DestinoRealInvalido('variáveis PG de override não são permitidas no runtime real')
    _validar_url(url_banco)
    _validar_url(url_dbos)
    return {'system_database_url': url_dbos, 'dbos_system_schema': DBOS_SCHEMA,
            'run_migrations': False}


_PAPEL_SQL = """
SELECT json_build_object(
  'papel_atual', current_user,
  'papel_sessao', session_user,
  'super_atual', atual.rolsuper,
  'bypass_atual', atual.rolbypassrls,
  'create_role_atual', atual.rolcreaterole,
  'create_db_atual', atual.rolcreatedb,
  'replication_atual', atual.rolreplication,
  'super_sessao', sessao.rolsuper,
  'bypass_sessao', sessao.rolbypassrls,
  'create_role_sessao', sessao.rolcreaterole,
  'create_db_sessao', sessao.rolcreatedb,
  'replication_sessao', sessao.rolreplication,
  'membro_service_role', pg_has_role(current_user, 'service_role', 'MEMBER'),
  'sessao_membro_service_role', pg_has_role(session_user, 'service_role', 'MEMBER'),
  'dono_app', EXISTS (
    SELECT 1 FROM pg_namespace n WHERE n.nspname = 'helena_v2' AND n.nspowner = atual.oid),
  'dono_app_sessao', EXISTS (
    SELECT 1 FROM pg_namespace n WHERE n.nspname = 'helena_v2' AND n.nspowner = sessao.oid),
  'dono_dbos', EXISTS (
    SELECT 1 FROM pg_namespace n WHERE n.nspname = 'dbos_helena_v2' AND n.nspowner = atual.oid)
) AS dados
FROM pg_roles atual JOIN pg_roles sessao ON sessao.rolname = session_user
WHERE atual.rolname = current_user
"""


def preflight_papel_runtime(con, *, sistema: bool = False) -> dict:
    """SELECT sem mutação; chamar antes de SET ROLE na conexão do aplicativo."""
    if type(sistema) is not bool:
        raise PapelRuntimeInvalido('tipo de preflight inválido')
    try:
        linha = con.execute(_PAPEL_SQL).fetchone()
        dados = linha.get('dados') if isinstance(linha, dict) else linha[0]
    except Exception:
        raise PapelRuntimeInvalido('consulta de papel runtime indisponível') from None
    if not isinstance(dados, dict):
        raise PapelRuntimeInvalido('metadados de papel runtime ausentes')
    atual, sessao = dados.get('papel_atual'), dados.get('papel_sessao')
    if (not isinstance(atual, str) or not isinstance(sessao, str)
            or atual.lower() in _ADMIN or sessao.lower() in _ADMIN):
        raise PapelRuntimeInvalido('papel administrativo proibido no runtime')
    if atual != sessao:
        raise PapelRuntimeInvalido('preflight deve ocorrer antes de SET ROLE')
    chaves = ('super_atual', 'bypass_atual', 'create_role_atual', 'create_db_atual',
              'replication_atual', 'super_sessao', 'bypass_sessao', 'create_role_sessao',
              'create_db_sessao', 'replication_sessao', 'dono_app', 'dono_app_sessao', 'dono_dbos',
              'membro_service_role', 'sessao_membro_service_role')
    if any(type(dados.get(k)) is not bool for k in chaves):
        raise PapelRuntimeInvalido('flags de papel runtime incompletas')
    if any(dados[k] for k in chaves if k.startswith(('super_', 'bypass_', 'create_', 'replication_'))):
        raise PapelRuntimeInvalido('privilégio administrativo proibido no runtime')
    if dados['dono_app'] or dados['dono_app_sessao']:
        raise PapelRuntimeInvalido('runtime não pode ser dono do schema do aplicativo')
    if not sistema and (not dados['membro_service_role'] or dados['dono_dbos']):
        raise PapelRuntimeInvalido('papel do aplicativo sem membership ou com posse DBOS')
    if sistema and (dados['membro_service_role'] or dados['sessao_membro_service_role']):
        raise PapelRuntimeInvalido('papel DBOS não deve pertencer a service_role')
    if sistema and not dados['dono_dbos']:
        raise PapelRuntimeInvalido('papel DBOS não é dono do schema de sistema preparado')
    return {'papel_atual': atual, 'papel_sessao': sessao, 'sistema': sistema,
            'membro_service_role': dados['membro_service_role'],
            'dono_dbos': dados['dono_dbos']}
