"""Conversão local de pedido autenticado em card, usando todas as migrations v2."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import pytest
from psycopg import errors as E
from psycopg.types.json import Jsonb

from conftest import servidor, suporte, url_dbos_propria  # noqa: F401
from orquestrador.contexto_real import montar_contexto_real
from orquestrador.motor import Motor

RAIZ = Path(__file__).resolve().parents[3]


@pytest.fixture()
def banco_pedido(servidor):
    banco = suporte.montar_banco(servidor, papeis_de_teste=suporte.PAPEIS_DE_TESTE)
    try:
        with banco.conectar() as con:
            con.execute('create schema if not exists extensions')
            con.execute('create extension if not exists pgcrypto with schema extensions')
            con.execute('create table public.checkpoint_mestre (checkpoint_id text primary key, versao integer, status text, resumo_executivo text, validado_em timestamptz, atualizado_em timestamptz, checkpoint_anterior_id text)')
            con.execute('create view public.checkpoint_mestre_atual as select * from public.checkpoint_mestre')
            con.execute('create table public.portfolio (business_id text primary key, negocio text, estagio text, ativo text, publico text, row_version bigint, brand_identity jsonb)')
            con.execute('create table public.tarefas (task_id text primary key, business_id text, tarefa text, status text, prioridade text, prazo text, definicao_de_pronto text, row_version bigint, criado_em timestamptz, atualizado_em timestamptz)')
            con.execute('create table public.decisoes (decision_id text primary key, decisao text, row_version bigint, status text, business_id text)')
            con.execute('create table public.agent_jobs (job_id text primary key, task_id text, business_id text, agent_id text, status text, approval_status text, result_payload jsonb, result_summary text, evidence_refs jsonb, updated_at timestamptz)')
            for arquivo in sorted((RAIZ / 'supabase/migrations-v2').glob('[0-9][0-9][0-9][0-9]_*.sql')):
                if int(arquivo.name[:4]) >= 7:
                    con.execute(arquivo.read_text(encoding='utf-8'))
        yield banco
    finally:
        suporte.derrubar_banco(banco)


def test_motor_consume_plano_confirmado_sem_public_tarefas(banco_pedido, servidor):
    with url_dbos_propria(servidor, 'helena_dbos_pedido_v2_') as dbos:
        motor = Motor(banco_pedido.url, dbos, executor=object(),
                      fonte_contexto=montar_contexto_real,
                      permitir_configuracao_tecnica=True, iniciar_dbos=False)
        try:
            rev = motor._configuracao_tecnica()
            with banco_pedido.conectar('authenticated') as fundador:
                fundador.execute('select helena_v2.ativar_configuracao(%s,null)', (rev['id'],))
            plano = {'id': 'conta-v2', 'empresas': ['BIZ-003'], 'decisoes': [],
                     'entradas_externas': {},
                     'orcamento_meta': {'execucoes': 4, 'chamadas_total': 200},
                     'etapas': [{'id': 'E1', 'servico': 'SRV-CALCULO',
                                 'objetivo': 'Calcular receita informada pelo fundador',
                                 'entradas': [], 'depende_de': []}]}
            rid = uuid4()
            with banco_pedido.conectar('authenticated') as fundador:
                recebido = fundador.execute('select helena_v2.receber_pedido_entrada(%s,%s,%s,%s)',
                                            (rid, 'SITE', 'site:' + str(rid),
                                             'Quanto entra com 10 pessoas a R$ 20 por hora?')).fetchone()[0]
                fundador.execute('select helena_v2.receber_pedido_entrada(%s,%s,%s,%s)',
                                 (rid, 'SITE', 'site:continua:' + str(rid),
                                  'Considere cinco horas por semana.'))
                resumo = fundador.execute('select helena_v2.confirmar_plano_pedido(%s,%s,%s,%s,%s,%s)',
                                          (rid, 'BIZ-003', 'Conta de receita',
                                           datetime.now(timezone.utc) + timedelta(days=3),
                                           Jsonb(plano), rev['id'])).fetchone()[0]
            assert recebido['estado'] == 'RECEBIDO' and resumo['estado'] == 'PLANO_CONFIRMADO'
            card_id = motor.criar_card_pedido(resumo['pedido_id'])
            assert motor.criar_card_pedido(resumo['pedido_id']) == card_id
            assert motor._modo_card(card_id) == 'real'
            etapa = motor._etapas(card_id)[0]
            pedido, fontes, decisoes = motor._entradas_da_etapa(etapa, 'SRV-CALCULO')
            assert fontes['FON-PEDIDO-' + resumo['pedido_id']].startswith('Quanto entra')
            assert 'Considere cinco horas por semana.' in fontes.values()
            assert fontes['FON-PACOTE-BIZ-003'] and decisoes == []
            assert pedido['ordem_de_servico']['pedido_original'] == recebido['texto_inicial']
            assert Motor._faltas_do_autor_real('SRV-CALCULO', pedido, fontes) == []
            contexto = montar_contexto_real(motor._ambiente_card(card_id)[1], 'SRV-CALCULO',
                                            pedido=pedido, fontes_importadas=fontes,
                                            decisoes=decisoes, execucao_id='E1-1')
            assert contexto['execucao_id'] == 'E1-1'
            with banco_pedido.conectar() as dono:
                assert dono.execute('select count(*) from public.tarefas').fetchone()[0] == 0
                assert dono.execute('select count(*) from public.agent_jobs').fetchone()[0] == 0
        finally:
            motor.fechar()


def test_motor_bloqueia_copy_sem_tabela_leis_publicada(banco_pedido, servidor):
    with url_dbos_propria(servidor, 'helena_dbos_pedido_v2_') as dbos:
        motor = Motor(banco_pedido.url, dbos, executor=object(),
                      fonte_contexto=montar_contexto_real,
                      permitir_configuracao_tecnica=True, iniciar_dbos=False)
        try:
            rev = motor._configuracao_tecnica()
            with banco_pedido.conectar('authenticated') as fundador:
                fundador.execute('select helena_v2.ativar_configuracao(%s,null)', (rev['id'],))
                rid = uuid4()
                recebido = fundador.execute('select helena_v2.receber_pedido_entrada(%s,%s,%s,%s)',
                                            (rid, 'SITE', 'site:' + str(rid), 'Escreva convite.')).fetchone()[0]
                plano = {'id': 'copy-v2', 'empresas': ['BIZ-003'], 'decisoes': [],
                         'entradas_externas': {},
                         'orcamento_meta': {'execucoes': 6, 'chamadas_total': 200},
                         'etapas': [{'id': 'E1', 'servico': 'SRV-COPY',
                                     'objetivo': 'Convite', 'entradas': [], 'depende_de': []},
                                    {'id': 'E2', 'servico': 'SRV-PARECER', 'objetivo': 'Julgar convite',
                                     'entradas': ['E1'], 'depende_de': ['E1'], 'julga': ['E1']}]}
                with pytest.raises(E.CheckViolation, match='PEDIDO_FONTE_LEIS_AUSENTE'):
                    fundador.execute('select helena_v2.confirmar_plano_pedido(%s,%s,%s,%s,%s,%s)',
                                     (rid, 'BIZ-003', 'Convite', datetime.now(timezone.utc) + timedelta(days=3),
                                      Jsonb(plano), rev['id']))
            with banco_pedido.conectar() as dono:
                assert dono.execute('select count(*) from helena_v2.card').fetchone()[0] == 0
                assert dono.execute('select estado from helena_v2.pedido_entrada where id=%s',
                                    (recebido['pedido_id'],)).fetchone()[0] == 'RECEBIDO'
        finally:
            motor.fechar()
