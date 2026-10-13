"""Contrato SQL consumido pela tela, somente em bancos locais descartáveis."""
from concurrent.futures import ThreadPoolExecutor

import pytest

from conftest import OUTRA_PESSOA_TESTE
import test_05_regras as R


@pytest.fixture
def banco(fabrica):
    # A quota diária precisa nascer vazia em cada teste, sem apagar histórico.
    return fabrica({})


def test_colunas_da_tela_existem_e_outro_usuario_nao_le_cards(banco, con):
    mundo = R.novo(con)
    with banco.conectar('authenticated') as fundador:
        card = fundador.execute(
            'select id,titulo,empresa,estado,dono,prazo,criado_em '
            'from helena_v2.card where id=%s', (mundo.card,)
        ).fetchone()
        assert card is not None
        etapas = fundador.execute(
            'select id,codigo,nome,estado,autor,dono,prazo_ate,revisores,versao,portao1_ok,entrega_fresca '
            'from helena_v2.etapa where card_id=%s and atual order by ordem', (mundo.card,)
        ).fetchall()
        assert etapas
        assert fundador.execute(
            "select id,etapa_id,versao,portao1,conteudo,criada_em from helena_v2.entrega "
            "where card_id=%s and portao1='PASSOU' order by id", (mundo.card,)
        ).fetchall() == []
    with banco.conectar('authenticated') as outro:
        outro.execute("select set_config('request.jwt.claim.sub', %s, false)", (OUTRA_PESSOA_TESTE,))
        for tabela in ('card', 'etapa', 'entrega'):
            assert outro.execute(f'select count(*) from helena_v2.{tabela}').fetchone()[0] == 0


def test_pedidos_concorrentes_registram_um_unico_pedido(banco, con):
    def pedir(_):
        with banco.conectar('authenticated') as fundador:
            return fundador.execute('select helena_v2.pedir_publicacao()').fetchone()[0]

    with ThreadPoolExecutor(max_workers=8) as fila:
        pedidos = list(fila.map(pedir, range(8)))
    assert len({p['pedido']['id'] for p in pedidos}) == 1
    assert sum(not p['ja_usado_hoje'] for p in pedidos) == 1
    assert con.execute('select count(*) from helena_v2.publicacoes').fetchone()[0] == 1


def test_dia_do_pedido_usa_brasilia_independente_da_sessao(banco):
    with banco.conectar('authenticated') as fundador:
        fundador.execute("set time zone 'Pacific/Kiritimati'")
        pedido = fundador.execute('select helena_v2.pedir_publicacao()').fetchone()[0]
        dia = fundador.execute(
            "select (pedido_em at time zone 'America/Sao_Paulo')::date::text "
            'from helena_v2.publicacoes where id=%s', (pedido['pedido']['id'],)
        ).fetchone()[0]
        assert pedido['dia_brasilia'] == pedido['pedido']['dia_brasilia'] == dia
