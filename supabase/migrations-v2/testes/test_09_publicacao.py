"""O que é: teste do pedido por fundador ativo no dia de Brasília, sem publicar.
Como mudar: acrescente casos de identidade e concorrência à regra do pedido.
"""

import pytest
from psycopg import errors as E

from conftest import OUTRA_PESSOA_TESTE
import test_05_regras as R


def test_so_fundador_ativo_autenticado_pede_uma_vez_por_dia(banco, con):
    with banco.conectar('authenticated') as fundador:
        assert fundador.execute('select helena_v2.sou_fundador()').fetchone()[0] is True
        primeiro = fundador.execute('select helena_v2.pedir_publicacao()').fetchone()[0]
        assert primeiro['pedido']['id']
        assert primeiro['pedido']['dia_brasilia'] == primeiro['dia_brasilia']
        segundo = fundador.execute('select helena_v2.pedir_publicacao()').fetchone()[0]
        assert segundo['pedido']['id'] == primeiro['pedido']['id']
        assert segundo['ja_usado_hoje'] is True
        assert fundador.execute('select helena_v2.situacao_publicacao()').fetchone()[0]['pedido']['id'] == primeiro['pedido']['id']
    assert con.execute('select count(*) from helena_v2.publicacoes').fetchone()[0] == 1


def test_autenticado_sem_perfil_fundador_nao_ve_nem_pede(banco, con):
    with banco.conectar('authenticated') as outro:
        outro.execute("select set_config('request.jwt.claim.sub', %s, false)", (OUTRA_PESSOA_TESTE,))
        assert outro.execute('select helena_v2.sou_fundador()').fetchone()[0] is False
        estado = outro.execute('select helena_v2.situacao_publicacao()').fetchone()[0]
        assert estado['fundador'] is False and estado['pedido'] is None
        with pytest.raises(E.InsufficientPrivilege):
            outro.execute('select helena_v2.pedir_publicacao()')
        assert outro.execute('select count(*) from helena_v2.publicacoes').fetchone()[0] == 0


def test_service_role_nao_e_fundador_mesmo_com_uid_forjado(banco):
    with banco.conectar('service_role') as motor:
        motor.execute("select set_config('request.jwt.claim.sub', %s, false)", ('00000000-0000-4000-8000-000000000001',))
        with pytest.raises(E.InsufficientPrivilege):
            motor.execute('select helena_v2.pedir_publicacao()')


def test_papel_authenticated_sem_pessoa_fundadora_nao_aplica_toque(banco, con):
    m = R.novo(con)
    with banco.conectar('authenticated') as outro:
        outro.execute("select set_config('request.jwt.claim.sub', %s, false)", (OUTRA_PESSOA_TESTE,))
        with pytest.raises(E.InsufficientPrivilege, match='FUNDADOR_NAO_AUTORIZADO'):
            outro.execute("select helena_v2.aplicar_evento('card', %s, 'FUNDADOR', 'CANCELAR')", (m.card,))
    assert m.estado_da('card') == 'RASCUNHO'
