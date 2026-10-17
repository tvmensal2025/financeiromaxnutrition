"""As duas contas do motor e o esquema do DBOS (supabase/migrations-v2/producao/), contra contas REAIS num Postgres local.

Prova, com a verificação de partida de verdade (bancos.preflight_papel_runtime) e sem dados falsos de papel:
  - a conta do aplicativo (helena_motor) passa: só alterna para service_role, sem herdar nem administrar, sem ser dona;
  - a conta do DBOS (dbos_motor) passa: dona do esquema dbos_helena_v2 e sem vínculo com service_role;
  - uma não alcança o que é da outra; nenhuma cria papel, banco ou esquema alheio;
  - o DBOS sobe com run_migrations=False sobre o esquema pronto e roda um fluxo;
  - os dois arquivos recusam rodar de novo ou fora de ordem, sem alterar nada.
"""
import os
import secrets
import subprocess
import sys
from pathlib import Path

import psycopg
import pytest
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo
from sqlalchemy.engine import URL

from conftest import banco_proprio, RAIZ  # noqa: E402
from orquestrador.bancos import preflight_papel_runtime, PapelRuntimeInvalido

PRODUCAO = RAIZ / 'supabase' / 'migrations-v2' / 'producao'
APOIO = Path(__file__).resolve().parent / 'apoio'


def _ler(nome):
    return (PRODUCAO / nome).read_text(encoding='utf-8')


def _como(banco, usuario, senha):
    info = conninfo_to_dict(banco.url)
    info.update(user=usuario, password=senha)
    return make_conninfo(**info)


def _definir_senhas(banco):
    senhas = {'helena_motor': secrets.token_urlsafe(12), 'dbos_motor': secrets.token_urlsafe(12)}
    with banco.conectar() as adm:
        for papel, senha in senhas.items():
            adm.execute(sql.SQL('alter role {} password {}').format(sql.Identifier(papel), sql.Literal(senha)))
    return senhas


@pytest.fixture(scope='module')
def instalado(servidor):
    """Um banco com helena_v2 e as duas contas + o esquema do DBOS, como ficará em produção."""
    with banco_proprio(servidor) as b:
        with b.conectar() as adm:
            adm.execute(_ler('01_contas_do_motor.sql'))
            adm.execute(_ler('02_esquema_dbos.sql'))
        b.senhas = _definir_senhas(b)
        yield b


def test_conta_do_aplicativo_passa_no_preflight_real(instalado):
    with psycopg.connect(_como(instalado, 'helena_motor', instalado.senhas['helena_motor']), autocommit=True) as con:
        r = preflight_papel_runtime(con)
        assert r == {'papel_atual': 'helena_motor', 'papel_sessao': 'helena_motor', 'sistema': False,
                     'membro_service_role': True, 'dono_dbos': False}
        con.execute('set role service_role')
        assert con.execute('select count(*) from helena_v2.card').fetchone()[0] == 0


def test_conta_do_dbos_passa_no_preflight_real(instalado):
    with psycopg.connect(_como(instalado, 'dbos_motor', instalado.senhas['dbos_motor']), autocommit=True) as con:
        r = preflight_papel_runtime(con, sistema=True)
        assert r['dono_dbos'] is True and r['membro_service_role'] is False


def test_vinculo_com_service_role_e_so_set(instalado):
    with instalado.conectar() as adm:
        linha = adm.execute("""select am.set_option, am.inherit_option, am.admin_option
            from pg_auth_members am join pg_roles m on m.oid = am.member join pg_roles g on g.oid = am.roleid
            where m.rolname = 'helena_motor' and g.rolname = 'service_role'""").fetchone()
        assert linha == (True, False, False)
        assert not adm.execute("select pg_has_role('dbos_motor', 'service_role', 'MEMBER')").fetchone()[0]


def test_cada_conta_fica_no_seu_lado(instalado):
    app = _como(instalado, 'helena_motor', instalado.senhas['helena_motor'])
    dbos = _como(instalado, 'dbos_motor', instalado.senhas['dbos_motor'])
    with psycopg.connect(app, autocommit=True) as con:      # o aplicativo não enxerga o DBOS sem alternar...
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute('select * from dbos_helena_v2.workflow_status limit 1')
        for comando in ('create role intruso', 'create database intruso', 'create schema intruso'):
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                con.execute(comando)
        con.execute('set role service_role')                # ...nem como service_role
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute('select * from dbos_helena_v2.workflow_status limit 1')
    with psycopg.connect(dbos, autocommit=True) as con:     # o DBOS não enxerga a v2 nem vira service_role
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute('select count(*) from helena_v2.card')
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute('set role service_role')
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute('create role intruso')


def test_tabelas_do_dbos_sao_todas_da_conta_do_dbos(instalado):
    with instalado.conectar() as adm:
        donos = {r[0] for r in adm.execute("select tableowner from pg_tables where schemaname = 'dbos_helena_v2'")}
        assert donos == {'dbos_motor'}
        assert adm.execute("select count(*) from pg_tables where schemaname = 'dbos_helena_v2'").fetchone()[0] == 13
        assert adm.execute("select version from dbos_helena_v2.dbos_migrations").fetchone()[0] == 123
        funcoes = {r[0] for r in adm.execute("select proname from pg_proc where pronamespace = 'dbos_helena_v2'::regnamespace")}
        assert funcoes == {'enqueue_workflow', 'notifications_function', 'send_message'}


def test_dbos_sobe_sem_migracao_e_roda_um_fluxo(instalado):
    info = conninfo_to_dict(instalado.url)
    url = URL.create('postgresql+psycopg', username='dbos_motor', password=instalado.senhas['dbos_motor'],
                     host=info['host'], port=int(info['port']), database=info['dbname']).render_as_string(hide_password=False)
    saida = subprocess.run([sys.executable, str(APOIO / 'dbos_sem_migracao.py')], capture_output=True, text=True,
                           env=dict(os.environ, URL_DBOS=url), timeout=120)
    assert saida.returncode == 0, saida.stderr[-800:]
    assert 'RESULTADO 5' in saida.stdout
    with instalado.conectar() as adm:       # o fluxo ficou gravado, na conta do DBOS
        assert adm.execute("select count(*) from dbos_helena_v2.workflow_status").fetchone()[0] >= 1


def test_preflight_recusa_conta_com_poder_a_mais(instalado):
    """Se alguém der herança, administração ou posse à conta do aplicativo, a partida é recusada."""
    senha = instalado.senhas['helena_motor']
    estragos = {
        'herda service_role': 'grant service_role to helena_motor with inherit true',
        'administra service_role': 'grant service_role to helena_motor with admin true',
        'cria papeis': 'alter role helena_motor createrole',
        'e dona de helena_v2': 'alter schema helena_v2 owner to helena_motor',
    }
    consertos = {
        'herda service_role': 'grant service_role to helena_motor with inherit false',
        'administra service_role': 'grant service_role to helena_motor with admin false',
        'cria papeis': 'alter role helena_motor nocreaterole',
        'e dona de helena_v2': 'alter schema helena_v2 owner to postgres',
    }
    for nome, estrago in estragos.items():
        with instalado.conectar() as adm:
            adm.execute(estrago)
        try:
            with psycopg.connect(_como(instalado, 'helena_motor', senha), autocommit=True) as con:
                with pytest.raises(PapelRuntimeInvalido):
                    preflight_papel_runtime(con)
        finally:
            with instalado.conectar() as adm:
                adm.execute(consertos[nome])
    with psycopg.connect(_como(instalado, 'helena_motor', senha), autocommit=True) as con:
        preflight_papel_runtime(con)        # consertado: volta a passar


def test_arquivos_sao_seguros_para_repetir_e_recusam_fora_de_ordem(servidor):
    with banco_proprio(servidor) as b:
        with b.conectar() as adm:
            with pytest.raises(psycopg.errors.RaiseException, match='rode antes 01_contas_do_motor'):
                adm.execute(_ler('02_esquema_dbos.sql'))          # 02 antes de 01: recusa
            adm.execute(_ler('01_contas_do_motor.sql'))
            adm.execute(_ler('01_contas_do_motor.sql'))           # 01 duas vezes: sem erro e sem mudar nada
            adm.execute(_ler('02_esquema_dbos.sql'))
            with pytest.raises(psycopg.errors.RaiseException, match='ESQUEMA DBOS JA EXISTE'):
                adm.execute(_ler('02_esquema_dbos.sql'))          # 02 duas vezes: recusa
            assert adm.execute("select count(*) from pg_tables where schemaname = 'dbos_helena_v2'").fetchone()[0] == 13


def test_aplica_como_admin_sem_superusuario_igual_ao_supabase():
    """No Supabase o postgres não é superusuário: cria papéis (CREATEROLE) mas só ganha ADMIN sobre eles.
    Foi assim que o primeiro envio real falhou ('must be able to SET ROLE dbos_motor'): o teste reproduz o caso.
    Usa um servidor só dele: as contas precisam nascer pelas mãos desse administrador, como na produção."""
    from conftest import suporte
    cluster = suporte.ClusterLocal()
    cluster.subir()
    try:
        base = cluster.url.rsplit('/', 1)[0]
        with psycopg.connect(cluster.url, autocommit=True) as adm:
            for papel in suporte.PAPEIS_DO_SUPABASE:
                adm.execute(sql.SQL('create role {} nologin').format(sql.Identifier(papel)))
            senha_admin = secrets.token_hex(12)   # conta descartavel do banco de teste; nunca uma senha escrita no codigo
            adm.execute(sql.SQL('create role admin_supabase login createrole nosuperuser nocreatedb password {}').format(sql.Literal(senha_admin)))
            adm.execute('grant service_role to admin_supabase with admin true, set true, inherit true')
            adm.execute('create database prod')
        with psycopg.connect(base + '/prod', autocommit=True) as adm:
            adm.execute('grant create on database prod to admin_supabase')
        info = conninfo_to_dict(base + '/prod')
        info.update(user='admin_supabase', password=senha_admin)
        with psycopg.connect(make_conninfo(**info), autocommit=True) as con:
            assert not con.execute('select rolsuper from pg_roles where rolname = current_user').fetchone()[0]
            con.execute(_ler('01_contas_do_motor.sql'))
            con.execute(_ler('01_contas_do_motor.sql'))           # repetir também funciona para esse administrador
            con.execute(_ler('02_esquema_dbos.sql'))
            assert con.execute("select count(*) from pg_tables where schemaname = 'dbos_helena_v2'").fetchone()[0] == 13
            assert con.execute("select count(distinct tableowner) from pg_tables where schemaname = 'dbos_helena_v2'").fetchone()[0] == 1
            assert con.execute("select r.rolname from pg_namespace n join pg_roles r on r.oid = n.nspowner "
                               "where n.nspname = 'dbos_helena_v2'").fetchone()[0] == 'dbos_motor'
    finally:
        cluster.derrubar()


def test_01_para_com_erro_se_a_conta_ja_existe_com_privilegio_administrativo(servidor):
    """Conta pré-existente e elevada não é 'consertada' em silêncio: o arquivo para e diz o que fazer."""
    with banco_proprio(servidor) as b:
        with b.conectar() as adm:
            adm.execute(_ler('01_contas_do_motor.sql'))
            adm.execute('alter role dbos_motor createdb')
            try:
                with pytest.raises(psycopg.errors.RaiseException, match='privilegio administrativo'):
                    adm.execute(_ler('01_contas_do_motor.sql'))
            finally:
                adm.execute('alter role dbos_motor nocreatedb')
            adm.execute(_ler('01_contas_do_motor.sql'))           # consertado: volta a rodar


def test_02_esta_em_dia_com_o_dbos_instalado(tmp_path):
    """Se a versão do DBOS mudar, o esquema muda: o arquivo tem de ser gerado de novo e revisado."""
    saida = tmp_path / 'novo.sql'
    r = subprocess.run([sys.executable, str(PRODUCAO / 'gerar_esquema_dbos.py'), str(saida)], capture_output=True, text=True,
                       env=dict(os.environ), timeout=300)
    assert r.returncode == 0, r.stderr[-600:]
    assert saida.read_bytes() == (PRODUCAO / '02_esquema_dbos.sql').read_bytes(), \
        '02_esquema_dbos.sql está desatualizado: rode gerar_esquema_dbos.py e revise a diferença'


def test_arquivos_nao_trazem_senha_nem_toca_em_dados_da_v1():
    for nome in ('01_contas_do_motor.sql', '02_esquema_dbos.sql'):
        texto = _ler(nome).lower()
        assert 'password' not in texto.replace('-- ', ''), nome
        for tabela in ('public.', 'auth.', 'storage.'):
            assert tabela not in texto, (nome, tabela)
