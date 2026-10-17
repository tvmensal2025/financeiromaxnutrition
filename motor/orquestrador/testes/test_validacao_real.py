"""`validar-configuracoes` contra o banco REAL: o caminho de produção do comando, com a conta real `helena_motor`.

Num Postgres local: as contas de supabase/migrations-v2/producao/01, o preflight de verdade (bancos.py), as funções SQL de
verdade e o mesmo veredito do motor. Só a abertura da conexão é trocada (não há Supabase aqui): a URL canônica, o TLS e a
recusa de override PG* ficam em test_bancos.py. Primeiro cadastro em produção, de ponta a ponta:
  fundador clona a configuração técnica → pede validação (tela) → motor valida (este comando) → fundador ativa (tela).
"""
import json
import secrets

import psycopg
import pytest
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo
from psycopg.rows import dict_row

import orquestrador.__main__ as cli
from conftest import RAIZ, banco_proprio
from orquestrador.bancos import preflight_papel_runtime
from orquestrador.motor import Motor

PRODUCAO = RAIZ / 'supabase' / 'migrations-v2' / 'producao'
URL_REAL_DE_MENTIRA = 'postgresql://helena_motor:x@db.wxkgrykduqtsgmjkzlou.supabase.co:5432/postgres?sslmode=verify-full'


class BancoComoHelenaMotor:
    """O que `_abrir_banco_service_role` faz DEPOIS das checagens de URL: conecta como helena_motor, preflight real, SET ROLE."""

    def __init__(self, dsn):
        self._dsn = dsn
        self.preflights = 0

    def _con(self, papel='service_role'):
        assert papel == 'service_role'
        con = psycopg.connect(self._dsn, autocommit=True, row_factory=dict_row)
        try:
            preflight_papel_runtime(con)
            self.preflights += 1
            con.execute(sql.SQL('SET ROLE {}').format(sql.Identifier(papel)))
        except BaseException:
            con.close()
            raise
        return con

    def fechar(self):
        return None


def _como_helena_motor(banco, senha):
    info = conninfo_to_dict(banco.url)
    info.update(user='helena_motor', password=senha)
    return make_conninfo(**info)


@pytest.fixture
def producao(servidor, url_dbos, monkeypatch):
    """Banco com helena_v2, a configuração técnica registrada, a conta helena_motor com senha, e o CLI no modo real."""
    with banco_proprio(servidor) as b:
        senha = secrets.token_urlsafe(12)
        with b.conectar() as adm:
            adm.execute((PRODUCAO / '01_contas_do_motor.sql').read_text(encoding='utf-8'))
            adm.execute(sql.SQL('alter role helena_motor password {}').format(sql.Literal(senha)))
        motor = Motor(b.url, url_dbos, permitir_executor_falso=True, iniciar_dbos=False,
                      permitir_configuracao_tecnica=True)       # o que `registrar-base-tecnica` faz no banco local
        try:
            tecnica = motor._configuracao_tecnica()
        finally:
            motor.fechar()
        banco = BancoComoHelenaMotor(_como_helena_motor(b, senha))
        def abrir(*, somente_leitura):
            assert somente_leitura is False, 'validar grava o veredito: a sessão não pode ser somente leitura'
            return banco
        monkeypatch.setattr(cli, '_abrir_banco_service_role', abrir)
        monkeypatch.delenv('HELENA_V2_CONFIG_DATABASE_URL', raising=False)
        monkeypatch.setenv('HELENA_V2_DATABASE_URL', URL_REAL_DE_MENTIRA)
        yield b, banco, tecnica, senha


def _rascunho_do_fundador(b, nome, base_id=None, conteudo=None):
    from psycopg.types.json import Jsonb
    with b.conectar('authenticated') as con:
        revisao = con.execute('SELECT helena_v2.salvar_rascunho(%s,%s,%s,%s,%s) AS r',
                              (nome, Jsonb(conteudo) if conteudo is not None else None, None, None, base_id)).fetchone()[0]
        con.execute('SELECT helena_v2.solicitar_validacao_config(%s,%s)', (revisao['id'], revisao['versao']))
    return revisao


def _saida(capsys):
    return json.loads(capsys.readouterr().out.strip().splitlines()[-1])


def test_primeiro_cadastro_em_producao_de_ponta_a_ponta(producao, capsys):
    b, banco, tecnica, _ = producao
    rascunho = _rascunho_do_fundador(b, 'Primeira revisão da Helena', base_id=tecnica['id'])   # clonada da técnica, pela tela

    assert cli.main(['validar-configuracoes']) == 0
    saida = _saida(capsys)
    assert saida['processadas'] == 1 and saida['resultados'][0]['estado'] == 'VALIDADA'
    assert saida['resultados'][0]['id'] == rascunho['id']
    assert banco.preflights >= 1                                   # a conta foi conferida antes de cada SET ROLE

    with b.conectar() as adm:
        linha = adm.execute('SELECT estado, hash_sha256, validada_em FROM helena_v2.configuracao WHERE id=%s',
                            (rascunho['id'],)).fetchone()
        assert linha[0] == 'VALIDADA' and linha[1] and linha[2]
        assert adm.execute('SELECT ativa_id FROM helena_v2.configuracao_ponteiro').fetchone()[0] is None   # NÃO ativou

    with b.conectar('authenticated') as con:                      # o toque do fundador, na tela
        ativa = con.execute('SELECT helena_v2.ativar_configuracao(%s,%s) AS r', (rascunho['id'], None)).fetchone()[0]
    assert ativa['id'] == rascunho['id']
    with b.conectar() as adm:
        assert str(adm.execute('SELECT ativa_id FROM helena_v2.configuracao_ponteiro').fetchone()[0]) == rascunho['id']

    assert cli.main(['validar-configuracoes']) == 0                # nada pendente: nada muda
    assert _saida(capsys)['processadas'] == 0


def test_motor_le_a_revisao_ativa_pela_funcao_e_nao_pela_tabela(producao):
    """Regressão de 17/10/2026 na VPS: `ligar-motor` lia configuracao_ponteiro direto e o banco recusou (a tabela só abre por
    função, nem o service_role a lê). O instalador agora usa configuracao_ativa(), a mesma função do motor."""
    b, banco, tecnica, _ = producao
    rascunho = _rascunho_do_fundador(b, 'Revisão ativa', base_id=tecnica['id'])
    assert cli.main(['validar-configuracoes']) == 0
    with b.conectar('authenticated') as con:
        con.execute('SELECT helena_v2.ativar_configuracao(%s,%s)', (rascunho['id'], None))
    con = banco._con()                                             # helena_motor + SET ROLE service_role, como na VPS
    try:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute('SELECT ativa_id FROM helena_v2.configuracao_ponteiro')
        r = con.execute('SELECT helena_v2.configuracao_ativa() AS revisao').fetchone()['revisao']
        assert r['id'] == rascunho['id']                           # o que o instalador imprime
    finally:
        con.close()


def test_sem_revisao_ativa_a_funcao_devolve_vazio(producao):
    b, banco, tecnica, _ = producao
    con = banco._con()
    try:
        assert con.execute('SELECT helena_v2.configuracao_ativa() AS revisao').fetchone()['revisao'] is None
    finally:
        con.close()


def test_rascunho_invalido_recebe_o_veredito_e_fica_rascunho(producao, capsys):
    import copy
    from orquestrador.configuracao import capturar_bundle
    b, _, tecnica, _ = producao
    quebrado = copy.deepcopy(capturar_bundle(RAIZ / 'helena-v2'))
    next(s for s in quebrado['helena-v2/servicos.yaml']['servicos'] if s['id'] == 'SRV-DOSSIE')['estado'] = 'ESTADO_DESCONHECIDO'
    ruim = _rascunho_do_fundador(b, 'quebrada', conteudo=quebrado)
    boa = _rascunho_do_fundador(b, 'boa', base_id=tecnica['id'])

    assert cli.main(['validar-configuracoes']) == 0
    saida = _saida(capsys)
    por_id = {r['id']: r['estado'] for r in saida['resultados']}
    assert por_id == {ruim['id']: 'RASCUNHO', boa['id']: 'VALIDADA'}
    with b.conectar('authenticated') as con:
        detalhe = con.execute('SELECT helena_v2.ler_configuracao(%s) AS r', (ruim['id'],)).fetchone()[0]
    assert detalhe['resultado_validacao']['ok'] is False
    assert detalhe['resultado_validacao']['erros']


def test_conta_administrativa_e_recusada_sem_tocar_no_banco(producao, capsys):
    """Se alguém apontar o comando para a conta postgres, o preflight recusa e nenhum veredito é gravado."""
    b, _, tecnica, _ = producao
    rascunho = _rascunho_do_fundador(b, 'pendente', base_id=tecnica['id'])
    cli._abrir_banco_service_role = lambda *, somente_leitura: BancoComoHelenaMotor(b.url)   # b.url = conta postgres
    assert cli.main(['validar-configuracoes']) == 1
    assert _saida(capsys)['estado'] == 'FALHA_DE_RUNTIME'
    with b.conectar() as adm:
        assert adm.execute('SELECT estado FROM helena_v2.configuracao WHERE id=%s', (rascunho['id'],)).fetchone()[0] == 'RASCUNHO'
        assert adm.execute('SELECT count(*) FROM helena_v2.configuracao_validacao WHERE concluida_em IS NOT NULL').fetchone()[0] == 0


def test_url_fora_do_projeto_falha_fechado_e_nao_vaza(monkeypatch, capsys):
    """Sem monkeypatch da abertura: a checagem real de URL recusa antes de conectar, e a saída não traz a URL."""
    monkeypatch.delenv('HELENA_V2_CONFIG_DATABASE_URL', raising=False)
    monkeypatch.setenv('HELENA_V2_DATABASE_URL', 'postgresql://postgres:segredo-xyz@banco.exemplo.org:5432/postgres?sslmode=verify-full')
    assert cli.main(['validar-configuracoes']) == 1
    texto = capsys.readouterr().out
    assert 'FALHA_DE_RUNTIME' in texto
    assert 'segredo-xyz' not in texto and 'exemplo.org' not in texto


def test_sem_url_nenhuma_e_base_tecnica_so_local(monkeypatch):
    for nome in ('HELENA_V2_CONFIG_DATABASE_URL', 'HELENA_V2_DBOS_SYSTEM_DATABASE_URL', 'HELENA_V2_DATABASE_URL'):
        monkeypatch.delenv(nome, raising=False)
    with pytest.raises(SystemExit) as erro:
        cli.main(['validar-configuracoes'])
    assert erro.value.code == 2
    monkeypatch.setenv('HELENA_V2_DATABASE_URL', URL_REAL_DE_MENTIRA)
    with pytest.raises(SystemExit) as erro:                        # a base técnica do real vem do roteiro de instalação
        cli.main(['registrar-base-tecnica'])
    assert erro.value.code == 2
