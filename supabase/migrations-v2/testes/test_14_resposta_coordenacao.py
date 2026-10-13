"""Resposta durável da coordenadora: replay sem nova chamada nem evento duplicado."""
import copy
from pathlib import Path

import psycopg
import pytest
from psycopg.types.json import Jsonb

from test_13_pedidos_reais import DECISAO, banco_real, parametros, solicitar
import sorteio as S
import test_05_regras as R


SQL = Path(__file__).resolve().parents[1] / '0008_resposta_coordenacao.sql'


@pytest.fixture()
def pedido_card(banco_real):
    banco, config_id = banco_real
    with banco.conectar() as con:
        con.execute(SQL.read_text(encoding='utf-8'))
    with banco.conectar(papel='authenticated') as con:
        pedido = solicitar(con, parametros(banco, config_id))
    with banco.conectar(papel='service_role') as con:
        card = con.execute('select helena_v2.consumir_solicitacao_card_real(%s,%s)',
                           (pedido['id'], Jsonb(S.ROTEIRO_UMA_ETAPA))).fetchone()[0]
    return banco, str(config_id), card['card_id']


def resposta(card_id, config_id):
    return {'texto': '{"resumo":"Entendi a tarefa de teste."}',
            'evidencias': {'paginas_lidas': [], 'usou_internet': False,
                           'conversa': [], 'uso': {}},
            'config_revision_id': config_id, 'card_id': str(card_id)}


def test_retomada_reusa_chave_resposta_e_resultado_sem_evento_duplicado(pedido_card):
    banco, config_id, card_id = pedido_card
    with banco.conectar(papel='service_role') as con:
        chave = con.execute('select helena_v2.obter_chamada_coordenacao(%s)', (card_id,)).fetchone()[0]
        assert chave == con.execute('select helena_v2.obter_chamada_coordenacao(%s)', (card_id,)).fetchone()[0]
        assert con.execute('select helena_v2.ler_resposta_coordenacao(%s)', (chave,)).fetchone()[0] is None
        primeiro = con.execute('select helena_v2.registrar_resposta_coordenacao(%s,%s)',
                               (chave, Jsonb(resposta(card_id, config_id)))).fetchone()[0]
        assert primeiro == resposta(card_id, config_id)
    with banco.conectar(papel='service_role') as retomado:
        assert retomado.execute('select helena_v2.obter_chamada_coordenacao(%s)',
                                (card_id,)).fetchone()[0] == chave
        assert retomado.execute('select helena_v2.ler_resposta_coordenacao(%s)',
                                (chave,)).fetchone()[0] == primeiro
        aplicado = retomado.execute('select helena_v2.aplicar_resposta_coordenacao(%s)',
                                    (chave,)).fetchone()[0]
        assert aplicado['resultado'] == 'APLICADO'
    with banco.conectar(papel='service_role') as retomado:
        assert retomado.execute('select helena_v2.aplicar_resposta_coordenacao(%s)',
                                (chave,)).fetchone()[0] == aplicado
        assert retomado.execute("""select count(*) from helena_v2.historico
            where card_id=%s and evento='LER_DE_VOLTA' and chave=%s and resultado='APLICADO'""",
            (card_id, chave)).fetchone()[0] == 1
        assert retomado.execute('select estado from helena_v2.card where id=%s',
                                (card_id,)).fetchone()[0] == 'ESPERANDO_CONFIRMACAO'


def test_resposta_coordenacao_imutavel_e_conteudo_validado(pedido_card):
    banco, config_id, card_id = pedido_card
    with banco.conectar(papel='service_role') as con:
        chave = con.execute('select helena_v2.obter_chamada_coordenacao(%s)', (card_id,)).fetchone()[0]
        base = resposta(card_id, config_id)
        for alteracao in ({'texto': 'não é JSON'}, {'texto': '[]'},
                          {'card_id': '11111111-1111-4111-8111-111111111111'},
                          {'config_revision_id': '11111111-1111-4111-8111-111111111111'}):
            carga = {**base, **alteracao}
            with pytest.raises(psycopg.Error):
                con.execute('select helena_v2.registrar_resposta_coordenacao(%s,%s)',
                            (chave, Jsonb(carga)))
        con.execute('select helena_v2.registrar_resposta_coordenacao(%s,%s)', (chave, Jsonb(base)))
        assert con.execute('select helena_v2.registrar_resposta_coordenacao(%s,%s)',
                           (chave, Jsonb(copy.deepcopy(base)))).fetchone()[0] == base
        with pytest.raises(psycopg.Error, match='RESPOSTA_COORDENACAO_DIVERGENTE'):
            con.execute('select helena_v2.registrar_resposta_coordenacao(%s,%s)',
                        (chave, Jsonb({**base, 'texto': '{"resumo":"Outro"}'})))


def test_fundador_nao_manipula_chamada_resposta_ou_aplicacao(pedido_card):
    banco, config_id, card_id = pedido_card
    with banco.conectar(papel='service_role') as con:
        chave = con.execute('select helena_v2.obter_chamada_coordenacao(%s)', (card_id,)).fetchone()[0]
    with banco.conectar(papel='authenticated') as con:
        for sql, args in (
            ('select helena_v2.obter_chamada_coordenacao(%s)', (card_id,)),
            ('select helena_v2.ler_resposta_coordenacao(%s)', (chave,)),
            ('select helena_v2.registrar_resposta_coordenacao(%s,%s)',
             (chave, Jsonb(resposta(card_id, config_id)))),
            ('select helena_v2.aplicar_resposta_coordenacao(%s)', (chave,)),
            ("update helena_v2.resposta_coordenacao set resposta='{}' where numero=%s", (chave,)),
        ):
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                con.execute(sql, args)


def test_aplicar_exige_resposta_e_fonte_ainda_vigente(pedido_card):
    banco, config_id, card_id = pedido_card
    with banco.conectar(papel='service_role') as con:
        chave = con.execute('select helena_v2.obter_chamada_coordenacao(%s)', (card_id,)).fetchone()[0]
        with pytest.raises(psycopg.Error, match='RESPOSTA_COORDENACAO_AUSENTE'):
            con.execute('select helena_v2.aplicar_resposta_coordenacao(%s)', (chave,))
        con.execute('select helena_v2.registrar_resposta_coordenacao(%s,%s)',
                    (chave, Jsonb(resposta(card_id, config_id))))
    with banco.conectar() as admin:
        admin.execute('update public.decisoes set row_version=row_version+1 where decision_id=%s', (DECISAO,))
    with banco.conectar(papel='service_role') as con:
        with pytest.raises(psycopg.errors.SerializationFailure, match='DECISAO_REAL_MUDOU'):
            con.execute('select helena_v2.aplicar_resposta_coordenacao(%s)', (chave,))
        assert con.execute('select estado from helena_v2.card where id=%s',
                           (card_id,)).fetchone()[0] == 'RASCUNHO'
        assert con.execute('select helena_v2.ler_resposta_coordenacao(%s)',
                           (chave,)).fetchone()[0] == resposta(card_id, config_id)


def test_resposta_so_para_chamada_coordenacao_viva(pedido_card):
    banco, config_id, card_id = pedido_card
    with banco.conectar(papel='service_role') as con:
        chave = con.execute('select helena_v2.obter_chamada_coordenacao(%s)', (card_id,)).fetchone()[0]
        outra = con.execute("select helena_v2.abrir_chamada_helena('card',%s)", (card_id,)).fetchone()[0]
        assert outra != chave
        with pytest.raises(psycopg.errors.InsufficientPrivilege, match='CHAMADA_COORDENACAO_NAO_ATUAL'):
            con.execute('select helena_v2.registrar_resposta_coordenacao(%s,%s)',
                        (chave, Jsonb(resposta(card_id, config_id))))
        assert con.execute('select helena_v2.obter_chamada_coordenacao(%s)', (card_id,)).fetchone()[0] == outra


def test_evento_direto_real_exige_resposta_salva_e_wrapper_recupera(pedido_card):
    banco, config_id, card_id = pedido_card
    with banco.conectar(papel='service_role') as con:
        chave = con.execute('select helena_v2.obter_chamada_coordenacao(%s)', (card_id,)).fetchone()[0]
        carga = Jsonb({'resposta': {'resumo': 'Entendi a tarefa de teste.'}})
        sql = """select helena_v2.aplicar_evento('card',%s,'HELENA','LER_DE_VOLTA',
            '{}'::jsonb,null,%s,null,%s,null,true,array['PLANO_VALIDO']::text[])"""
        with pytest.raises(psycopg.errors.InsufficientPrivilege, match='RESPOSTA_COORDENACAO_AUSENTE'):
            con.execute(sql, (card_id, chave, carga))
        con.execute('select helena_v2.registrar_resposta_coordenacao(%s,%s)',
                    (chave, Jsonb(resposta(card_id, config_id))))
        with pytest.raises(psycopg.errors.InsufficientPrivilege, match='LER_DE_VOLTA_SEM_RESPOSTA_PERSISTIDA'):
            con.execute(sql, (card_id, chave, Jsonb({'resposta': {'resumo': 'Texto forjado'}})))
        aplicado = con.execute(sql, (card_id, chave, carga)).fetchone()[0]
        assert aplicado['resultado'] == 'APLICADO'
    with banco.conectar(papel='service_role') as retomado:
        assert retomado.execute('select helena_v2.aplicar_resposta_coordenacao(%s)',
                                (chave,)).fetchone()[0] == aplicado


def test_migracao_funciona_no_harness_sintetico_sem_0007(banco):
    with banco.conectar() as admin:
        admin.execute(SQL.read_text(encoding='utf-8'))
    with banco.conectar(papel='service_role') as con:
        m = R.novo(con)
        chave = con.execute('select helena_v2.obter_chamada_coordenacao(%s)', (m.card,)).fetchone()[0]
        assert chave == con.execute('select helena_v2.obter_chamada_coordenacao(%s)',
                                    (m.card,)).fetchone()[0]


def test_solicitacao_real_continua_identificada_se_modo_corrompido(pedido_card):
    banco, _config_id, card_id = pedido_card
    # Corrupção local por dono do esquema: o vínculo imutável da solicitação
    # continua sendo a prova de que o card pertence ao fluxo real.
    with banco.conectar() as admin:
        admin.execute("set session_replication_role='replica'")
        try:
            admin.execute("update helena_v2.card set ordem_de_servico=ordem_de_servico-'modo_contexto' where id=%s",
                          (card_id,))
        finally:
            admin.execute("set session_replication_role='origin'")
    with banco.conectar(papel='service_role') as con:
        with pytest.raises(psycopg.errors.InsufficientPrivilege, match='CARD_REAL_VINCULO_DIVERGENTE'):
            con.execute('select helena_v2.obter_chamada_coordenacao(%s)', (card_id,))


def test_leitura_real_recusa_destino_inesperado_da_tabela(pedido_card):
    banco, config_id, card_id = pedido_card
    with banco.conectar(papel='service_role') as con:
        chave = con.execute('select helena_v2.obter_chamada_coordenacao(%s)', (card_id,)).fetchone()[0]
        con.execute('select helena_v2.registrar_resposta_coordenacao(%s,%s)',
                    (chave, Jsonb(resposta(card_id, config_id))))
    with banco.conectar() as admin:
        admin.execute("set session_replication_role='replica'")
        try:
            admin.execute("update helena_v2.passagem set para='CANCELADO' where linha_id='C01'")
        finally:
            admin.execute("set session_replication_role='origin'")
    with banco.conectar(papel='service_role') as con:
        with pytest.raises(psycopg.Error, match='LER_DE_VOLTA_ESTADO_INESPERADO'):
            con.execute('select helena_v2.aplicar_resposta_coordenacao(%s)', (chave,))
        assert con.execute('select estado from helena_v2.card where id=%s',
                           (card_id,)).fetchone()[0] == 'RASCUNHO'
