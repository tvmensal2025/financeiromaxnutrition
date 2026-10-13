"""Projeções de toque próprio e pergunta corrente, sem histórico bruto."""
import json
from pathlib import Path

import psycopg
import pytest
from psycopg.types.json import Jsonb

import conftest as C
import sorteio as S
from test_13_pedidos_reais import banco_real, solicitar, mundo_do_card_real
from test_14_confirmacao_real import _args_confirmados
from test_15_aprovacao_fontes_reais import banco_aprovacao, _card_pronto
from test_16_lista_acoes_fundador import banco_acoes
from test_17_reacoes_fundador import banco_reacoes, _versao, _tocar


SQL = Path(__file__).resolve().parents[1] / '0013_interacoes_fundador.sql'


@pytest.fixture
def banco_interacoes(banco_reacoes):
    banco, config_id = banco_reacoes
    with banco.conectar() as con:
        if SQL.exists():
            con.execute(SQL.read_text(encoding='utf-8'))
    return banco, config_id


def test_consulta_toque_proprio_vincula_usuario_card_e_numero(banco_interacoes):
    banco, config_id = banco_interacoes
    card = _card_pronto(banco, config_id)
    with banco.conectar(papel='authenticated') as con:
        aplicado = _tocar(con, card, 'APROVAR', {}, _versao(banco, card),
                          'TOQUE-PROPRIO-TESTE')
        linha = con.execute('select helena_v2.consultar_toque_fundador(%s,%s)',
                            (card, 'TOQUE-PROPRIO-TESTE')).fetchone()[0]
        assert linha['historico_id'] == aplicado['historico_id']
        assert linha['resultado'] == 'REACAO'
        assert set(linha) == {'historico_id','resultado','momento','maquina','alvo_id','evento'}
        assert con.execute('select helena_v2.consultar_toque_fundador(%s,%s)',
                           ('00000000-0000-4000-8000-000000000099',
                            'TOQUE-PROPRIO-TESTE')).fetchone()[0] is None
    with banco.conectar() as con:
        con.execute("update public.app_access set role='founder' where user_id=%s",
                    (C.OUTRA_PESSOA_TESTE,))
    with banco.conectar(papel='authenticated') as con:
        con.execute("select set_config('request.jwt.claim.sub',%s,false)",
                    (C.OUTRA_PESSOA_TESTE,))
        assert con.execute('select helena_v2.consultar_toque_fundador(%s,%s)',
                           (card, 'TOQUE-PROPRIO-TESTE')).fetchone()[0] is None


def test_consulta_toque_recusa_outros_papeis_sem_historico_bruto(banco_interacoes):
    banco, _ = banco_interacoes
    for papel in ('anon','service_role'):
        with banco.conectar(papel=papel) as con:
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                con.execute('select helena_v2.consultar_toque_fundador(%s,%s)',
                            ('00000000-0000-4000-8000-000000000099','T'))


def test_consulta_toque_recusa_fundador_desativado(banco_interacoes):
    banco, config_id = banco_interacoes
    card = _card_pronto(banco, config_id)
    with banco.conectar(papel='authenticated') as con:
        _tocar(con, card, 'APROVAR', {}, _versao(banco, card), 'TOQUE-DESATIVADO')
    with banco.conectar() as con:
        con.execute('update public.app_access set active=false where user_id=%s',
                    (C.FUNDADOR_TESTE,))
    with banco.conectar(papel='authenticated') as con:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute('select helena_v2.consultar_toque_fundador(%s,%s)',
                        (card, 'TOQUE-DESATIVADO'))


def _etapa_com_pergunta(banco, config_id, resposta, *, registrar=True):
    args = _args_confirmados(banco, config_id)
    with banco.conectar(papel='authenticated') as con:
        pedido = solicitar(con, args)
    with banco.conectar(papel='service_role') as con:
        card = con.execute('select helena_v2.consumir_solicitacao_card_real(%s,%s)',
                           (pedido['id'], Jsonb(S.ROTEIRO_UMA_ETAPA))).fetchone()[0]['card_id']
        chamada = con.execute('select helena_v2.obter_chamada_coordenacao(%s)', (card,)).fetchone()[0]
        con.execute('select helena_v2.registrar_resposta_coordenacao(%s,%s)',
                    (chamada, Jsonb({'texto':'{}','evidencias':{},
                                     'config_revision_id':str(config_id),'card_id':str(card)})))
        con.execute('select helena_v2.aplicar_resposta_coordenacao(%s)', (chamada,))
    with banco.conectar(papel='authenticated') as con:
        assert mundo_do_card_real(con, card, S.ROTEIRO_UMA_ETAPA).um(
            'FUNDADOR','RESPONDER',params={'opcao':'CONFIRMO'})['resultado'] == 'APLICADO'
    with banco.conectar(papel='service_role') as con:
        m = mundo_do_card_real(con, card, S.ROTEIRO_UMA_ETAPA)
        m.um('MOTOR','PLANO_VALIDO')
        m.executando()
        etapa, chave, autor = con.execute(
            'select id,execucao_atual,autor from helena_v2.etapa where card_id=%s and atual',
            (card,)).fetchone()
        if registrar and resposta is not None:
            con.execute('select helena_v2.registrar_resposta_execucao(%s,%s)',
                        (chave,Jsonb({'texto':json.dumps(resposta,ensure_ascii=False),
                                     'servico':'SRV-CALCULO','contexto':{},
                                     'config_revision_id':str(config_id)})))
        r = con.execute("select helena_v2.aplicar_evento('etapa',%s,'AUTOR','PERGUNTAR',%s,%s,%s,null,%s)",
                        (etapa,Jsonb({'usou_internet':'NAO'}),autor,chave,
                         Jsonb({'resposta':resposta}) if resposta is not None else None)).fetchone()[0]
        assert r['resultado'] == 'APLICADO'
    return card, etapa, chave


def test_pergunta_atual_mostra_apenas_texto_opcoes_e_proveniencia(banco_interacoes):
    banco, config_id = banco_interacoes
    resposta = {'acao':'PERGUNTAR','pergunta':'Qual período você prefere para esta conta?',
                'opcoes':[{'letra':'A','texto':'Semana','consequencia':'Usar dados semanais'},
                          {'letra':'B','texto':'Mês','consequencia':'Converter para mês'}],
                'secreto_interno':'não expor'}
    card, etapa, chave = _etapa_com_pergunta(banco, config_id, resposta)
    with banco.conectar(papel='authenticated') as con:
        linha = con.execute('select helena_v2.ler_pergunta_etapa_fundador(%s)', (etapa,)).fetchone()[0]
        assert linha['card_id'] == str(card) and linha['etapa_id'] == str(etapa)
        assert linha['chave'] == chave and linha['pergunta'] == resposta['pergunta']
        assert linha['opcoes'] == resposta['opcoes']
        assert set(linha) == {'card_id','etapa_id','versao','chave','historico_id',
                              'pergunta','opcoes'}
        versao = linha['versao']
        r = _tocar(con, etapa, 'RESPONDER', {'opcao':'RESPOSTA_A'}, versao,
                   maquina='etapa')
        assert r['resultado'] == 'APLICADO'
        assert con.execute('select helena_v2.ler_pergunta_etapa_fundador(%s)',
                           (etapa,)).fetchone()[0] is None


def test_pergunta_sem_conteudo_comprovado_nao_oferece_opcoes(banco_interacoes):
    banco, config_id = banco_interacoes
    _, etapa, _ = _etapa_com_pergunta(banco, config_id, None)
    with banco.conectar(papel='authenticated') as con:
        assert con.execute('select helena_v2.ler_pergunta_etapa_fundador(%s)',
                           (etapa,)).fetchone()[0] is None


def test_pergunta_sem_resposta_duravel_nao_e_apresentada(banco_interacoes):
    banco, config_id = banco_interacoes
    resposta = {'acao':'PERGUNTAR','pergunta':'Qual período deve orientar o cálculo?',
                'opcoes':[{'letra':'A','texto':'Semana','consequencia':'Usar semana'},
                          {'letra':'B','texto':'Mês','consequencia':'Usar mês'}]}
    _, etapa, _ = _etapa_com_pergunta(banco, config_id, resposta, registrar=False)
    with banco.conectar(papel='authenticated') as con:
        assert con.execute('select helena_v2.ler_pergunta_etapa_fundador(%s)',
                           (etapa,)).fetchone()[0] is None


def test_pergunta_com_opcoes_invalidas_ou_usuario_alheio_nao_vaza(banco_interacoes):
    banco, config_id = banco_interacoes
    resposta = {'acao':'PERGUNTAR','pergunta':'Qual período deve orientar o cálculo?',
                'opcoes':[{'letra':'A','texto':'Semana','consequencia':'Usar semana'},
                          {'letra':'C','texto':'Mês','consequencia':'Usar mês'}]}
    _, etapa, _ = _etapa_com_pergunta(banco, config_id, resposta)
    with banco.conectar(papel='authenticated') as con:
        assert con.execute('select helena_v2.ler_pergunta_etapa_fundador(%s)',
                           (etapa,)).fetchone()[0] is None
        con.execute("select set_config('request.jwt.claim.sub',%s,false)",
                    (C.OUTRA_PESSOA_TESTE,))
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute('select helena_v2.ler_pergunta_etapa_fundador(%s)', (etapa,))
    with banco.conectar(papel='anon') as con:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute('select helena_v2.ler_pergunta_etapa_fundador(%s)', (etapa,))


@pytest.mark.parametrize('opcoes', [
    [{'letra':'A','texto':'Semana','consequencia':'Usar semana'},
     {'letra':'B','consequencia':'Usar mês'}],
    [{'letra':'A','texto':'Semana','consequencia':'Usar semana'},
     {'letra':'B','texto':'Mês'}],
    [{'letra':'A','texto':'Semana','consequencia':'Usar semana'},
     {'texto':'Mês','consequencia':'Usar mês'}],
])
def test_pergunta_recusa_opcao_incompleta(banco_interacoes, opcoes):
    banco, config_id = banco_interacoes
    resposta = {'acao':'PERGUNTAR','pergunta':'Qual período deve orientar o cálculo?',
                'opcoes':opcoes}
    _, etapa, _ = _etapa_com_pergunta(banco, config_id, resposta)
    with banco.conectar(papel='authenticated') as con:
        assert con.execute('select helena_v2.ler_pergunta_etapa_fundador(%s)',
                           (etapa,)).fetchone()[0] is None
