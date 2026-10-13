"""Reações do fundador: versão e parâmetros conferidos antes de criar card ligado."""
from pathlib import Path

import psycopg
import pytest
from psycopg.types.json import Jsonb

from test_13_pedidos_reais import banco_real
from test_15_aprovacao_fontes_reais import banco_aprovacao, _card_pronto
from test_16_lista_acoes_fundador import banco_acoes


SQL = Path(__file__).resolve().parents[1] / '0012_reacoes_fundador.sql'


@pytest.fixture
def banco_reacoes(banco_acoes):
    banco, config_id = banco_acoes
    with banco.conectar() as con:
        con.execute(SQL.read_text(encoding='utf-8'))
    return banco, config_id


def _versao(banco, card):
    with banco.conectar() as con:
        return con.execute('select versao from helena_v2.card where id=%s', (card,)).fetchone()[0]


def _filhos(banco, card):
    with banco.conectar() as con:
        return con.execute('select count(*) from helena_v2.card where card_pai_id=%s', (card,)).fetchone()[0]


def _tocar(con, alvo, evento, parametros, versao, toque=None, *, maquina='card'):
    return con.execute('select helena_v2.aplicar_evento(%s,%s,%s,%s,%s,null,null,%s,null,%s)',
                       (maquina, alvo, 'FUNDADOR', evento, Jsonb(parametros), versao, toque)).fetchone()[0]


@pytest.mark.parametrize('evento,parametros', [
    ('APROVAR', {}), ('PEDIR_AJUSTE', {'motivo_ajuste': 'TOM'}),
    ('RESPONDER', {'opcao': 'REFAZER'}),
])
def test_reacao_card_final_recusa_versao_antiga(banco_reacoes, evento, parametros):
    banco, config_id = banco_reacoes
    card = _card_pronto(banco, config_id)
    versao = _versao(banco, card)
    with banco.conectar(papel='authenticated') as con:
        r = _tocar(con, card, evento, parametros, versao - 1)
        assert r['resultado'] == 'COMENTARIO_NO_CARD' and r['historico_id']
    assert _filhos(banco, card) == 0


@pytest.mark.parametrize('evento,parametros', [
    ('APROVAR', {'extra': 'x'}),
    ('PEDIR_AJUSTE', {}),
    ('PEDIR_AJUSTE', {'motivo_ajuste': 'INVENTADO'}),
    ('PEDIR_AJUSTE', {'motivo_ajuste': 'TOM', 'extra': 'x'}),
    ('RESPONDER', {}),
    ('RESPONDER', {'opcao': 'INVENTADA'}),
])
def test_reacao_card_final_recusa_parametros_invalidos(banco_reacoes, evento, parametros):
    banco, config_id = banco_reacoes
    card = _card_pronto(banco, config_id)
    with banco.conectar(papel='authenticated') as con:
        r = _tocar(con, card, evento, parametros, _versao(banco, card))
        assert r['resultado'] == 'COMENTARIO_NO_CARD' and r['historico_id']
    assert _filhos(banco, card) == 0


def test_ajuste_valido_e_replay_do_mesmo_toque(banco_reacoes):
    banco, config_id = banco_reacoes
    card = _card_pronto(banco, config_id)
    versao = _versao(banco, card)
    with banco.conectar(papel='authenticated') as con:
        resultado = _tocar(con, card, 'PEDIR_AJUSTE', {'motivo_ajuste': 'TOM'}, versao,
                           'TOQUE-REACAO-TESTE')
        assert resultado['resultado'] == 'REACAO'
        repetido = _tocar(con, card, 'PEDIR_AJUSTE', {}, versao - 1,
                          'TOQUE-REACAO-TESTE')
        assert repetido['resultado'] == 'REPETIDO'
        assert repetido['historico_id'] == resultado['historico_id']
    assert _filhos(banco, card) == 1


def test_resposta_em_etapa_final_exige_versao_e_dominio(banco_reacoes):
    banco, config_id = banco_reacoes
    card = _card_pronto(banco, config_id)
    with banco.conectar() as con:
        etapa, versao = con.execute('select id,versao from helena_v2.etapa where card_id=%s and atual',
                                    (card,)).fetchone()
    with banco.conectar(papel='authenticated') as con:
        for params, vista in (({'opcao': 'REFAZER'}, versao - 1), ({}, versao),
                              ({'opcao': 'INVENTADA'}, versao)):
            r = _tocar(con, etapa, 'RESPONDER', params, vista, maquina='etapa')
            assert r['resultado'] == 'COMENTARIO_NO_CARD'
    assert _filhos(banco, card) == 0
    with banco.conectar(papel='authenticated') as con:
        r = _tocar(con, etapa, 'RESPONDER', {'opcao': 'REFAZER'}, versao, maquina='etapa')
        assert r['resultado'] == 'CARD_NOVO_LIGADO'
    assert _filhos(banco, card) == 1


def test_conta_alheia_nao_registra_comentario_de_fundador(banco_reacoes):
    import conftest as C

    banco, config_id = banco_reacoes
    card = _card_pronto(banco, config_id)
    with banco.conectar(papel='authenticated') as con:
        con.execute("select set_config('request.jwt.claim.sub',%s,false)",
                    (C.OUTRA_PESSOA_TESTE,))
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            _tocar(con, card, 'PEDIR_AJUSTE', {}, _versao(banco, card) - 1)
    assert _filhos(banco, card) == 0


def test_acao_externa_continua_autorizavel_apos_wrapper(banco_reacoes):
    banco, config_id = banco_reacoes
    card = _card_pronto(banco, config_id, acao='PELO_MOTOR')
    with banco.conectar() as con:
        acao, versao = con.execute('select id,versao from helena_v2.acao_externa where card_id=%s',
                                   (card,)).fetchone()
    with banco.conectar(papel='authenticated') as con:
        assert _tocar(con, acao, 'APROVAR', {}, versao,
                      maquina='acao_externa')['resultado'] == 'APLICADO'


def test_cancelar_acao_externa_sem_versao_permanece_valido(banco_reacoes):
    banco, config_id = banco_reacoes
    card = _card_pronto(banco, config_id, acao='PELO_MOTOR')
    with banco.conectar() as con:
        acao = con.execute('select id from helena_v2.acao_externa where card_id=%s',
                           (card,)).fetchone()[0]
    with banco.conectar(papel='authenticated') as con:
        r = _tocar(con, acao, 'CANCELAR', {}, None, maquina='acao_externa')
        assert r['resultado'] == 'APLICADO' and r['estado'] == 'RECUSADA'
