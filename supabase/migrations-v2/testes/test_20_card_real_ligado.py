"""O QUE É: cards ligados herdam pedido real só com cadeia e fontes íntegras.

COMO MUDAR: inclua uma jornada legítima e uma adulteração do vínculo sempre
que a máquina ganhar outro modo de abrir card ligado.
"""
from pathlib import Path

import psycopg
import pytest

from test_13_pedidos_reais import banco_real
from test_15_aprovacao_fontes_reais import banco_aprovacao
from test_16_lista_acoes_fundador import banco_acoes
from test_15_aprovacao_fontes_reais import _card_pronto, _desatualizar
from test_17_reacoes_fundador import banco_reacoes, _versao, _tocar


SQL = Path(__file__).resolve().parents[1] / '0015_card_real_ligado.sql'


@pytest.fixture
def banco_ligado(banco_reacoes):
    banco, config_id = banco_reacoes
    with banco.conectar() as con:
        if SQL.exists():
            con.execute(SQL.read_text(encoding='utf-8'))
    return banco, config_id


def _filho(banco, config_id):
    pai = _card_pronto(banco, config_id)
    with banco.conectar(papel='authenticated') as con:
        resposta = _tocar(con, pai, 'PEDIR_AJUSTE', {'motivo_ajuste':'TOM'},
                          _versao(banco, pai), 'TOQUE-FILHO-REAL')
        assert resposta['resultado'] == 'REACAO'
    with banco.conectar() as con:
        filho = con.execute('select id from helena_v2.card where card_pai_id=%s',
                            (pai,)).fetchone()[0]
    return pai, filho


def _conferir(banco, card):
    with banco.conectar(papel='service_role') as con:
        return con.execute('select helena_v2.conferir_fontes_card_real(%s)',
                           (card,)).fetchone()[0]


def test_card_ligado_legitimo_herda_pedido_e_fontes(banco_ligado):
    banco, config_id = banco_ligado
    pai, filho = _filho(banco, config_id)
    assert _conferir(banco, pai) is True
    assert _conferir(banco, filho) is True


def test_card_ligado_recusa_fonte_alterada(banco_ligado):
    banco, config_id = banco_ligado
    _, filho = _filho(banco, config_id)
    _desatualizar(banco)
    with pytest.raises(psycopg.errors.SerializationFailure):
        _conferir(banco, filho)


@pytest.mark.parametrize('mudanca', ['pai','ordem','empresa','ciclo','origem','alvo_origem'])
def test_card_ligado_recusa_cadeia_alterada(banco_ligado, mudanca):
    banco, config_id = banco_ligado
    _, filho = _filho(banco, config_id)
    with banco.conectar(autocommit=False) as con:
        # Corrupção adversarial apenas no banco descartável: os gatilhos
        # normais já proíbem UPDATE direto, mas o leitor deve falhar fechado.
        con.execute("set local session_replication_role='replica'")
        if mudanca == 'pai':
            con.execute('update helena_v2.card set card_pai_id=null where id=%s', (filho,))
        elif mudanca == 'ciclo':
            con.execute('update helena_v2.card set card_pai_id=id where id=%s', (filho,))
        elif mudanca == 'ordem':
            con.execute("update helena_v2.card set ordem_de_servico=ordem_de_servico || '{\"_adulterado\":true}'::jsonb where id=%s", (filho,))
        elif mudanca == 'empresa':
            con.execute("update helena_v2.card set empresa='OUTRA' where id=%s", (filho,))
        elif mudanca == 'origem':
            con.execute("update helena_v2.historico set origem_id=null where card_id=%s and evento='CARD_CRIADO'", (filho,))
        else:
            con.execute("update helena_v2.historico set alvo_id='00000000-0000-0000-0000-000000000001'::uuid where id=(select origem_id from helena_v2.historico where card_id=%s and evento='CARD_CRIADO')", (filho,))
        con.execute("set local session_replication_role='origin'")
    with pytest.raises((psycopg.errors.InvalidParameterValue,
                        psycopg.errors.InsufficientPrivilege)):
        _conferir(banco, filho)
