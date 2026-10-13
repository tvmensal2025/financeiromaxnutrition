from orquestrador.motor import Motor
from spec_helena import Spec, listar_casos


def test_caso_ruim_so_pode_ser_escolhido_explicitamente():
    ruim = next(c for c in listar_casos(Spec()) if c.servico == 'SRV-CALCULO' and not c.bom)
    motor = object.__new__(Motor)
    motor.casos = {'SRV-CALCULO': ruim.id}
    motor.permitir_casos_sinteticos = True
    assert motor._caso('SRV-CALCULO', Spec()).id == ruim.id


def test_parecer_padrao_na_jornada_e_ok():
    motor = object.__new__(Motor)
    motor.casos = {}
    motor.permitir_casos_sinteticos = True
    assert motor._caso('SRV-PARECER', Spec()).dados['resposta']['parecer'] == 'OK'
