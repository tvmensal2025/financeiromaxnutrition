"""O que é: teste da resposta persistida antes de ENTREGAR e relida após queda.
Como mudar: acrescente casos de execução, revisor e repetição do pedido.
"""

import pytest
from psycopg.types.json import Jsonb

import test_05_regras as R


def test_resposta_imutavel_da_execucao_atual(banco, con):
    m = R.novo(con)
    m.em_andamento()
    m.executando()
    etapa = m.etapa_id('E1')
    numero = con.execute('select execucao_atual from helena_v2.etapa where id = %s', (etapa,)).fetchone()[0]
    with banco.conectar('service_role') as motor:
        primeira = motor.execute('select helena_v2.registrar_resposta_execucao(%s,%s)',
                                 (numero, Jsonb({'resposta': 'texto de teste'}))).fetchone()[0]
    with banco.conectar('service_role') as retomado:
        assert retomado.execute('select helena_v2.ler_resposta_execucao(%s)', (numero,)).fetchone()[0] == primeira
        assert retomado.execute('select helena_v2.registrar_resposta_execucao(%s,%s)',
                                (numero, Jsonb({'resposta': 'texto de teste'}))).fetchone()[0] == primeira
        with pytest.raises(Exception, match='RESPOSTA_JA_REGISTRADA'):
            retomado.execute('select helena_v2.registrar_resposta_execucao(%s,%s)',
                             (numero, Jsonb({'resposta': 'diferente'})))
    assert m.estado_da('E1') == 'EXECUTANDO'


def test_authenticated_nao_registra_resposta_do_motor(banco, con):
    m = R.novo(con)
    m.em_andamento()
    m.executando()
    numero = con.execute('select execucao_atual from helena_v2.etapa where id = %s', (m.etapa_id('E1'),)).fetchone()[0]
    with banco.conectar('authenticated') as pessoa:
        with pytest.raises(Exception):
            pessoa.execute('select helena_v2.registrar_resposta_execucao(%s,%s)',
                           (numero, Jsonb({'resposta': 'indevida'})))


def test_resposta_do_revisor_persiste_na_revisao(banco, con):
    m = R.novo(con)
    m.em_andamento()
    m.executando()
    m.entregar()
    m.revisao()
    etapa = m.etapa_id('E1')
    numero = con.execute('select execucao_atual from helena_v2.etapa where id = %s', (etapa,)).fetchone()[0]
    with banco.conectar('service_role') as motor:
        resposta = Jsonb({'criterios': [{'resultado': 'PASSOU'}]})
        esperado = motor.execute('select helena_v2.registrar_resposta_execucao(%s,%s)', (numero, resposta)).fetchone()[0]
        assert motor.execute('select helena_v2.ler_resposta_execucao(%s)', (numero,)).fetchone()[0] == esperado
    assert m.estado_da('E1') == 'REVISAO'
