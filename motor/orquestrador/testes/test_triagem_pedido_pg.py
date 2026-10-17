"""Entrada v2 até proposta e card, com PostgreSQL descartável e provedor de teste."""
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from conftest import RAIZ, servidor, suporte, url_dbos_propria  # noqa: F401
from executor_helena.tipos import Conferencia, RegistroDeUso, Resultado
from orquestrador.contexto_real import montar_contexto_real
from orquestrador.despacho import AVANCOU, Despachante
from orquestrador.motor import Motor
from orquestrador.triagem_pedido import processar_proposta_pedido
from spec_helena.leitura import ler_yaml


@pytest.fixture()
def banco_triagem(servidor):
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
            con.execute("insert into public.checkpoint_mestre values ('CP-ATUAL',42,'ATIVO','Escopo da v2',now(),now(),null)")
            con.execute("insert into public.portfolio (business_id,negocio,ativo,row_version) values ('BIZ-003','Humano Digital','SIM',1)")
            for arquivo in sorted((RAIZ / 'supabase/migrations-v2').glob('[0-9][0-9][0-9][0-9]_*.sql')):
                if int(arquivo.name[:4]) >= 7:
                    con.execute(arquivo.read_text(encoding='utf-8'))
        yield banco
    finally:
        suporte.derrubar_banco(banco)


@dataclass
class ProvedorDeTeste:
    chamadas: int = 0
    motor: object = None
    pedido_id: str = ''

    def rodar(self, execucao):
        self.chamadas += 1
        pacote = json.loads(execucao.pacote)
        assert 'fundador_uid' not in pacote and 'lease_token' not in pacote
        if 'instrucao' in pacote:
            texto = pacote['eventos'][0]['texto']
            saida = {'tipo': 'PROPOR', 'perguntas': [], 'resumo': 'Conta pedida pelo fundador.',
                     'empresa_id': 'BIZ-003', 'servico_id': 'SRV-CALCULO', 'titulo': 'Conta de receita',
                     'objetivo': 'Calcular a receita informada.',
                     'evidencia': {'empresa': 'Humano Digital', 'servico': 'SRV-CALCULO',
                                  'prazo': texto.split('Prazo ')[1].rstrip('.'),
                                  'insumos': '10 pessoas gravando 5 horas por semana'}}
            saida = json.dumps(saida)
        elif execucao.ficha.papel == 'COORDENACAO':
            saida = json.dumps({'leitura_de_volta': 'Entendi o pedido e o prazo.'})
        else:
            saida = self.motor._texto_roteirizado(execucao)
            if execucao.ficha.papel == 'AUTOR':
                saida = saida.replace('FON-PEDIDO-CALCULO-01', 'FON-PEDIDO-' + self.pedido_id)
        return Resultado(texto=saida, terminou_inteira=True, uso=RegistroDeUso(usou_internet=False),
                         codigo_de_saida=0, ferramentas_recebidas=(), modelo_usado='modelo-teste',
                         provedor_usado='provedor-teste', tempo_s=0, falha=None,
                         conferencia=Conferencia())

    def limpar(self, resultado):
        pass


def test_resposta_bruta_retomada_sem_nova_chamada_e_confirmacao_cria_card(banco_triagem, servidor):
    with url_dbos_propria(servidor, 'helena_dbos_triagem_') as dbos:
        provedor = ProvedorDeTeste()
        motor = Motor(banco_triagem.url, dbos, executor=provedor,
                      fonte_contexto=montar_contexto_real,
                      permitir_configuracao_tecnica=True, iniciar_dbos=False)
        try:
            rev = motor._configuracao_tecnica()
            with banco_triagem.conectar('authenticated') as fundador:
                fundador.execute('select helena_v2.ativar_configuracao(%s,null)', (rev['id'],))
                rid = uuid4()
                prazo = (datetime.now(timezone.utc) + timedelta(days=3)).astimezone().strftime('%d/%m/%Y %H:%M')
                original = ler_yaml(RAIZ / 'helena-v2/casos/SRV-CALCULO/pedido.yaml')['ordem_de_servico']['pedido_original']
                texto = original + ' Solicito SRV-CALCULO. Prazo ' + prazo + '.'
                recebido = fundador.execute('select helena_v2.receber_pedido_entrada(%s,%s,%s,%s)',
                                            (rid, 'SITE', 'site:' + str(rid), texto)).fetchone()[0]
                provedor.pedido_id = recebido['pedido_id']
            claim = motor._linha('select helena_v2.reservar_proposta_pedido(%s::uuid,%s) as item',
                                 (rid, 30))['item']
            # Guarda resposta numa tentativa interrompida antes da proposta final.
            _, spec, raiz = motor._carregar_revisao(claim['config_revision_id'])
            from orquestrador.triagem_pedido import _autor_plano
            bruto, _ = _autor_plano(motor, claim, spec, raiz)
            motor._linha('select helena_v2.registrar_resposta_bruta_pedido(%s::uuid,%s::uuid,%s) as item',
                         (rid, claim['lease_token'], __import__('psycopg').types.json.Jsonb(bruto)))
            with banco_triagem.conectar() as con:
                con.execute("update helena_v2.pedido_entrada_reserva set expira_em=clock_timestamp()-interval '1 second' where pedido_id=%s", (claim['pedido_id'],))
            proposta = processar_proposta_pedido(motor, rid)
            assert proposta['tipo'] == 'PROPOR' and provedor.chamadas == 1
            with banco_triagem.conectar('authenticated') as fundador:
                resumo = fundador.execute('select helena_v2.confirmar_proposta_pedido(%s,%s)',
                                           (rid, proposta['id'])).fetchone()[0]
            assert resumo['estado'] == 'PLANO_CONFIRMADO'
            despachante = Despachante(motor, vagas=1)
            try:
                assert despachante.uma_rodada() == AVANCOU
                card_id = despachante.ultimo_card
            finally:
                despachante.fechar()
            assert motor.criar_card_pedido(resumo['pedido_id']) == card_id
            assert motor._card(card_id)['estado'] == 'RASCUNHO'
        finally:
            motor.fechar()
        motor = Motor(banco_triagem.url, dbos, executor=provedor,
                      fonte_contexto=montar_contexto_real, permitir_casos_sinteticos=True)
        provedor.motor = motor
        try:
            for _ in range(20):
                if motor._card(card_id)['estado'] == 'PRONTO':
                    break
                assert motor.avancar(card_id)
            assert motor._card(card_id)['estado'] == 'PRONTO'
            assert [e['estado'] for e in motor._etapas(card_id)] == ['PRONTA']
            assert provedor.chamadas >= 4  # triagem, leitura de volta, autor e revisor
            # O laço permanente volta à entrada depois de concluir o primeiro card.
            novo_id = uuid4()
            with banco_triagem.conectar('authenticated') as fundador:
                recebido = fundador.execute('select helena_v2.receber_pedido_entrada(%s,%s,%s,%s)',
                                            (novo_id, 'SITE', 'site:' + str(novo_id), texto)).fetchone()[0]
            provedor.pedido_id = recebido['pedido_id']
            despachante = Despachante(motor, vagas=1)
            try:
                assert despachante.uma_rodada() == AVANCOU
            finally:
                despachante.fechar()
            with banco_triagem.conectar('authenticated') as fundador:
                segundo = fundador.execute('select helena_v2.ler_proposta_pedido(%s)',
                                           (novo_id,)).fetchone()[0]
            assert segundo['proposta_helena']['tipo'] == 'PROPOR'
            assert segundo['card_id'] is None
        finally:
            motor.fechar()
