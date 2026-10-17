"""O que é: A confirmação do fundador não atesta o plano; o validador do motor emite o evento explicitamente.
Como mudar: roda num banco local descartável com todas as migrations (conftest.py); nada toca em banco remoto.
"""

import pytest
from psycopg import errors as E
from psycopg.types.json import Jsonb

import ajudas as A
from integral import banco_integral


@pytest.fixture()
def integral(servidor):
    with banco_integral(servidor) as banco:
        yield banco


def test_confirmacao_espera_validador_e_motor_explicito_conserva_outros_automaticos(integral):
    with integral.conectar() as dono:
        mundo = A.Mundo(dono, {
            'id': 'validacao_explicitamente_pelo_motor',
            'card': {'pedido_grande': True},
            'automatico': False,
            'eventos': [],
        })
        card = mundo.card
        assert mundo.um('HELENA', 'LER_DE_VOLTA')['linha'] == 'C01'
        assert mundo.estado_da() == 'ESPERANDO_CONFIRMACAO'

    with integral.conectar('authenticated') as fundador:
        versao = fundador.execute('select versao from helena_v2.card where id=%s', (card,)).fetchone()[0]
        resposta = fundador.execute("""select helena_v2.aplicar_evento(
            'card', %s, 'FUNDADOR', 'RESPONDER', %s, p_versao_vista => %s,
            p_toque => 'confirmacao-teste', p_automaticos => true)""",
            (card, Jsonb({'opcao': 'CONFIRMO'}), versao)).fetchone()[0]
        assert resposta['linha'] == 'C06'
        assert fundador.execute('select estado from helena_v2.card where id=%s', (card,)).fetchone()[0] == 'VALIDANDO_PLANO'
        with pytest.raises(E.InsufficientPrivilege):
            fundador.execute("select helena_v2.aplicar_evento('card', %s, 'MOTOR', 'PLANO_VALIDO')", (card,))

    with integral.conectar() as dono:
        assert dono.execute("""select count(*) from helena_v2.historico
            where card_id=%s and evento='PLANO_VALIDO'""", (card,)).fetchone()[0] == 0

    # Neste ponto o motor chamaria validar_plano fora do banco. O teste exercita só a porta
    # explícita que ele usa após obter o resultado; o SQL não executa esse validador.
    with integral.conectar('service_role') as motor:
        aplicado = motor.execute("select helena_v2.aplicar_evento('card', %s, 'MOTOR', 'PLANO_VALIDO')", (card,)).fetchone()[0]
        assert aplicado['linha'] == 'C10'

    with integral.conectar() as dono:
        assert dono.execute('select estado from helena_v2.card where id=%s', (card,)).fetchone()[0] == 'EM_ANDAMENTO'
        eventos = dono.execute("""select evento,origem from helena_v2.historico
            where card_id=%s and evento in ('PLANO_VALIDO','DEPENDENCIAS_PRONTAS','INICIAR_EXECUCAO')
            order by id""", (card,)).fetchall()
        assert eventos.count(('PLANO_VALIDO', 'EXTERNO')) == 1
        assert ('PLANO_VALIDO', 'AUTOMATICO') not in eventos
        assert ('DEPENDENCIAS_PRONTAS', 'AUTOMATICO') in eventos
        assert ('INICIAR_EXECUCAO', 'AUTOMATICO') in eventos


def test_porta_interna_continua_fechada(integral):
    with integral.conectar() as dono:
        for papel in ('public', 'anon', 'authenticated', 'service_role'):
            assert dono.execute("select has_function_privilege(%s, 'helena_v2._cabe(text,uuid,text,text)', 'execute')",
                                (papel,)).fetchone()[0] is False
