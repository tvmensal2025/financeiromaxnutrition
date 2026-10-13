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
