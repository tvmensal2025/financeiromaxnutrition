"""Contrato local do motor real: dados de outro serviço não entram no pacote."""
import json
import hashlib
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
import psycopg
from psycopg.types.json import Jsonb

from orquestrador.motor import Motor
from orquestrador.contexto_real import montar_contexto_real
from orquestrador.preparacao import preparar_tarefa_real
from executor_helena.executor_falso import ExecutorFalso

RAIZ = Path(__file__).resolve().parents[3]


def _ordem_real():
    tarefa = 'TSK-REAL-01'
    empresa = 'BIZ-003'
    fontes = {
        f'FON-PEDIDO-{tarefa}': 'pedido original',
        f'FON-PACOTE-{empresa}': 'pacote da empresa',
        'FON-JOB-COND': 'condições aprovadas',
        'FON-JOB-CONTA': 'valores usados no cálculo',
    }
    return {
        'modo_contexto': 'real', 'business_id': empresa, 'pedido_original': 'Pedido do fundador',
        'decisoes': ['DEC-024'],
        'acoes_do_fundador': [{'etapa': 'E3', 'acao_do_fundador': 'Aprovar convite'}],
        'etapas': [
            {'id': 'E1', 'servico': 'SRV-CALCULO', 'objetivo': 'Calcular',
             'entradas': ['conta'], 'depende_de': []},
            {'id': 'E2', 'servico': 'SRV-ROTEIRO-TREINAMENTO', 'objetivo': 'Treinar',
             'entradas': ['condicoes'], 'depende_de': []},
            {'id': 'E3', 'servico': 'SRV-COPY', 'objetivo': 'Convidar',
             'entradas': ['condicoes'], 'depende_de': []},
            {'id': 'E4', 'servico': 'SRV-PARECER', 'objetivo': 'Parecer',
             'entradas': ['E2', 'E3', 'condicoes'], 'depende_de': ['E2', 'E3']},
        ],
        'dados_reais': {
            'pedido': {'plano': {'id': 'PL-REAL', 'versao': 3,
                                'acoes_do_fundador': ['Aprovar convite']},
                       'ordem_de_servico': {'pedido_original': 'Pedido do fundador',
                                           'como_e_o_pronto': 'Entregas verificáveis',
                                           'nao_pode': 'Prometer ganho',
                                           'prazo': '2026-10-30T12:00:00Z',
                                           'fontes_que_pode_ler': []}},
            'fontes_importadas': fontes,
            'decisoes': [{'id': 'DEC-024', 'texto': 'Decisão vigente'},
                         {'id': 'DEC-FORA', 'texto': 'Não pertence ao plano'}],
            'proveniencia': {'tarefa_id': tarefa},
            'entradas_externas': {
                'conta': {'job_id': 'CONTA', 'fonte_ids': ['FON-JOB-CONTA'],
                          'conteudo': {'taxa': 'não comprovada'}},
                'condicoes': {'job_id': 'COND', 'fonte_ids': ['FON-JOB-COND'],
                              'conteudo': {'requisito': 'confirmado'}},
            },
            'captura': {'observado_em': '2026-10-13T10:00:00Z'},
        },
    }


def test_etapa_e3_recebe_somente_condicoes_sem_conta_ou_entrega_e1(monkeypatch):
    motor = object.__new__(Motor)
    card = {'titulo': 'Convite', 'ordem_de_servico': _ordem_real()}
    monkeypatch.setattr(motor, '_card', lambda _id: card)
    monkeypatch.setattr(motor, '_con', lambda: pytest.fail('E3 não deve ler entrega de E1'))
    pedido, fontes, decisoes = motor._entradas_da_etapa({'card_id': uuid4(), 'codigo': 'E3'}, 'SRV-COPY')
    assert pedido['entradas'] == {'condicoes': card['ordem_de_servico']['dados_reais']['entradas_externas']['condicoes']}
    assert 'FON-JOB-CONTA' not in fontes
    assert pedido['ordem_de_servico']['nao_pode'] == 'Prometer ganho'
    assert pedido['ordem_de_servico']['prazo'] == '2026-10-30T12:00:00Z'
    assert pedido['plano']['etapas'][0]['acao_do_fundador'] == 'Aprovar convite'
    assert pedido['plano']['acoes_do_fundador'] == ['Aprovar convite']
    assert [d['id'] for d in decisoes] == ['DEC-024']
    assert 'captura' not in json.dumps(pedido)


def test_parecer_recebe_somente_dependencias_aprovadas(monkeypatch):
    motor = object.__new__(Motor)
    card = {'titulo': 'Parecer', 'ordem_de_servico': _ordem_real()}
    monkeypatch.setattr(motor, '_card', lambda _id: card)
    consultas = []

    class Consulta:
        def execute(self, _sql, parametros):
            consultas.append(parametros[1])
            return self

        def fetchone(self):
            return {'conteudo': {'resposta': {'codigo': consultas[-1]}}}

    @contextmanager
    def conectar():
        yield Consulta()

    monkeypatch.setattr(motor, '_con', conectar)
    pedido, fontes, _ = motor._entradas_da_etapa({'card_id': uuid4(), 'codigo': 'E4'}, 'SRV-PARECER')
    assert set(consultas) == {'E2', 'E3'}
    assert set(pedido['entradas']) == {'E2', 'E3', 'condicoes'}
    assert pedido['entradas']['E2']['codigo'] == 'E2'
    assert 'FON-JOB-CONTA' not in fontes


def test_dependencia_sem_entrega_aprovada_bloqueia_contexto(monkeypatch):
    motor = object.__new__(Motor)
    monkeypatch.setattr(motor, '_card', lambda _id: {'titulo': 'Parecer',
                                                    'ordem_de_servico': _ordem_real()})

    class Consulta:
        def execute(self, _sql, _parametros):
            return self

        def fetchone(self):
            return None

    @contextmanager
    def conectar():
        yield Consulta()

    monkeypatch.setattr(motor, '_con', conectar)
    with pytest.raises(RuntimeError, match='entrega aprovada'):
        motor._entradas_da_etapa({'card_id': uuid4(), 'codigo': 'E4'}, 'SRV-PARECER')


def test_card_real_exige_solicitacao_antes_de_qualquer_sql():
    motor = object.__new__(Motor)
    motor.fonte_contexto = lambda *_args, **_kwargs: None
    motor.executor = object()
    with pytest.raises(ValueError, match='solicitação autenticada'):
        motor.criar_card_real({}, origem='supabase', chave_origem='TSK-1', titulo='Pedido',
                              pedido_original='Pedido', business_id='BIZ-003',
                              prazo=datetime.now(timezone.utc) + timedelta(days=1),
                              dados_reais={}, solicitacao_id='não-é-uuid')


def test_card_real_recusa_fonte_ausente_e_executor_falso():
    motor = object.__new__(Motor)
    motor.fonte_contexto = None
    motor.executor = object()
    with pytest.raises(RuntimeError, match='fonte de contexto'):
        motor.criar_card_real({}, origem='supabase', chave_origem='TSK-1', titulo='Pedido',
                              pedido_original='Pedido', business_id='BIZ-003', prazo=None,
                              dados_reais={}, solicitacao_id=str(uuid4()))
    motor.fonte_contexto = lambda *_args, **_kwargs: None
    motor.executor = ExecutorFalso(lambda _execucao: None)
    with pytest.raises(RuntimeError, match='sem ExecutorFalso'):
        motor.criar_card_real({}, origem='supabase', chave_origem='TSK-1', titulo='Pedido',
                              pedido_original='Pedido', business_id='BIZ-003', prazo=None,
                              dados_reais={}, solicitacao_id=str(uuid4()))


@pytest.mark.parametrize('falha_sql', [False, True])
def test_resposta_real_guarda_provas_antes_de_limpar_e_replay_nao_roda_executor(monkeypatch, falha_sql):
    motor = object.__new__(Motor)
    chamadas = []
    contexto_ids = []
    etapa = {'id': uuid4(), 'card_id': uuid4(), 'codigo': 'E3',
             'estado': 'EXECUTANDO', 'execucao_atual': 42, 'autor': 'CLARA'}
    pedido = {'ordem_de_servico': {'pedido_original': 'Pedido real',
                                  'fontes_que_pode_ler': ['https://exemplo.org/regras']},
              'plano': {'etapas': [{'id': 'E3', 'servico': 'SRV-COPY'}]}}
    fonte = {'FON-PEDIDO-TSK-01': 'Pedido real'}
    salvo = None

    class Executor:
        def rodar(self, execucao):
            chamadas.append(('rodar', execucao))
            return SimpleNamespace(ok=True, texto='{"acao":"ENTREGAR"}')

        def limpar(self, _resultado):
            chamadas.append(('limpar', None))

    def linha(sql, args=()):
        nonlocal salvo
        if 'FROM helena_v2.etapa' in sql:
            return etapa
        if 'ler_resposta_execucao' in sql:
            return {'resposta': salvo}
        if 'registrar_resposta_execucao' in sql:
            chamadas.append(('registrar', args[1].obj))
            if falha_sql:
                raise RuntimeError('queda antes do commit SQL')
            salvo = args[1].obj
            return {'resposta': salvo}
        raise AssertionError(sql)

    def contexto(_spec, _servico, **kwargs):
        contexto_ids.append(kwargs['execucao_id'])
        return {'pedido': kwargs['pedido'], 'modelo': {'tipo': 'convite'},
                'fontes_importadas': kwargs['fontes_importadas'],
                'decisoes_vigentes': kwargs['decisoes'],
                'paginas_lidas': kwargs['paginas_lidas'],
                'usou_internet': 'SIM' if kwargs['usou_internet'] else 'NAO'}

    motor.executor = Executor()
    motor.fonte_contexto = contexto
    monkeypatch.setattr(motor, '_linha', linha)
    monkeypatch.setattr(motor, '_modo_card', lambda _id: 'real')
    monkeypatch.setattr(motor, '_ambiente_card', lambda _id: ({'id': uuid4()}, object(), None))
    monkeypatch.setattr(motor, '_servico', lambda _etapa: 'SRV-COPY')
    monkeypatch.setattr(motor, '_ficha', lambda *_args: object())
    monkeypatch.setattr(motor, '_entradas_da_etapa', lambda *_args: (pedido, fonte, []))
    monkeypatch.setattr('orquestrador.motor.coletar_evidencias',
                        lambda _resultado, _id: {'paginas_lidas': [{'leitura_id': 'LEI-001'}],
                                                  'usou_internet': True,
                                                  'conversa': [{'papel': 'agente'}],
                                                  'uso': {'usou_internet': True}})
    if falha_sql:
        with pytest.raises(RuntimeError, match='queda antes do commit'):
            motor.executar_e_salvar(etapa['id'], 42)
        assert [nome for nome, _ in chamadas] == ['rodar', 'registrar']
    else:
        assert motor.executar_e_salvar(etapa['id'], 42) == 42
        assert [nome for nome, _ in chamadas] == ['rodar', 'registrar', 'limpar']
        assert chamadas[1][1]['contexto']['paginas_lidas'] == [{'leitura_id': 'LEI-001'}]
        assert chamadas[1][1]['conversa'] == [{'papel': 'agente'}]
        assert chamadas[0][1].fontes_permitidas == ('https://exemplo.org/regras',)
        assert contexto_ids == ['E3-42', 'E3-42']
        assert motor.executar_e_salvar(etapa['id'], 42) == 42
        assert [nome for nome, _ in chamadas] == ['rodar', 'registrar', 'limpar']


def test_revisor_real_recebe_entrega_contexto_e_rubrica_e_guarda_evidencias(monkeypatch):
    motor = object.__new__(Motor)
    etapa = {'id': uuid4(), 'card_id': uuid4(), 'codigo': 'E3', 'estado': 'REVISAO',
             'execucao_atual': 43, 'revisor': 'ISABELA'}
    revisao_id = str(uuid4())
    contexto_autor = {'pedido': {'ordem_de_servico': {'pedido_original': 'Pedido',
                                                    'fontes_que_pode_ler': []}},
                      'paginas_lidas': []}
    gravado = []

    class Spec:
        def tipo_do_servico(self, _servico):
            return 'CONVITE'

        def tipo(self, _tipo):
            return {'criterio_de_pronto': {'rubrica': ['CRIT-1']}}

    class Executor:
        def rodar(self, execucao):
            pacote = json.loads(execucao.pacote)
            assert execucao.fontes_permitidas == ()
            assert pacote['entrega'] == {'texto': 'Convite real'}
            assert pacote['contexto'] == contexto_autor
            assert pacote['rubrica'] == ['CRIT-1']
            return SimpleNamespace(ok=True, texto='{"criterios":[]}', falha=None)

        def limpar(self, _resultado):
            gravado.append('limpo')

    def linha(sql, args=()):
        if 'FROM helena_v2.etapa' in sql:
            return etapa
        if 'ler_resposta_execucao' in sql:
            return {'resposta': None if args[0] == 43 else
                    {'config_revision_id': revisao_id, 'contexto': contexto_autor}}
        if 'registrar_resposta_execucao' in sql:
            gravado.append(args[1].obj)
            return {'resposta': args[1].obj}
        raise AssertionError(sql)

    class Consulta:
        def execute(self, _sql, _args):
            return self

        def fetchone(self):
            return {'conteudo': {'resposta': {'texto': 'Convite real'}}, 'numero_execucao': 42}

    @contextmanager
    def conectar():
        yield Consulta()

    motor.executor = Executor()
    monkeypatch.setattr(motor, '_linha', linha)
    monkeypatch.setattr(motor, '_con', conectar)
    monkeypatch.setattr(motor, '_modo_card', lambda _id: 'real')
    monkeypatch.setattr(motor, '_ambiente_card', lambda _id: ({'id': revisao_id}, Spec(), None))
    monkeypatch.setattr(motor, '_servico', lambda _etapa: 'SRV-COPY')
    monkeypatch.setattr(motor, '_ficha', lambda *_args: object())
    monkeypatch.setattr('orquestrador.motor.coletar_evidencias',
                        lambda _resultado, execucao_id: {
                            'paginas_lidas': [], 'usou_internet': False,
                            'conversa': [{'execucao': execucao_id}], 'uso': {'usou_internet': False}})
    assert motor.executar_e_salvar_revisao(etapa['id'], 43) == 43
    assert gravado[0]['evidencias']['conversa'] == [{'execucao': 'E3-43'}]
    assert gravado[1] == 'limpo'


def test_solicitacao_fundador_cria_card_real_com_fontes_e_decisao_confirmadas(banco, url_dbos):
    """Prova local da porta 0007 com observação derivada de linhas do PostgreSQL."""
    with banco.conectar() as con:
        con.execute("""create table public.checkpoint_mestre (
            checkpoint_id text primary key, versao bigint, status text, resumo_executivo text,
            validado_em timestamptz, atualizado_em timestamptz, checkpoint_anterior_id text)""")
        con.execute("""create table public.checkpoint_mestre_atual (
            checkpoint_id text primary key, versao bigint, status text, resumo_executivo text,
            validado_em timestamptz, atualizado_em timestamptz, checkpoint_anterior_id text)""")
        con.execute("""create table public.portfolio (
            business_id text primary key, negocio text, estagio text, ativo text, publico text,
            row_version bigint, brand_identity jsonb)""")
        con.execute("""create table public.tarefas (
            task_id text primary key, business_id text, tarefa text, status text, prioridade text,
            prazo text, definicao_de_pronto text, row_version bigint, criado_em timestamptz,
            atualizado_em timestamptz)""")
        con.execute("""create table public.decisoes (
            decision_id text primary key, decisao text, row_version bigint, status text,
            business_id text)""")
        con.execute("""create table public.agent_jobs (
            job_id text primary key, task_id text, business_id text, agent_id text, status text,
            approval_status text, result_payload jsonb, result_summary text,
            evidence_refs jsonb, updated_at timestamptz)""")
        con.execute("""insert into public.checkpoint_mestre values
            ('CKP-REAL',1,'ATIVO','Observação local',now(),now(),null)""")
        con.execute('insert into public.checkpoint_mestre_atual select * from public.checkpoint_mestre')
        con.execute("""insert into public.portfolio values
            ('BIZ-003','Humano Digital','TESTE','SIM','TESTE',4,%s)""", (Jsonb({
                'status': 'APPROVED', 'business_id': 'BIZ-003',
                'schema_version': 1, 'name': 'Humano Digital'}),))
        con.execute("""insert into public.tarefas values
            ('TASK-REAL-01','BIZ-003','Convite confirmado pelo fundador.','NÃO INICIADA',
             'NORMAL',null,'Convite revisado',7,now(),now())""")
        con.execute("""insert into public.decisoes values
            ('DEC-024','Sem promessa de remuneração.',2,'VIGENTE','BIZ-003')""")
        con.execute("""insert into public.agent_jobs values
            ('JOB-REAL-01','TASK-REAL-01','BIZ-003','AGT-01','COMPLETED','APPROVED',
             %s,'Condições documentais','["REF-REAL"]',now())""", (Jsonb({
                 'review_pending': False, 'reviewed_by': 'Revisor local',
                 'reviewer_agent_id': 'AGT-02',
                 'delivery': {'content': 'Condição documental observada.'},
                 'quality_review': {'requirements_met': True,
                                    'inspected_evidence_refs': ['REF-REAL']}}),))
        con.execute((RAIZ / 'supabase/migrations-v2/0007_pedidos_reais.sql').read_text())
    motor = Motor(banco.url, url_dbos, executor=object(), fonte_contexto=montar_contexto_real,
                  permitir_configuracao_tecnica=True, iniciar_dbos=False)
    try:
        revisao = motor._configuracao_tecnica()
        ativa = motor._linha('select helena_v2.configuracao_ativa() as revisao')['revisao']
        with banco.conectar('authenticated') as con:
            con.execute('select helena_v2.ativar_configuracao(%s,%s)',
                        (revisao['id'], ativa['id'] if ativa else None))
        with banco.conectar() as con:
            checkpoint = con.execute('select to_jsonb(c) from public.checkpoint_mestre_atual c').fetchone()[0]
            tarefa = con.execute('select to_jsonb(t) from public.tarefas t').fetchone()[0]
            empresa = con.execute("""select jsonb_build_object('business_id',p.business_id,
                'negocio',p.negocio,'estagio',p.estagio,'ativo',p.ativo,'publico',p.publico,
                'portfolio_row_version',p.row_version,'brand_identity',p.brand_identity)
                from public.portfolio p""").fetchone()[0]
            decisao = con.execute('select to_jsonb(d) from public.decisoes d').fetchone()[0]
            job = con.execute('select to_jsonb(j) from public.agent_jobs j').fetchone()[0]
        plano = {'id': 'convite-real-local', 'nome': 'Convite real local', 'empresas': ['BIZ-003'],
                 'decisoes': ['DEC-024'], 'entradas_externas': {'condicoes': 'JOB-REAL-01'},
                 'orcamento_meta': {'execucoes': 4, 'chamadas_total': 200},
                 'etapas': [{'id': 'E1', 'servico': 'SRV-COPY', 'objetivo': 'Convite sem promessa',
                             'entradas': ['condicoes'], 'depende_de': []}]}
        captura = {'fonte': 'management_read_only',
                   'projeto': {'ref': 'wxkgrykduqtsgmjkzlou'},
                   'observado_em': '2026-10-13T19:00:00+00:00', 'checkpoint': checkpoint,
                   'business_id': 'BIZ-003', 'empresa': empresa, 'tarefa': tarefa,
                   'decisoes': [decisao], 'entradas_externas': {'condicoes': job}}
        canonico = lambda valor: json.dumps(valor, ensure_ascii=False, sort_keys=True,
                                            separators=(',', ':'), allow_nan=False)
        captura['proveniencia'] = {
            'tarefa': {'pk': 'TASK-REAL-01', 'row_version': 7},
            'empresa': {'pk': 'BIZ-003', 'row_version': 4},
            'hash_sha256': hashlib.sha256(canonico(captura).encode()).hexdigest()}
        dados = preparar_tarefa_real(captura, plano)['dados_reais']
        fonte_job = 'FON-JOB-JOB-REAL-01'
        prazo = datetime.now(timezone.utc) + timedelta(days=7)
        with banco.conectar('authenticated') as con:
            solicitacao = con.execute(
                'select helena_v2.solicitar_card_real(%s,%s,%s,%s,%s,%s)',
                ('TASK-REAL-01', prazo, Jsonb(plano), Jsonb(dados), revisao['id'],
                 'CHAVE-MOTOR-REAL-01')).fetchone()[0]
            pendente = con.execute(
                'select helena_v2.solicitar_card_real(%s,%s,%s,%s,%s,%s)',
                ('TASK-REAL-01', prazo, Jsonb(plano), Jsonb(dados), revisao['id'],
                 'CHAVE-MOTOR-REAL-02')).fetchone()[0]
        card_id = motor.criar_card_real(
            plano, origem='supabase', chave_origem='TASK-REAL-01', titulo=tarefa['tarefa'],
            pedido_original=tarefa['tarefa'], business_id='BIZ-003', prazo=prazo,
            dados_reais=dados, solicitacao_id=solicitacao['id'])
        assert motor._card(card_id)['ordem_de_servico']['config_revision_id'] == str(revisao['id'])
        etapa = motor._etapas(card_id)[0]
        pedido, fontes_etapa, decisoes_etapa = motor._entradas_da_etapa(etapa, 'SRV-COPY')
        assert set(fontes_etapa) == {'FON-PEDIDO-TASK-REAL-01', 'FON-PACOTE-BIZ-003', fonte_job}
        assert decisoes_etapa[0]['texto'] == 'Sem promessa de remuneração.'
        assert set(pedido['entradas']) == {'condicoes'}
        assert 'captura' not in canonico(pedido)
        contexto = montar_contexto_real(motor._ambiente_card(card_id)[1], 'SRV-COPY',
                                       pedido=pedido, fontes_importadas=fontes_etapa,
                                       decisoes=decisoes_etapa, execucao_id='E1-101')
        assert contexto['execucao_id'] == 'E1-101'
        assert motor.criar_card_real(
            plano, origem='supabase', chave_origem='TASK-REAL-01', titulo=tarefa['tarefa'],
            pedido_original=tarefa['tarefa'], business_id='BIZ-003', prazo=prazo,
            dados_reais=dados, solicitacao_id=solicitacao['id']) == card_id
        with banco.conectar() as con:
            con.execute("update public.tarefas set row_version=8 where task_id='TASK-REAL-01'")
        assert motor.criar_card_real(
            plano, origem='supabase', chave_origem='TASK-REAL-01', titulo=tarefa['tarefa'],
            pedido_original=tarefa['tarefa'], business_id='BIZ-003', prazo=prazo,
            dados_reais=dados, solicitacao_id=solicitacao['id']) == card_id
        with pytest.raises(psycopg.errors.SerializationFailure):
            motor.criar_card_real(
                plano, origem='supabase', chave_origem='TASK-REAL-01', titulo=tarefa['tarefa'],
                pedido_original=tarefa['tarefa'], business_id='BIZ-003', prazo=prazo,
                dados_reais=dados, solicitacao_id=pendente['id'])
        with banco.conectar('service_role') as con:
            assert con.execute('select count(*) from helena_v2.card').fetchone()[0] == 1
    finally:
        motor.fechar()
