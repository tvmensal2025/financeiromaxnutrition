"""Triagem tipada com catálogo real; nenhum modelo ou serviço externo é chamado."""
from datetime import datetime, timezone

import pytest

from conftest import RAIZ
from orquestrador.configuracao import capturar_bundle
from orquestrador.triagem_pedido import TriagemInvalida, _json_objeto, planejar_plano
from spec_helena import Spec


@pytest.fixture(scope='module')
def base():
    raiz = RAIZ / 'helena-v2'
    pedido_id = '00000000-0000-4000-8000-000000000001'
    captura = {'pedido_id': pedido_id, 'config_revision_id': pedido_id,
               'config_hash': 'a' * 64, 'eventos_hash': 'b' * 64, 'contexto_hash': 'c' * 64,
               'contexto': {'checkpoint': {'checkpoint_id': 'CP-ATUAL'},
                            'portfolio': [{'business_id': 'BIZ-003', 'ativo': 'SIM'},
                                          {'business_id': 'BIZ-004', 'ativo': 'SIM'}]},
               'config_conteudo': capturar_bundle(raiz),
               'eventos': [{'texto': 'Humano Digital: faça SRV-CALCULO da receita de R$ 20 por hora '
                                     'durante 5 horas por semana. Prazo 20/10/2026 16:00.'}]}
    resposta = {'tipo': 'PROPOR', 'perguntas': [], 'resumo': 'Conta de receita pedida.',
                'empresa_id': 'BIZ-003', 'servico_id': 'SRV-CALCULO', 'titulo': 'Conta de receita',
                'objetivo': 'Calcular a receita com a taxa e o período informados.',
                'evidencia': {'empresa': 'Humano Digital', 'servico': 'SRV-CALCULO',
                             'prazo': '20/10/2026 16:00', 'insumos': 'R$ 20 por hora durante 5 horas por semana'}}
    return captura, resposta, Spec(raiz), raiz


def test_plano_calculo_usa_fonte_e_orcamento_da_revisao(base):
    captura, resposta, spec, raiz = base
    proposta = planejar_plano(resposta, captura, spec, raiz,
                              agora=datetime(2026, 10, 17, tzinfo=timezone.utc))
    assert proposta['tipo'] == 'PROPOR'
    assert proposta['plano']['etapas'][0]['servico'] == 'SRV-CALCULO'
    assert proposta['plano']['orcamento_meta']['chamadas_total'] >= 6
    assert proposta['prazo'].endswith('-03:00')
    assert proposta['validacao_metadados']['contexto_hash'] == 'c' * 64


def test_prazo_ou_empresa_ambiguos_viram_pergunta(base):
    captura, resposta, spec, raiz = base
    captura = {**captura, 'eventos': [{'texto': captura['eventos'][0]['texto'] +
                                               ' Ou seria para eLiving™ até 21/10/2026 17:00?'}]}
    proposta = planejar_plano(resposta, captura, spec, raiz,
                              agora=datetime(2026, 10, 17, tzinfo=timezone.utc))
    assert proposta['tipo'] == 'PERGUNTAR' and proposta['plano'] is None


def test_correcao_final_com_empresa_e_prazo_resolve_historico_sem_apagar_fontes(base):
    captura, resposta, spec, raiz = base
    captura = {**captura, 'eventos': [*captura['eventos'],
        {'texto': 'Corrijo o prazo da Humano Digital: 21/10/2026 17:00.'}]}
    resposta = {**resposta, 'evidencia': {**resposta['evidencia'],
                                        'prazo': '21/10/2026 17:00'}}
    proposta = planejar_plano(resposta, captura, spec, raiz,
                              agora=datetime(2026, 10, 17, tzinfo=timezone.utc))
    assert proposta['tipo'] == 'PROPOR'
    assert proposta['prazo'] == '2026-10-21T17:00:00-03:00'
    assert len(captura['eventos']) == 2
    assert 'R$ 20' in captura['eventos'][0]['texto']
    # O último evento sem empresa completa não desempata o mesmo histórico.
    incompleta = {**captura, 'eventos': [*captura['eventos'][:1],
                                         {'texto': 'Corrijo o prazo: 21/10/2026 17:00.'}]}
    assert planejar_plano(resposta, incompleta, spec, raiz,
                          agora=datetime(2026, 10, 17, tzinfo=timezone.utc))['tipo'] == 'PERGUNTAR'


def test_sem_prazo_explicito_pergunta(base):
    captura, resposta, spec, raiz = base
    captura = {**captura, 'eventos': [{'texto': 'Humano Digital: faça SRV-CALCULO com R$ 20 por hora '
                                               'durante 5 horas por semana; prazo amanhã.'}]}
    proposta = planejar_plano(resposta, captura, spec, raiz,
                              agora=datetime(2026, 10, 17, tzinfo=timezone.utc))
    assert proposta['tipo'] == 'PERGUNTAR'


def test_calculo_sem_valor_monetario_pergunta_antes_do_plano(base):
    captura, resposta, spec, raiz = base
    captura = {**captura, 'eventos': [{'texto': 'Humano Digital: faça SRV-CALCULO de 5 horas por semana. '
                                               'Prazo 20/10/2026 16:00.'}]}
    resposta = {**resposta, 'evidencia': {**resposta['evidencia'], 'insumos': '5 horas por semana'}}
    proposta = planejar_plano(resposta, captura, spec, raiz,
                              agora=datetime(2026, 10, 17, tzinfo=timezone.utc))
    assert proposta['tipo'] == 'PERGUNTAR'
    assert 'valores monetários' in proposta['perguntas'][0]


def test_copy_guarda_parecer_e_bloqueio_fon_leis(base):
    captura, resposta, spec, raiz = base
    captura = {**captura, 'eventos': [{'texto': 'Humano Digital: faça SRV-COPY de convite com '
                                               'os dados informados. Prazo 20/10/2026 16:00.'}]}
    resposta = {**resposta, 'servico_id': 'SRV-COPY', 'objetivo': 'Escrever convite para revisão.',
                'evidencia': {'empresa': 'Humano Digital', 'servico': 'SRV-COPY',
                             'prazo': '20/10/2026 16:00', 'insumos': 'dados informados'}}
    proposta = planejar_plano(resposta, captura, spec, raiz,
                              agora=datetime(2026, 10, 17, tzinfo=timezone.utc))
    assert [e['servico'] for e in proposta['plano']['etapas']] == ['SRV-COPY', 'SRV-PARECER']
    assert proposta['validacao_metadados']['bloqueio'] == 'PEDIDO_FONTE_LEIS_AUSENTE'


def test_eliving_sem_simbolo_identifica_marca_oficial(base):
    captura, resposta, spec, raiz = base
    captura = {**captura, 'eventos': [{'texto': 'eLiving: faça SRV-CALCULO com R$ 20 por hora '
                                               'durante 5 horas por semana. Prazo 20/10/2026 16:00.'}]}
    resposta = {**resposta, 'empresa_id': 'BIZ-004',
                'evidencia': {**resposta['evidencia'], 'empresa': 'eLiving'}}
    proposta = planejar_plano(resposta, captura, spec, raiz,
                              agora=datetime(2026, 10, 17, tzinfo=timezone.utc))
    assert proposta['empresa_id'] == 'BIZ-004'


def test_data_impossivel_e_json_duplicado_sao_recusados(base):
    captura, resposta, spec, raiz = base
    captura = {**captura, 'eventos': [{'texto': captura['eventos'][0]['texto'].replace(
        '20/10/2026', '31/02/2027')}]}
    resposta = {**resposta, 'evidencia': {**resposta['evidencia'], 'prazo': '31/02/2027 16:00'}}
    with pytest.raises(TriagemInvalida, match='data ou hora'):
        planejar_plano(resposta, captura, spec, raiz,
                       agora=datetime(2026, 10, 17, tzinfo=timezone.utc))
    with pytest.raises(TriagemInvalida, match='duplicada'):
        _json_objeto('{"tipo":"PERGUNTAR","tipo":"PROPOR"}')
