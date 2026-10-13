import sys
import copy
from pathlib import Path

import pytest
from psycopg.types.json import Jsonb

RAIZ = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(RAIZ / 'motor' / 'orquestrador'))
from orquestrador.motor import Motor as MotorBase
from orquestrador.configuracao import capturar_bundle
from spec_helena.leitura import ler_yaml

PLANO = ler_yaml(RAIZ / 'helena-v2' / 'playbooks' / 'recrutar-10-pessoas.yaml')
PLANO_DOSSIE = {
    'id': 'dossie-avulso-teste',
    'nome': 'Dossiê de pesquisa com fontes',
    'orcamento_meta': {'execucoes': 4, 'chamadas_total': 100},
    'etapas': [{'id': 'E1', 'servico': 'SRV-DOSSIE',
               'objetivo': 'Conferir os termos da Mimix sobre indicação e pagamento',
               'entradas': [], 'depende_de': []}],
}
FUNDADOR_TESTE = '00000000-0000-4000-8000-000000000001'


class Motor(MotorBase):
    """A fixture do banco cria esta identidade; só os testes a injetam."""

    def __init__(self, *args, **kwargs):
        kwargs.setdefault('permitir_configuracao_tecnica', True)
        kwargs.setdefault('permitir_servico_rascunho', True)
        kwargs.setdefault('permitir_executor_falso', True)
        kwargs.setdefault('permitir_casos_sinteticos', True)
        super().__init__(*args, **kwargs)

    def _con(self, papel='service_role'):
        if papel == 'authenticated':
            con = super()._con(None)
            con.execute('SET ROLE authenticated')
            con.execute("SELECT set_config('request.jwt.claim.sub', %s, false)", (FUNDADOR_TESTE,))
            return con
        return super()._con(papel)


def test_sem_ativa_motor_nao_faz_bootstrap_implicitamente(banco, url_dbos):
    motor = MotorBase(banco.url, url_dbos, permitir_executor_falso=True, permitir_casos_sinteticos=True)
    try:
        with pytest.raises(RuntimeError, match='opt-in local'):
            motor.criar_card(PLANO, 'sem-ativacao')
        with banco.conectar('authenticated') as con:
            assert con.execute('SELECT helena_v2.listar_configuracoes()').fetchone()[0] == []
    finally:
        motor.fechar()


def test_executor_injetado_nao_habilita_casos_sinteticos(banco, url_dbos):
    motor = MotorBase(banco.url, url_dbos, executor=object())
    try:
        with pytest.raises(RuntimeError, match='adaptador de contexto real'):
            motor.criar_card(PLANO, 'sem-adaptador')
    finally:
        motor.fechar()


def test_primeiro_card_vai_ate_pronto_com_so_toques_previstos(banco, url_dbos):
    motor = Motor(banco.url, url_dbos)
    try:
        card = motor.criar_card(PLANO, 'jornada-principal')
        assert not any(nome.startswith('helena-v2/casos/') for nome in motor._ambiente_card(card)[0]['conteudo'])
        toques = []
        for _ in range(100):
            atual = motor._card(card)
            if atual['estado'] == 'PRONTO':
                break
            if atual['estado'] == 'ESPERANDO_CONFIRMACAO':
                motor._evento('card', card, 'FUNDADOR', 'RESPONDER', {'opcao': 'CONFIRMO'},
                              toque='confirmar', nao_disparar=['PLANO_VALIDO'])
                toques.append('CONFIRMO')
            elif (juridico := next((e for e in motor._etapas(card) if e['codigo'] == 'E4'), None)) and juridico['estado'] == 'ESPERANDO_FUNDADOR':
                motor._evento('etapa', juridico['id'], 'FUNDADOR', 'APROVAR', toque='aprovar-parecer')
                toques.append('APROVAR')
            else:
                assert motor.avancar(card), [(e['codigo'], e['estado']) for e in motor._etapas(card)]
        assert motor._card(card)['estado'] == 'PRONTO'
        assert toques == ['CONFIRMO', 'APROVAR']
        assert [e['estado'] for e in motor._etapas(card)] == ['PRONTA'] * 5
        assert {e.ficha.identidade for e in motor.executor.execucoes} == {'HELENA', 'CAIO', 'ISABELA', 'CLARA'}
        with motor._con() as con:
            entrega = con.execute("SELECT conteudo FROM helena_v2.entrega WHERE card_id=%s AND etapa_codigo='E5' ORDER BY id DESC LIMIT 1",
                                  (card,)).fetchone()
        assert isinstance(entrega['conteudo']['resposta'], dict)
    finally:
        motor.fechar()


def test_dossie_avulso_executa_ravi_e_revisao_sem_alterar_roteiro_canonico(banco, url_dbos):
    from executor_helena.executor_falso import ExecutorFalso, Roteiro
    referencia = {}
    injetado = ExecutorFalso(lambda execucao: Roteiro(texto=referencia['motor']._texto_roteirizado(execucao)))
    motor = Motor(banco.url, url_dbos, executor=injetado)
    referencia['motor'] = motor
    try:
        assert motor.executor is injetado
        card = motor.criar_card(PLANO_DOSSIE, 'dossie-ravi')
        etapa = _ate_execucao(motor, card)
        motor.executar_etapa(etapa['id'])
        em_revisao = motor._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa['id'],))
        assert em_revisao['estado'] == 'REVISAO'
        motor._revisar(em_revisao)
        assert motor._linha('SELECT estado FROM helena_v2.etapa WHERE id=%s', (etapa['id'],))['estado'] == 'PRONTA'
        assert [(e.ficha.identidade, e.ficha.papel) for e in motor.executor.execucoes] == [
            ('HELENA', 'COORDENACAO'), ('RAVI', 'AUTOR'), ('ISABELA', 'REVISOR')]
    finally:
        motor.fechar()


def test_card_antigo_usa_revisao_fixada_apos_nova_ativacao_e_aposentadoria(banco, url_dbos):
    motor = Motor(banco.url, url_dbos)
    try:
        antigo = motor.criar_card(PLANO_DOSSIE, 'dossie-antes-da-configuracao')
        etapa_antiga = _ate_execucao(motor, antigo)
        revisao_antiga = motor._card(antigo)['ordem_de_servico']['config_revision_id']
        bundle = copy.deepcopy(capturar_bundle(RAIZ / 'helena-v2'))
        dossie = next(s for s in bundle['helena-v2/servicos.yaml']['servicos'] if s['id'] == 'SRV-DOSSIE')
        dossie['estado'] = 'APOSENTADO'
        with motor._con('authenticated') as con:
            rascunho = con.execute('SELECT helena_v2.salvar_rascunho(%s,%s,%s,%s,%s) AS revisao',
                                   ('Dossiê aposentado', Jsonb(bundle), None, None, revisao_antiga)).fetchone()['revisao']
            con.execute('SELECT helena_v2.solicitar_validacao_config(%s,%s)',
                        (rascunho['id'], rascunho['versao']))
        resultados = motor.processar_configuracoes_pendentes()
        assert len(resultados) == 1 and resultados[0]['estado'] == 'VALIDADA'
        with motor._con('authenticated') as con:
            ativa = con.execute('SELECT helena_v2.ativar_configuracao(%s,%s) AS revisao',
                                (rascunho['id'], None)).fetchone()['revisao']
        assert ativa['id'] == rascunho['id']
    finally:
        motor.fechar()
    reiniciado = Motor(banco.url, url_dbos)
    try:
        assert reiniciado._ambiente_card(antigo)[1].servicos['SRV-DOSSIE']['estado'] == 'RASCUNHO'
        reiniciado.executar_etapa(etapa_antiga['id'])
        reiniciado._revisar(reiniciado._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa_antiga['id'],)))
        assert reiniciado._linha('SELECT estado FROM helena_v2.etapa WHERE id=%s', (etapa_antiga['id'],))['estado'] == 'PRONTA'
        novo = reiniciado.criar_card(PLANO, 'roteiro-apos-configuracao')
        assert reiniciado._card(novo)['ordem_de_servico']['config_revision_id'] == ativa['id']
        assert reiniciado._ambiente_card(novo)[1].servicos['SRV-DOSSIE']['estado'] == 'APOSENTADO'
        with pytest.raises(ValueError, match='aposentado'):
            reiniciado.criar_card(PLANO_DOSSIE, 'dossie-novo-recusado')
        assert [(e.ficha.identidade, e.ficha.papel) for e in reiniciado.executor.execucoes] == [
            ('RAVI', 'AUTOR'), ('ISABELA', 'REVISOR')]
    finally:
        reiniciado.fechar()


def test_worker_registra_erro_de_um_rascunho_e_continua_o_seguinte(banco, url_dbos):
    motor = Motor(banco.url, url_dbos)
    try:
        motor._configuracao_tecnica()
        valido = capturar_bundle(RAIZ / 'helena-v2')
        invalido = copy.deepcopy(valido)
        next(s for s in invalido['helena-v2/servicos.yaml']['servicos']
             if s['id'] == 'SRV-DOSSIE')['estado'] = 'ESTADO_DESCONHECIDO'
        caminho_longo = copy.deepcopy(valido)
        caminho_longo[f'helena-v2/agents/{"a" * 300}.yaml'] = copy.deepcopy(
            valido['helena-v2/agents/helena.yaml'])
        with motor._con('authenticated') as con:
            for nome, bundle in (('inválido', invalido), ('caminho longo', caminho_longo), ('válido', valido)):
                revisao = con.execute('SELECT helena_v2.salvar_rascunho(%s,%s) AS revisao',
                                      (nome, Jsonb(bundle))).fetchone()['revisao']
                con.execute('SELECT helena_v2.solicitar_validacao_config(%s,%s)',
                            (revisao['id'], revisao['versao']))
        resultados = motor.processar_configuracoes_pendentes()
        assert len(resultados) == 3
        assert resultados[0]['estado'] == 'RASCUNHO'
        assert resultados[0]['resultado_validacao']['ok'] is False
        assert resultados[1]['estado'] == 'RASCUNHO'
        assert resultados[1]['resultado_validacao']['ok'] is False
        assert resultados[2]['estado'] == 'VALIDADA'
    finally:
        motor.fechar()


def _ate_execucao(motor, card, codigo='E1'):
    for _ in range(20):
        etapa = next(e for e in motor._etapas(card) if e['codigo'] == codigo)
        if etapa['estado'] == 'EXECUTANDO':
            return etapa
        if motor._card(card)['estado'] == 'ESPERANDO_CONFIRMACAO':
            motor._evento('card', card, 'FUNDADOR', 'RESPONDER', {'opcao': 'CONFIRMO'},
                          toque=f'confirmar-{card}', nao_disparar=['PLANO_VALIDO'])
        else:
            assert motor.avancar(card)
    raise AssertionError('etapa não iniciou')


def test_repetir_workflow_nao_refaz_executor_nem_entrega(banco, url_dbos):
    motor = Motor(banco.url, url_dbos)
    try:
        card = motor.criar_card(PLANO, 'replay')
        etapa = _ate_execucao(motor, card)
        motor.executar_etapa(etapa['id'])
        motor.executar_etapa(etapa['id'])
        assert sum(e.ficha.papel == 'AUTOR' for e in motor.executor.execucoes) == 1
        with motor._con() as con:
            qtd = con.execute('SELECT count(*) AS n FROM helena_v2.entrega WHERE numero_execucao=%s',
                              (etapa['execucao_atual'],)).fetchone()['n']
        assert qtd == 1
    finally:
        motor.fechar()


def test_cancelamento_bloqueia_resposta_tardia(banco, url_dbos):
    motor = Motor(banco.url, url_dbos)
    try:
        card = motor.criar_card(PLANO, 'cancelamento')
        etapa = _ate_execucao(motor, card)
        motor._evento('card', card, 'FUNDADOR', 'CANCELAR', toque='cancelar')
        with pytest.raises(RuntimeError, match='antiga|sem execução'):
            motor.executar_etapa(etapa['id'])
        with motor._con() as con:
            qtd = con.execute('SELECT count(*) AS n FROM helena_v2.entrega WHERE etapa_id=%s',
                              (etapa['id'],)).fetchone()['n']
        assert qtd == 0
    finally:
        motor.fechar()


def test_recusa_do_portao1_devolve_ao_autor(banco, url_dbos):
    from spec_helena import Spec, listar_casos
    ruim = next(c for c in listar_casos(Spec()) if c.servico == 'SRV-CALCULO' and not c.bom
                and any(i.startswith('CHK-') for i in c.deve_falhar_em))
    motor = Motor(banco.url, url_dbos, casos={'SRV-CALCULO': ruim.id})
    try:
        card = motor.criar_card(PLANO, 'portao1')
        etapa = _ate_execucao(motor, card)
        motor.executar_etapa(etapa['id'])
        atual = motor._linha('SELECT estado, execucao_atual FROM helena_v2.etapa WHERE id=%s', (etapa['id'],))
        assert atual['estado'] == 'EXECUTANDO'
        assert atual['execucao_atual'] != etapa['execucao_atual']
        with motor._con() as con:
            entrega = con.execute('SELECT portao1 FROM helena_v2.entrega WHERE etapa_id=%s ORDER BY id DESC LIMIT 1',
                                  (etapa['id'],)).fetchone()
        assert entrega['portao1'] == 'RECUSOU'
    finally:
        motor.fechar()


def test_ajuste_do_parecer_reabre_pecas_julgadas(banco, url_dbos):
    from spec_helena import Spec, listar_casos
    parecer = next(c for c in listar_casos(Spec()) if c.servico == 'SRV-PARECER' and c.bom
                   and c.dados['resposta'].get('parecer') == 'AJUSTE')
    motor = Motor(banco.url, url_dbos, casos={'SRV-PARECER': parecer.id})
    try:
        card = motor.criar_card(PLANO, 'ajuste')
        for _ in range(90):
            e4 = next(e for e in motor._etapas(card) if e['codigo'] == 'E4')
            if e4['estado'] == 'ESPERANDO_FUNDADOR':
                break
            if motor._card(card)['estado'] == 'ESPERANDO_CONFIRMACAO':
                motor._evento('card', card, 'FUNDADOR', 'RESPONDER', {'opcao': 'CONFIRMO'},
                              toque='confirmar-ajuste', nao_disparar=['PLANO_VALIDO'])
            else:
                assert motor.avancar(card)
        assert e4['estado'] == 'ESPERANDO_FUNDADOR'
        motor._evento('etapa', e4['id'], 'FUNDADOR', 'APROVAR', toque='aprovar-ajuste')
        estados = {e['codigo']: e['estado'] for e in motor._etapas(card)}
        assert estados['E2'] == estados['E3'] == 'EXECUTANDO'
        assert estados['E4'] == 'AGUARDANDO_ANTERIORES'
    finally:
        motor.fechar()


def test_revisao_repetida_nao_refaz_revisor(banco, url_dbos):
    motor = Motor(banco.url, url_dbos)
    try:
        card = motor.criar_card(PLANO, 'replay-revisao')
        etapa = _ate_execucao(motor, card)
        motor.executar_etapa(etapa['id'])
        em_revisao = motor._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa['id'],))
        motor._revisar(em_revisao)
        motor._revisar(em_revisao)
        assert sum(e.ficha.papel == 'REVISOR' for e in motor.executor.execucoes) == 1
        with motor._con() as con:
            qtd = con.execute("SELECT count(*) AS n FROM helena_v2.historico WHERE alvo_id=%s AND evento='APROVAR' AND resultado='APLICADO'",
                              (etapa['id'],)).fetchone()['n']
        assert qtd == 1
    finally:
        motor.fechar()


def test_queda_apos_salvar_retomada_sem_refazer_agente(banco, url_dbos):
    motor = Motor(banco.url, url_dbos)
    card = None
    etapa = None
    numero = None
    try:
        card = motor.criar_card(PLANO, 'queda-no-meio')
        etapa = _ate_execucao(motor, card)
        numero = etapa['execucao_atual']
        motor.executar_e_salvar(etapa['id'], numero)
        assert sum(e.ficha.papel == 'AUTOR' for e in motor.executor.execucoes) == 1
        assert motor._linha('SELECT helena_v2.ler_resposta_execucao(%s) AS resposta', (numero,))['resposta']
    finally:
        motor.fechar()
    reiniciado = Motor(banco.url, url_dbos)
    try:
        reiniciado.executar_etapa(etapa['id'])
        assert sum(e.ficha.papel == 'AUTOR' for e in reiniciado.executor.execucoes) == 0
        assert reiniciado._linha('SELECT estado FROM helena_v2.etapa WHERE id=%s', (etapa['id'],))['estado'] == 'REVISAO'
    finally:
        reiniciado.fechar()


@pytest.mark.parametrize('texto', [
    '{',
    '{"acao":"ENTREGAR","acao_externa":"NENHUMA"}',
    '{"acao":"ENTREGAR","parecer":"DESCONHECIDO","acao_externa":{"tipo":"DESCONHECIDO"}}',
])
def test_resposta_invalida_recebe_recusa_do_portao1(banco, url_dbos, texto):
    from executor_helena.executor_falso import ExecutorFalso, Roteiro
    motor = Motor(banco.url, url_dbos)
    try:
        card = motor.criar_card(PLANO, 'json-invalido')
        etapa = _ate_execucao(motor, card)
        motor.executor = ExecutorFalso(lambda _exec: Roteiro(texto=texto))
        motor.executar_etapa(etapa['id'])
        atual = motor._linha('SELECT estado, execucao_atual FROM helena_v2.etapa WHERE id=%s', (etapa['id'],))
        assert atual['estado'] == 'EXECUTANDO'
        assert atual['execucao_atual'] != etapa['execucao_atual']
        with motor._con() as con:
            entrega = con.execute('SELECT portao1 FROM helena_v2.entrega WHERE etapa_id=%s ORDER BY id DESC LIMIT 1',
                                  (etapa['id'],)).fetchone()
        assert entrega['portao1'] == 'RECUSOU'
    finally:
        motor.fechar()


def test_resposta_salva_antes_do_checkpoint_nao_repete_agente(banco, url_dbos):
    motor = Motor(banco.url, url_dbos)
    try:
        card = motor.criar_card(PLANO, 'queda-apos-sql')
        etapa = _ate_execucao(motor, card)
        motor.executar_e_salvar(etapa['id'], etapa['execucao_atual'])
        assert len(motor.executor.execucoes) == 2  # Helena e autor
        motor.executar_etapa(etapa['id'])
        assert len(motor.executor.execucoes) == 2
    finally:
        motor.fechar()
