import sys
import copy
import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor
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
PLANO_COPY_AVULSO = {
    'id': 'copy-avulso-teste', 'nome': 'Convite avulso de teste',
    'orcamento_meta': {'execucoes': 4, 'chamadas_total': 100},
    'etapas': [{'id': 'E1', 'servico': 'SRV-COPY',
               'objetivo': 'Escrever convite claro com aprovação do fundador',
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


def _levar_ate_pronto(motor, card):
    """Conduz o card pelos únicos toques previstos (confirmar e aprovar o parecer) até PRONTO. Devolve os toques."""
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
    return toques


def test_primeiro_card_vai_ate_pronto_com_so_toques_previstos(banco, url_dbos):
    motor = Motor(banco.url, url_dbos)
    try:
        card = motor.criar_card(PLANO, 'jornada-principal')
        assert not any(nome.startswith('helena-v2/casos/') for nome in motor._ambiente_card(card)[0]['conteudo'])
        toques = _levar_ate_pronto(motor, card)
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


def test_o_mesmo_card_chega_a_pronto_com_outro_runtime_que_nao_e_o_hermes(banco, url_dbos, tmp_path):
    """O motor não depende do Hermes nem do executor falso: um runtime de processo comum, com registro próprio,
    leva o MESMO card aos mesmos estados, toques e entregas (portabilidade de executor)."""
    from executor_helena.runtime_alternativo import RuntimeAlternativoDeTeste
    referencia = {}
    outro = RuntimeAlternativoDeTeste(tmp_path / 'runtime', texto=lambda execucao: referencia['motor']._texto_roteirizado(execucao))
    motor = Motor(banco.url, url_dbos, executor=outro)
    referencia['motor'] = motor
    try:
        assert motor.executor is outro and type(outro).__name__ == 'RuntimeAlternativoDeTeste'
        card = motor.criar_card(PLANO, 'jornada-outro-runtime')
        toques = _levar_ate_pronto(motor, card)
        assert motor._card(card)['estado'] == 'PRONTO' and toques == ['CONFIRMO', 'APROVAR']
        assert [e['estado'] for e in motor._etapas(card)] == ['PRONTA'] * 5
        assert {e.ficha.identidade for e in outro.execucoes} == {'HELENA', 'CAIO', 'ISABELA', 'CLARA'}
        with motor._con() as con:
            entrega = con.execute("SELECT conteudo FROM helena_v2.entrega WHERE card_id=%s AND etapa_codigo='E5' ORDER BY id DESC LIMIT 1",
                                  (card,)).fetchone()
        assert isinstance(entrega['conteudo']['resposta'], dict)
    finally:
        motor.fechar()


def test_coordenacao_retoma_apos_resposta_sql_sem_repetir_executor(banco, url_dbos):
    primeiro = Motor(banco.url, url_dbos, iniciar_dbos=False)
    try:
        card = primeiro.criar_card(PLANO, 'coordenacao-replay-sql')
        chave = primeiro._linha(
            'SELECT helena_v2.obter_chamada_coordenacao(%s::uuid) AS chave', (card,))['chave']
        assert primeiro.executar_e_salvar_coordenacao(card, chave) == chave
        assert len(primeiro.executor.execucoes) == 1
    finally:
        primeiro.fechar()
    retomado = Motor(banco.url, url_dbos, iniciar_dbos=False)
    try:
        assert retomado.executar_e_salvar_coordenacao(card, chave) == chave
        assert retomado.executor.execucoes == []
        assert retomado.conferir_e_aplicar_coordenacao(card, chave) == 'ESPERANDO_CONFIRMACAO'
        assert retomado.conferir_e_aplicar_coordenacao(card, chave) == 'ESPERANDO_CONFIRMACAO'
        with retomado._con() as con:
            total = con.execute(
                """SELECT count(*) FROM helena_v2.historico WHERE card_id=%s
                   AND papel='HELENA' AND evento='LER_DE_VOLTA' AND chave=%s""",
                (card, chave)).fetchone()['count']
        assert total == 1
    finally:
        retomado.fechar()


def test_falha_da_coordenacao_aceita_motivo_de_evidencia_no_banco(banco, url_dbos):
    motor = Motor(banco.url, url_dbos, iniciar_dbos=False)
    try:
        card = motor.criar_card(PLANO, 'coordenacao-falha-evidencia')
        motor._linha('SELECT helena_v2.obter_chamada_coordenacao(%s::uuid) AS chave', (card,))
        resultado = motor._evento('card', card, 'MOTOR', 'FALHA', {'classe': 'DESCONHECIDA'},
                                  conteudo={'motivo': 'EVIDENCIA_INVALIDA'})
        assert resultado['resultado'] == 'APLICADO'
        assert motor._card(card)['falhas_helena'] == 1
        with motor._con() as con:
            falhas = con.execute(
                "SELECT count(*) AS n FROM helena_v2.historico WHERE card_id=%s AND evento='FALHA'",
                (card,)).fetchone()['n']
        assert falhas == 1
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


def test_falha_por_insumo_usa_vocabulario_e_replay_sem_executor(banco, url_dbos):
    motor = Motor(banco.url, url_dbos)
    try:
        card = motor.criar_card(PLANO, 'insumos-insuficientes-replay')
        etapa = _ate_execucao(motor, card)
        numero = etapa['execucao_atual']
        antes = len(motor.executor.execucoes)
        resposta = motor._evento(
            'etapa', etapa['id'], 'AUTOR', 'REGISTRAR_FALHA',
            {'motivo_falha': 'FALTAM_DADOS', 'usou_internet': 'NAO'},
            ator=etapa['autor'], chave=numero,
            conteudo={'motivo': 'INSUMOS_INSUFICIENTES', 'faltam': ['taxa efetiva']})
        assert resposta['resultado'] == 'APLICADO'
        assert motor._linha('SELECT estado FROM helena_v2.etapa WHERE id=%s',
                            (etapa['id'],))['estado'] == 'EM_RESOLUCAO'
        assert motor.executar_e_salvar(etapa['id'], numero) is None
        assert len(motor.executor.execucoes) == antes
    finally:
        motor.fechar()


def test_falha_de_prova_do_revisor_usa_vocabulario_no_banco(banco, url_dbos):
    motor = Motor(banco.url, url_dbos)
    try:
        # Outro teste aposenta SRV-DOSSIE na revisão ativa deste banco de sessão.
        card = motor.criar_card(PLANO, 'revisor-falha-evidencia')
        etapa = _ate_execucao(motor, card)
        motor.executar_etapa(etapa['id'])
        em_revisao = motor._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa['id'],))
        assert em_revisao['estado'] == 'REVISAO'
        if em_revisao['execucao_atual'] is None:
            motor._evento('etapa', etapa['id'], 'MOTOR', 'INICIAR_REVISAO')
        resultado = motor._evento('etapa', etapa['id'], 'MOTOR', 'FALHA',
                                  {'classe': 'DESCONHECIDA'},
                                  conteudo={'motivo': 'EVIDENCIA_INVALIDA'})
        assert resultado['resultado'] == 'APLICADO'
        assert motor._linha('SELECT estado FROM helena_v2.etapa WHERE id=%s',
                            (etapa['id'],))['estado'] == 'EM_RESOLUCAO'
    finally:
        motor.fechar()


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


@pytest.mark.parametrize('papel', ['COORDENACAO', 'AUTOR', 'REVISOR'])
def test_cancelamento_interrompe_executor_bloqueado_em_ate_15s(banco, url_dbos, papel):
    from executor_helena.executor_falso import ExecutorFalso, Roteiro

    class ExecutorBloqueante(ExecutorFalso):
        def __init__(self):
            super().__init__(lambda execucao: Roteiro(
                texto=self.motor._texto_roteirizado(execucao),
                atraso_s=30 if execucao.ficha.papel == papel else 0))
            self.iniciado = threading.Event()
            self.cancelamentos = []

        def rodar(self, execucao):
            if execucao.ficha.papel == papel:
                self.iniciado.set()
                # Simula o intervalo entre iniciar o adaptador e registrar o PID.
                time.sleep(1.2)
            return super().rodar(execucao)

        def cancelar(self, id_da_execucao):
            self.cancelamentos.append(id_da_execucao)
            return super().cancelar(id_da_execucao)

    executor = ExecutorBloqueante()
    motor = Motor(banco.url, url_dbos, executor=executor)
    executor.motor = motor
    pool = ThreadPoolExecutor(max_workers=1)
    try:
        card = motor.criar_card(PLANO, f'vigia-{papel.lower()}')
        if papel == 'COORDENACAO':
            tarefa = lambda: motor.avancar(card)
        else:
            etapa = _ate_execucao(motor, card)
            if papel == 'AUTOR':
                tarefa = lambda: motor.executar_etapa(etapa['id'])
            else:
                motor.executar_etapa(etapa['id'])
                em_revisao = motor._linha('SELECT * FROM helena_v2.etapa WHERE id=%s', (etapa['id'],))
                tarefa = lambda: motor._revisar(em_revisao)
        futuro = pool.submit(tarefa)
        assert executor.iniciado.wait(10), 'executor não iniciou a chamada bloqueante'
        inicio = time.monotonic()
        motor._evento('card', card, 'FUNDADOR', 'CANCELAR', toque=f'cancelar-vigia-{papel}')
        with pytest.raises(RuntimeError, match='cancelada|antiga'):
            futuro.result(timeout=15)
        assert time.monotonic() - inicio < 15
        assert executor.cancelamentos
        assert motor._card(card)['estado'] == 'CANCELADO'
        with banco.conectar() as con:
            resposta = con.execute('SELECT count(*) AS n FROM helena_v2.resposta_execucao r '
                                   'JOIN helena_v2.execucao x ON x.numero=r.numero WHERE x.card_id=%s',
                                   (card,)).fetchone()[0]
            coordenacao = con.execute('SELECT count(*) AS n FROM helena_v2.resposta_coordenacao r '
                                      'JOIN helena_v2.execucao x ON x.numero=r.numero WHERE x.card_id=%s',
                                      (card,)).fetchone()[0]
        assert resposta == (1 if papel == 'REVISOR' else 0)
        assert coordenacao == (0 if papel == 'COORDENACAO' else 1)
    finally:
        pool.shutdown(wait=False, cancel_futures=True)
        motor.fechar()


@pytest.mark.parametrize('acao,estado', [
    ('PERGUNTAR', 'ESPERANDO_FUNDADOR'), ('REGISTRAR_FALHA', 'EM_RESOLUCAO')])
def test_acao_honesta_do_autor_nao_vira_entrega(banco, url_dbos, acao, estado):
    from executor_helena.executor_falso import ExecutorFalso, Roteiro
    if acao == 'PERGUNTAR':
        resposta = {'acao': 'PERGUNTAR', 'pergunta': 'Qual convite você quer enviar primeiro?',
                    'opcoes': [
                        {'letra': 'A', 'texto': 'Mensagem curta', 'consequencia': 'Cabe no aplicativo.'},
                        {'letra': 'B', 'texto': 'Mensagem longa', 'consequencia': 'Explica mais detalhes.'}]}
    else:
        resposta = {'acao': 'REGISTRAR_FALHA', 'motivo_falha': 'FALTAM_DADOS',
                    'explicacao': 'Falta o texto aprovado do convite para concluir a entrega.'}
    referencia = {}
    executor = ExecutorFalso(lambda execucao: Roteiro(
        texto=json.dumps(resposta, ensure_ascii=False) if execucao.ficha.papel == 'AUTOR'
        else referencia['motor']._texto_roteirizado(execucao)))
    motor = Motor(banco.url, url_dbos, executor=executor)
    referencia['motor'] = motor
    try:
        card = motor.criar_card(PLANO_COPY_AVULSO, f'acao-honesta-{acao.lower()}')
        etapa = _ate_execucao(motor, card)
        assert motor.executar_etapa(etapa['id']) == estado
        assert motor._linha('SELECT estado FROM helena_v2.etapa WHERE id=%s', (etapa['id'],))['estado'] == estado
        with banco.conectar() as con:
            entrega = con.execute('SELECT count(*) FROM helena_v2.entrega WHERE etapa_id=%s',
                                  (etapa['id'],)).fetchone()[0]
            historico = con.execute(
                "SELECT conteudo FROM helena_v2.historico WHERE alvo_id=%s AND papel='AUTOR' "
                'AND evento=%s ORDER BY id DESC LIMIT 1', (etapa['id'], acao)).fetchone()
        assert entrega == 0
        assert historico and historico[0]['resposta'] == resposta
        if acao == 'PERGUNTAR':
            motor._evento('etapa', etapa['id'], 'FUNDADOR', 'RESPONDER',
                          {'opcao': 'RESPOSTA_A'}, toque='responder-acao-honesta')
            depois = motor._linha('SELECT estado, execucao_atual FROM helena_v2.etapa WHERE id=%s',
                                  (etapa['id'],))
            # A máquina pode iniciar automaticamente a nova execução após a resposta.
            assert depois['estado'] in ('NA_FILA', 'EXECUTANDO')
            assert depois['execucao_atual'] != etapa['execucao_atual']
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
