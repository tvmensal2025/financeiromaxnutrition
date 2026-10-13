from pathlib import Path
import sys

import pytest

RAIZ = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(RAIZ / 'motor' / 'orquestrador'))
from orquestrador.plano import validar_plano


def test_roteiro_do_primeiro_card_e_valido():
    import yaml
    plano = yaml.safe_load((RAIZ / 'helena-v2' / 'playbooks' / 'recrutar-10-pessoas.yaml').read_text())
    from spec_helena import Spec
    assert validar_plano(plano, Spec()) is None


def test_plano_recusa_ciclo_servico_desconhecido_e_orcamento_insuficiente():
    from spec_helena import Spec
    base = {'etapas': [{'id': 'E1', 'servico': 'SRV-CALCULO', 'depende_de': ['E2']},
                       {'id': 'E2', 'servico': 'SRV-COPY', 'depende_de': ['E1']}],
            'orcamento_meta': {'execucoes': 30, 'chamadas_total': 200}}
    assert 'ciclo' in validar_plano(base, Spec()).lower()
    base['etapas'][0]['depende_de'] = []
    base['etapas'][0]['servico'] = 'SRV-NAO-EXISTE'
    assert 'serviço' in validar_plano(base, Spec()).lower()
    base['etapas'][0]['servico'] = 'SRV-CALCULO'
    base['orcamento_meta']['execucoes'] = 1
    assert 'orçamento' in validar_plano(base, Spec()).lower()


def test_plano_recusa_entrada_sem_origem():
    from spec_helena import Spec
    plano = {'etapas': [{'id': 'E1', 'servico': 'SRV-CALCULO', 'depende_de': [],
                         'entradas': ['pesquisa_que_nao_foi_importada']}],
             'entradas_externas': {}, 'orcamento_meta': {'execucoes': 10, 'chamadas_total': 100}}
    assert 'entrada' in validar_plano(plano, Spec()).lower()


def test_entrada_de_etapa_exige_dependencia():
    from spec_helena import Spec
    plano = {'etapas': [{'id': 'E1', 'servico': 'SRV-CALCULO', 'depende_de': []},
                        {'id': 'E2', 'servico': 'SRV-COPY', 'depende_de': [], 'entradas': ['E1']}],
             'orcamento_meta': {'execucoes': 10, 'chamadas_total': 100}}
    assert 'dependência' in validar_plano(plano, Spec()).lower()
