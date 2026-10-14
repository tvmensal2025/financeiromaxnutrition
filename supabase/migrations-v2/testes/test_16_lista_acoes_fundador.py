"""O QUE É: Leitura mínima de ações externas por fundador autenticado no banco local.
COMO MUDAR: atualize a migração correspondente e estas regressões juntas, preservando autorização, idempotência e fontes reais.
"""
from pathlib import Path

import psycopg
import pytest

import conftest as C
from test_13_pedidos_reais import banco_real
from test_15_aprovacao_fontes_reais import banco_aprovacao, _card_pronto


SQL = Path(__file__).resolve().parents[1] / '0011_lista_acoes_fundador.sql'


@pytest.fixture
def banco_acoes(banco_aprovacao):
    banco, config_id = banco_aprovacao
    with banco.conectar() as con:
        con.execute(SQL.read_text(encoding='utf-8'))
    return banco, config_id


def test_fundador_le_apenas_campos_minimos_da_acao(banco_acoes):
    banco, config_id = banco_acoes
    card = _card_pronto(banco, config_id, acao='PELO_MOTOR')
    with banco.conectar(papel='authenticated') as con:
        linhas = con.execute('select helena_v2.listar_acoes_card(%s)', (card,)).fetchone()[0]
        assert len(linhas) == 1
        assert set(linhas[0]) == {'id', 'codigo', 'etapa_codigo', 'tipo', 'estado',
                                 'dono', 'prazo_ate', 'versao', 'tem_ferramenta'}
        assert linhas[0]['codigo'] == 'A1'
        assert linhas[0]['tipo'] == 'PELO_MOTOR'
        assert linhas[0]['estado'] == 'PROPOSTA'
        assert linhas[0]['versao'] == 1
        assert linhas[0]['tem_ferramenta'] is True
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute('select * from helena_v2.acao_externa where card_id=%s', (card,))
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute('update helena_v2.acao_externa set tipo=tipo where card_id=%s', (card,))


def test_nao_fundador_e_anon_nao_leem_acao(banco_acoes):
    banco, config_id = banco_acoes
    card = _card_pronto(banco, config_id, acao='PELO_MOTOR')
    with banco.conectar(papel='authenticated') as con:
        con.execute("select set_config('request.jwt.claim.sub',%s,false)",
                    (C.OUTRA_PESSOA_TESTE,))
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute('select helena_v2.listar_acoes_card(%s)', (card,))
    for papel in ('anon', 'service_role'):
        with banco.conectar(papel=papel) as con:
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                con.execute('select helena_v2.listar_acoes_card(%s)', (card,))
