import pytest
from orquestrador.motor import conferir_rubrica
from spec_helena import Spec


def test_revisao_exige_todos_criterios_e_prova():
    spec = Spec()
    ids = spec.tipo('calculo')['criterio_de_pronto']['rubrica']
    respostas = [{'id': i, 'resultado': 'PASSOU', 'prova': 'trecho conferido'} for i in ids]
    assert conferir_rubrica(spec, 'SRV-CALCULO', respostas)
    assert not conferir_rubrica(spec, 'SRV-CALCULO', respostas[:-1])
    assert not conferir_rubrica(spec, 'SRV-CALCULO', respostas + [respostas[0]])
    assert not conferir_rubrica(spec, 'SRV-CALCULO', [{**respostas[0], 'prova': ''}, *respostas[1:]])


@pytest.mark.parametrize('estranho', [['lista'], {'a': 1}, 7, None, 1.5, True])
def test_rubrica_com_id_ou_criterio_estranho_e_recusada_sem_levantar_excecao(estranho):
    spec = Spec()
    ids = spec.tipo('calculo')['criterio_de_pronto']['rubrica']
    respostas = [{'id': i, 'resultado': 'PASSOU', 'prova': 'trecho conferido'} for i in ids]
    assert not conferir_rubrica(spec, 'SRV-CALCULO', [{**respostas[0], 'id': estranho}, *respostas[1:]])
    assert not conferir_rubrica(spec, 'SRV-CALCULO', [estranho, *respostas[1:]])
    assert not conferir_rubrica(spec, 'SRV-CALCULO', estranho)
    assert not conferir_rubrica(spec, 'SRV-CALCULO', [{**respostas[0], 'prova': estranho}, *respostas[1:]])
