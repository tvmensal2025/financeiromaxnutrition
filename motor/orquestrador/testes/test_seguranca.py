import pytest
from orquestrador.motor import Motor


def test_motor_de_teste_recusa_banco_remoto_antes_de_abrir_conexao():
    with pytest.raises(ValueError, match='local'):
        Motor('postgresql://usuario@banco.exemplo.org/card', 'postgresql://usuario@localhost/dbos')
