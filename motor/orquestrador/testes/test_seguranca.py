import pytest
from orquestrador.motor import Motor


def test_motor_de_teste_recusa_banco_remoto_antes_de_abrir_conexao():
    with pytest.raises(ValueError, match='local'):
        Motor('postgresql://usuario@banco.exemplo.org/card', 'postgresql://usuario@localhost/dbos',
              executor=object())


def test_hostaddr_remoto_nao_escapa_por_host_local():
    with pytest.raises(ValueError, match='local'):
        Motor('postgresql://usuario@localhost/card?hostaddr=198.51.100.23',
              'postgresql://usuario@localhost/dbos')


def test_urls_distintas_para_mesmo_banco_sao_recusadas_antes_de_conectar():
    with pytest.raises(ValueError, match='separados'):
        Motor('postgresql://usuario@localhost/card',
              'postgresql+psycopg://outro@127.0.0.1/card?application_name=dbos')


def test_fundador_exige_identidade_injetada():
    motor = object.__new__(Motor)
    with pytest.raises(RuntimeError, match='identidade do fundador'):
        motor._con('authenticated')
