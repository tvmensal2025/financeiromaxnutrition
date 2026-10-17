"""O que é: Recebimento comum: um pedido de triagem, eventos idempotentes e isolamento por fundador.
Como mudar: roda num banco local descartável com todas as migrations (conftest.py); nada toca em banco remoto.
"""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import pytest
from psycopg import errors as E

import conftest as C
from integral import banco_integral


@pytest.fixture()
def integral(servidor):
    with banco_integral(servidor) as banco:
        yield banco


def _receber(con, request_id, origem='SITE', evento_id='site:1', texto='Preciso de ajuda com uma campanha.'):
    return con.execute(
        'select helena_v2.receber_pedido_entrada(%s,%s,%s,%s)',
        (request_id, origem, evento_id, texto),
    ).fetchone()[0]


def test_recebimento_reenvio_e_continuacao_entre_canais(integral):
    request_id = uuid4()
    with integral.conectar('authenticated') as fundador:
        primeiro = _receber(fundador, request_id)
        assert primeiro['request_id'] == str(request_id)
        assert primeiro['estado'] == 'RECEBIDO'
        assert primeiro['texto_inicial'] == 'Preciso de ajuda com uma campanha.'
        assert primeiro['origem_inicial'] == 'SITE'
        assert primeiro['total_eventos'] == 1
        assert primeiro['novo_pedido'] is True and primeiro['novo_evento'] is True
        assert primeiro['perguntas'] == [] and primeiro['proposta_helena'] is None
        assert primeiro['empresa_id'] is None and primeiro['empresa_confirmada'] is False
        assert primeiro['config_revision_id'] is None and primeiro['card_id'] is None

        repetido = _receber(fundador, request_id)
        assert repetido['pedido_id'] == primeiro['pedido_id']
        assert repetido['total_eventos'] == 1
        assert repetido['novo_pedido'] is False and repetido['novo_evento'] is False

        continuo = _receber(fundador, request_id, 'CODEX', 'codex:2', 'O prazo é sexta-feira.')
        assert continuo['pedido_id'] == primeiro['pedido_id']
        assert continuo['total_eventos'] == 2
        assert continuo['novo_pedido'] is False and continuo['novo_evento'] is True
        assert continuo['texto_inicial'] == primeiro['texto_inicial']
        lido = fundador.execute('select helena_v2.ler_pedido_entrada(%s)', (request_id,)).fetchone()[0]
        assert [(e['origem'], e['evento_id'], e['texto']) for e in lido['eventos']] == [
            ('SITE', 'site:1', 'Preciso de ajuda com uma campanha.'),
            ('CODEX', 'codex:2', 'O prazo é sexta-feira.'),
        ]
        assert all('recebido_em' in e for e in lido['eventos'])

    with integral.conectar() as dono:
        assert dono.execute('select count(*) from helena_v2.pedido_entrada').fetchone()[0] == 1
        assert dono.execute('select count(*) from helena_v2.pedido_entrada_evento').fetchone()[0] == 2
        assert dono.execute('select count(*) from helena_v2.card').fetchone()[0] == 0
        assert dono.execute('select count(*) from public.tarefas').fetchone()[0] == 0
        assert dono.execute('select count(*) from public.agent_jobs').fetchone()[0] == 0


def test_mesma_chave_com_texto_ou_request_diferente_conflita(integral):
    request_id = uuid4()
    with integral.conectar('authenticated') as fundador:
        original = _receber(fundador, request_id)
        with pytest.raises(E.UniqueViolation, match='ENTRADA_EVENTO_DIVERGENTE'):
            _receber(fundador, request_id, texto='Texto diferente.')
        with pytest.raises(E.UniqueViolation, match='ENTRADA_EVENTO_DIVERGENTE'):
            _receber(fundador, uuid4())
        assert _receber(fundador, request_id)['pedido_id'] == original['pedido_id']
    with integral.conectar() as dono:
        assert dono.execute('select count(*) from helena_v2.pedido_entrada').fetchone()[0] == 1
        assert dono.execute('select count(*) from helena_v2.pedido_entrada_evento').fetchone()[0] == 1


def test_listagem_limite_e_ordenacao_estavel(integral):
    ids = [uuid4() for _ in range(3)]
    with integral.conectar('authenticated') as fundador:
        for i, request_id in enumerate(ids):
            _receber(fundador, request_id, evento_id=f'site:{i}', texto=f'Pedido {i}')
        _receber(fundador, ids[0], 'TELEGRAM', 'tg:1', 'Continuação')
        lista = fundador.execute('select helena_v2.listar_pedidos_entrada()').fetchone()[0]
        assert lista['limite'] == 50
        assert [item['request_id'] for item in lista['itens']] == [str(ids[0]), str(ids[2]), str(ids[1])]
        assert all('eventos' not in item for item in lista['itens'])
        assert fundador.execute('select helena_v2.listar_pedidos_entrada(2)').fetchone()[0]['limite'] == 2
        assert len(fundador.execute('select helena_v2.listar_pedidos_entrada(2)').fetchone()[0]['itens']) == 2
        for limite in (None, 0, 101):
            with pytest.raises(E.InvalidParameterValue, match='LIMITE_INVALIDO'):
                fundador.execute('select helena_v2.listar_pedidos_entrada(%s)', (limite,))


def test_autorizacao_fundador_isolamento_e_rls(integral):
    request_id = uuid4()
    with integral.conectar('authenticated') as fundador:
        _receber(fundador, request_id)
        for tabela in ('pedido_entrada', 'pedido_entrada_evento'):
            assert fundador.execute(
                "select has_table_privilege('authenticated', %s, 'select')",
                (f'helena_v2.{tabela}',),
            ).fetchone()[0] is False
            with pytest.raises(E.InsufficientPrivilege):
                fundador.execute(f'select * from helena_v2.{tabela}')

        fundador.execute("select set_config('request.jwt.claim.sub', %s, false)", (C.OUTRA_PESSOA_TESTE,))
        with pytest.raises(E.InsufficientPrivilege, match='SOMENTE_FUNDADOR_AUTENTICADO'):
            _receber(fundador, uuid4(), evento_id='outro:1')
        with pytest.raises(E.InsufficientPrivilege):
            fundador.execute('select helena_v2.ler_pedido_entrada(%s)', (request_id,))
        with pytest.raises(E.InsufficientPrivilege):
            fundador.execute('select helena_v2.listar_pedidos_entrada()')

        fundador.execute("select set_config('request.jwt.claim.sub', %s, false)", (str(uuid4()),))
        with pytest.raises(E.InsufficientPrivilege):
            _receber(fundador, uuid4(), evento_id='desconhecido:1')
        fundador.execute("select set_config('request.jwt.claim.sub', '', false)")
        with pytest.raises(E.InsufficientPrivilege):
            _receber(fundador, uuid4(), evento_id='sem-uid:1')

    with integral.conectar('authenticated') as segundo_fundador:
        outro_uid = uuid4()
        with integral.conectar() as dono:
            dono.execute("insert into public.app_access (user_id,role,active) values (%s,'founder',true)", (outro_uid,))
        segundo_fundador.execute("select set_config('request.jwt.claim.sub', %s, false)", (str(outro_uid),))
        assert segundo_fundador.execute('select helena_v2.ler_pedido_entrada(%s)', (request_id,)).fetchone()[0] is None
        assert segundo_fundador.execute('select helena_v2.listar_pedidos_entrada()').fetchone()[0]['itens'] == []
        with pytest.raises(E.UniqueViolation, match='ENTRADA_REQUEST_ID_INDISPONIVEL'):
            _receber(segundo_fundador, request_id, evento_id='outro:1')
        outro = _receber(segundo_fundador, uuid4(), evento_id='site:1')
        assert outro['pedido_id'] is not None

    # Mesmo uma concessão acidental de SELECT não atravessa o RLS fechado.
    with integral.conectar() as dono:
        dono.execute('grant select on helena_v2.pedido_entrada, helena_v2.pedido_entrada_evento to authenticated')
    with integral.conectar('authenticated') as fundador:
        assert fundador.execute('select count(*) from helena_v2.pedido_entrada').fetchone()[0] == 0
        assert fundador.execute('select count(*) from helena_v2.pedido_entrada_evento').fetchone()[0] == 0
    with integral.conectar() as dono:
        dono.execute('revoke select on helena_v2.pedido_entrada, helena_v2.pedido_entrada_evento from authenticated')

    with integral.conectar('anon') as anon:
        with pytest.raises(E.InsufficientPrivilege):
            _receber(anon, uuid4(), evento_id='anon:1')
    with integral.conectar('service_role') as motor:
        with pytest.raises(E.InsufficientPrivilege):
            _receber(motor, uuid4(), evento_id='motor:1')


def test_validacao_dos_parametros_e_porta_interna(integral):
    with integral.conectar('authenticated') as fundador:
        for args in ((None, 'SITE', 'a', 'texto'),
                     (uuid4(), 'DESCONHECIDO', 'a', 'texto'),
                     (uuid4(), 'SITE', '', 'texto'),
                     (uuid4(), 'SITE', ' \t\n', 'texto'),
                     (uuid4(), 'SITE', 'a', ' \t\n'),
                     (uuid4(), 'SITE', 'a', 'x' + ' ' * 10000)):
            with pytest.raises(E.InvalidParameterValue, match='ENTRADA_INVALIDA'):
                _receber(fundador, *args)
        with pytest.raises(E.InvalidTextRepresentation):
            fundador.execute("select helena_v2.receber_pedido_entrada('uuid-invalido','SITE','a','texto')")
        with pytest.raises(E.InvalidParameterValue, match='ENTRADA_INVALIDA'):
            fundador.execute('select helena_v2.ler_pedido_entrada(null)')
        assert fundador.execute('select helena_v2.ler_pedido_entrada(%s)', (uuid4(),)).fetchone()[0] is None
    with integral.conectar() as dono:
        for papel in ('public', 'anon', 'authenticated', 'service_role'):
            assert dono.execute(
                "select has_function_privilege(%s, 'helena_v2._resumo_pedido_entrada(uuid,boolean)', 'execute')",
                (papel,),
            ).fetchone()[0] is False


def test_reenvio_concorrente_cria_um_pedido_e_um_evento(integral):
    request_id = uuid4()

    def enviar():
        with integral.conectar('authenticated') as fundador:
            return _receber(fundador, request_id)

    with ThreadPoolExecutor(max_workers=2) as executor:
        resultados = list(executor.map(lambda _: enviar(), range(2)))
    assert resultados[0]['pedido_id'] == resultados[1]['pedido_id']
    assert sorted(r['novo_evento'] for r in resultados) == [False, True]
    with integral.conectar() as dono:
        assert dono.execute('select count(*) from helena_v2.pedido_entrada').fetchone()[0] == 1
        assert dono.execute('select count(*) from helena_v2.pedido_entrada_evento').fetchone()[0] == 1


def test_chave_concorrente_com_conteudo_diferente_falha_sem_pedido_orfao(integral):
    largada = Barrier(2)

    def enviar(request_id, texto):
        with integral.conectar('authenticated') as fundador:
            largada.wait(timeout=5)
            try:
                return ('ok', _receber(fundador, request_id, evento_id='site:mesma-chave', texto=texto))
            except E.UniqueViolation as erro:
                return ('conflito', str(erro))

    with ThreadPoolExecutor(max_workers=2) as executor:
        tarefas = [executor.submit(enviar, uuid4(), texto)
                   for texto in ('Primeira versão', 'Segunda versão')]
        resultados = [tarefa.result() for tarefa in tarefas]
    assert sorted(tipo for tipo, _ in resultados) == ['conflito', 'ok']
    assert 'ENTRADA_EVENTO_DIVERGENTE' in next(valor for tipo, valor in resultados if tipo == 'conflito')
    with integral.conectar() as dono:
        assert dono.execute('select count(*) from helena_v2.pedido_entrada').fetchone()[0] == 1
        assert dono.execute('select count(*) from helena_v2.pedido_entrada_evento').fetchone()[0] == 1
