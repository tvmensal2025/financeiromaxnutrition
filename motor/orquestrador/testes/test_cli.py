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
