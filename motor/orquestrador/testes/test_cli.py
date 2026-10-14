import json
from datetime import datetime, timezone

import pytest

from orquestrador.__main__ import main


def test_worker_exige_urls_explicitas(monkeypatch):
    monkeypatch.delenv('HELENA_V2_CONFIG_DATABASE_URL', raising=False)
    monkeypatch.delenv('HELENA_V2_DBOS_SYSTEM_DATABASE_URL', raising=False)
    with pytest.raises(SystemExit) as erro:
        main(['validar-configuracoes'])
    assert erro.value.code == 2


def test_worker_recusa_banco_remoto_antes_de_conectar(monkeypatch):
    monkeypatch.setenv('HELENA_V2_CONFIG_DATABASE_URL', 'postgresql://postgres@banco.exemplo.org/card')
    monkeypatch.setenv('HELENA_V2_DBOS_SYSTEM_DATABASE_URL', 'postgresql://postgres@localhost/dbos')
    with pytest.raises(ValueError, match='local'):
        main(['validar-configuracoes'])


@pytest.mark.parametrize('comando', ['validar-configuracoes', 'registrar-base-tecnica'])
def test_comandos_de_manutencao_nao_iniciam_dbos(monkeypatch, comando, capsys):
    import orquestrador.__main__ as cli

    class MotorEspiao:
        def __init__(self, *_urls, **opcoes):
            assert opcoes['iniciar_dbos'] is False
            self.fechado = False

        def _configuracao_tecnica(self):
            return {'id': 'revisao-teste', 'estado': 'VALIDADA'}

        def processar_configuracoes_pendentes(self):
            return []

        def fechar(self):
            self.fechado = True

    monkeypatch.setenv('HELENA_V2_CONFIG_DATABASE_URL', 'postgresql://postgres@localhost/card')
    monkeypatch.setenv('HELENA_V2_DBOS_SYSTEM_DATABASE_URL', 'postgresql://postgres@localhost/dbos')
    monkeypatch.setattr(cli, 'Motor', MotorEspiao)
    assert main([comando]) == 0
    assert capsys.readouterr().out


PEDIDO_ID = '11111111-1111-4111-8111-111111111111'
CARD_ID = '22222222-2222-4222-8222-222222222222'
REVISAO_ID = '33333333-3333-4333-8333-333333333333'


@pytest.mark.parametrize('comando,opcao', [
    ('consumir-pedido-real', '--solicitacao'),
    ('avancar-card-real', '--card'),
])
def test_cli_real_uuid_invalido_nao_abre_runtime(monkeypatch, capsys, comando, opcao):
    import orquestrador.__main__ as cli

    def proibido(**_):
        pytest.fail('runtime aberto antes de validar UUID')

    monkeypatch.setattr(cli, '_abrir_runtime_real', proibido)
    assert cli.main([comando, opcao, 'nao-e-uuid']) == 1
    assert json.loads(capsys.readouterr().out)['estado'] == 'FALHA_DE_RUNTIME'


def test_cli_real_sem_ambiente_nao_conecta(monkeypatch, capsys):
    import orquestrador.__main__ as cli

    for nome in ('HELENA_V2_DATABASE_URL', 'HELENA_V2_DBOS_SYSTEM_DATABASE_URL',
                 'HELENA_V2_HERMES_BIN', 'HELENA_V2_HERMES_HOME', 'HELENA_V2_EXECUCOES_DIR'):
        monkeypatch.delenv(nome, raising=False)

    def proibido(*_, **__):
        pytest.fail('Motor aberto sem ambiente real completo')

    monkeypatch.setattr(cli, 'Motor', proibido)
    assert cli.main(['consumir-pedido-real', '--solicitacao', PEDIDO_ID]) == 1
    assert json.loads(capsys.readouterr().out)['estado'] == 'FALHA_DE_RUNTIME'


def test_cli_consumo_usa_solicitacao_canonica_sem_agentes(monkeypatch, capsys):
    import orquestrador.__main__ as cli

    pedido = {'plano': {'etapas': [{'id': 'E1'}]}, 'origem': 'supabase',
              'chave_origem': 'TASK-TESTE', 'titulo': 'Pedido real de teste',
              'pedido_original': 'Texto de teste', 'business_id': 'BIZ-TESTE',
              'prazo': '2026-10-21T12:00:00Z', 'dados_reais': {'captura': {'fonte': 'teste'}},
              'config_revision_id': REVISAO_ID}
    chamadas = []

    class MotorEspiao:
        def _linha(self, sql, params):
            chamadas.append(('ler', sql, params))
            return {'pedido': pedido}

        def criar_card_real(self, plano, **opcoes):
            chamadas.append(('criar', plano, opcoes))
            return CARD_ID

        def _card(self, card_id):
            chamadas.append(('card', card_id))
            return {'estado': 'RASCUNHO'}

        def fechar(self):
            chamadas.append(('fechar',))

    monkeypatch.setattr(cli, '_abrir_runtime_real', lambda *, iniciar_dbos: (
        chamadas.append(('abrir', iniciar_dbos)) or MotorEspiao()))
    assert cli.main(['consumir-pedido-real', '--solicitacao', PEDIDO_ID]) == 0
    saida = json.loads(capsys.readouterr().out)
    assert saida == {'card_id': CARD_ID, 'estado': 'RASCUNHO',
                     'solicitacao_id': PEDIDO_ID, 'agentes_chamados': 0}
    assert chamadas[0] == ('abrir', False)
    assert chamadas[1][0] == 'ler' and 'ler_solicitacao_card_real' in chamadas[1][1]
    assert chamadas[1][2] == (PEDIDO_ID,)
    assert chamadas[2] == ('criar', pedido['plano'], {
        'origem': 'supabase', 'chave_origem': 'TASK-TESTE', 'titulo': 'Pedido real de teste',
        'pedido_original': 'Texto de teste', 'business_id': 'BIZ-TESTE',
        'prazo': datetime(2026, 10, 21, 12, tzinfo=timezone.utc),
        'dados_reais': pedido['dados_reais'], 'solicitacao_id': PEDIDO_ID,
        'revisao_id': REVISAO_ID})
    assert chamadas[-1] == ('fechar',)


@pytest.mark.parametrize('card,stale', [(None, False),
                                        ({'ordem_de_servico': {'modo_contexto': 'sintetico'}}, False),
                                        ({'ordem_de_servico': {'modo_contexto': 'real'}}, True)])
def test_cli_avanco_recusa_card_inexistente_sintetico_ou_fonte_velha_sem_dbos(
        monkeypatch, capsys, card, stale):
    import orquestrador.__main__ as cli

    chamadas = []

    class MotorEspiao:
        def _card(self, card_id):
            chamadas.append(('card', card_id))
            return card

        def _modo_card(self, card_id):
            chamadas.append(('conferir', card_id))
            if stale:
                raise ValueError('fonte mudou; postgresql://usuario:segredo@banco.exemplo')

        def fechar(self):
            chamadas.append(('fechar',))

    def abrir(*, iniciar_dbos):
        chamadas.append(('abrir', iniciar_dbos))
        assert iniciar_dbos is False, 'DBOS não deve abrir para card inválido ou fonte velha'
        return MotorEspiao()

    monkeypatch.setattr(cli, '_abrir_runtime_real', abrir)
    assert cli.main(['avancar-card-real', '--card', CARD_ID]) == 1
    assert json.loads(capsys.readouterr().out)['estado'] == 'FALHA_DE_RUNTIME'
    assert chamadas[0] == ('abrir', False) and chamadas[-1] == ('fechar',)
    assert (('conferir', CARD_ID) in chamadas) is stale


def test_cli_avanco_unico_nao_aprova_e_fecha_ambos_runtimes(monkeypatch, capsys):
    import orquestrador.__main__ as cli

    chamadas = []

    class MotorEspiao:
        def __init__(self, dbos):
            self.dbos = dbos

        def _card(self, card_id):
            chamadas.append(('card', self.dbos, card_id))
            return {'ordem_de_servico': {'modo_contexto': 'real'}, 'estado': 'EM_ANDAMENTO'}

        def _modo_card(self, card_id):
            chamadas.append(('conferir', self.dbos, card_id))

        def avancar(self, card_id):
            chamadas.append(('avancar', self.dbos, card_id))
            return True

        def fechar(self):
            chamadas.append(('fechar', self.dbos))

    monkeypatch.setattr(cli, '_abrir_runtime_real', lambda *, iniciar_dbos: (
        chamadas.append(('abrir', iniciar_dbos)) or MotorEspiao(iniciar_dbos)))
    assert cli.main(['avancar-card-real', '--card', CARD_ID]) == 0
    assert json.loads(capsys.readouterr().out) == {
        'card_id': CARD_ID, 'estado': 'EM_ANDAMENTO', 'houve_avanco': True}
    assert chamadas == [('abrir', False), ('card', False, CARD_ID),
                        ('conferir', False, CARD_ID), ('fechar', False),
                        ('abrir', True), ('avancar', True, CARD_ID),
                        ('card', True, CARD_ID), ('fechar', True)]


def test_cli_real_oculta_dsn_e_token_em_erro_e_fecha_runtime(monkeypatch, capsys):
    import orquestrador.__main__ as cli

    segredo = 'postgresql://usuario:senha@banco.exemplo/token-muito-privado'
    fechado = []

    class MotorEspiao:
        def _linha(self, *_):
            raise RuntimeError(segredo)

        def fechar(self):
            fechado.append(True)

    monkeypatch.setattr(cli, '_abrir_runtime_real', lambda *, iniciar_dbos: MotorEspiao())
    assert cli.main(['consumir-pedido-real', '--solicitacao', PEDIDO_ID]) == 1
    saida = capsys.readouterr()
    assert json.loads(saida.out)['estado'] == 'FALHA_DE_RUNTIME'
    assert segredo not in saida.out + saida.err
    assert fechado == [True]


def test_cli_avanco_fecha_segundo_runtime_em_erro(monkeypatch, capsys):
    import orquestrador.__main__ as cli

    fechados = []

    class MotorEspiao:
        def __init__(self, dbos):
            self.dbos = dbos

        def _card(self, _):
            return {'ordem_de_servico': {'modo_contexto': 'real'}}

        def _modo_card(self, _):
            return None

        def avancar(self, _):
            raise RuntimeError('token-privado-do-provedor')

        def fechar(self):
            fechados.append(self.dbos)

    monkeypatch.setattr(cli, '_abrir_runtime_real', lambda *, iniciar_dbos: MotorEspiao(iniciar_dbos))
    assert cli.main(['avancar-card-real', '--card', CARD_ID]) == 1
    saida = capsys.readouterr()
    assert json.loads(saida.out)['estado'] == 'FALHA_DE_RUNTIME'
    assert 'token-privado-do-provedor' not in saida.out + saida.err
    assert fechados == [False, True]


def test_runtime_real_com_executor_fora_do_registro_falha_fechado_sem_abrir_motor(monkeypatch):
    """HELENA_V2_EXECUTOR com nome desconhecido (EVE, OpenClaw ou erro de digitação) é recusado antes de abrir o Motor."""
    import orquestrador.__main__ as cli

    for nome in ('HELENA_V2_DATABASE_URL', 'HELENA_V2_DBOS_SYSTEM_DATABASE_URL', 'HELENA_V2_HERMES_BIN',
                 'HELENA_V2_HERMES_HOME', 'HELENA_V2_EXECUCOES_DIR'):
        monkeypatch.setenv(nome, '/algum/caminho')

    def proibido(*_, **__):
        pytest.fail('Motor aberto com executor fora do registro')

    monkeypatch.setattr(cli, 'Motor', proibido)
    for nome in ('eve', 'openclaw', 'hermez'):
        monkeypatch.setenv('HELENA_V2_EXECUTOR', nome)
        with pytest.raises(ValueError, match='não está no registro aprovado'):
            cli._abrir_runtime_real(iniciar_dbos=False)
