"""Aprovações de card real revalidam fatos na própria transação do evento."""
from pathlib import Path

import psycopg
import pytest
from psycopg.types.json import Jsonb

from test_13_pedidos_reais import banco_real, solicitar, mundo_do_card_real, DECISAO
from test_14_confirmacao_real import _args_confirmados, _aplicar_confirmacao
import sorteio as S


SQL = Path(__file__).resolve().parents[1] / '0010_aprovacoes_fontes_reais.sql'


@pytest.fixture
def banco_aprovacao(banco_real):
    banco, config_id = banco_real
    with banco.conectar() as con:
        _aplicar_confirmacao(con)
        con.execute(SQL.read_text(encoding='utf-8'))
    return banco, config_id


def _card_pronto(banco, config_id, *, acao='NENHUMA'):
    args = _args_confirmados(banco, config_id)
    with banco.conectar(papel='authenticated') as con:
        pedido = solicitar(con, args)
    with banco.conectar(papel='service_role') as con:
        card = con.execute('select helena_v2.consumir_solicitacao_card_real(%s,%s)',
                           (pedido['id'], Jsonb(S.ROTEIRO_UMA_ETAPA))).fetchone()[0]['card_id']
        chamada = con.execute('select helena_v2.obter_chamada_coordenacao(%s)', (card,)).fetchone()[0]
        con.execute('select helena_v2.registrar_resposta_coordenacao(%s,%s)',
                    (chamada, Jsonb({'texto': '{}', 'evidencias': {},
                                     'config_revision_id': str(config_id), 'card_id': str(card)})))
        con.execute('select helena_v2.aplicar_resposta_coordenacao(%s)', (chamada,))
    with banco.conectar(papel='authenticated') as con:
        m = mundo_do_card_real(con, card, S.ROTEIRO_UMA_ETAPA)
        assert m.um('FUNDADOR', 'RESPONDER', params={'opcao': 'CONFIRMO'})['resultado'] == 'APLICADO'
    with banco.conectar(papel='service_role') as con:
        m = mundo_do_card_real(con, card, S.ROTEIRO_UMA_ETAPA)
        assert m.um('MOTOR', 'PLANO_VALIDO')['resultado'] == 'APLICADO'
        m.executando()
        assert m.entregar(acao=acao)['resultado'] == 'APLICADO'
        m.revisao()
        assert m.aprovar()['resultado'] == 'APLICADO'
        assert m.um('MOTOR', 'TODAS_PRONTAS')['resultado'] == 'APLICADO'
        assert m.estado_da() == 'PRONTO'
    return card


def _desatualizar(banco):
    with banco.conectar() as con:
        con.execute('update public.decisoes set row_version=row_version+1 where decision_id=%s',
                    (DECISAO,))


def test_fundador_nao_aprova_card_pronto_com_fonte_velha(banco_aprovacao):
    banco, config_id = banco_aprovacao
    card = _card_pronto(banco, config_id)
    _desatualizar(banco)
    with banco.conectar(papel='authenticated') as con:
        m = mundo_do_card_real(con, card, S.ROTEIRO_UMA_ETAPA)
        with pytest.raises(psycopg.errors.SerializationFailure):
            m.um('FUNDADOR', 'APROVAR')
    with banco.conectar() as con:
        assert con.execute("select count(*) from helena_v2.historico where card_id=%s and papel='FUNDADOR' and evento='APROVAR'", (card,)).fetchone()[0] == 0


def test_fundador_nao_autoriza_acao_externa_com_fonte_velha(banco_aprovacao):
    banco, config_id = banco_aprovacao
    card = _card_pronto(banco, config_id, acao='PELO_MOTOR')
    with banco.conectar() as con:
        acao, versao = con.execute('select id,versao from helena_v2.acao_externa where card_id=%s and estado=%s',
                                   (card, 'PROPOSTA')).fetchone()
    _desatualizar(banco)
    with banco.conectar(papel='authenticated') as con:
        with pytest.raises(psycopg.errors.SerializationFailure):
            con.execute("select helena_v2.aplicar_evento('acao_externa',%s,'FUNDADOR','APROVAR',%s,null,null,%s)",
                        (acao, Jsonb({}), versao))
    with banco.conectar() as con:
        assert con.execute('select estado from helena_v2.acao_externa where id=%s', (acao,)).fetchone()[0] == 'PROPOSTA'


def test_fundador_aprova_com_fonte_atual_e_pode_recusar_com_fonte_velha(banco_aprovacao):
    banco, config_id = banco_aprovacao
    card = _card_pronto(banco, config_id)
    with banco.conectar(papel='authenticated') as con:
        m = mundo_do_card_real(con, card, S.ROTEIRO_UMA_ETAPA)
        assert m.um('FUNDADOR', 'APROVAR')['resultado'] == 'REACAO'
    _desatualizar(banco)
    with banco.conectar(papel='authenticated') as con:
        m = mundo_do_card_real(con, card, S.ROTEIRO_UMA_ETAPA)
        assert m.um('FUNDADOR', 'PEDIR_AJUSTE')['resultado'] in ('REACAO', 'APLICADO')


def test_acao_externa_atual_autoriza_e_antiga_pode_ser_cancelada(banco_aprovacao):
    banco, config_id = banco_aprovacao
    card = _card_pronto(banco, config_id, acao='PELO_MOTOR')
    with banco.conectar() as con:
        acao, versao = con.execute('select id,versao from helena_v2.acao_externa where card_id=%s',
                                   (card,)).fetchone()
    with banco.conectar(papel='authenticated') as con:
        r = con.execute("select helena_v2.aplicar_evento('acao_externa',%s,'FUNDADOR','APROVAR',%s,null,null,%s)",
                        (acao, Jsonb({}), versao)).fetchone()[0]
        assert r['resultado'] == 'APLICADO' and r['estado'] == 'AUTORIZADA'


def test_acao_externa_pode_ser_recusada_com_fonte_antiga(banco_aprovacao):
    banco, config_id = banco_aprovacao
    card = _card_pronto(banco, config_id, acao='PELO_MOTOR')
    with banco.conectar() as con:
        acao, versao = con.execute('select id,versao from helena_v2.acao_externa where card_id=%s',
                                   (card,)).fetchone()
    _desatualizar(banco)
    with banco.conectar(papel='authenticated') as con:
        r = con.execute("select helena_v2.aplicar_evento('acao_externa',%s,'FUNDADOR','CANCELAR',%s,null,null,%s)",
                        (acao, Jsonb({}), versao)).fetchone()[0]
        assert r['resultado'] == 'APLICADO' and r['estado'] == 'RECUSADA'


def test_funcao_privada_sem_execucao_direta_do_fundador(banco_aprovacao):
    banco, _ = banco_aprovacao
    with banco.conectar(papel='authenticated') as con:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute('select helena_v2._real_proteger_aprovacao_fundador()')
