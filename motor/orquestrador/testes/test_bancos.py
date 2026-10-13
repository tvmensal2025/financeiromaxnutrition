"""Gates de produção avaliados sem DNS, socket ou segredo real."""

from urllib.parse import quote

import pytest

from orquestrador.bancos import (DestinoRealInvalido, PapelRuntimeInvalido,
                                 preflight_papel_runtime, validar_destinos_reais)


REF = 'wxkgrykduqtsgmjkzlou'
DIRECT = f'db.{REF}.supabase.co'
POOL = 'aws-0-us-east-1.pooler.supabase.com'


def _url(host=DIRECT, user='helena_runtime', *, porta=5432, banco='postgres',
         params='sslmode=verify-full', scheme='postgresql+psycopg'):
    return f'{scheme}://{quote(user)}:senha-falsa@{host}:{porta}/{banco}?{params}'


def test_direto_pooler_e_mesmo_banco_sem_migracao(monkeypatch):
    monkeypatch.delenv('PGHOST', raising=False)
    direto = _url()
    pooler = _url(POOL, f'helena_dbos.{REF}')
    assert validar_destinos_reais(direto, pooler) == {
        'system_database_url': pooler, 'dbos_system_schema': 'dbos_helena_v2',
        'run_migrations': False}
    assert validar_destinos_reais(direto, direto)['system_database_url'] == direto


@pytest.mark.parametrize('url', [
    _url('evil-db.supabase.co'),
    _url(f'{DIRECT}.evil.test'),
    _url(POOL, 'helena_dbos.outroprojeto'),
    _url(POOL, 'helena_dbos'),
    _url(user='postgres'),
    _url(user='supabase_admin'),
    _url(user='authenticator'),
    _url(user='service_role'),
    _url(porta=6543),
    _url(banco='other'),
    _url(params='sslmode=require'),
    _url(params='sslmode=verify-full&hostaddr=127.0.0.1'),
    _url(params='sslmode=verify-full&sslmode=disable'),
    _url(scheme='http'),
    'postgresql://helena_runtime:senha-falsa@/postgres?sslmode=verify-full',
])
def test_recusa_dsn_inseguro_sem_vazar_credencial(monkeypatch, url):
    monkeypatch.delenv('PGHOST', raising=False)
    with pytest.raises(DestinoRealInvalido) as erro:
        validar_destinos_reais(url, _url())
    assert 'senha-falsa' not in str(erro.value)
    assert url not in str(erro.value)


def test_recusa_env_libpq_que_poderia_redirecionar_conexao(monkeypatch):
    monkeypatch.setenv('PGHOSTADDR', '127.0.0.1')
    with pytest.raises(DestinoRealInvalido, match='override'):
        validar_destinos_reais(_url(), _url())


class ConexaoFalsa:
    def __init__(self, dados):
        self.dados = dados
        self.queries = []

    def execute(self, query):
        self.queries.append(query)
        assert query.lstrip().startswith('SELECT ')
        assert 'INSERT ' not in query and 'UPDATE ' not in query
        return self

    def fetchone(self):
        return (self.dados,)


def _dados(**altera):
    dados = {'papel_atual': 'helena_runtime', 'papel_sessao': 'helena_runtime',
             'membro_service_role': True, 'sessao_membro_service_role': True,
             'dono_app': False,
             'dono_app_sessao': False, 'dono_dbos': False}
    for prefixo in ('super', 'bypass', 'create_role', 'create_db', 'replication'):
        dados[prefixo + '_atual'] = False
        dados[prefixo + '_sessao'] = False
    return dados | altera


def test_preflight_app_e_dbos_so_leem_papeis():
    app = ConexaoFalsa(_dados())
    assert preflight_papel_runtime(app)['membro_service_role'] is True
    assert len(app.queries) == 1
    sistema = ConexaoFalsa(_dados(papel_atual='helena_dbos', papel_sessao='helena_dbos',
                                 membro_service_role=False, sessao_membro_service_role=False,
                                 dono_dbos=True))
    assert preflight_papel_runtime(sistema, sistema=True)['dono_dbos'] is True


@pytest.mark.parametrize('altera,sistema', [
    ({'papel_atual': 'postgres'}, False),
    ({'papel_sessao': 'supabase_admin'}, False),
    ({'papel_sessao': 'outro_papel'}, False),
    ({'super_atual': True}, False),
    ({'bypass_sessao': True}, False),
    ({'create_role_atual': True}, False),
    ({'dono_app': True}, False),
    ({'dono_app_sessao': True}, False),
    ({'dono_dbos': True}, False),
    ({'membro_service_role': False}, False),
    ({'membro_service_role': True}, True),
    ({'membro_service_role': False, 'sessao_membro_service_role': False,
      'dono_dbos': False}, True),
])
def test_preflight_recusa_admin_owner_ou_membership_errada(altera, sistema):
    with pytest.raises(PapelRuntimeInvalido):
        preflight_papel_runtime(ConexaoFalsa(_dados(**altera)), sistema=sistema)


def test_preflight_falha_fechada_em_dados_incompletos():
    with pytest.raises(PapelRuntimeInvalido):
        preflight_papel_runtime(ConexaoFalsa({'papel_atual': 'helena_runtime'}))
