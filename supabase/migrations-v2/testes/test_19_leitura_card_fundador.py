"""O QUE É: Leitura de volta real e aplicada ao card, projetada para o fundador.
COMO MUDAR: atualize o contrato da migração 0014 preservando prova da leitura de volta, versão e identidade do fundador.
"""
import json
from pathlib import Path

import psycopg
import pytest
from psycopg.types.json import Jsonb

import conftest as C
import sorteio as S
from test_13_pedidos_reais import banco_real, solicitar
from test_14_confirmacao_real import _args_confirmados
from test_15_aprovacao_fontes_reais import banco_aprovacao
from test_16_lista_acoes_fundador import banco_acoes
from test_17_reacoes_fundador import banco_reacoes
from test_18_interacoes_fundador import banco_interacoes


SQL = Path(__file__).resolve().parents[1] / '0014_leitura_card_fundador.sql'


@pytest.fixture
def banco_leitura(banco_interacoes):
    banco, config_id = banco_interacoes
    with banco.conectar() as con:
        if SQL.exists():
            con.execute(SQL.read_text(encoding='utf-8'))
    return banco, config_id


def _card_pendente(banco, config_id, leitura):
    with banco.conectar(papel='authenticated') as con:
        pedido = solicitar(con, _args_confirmados(banco, config_id))
    with banco.conectar(papel='service_role') as con:
        card = con.execute('select helena_v2.consumir_solicitacao_card_real(%s,%s)',
                           (pedido['id'], Jsonb(S.ROTEIRO_UMA_ETAPA))).fetchone()[0]['card_id']
        chave = con.execute('select helena_v2.obter_chamada_coordenacao(%s)', (card,)).fetchone()[0]
        con.execute('select helena_v2.registrar_resposta_coordenacao(%s,%s)',
                    (chave,Jsonb({'texto':json.dumps(leitura,ensure_ascii=False),
                                  'evidencias':{},'config_revision_id':str(config_id),
                                  'card_id':str(card)})))
        aplicado = con.execute('select helena_v2.aplicar_resposta_coordenacao(%s)',
                               (chave,)).fetchone()[0]
        assert aplicado['resultado'] == 'APLICADO'
    return card, chave, aplicado['historico_id']


def test_leitura_real_texto_e_proveniencia_sem_captura(banco_leitura):
    banco, config_id = banco_leitura
    card, chave, hist = _card_pendente(banco, config_id,
                                      {'leitura_de_volta':'Entendi o objetivo e o prazo.',
                                       'captura_secreta':{'token':'não mostrar'}})
    with banco.conectar() as con:
        assert con.execute('select chamada_helena from helena_v2.card where id=%s',
                           (card,)).fetchone()[0] is None
    with banco.conectar(papel='authenticated') as con:
        linha = con.execute('select helena_v2.ler_leitura_card_fundador(%s)', (card,)).fetchone()[0]
        assert linha['card_id'] == str(card) and linha['chave'] == chave
        assert linha['historico_id'] == hist and linha['motivo_atual'] == 'NENHUM'
        assert linha['leitura_de_volta'] == 'Entendi o objetivo e o prazo.'
        assert set(linha) == {'card_id','versao','chave','historico_id','momento',
                              'motivo_atual','leitura_de_volta','escolha'}
        assert linha['escolha'] is None


def test_leitura_estruturada_projeta_so_campos_legiveis(banco_leitura):
    banco, config_id = banco_leitura
    lida = {'acao':'LER_DE_VOLTA','escolha':{'tipo':'SERVICO','id':'SRV-CALCULO',
                                           'interno':'não mostrar'},
            'entendi_assim':{'o_que_quer':'Calcular o total por mês com fontes conferidas.',
                            'como_e_o_pronto':[{'texto':'Valores com origem.',
                                                 'checagem':'CHK-CALCULO-02',
                                                 'secreto':'não mostrar'}],
                            'nao_pode':['Inventar taxas.'],
                            'captura_secreta':'não mostrar'}}
    card, _, _ = _card_pendente(banco, config_id, lida)
    with banco.conectar(papel='authenticated') as con:
        linha = con.execute('select helena_v2.ler_leitura_card_fundador(%s)',
                            (card,)).fetchone()[0]
        assert linha['leitura_de_volta'] == {
            'o_que_quer':'Calcular o total por mês com fontes conferidas.',
            'como_e_o_pronto':['Valores com origem.'],'nao_pode':['Inventar taxas.']}
        assert linha['escolha'] == {'tipo':'SERVICO','id':'SRV-CALCULO'}


def test_leitura_indisponivel_apos_confirmacao_e_para_outros_papeis(banco_leitura):
    banco, config_id = banco_leitura
    card, _, _ = _card_pendente(banco, config_id, {'resumo':'Entendi o pedido.'})
    with banco.conectar(papel='authenticated') as con:
        con.execute("select set_config('request.jwt.claim.sub',%s,false)",
                    (C.OUTRA_PESSOA_TESTE,))
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            con.execute('select helena_v2.ler_leitura_card_fundador(%s)', (card,))
    for papel in ('anon','service_role'):
        with banco.conectar(papel=papel) as con:
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                con.execute('select helena_v2.ler_leitura_card_fundador(%s)', (card,))
    with banco.conectar(papel='authenticated') as con:
        con.execute("select helena_v2.aplicar_evento('card',%s,'FUNDADOR','RESPONDER',%s,null,null,%s)",
                    (card,Jsonb({'opcao':'CONFIRMO'}),
                     con.execute('select versao from helena_v2.card where id=%s',
                                 (card,)).fetchone()[0]))
        assert con.execute('select helena_v2.ler_leitura_card_fundador(%s)',
                           (card,)).fetchone()[0] is None


def test_validador_falhou_mostra_leitura_original_com_motivo_atual(banco_leitura):
    banco, config_id = banco_leitura
    card, chave, hist = _card_pendente(banco, config_id,
                                      {'resumo':'Entendi a tarefa antes de validar o plano.'})
    with banco.conectar(papel='authenticated') as con:
        versao = con.execute('select versao from helena_v2.card where id=%s',
                             (card,)).fetchone()[0]
        con.execute("select helena_v2.aplicar_evento('card',%s,'FUNDADOR','RESPONDER',%s,null,null,%s,null,null,false)",
                    (card,Jsonb({'opcao':'CONFIRMO'}),versao))
    with banco.conectar(papel='service_role') as con:
        for _ in range(2):
            con.execute("select helena_v2.aplicar_evento('card',%s,'RELOGIO','TEMPO_ESGOTADO','{}'::jsonb,null,null,null,null,null,false)",
                        (card,))
        assert con.execute('select estado,motivo from helena_v2.card where id=%s',
                           (card,)).fetchone() == ('ESPERANDO_CONFIRMACAO','VALIDADOR_FALHOU')
    with banco.conectar(papel='authenticated') as con:
        linha = con.execute('select helena_v2.ler_leitura_card_fundador(%s)',
                            (card,)).fetchone()[0]
        assert linha['motivo_atual'] == 'VALIDADOR_FALHOU'
        assert linha['chave'] == chave and linha['historico_id'] == hist
        assert linha['leitura_de_volta'] == 'Entendi a tarefa antes de validar o plano.'


def test_helena_falhou_sem_leitura_aplicada_retorna_nulo(banco_leitura):
    banco, config_id = banco_leitura
    with banco.conectar(papel='authenticated') as con:
        pedido = solicitar(con, _args_confirmados(banco, config_id))
    with banco.conectar(papel='service_role') as con:
        card = con.execute('select helena_v2.consumir_solicitacao_card_real(%s,%s)',
                           (pedido['id'], Jsonb(S.ROTEIRO_UMA_ETAPA))).fetchone()[0]['card_id']
        for _ in range(2):
            con.execute("select helena_v2.aplicar_evento('card',%s,'MOTOR','FALHA',%s)",
                        (card,Jsonb({'classe':'DESCONHECIDA'})))
        assert con.execute('select estado,motivo from helena_v2.card where id=%s',
                           (card,)).fetchone() == ('ESPERANDO_CONFIRMACAO','HELENA_FALHOU')
    with banco.conectar(papel='authenticated') as con:
        assert con.execute('select helena_v2.ler_leitura_card_fundador(%s)',
                           (card,)).fetchone()[0] is None
