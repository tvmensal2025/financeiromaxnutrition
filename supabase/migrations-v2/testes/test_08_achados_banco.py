"""O que é: regressões dos achados do ataque independente ao banco v2.
Como mudar: acrescente o caso mínimo que reproduz cada novo achado.
"""

import pytest
from psycopg import errors as E
from psycopg.types.json import Jsonb

import test_05_regras as R


def test_funcoes_tem_pg_temp_por_ultimo(banco, con):
    caminhos = con.execute("""select p.proname, p.proconfig from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'helena_v2'""").fetchall()
    assert caminhos
    assert all(any(x.replace(' ', '').endswith('pg_catalog,pg_temp')
                   for x in (config or []) if x.startswith('search_path='))
               for _, config in caminhos)


def test_abrir_chamada_e_ler_de_volta_com_service_role(banco, con):
    m = R.novo(con)
    with banco.conectar('service_role') as motor:
        chave = motor.execute('select helena_v2.abrir_chamada_helena(%s,%s)', ('card', m.card)).fetchone()[0]
        assert chave > 0
        resultado = motor.execute("select helena_v2.aplicar_evento(%s,%s,%s,%s,%s,%s,%s)",
                                  ('card', m.card, 'HELENA', 'LER_DE_VOLTA', '{}', None, chave)).fetchone()[0]
        assert resultado['resultado'] == 'APLICADO'


def test_vigia_e_leituras_funcionam_com_service_role(banco, con):
    m = R.novo(con)
    with banco.conectar('service_role') as motor:
        assert motor.execute('select count(*) from helena_v2.vigia() where card_id = %s', (m.card,)).fetchone()[0] == 0
        motor.execute('select helena_v2.conferir_card(%s)', (m.card,))
        assert motor.execute('select helena_v2.situacao_efetiva(e) from helena_v2.etapa e where card_id = %s limit 1',
                             (m.card,)).fetchone()[0]


@pytest.mark.parametrize('valor', ['infinity', '-infinity', '0001-01-01', 'banana', None, {}])
def test_prazo_invalido_nao_apaga_toque_do_fundador(banco, con, valor):
    m = R.novo(con)
    m.em_andamento()
    versao = m.versao_do_alvo('card', m.card)
    antes = con.execute('select count(*) from helena_v2.historico where card_id = %s', (m.card,)).fetchone()[0]
    with banco.conectar('authenticated') as fundador:
        resultado = fundador.execute('select helena_v2.aplicar_evento(%s,%s,%s,%s,%s,%s,%s,%s,%s)',
                                     ('card', m.card, 'FUNDADOR', 'MUDAR_PRAZO', Jsonb({}), None, None,
                                      versao, Jsonb({'prazo': valor}))).fetchone()[0]
        assert resultado['resultado'] == 'RECUSADO'
    assert con.execute('select count(*) from helena_v2.historico where card_id = %s', (m.card,)).fetchone()[0] == antes + 1


def test_prazo_de_espera_infinito_e_recusado(banco, con):
    m = R.novo(con)
    m.em_andamento()
    m.executando()
    etapa = m.etapa_id('E1')
    chave = con.execute('select execucao_atual from helena_v2.etapa where id = %s', (etapa,)).fetchone()[0]
    with banco.conectar('service_role') as motor:
        with pytest.raises(E.CheckViolation):
            motor.execute("select helena_v2.aplicar_evento('etapa', %s, 'AUTOR', 'PERGUNTAR', %s, %s, %s, "
                          "null, null, null, true, '{}'::text[], 'infinity'::timestamptz)",
                          (etapa, Jsonb({'usou_internet': 'NAO'}), 'CAIO', chave))


@pytest.mark.parametrize('valor', ['abc', 1.5, 99999999999])
def test_prioridade_malformada_nao_apaga_toque(banco, con, valor):
    m = R.novo(con)
    m.em_andamento()
    antes = con.execute('select count(*) from helena_v2.historico where card_id = %s', (m.card,)).fetchone()[0]
    with banco.conectar('authenticated') as fundador:
        resultado = fundador.execute('select helena_v2.aplicar_evento(%s,%s,%s,%s,%s,%s,%s,%s,%s)',
                                     ('card', m.card, 'FUNDADOR', 'MUDAR_PRIORIDADE', Jsonb({}), None, None,
                                      m.versao_do_alvo('card', m.card), Jsonb({'prioridade': valor}))).fetchone()[0]
        assert resultado['resultado'] == 'RECUSADO'
    assert con.execute('select count(*) from helena_v2.historico where card_id = %s', (m.card,)).fetchone()[0] == antes + 1
