import pytest
from orquestrador.motor import Motor


def test_motor_de_teste_recusa_banco_remoto_antes_de_abrir_conexao():
    with pytest.raises(ValueError, match='local'):
        Motor('postgresql://usuario@banco.exemplo.org/card', 'postgresql://usuario@localhost/dbos')


def test_hostaddr_remoto_nao_escapa_por_host_local():
    with pytest.raises(ValueError, match='local'):
        Motor('postgresql://usuario@localhost/card?hostaddr=198.51.100.23',
              'postgresql://usuario@localhost/dbos')
