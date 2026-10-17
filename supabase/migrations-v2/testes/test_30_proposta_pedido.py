"""Proposta tipada: snapshot, retomada de lease, autorização e confirmação explícita."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from psycopg import errors as E
from psycopg.types.json import Jsonb

import conftest as C
from integral import banco_integral
from test_12_configuracoes import bootstrap
from test_29_pedido_card_v2 import plano, roteiro


@pytest.fixture()
def ambiente(servidor):
    with banco_integral(servidor) as banco:
        _bundle, _digital, rev = bootstrap(banco)
        with banco.conectar('authenticated') as fundador:
            fundador.execute('select helena_v2.ativar_configuracao(%s,null)', (rev['id'],))
        with banco.conectar() as dono:
            dono.execute("""insert into public.checkpoint_mestre values
                ('CKP-PROPOSTA-TESTE',1,'ATIVO','Contexto sintético de teste',now(),now(),null)""")
        yield banco, rev['id']


def receber(banco, texto='Quanto entra com 10 pessoas a R$ 20 por hora?'):
    request_id = uuid4()
    with banco.conectar('authenticated') as fundador:
        fundador.execute('select helena_v2.receber_pedido_entrada(%s,%s,%s,%s)',
                         (request_id, 'SITE', 'site:' + str(request_id), texto))
    return request_id


def reservar(motor, request_id):
    return motor.execute('select helena_v2.reservar_proposta_pedido(%s,%s)',
                         (request_id, 120)).fetchone()[0]


def bruta(motor, request_id, claim):
    resposta = {'texto': 'Interpretação de teste',
                'config_revision_id': claim['config_revision_id'],
                'eventos_hash': claim['eventos_hash']}
    motor.execute('select helena_v2.registrar_resposta_bruta_pedido(%s,%s,%s)',
                  (request_id, claim['lease_token'], Jsonb(resposta)))
    return resposta


def perguntar():
    return {'tipo': 'PERGUNTAR', 'perguntas': ['Qual é o prazo?'],
            'resumo': 'Falta o prazo.', 'validacao_metadados': {'revisado': True}}


def propor(rev, *, bloqueio=None):
    prazo = datetime.now(timezone.utc) + timedelta(days=3)
    return {'tipo': 'PROPOR', 'perguntas': [], 'resumo': 'Calcular receita.',
            'empresa_id': 'BIZ-003', 'titulo': 'Conta de receita',
            'prazo': prazo.isoformat(), 'plano': plano(),
            'validacao_metadados': {'config_revision_id': str(rev), 'bloqueio': bloqueio}}


def registrar(motor, request_id, claim, resultado):
    bruta(motor, request_id, claim)
    return motor.execute('select helena_v2.registrar_proposta_pedido(%s,%s,%s)',
                         (request_id, claim['lease_token'], Jsonb(resultado))).fetchone()[0]


def test_pergunta_persistida_e_esclarecimento_invalida_versao(ambiente):
    banco, rev = ambiente
    request_id = receber(banco, 'Preciso de uma conta, mas ainda não sei o prazo.')
    with banco.conectar('service_role') as motor:
        assert any(i['request_id'] == str(request_id) for i in motor.execute(
            'select helena_v2.listar_trabalho_proposta_pedido()').fetchone()[0]['itens'])
        claim = reservar(motor, request_id)
        assert claim['config_revision_id'] == str(rev)
        pergunta = registrar(motor, request_id, claim, perguntar())
    with banco.conectar('authenticated') as fundador:
        lido = fundador.execute('select helena_v2.ler_proposta_pedido(%s)',
                                (request_id,)).fetchone()[0]
        assert lido['proposta_helena']['id'] == pergunta['id']
        assert lido['proposta_helena']['atual'] is True
        assert lido['perguntas'] == ['Qual é o prazo?']
        with pytest.raises(E.CheckViolation, match='PEDIDO_PROPOSTA_NAO_CONFIRMAVEL'):
            fundador.execute('select helena_v2.confirmar_proposta_pedido(%s,%s)',
                             (request_id, pergunta['id']))
        fundador.execute('select helena_v2.receber_pedido_entrada(%s,%s,%s,%s)',
                         (request_id, 'SITE', 'site:esclarecimento:' + str(uuid4()),
                          'Prazo: daqui a três dias.'))
        assert fundador.execute('select helena_v2.ler_proposta_pedido(%s)',
                                (request_id,)).fetchone()[0]['proposta_helena']['atual'] is False
    with banco.conectar('service_role') as motor:
        novo_claim = reservar(motor, request_id)
        assert novo_claim['eventos_hash'] != claim['eventos_hash']
        assert novo_claim['resposta_bruta'] is None
        bruta(motor, request_id, novo_claim)
        invalida = propor(rev)
        invalida['plano']['etapas'] = []
        with pytest.raises(E.InvalidParameterValue, match='PEDIDO_PROPOSTA_INVALIDA'):
            motor.execute('select helena_v2.registrar_proposta_pedido(%s,%s,%s)',
                          (request_id, novo_claim['lease_token'], Jsonb(invalida)))
        proposta = registrar(motor, request_id, novo_claim, propor(rev))
    with banco.conectar('authenticated') as fundador:
        assert fundador.execute('select helena_v2.ler_proposta_pedido(%s)',
                                (request_id,)).fetchone()[0]['proposta_helena']['id'] == proposta['id']
        confirmado = fundador.execute('select helena_v2.confirmar_proposta_pedido(%s,%s)',
                                      (request_id, proposta['id'])).fetchone()[0]
        assert confirmado['estado'] == 'PLANO_CONFIRMADO'
    with banco.conectar('service_role') as motor:
        assert len(motor.execute('select helena_v2.listar_planos_pedido_pendentes()')
                   .fetchone()[0]['itens']) == 1
        card = motor.execute('select helena_v2.consumir_plano_pedido(%s,%s)',
                             (confirmado['pedido_id'], Jsonb(roteiro()))).fetchone()[0]
        assert card['novo'] is True
    with banco.conectar() as dono:
        assert dono.execute('select count(*) from helena_v2.card').fetchone()[0] == 1
        assert dono.execute('select count(*) from public.tarefas').fetchone()[0] == 0
        assert dono.execute('select estado,pedido_grande from helena_v2.card where id=%s',
                            (card['card_id'],)).fetchone() == ('RASCUNHO', False)


def test_reserva_expirada_retry_bruto_e_versao_divergente(ambiente):
    banco, rev = ambiente
    request_id = receber(banco)
    with banco.conectar('service_role') as motor:
        claim = reservar(motor, request_id)
        raw = bruta(motor, request_id, claim)
    with banco.conectar() as dono:
        dono.execute('update helena_v2.pedido_entrada_reserva set expira_em=clock_timestamp()-interval \'1 second\'')
    with banco.conectar('service_role') as motor:
        with pytest.raises(E.SerializationFailure, match='PEDIDO_RESERVA_EXPIRADA'):
            motor.execute('select helena_v2.registrar_proposta_pedido(%s,%s,%s)',
                          (request_id, claim['lease_token'], Jsonb(propor(rev))))
        novo = reservar(motor, request_id)
        assert novo['lease_token'] != claim['lease_token'] and novo['resposta_bruta'] == raw
        bruta(motor, request_id, novo)
        with pytest.raises(E.UniqueViolation, match='PEDIDO_RESPOSTA_DIVERGENTE'):
            motor.execute('select helena_v2.registrar_resposta_bruta_pedido(%s,%s,%s)',
                          (request_id, novo['lease_token'], Jsonb({'texto': 'Mudou'})))
        resultado = propor(rev)
        proposta = motor.execute('select helena_v2.registrar_proposta_pedido(%s,%s,%s)',
                                 (request_id, novo['lease_token'], Jsonb(resultado))).fetchone()[0]
        assert proposta['tipo'] == 'PROPOR'
        assert motor.execute('select helena_v2.registrar_proposta_pedido(%s,%s,%s)',
                             (request_id, novo['lease_token'], Jsonb(resultado))).fetchone()[0]['id'] == proposta['id']
        with pytest.raises(E.UniqueViolation, match='PEDIDO_PROPOSTA_DIVERGENTE'):
            motor.execute('select helena_v2.registrar_proposta_pedido(%s,%s,%s)',
                          (request_id, novo['lease_token'], Jsonb({**resultado, 'titulo': 'Outro'})))
    with banco.conectar() as dono:
        assert dono.execute('select count(*) from helena_v2.pedido_entrada_resposta_bruta').fetchone()[0] == 1


def test_duas_reservas_concorrentes_e_papeis(ambiente):
    banco, rev = ambiente
    request_id = receber(banco)

    def tentar():
        with banco.conectar('service_role') as motor:
            return reservar(motor, request_id)

    with ThreadPoolExecutor(max_workers=2) as pool:
        claims = list(pool.map(lambda _: tentar(), range(2)))
    assert sum(x is not None for x in claims) == 1
    claim = next(x for x in claims if x is not None)
    with banco.conectar('anon') as anon:
        with pytest.raises(E.InsufficientPrivilege):
            anon.execute('select helena_v2.ler_proposta_pedido(%s)', (request_id,))
    with banco.conectar('authenticated') as fundador:
        with pytest.raises(E.InsufficientPrivilege):
            fundador.execute('select helena_v2.reservar_proposta_pedido(%s,%s)',
                             (request_id, 120))
        fundador.execute('select set_config(\'request.jwt.claim.sub\',%s,false)',
                         (C.OUTRA_PESSOA_TESTE,))
        with pytest.raises(E.InsufficientPrivilege):
            fundador.execute('select helena_v2.confirmar_proposta_pedido(%s,%s)',
                             (request_id, uuid4()))
    with banco.conectar('service_role') as motor:
        with pytest.raises(E.InsufficientPrivilege):
            motor.execute('select helena_v2.confirmar_proposta_pedido(%s,%s)',
                          (request_id, uuid4()))
        proposta = registrar(motor, request_id, claim, propor(rev, bloqueio='PEDIDO_FONTE_LEIS_AUSENTE'))
    with banco.conectar('authenticated') as fundador:
        with pytest.raises(E.CheckViolation, match='PEDIDO_PROPOSTA_NAO_CONFIRMAVEL'):
            fundador.execute('select helena_v2.confirmar_proposta_pedido(%s,%s)',
                             (request_id, proposta['id']))
    with banco.conectar() as dono:
        assert dono.execute('select count(*) from helena_v2.card').fetchone()[0] == 0


def test_config_e_eventos_adulterados_rejeitam_resultado(ambiente):
    banco, rev = ambiente
    request_id = receber(banco)
    with banco.conectar('service_role') as motor:
        claim = reservar(motor, request_id)
    with banco.conectar() as dono:
        dono.execute('alter table helena_v2.pedido_entrada_evento disable trigger pedido_evento_imutavel')
        try:
            dono.execute('update helena_v2.pedido_entrada_evento set texto=%s where pedido_id=%s',
                         ('Conteúdo alterado', claim['pedido_id']))
        finally:
            dono.execute('alter table helena_v2.pedido_entrada_evento enable trigger pedido_evento_imutavel')
    with banco.conectar('service_role') as motor:
        with pytest.raises(E.SerializationFailure, match='PEDIDO_PROPOSTA_OBSOLETA'):
            bruta(motor, request_id, claim)
    with banco.conectar() as dono:
        dono.execute('update helena_v2.configuracao_ponteiro set ativa_id=null where unico')
    with banco.conectar('service_role') as motor:
        with pytest.raises(E.CheckViolation, match='PEDIDO_CONFIG_NAO_VIGENTE'):
            reservar(motor, request_id)


def test_contexto_mudado_invalida_bruto_e_proposta(ambiente):
    banco, rev = ambiente
    request_id = receber(banco)
    with banco.conectar('service_role') as motor:
        claim = reservar(motor, request_id)
        bruta(motor, request_id, claim)
    with banco.conectar() as dono:
        dono.execute("""insert into public.decisoes values
            ('DEC-PROPOSTA-TESTE','Nova decisão material',1,'VIGENTE','BIZ-003')""")
    with banco.conectar('service_role') as motor:
        with pytest.raises(E.SerializationFailure, match='PEDIDO_PROPOSTA_OBSOLETA'):
            motor.execute('select helena_v2.registrar_proposta_pedido(%s,%s,%s)',
                          (request_id, claim['lease_token'], Jsonb(propor(rev))))
    with banco.conectar() as dono:
        dono.execute('update helena_v2.pedido_entrada_reserva set expira_em=clock_timestamp()-interval \'1 second\'')
    with banco.conectar('service_role') as motor:
        novo = reservar(motor, request_id)
        assert novo['contexto_hash'] != claim['contexto_hash']
        assert novo['resposta_bruta'] is None
        proposta = registrar(motor, request_id, novo, propor(rev))
    with banco.conectar() as dono:
        dono.execute("update public.decisoes set row_version=2 where decision_id='DEC-PROPOSTA-TESTE'")
    with banco.conectar('authenticated') as fundador:
        assert fundador.execute('select helena_v2.ler_proposta_pedido(%s)',
                                (request_id,)).fetchone()[0]['proposta_helena']['atual'] is False
        with pytest.raises(E.SerializationFailure, match='PEDIDO_PROPOSTA_OBSOLETA'):
            fundador.execute('select helena_v2.confirmar_proposta_pedido(%s,%s)',
                             (request_id, proposta['id']))


def test_checkpoint_ausente_ou_multiplo_falha_fechado(ambiente):
    banco, _rev = ambiente
    request_id = receber(banco)
    with banco.conectar() as dono:
        dono.execute('delete from public.checkpoint_mestre')
    with banco.conectar('service_role') as motor:
        with pytest.raises(E.CheckViolation, match='PEDIDO_CONTEXTO_INDISPONIVEL'):
            reservar(motor, request_id)
    with banco.conectar() as dono:
        dono.execute("""insert into public.checkpoint_mestre values
            ('CKP-A',1,'ATIVO','A',now(),now(),null),
            ('CKP-B',2,'ATIVO','B',now(),now(),null)""")
    with banco.conectar('service_role') as motor:
        with pytest.raises(E.CheckViolation, match='PEDIDO_CONTEXTO_INDISPONIVEL'):
            reservar(motor, request_id)
