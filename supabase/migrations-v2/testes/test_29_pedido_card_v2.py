"""O que é: Pedido v2 confirmado: fonte nativa, autenticação, consumo único e guarda do card.
Como mudar: roda num banco local descartável com todas as migrations (conftest.py); nada toca em banco remoto.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from psycopg import errors as E
from psycopg.types.json import Jsonb

import conftest as C
from integral import banco_integral
from test_12_configuracoes import bootstrap
from test_13_pedidos_reais import solicitar
from test_14_confirmacao_real import _args_confirmados
import sorteio as S


@pytest.fixture()
def ambiente(servidor):
    with banco_integral(servidor) as banco:
        _bundle, _digital, rev = bootstrap(banco)
        with banco.conectar('authenticated') as fundador:
            fundador.execute('select helena_v2.ativar_configuracao(%s,null)', (rev['id'],))
        yield banco, rev['id']


@pytest.fixture(params=[None, 22], ids=['instalacao_limpa', 'upgrade_0022_para_0023'])
def ambiente_card_v1(servidor, request):
    with banco_integral(servidor, ate=request.param) as banco:
        _bundle, _digital, rev = bootstrap(banco)
        with banco.conectar('authenticated') as fundador:
            fundador.execute('select helena_v2.ativar_configuracao(%s,null)', (rev['id'],))
        yield banco, rev['id'], request.param == 22


def plano(servico='SRV-CALCULO'):
    return {'id': 'pedido-v2-local', 'empresas': ['BIZ-003'], 'decisoes': [],
            'entradas_externas': {}, 'orcamento_meta': {'execucoes': 4, 'chamadas_total': 200},
            'etapas': [{'id': 'E1', 'servico': servico, 'objetivo': 'Conta pedida',
                        'entradas': [], 'depende_de': []}]}


def receber_confirmar(banco, rev, request_id=None, *, servico='SRV-CALCULO'):
    request_id = request_id or uuid4()
    prazo = datetime.now(timezone.utc) + timedelta(days=3)
    with banco.conectar('authenticated') as fundador:
        recibo = fundador.execute('select helena_v2.receber_pedido_entrada(%s,%s,%s,%s)',
                                  (request_id, 'SITE', 'site:' + str(request_id),
                                   'Quanto entra com 10 pessoas a R$ 20 por hora?')).fetchone()[0]
        confirmado = fundador.execute('select helena_v2.confirmar_plano_pedido(%s,%s,%s,%s,%s,%s)',
                                      (request_id, 'BIZ-003', 'Conta de receita', prazo,
                                       Jsonb(plano(servico)), rev)).fetchone()[0]
    return recibo, confirmado, prazo


def roteiro(servico='SRV-CALCULO'):
    return {'etapas': [{'id': 'E1', 'servico': servico, 'autor': 'CAIO',
                        'revisores': ['HELENA', 'CLARA', 'FUNDADOR'],
                        'tempo_maximo_s': 120, 'prazo_revisao_s': 120}]}


def test_confirmacao_e_consumo_nativos_sem_tarefa_v1(ambiente):
    banco, rev = ambiente
    recebido, confirmado, prazo = receber_confirmar(banco, rev)
    assert recebido['estado'] == 'RECEBIDO'
    assert confirmado['estado'] == 'PLANO_CONFIRMADO'
    assert confirmado['empresa_id'] == 'BIZ-003'
    assert confirmado['card_id'] is None
    pedido_id = confirmado['pedido_id']
    with banco.conectar('service_role') as motor:
        p = motor.execute('select helena_v2.ler_plano_pedido(%s)', (pedido_id,)).fetchone()[0]
        assert p['dados_reais']['proveniencia']['pedido_id'] == pedido_id
        assert p['dados_reais']['fontes_importadas']['FON-PEDIDO-' + pedido_id].startswith('Quanto entra')
        assert p['dados_reais']['pedido']['pacote_da_empresa']['estado'] == 'CONFIRMADO'
        criado = motor.execute('select helena_v2.consumir_plano_pedido(%s,%s)',
                               (pedido_id, Jsonb(roteiro()))).fetchone()[0]
        assert criado['novo'] is True
        assert motor.execute('select helena_v2.conferir_fontes_card_real(%s)',
                             (criado['card_id'],)).fetchone()[0] is True
        assert motor.execute('select helena_v2.consumir_plano_pedido(%s,%s)',
                             (pedido_id, Jsonb(roteiro()))).fetchone()[0] == {
                                 'card_id': criado['card_id'], 'novo': False}
    with banco.conectar('authenticated') as fundador:
        resumo = fundador.execute('select helena_v2.ler_pedido_entrada(%s)',
                                  (confirmado['request_id'],)).fetchone()[0]
        assert resumo['estado'] == 'CARD_CRIADO' and resumo['card_id'] == criado['card_id']
    with banco.conectar() as dono:
        assert dono.execute('select count(*) from public.tarefas').fetchone()[0] == 0
        assert dono.execute('select count(*) from public.agent_jobs').fetchone()[0] == 0
        card = dono.execute('select empresa,prazo,ordem_de_servico from helena_v2.card where id=%s',
                            (criado['card_id'],)).fetchone()
        assert card[0] == 'BIZ-003' and card[1] == prazo
        assert card[2]['origem'] == 'pedido_entrada' and card[2]['modo_contexto'] == 'real'
        assert dono.execute('select count(*) from helena_v2.etapa where card_id=%s',
                            (criado['card_id'],)).fetchone()[0] == 1


def test_plano_divergente_sem_parecer_e_pacote_nao_confirmado(ambiente):
    banco, rev = ambiente
    recebido, confirmado, prazo = receber_confirmar(banco, rev)
    with banco.conectar('authenticated') as fundador:
        mesmos = fundador.execute('select helena_v2.confirmar_plano_pedido(%s,%s,%s,%s,%s,%s)',
                                  (recebido['request_id'], 'BIZ-003', 'Conta de receita', prazo,
                                   Jsonb(plano()), rev)).fetchone()[0]
        assert mesmos['pedido_id'] == confirmado['pedido_id']
        with pytest.raises(E.UniqueViolation, match='PEDIDO_PLANO_DIVERGENTE'):
            fundador.execute('select helena_v2.confirmar_plano_pedido(%s,%s,%s,%s,%s,%s)',
                             (recebido['request_id'], 'BIZ-003', 'Outro título', prazo,
                              Jsonb(plano()), rev))
        pedido_2 = uuid4()
        fundador.execute('select helena_v2.receber_pedido_entrada(%s,%s,%s,%s)',
                         (pedido_2, 'SITE', 'site:' + str(pedido_2), 'Faça um convite'))
        with pytest.raises(E.CheckViolation, match='PEDIDO_PACOTE_NAO_CONFIRMADO'):
            fundador.execute('select helena_v2.confirmar_plano_pedido(%s,%s,%s,%s,%s,%s)',
                             (pedido_2, 'BIZ-001', 'Convite', prazo,
                              Jsonb({**plano(), 'empresas': ['BIZ-001']}), rev))
        with pytest.raises(E.CheckViolation, match='PEDIDO_SERVICO_INDISPONIVEL'):
            fundador.execute('select helena_v2.confirmar_plano_pedido(%s,%s,%s,%s,%s,%s)',
                             (pedido_2, 'BIZ-003', 'Análise', prazo,
                              Jsonb(plano('SRV-ANALISE-ESTRATEGICA')), rev))
        with pytest.raises(E.CheckViolation, match='PEDIDO_PARECER_OBRIGATORIO'):
            fundador.execute('select helena_v2.confirmar_plano_pedido(%s,%s,%s,%s,%s,%s)',
                             (pedido_2, 'BIZ-003', 'Convite', prazo,
                              Jsonb(plano('SRV-COPY')), rev))
        com_parecer = plano('SRV-COPY')
        com_parecer['etapas'].append({'id': 'E2', 'servico': 'SRV-PARECER',
                                     'objetivo': 'Julgar convite', 'entradas': ['E1'],
                                     'depende_de': ['E1'], 'julga': ['E1']})
        with pytest.raises(E.CheckViolation, match='PEDIDO_FONTE_LEIS_AUSENTE'):
            fundador.execute('select helena_v2.confirmar_plano_pedido(%s,%s,%s,%s,%s,%s)',
                             (pedido_2, 'BIZ-003', 'Convite', prazo,
                              Jsonb(com_parecer), rev))


def test_autorizacao_e_eventos_congelados(ambiente):
    banco, rev = ambiente
    recebido, confirmado, _prazo = receber_confirmar(banco, rev)
    with banco.conectar('anon') as anon:
        with pytest.raises(E.InsufficientPrivilege):
            anon.execute('select helena_v2.confirmar_plano_pedido(null,null,null,null,null,null)')
    with banco.conectar('authenticated') as fundador:
        with pytest.raises(E.InsufficientPrivilege):
            fundador.execute('select * from helena_v2.pedido_entrada_plano')
    with banco.conectar('service_role') as motor:
        with pytest.raises(E.InsufficientPrivilege):
            motor.execute('select helena_v2.confirmar_plano_pedido(null,null,null,null,null,null)')
        p = motor.execute('select helena_v2.ler_plano_pedido(%s)',
                          (confirmado['pedido_id'],)).fetchone()[0]
        assert len(p['eventos']) == 1
    with banco.conectar() as dono:
        with pytest.raises(E.InsufficientPrivilege, match='PEDIDO_EVENTO_IMUTAVEL'):
            dono.execute('update helena_v2.pedido_entrada_evento set texto=%s where pedido_id=%s',
                         ('Outro texto', confirmado['pedido_id']))
    with banco.conectar('authenticated') as fundador:
        fundador.execute('select helena_v2.receber_pedido_entrada(%s,%s,%s,%s)',
                         (recebido['request_id'], 'SITE', 'site:continuacao', 'Prazo: sexta'))
    with banco.conectar('service_role') as motor:
        p = motor.execute('select helena_v2.ler_plano_pedido(%s)',
                          (confirmado['pedido_id'],)).fetchone()[0]
        assert len(p['eventos']) == 1
        assert motor.execute('select helena_v2.consumir_plano_pedido(%s,%s)',
                             (confirmado['pedido_id'], Jsonb(roteiro()))).fetchone()[0]['novo'] is True


def test_consumo_concorrente_cria_um_card(ambiente):
    banco, rev = ambiente
    _recebido, confirmado, _prazo = receber_confirmar(banco, rev)

    def consumir():
        with banco.conectar('service_role') as motor:
            return motor.execute('select helena_v2.consumir_plano_pedido(%s,%s)',
                                 (confirmado['pedido_id'], Jsonb(roteiro()))).fetchone()[0]

    with ThreadPoolExecutor(max_workers=2) as pool:
        resultados = list(pool.map(lambda _: consumir(), range(2)))
    assert resultados[0]['card_id'] == resultados[1]['card_id']
    assert sorted(r['novo'] for r in resultados) == [False, True]
    with banco.conectar() as dono:
        assert dono.execute('select count(*) from helena_v2.card').fetchone()[0] == 1
        assert dono.execute('select count(*) from helena_v2.mensagem where canal=%s',
                            ('pedido_entrada',)).fetchone()[0] == 1


def test_fonte_alterada_mesmo_por_dono_bloqueia_card(ambiente):
    banco, rev = ambiente
    _recebido, confirmado, _prazo = receber_confirmar(banco, rev)
    with banco.conectar() as dono:
        dono.execute('alter table helena_v2.pedido_entrada_evento disable trigger pedido_evento_imutavel')
        try:
            dono.execute('update helena_v2.pedido_entrada_evento set texto=%s where pedido_id=%s',
                         ('Conteúdo adulterado', confirmado['pedido_id']))
        finally:
            dono.execute('alter table helena_v2.pedido_entrada_evento enable trigger pedido_evento_imutavel')
    with banco.conectar('service_role') as motor:
        with pytest.raises(E.SerializationFailure, match='PEDIDO_FONTES_MUDARAM'):
            motor.execute('select helena_v2.consumir_plano_pedido(%s,%s)',
                          (confirmado['pedido_id'], Jsonb(roteiro())))
    with banco.conectar() as dono:
        assert dono.execute('select count(*) from helena_v2.card').fetchone()[0] == 0


def test_promocao_nativa_reconfere_fontes(ambiente):
    banco, rev = ambiente
    _recebido, confirmado, _prazo = receber_confirmar(banco, rev)
    with banco.conectar('service_role') as motor:
        card = motor.execute('select helena_v2.consumir_plano_pedido(%s,%s)',
                             (confirmado['pedido_id'], Jsonb(roteiro()))).fetchone()[0]['card_id']
    with banco.conectar() as dono:
        dono.execute('alter table helena_v2.pedido_entrada_evento disable trigger pedido_evento_imutavel')
        try:
            dono.execute('update helena_v2.pedido_entrada_evento set texto=%s where pedido_id=%s',
                         ('Conteúdo adulterado', confirmado['pedido_id']))
        finally:
            dono.execute('alter table helena_v2.pedido_entrada_evento enable trigger pedido_evento_imutavel')
        # Isola o trigger de fontes: a trava geral da máquina já recusa UPDATE direto.
        dono.execute('alter table helena_v2.card disable trigger a_so_pela_funcao')
        try:
            with pytest.raises(E.SerializationFailure, match='PEDIDO_FONTES_MUDARAM'):
                dono.execute("update helena_v2.card set estado='PRONTO' where id=%s", (card,))
        finally:
            dono.execute('alter table helena_v2.card enable trigger a_so_pela_funcao')
        assert dono.execute('select estado from helena_v2.card where id=%s', (card,)).fetchone()[0] != 'PRONTO'


def test_card_v1_existente_mantem_verificador_original_apos_0023(ambiente_card_v1):
    banco, rev, upgrade = ambiente_card_v1
    with banco.conectar() as dono:
        dono.execute("""insert into public.checkpoint_mestre values
            ('CKP-TESTE',1,'ATIVO','Teste local',now(),now(),null)""")
        dono.execute("""insert into public.portfolio values
            ('BIZ-TESTE','Empresa de Teste','TESTE','SIM','TESTE',4,%s)""",
            (Jsonb({'status': 'APPROVED', 'business_id': 'BIZ-TESTE',
                    'schema_version': 1, 'name': 'Marca de Teste'}),))
        dono.execute("""insert into public.tarefas values
            ('TASK-TESTE','BIZ-TESTE','Calcule o valor de teste.','NÃO INICIADA',
             'NORMAL',null,'Conta verificada',7,now(),now())""")
        dono.execute("""insert into public.tarefas values
            ('TASK-ORIGEM-TESTE','BIZ-TESTE','Documento de origem de teste.',
             'EM EXECUÇÃO','NORMAL',null,'Documento revisto',3,now(),now())""")
        dono.execute("""insert into public.decisoes values
            ('DEC-TESTE','Usar dados de teste.',2,'VIGENTE','BIZ-TESTE')""")
        dono.execute("""insert into public.agent_jobs values
            ('JOB-TESTE','TASK-ORIGEM-TESTE','BIZ-TESTE','AGT-01','COMPLETED',
             'APPROVED',%s,'Resultado de teste','["REF-TESTE"]',now())""",
            (Jsonb({'review_pending': False, 'reviewed_by': 'Revisor de teste',
                    'reviewer_agent_id': 'AGT-02',
                    'delivery': {'content': 'Documento de teste com evidência.'},
                    'quality_review': {'requirements_met': True,
                                       'inspected_evidence_refs': ['REF-TESTE']}}),))
    args = _args_confirmados(banco, rev)
    with banco.conectar('authenticated') as fundador:
        solicitacao = solicitar(fundador, args)
    with banco.conectar('service_role') as motor:
        criado = motor.execute('select helena_v2.consumir_solicitacao_card_real(%s,%s)',
                               (solicitacao['id'], Jsonb(S.ROTEIRO_UMA_ETAPA))).fetchone()[0]
        assert motor.execute('select helena_v2.conferir_fontes_card_real(%s)',
                             (criado['card_id'],)).fetchone()[0] is True
    if upgrade:
        with banco.conectar() as dono:
            dono.execute((C.MIGRACOES / '0023_pedido_card_v2.sql').read_text(encoding='utf-8'))
        with banco.conectar('service_role') as motor:
            assert motor.execute('select helena_v2.conferir_fontes_card_real(%s)',
                                 (criado['card_id'],)).fetchone()[0] is True
    with banco.conectar() as dono:
        assert dono.execute('select ordem_de_servico ->> %s from helena_v2.card where id=%s',
                            ('origem', criado['card_id'])).fetchone()[0] == 'supabase'
        dono.execute("update public.tarefas set row_version=8 where task_id='TASK-TESTE'")
    with banco.conectar('service_role') as motor:
        with pytest.raises(E.SerializationFailure, match='TAREFA_REAL_MUDOU'):
            motor.execute('select helena_v2.conferir_fontes_card_real(%s)', (criado['card_id'],))
