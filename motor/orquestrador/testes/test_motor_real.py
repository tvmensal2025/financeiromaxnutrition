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
import orquestrador.motor as motor_mod
from orquestrador.contexto_real import montar_contexto_real
from orquestrador.preparacao import confirmar_preparacao, preparar_tarefa_real
from orquestrador.evidencias import EvidenciaInvalida
from executor_helena.executor_falso import ExecutorFalso
from executor_helena.executor import ExecutorHermes

RAIZ = Path(__file__).resolve().parents[3]


def _execucao_atual_no_duble(monkeypatch, motor):
    """Só os testes sem PostgreSQL simulam a posse da chave durante rodar()."""
    monkeypatch.setattr(motor, '_execucao_ainda_atual',
                        lambda _maquina, _alvo, _chave: True)


@pytest.mark.parametrize('falha_banco', [False, True])
def test_vigia_unitaria_recusa_chave_antiga_ou_banco_indisponivel(monkeypatch, falha_banco):
    motor = object.__new__(Motor)
    motor.executor = SimpleNamespace(rodar=lambda _execucao: SimpleNamespace(ok=True, texto='{}'),
                                     cancelar=lambda _id: True)

    def consultar(_maquina, _alvo, _chave):
        if falha_banco:
            raise psycopg.OperationalError('banco indisponível')
        return False

    monkeypatch.setattr(motor, '_execucao_ainda_atual', consultar)
    with pytest.raises((RuntimeError, psycopg.OperationalError),
                       match='cancelada|indisponível'):
        motor._rodar_vigiado(SimpleNamespace(id='E3-42'), 'etapa', uuid4(), 42)


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
                                           'prazo': None,
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
    card = {'titulo': 'Convite', 'ordem_de_servico': _ordem_real(),
            'prazo': datetime(2026, 10, 30, 12, tzinfo=timezone.utc),
            'criado_em': datetime(2026, 10, 13, 10, tzinfo=timezone.utc)}
    monkeypatch.setattr(motor, '_card', lambda _id: card)
    monkeypatch.setattr(motor, '_con', lambda: pytest.fail('E3 não deve ler entrega de E1'))
    pedido, fontes, decisoes = motor._entradas_da_etapa({'card_id': uuid4(), 'codigo': 'E3'}, 'SRV-COPY')
    assert pedido['entradas'] == {'condicoes': card['ordem_de_servico']['dados_reais']['entradas_externas']['condicoes']}
    assert 'FON-JOB-CONTA' not in fontes
    assert pedido['ordem_de_servico']['nao_pode'] == 'Prometer ganho'
    assert pedido['ordem_de_servico']['prazo'] == '2026-10-30T09:00:00-03:00'
    assert pedido['card_id'] and pedido['criado_em'] == '2026-10-13T07:00:00-03:00'
    assert pedido['plano']['etapas'][0]['acao_do_fundador'] == 'Aprovar convite'
    assert pedido['plano']['acoes_do_fundador'] == ['Aprovar convite']
    assert [d['id'] for d in decisoes] == ['DEC-024']
    assert 'captura' not in json.dumps(pedido)


def test_coordenacao_real_recebe_ordem_confirmada_sem_captura_ou_jobs():
    ordem = _ordem_real()
    ordem['dados_reais']['pedido']['ordem_de_servico']['prioridade_na_fonte'] = 'NORMAL'
    card = {'id': uuid4(), 'titulo': 'Convite real', 'ordem_de_servico': ordem,
            'prazo': datetime(2026, 10, 30, 12, tzinfo=timezone.utc),
            'criado_em': datetime(2026, 10, 13, 10, tzinfo=timezone.utc)}
    pedido = Motor._pedido_coordenacao_real(card)
    assert pedido['ordem_de_servico']['prazo'] == '2026-10-30T09:00:00-03:00'
    assert pedido['ordem_de_servico']['como_e_o_pronto'] == 'Entregas verificáveis'
    assert pedido['ordem_de_servico']['nao_pode'] == 'Prometer ganho'
    assert pedido['ordem_de_servico']['prioridade_na_fonte'] == 'NORMAL'
    assert pedido['pedido_original'] == 'Pedido do fundador'
    assert 'captura' not in json.dumps(pedido)
    assert 'FON-JOB-CONTA' not in json.dumps(pedido)


def test_parecer_recebe_somente_dependencias_aprovadas(monkeypatch):
    motor = object.__new__(Motor)
    card = {'titulo': 'Parecer', 'ordem_de_servico': _ordem_real(),
            'prazo': datetime(2026, 10, 30, 12, tzinfo=timezone.utc),
            'criado_em': datetime(2026, 10, 13, 10, tzinfo=timezone.utc)}
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
                                                    'ordem_de_servico': _ordem_real(),
                                                    'prazo': datetime(2026, 10, 30, 12,
                                                                       tzinfo=timezone.utc),
                                                    'criado_em': datetime(2026, 10, 13, 10,
                                                                           tzinfo=timezone.utc)})

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


def test_modo_producao_recusa_optins_e_executor_nao_aprovado_antes_de_conectar(monkeypatch):
    monkeypatch.setattr(motor_mod, '_preflight_bancos_reais',
                        lambda *_args: pytest.fail('não pode tentar conexão'))
    urls = ('postgresql://app@db.exemplo/postgres',
            'postgresql://dbos@db.exemplo/postgres')
    with pytest.raises(ValueError, match='proíbe opções'):
        Motor(*urls, executor=object.__new__(ExecutorHermes),
              fonte_contexto=montar_contexto_real, permitir_executor_falso=True,
              modo_producao=True, iniciar_dbos=False)
    with pytest.raises(ValueError, match='executor real aprovado'):
        Motor(*urls, executor=object(), fonte_contexto=montar_contexto_real,
              modo_producao=True, iniciar_dbos=False)


def test_modo_producao_recusa_executor_aprovado_que_perdeu_uma_garantia(monkeypatch):
    """Mesmo dentro da lista aprovada, o runtime precisa declarar TODAS as garantias que o motor exige."""
    import dataclasses
    monkeypatch.setattr(motor_mod, '_preflight_bancos_reais',
                        lambda *_args: pytest.fail('não pode tentar conexão'))

    class HermesSemGarantia(ExecutorHermes):
        capacidades = dataclasses.replace(ExecutorHermes.capacidades, sem_reserva_escondida=False, cancela_em_ate_s=60.0)

    monkeypatch.setattr(motor_mod, 'ADAPTADORES_REAIS_APROVADOS', (ExecutorHermes, HermesSemGarantia))
    urls = ('postgresql://app@db.exemplo/postgres', 'postgresql://dbos@db.exemplo/postgres')
    with pytest.raises(ValueError, match='garantias exigidas pelo motor: sem_reserva_escondida, cancela_em_ate_s'):
        Motor(*urls, executor=object.__new__(HermesSemGarantia), fonte_contexto=montar_contexto_real,
              modo_producao=True, iniciar_dbos=False)


def test_modo_producao_exige_preflight_antes_de_dbos_e_pina_config(monkeypatch):
    eventos = []
    config_destinos = {'system_database_url': 'postgresql://dbos@exemplo/postgres',
                       'dbos_system_schema': 'dbos_helena_v2', 'run_migrations': False}

    def preflight(*_args):
        eventos.append('preflight')
        return config_destinos

    class DBOSDeTeste:
        def __init__(self, config):
            assert eventos == ['preflight']
            assert config['dbos_system_schema'] == 'dbos_helena_v2'
            assert config['run_migrations'] is False
            assert config['enable_otlp'] is False
            assert config['application_version'] == motor_mod.VERSAO_CODIGO_REAL
            eventos.append('construtor_dbos')

        def launch(self):
            eventos.append('launch')

        def destroy(self):
            eventos.append('destroy')

    marcador = object()
    monkeypatch.setattr(motor_mod, '_MOTOR', marcador)
    monkeypatch.setattr(motor_mod, '_preflight_bancos_reais', preflight)
    monkeypatch.setattr(motor_mod, 'DBOS', DBOSDeTeste)
    motor = Motor('postgresql://app@exemplo/postgres', config_destinos['system_database_url'],
                  executor=object.__new__(ExecutorHermes),
                  fonte_contexto=montar_contexto_real, modo_producao=True)
    try:
        assert eventos == ['preflight', 'construtor_dbos', 'launch']
        assert motor_mod._MOTOR is motor
    finally:
        motor.fechar()
    assert eventos[-1] == 'destroy'
    assert motor_mod._MOTOR is None


def test_preflight_falha_sem_trocar_motor_global_nem_lancar_dbos(monkeypatch):
    marcador = object()
    monkeypatch.setattr(motor_mod, '_MOTOR', marcador)
    monkeypatch.setattr(motor_mod, '_preflight_bancos_reais',
                        lambda *_args: (_ for _ in ()).throw(ValueError('papel excessivo')))
    monkeypatch.setattr(motor_mod, 'DBOS', lambda **_kw: pytest.fail('DBOS não deve iniciar'))
    with pytest.raises(ValueError, match='papel excessivo'):
        Motor('postgresql://app@exemplo/postgres', 'postgresql://dbos@exemplo/postgres',
              executor=object.__new__(ExecutorHermes), fonte_contexto=montar_contexto_real,
              modo_producao=True)
    assert motor_mod._MOTOR is marcador


def test_preflight_real_confere_papeis_e_maquina_antes_de_iniciar_dbos(monkeypatch):
    eventos = []
    urls = ('postgresql://app@db.exemplo/postgres',
            'postgresql://sistema@db.exemplo/postgres')
    monkeypatch.setattr('orquestrador.bancos.validar_destinos_reais',
                        lambda app, sys: {'system_database_url': sys,
                                          'dbos_system_schema': 'dbos_helena_v2',
                                          'run_migrations': False})
    parametros = {'sslrootcert': '/ca/verificada.pem', 'connect_timeout': 10,
                  'options': '-c lock_timeout=5s -c statement_timeout=30s'}
    monkeypatch.setattr('orquestrador.bancos.parametros_conexao_real', lambda: parametros)
    monkeypatch.setattr('orquestrador.bancos.preflight_papel_runtime',
                        lambda con, *, sistema=False: eventos.append(('papel', con.nome, sistema)))
    monkeypatch.setattr(motor_mod, 'capturar_bundle', lambda _raiz: {'bundle': True})
    monkeypatch.setattr(motor_mod, 'impressao_maquina', lambda _bundle: 'IMPRESSAO-REAL')

    class Conexao:
        def __init__(self, nome):
            self.nome = nome

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def execute(self, comando):
            if self.nome == 'app' and 'SET ROLE' in str(comando):
                eventos.append(('set_role', self.nome))
            else:
                eventos.append(('maquina', self.nome))
            return self

        def fetchone(self):
            return {'confere': True, 'impressao': 'IMPRESSAO-REAL',
                    'ativa': {'estado': 'VALIDADA'}}

    def conectar(dsn, **kwargs):
        assert kwargs['sslrootcert'] == parametros['sslrootcert']
        assert kwargs['connect_timeout'] == parametros['connect_timeout']
        assert kwargs.get('options') == (parametros['options'] if dsn == urls[0] else None)
        return Conexao('app' if dsn == urls[0] else 'sistema')

    monkeypatch.setattr(motor_mod.psycopg, 'connect', conectar)
    assert motor_mod._preflight_bancos_reais(*urls)['run_migrations'] is False
    assert eventos == [('papel', 'app', False), ('set_role', 'app'), ('maquina', 'app'),
                       ('papel', 'sistema', True)]


def test_conexao_producao_aplica_ca_e_timeouts_em_cada_uso(monkeypatch):
    parametros = {'sslrootcert': '/ca/verificada.pem', 'connect_timeout': 10,
                  'options': '-c lock_timeout=5s -c statement_timeout=30s'}
    monkeypatch.setattr('orquestrador.bancos.parametros_conexao_real', lambda: parametros)
    chamadas = []

    class Conexao:
        def execute(self, comando):
            chamadas.append(str(comando))

    def conectar(dsn, **kwargs):
        chamadas.append((dsn, kwargs))
        return Conexao()

    monkeypatch.setattr(motor_mod.psycopg, 'connect', conectar)
    motor = object.__new__(Motor)
    motor.url_banco = 'postgresql+psycopg://app@db.exemplo/postgres'
    motor.modo_producao = True
    motor._con()
    assert chamadas[0][0] == 'postgresql://app@db.exemplo/postgres'
    assert all(chamadas[0][1][k] == v for k, v in parametros.items())
    assert 'SET ROLE' in chamadas[1]


def test_evento_automatico_real_confere_fontes_e_aplica_na_mesma_transacao(monkeypatch):
    motor = object.__new__(Motor)
    eventos = []
    card_id = uuid4()

    class Conexao:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        @contextmanager
        def transaction(self):
            eventos.append('inicia')
            yield
            eventos.append('commit')

        def execute(self, sql, _args):
            assert 'aplicar_evento' in sql
            eventos.append('aplica')
            return self

        def fetchone(self):
            return {'aplicar_evento': {'resultado': 'APLICADO'}}

    con = Conexao()
    monkeypatch.setattr(motor, '_con', lambda _papel: con)
    monkeypatch.setattr(motor, '_conferir_fontes_real',
                        lambda alvo, *, con: eventos.append(('confere', alvo, con)))
    motor._evento('card', card_id, 'MOTOR', 'PLANO_VALIDO', card_id_real=card_id)
    assert eventos == ['inicia', ('confere', card_id, con), 'aplica', 'commit']

    def fonte_velha(_alvo, *, con):
        eventos.append('fonte_velha')
        raise RuntimeError('fonte alterada')

    eventos.clear()
    monkeypatch.setattr(motor, '_conferir_fontes_real', fonte_velha)
    with pytest.raises(RuntimeError, match='fonte alterada'):
        motor._evento('card', card_id, 'MOTOR', 'PLANO_VALIDO', card_id_real=card_id)
    assert eventos == ['inicia', 'fonte_velha']


@pytest.mark.parametrize('falha_sql', [False, True])
def test_coordenacao_salva_antes_de_limpar_e_replay_nao_repete_hermes(monkeypatch, falha_sql):
    motor = object.__new__(Motor)
    _execucao_atual_no_duble(monkeypatch, motor)
    card_id = uuid4()
    revisao_id = uuid4()
    card = {'id': card_id, 'titulo': 'Convite', 'ordem_de_servico': _ordem_real(),
            'estado': 'RASCUNHO', 'chamada_helena': 55,
            'prazo': datetime(2026, 10, 30, 12, tzinfo=timezone.utc),
            'criado_em': datetime(2026, 10, 13, 10, tzinfo=timezone.utc)}
    eventos = []
    salvo = None

    class Executor:
        def rodar(self, execucao):
            assert execucao.id == 'C-55'
            assert execucao.fontes_permitidas == ()
            eventos.append('rodar')
            return SimpleNamespace(ok=True, texto='{"acao":"LER_DE_VOLTA"}')

        def limpar(self, _resultado):
            eventos.append('limpar')

    def linha(sql, args):
        nonlocal salvo
        if 'ler_resposta_coordenacao' in sql:
            return {'resposta': salvo}
        if 'registrar_resposta_coordenacao' in sql:
            eventos.append('registrar')
            if falha_sql:
                raise RuntimeError('queda antes do commit SQL')
            salvo = args[1].obj
            return {'resposta': salvo}
        raise AssertionError(sql)

    motor.executor = Executor()
    monkeypatch.setattr(motor, '_linha', linha)
    monkeypatch.setattr(motor, '_card', lambda _id: card)
    monkeypatch.setattr(motor, '_modo_card', lambda _id: 'real')
    monkeypatch.setattr(motor, '_ambiente_card', lambda _id: ({'id': revisao_id}, None, None))
    monkeypatch.setattr(motor, '_ficha', lambda *_args: object())
    monkeypatch.setattr(motor_mod, 'coletar_evidencias',
                        lambda _resultado, _id: {'paginas_lidas': [], 'usou_internet': False,
                                                 'conversa': [], 'uso': {}})
    if falha_sql:
        with pytest.raises(RuntimeError, match='queda antes do commit'):
            motor.executar_e_salvar_coordenacao(card_id, 55)
        assert eventos == ['rodar', 'registrar']
        return
    assert motor.executar_e_salvar_coordenacao(card_id, 55) == 55
    assert eventos == ['rodar', 'registrar', 'limpar']
    assert salvo['texto'] == '{"acao":"LER_DE_VOLTA"}'
    assert salvo['config_revision_id'] == str(revisao_id)
    assert motor.executar_e_salvar_coordenacao(card_id, 55) == 55
    assert eventos == ['rodar', 'registrar', 'limpar']


def test_coordenacao_aplica_resposta_salva_sob_guarda_fontes_na_mesma_transacao(monkeypatch):
    motor = object.__new__(Motor)
    card_id = uuid4()
    revisao_id = uuid4()
    eventos = []
    monkeypatch.setattr(motor, '_linha', lambda _sql, _args: {
        'resposta': {'texto': '{}', 'card_id': str(card_id),
                     'config_revision_id': str(revisao_id)}})
    monkeypatch.setattr(motor, '_card', lambda _id: {
        'estado': 'RASCUNHO', 'ordem_de_servico': {'modo_contexto': 'real'}})
    monkeypatch.setattr(motor, '_ambiente_card', lambda _id: ({'id': revisao_id}, None, None))

    class Conexao:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        @contextmanager
        def transaction(self):
            eventos.append('inicia')
            yield
            eventos.append('commit')

        def execute(self, sql, args):
            assert 'aplicar_resposta_coordenacao' in sql and args == (55,)
            eventos.append('aplica')
            return self

        def fetchone(self):
            return {'resultado': {'resultado': 'APLICADO', 'estado': 'ESPERANDO_CONFIRMACAO'}}

    con = Conexao()
    monkeypatch.setattr(motor, '_con', lambda: con)
    monkeypatch.setattr(motor, '_conferir_fontes_real',
                        lambda alvo, *, con: eventos.append(('confere', alvo, con)))
    assert motor.conferir_e_aplicar_coordenacao(card_id, 55) == 'ESPERANDO_CONFIRMACAO'
    assert eventos == ['inicia', ('confere', card_id, con), 'aplica', 'commit']


def test_falha_da_coordenadora_e_registrada_mesmo_se_fonte_mudar_durante_execucao(monkeypatch):
    motor = object.__new__(Motor)
    _execucao_atual_no_duble(monkeypatch, motor)
    card_id = uuid4()
    eventos = []
    motor.executor = SimpleNamespace(rodar=lambda _execucao: SimpleNamespace(ok=False, texto=None))
    monkeypatch.setattr(motor, '_linha', lambda _sql, _args: {'resposta': None})
    monkeypatch.setattr(motor, '_card', lambda _id: {
        'id': card_id, 'estado': 'RASCUNHO', 'chamada_helena': 55,
        'ordem_de_servico': {'modo_contexto': 'real'}})
    monkeypatch.setattr(motor, '_modo_card', lambda _id: 'real')
    monkeypatch.setattr(motor, '_ambiente_card', lambda _id: ({'id': uuid4()}, None, None))
    monkeypatch.setattr(motor, '_ficha', lambda *_args: object())
    monkeypatch.setattr(motor, '_pedido_coordenacao_real', lambda _card: {})
    monkeypatch.setattr(motor, '_evento',
                        lambda *_args, **kwargs: eventos.append(kwargs))
    with pytest.raises(RuntimeError, match='coordenadora falhou'):
        motor.executar_e_salvar_coordenacao(card_id, 55)
    assert eventos == [{}]


@pytest.mark.parametrize('servico', ['SRV-CALCULO', 'SRV-PARECER'])
def test_autor_real_sem_insumo_registra_falha_antes_de_chamar_hermes(monkeypatch, servico):
    motor = object.__new__(Motor)
    etapa = {'id': uuid4(), 'card_id': uuid4(), 'codigo': 'E1',
             'estado': 'EXECUTANDO', 'execucao_atual': 44, 'autor': 'CLARA'}
    eventos = []
    motor.executor = SimpleNamespace(rodar=lambda _execucao: pytest.fail('Hermes não pode ser chamado'))

    def linha(sql, _args):
        if 'FROM helena_v2.etapa' in sql:
            return etapa
        if 'ler_resposta_execucao' in sql:
            return {'resposta': None}
        raise AssertionError(sql)

    monkeypatch.setattr(motor, '_linha', linha)
    monkeypatch.setattr(motor, '_modo_card', lambda _id: 'real')
    monkeypatch.setattr(motor, '_ambiente_card', lambda _id: ({'id': uuid4()}, None, None))
    monkeypatch.setattr(motor, '_servico', lambda _etapa: servico)
    monkeypatch.setattr(motor, '_evento',
                        lambda *args, **kwargs: eventos.append((args, kwargs)))
    assert motor.executar_e_salvar(etapa['id'], 44) is None
    assert eventos[0][0][:4] == ('etapa', etapa['id'], 'AUTOR', 'REGISTRAR_FALHA')
    assert eventos[0][0][4] == {'motivo_falha': 'FALTAM_DADOS', 'usou_internet': 'NAO'}
    assert eventos[0][1]['conteudo']['motivo'] == 'INSUMOS_INSUFICIENTES'


@pytest.mark.parametrize('uso', ['invalid', None])
def test_coordenacao_registra_falha_de_evidencia_antes_de_repetir(monkeypatch, uso):
    motor = object.__new__(Motor)
    _execucao_atual_no_duble(monkeypatch, motor)
    card_id = uuid4()
    eventos = []
    motor.executor = SimpleNamespace(rodar=lambda _execucao: SimpleNamespace(ok=True, texto='{}'))
    monkeypatch.setattr(motor, '_linha', lambda _sql, _args: {'resposta': None})
    monkeypatch.setattr(motor, '_card', lambda _id: {
        'id': card_id, 'estado': 'RASCUNHO', 'chamada_helena': 55,
        'ordem_de_servico': {'modo_contexto': 'real'}})
    monkeypatch.setattr(motor, '_modo_card', lambda _id: 'real')
    monkeypatch.setattr(motor, '_ambiente_card', lambda _id: ({'id': uuid4()}, None, None))
    monkeypatch.setattr(motor, '_ficha', lambda *_args: object())
    monkeypatch.setattr(motor, '_pedido_coordenacao_real', lambda _card: {})
    monkeypatch.setattr(motor, '_evento',
                        lambda *_args, **kwargs: eventos.append(kwargs))
    def provas(_resultado, _execucao_id):
        if uso == 'invalid':
            raise EvidenciaInvalida('sem cópia')
        return {'usou_internet': None}
    monkeypatch.setattr(motor_mod, 'coletar_evidencias', provas)
    with pytest.raises(RuntimeError, match='evidência|ausência comprovada'):
        motor.executar_e_salvar_coordenacao(card_id, 55)
    assert eventos == [{'conteudo': {'motivo': 'EVIDENCIA_INVALIDA'
                                      if uso == 'invalid' else 'INTERNET_NAO_COMPROVADA'}}]


@pytest.mark.parametrize('falha_sql,falha_prova', [(False, False), (True, False),
                                                   (False, True)])
def test_resposta_real_guarda_provas_antes_de_limpar_e_replay_nao_roda_executor(
        monkeypatch, falha_sql, falha_prova):
    motor = object.__new__(Motor)
    _execucao_atual_no_duble(monkeypatch, motor)
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
    eventos = []
    monkeypatch.setattr(motor, '_evento', lambda *args, **kwargs: eventos.append((args, kwargs)))
    def coletar(_resultado, _id):
        if falha_prova:
            raise EvidenciaInvalida('registro inválido')
        return {'paginas_lidas': [{'leitura_id': 'LEI-001'}],
                'usou_internet': True, 'conversa': [{'papel': 'agente'}],
                'uso': {'usou_internet': True}}
    monkeypatch.setattr('orquestrador.motor.coletar_evidencias',
                        coletar)
    if falha_prova:
        with pytest.raises(RuntimeError, match='evidência do autor'):
            motor.executar_e_salvar(etapa['id'], 42)
        assert [nome for nome, _ in chamadas] == ['rodar']
        assert eventos[0][0][:4] == ('etapa', etapa['id'], 'MOTOR', 'FALHA')
        assert eventos[0][0][4] == {'classe': 'DESCONHECIDA'}
        return
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


@pytest.mark.parametrize('falha_prova', [False, True])
def test_revisor_real_recebe_entrega_contexto_e_rubrica_e_guarda_evidencias(monkeypatch, falha_prova):
    motor = object.__new__(Motor)
    _execucao_atual_no_duble(monkeypatch, motor)
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
    eventos = []
    monkeypatch.setattr(motor, '_evento', lambda *args, **kwargs: eventos.append((args, kwargs)))
    def coletar(_resultado, execucao_id):
        if falha_prova:
            raise EvidenciaInvalida('registro inválido')
        return {'paginas_lidas': [], 'usou_internet': False,
                'conversa': [{'execucao': execucao_id}], 'uso': {'usou_internet': False}}
    monkeypatch.setattr('orquestrador.motor.coletar_evidencias',
                        coletar)
    if falha_prova:
        with pytest.raises(RuntimeError, match='evidência do revisor'):
            motor.executar_e_salvar_revisao(etapa['id'], 43)
        assert gravado == []
        assert eventos[0][0][:4] == ('etapa', etapa['id'], 'MOTOR', 'FALHA')
        assert eventos[0][0][4] == {'classe': 'DESCONHECIDA'}
        return
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
        con.execute((RAIZ / 'supabase/migrations-v2/0009_confirmacao_real.sql').read_text())
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
        preparacao = preparar_tarefa_real(captura, plano)
        fonte_job = 'FON-JOB-JOB-REAL-01'
        prazo = datetime.now(timezone.utc) + timedelta(days=7)
        dados = confirmar_preparacao(
            preparacao, prazo.isoformat(),
            [{'id': 'CARD-1', 'texto': 'Não prometer remuneração sem acordo confirmado',
              'quem_confere': 'IA', 'risco': 'ALTO'}],
            ['Não prometer remuneração sem acordo confirmado'], [])['dados_reais']
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
        assert motor._modo_card(card_id) == 'real'
        assert motor._card(card_id)['ordem_de_servico']['config_revision_id'] == str(revisao['id'])
        etapa = motor._etapas(card_id)[0]
        pedido, fontes_etapa, decisoes_etapa = motor._entradas_da_etapa(etapa, 'SRV-COPY')
        assert set(fontes_etapa) == {'FON-PEDIDO-TASK-REAL-01', 'FON-PACOTE-BIZ-003', fonte_job}
        assert decisoes_etapa[0]['texto'] == 'Sem promessa de remuneração.'
        assert set(pedido['entradas']) == {'condicoes'}
        assert pedido['ordem_de_servico']['como_e_o_pronto'][0]['id'] == 'CARD-1'
        assert pedido['ordem_de_servico']['nao_pode'] == [
            'Não prometer remuneração sem acordo confirmado']
        assert datetime.fromisoformat(pedido['ordem_de_servico']['prazo']) == prazo
        assert pedido['ordem_de_servico']['prazo'].endswith('-03:00')
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
            motor._modo_card(card_id)
        with pytest.raises(psycopg.errors.SerializationFailure):
            motor.criar_card_real(
                plano, origem='supabase', chave_origem='TASK-REAL-01', titulo=tarefa['tarefa'],
                pedido_original=tarefa['tarefa'], business_id='BIZ-003', prazo=prazo,
                dados_reais=dados, solicitacao_id=pendente['id'])
        with banco.conectar('service_role') as con:
            assert con.execute(
                "select count(*) from helena_v2.card where ordem_de_servico->>'chave_origem'=%s",
                ('TASK-REAL-01',)).fetchone()[0] == 1
    finally:
        motor.fechar()
