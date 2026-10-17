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


def test_texto_pronto_real_exige_parecer_que_depende_da_entrega():
    from spec_helena import Spec
    spec = Spec()
    plano = {'etapas': [{'id': 'E1', 'servico': 'SRV-COPY', 'depende_de': []}],
             'orcamento_meta': {'execucoes': 4, 'chamadas_total': 200}}
    assert spec.servicos['SRV-COPY']['julgado_pelo_parecer'] == 'SEMPRE'
    assert 'exige SRV-PARECER' in validar_plano(plano, spec)
    plano['etapas'].append({'id': 'E2', 'servico': 'SRV-PARECER', 'depende_de': []})
    assert 'exige SRV-PARECER' in validar_plano(plano, spec)
    plano['etapas'][1]['depende_de'] = ['E1']
    assert validar_plano(plano, spec) is None


def test_novo_plano_recusa_servico_aposentado():
    from spec_helena import Spec
    spec = Spec()
    dados = spec._ler('servicos.yaml')
    next(s for s in dados['servicos'] if s['id'] == 'SRV-DOSSIE')['estado'] = 'APOSENTADO'
    plano = {'etapas': [{'id': 'E1', 'servico': 'SRV-DOSSIE', 'depende_de': []}],
             'orcamento_meta': {'execucoes': 4, 'chamadas_total': 100}}
    assert 'aposentado' in validar_plano(plano, spec).lower()
