"""Confirmação founder no banco descartável, sem rede nem fonte de produção."""
import copy
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg
import pytest
from psycopg.types.json import Jsonb

from test_13_pedidos_reais import banco_real, parametros, solicitar
import sorteio as S
import conftest as C


SQL = Path(__file__).resolve().parents[1] / '0009_confirmacao_real.sql'
SQL_COORDENACAO = SQL.with_name('0008_resposta_coordenacao.sql')


def _aplicar_confirmacao(con):
    # Na integração, aplica 0008 antes da 0009 como será feito na instalação.
    if SQL_COORDENACAO.exists():
        con.execute(SQL_COORDENACAO.read_text(encoding='utf-8'))
    con.execute(SQL.read_text(encoding='utf-8'))


def _args_confirmados(banco, config_id, *, fonte='https://example.org/regras'):
    args = list(parametros(banco, config_id))
    prazo = (datetime.now(timezone.utc) + timedelta(days=5)).replace(microsecond=0).isoformat()
    dados = copy.deepcopy(args[3].obj)
    ordem = dados['pedido']['ordem_de_servico']
    ordem.update({'prazo': prazo,
                  'como_e_o_pronto': [{'id': 'CARD-1', 'texto': 'Conferir com evidência.',
                                       'quem_confere': 'IA', 'risco': 'ALTO'}],
                  'nao_pode': ['Não publicar sem autorização.'],
                  'fontes_que_pode_ler': [fonte]})
    args[1], args[3], args[4] = prazo, Jsonb(dados), None
    return tuple(args)


def test_confirmacao_fundador_pina_revisao_e_preserva_prazo_factual(banco_real):
    banco, config_id = banco_real
    with banco.conectar() as con:
        _aplicar_confirmacao(con)
    args = _args_confirmados(banco, config_id)
    with banco.conectar(papel='authenticated') as con:
        pedido = solicitar(con, args)
        assert pedido['config_revision_id'] == str(config_id)
        assert pedido['dados_reais']['captura']['tarefa']['prazo'] is None
        assert pedido['dados_reais']['pedido']['ordem_de_servico']['prazo'] == args[1]
        assert solicitar(con, args)['id'] == pedido['id']
        alterados = copy.deepcopy(args[3].obj)
        alterados['pedido']['ordem_de_servico']['nao_pode'] = ['Outra restrição.']
        with pytest.raises(psycopg.errors.UniqueViolation):
            solicitar(con, (args[0], args[1], args[2], Jsonb(alterados), args[4], args[5]))
    with banco.conectar(papel='service_role') as con:
        assert con.execute('select helena_v2.ler_solicitacao_card_real(%s)',
                           (pedido['id'],)).fetchone()[0]['dados_reais'] == args[3].obj
        criado = con.execute('select helena_v2.consumir_solicitacao_card_real(%s,%s)',
                             (pedido['id'], Jsonb(S.ROTEIRO_UMA_ETAPA))).fetchone()[0]
        assert criado['novo'] is True
        card = con.execute('select prazo,ordem_de_servico from helena_v2.card where id=%s',
                           (criado['card_id'],)).fetchone()
        assert card[0] == datetime.fromisoformat(args[1])
        assert card[1]['dados_reais']['pedido']['ordem_de_servico']['fontes_que_pode_ler'] == ['https://example.org/regras']


@pytest.mark.parametrize('fonte', ['https://localhost/regras', 'https://127.0.0.1/regras',
                                    'https://user:pass@example.org/regras',
                                    'https://example.org/regras?token=x',
                                    'https://example.org/%6cogin',
                                    'https://kubernetes.default/', 'https://example.org/convite',
                                    'https://example.org/verify', 'https://example.org/register',
                                    'https://example.org/ref', 'https://example.x/',
                                    'https://example.org/a|b', 'https://example.org/<prova>',
                                    'https://example.org:80/regras',
                                    'https://example.org/login'])
def test_confirmacao_recusa_url_nao_publica(banco_real, fonte):
    banco, config_id = banco_real
    with banco.conectar() as con:
        _aplicar_confirmacao(con)
    args = _args_confirmados(banco, config_id, fonte=fonte)
    with banco.conectar(papel='authenticated') as con:
        with pytest.raises(psycopg.Error):
            solicitar(con, args)


def test_confirmacao_recusa_prazo_divergente_ou_fonte_mudada(banco_real):
    banco, config_id = banco_real
    with banco.conectar() as con:
        _aplicar_confirmacao(con)
    args = _args_confirmados(banco, config_id)
    with banco.conectar(papel='authenticated') as con:
        with pytest.raises(psycopg.Error):
            solicitar(con, (args[0], '2027-10-20T12:00:00+00:00', *args[2:]))
    with banco.conectar() as con:
        con.execute('update public.tarefas set row_version=row_version+1 where task_id=%s',
                    (args[0],))
    with banco.conectar(papel='authenticated') as con:
        with pytest.raises(psycopg.Error):
            solicitar(con, (*args[:-1], 'CHAVE-STALE'))


def test_confirmacao_mantem_gate_fundador(banco_real):
    banco, config_id = banco_real
    with banco.conectar() as con:
        _aplicar_confirmacao(con)
    args = _args_confirmados(banco, config_id)
    for papel in ('anon', 'service_role'):
        with banco.conectar(papel=papel) as con:
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                solicitar(con, args)
    with banco.conectar(papel='authenticated') as con:
        con.execute("select set_config('request.jwt.claim.sub', %s, false)",
                    (C.OUTRA_PESSOA_TESTE,))
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            solicitar(con, args)


def test_card_antigo_sem_campos_confirmados_nao_passa_novo_gate(banco_real):
    banco, config_id = banco_real
    antigo = parametros(banco, config_id)
    with banco.conectar(papel='authenticated') as con:
        pedido = solicitar(con, antigo)
    with banco.conectar(papel='service_role') as con:
        card = con.execute('select helena_v2.consumir_solicitacao_card_real(%s,%s)',
                           (pedido['id'], Jsonb(S.ROTEIRO_UMA_ETAPA))).fetchone()[0]['card_id']
    with banco.conectar() as con:
        _aplicar_confirmacao(con)
        with pytest.raises(psycopg.errors.InsufficientPrivilege, match='CARD_REAL_SEM_CONFIRMACAO'):
            con.execute('select helena_v2._real_conferir_card_vinculado(%s)', (card,))
