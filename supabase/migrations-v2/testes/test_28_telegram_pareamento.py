"""O que é: Pareamento Telegram e recebimento durável, sem usar JWT falso de fundador.
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


def gerar(con):
    return con.execute('select helena_v2.gerar_pareamento_telegram()').fetchone()[0]


def estado(con):
    return con.execute('select helena_v2.consultar_pareamento_telegram()').fetchone()[0]


def vincular(con, codigo, chat_id=123456789):
    return con.execute('select helena_v2.vincular_telegram(%s,%s,%s)',
                       (codigo, chat_id, chat_id)).fetchone()[0]


def receber(con, update_id=1001, texto='Quero organizar o lançamento.', request_id=None,
            chat_id=123456789, mensagem_id=30):
    return con.execute('select helena_v2.receber_pedido_telegram(%s,%s,%s,%s,%s,%s)',
                       (chat_id, chat_id, update_id, mensagem_id, texto, request_id)).fetchone()[0]


def preparar_vinculo(integral, chat_id=123456789):
    with integral.conectar('authenticated') as fundador:
        codigo = gerar(fundador)['codigo']
    with integral.conectar('service_role') as servico:
        return vincular(servico, codigo, chat_id)


def test_codigo_192_bits_hash_uso_unico_e_estado(integral):
    with integral.conectar('authenticated') as fundador:
        assert estado(fundador) == {
            'vinculado': False, 'chat_id': None, 'usuario_id': None, 'vinculado_em': None,
            'codigo_pendente': False, 'codigo_expira_em': None,
        }
        primeiro = gerar(fundador)
        assert len(primeiro['codigo']) == 48
        assert set(primeiro['codigo']) <= set('0123456789abcdef')
        assert estado(fundador)['codigo_pendente'] is True
        segundo = gerar(fundador)
        assert segundo['codigo'] != primeiro['codigo']
    with integral.conectar() as dono:
        linha = dono.execute('select codigo_hash, expira_em-gerado_em from helena_v2.telegram_pareamento_codigo').fetchone()
        assert len(linha[0]) == 32
        assert primeiro['codigo'].encode() not in linha[0]
        assert linha[1].total_seconds() == 600
    with integral.conectar('service_role') as servico:
        with pytest.raises(E.InsufficientPrivilege, match='PAREAMENTO_NAO_VALIDO'):
            vincular(servico, primeiro['codigo'])
        ligado = vincular(servico, segundo['codigo'])
        assert ligado['vinculado'] is True
        assert ligado['chat_id'] == '123456789' and ligado['usuario_id'] == '123456789'
        with pytest.raises(E.InsufficientPrivilege, match='PAREAMENTO_NAO_VALIDO'):
            vincular(servico, segundo['codigo'])
    with integral.conectar('authenticated') as fundador:
        visto = estado(fundador)
        assert visto['vinculado'] is True and visto['codigo_pendente'] is False
        assert visto['codigo_expira_em'] is None and visto['vinculado_em'] == ligado['vinculado_em']
        with pytest.raises(E.UniqueViolation, match='PAREAMENTO_JA_VINCULADO'):
            gerar(fundador)
    with integral.conectar() as dono:
        assert dono.execute('select count(*) from helena_v2.telegram_pareamento_codigo').fetchone()[0] == 0


def test_expiracao_tentativa_errada_e_chat_privado(integral):
    with integral.conectar('authenticated') as fundador:
        codigo = gerar(fundador)['codigo']
    with integral.conectar('service_role') as servico:
        for errado in ('x' * 48, '0' * 48, 'abc'):
            with pytest.raises(E.InsufficientPrivilege, match='PAREAMENTO_NAO_VALIDO'):
                vincular(servico, errado)
        with pytest.raises(E.InvalidParameterValue, match='PAREAMENTO_INVALIDO'):
            servico.execute('select helena_v2.vincular_telegram(%s,100,200)', (codigo,))
    with integral.conectar() as dono:
        dono.execute("""update helena_v2.telegram_pareamento_codigo
            set gerado_em=clock_timestamp()-interval '11 minutes',
                expira_em=clock_timestamp()-interval '1 minute'""")
    with integral.conectar('authenticated') as fundador:
        visto = estado(fundador)
        assert visto['codigo_pendente'] is False and visto['codigo_expira_em'] is None
    with integral.conectar('service_role') as servico:
        with pytest.raises(E.InsufficientPrivilege, match='PAREAMENTO_NAO_VALIDO'):
            vincular(servico, codigo)


def test_entrada_replay_continuacao_e_conflito(integral):
    preparar_vinculo(integral)
    with integral.conectar('service_role') as servico:
        primeiro = servico.execute(
            'select helena_v2.receber_pedido_telegram(%s,%s,%s,%s,%s)',
            (123456789, 123456789, 1001, 30, 'Quero organizar o lançamento.'),
        ).fetchone()[0]
        assert primeiro['request_id'] and primeiro['pedido_id']
        assert primeiro['origem_inicial'] == 'TELEGRAM'
        assert primeiro['update_id'] == '1001' and primeiro['mensagem_id'] == '30'
        assert primeiro['novo_pedido'] is True and primeiro['novo_evento'] is True
        repetido = receber(servico)
        assert repetido['request_id'] == primeiro['request_id']
        assert repetido['pedido_id'] == primeiro['pedido_id']
        assert repetido['novo_pedido'] is False and repetido['novo_evento'] is False
        for parametros in (
            {'texto': 'Outro conteúdo'}, {'mensagem_id': 31}, {'request_id': uuid4()},
        ):
            with pytest.raises(E.UniqueViolation, match='TELEGRAM_UPDATE_DIVERGENTE'):
                receber(servico, **parametros)
        continuacao = receber(servico, update_id=1002, mensagem_id=31,
                             texto='Até sexta-feira.', request_id=primeiro['request_id'])
        assert continuacao['pedido_id'] == primeiro['pedido_id']
        assert continuacao['total_eventos'] == 2 and continuacao['novo_evento'] is True
    with integral.conectar('authenticated') as fundador:
        lido = fundador.execute('select helena_v2.ler_pedido_entrada(%s)',
                                 (primeiro['request_id'],)).fetchone()[0]
        assert [e['evento_id'] for e in lido['eventos']] == [
            'telegram:update:1001', 'telegram:update:1002']
    with integral.conectar() as dono:
        assert dono.execute('select count(*) from helena_v2.telegram_update_recebido').fetchone()[0] == 2
        assert dono.execute('select count(*) from helena_v2.card').fetchone()[0] == 0
        assert dono.execute('select count(*) from public.agent_jobs').fetchone()[0] == 0


def test_revogacao_imediata_replay_negado_e_novo_pareamento(integral):
    preparar_vinculo(integral)
    with integral.conectar('service_role') as servico:
        primeiro = receber(servico)
    with integral.conectar('authenticated') as fundador:
        revogado = fundador.execute('select helena_v2.revogar_pareamento_telegram()').fetchone()[0]
        assert revogado == {
            'vinculado': False, 'chat_id': None, 'usuario_id': None, 'vinculado_em': None,
            'codigo_pendente': False, 'codigo_expira_em': None,
        }
    with integral.conectar('service_role') as servico:
        with pytest.raises(E.InsufficientPrivilege, match='TELEGRAM_NAO_VINCULADO'):
            receber(servico)
        with pytest.raises(E.InsufficientPrivilege, match='TELEGRAM_NAO_VINCULADO'):
            receber(servico, update_id=1003)
    with integral.conectar('authenticated') as fundador:
        codigo = gerar(fundador)['codigo']
    with integral.conectar('service_role') as servico:
        vincular(servico, codigo)
        assert receber(servico)['pedido_id'] == primeiro['pedido_id']


def test_credenciais_founder_inativo_e_outro_fundador(integral):
    with integral.conectar('service_role') as servico:
        with pytest.raises(E.InsufficientPrivilege, match='TELEGRAM_NAO_VINCULADO'):
            receber(servico)
    with integral.conectar('authenticated') as fundador:
        codigo = gerar(fundador)['codigo']
    with integral.conectar() as dono:
        dono.execute('update public.app_access set active=false where user_id=%s', (C.FUNDADOR_TESTE,))
    with integral.conectar('service_role') as servico:
        with pytest.raises(E.InsufficientPrivilege, match='PAREAMENTO_NAO_VALIDO'):
            vincular(servico, codigo)
    with integral.conectar('authenticated') as fundador:
        with pytest.raises(E.InsufficientPrivilege):
            estado(fundador)
    with integral.conectar() as dono:
        dono.execute('update public.app_access set active=true where user_id=%s', (C.FUNDADOR_TESTE,))
    with integral.conectar('service_role') as servico:
        vincular(servico, codigo)
        primeiro = receber(servico)
    with integral.conectar() as dono:
        dono.execute('update public.app_access set active=false where user_id=%s', (C.FUNDADOR_TESTE,))
    with integral.conectar('service_role') as servico:
        with pytest.raises(E.InsufficientPrivilege, match='TELEGRAM_NAO_VINCULADO'):
            receber(servico)
    with integral.conectar() as dono:
        dono.execute('update public.app_access set active=true where user_id=%s', (C.FUNDADOR_TESTE,))
        outros = [uuid4(), uuid4()]
        for uid in outros:
            dono.execute("insert into public.app_access(user_id,role,active) values(%s,'founder',true)", (uid,))
    with integral.conectar('authenticated') as outro:
        outro.execute("select set_config('request.jwt.claim.sub', %s, false)", (str(outros[0]),))
        assert estado(outro)['vinculado'] is False
        codigo_outro = gerar(outro)['codigo']
    with integral.conectar('service_role') as servico:
        with pytest.raises(E.InsufficientPrivilege, match='PAREAMENTO_NAO_VALIDO'):
            vincular(servico, codigo_outro)
    with integral.conectar('authenticated') as fundador:
        fundador.execute('select helena_v2.revogar_pareamento_telegram()')
    with integral.conectar('service_role') as servico:
        vincular(servico, codigo_outro)
        with pytest.raises(E.UniqueViolation, match='TELEGRAM_UPDATE_DIVERGENTE'):
            receber(servico)
        segundo = receber(servico, update_id=1005)
        assert segundo['pedido_id'] != primeiro['pedido_id']


def test_acl_roles_e_helper_privado(integral):
    with integral.conectar('anon') as anon:
        with pytest.raises(E.InsufficientPrivilege):
            gerar(anon)
        with pytest.raises(E.InsufficientPrivilege):
            receber(anon)
    with integral.conectar('authenticated') as fundador:
        with pytest.raises(E.InsufficientPrivilege):
            receber(fundador)
        with pytest.raises(E.InsufficientPrivilege):
            vincular(fundador, '0' * 48)
        fundador.execute("select set_config('request.jwt.claim.sub', %s, false)", (C.OUTRA_PESSOA_TESTE,))
        with pytest.raises(E.InsufficientPrivilege):
            gerar(fundador)
    with integral.conectar('service_role') as servico:
        with pytest.raises(E.InsufficientPrivilege):
            gerar(servico)
        with pytest.raises(E.InsufficientPrivilege):
            servico.execute('select * from helena_v2.telegram_vinculo')
    with integral.conectar() as dono:
        for papel in ('public', 'anon', 'authenticated', 'service_role'):
            for assinatura in ('helena_v2._receber_pedido_explicit_uid(uuid,uuid,text,text,text)',
                               'helena_v2._estado_pareamento_telegram(uuid)'):
                assert dono.execute('select has_function_privilege(%s,%s,\'EXECUTE\')',
                                    (papel, assinatura)).fetchone()[0] is False
        for tabela in ('telegram_pareamento_codigo', 'telegram_vinculo', 'telegram_update_recebido'):
            assert dono.execute("select relrowsecurity from pg_class where oid=%s::regclass",
                                (f'helena_v2.{tabela}',)).fetchone()[0] is True


def test_corrida_codigo_uso_unico_e_replay_update(integral):
    with integral.conectar('authenticated') as fundador:
        codigo = gerar(fundador)['codigo']
    largada = Barrier(2)

    def ligar():
        with integral.conectar('service_role') as servico:
            largada.wait(timeout=5)
            try:
                return ('ok', vincular(servico, codigo))
            except E.InsufficientPrivilege as erro:
                return ('erro', str(erro))

    with ThreadPoolExecutor(max_workers=2) as executor:
        resultados = list(executor.map(lambda _: ligar(), range(2)))
    assert sorted(tipo for tipo, _ in resultados) == ['erro', 'ok']
    assert 'PAREAMENTO_NAO_VALIDO' in next(v for tipo, v in resultados if tipo == 'erro')

    largada = Barrier(2)

    def enviar():
        with integral.conectar('service_role') as servico:
            largada.wait(timeout=5)
            return receber(servico)

    with ThreadPoolExecutor(max_workers=2) as executor:
        recibos = list(executor.map(lambda _: enviar(), range(2)))
    assert recibos[0]['request_id'] == recibos[1]['request_id']
    assert sorted(r['novo_evento'] for r in recibos) == [False, True]
    with integral.conectar() as dono:
        assert dono.execute('select count(*) from helena_v2.telegram_vinculo where revogado_em is null').fetchone()[0] == 1
        assert dono.execute('select count(*) from helena_v2.telegram_update_recebido').fetchone()[0] == 1
        assert dono.execute('select count(*) from helena_v2.pedido_entrada').fetchone()[0] == 1
        assert dono.execute('select count(*) from helena_v2.pedido_entrada_evento').fetchone()[0] == 1


def test_corrida_geracao_e_consumo_nao_devolve_codigo_inutil(integral):
    with integral.conectar('authenticated') as fundador:
        codigo_antigo = gerar(fundador)['codigo']
    largada = Barrier(2)

    def gerar_novo():
        with integral.conectar('authenticated') as fundador:
            largada.wait(timeout=5)
            try:
                return ('novo', gerar(fundador))
            except E.UniqueViolation as erro:
                return ('ja_vinculado', str(erro))

    def consumir_antigo():
        with integral.conectar('service_role') as servico:
            largada.wait(timeout=5)
            try:
                return ('vinculado', vincular(servico, codigo_antigo))
            except E.InsufficientPrivilege as erro:
                return ('codigo_revogado', str(erro))

    with ThreadPoolExecutor(max_workers=2) as executor:
        resultado_gerar = executor.submit(gerar_novo)
        resultado_consumir = executor.submit(consumir_antigo)
        novo, consumo = resultado_gerar.result(), resultado_consumir.result()
    assert (novo[0], consumo[0]) in (
        ('novo', 'codigo_revogado'), ('ja_vinculado', 'vinculado'))
    with integral.conectar('authenticated') as fundador:
        visto = estado(fundador)
        assert visto['vinculado'] is (consumo[0] == 'vinculado')
        assert visto['codigo_pendente'] is (novo[0] == 'novo')
