"""O que é: valida o RASCUNHO docs/propostas/0027_memoria_agentes.sql em PostgreSQL local descartável.
Como mudar: o arquivo SQL NÃO é uma migration e NÃO está aplicado em lugar nenhum. Este teste monta as migrations
0001–0026 num banco de teste, aplica o rascunho por cima e prova as regras de escopo, fonte, revisão, imutabilidade,
busca e esquecimento. Nada toca Supabase real. Se o rascunho mudar, este teste muda junto.
"""
import itertools
import json
from datetime import datetime, timezone
from uuid import uuid4

import psycopg
import pytest
from psycopg import errors as E
from psycopg.types.json import Jsonb

from conftest import RAIZ, servidor, suporte  # noqa: F401
from orquestrador.memoria import ContextoDeEscopo, Resumo, Trecho, escopo_permite

RASCUNHO = RAIZ / 'docs' / 'propostas' / '0027_memoria_agentes.sql'
F = suporte.FUNDADOR_TESTE
# estados finais da etapa não exigem dono/prazo: PRONTA conta como entrega aprovada; ENCERRADA_COM_FALHA, como não aprovada
ESTADO_REAL = {'APROVADA': 'PRONTA', 'EXECUTANDO': 'ENCERRADA_COM_FALHA'}


@pytest.fixture(scope='module')
def banco(servidor):
    b = suporte.montar_banco(servidor, papeis_de_teste=suporte.PAPEIS_DE_TESTE)
    try:
        with b.conectar() as con:
            con.execute('create schema if not exists extensions')
            con.execute('create extension if not exists pgcrypto with schema extensions')
            con.execute('create table public.checkpoint_mestre (checkpoint_id text primary key, versao integer, status text, resumo_executivo text, validado_em timestamptz, atualizado_em timestamptz, checkpoint_anterior_id text)')
            con.execute('create view public.checkpoint_mestre_atual as select * from public.checkpoint_mestre')
            con.execute('create table public.portfolio (business_id text primary key, negocio text, estagio text, ativo text, publico text, row_version bigint, brand_identity jsonb)')
            con.execute('create table public.tarefas (task_id text primary key, business_id text, tarefa text, status text, prioridade text, prazo text, definicao_de_pronto text, row_version bigint, criado_em timestamptz, atualizado_em timestamptz)')
            con.execute('create table public.decisoes (decision_id text primary key, decisao text, row_version bigint, status text, business_id text)')
            con.execute('create table public.agent_jobs (job_id text primary key, task_id text, business_id text, agent_id text, status text, approval_status text, result_payload jsonb, result_summary text, evidence_refs jsonb, updated_at timestamptz)')
            con.execute("insert into public.checkpoint_mestre values ('CP-ATUAL',42,'ATIVO','Escopo da v2',now(),now(),null)")
            con.execute("insert into public.portfolio (business_id,negocio,ativo,row_version) values ('BIZ-003','Humano Digital','SIM',1),('BIZ-001','iGreen','SIM',1)")
            con.execute("insert into public.decisoes values ('DEC-GLOBAL','Frases curtas.',1,'ATIVO',null),('DEC-001','So da iGreen.',1,'ATIVO','BIZ-001'),('DEC-OLD','Velha.',1,'ENCERRADA',null)")
            for arquivo in sorted((RAIZ / 'supabase/migrations-v2').glob('[0-9][0-9][0-9][0-9]_*.sql')):
                if int(arquivo.name[:4]) >= 7:
                    con.execute(arquivo.read_text(encoding='utf-8'))
            con.execute(RASCUNHO.read_text(encoding='utf-8'))
        yield b
    finally:
        suporte.derrubar_banco(b)


def _semear(con):
    """Cards, etapas, execuções e entregas mínimos, escritos como dono do banco de teste (gatilhos desligados)."""
    ids = {}
    con.execute("set session_replication_role='replica'")
    try:
        for nome, empresa in (('c3a', 'BIZ-003'), ('c3b', 'BIZ-003'), ('c1', 'BIZ-001'), ('cp', None)):
            card = con.execute(
                "insert into helena_v2.card (titulo, empresa, prazo, estado) values (%s,%s,now()+interval '3 days','PRONTO') returning id",
                (nome, empresa)).fetchone()[0]
            ids[nome] = str(card)
            for estado in ('APROVADA', 'EXECUTANDO'):
                etapa = con.execute(
                    "insert into helena_v2.etapa (card_id,codigo,ordem,autor,estado) values (%s,%s,1,'ISABELA',%s) returning id",
                    (card, 'E' + estado[:2], ESTADO_REAL[estado])).fetchone()[0]
                n = con.execute("insert into helena_v2.execucao (tipo,card_id,etapa_id,estado) values ('AUTOR',%s,%s,'RESPONDIDA') returning numero",
                                (card, etapa)).fetchone()[0]
                ent = con.execute(
                    "insert into helena_v2.entrega (card_id,etapa_id,etapa_codigo,versao,numero_execucao,autor,portao1,conteudo) "
                    "values (%s,%s,'E1',1,%s,'ISABELA','PASSOU',%s) returning id",
                    (card, etapa, n, Jsonb({'resposta': f'Campanha de verão {nome} com 3 chamadas e desconto de 12,5%'}))).fetchone()[0]
                ids[f'{nome}_{estado}'] = str(ent)
                ids[f'{nome}_{estado}_exec'] = n
            rev = con.execute("insert into helena_v2.execucao (tipo,card_id,estado) values ('REVISOR',%s,'RESPONDIDA') returning numero",
                              (card,)).fetchone()[0]
            con.execute("insert into helena_v2.resposta_execucao (numero,resposta) values (%s,'{}')", (rev,))
            ids[nome + '_rev'] = rev
            h = con.execute("insert into helena_v2.historico (card_id,maquina,alvo_id,alvo_codigo,papel,evento,resultado,conta) "
                            "values (%s,'card',%s,'C','FUNDADOR','CONFIRMAR','APLICADO','x') returning id", (card, card)).fetchone()[0]
            ids[nome + '_hist'] = str(h)
    finally:
        con.execute("set session_replication_role='origin'")
    return ids


@pytest.fixture()
def mundo(banco):
    """Estado novo por teste: limpa as tabelas de memória (como dono, gatilhos desligados) e semeia o resto uma vez."""
    with banco.conectar() as con:
        con.execute("set session_replication_role='replica'")
        con.execute('truncate helena_v2.memoria_uso, helena_v2.memoria_resumo_fonte, helena_v2.memoria_trecho, helena_v2.memoria_resumo cascade')
        con.execute("set session_replication_role='origin'")
        existe = con.execute("select count(*) from helena_v2.card").fetchone()[0]
        if not existe:
            _semear(con)
        ids = {}
        for nome in ('c3a', 'c3b', 'c1', 'cp'):
            card = con.execute('select id from helena_v2.card where titulo=%s', (nome,)).fetchone()[0]
            ids[nome] = str(card)
            for estado in ('APROVADA', 'EXECUTANDO'):
                ids[f'{nome}_{estado}'] = str(con.execute(
                    'select e.id from helena_v2.entrega e join helena_v2.etapa t on t.id=e.etapa_id where e.card_id=%s and t.estado=%s',
                    (card, ESTADO_REAL[estado])).fetchone()[0])
                ids[f'{nome}_{estado}_exec'] = con.execute(
                    'select e.numero_execucao from helena_v2.entrega e join helena_v2.etapa t on t.id=e.etapa_id where e.card_id=%s and t.estado=%s',
                    (card, ESTADO_REAL[estado])).fetchone()[0]
            ids[nome + '_rev'] = con.execute("select numero from helena_v2.execucao where card_id=%s and tipo='REVISOR'", (card,)).fetchone()[0]
            ids[nome + '_hist'] = str(con.execute('select id from helena_v2.historico where card_id=%s', (card,)).fetchone()[0])
    return banco, ids


def sv(banco):
    return banco.conectar('service_role')


def fundador(banco):
    return banco.conectar('authenticated')


def registrar(con, escopo, fontes, *, business='BIZ-003', agente='ISABELA', servico=None, card=None,
              texto='Texto aprovado com 3 chamadas.', afirmacoes=None, fatos=(), origem='AGENTE', autor='OLIVIA',
              exec_autor=None, chave=None, expira=None):
    afirmacoes = afirmacoes if afirmacoes is not None else [{'texto': texto, 'fontes': fontes}]
    return con.execute(
        'select helena_v2.registrar_resumo_memoria(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',
        (escopo, business, agente, servico, card, texto, Jsonb(afirmacoes), Jsonb(list(fatos)), Jsonb(fontes),
         origem, autor, exec_autor, chave or uuid4().hex, expira)).fetchone()[0]


def ent(ids, chave):
    return {'tipo': 'ENTREGA', 'ref': ids[chave]}


def ativar_agente(con, ids, rid, card='c3a', revisor='DANIEL'):
    return con.execute('select helena_v2.ativar_resumo_memoria(%s,%s,%s)', (rid, revisor, ids[card + '_rev'])).fetchone()[0]


def propor_e_ativar(con, ids, escopo='AGENTE_EMPRESA', card='c3a', card_id=None, **kw):
    """`card` é o NOME do card semeado (para a execução e a entrega); `card_id` é o uuid do escopo CARD."""
    kw.setdefault('exec_autor', ids[card + '_APROVADA_exec'])
    kw.setdefault('fontes', [ent(ids, card + '_APROVADA')])
    fontes = kw.pop('fontes')
    r = registrar(con, escopo, fontes, card=card_id, **kw)
    ativar_agente(con, ids, r['id'], card)
    return r


# ----------------------------------------------------------------------------------------------- fechamento
def test_tabelas_fechadas_ninguem_le_nem_escreve_direto(mundo):
    banco, ids = mundo
    for papel in ('anon', 'authenticated', 'service_role'):
        with banco.conectar(papel) as con:
            for tabela in ('memoria_resumo', 'memoria_resumo_fonte', 'memoria_trecho', 'memoria_uso'):
                with pytest.raises(E.InsufficientPrivilege):
                    con.execute(f'select * from helena_v2.{tabela}')
                with pytest.raises(E.InsufficientPrivilege):
                    con.execute(f'delete from helena_v2.{tabela}')
    with banco.conectar() as con:
        rls = con.execute("select relname, relrowsecurity from pg_class where relname like 'memoria\\_%' and relkind='r'").fetchall()
        assert len(rls) == 4 and all(r[1] for r in rls)


def test_funcoes_do_motor_so_para_service_role_e_do_fundador_so_para_authenticated(mundo):
    banco, ids = mundo
    with fundador(banco) as con:
        with pytest.raises(E.InsufficientPrivilege):
            con.execute("select helena_v2.ler_memoria_execucao('COORDENACAO',null,null,null,null)")
        with pytest.raises(E.InsufficientPrivilege):
            registrar(con, 'AGENTE_EMPRESA', [ent(ids, 'c3a_APROVADA')])
        assert con.execute('select helena_v2.listar_memorias_fundador()').fetchone()[0] == {'resumos': [], 'trechos': []}
    with sv(banco) as con:
        with pytest.raises(E.InsufficientPrivilege):
            con.execute('select helena_v2.listar_memorias_fundador()')
        with pytest.raises(E.InsufficientPrivilege):
            con.execute("select helena_v2._memoria_hash_fonte('ENTREGA','1')")
    with banco.conectar('anon') as con:
        with pytest.raises(E.InsufficientPrivilege):
            con.execute("select helena_v2.expirar_memorias()")


# ------------------------------------------------------------------------------------------ registrar
def test_registrar_valido_e_idempotente(mundo):
    banco, ids = mundo
    with sv(banco) as con:
        chave = 'chave-idem-0001'
        um = registrar(con, 'AGENTE_EMPRESA', [ent(ids, 'c3a_APROVADA')], exec_autor=ids['c3a_APROVADA_exec'], chave=chave)
        assert um['estado'] == 'PROPOSTO' and um['versao'] == 1 and um['novo'] is True and um['profundidade'] == 0
        de_novo = registrar(con, 'AGENTE_EMPRESA', [ent(ids, 'c3a_APROVADA')], exec_autor=ids['c3a_APROVADA_exec'], chave=chave)
        assert de_novo['id'] == um['id'] and de_novo['novo'] is False
        with pytest.raises(E.UniqueViolation, match='MEMORIA_IDEMPOTENCIA_DIVERGENTE'):
            registrar(con, 'AGENTE_EMPRESA', [ent(ids, 'c3a_APROVADA')], exec_autor=ids['c3a_APROVADA_exec'],
                      chave=chave, texto='Outro texto 3.')
    with banco.conectar() as con:
        assert con.execute('select count(*) from helena_v2.memoria_resumo_fonte').fetchone()[0] == 1
        assert con.execute('select ref_hash is not null from helena_v2.memoria_resumo_fonte').fetchone()[0]


@pytest.mark.parametrize('caso', ['sem_fontes', 'inexistente', 'outra_empresa', 'etapa_nao_aprovada', 'outro_card',
                                  'afirmacao_sem_fonte', 'afirmacao_fonte_nao_declarada', 'fonte_repetida',
                                  'empresa_inativa', 'checkpoint_em_empresa', 'decisao_de_outra_empresa',
                                  'decisao_encerrada', 'historico_em_escopo_geral', 'telegram_em_empresa'])
def test_registrar_recusa_fonte_ruim(mundo, caso):
    banco, ids = mundo
    base = dict(exec_autor=ids['c3a_APROVADA_exec'])
    casos = {
        'sem_fontes': (('AGENTE_EMPRESA', []), {}),
        'inexistente': (('AGENTE_EMPRESA', [{'tipo': 'ENTREGA', 'ref': '999999'}]), {}),
        'outra_empresa': (('AGENTE_EMPRESA', [ent(ids, 'c1_APROVADA')]), {}),
        'etapa_nao_aprovada': (('AGENTE_EMPRESA', [ent(ids, 'c3a_EXECUTANDO')]), {}),
        'outro_card': (('CARD', [ent(ids, 'c3b_APROVADA')]), dict(card=ids['c3a'], agente=None)),
        'afirmacao_sem_fonte': (('AGENTE_EMPRESA', [ent(ids, 'c3a_APROVADA')]), dict(afirmacoes=[{'texto': 'x', 'fontes': []}])),
        'afirmacao_fonte_nao_declarada': (('AGENTE_EMPRESA', [ent(ids, 'c3a_APROVADA')]),
                                          dict(afirmacoes=[{'texto': 'x', 'fontes': [ent(ids, 'c3b_APROVADA')]}])),
        'fonte_repetida': (('AGENTE_EMPRESA', [ent(ids, 'c3a_APROVADA'), ent(ids, 'c3a_APROVADA')]), {}),
        'empresa_inativa': (('AGENTE_EMPRESA', [ent(ids, 'c3a_APROVADA')]), dict(business='BIZ-999')),
        'checkpoint_em_empresa': (('AGENTE_EMPRESA', [{'tipo': 'CHECKPOINT', 'ref': 'CP-ATUAL'}]), {}),
        'decisao_de_outra_empresa': (('AGENTE_EMPRESA', [{'tipo': 'DECISAO', 'ref': 'DEC-001'}]), {}),
        'decisao_encerrada': (('AGENTE_EMPRESA', [{'tipo': 'DECISAO', 'ref': 'DEC-OLD'}]), {}),
        'historico_em_escopo_geral': (('FUNDADOR', [{'tipo': 'HISTORICO', 'ref': ids['c3a_hist']}]),
                                      dict(business=None, agente=None)),
        'telegram_em_empresa': (('AGENTE_EMPRESA', [{'tipo': 'TELEGRAM_PEDIDO', 'ref': '1'}]), {}),
    }
    (escopo, fontes), extra = casos[caso]
    with sv(banco) as con:
        with pytest.raises((E.CheckViolation, E.InvalidParameterValue)):
            registrar(con, escopo, fontes, **{**base, **extra})
    with banco.conectar() as con:
        assert con.execute('select count(*) from helena_v2.memoria_resumo').fetchone()[0] == 0


def test_card_precisa_ser_da_empresa_e_forma_do_escopo(mundo):
    banco, ids = mundo
    with sv(banco) as con:
        with pytest.raises(E.CheckViolation, match='MEMORIA_CARD_FORA_DA_EMPRESA'):
            registrar(con, 'CARD', [ent(ids, 'c1_APROVADA')], card=ids['c1'], exec_autor=ids['c3a_APROVADA_exec'])
        ok = registrar(con, 'CARD', [ent(ids, 'c3a_APROVADA')], card=ids['c3a'], agente=None,
                       exec_autor=ids['c3a_APROVADA_exec'])
        assert ok['versao'] == 1
        with pytest.raises(E.CheckViolation):          # FUNDADOR com empresa viola a forma do escopo
            registrar(con, 'FUNDADOR', [{'tipo': 'DECISAO', 'ref': 'DEC-GLOBAL'}], business='BIZ-003', agente=None,
                      exec_autor=ids['c3a_APROVADA_exec'])


def test_versoes_sobem_e_a_base_precisa_ser_a_ativa(mundo):
    banco, ids = mundo
    with sv(banco) as con:
        r1 = propor_e_ativar(con, ids)
        a = registrar(con, 'AGENTE_EMPRESA', [ent(ids, 'c3a_APROVADA')], exec_autor=ids['c3a_APROVADA_exec'])
        b = registrar(con, 'AGENTE_EMPRESA', [ent(ids, 'c3a_APROVADA')], exec_autor=ids['c3a_APROVADA_exec'],
                      texto='Outro texto com 3 chamadas.')
        assert (r1['versao'], a['versao'], b['versao']) == (1, 2, 3)
        ativar_agente(con, ids, a['id'])
        with pytest.raises(E.SerializationFailure, match='MEMORIA_BASE_DESATUALIZADA'):
            ativar_agente(con, ids, b['id'])
    with banco.conectar() as con:
        estados = dict(con.execute('select versao, estado from helena_v2.memoria_resumo').fetchall())
        assert estados == {1: 'SUPERADO', 2: 'ATIVO', 3: 'PROPOSTO'}


def test_profundidade_e_ancora(mundo):
    banco, ids = mundo
    with sv(banco) as con:
        c = registrar(con, 'CARD', [ent(ids, 'c3a_APROVADA')], card=ids['c3a'], agente=None, exec_autor=ids['c3a_APROVADA_exec'])
        ativar_agente(con, ids, c['id'])
        so_resumo = [{'tipo': 'RESUMO', 'ref': c['id']}]
        with pytest.raises(E.CheckViolation, match='MEMORIA_SEM_ANCORA_PRIMARIA'):
            registrar(con, 'AGENTE_EMPRESA', so_resumo, exec_autor=ids['c3a_APROVADA_exec'])
        n1 = registrar(con, 'AGENTE_EMPRESA', [*so_resumo, ent(ids, 'c3a_APROVADA')], exec_autor=ids['c3a_APROVADA_exec'])
        assert n1['profundidade'] == 1
        ativar_agente(con, ids, n1['id'])
        n2 = registrar(con, 'AGENTE_EMPRESA', [{'tipo': 'RESUMO', 'ref': n1['id']}, ent(ids, 'c3a_APROVADA')],
                       exec_autor=ids['c3a_APROVADA_exec'], texto='Segunda geração 3.')
        assert n2['profundidade'] == 2
        ativar_agente(con, ids, n2['id'])
        with pytest.raises(E.CheckViolation, match='MEMORIA_PROFUNDIDADE_EXCEDIDA'):
            registrar(con, 'AGENTE_EMPRESA', [{'tipo': 'RESUMO', 'ref': n2['id']}, ent(ids, 'c3a_APROVADA')],
                      exec_autor=ids['c3a_APROVADA_exec'], texto='Terceira geração 3.')
        # resumo de outra empresa não pode ser citado
        outro = registrar(con, 'CARD', [ent(ids, 'c1_APROVADA')], business='BIZ-001', card=ids['c1'], agente=None,
                          exec_autor=ids['c1_APROVADA_exec'])
        ativar_agente(con, ids, outro['id'], 'c1')
        with pytest.raises(E.CheckViolation, match='FORA_DE_ESCOPO'):
            registrar(con, 'AGENTE_EMPRESA', [{'tipo': 'RESUMO', 'ref': outro['id']}, ent(ids, 'c3a_APROVADA')],
                      exec_autor=ids['c3a_APROVADA_exec'], texto='Vazou 3.')


# --------------------------------------------------------------------------------------------- ativação
def test_revisao_independente_obrigatoria(mundo):
    banco, ids = mundo
    with sv(banco) as con:
        r = registrar(con, 'AGENTE_EMPRESA', [ent(ids, 'c3a_APROVADA')], exec_autor=ids['c3a_APROVADA_exec'])
        for revisor, execucao in (('OLIVIA', ids['c3a_rev']), (None, None), ('DANIEL', None),
                                  ('DANIEL', ids['c3a_APROVADA_exec'])):      # execução do tipo AUTOR não vale
            with pytest.raises(E.InsufficientPrivilege, match='MEMORIA_REVISAO_INDEPENDENTE_OBRIGATORIA'):
                con.execute('select helena_v2.ativar_resumo_memoria(%s,%s,%s)', (r['id'], revisor, execucao))
        assert ativar_agente(con, ids, r['id'])['estado'] == 'ATIVO'
        with pytest.raises(E.CheckViolation, match='MEMORIA_NAO_ESTA_PROPOSTA'):
            ativar_agente(con, ids, r['id'])


def test_origem_codigo_dispensa_revisor_mas_nao_aprovacao_do_fundador(mundo):
    banco, ids = mundo
    with sv(banco) as con:
        c = registrar(con, 'CARD', [ent(ids, 'c3a_APROVADA')], card=ids['c3a'], agente=None, origem='CODIGO',
                      autor=None, exec_autor=None)
        assert con.execute('select helena_v2.ativar_resumo_memoria(%s)', (c['id'],)).fetchone()[0]['estado'] == 'ATIVO'
        g = registrar(con, 'FUNDADOR', [{'tipo': 'DECISAO', 'ref': 'DEC-GLOBAL'}], business=None, agente=None,
                      origem='CODIGO', autor=None, exec_autor=None, texto='Prefere frases curtas.')
        with pytest.raises(E.InsufficientPrivilege, match='MEMORIA_EXIGE_APROVACAO_DO_FUNDADOR'):
            con.execute('select helena_v2.ativar_resumo_memoria(%s)', (g['id'],))
    with fundador(banco) as con:
        listado = con.execute('select helena_v2.listar_memorias_fundador()').fetchone()[0]
        assert {r['id'] for r in listado['resumos']} == {c['id'], g['id']}
        assert con.execute("select helena_v2.aprovar_memoria_fundador('RESUMO', %s)", (g['id'],)).fetchone()[0]['aprovado']
        with pytest.raises(E.CheckViolation, match='MEMORIA_NAO_APROVAVEL'):       # empresa não é aprovável aqui
            con.execute("select helena_v2.aprovar_memoria_fundador('RESUMO', %s)", (c['id'],))
    with sv(banco) as con:
        assert con.execute('select helena_v2.ativar_resumo_memoria(%s)', (g['id'],)).fetchone()[0]['estado'] == 'ATIVO'


def test_rejeitar_proposta(mundo):
    banco, ids = mundo
    with sv(banco) as con:
        r = registrar(con, 'AGENTE_EMPRESA', [ent(ids, 'c3a_APROVADA')], exec_autor=ids['c3a_APROVADA_exec'])
        assert con.execute('select helena_v2.rejeitar_resumo_memoria(%s,%s)', (r['id'], 'número sem fonte')).fetchone()[0]['estado'] == 'REJEITADO'
        with pytest.raises(E.CheckViolation):
            con.execute('select helena_v2.rejeitar_resumo_memoria(%s,%s)', (r['id'], 'de novo'))
        with pytest.raises(E.CheckViolation, match='MEMORIA_NAO_ESTA_PROPOSTA'):
            ativar_agente(con, ids, r['id'])


# ------------------------------------------------------------------------------------ escopo na leitura
def _cenario_de_escopos(con, ids):
    """Um resumo ATIVO de cada escopo/empresa; devolve {nome: id}."""
    out = {}
    out['a3'] = propor_e_ativar(con, ids, texto='Agente ISABELA na BIZ-003 usa 3 chamadas.')['id']
    out['c3a'] = propor_e_ativar(con, ids, 'CARD', card_id=ids['c3a'], agente=None, texto='Card A com 3 chamadas.')['id']
    out['c3b'] = propor_e_ativar(con, ids, 'CARD', card='c3b', card_id=ids['c3b'], agente=None,
                                 texto='Card B com 3 chamadas.')['id']
    out['caio3'] = propor_e_ativar(con, ids, agente='CAIO', texto='Caio na BIZ-003 usa 3 cenários.')['id']
    out['a1'] = propor_e_ativar(con, ids, business='BIZ-001', card='c1', fontes=[ent(ids, 'c1_APROVADA')],
                                exec_autor=ids['c1_APROVADA_exec'], texto='ISABELA na BIZ-001 usa 5 chamadas.')['id']
    fid = registrar(con, 'FUNDADOR', [{'tipo': 'DECISAO', 'ref': 'DEC-GLOBAL'}], business=None, agente=None,
                    origem='CODIGO', autor=None, exec_autor=None, texto='Prefere frases curtas.')['id']
    out['f'] = fid
    return out


def test_leitura_filtra_por_escopo_no_proprio_sql(mundo):
    banco, ids = mundo
    with sv(banco) as con:
        out = _cenario_de_escopos(con, ids)
        with fundador(banco) as f:
            f.execute("select helena_v2.aprovar_memoria_fundador('RESUMO', %s)", (out['f'],))
        con.execute('select helena_v2.ativar_resumo_memoria(%s)', (out['f'],))

        def ler(modo, agente, business, servico, card):
            lista = con.execute('select helena_v2.ler_memoria_execucao(%s,%s,%s,%s,%s)',
                                (modo, agente, business, servico, card)).fetchone()[0]
            return [r['id'] for r in lista]
        assert ler('EMPRESA', 'ISABELA', 'BIZ-003', 'SRV-COPY', ids['c3a']) == [out['c3a'], out['a3'], out['f']]
        assert ler('EMPRESA', 'ISABELA', 'BIZ-003', 'SRV-COPY', ids['c3b']) == [out['c3b'], out['a3'], out['f']]
        assert ler('EMPRESA', 'CAIO', 'BIZ-003', None, ids['c3a']) == [out['c3a'], out['caio3'], out['f']]
        assert ler('EMPRESA', 'ISABELA', 'BIZ-001', None, ids['c1']) == [out['a1'], out['f']]
        assert ler('EMPRESA', 'ISABELA', 'BIZ-003', None, None) == [out['a3'], out['f']]
        assert ler('COORDENACAO', 'HELENA', None, None, None) == [out['f']]
        assert ler('PESSOAL', 'LAURA', None, None, None) == [out['f']]
        for invalido in (('EMPRESA', 'ISABELA', None, None, None), ('EMPRESA', 'ISABELA', 'BIZ-001', None, ids['c3a']),
                         ('PESSOAL', 'LAURA', 'BIZ-003', None, None), ('PESSOAL', None, None, None, None),
                         ('COORDENACAO', 'HELENA', 'BIZ-003', None, None), ('TUDO', 'X', None, None, None)):
            with pytest.raises(E.InvalidParameterValue, match='MEMORIA_ESCOPO_INCONSISTENTE'):
                ler(*invalido)


def test_regra_de_escopo_do_sql_e_do_python_sao_a_mesma(banco):
    """Grade completa: o SQL e escopo_permite() dizem o mesmo para todas as combinações."""
    divergencias = []
    with banco.conectar() as con:
        U1, U2 = '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'
        for modo, agente, business, card in itertools.product(
                ('EMPRESA', 'PESSOAL', 'COORDENACAO'), ('ISABELA', 'LAURA', None), ('BIZ-003', 'BIZ-001', None), (U1, None)):
            try:
                ctx = ContextoDeEscopo(modo, agente=agente, business_id=business, servico='S1', card_id=card)
            except Exception:
                continue            # contexto incoerente nem chega a existir no Python; o SQL o recusa nas RPCs
            for escopo, rb, ra, rs, rc in itertools.product(
                    ('CARD', 'AGENTE_EMPRESA', 'FUNDADOR', 'PESSOAL'), ('BIZ-003', 'BIZ-001', None),
                    ('ISABELA', 'LAURA', None), ('S1', 'S2', None), (U1, U2, None)):
                forma_ok = ((escopo != 'CARD' or rc) and (escopo != 'AGENTE_EMPRESA' or (rb and ra and not rc))
                            and (escopo != 'FUNDADOR' or not (rb or ra or rs or rc))
                            and (escopo != 'PESSOAL' or (not rb and ra and not rs and not rc)))
                if not forma_ok:
                    continue        # combinação que as constraints de forma já proíbem na tabela
                item = Trecho('x', None, 't', escopo, rb, ra, rs, rc)
                py = escopo_permite(ctx, item)
                sql = con.execute(
                    'select helena_v2._memoria_escopo_permite(%s,%s,%s,%s,%s::uuid,%s,%s,%s,%s,%s::uuid)',
                    (modo, agente, business, 'S1', card, escopo, rb, ra, rs, rc)).fetchone()[0]
                if py != sql:
                    divergencias.append((modo, agente, business, card, escopo, rb, ra, rs, rc, py, sql))
    assert divergencias == []


def test_expirado_nao_e_lido_e_expirar_marca(mundo):
    banco, ids = mundo
    with sv(banco) as con:
        r = propor_e_ativar(con, ids, expira=datetime(2026, 10, 1, tzinfo=timezone.utc))
        lista = con.execute("select helena_v2.ler_memoria_execucao('EMPRESA','ISABELA','BIZ-003',null,null,%s)",
                            (datetime(2026, 9, 30, tzinfo=timezone.utc),)).fetchone()[0]
        assert [x['id'] for x in lista] == [r['id']]
        lista = con.execute("select helena_v2.ler_memoria_execucao('EMPRESA','ISABELA','BIZ-003',null,null,%s)",
                            (datetime(2026, 10, 2, tzinfo=timezone.utc),)).fetchone()[0]
        assert lista == []
        assert con.execute('select helena_v2.expirar_memorias(%s)', (datetime(2026, 10, 2, tzinfo=timezone.utc),)).fetchone()[0] == {'resumos': 1, 'trechos': 0}
    with banco.conectar() as con:
        assert con.execute('select estado from helena_v2.memoria_resumo').fetchone()[0] == 'EXPIRADO'


# --------------------------------------------------------------------------------------- imutabilidade
def test_versao_e_imutavel_e_nada_se_apaga(mundo):
    banco, ids = mundo
    with sv(banco) as con:
        r = propor_e_ativar(con, ids)
    with banco.conectar() as con:       # até o dono do banco de teste é barrado pelos gatilhos
        for sql in ("update helena_v2.memoria_resumo set texto='alterado'",
                    "update helena_v2.memoria_resumo set afirmacoes='[]'",
                    "update helena_v2.memoria_resumo set profundidade=1",
                    "update helena_v2.memoria_resumo set business_id='BIZ-001'",
                    "update helena_v2.memoria_resumo set estado='PROPOSTO'",
                    "update helena_v2.memoria_resumo set estado='ESQUECIDO'"):   # sem a função do fundador: texto ficaria
            if 'ESQUECIDO' in sql:
                con.execute(sql)        # transição válida; o texto não muda, só o estado (apagar é papel da função)
                con.execute("set session_replication_role='replica'")
                con.execute("update helena_v2.memoria_resumo set estado='ATIVO'")
                con.execute("set session_replication_role='origin'")
                continue
            with pytest.raises((E.InsufficientPrivilege, E.CheckViolation)):
                con.execute(sql)
        for sql in ('delete from helena_v2.memoria_resumo', 'truncate helena_v2.memoria_resumo_fonte',
                    'update helena_v2.memoria_resumo_fonte set ref=%s', 'delete from helena_v2.memoria_resumo_fonte'):
            with pytest.raises(E.InsufficientPrivilege, match='MEMORIA'):
                con.execute(sql, ('x',) if '%s' in sql else None)
        assert r['id']


def test_esquecer_apaga_texto_em_cascata_e_o_esquecido_nao_volta(mundo):
    banco, ids = mundo
    with sv(banco) as con:
        c = registrar(con, 'CARD', [ent(ids, 'c3a_APROVADA')], card=ids['c3a'], agente=None, exec_autor=ids['c3a_APROVADA_exec'])
        ativar_agente(con, ids, c['id'])
        filho = registrar(con, 'AGENTE_EMPRESA', [{'tipo': 'RESUMO', 'ref': c['id']}, ent(ids, 'c3a_APROVADA')],
                          exec_autor=ids['c3a_APROVADA_exec'], texto='Derivado 3.')
        ativar_agente(con, ids, filho['id'])
        outro = propor_e_ativar(con, ids, agente='CAIO', texto='Independente 3.')
    with fundador(banco) as f:
        with pytest.raises(E.InvalidParameterValue):
            f.execute("select helena_v2.esquecer_memoria_fundador('RESUMO', %s, '')", (c['id'],))
        r = f.execute("select helena_v2.esquecer_memoria_fundador('RESUMO', %s, 'pedido do fundador')", (c['id'],)).fetchone()[0]
        assert r['esquecidos'] == 2
        with pytest.raises(E.CheckViolation, match='MEMORIA_NADA_A_ESQUECER'):
            f.execute("select helena_v2.esquecer_memoria_fundador('RESUMO', %s, 'de novo')", (c['id'],))
    with banco.conectar() as con:
        linhas = {r[0]: r[1:] for r in con.execute(
            'select id::text, estado, texto, afirmacoes, motivo, encode(texto_hash,$$hex$$) is not null from helena_v2.memoria_resumo')}
        assert linhas[c['id']][:3] == ('ESQUECIDO', '', [])
        assert linhas[filho['id']][:2] == ('ESQUECIDO', '')
        assert linhas[outro['id']][0] == 'ATIVO'
        with pytest.raises(E.InsufficientPrivilege, match='MEMORIA_ESQUECIDA_E_DEFINITIVA'):
            con.execute("update helena_v2.memoria_resumo set estado='ESQUECIDO', motivo='x' where estado='ESQUECIDO'")
    with sv(banco) as con:
        lista = con.execute("select helena_v2.ler_memoria_execucao('EMPRESA','ISABELA','BIZ-003',null,%s)", (ids['c3a'],)).fetchone()[0]
        assert lista == []
        caio = con.execute("select helena_v2.ler_memoria_execucao('EMPRESA','CAIO','BIZ-003',null,null)").fetchone()[0]
        assert [x['id'] for x in caio] == [outro['id']]


# ----------------------------------------------------------------------------------------------- busca
def indexar(con, ids, texto, *, escopo='AGENTE_EMPRESA', business='BIZ-003', agente='ISABELA', card=None,
            tipo='ENTREGA', ref=None, ordem=0):
    return con.execute('select helena_v2.indexar_trecho_memoria(%s,%s,%s,%s,%s,%s,%s,%s,%s)',
                       (escopo, business, agente, None, card, tipo, ref or ids['c3a_APROVADA'], ordem, texto)).fetchone()[0]


def test_busca_textual_em_portugues_com_escopo_limite_e_orcamento(mundo):
    banco, ids = mundo
    with sv(banco) as con:
        a = indexar(con, ids, 'As campanhas de verão tiveram desconto de 12,5% para clientes antigos.')
        indexar(con, ids, 'Reunião sobre impostos do trimestre.', ordem=1)
        indexar(con, ids, 'A campanha da outra empresa tinha desconto de 30%.', business='BIZ-001',
                ref=ids['c1_APROVADA'])
        for i in range(8):
            indexar(con, ids, f'Campanha número {i} com desconto para clientes e ' + 'texto ' * 40, ordem=10 + i)
        assert indexar(con, ids, 'As campanhas de verão tiveram desconto de 12,5% para clientes antigos.')['novo'] is False
        achados = con.execute("select helena_v2.buscar_memoria('EMPRESA','ISABELA','BIZ-003',null,null,'campanha desconto',5)").fetchone()[0]
        assert len(achados) == 5                                                # limite respeitado
        todos = con.execute("select helena_v2.buscar_memoria('EMPRESA','ISABELA','BIZ-003',null,null,'campanha desconto',10)").fetchone()[0]
        assert a['id'] in [x['id'] for x in todos]                              # stemming: campanha/campanhas
        assert 'Reunião sobre impostos' not in json.dumps(todos, ensure_ascii=False)
        assert all(x['business_id'] == 'BIZ-003' and x['origem_tipo'] == 'ENTREGA' for x in achados)
        assert achados[0]['pontuacao'] >= achados[-1]['pontuacao']
        # teto de caracteres (≈ tokens): 300 caracteres só cabem os trechos curtos
        curto = con.execute("select helena_v2.buscar_memoria('EMPRESA','ISABELA','BIZ-003',null,null,'campanha desconto',10,300)").fetchone()[0]
        assert 0 < len(curto) < 5 and sum(len(x['texto']) for x in curto) <= 300
        # outra empresa nunca aparece, nem pesquisando o texto exato dela
        vazio = con.execute("select helena_v2.buscar_memoria('EMPRESA','ISABELA','BIZ-003',null,null,'30% outra empresa')").fetchone()[0]
        assert all(x['business_id'] == 'BIZ-003' for x in vazio)
        daOutra = con.execute("select helena_v2.buscar_memoria('EMPRESA','ISABELA','BIZ-001',null,null,'campanha desconto')").fetchone()[0]
        assert len(daOutra) == 1 and daOutra[0]['business_id'] == 'BIZ-001'
        # coordenação só vê o escopo do fundador (nada indexado): vazio
        assert con.execute("select helena_v2.buscar_memoria('COORDENACAO','HELENA',null,null,null,'campanha desconto')").fetchone()[0] == []
        # consulta vazia/ruído = nada; escopo incoerente = erro
        assert con.execute("select helena_v2.buscar_memoria('EMPRESA','ISABELA','BIZ-003',null,null,'   ')").fetchone()[0] == []
        assert con.execute("select helena_v2.buscar_memoria('EMPRESA','ISABELA','BIZ-003',null,null,'de a o')").fetchone()[0] == []
        with pytest.raises(E.InvalidParameterValue):
            con.execute("select helena_v2.buscar_memoria('EMPRESA','ISABELA',null,null,null,'campanha')")


def test_trecho_exige_fonte_do_escopo_e_fundador_aprova(mundo):
    banco, ids = mundo
    with sv(banco) as con:
        with pytest.raises(E.CheckViolation, match='FORA_DE_ESCOPO'):
            indexar(con, ids, 'Texto da outra empresa.', ref=ids['c1_APROVADA'])
        with pytest.raises(E.CheckViolation, match='FORA_DE_ESCOPO'):
            indexar(con, ids, 'Resumo não é origem.', tipo='RESUMO', ref=str(uuid4()))
        with pytest.raises(E.InvalidParameterValue):
            indexar(con, ids, 'x' * 1201)
        t = indexar(con, ids, 'Preferência: desconto sempre explícito na campanha.', escopo='FUNDADOR', business=None,
                    agente=None, tipo='DECISAO', ref='DEC-GLOBAL')
        antes = con.execute("select helena_v2.buscar_memoria('COORDENACAO','HELENA',null,null,null,'desconto campanha')").fetchone()[0]
        assert antes == []              # sem o "sim" do fundador não é lido
    with fundador(banco) as f:
        assert f.execute("select helena_v2.aprovar_memoria_fundador('TRECHO', %s)", (t['id'],)).fetchone()[0]['aprovado']
    with sv(banco) as con:
        depois = con.execute("select helena_v2.buscar_memoria('COORDENACAO','HELENA',null,null,null,'desconto campanha')").fetchone()[0]
        assert [x['id'] for x in depois] == [t['id']]
    with fundador(banco) as f:
        assert f.execute("select helena_v2.esquecer_memoria_fundador('TRECHO', %s, 'não vale mais')", (t['id'],)).fetchone()[0]['esquecidos'] == 1
    with sv(banco) as con:
        assert con.execute("select helena_v2.buscar_memoria('COORDENACAO','HELENA',null,null,null,'desconto campanha')").fetchone()[0] == []


# ------------------------------------------------------------------------------ uso, custo e fonte mudada
def test_uso_registra_hash_igual_ao_do_python_e_mede_custo(mundo):
    banco, ids = mundo
    with sv(banco) as con:
        r = propor_e_ativar(con, ids, texto='Texto aprovado com 3 chamadas.')
        t = indexar(con, ids, 'As campanhas tiveram desconto de 12,5%.')
        lista = con.execute("select helena_v2.ler_memoria_execucao('EMPRESA','ISABELA','BIZ-003',null,null)").fetchone()[0]
        from orquestrador.memoria import resumo_de_dict
        resumo = resumo_de_dict(lista[0])
        assert resumo.hash_texto == lista[0]['texto_hash']                      # Python e SQL: mesmo SHA-256
        import hashlib
        itens = [{'tipo': 'RESUMO', 'id': r['id'], 'versao': 1, 'hash': resumo.hash_texto, 'caracteres': 40},
                 {'tipo': 'TRECHO', 'id': t['id'], 'versao': None, 'hash': hashlib.sha256('As campanhas tiveram desconto de 12,5%.'.encode()).hexdigest(), 'caracteres': 38}]
        n = ids['c3a_APROVADA_exec']
        assert con.execute('select helena_v2.registrar_uso_memoria(%s,%s)', (n, Jsonb(itens))).fetchone()[0]['itens'] == 2
        con.execute('select helena_v2.registrar_uso_memoria(%s,%s)', (n, Jsonb(itens)))          # idempotente
        with pytest.raises(E.CheckViolation, match='MEMORIA_USO_HASH_DIVERGENTE'):
            con.execute('select helena_v2.registrar_uso_memoria(%s,%s)', (n, Jsonb([{**itens[0], 'hash': '0' * 64}])))
        with pytest.raises(E.InvalidParameterValue):
            con.execute('select helena_v2.registrar_uso_memoria(%s,%s)', (ids['c3a_rev'], Jsonb(itens)))   # revisor não recebe
    with banco.conectar() as con:
        con.execute("set session_replication_role='replica'")
        con.execute("insert into helena_v2.resposta_execucao (numero,resposta) values (%s,%s)",
                    (ids['c3a_APROVADA_exec'], Jsonb({'uso': {'tokens_entrada': 12345}})))
        con.execute("set session_replication_role='origin'")
    with sv(banco) as con:
        linha = con.execute('select * from helena_v2.medir_custo_memoria()').fetchall()
        assert len(linha) == 1 and linha[0][1] == 2 and linha[0][4] == 12345
    with banco.conectar() as con:
        con.execute("set session_replication_role='replica'")
        con.execute('delete from helena_v2.resposta_execucao where numero=%s', (ids['c3a_APROVADA_exec'],))
        con.execute("set session_replication_role='origin'")


def test_fonte_alterada_e_detectada(mundo):
    banco, ids = mundo
    with sv(banco) as con:
        propor_e_ativar(con, ids, fontes=[{'tipo': 'DECISAO', 'ref': 'DEC-GLOBAL'}, ent(ids, 'c3a_APROVADA')],
                        texto='Frases curtas e 3 chamadas.')
        assert con.execute('select count(*) from helena_v2.resumos_com_fonte_alterada()').fetchone()[0] == 0
    with banco.conectar() as con:
        con.execute("update public.decisoes set decisao='Frases longas.', row_version=2 where decision_id='DEC-GLOBAL'")
    with sv(banco) as con:
        alt = con.execute('select tipo, ref from helena_v2.resumos_com_fonte_alterada()').fetchall()
        assert alt == [('DECISAO', 'DEC-GLOBAL')]
    with banco.conectar() as con:
        con.execute("update public.decisoes set decisao='Frases curtas.', row_version=1 where decision_id='DEC-GLOBAL'")
