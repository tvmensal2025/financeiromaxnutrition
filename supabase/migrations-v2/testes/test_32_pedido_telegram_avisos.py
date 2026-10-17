"""Avisos do pedido v2 saem só pelo chat privado que originou o protocolo."""
from uuid import uuid4

import pytest
from psycopg import errors as E
from psycopg.types.json import Jsonb

import conftest as C
from integral import banco_integral
from test_12_configuracoes import bootstrap
from test_29_pedido_card_v2 import roteiro
from test_30_proposta_pedido import perguntar, propor, reservar, registrar


@pytest.fixture()
def ambiente(servidor):
    with banco_integral(servidor) as banco:
        _bundle, _digital, rev = bootstrap(banco)
        with banco.conectar('authenticated') as fundador:
            fundador.execute('select helena_v2.ativar_configuracao(%s,null)', (rev['id'],))
            codigo = fundador.execute('select helena_v2.gerar_pareamento_telegram()').fetchone()[0]['codigo']
        with banco.conectar('service_role') as servico:
            servico.execute('select helena_v2.vincular_telegram(%s,%s,%s)', (codigo, 123456789, 123456789))
        with banco.conectar() as dono:
            dono.execute("""insert into public.checkpoint_mestre values
                ('CKP-AVISOS-TESTE',1,'ATIVO','Contexto sintético',now(),now(),null)""")
        yield banco, rev['id']


def entrada_telegram(banco, update_id=9001, texto='/pedido Preparar uma conta para BIZ-003'):
    update = {'update_id': update_id, 'message': {'message_id': update_id,
              'chat': {'id': 123456789, 'type': 'private'},
              'from': {'id': 123456789, 'is_bot': False}, 'text': texto}}
    with banco.conectar('service_role') as servico:
        recebido = servico.execute('select helena_v2.registrar_update_telegram(%s)',
                                   (Jsonb(update),)).fetchone()[0]
    with banco.conectar() as dono:
        recebido['pedido_id'] = str(dono.execute('select id from helena_v2.pedido_entrada where request_id=%s',
                                                (recebido['request_id'],)).fetchone()[0])
    return recebido


def saidas(banco):
    with banco.conectar() as dono:
        return dono.execute("""select s.update_id,s.tipo,s.chave_evento,s.texto,i.vinculo_id
            from helena_v2.telegram_saida s join helena_v2.telegram_inbox i using(update_id)
            order by s.tipo,s.chave_evento""").fetchall()


def registrar_pergunta(banco, request_id):
    with banco.conectar('service_role') as motor:
        claim = reservar(motor, request_id)
        return registrar(motor, request_id, claim, perguntar())


def registrar_plano(banco, request_id, rev):
    with banco.conectar('service_role') as motor:
        claim = reservar(motor, request_id)
        return registrar(motor, request_id, claim, propor(rev))


def test_pergunta_proposta_card_e_chave_idempotente(ambiente):
    banco, rev = ambiente
    recibo = entrada_telegram(banco)
    request_id = recibo['request_id']
    pergunta = registrar_pergunta(banco, request_id)
    avisos = [x for x in saidas(banco) if x[1] == 'AVISO']
    assert len(avisos) == 1
    assert avisos[0][0] == 9001 and avisos[0][2] == 'proposta:' + pergunta['id']
    assert 'esclarecimento' in avisos[0][3] and 'nenhum trabalho foi executado' in avisos[0][3]
    assert request_id in avisos[0][3]

    with banco.conectar('authenticated') as fundador:
        fundador.execute('select helena_v2.receber_pedido_entrada(%s,%s,%s,%s)',
                         (request_id, 'SITE', 'site:esclarecimento:' + str(uuid4()),
                          'Prazo daqui a três dias.'))
    proposta = registrar_plano(banco, request_id, rev)
    avisos = [x for x in saidas(banco) if x[1] == 'AVISO']
    assert len(avisos) == 2
    assert any(x[2] == 'proposta:' + proposta['id'] and 'Confirma' not in x[3]
               and 'confirme explicitamente' in x[3] for x in avisos)
    with banco.conectar() as dono:
        dono.execute('select helena_v2._telegram_avisar_pedido(%s,%s,%s)',
                     (recibo['pedido_id'], 'proposta:' + proposta['id'], 'Duplicado'))
    assert len([x for x in saidas(banco) if x[1] == 'AVISO']) == 2

    with banco.conectar('authenticated') as fundador:
        confirmado = fundador.execute('select helena_v2.confirmar_proposta_pedido(%s,%s)',
                                      (request_id, proposta['id'])).fetchone()[0]
    assert confirmado['estado'] == 'PLANO_CONFIRMADO'
    with banco.conectar('service_role') as motor:
        card = motor.execute('select helena_v2.consumir_plano_pedido(%s,%s)',
                             (confirmado['pedido_id'], Jsonb(roteiro()))).fetchone()[0]
    avisos = [x for x in saidas(banco) if x[1] == 'AVISO']
    assert len(avisos) == 3
    assert any(x[2] == 'card:' + card['card_id'] + ':criado'
               and 'não significa execução concluída nem publicação' in x[3] for x in avisos)
    with banco.conectar('service_role') as motor:
        avancou = motor.execute("""select helena_v2.aplicar_evento(
            'card',%s,'RELOGIO','TEMPO_ESGOTADO',p_automaticos=>false)""",
            (card['card_id'],)).fetchone()[0]
    assert avancou['resultado'] == 'APLICADO'
    avisos = [x for x in saidas(banco) if x[1] == 'AVISO']
    assert len(avisos) == 4
    assert any(x[2] == 'card:' + card['card_id'] + ':' + str(avancou['historico_id'])
               and 'ESPERANDO_CONFIRMACAO' in x[3]
               and 'nenhuma ação foi aprovada automaticamente' in x[3] for x in avisos)


def test_site_sem_inbox_nao_recebe_aviso_e_vinculo_antigo_nao_migra(ambiente):
    banco, _rev = ambiente
    pedido_site = uuid4()
    with banco.conectar('authenticated') as fundador:
        fundador.execute('select helena_v2.receber_pedido_entrada(%s,%s,%s,%s)',
                         (pedido_site, 'SITE', 'site:' + str(pedido_site), 'Conta de receita'))
    with banco.conectar() as dono:
        dono.execute("""insert into helena_v2.telegram_inbox
            (update_id,bruto,bruto_hash,tipo,chat_id,usuario_id,fundador_uid,vinculo_id,request_id)
            select 9999,'{}'::jsonb,extensions.digest('{}','sha256'),'PEDIDO',
                   v.chat_id,v.usuario_id,v.fundador_uid,v.id,%s
            from helena_v2.telegram_vinculo v where v.revogado_em is null""", (pedido_site,))
    registrar_pergunta(banco, pedido_site)
    assert [x for x in saidas(banco) if x[1] == 'AVISO'] == []

    recibo = entrada_telegram(banco)
    request_id = recibo['request_id']
    with banco.conectar('authenticated') as fundador:
        fundador.execute('select helena_v2.revogar_pareamento_telegram()')
        codigo = fundador.execute('select helena_v2.gerar_pareamento_telegram()').fetchone()[0]['codigo']
    with banco.conectar('service_role') as servico:
        servico.execute('select helena_v2.vincular_telegram(%s,%s,%s)', (codigo, 123456789, 123456789))
    registrar_pergunta(banco, request_id)
    assert [x for x in saidas(banco) if x[1] == 'AVISO'] == []


def test_inbox_mais_recente_e_dedupe_global_mesmo_apos_novo_update(ambiente):
    banco, _rev = ambiente
    recibo = entrada_telegram(banco)
    proposta = registrar_pergunta(banco, recibo['request_id'])
    with banco.conectar() as dono:
        dono.execute("""insert into helena_v2.telegram_inbox
            (update_id,bruto,bruto_hash,tipo,chat_id,usuario_id,fundador_uid,vinculo_id,request_id)
            select 9002,i.bruto,i.bruto_hash,'PEDIDO',i.chat_id,i.usuario_id,i.fundador_uid,
                   i.vinculo_id,i.request_id from helena_v2.telegram_inbox i where i.update_id=9001""")
        dono.execute('select helena_v2._telegram_avisar_pedido(%s,%s,%s)',
                     (recibo['pedido_id'], 'proposta:' + proposta['id'], 'Duplicado'))
        dono.execute('select helena_v2._telegram_avisar_pedido(%s,%s,%s)',
                     (recibo['pedido_id'], 'aviso:novo', 'Novo fato do pedido'))
    avisos = [x for x in saidas(banco) if x[1] == 'AVISO']
    assert len(avisos) == 2
    assert next(x for x in avisos if x[2] == 'proposta:' + proposta['id'])[0] == 9001
    assert next(x for x in avisos if x[2] == 'aviso:novo')[0] == 9002

def test_founder_inativo_nao_recebe_e_funcao_privada_nao_e_rpc(ambiente):
    banco, _rev = ambiente
    recibo = entrada_telegram(banco)
    registrar_pergunta(banco, recibo['request_id'])
    assert len([x for x in saidas(banco) if x[1] == 'AVISO']) == 1
    with banco.conectar() as dono:
        dono.execute('update public.app_access set active=false where user_id=%s',
                     (C.FUNDADOR_TESTE,))
        dono.execute('select helena_v2._telegram_avisar_pedido(%s,%s,%s)',
                     (recibo['pedido_id'], 'aviso:inativo', 'Aviso bloqueado'))
    assert len([x for x in saidas(banco) if x[1] == 'AVISO']) == 1
    with banco.conectar('authenticated') as fundador:
        with pytest.raises(E.InsufficientPrivilege):
            fundador.execute('select helena_v2._telegram_avisar_pedido(%s,%s,%s)',
                             (recibo['pedido_id'], 'aviso:forjado', 'Mensagem forjada'))


def test_inbox_com_fundador_divergente_nao_vira_destino(ambiente):
    banco, _rev = ambiente
    recibo = entrada_telegram(banco)
    with banco.conectar() as dono:
        dono.execute('update helena_v2.telegram_inbox set fundador_uid=%s where update_id=9001',
                     (C.OUTRA_PESSOA_TESTE,))
    registrar_pergunta(banco, recibo['request_id'])
    assert [x for x in saidas(banco) if x[1] == 'AVISO'] == []


def test_proposta_bloqueada_nao_convida_confirmacao(ambiente):
    banco, rev = ambiente
    recibo = entrada_telegram(banco)
    with banco.conectar('service_role') as motor:
        claim = reservar(motor, recibo['request_id'])
        registrar(motor, recibo['request_id'], claim,
                  propor(rev, bloqueio='PEDIDO_FONTE_LEIS_AUSENTE'))
    aviso = next(x for x in saidas(banco) if x[1] == 'AVISO')
    assert 'ainda não pode ser confirmada' in aviso[3]
    assert 'confirme explicitamente' not in aviso[3]
    assert 'Serviços: SRV-CALCULO' in aviso[3]
    assert 'horário de Brasília' in aviso[3]
