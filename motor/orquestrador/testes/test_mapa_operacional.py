"""O mapa usado pela triagem segue fontes atuais e não concede poderes ao modelo."""
from dataclasses import dataclass
import json
import re

import pytest

from conftest import RAIZ
from orquestrador.configuracao import capturar_bundle
from orquestrador.mapa_operacional import MapaInvalido, ROTAS, montar_mapa_operacional
from orquestrador.triagem_pedido import TriagemInvalida, _autor_plano


@pytest.fixture
def captura():
    return {
        'pedido_id': '00000000-0000-4000-8000-000000000001',
        'config_revision_id': '00000000-0000-4000-8000-000000000002',
        'eventos_hash': 'e' * 64,
        'contexto_hash': 'c' * 64,
        'eventos': [{'texto': 'Humano Digital: cálculo de R$ 20. Prazo 20/10/2026 16:00.'}],
        'config_conteudo': capturar_bundle(RAIZ / 'helena-v2'),
        'contexto': {'checkpoint': {'checkpoint_id': 'CP-ATUAL', 'status': 'ATIVO',
                                   'resumo_executivo': 'Resumo vigente.'},
                    'decisoes': [],
                    'portfolio': [{'business_id': 'BIZ-003', 'ativo': 'SIM'},
                                  {'business_id': 'BIZ-004', 'ativo': 'SIM'}]},
        'fundador_uid': 'NUNCA_ENVIAR_AO_MODELO',
        'lease_token': 'NUNCA_ENVIAR_AO_MODELO',
    }


def test_mapa_deriva_roles_servicos_e_empresas_sem_autorizar_rascunhos(captura):
    mapa = montar_mapa_operacional(captura)
    servicos = {s['id']: s for s in mapa['servicos']}
    calculo = servicos['SRV-CALCULO']
    assert calculo == {'id': 'SRV-CALCULO', 'estado': 'ESTAGIO', 'dono': 'CAIO',
                       'revisor_titular': 'HELENA',
                       'empresas_operacionais': ['BIZ-003', 'BIZ-004']}
    assert servicos['SRV-PLANO-DE-PROJETO']['estado'] == 'RASCUNHO'
    assert servicos['SRV-PLANO-DE-PROJETO']['empresas_operacionais'] == []
    assert all(s['dono'] != 'FUNDADOR' and s['revisor_titular'] != 'FUNDADOR'
               for s in mapa['servicos'])
    assert {e['id'] for e in mapa['empresas_operacionais']} == {'BIZ-003', 'BIZ-004'}
    assert 'PLANO_CONFIRMADO' in ' '.join(mapa['fluxo'])
    assert 'CARD_CRIADO' in ' '.join(mapa['fluxo'])
    assert 'PRONTO' in ' '.join(mapa['fluxo'])
    assert 'pedido_entrada_evento' in mapa['fontes_de_dados']['pedido']
    assert mapa == montar_mapa_operacional(captura)


def test_rotas_do_mapa_sao_as_rotas_reais_do_app(captura):
    app = (RAIZ / 'src/App.tsx').read_text(encoding='utf-8')
    rotas_declaradas = set(re.findall(r'<Route\s+path=["\']([^"\']+)["\']', app))
    assert set(ROTAS).issubset(rotas_declaradas)
    assert '/overview' not in ROTAS
    assert montar_mapa_operacional(captura)['rotas'] == ROTAS


@pytest.mark.parametrize('inativo', ['NAO', 'NÃO'])
def test_cadastro_inativo_nao_impede_outra_empresa_ativa(captura, inativo):
    captura['contexto']['portfolio'][0]['ativo'] = inativo
    mapa = montar_mapa_operacional(captura)
    assert {e['id'] for e in mapa['empresas_operacionais']} == {'BIZ-004'}
    calculo = next(s for s in mapa['servicos'] if s['id'] == 'SRV-CALCULO')
    assert calculo['empresas_operacionais'] == ['BIZ-004']


@pytest.mark.parametrize('quebra', ['sem_checkpoint', 'sem_portfolio', 'dono_fundador',
                                    'revisor_ausente', 'estado_invalido'])
def test_configuracao_ou_contexto_invalido_falha_fechado(captura, quebra):
    if quebra == 'sem_checkpoint':
        captura['contexto']['checkpoint']['status'] = 'INATIVO'
    elif quebra == 'sem_portfolio':
        del captura['contexto']['portfolio']
    else:
        servico = next(s for s in captura['config_conteudo']['helena-v2/servicos.yaml']['servicos']
                       if s['id'] == 'SRV-CALCULO')
        campo, valor = {'dono_fundador': ('dono', 'FUNDADOR'),
                        'revisor_ausente': ('revisor', 'NAO_EXISTE'),
                        'estado_invalido': ('estado', 'LIGADO')}[quebra]
        servico[campo] = valor
    with pytest.raises(MapaInvalido):
        montar_mapa_operacional(captura)


@dataclass
class UsoFake:
    chamadas: int = 1


def test_autor_recebe_mapa_compacto_sem_credenciais(captura):
    class ExecutorFake:
        pacote = None

        def rodar(self, execucao):
            self.pacote = json.loads(execucao.pacote)
            return type('ResultadoFake', (), {'ok': True, 'texto': '{"tipo":"PERGUNTAR"}',
                    'modelo_usado': 'fake', 'provedor_usado': 'fake', 'conversa': (),
                    'uso': UsoFake()})()

    class MotorFake:
        executor = ExecutorFake()

        def _ficha(self, *args):
            return object()

    motor = MotorFake()
    _autor_plano(motor, captura, None, RAIZ / 'helena-v2')
    pacote = motor.executor.pacote
    assert pacote['mapa_operacional']['servicos']
    assert 'Kanban de cards' in pacote['mapa_operacional']['rotas']['/cards']
    assert 'NUNCA_ENVIAR_AO_MODELO' not in json.dumps(pacote)
    assert len(json.dumps(pacote, ensure_ascii=False).encode('utf-8')) < 60000
    captura['contexto']['checkpoint']['status'] = 'INATIVO'
    with pytest.raises(TriagemInvalida):
        _autor_plano(motor, captura, None, RAIZ / 'helena-v2')
