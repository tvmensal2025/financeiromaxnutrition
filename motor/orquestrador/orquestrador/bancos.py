"""Gates locais dos destinos e papéis do runtime real; nenhuma conexão é aberta aqui."""

from __future__ import annotations

import os
import re
import ssl
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
        params = parse_qsl(partes.query, keep_blank_values=True, strict_parsing=True)
    except (TypeError, ValueError, UnicodeError):
        raise DestinoRealInvalido('DSN real malformado') from None
    if (partes.scheme not in ('postgresql', 'postgresql+psycopg') or partes.fragment
            or not host or host != host.lower() or porta != 5432 or partes.path != '/postgres'
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
    parametros = parametros_conexao_real()
    return {'system_database_url': url_dbos, 'dbos_system_schema': DBOS_SCHEMA,
            'run_migrations': False,
            'db_engine_kwargs': {'connect_args': {
                'sslrootcert': parametros['sslrootcert'],
                'connect_timeout': parametros['connect_timeout'],
            }}}


def parametros_conexao_real() -> dict:
    """CA do trust store atual, sem ler certificados nem alterar a seleção do sistema."""
    cafile = ssl.get_default_verify_paths().cafile
    if not cafile or not os.path.isfile(cafile) or not os.access(cafile, os.R_OK):
        raise DestinoRealInvalido('arquivo de CA do sistema indisponível para TLS verificado')
    return {'sslrootcert': cafile, 'connect_timeout': 10,
            'options': '-c lock_timeout=5s -c statement_timeout=30s'}


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
  'pode_set_service_role', pg_has_role(current_user, 'service_role', 'SET'),
  'herda_service_role', pg_has_role(current_user, 'service_role', 'USAGE'),
  'vinculo_set', (SELECT am.set_option FROM pg_auth_members am
    JOIN pg_roles sr ON sr.oid = am.roleid AND sr.rolname = 'service_role'
    WHERE am.member = atual.oid),
  'vinculo_inherit', (SELECT am.inherit_option FROM pg_auth_members am
    JOIN pg_roles sr ON sr.oid = am.roleid AND sr.rolname = 'service_role'
    WHERE am.member = atual.oid),
  'vinculo_admin', (SELECT am.admin_option FROM pg_auth_members am
    JOIN pg_roles sr ON sr.oid = am.roleid AND sr.rolname = 'service_role'
    WHERE am.member = atual.oid),
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
              'membro_service_role', 'sessao_membro_service_role', 'pode_set_service_role',
              'herda_service_role')
    if any(type(dados.get(k)) is not bool for k in chaves):
        raise PapelRuntimeInvalido('flags de papel runtime incompletas')
    if any(dados[k] for k in chaves if k.startswith(('super_', 'bypass_', 'create_', 'replication_'))):
        raise PapelRuntimeInvalido('privilégio administrativo proibido no runtime')
    if dados['dono_app'] or dados['dono_app_sessao']:
        raise PapelRuntimeInvalido('runtime não pode ser dono do schema do aplicativo')
    if not sistema and (not dados['membro_service_role'] or dados['dono_dbos']):
        raise PapelRuntimeInvalido('papel do aplicativo sem membership ou com posse DBOS')
    if not sistema and (dados['vinculo_set'] is not True
                        or dados['vinculo_inherit'] is not False
                        or dados['vinculo_admin'] is not False
                        or not dados['pode_set_service_role'] or dados['herda_service_role']):
        raise PapelRuntimeInvalido('vínculo service_role deve permitir SET sem herança ou ADMIN')
    if sistema and (dados['membro_service_role'] or dados['sessao_membro_service_role']):
        raise PapelRuntimeInvalido('papel DBOS não deve pertencer a service_role')
    if sistema and (dados['pode_set_service_role'] or dados['herda_service_role']
                   or any(dados.get(k) is not None for k in ('vinculo_set', 'vinculo_inherit', 'vinculo_admin'))):
        raise PapelRuntimeInvalido('papel DBOS possui vínculo service_role')
    if sistema and not dados['dono_dbos']:
        raise PapelRuntimeInvalido('papel DBOS não é dono do schema de sistema preparado')
    return {'papel_atual': atual, 'papel_sessao': sessao, 'sistema': sistema,
            'membro_service_role': dados['membro_service_role'],
            'dono_dbos': dados['dono_dbos']}
