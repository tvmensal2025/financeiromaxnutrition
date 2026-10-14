"""Despacho: fila com prioridade e vagas (WIP) do motor, contra PostgreSQL local e ExecutorFalso. Sem Hermes, sem cota.

Prova: a prioridade manda (e o fundador reordena), sem vaga nada é executado, dois despachantes com uma vaga nunca
rodam dois agentes juntos, a vaga volta sozinha quando o dono morre, e com 2 vagas duas execuções coexistem.
NÃO COMPROVADO aqui: dois PROCESSOS de sistema operacional disputando (aqui são duas threads, e o DBOS é um só por
processo); vaga mantida por minutos atrás de proxy/pooler real.
"""
import os
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone

import pytest

import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict
from psycopg.types.json import Jsonb
from sqlalchemy.engine import URL

from conftest import RAIZ, servidor, suporte  # noqa: F401  (servidor é a fixture do cluster de teste)
from executor_helena.executor_falso import ExecutorFalso, Roteiro
from orquestrador.despacho import (AVANCOU, CHAVE_BASE_PADRAO, COM_ERRO, ESPERANDO_VAGA, OCIOSO, TETO_DE_VIVAS,
                                   Despachante)
from test_durabilidade import _toque_do_fundador
from test_jornada import PLANO, PLANO_DOSSIE, Motor


# BANCOS PRÓPRIOS deste arquivo (mesmo motivo de test_durabilidade.py): o banco da sessão é compartilhado e estes
# testes deixam cards e workflows DBOS para trás.
@pytest.fixture(scope='module')
def banco(servidor):
    b = suporte.montar_banco(servidor, papeis_de_teste=suporte.PAPEIS_DE_TESTE)
    try:
        with b.conectar() as con:
            con.execute((RAIZ / 'supabase/migrations-v2/0008_resposta_coordenacao.sql').read_text(encoding='utf-8'))
        yield b
    finally:
        suporte.derrubar_banco(b)


@pytest.fixture(scope='module')
def url_dbos(servidor):
    nome = 'helena_dbos_dsp_' + secrets.token_hex(5)
    with psycopg.connect(servidor, autocommit=True) as con:
        con.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(nome)))
    args = conninfo_to_dict(servidor)
    url = URL.create('postgresql+psycopg', username=args.get('user'), password=args.get('password'),
                     host=args.get('host'), port=int(args['port']) if args.get('port') else None,
                     database=nome).render_as_string(hide_password=False)
    try:
        yield url
    finally:
        with psycopg.connect(servidor, autocommit=True) as con:
            con.execute(sql.SQL('DROP DATABASE IF EXISTS {} WITH (FORCE)').format(sql.Identifier(nome)))


LONGO = pytest.mark.skipif(os.environ.get('HELENA_V2_PULAR_TESTES_LONGOS') == '1', reason='teste longo pulado por pedido')


def _cancelar_cards_abertos(banco):
    with banco.conectar() as adm:
        abertos = adm.execute("SELECT c.id, c.versao FROM helena_v2.card c JOIN helena_v2.estado_def d "
                              "ON d.maquina = 'card' AND d.estado = c.estado WHERE NOT d.final").fetchall()
    with banco.conectar('authenticated') as fundador:
        for card, versao in abertos:
            fundador.execute("SELECT helena_v2.aplicar_evento('card', %s, 'FUNDADOR', 'CANCELAR', '{}'::jsonb, null, null, "
                             "%s, null, %s, true, '{}'::text[])", (card, versao, f'limpar-{card}'))


@pytest.fixture(autouse=True)
def fila_vazia(banco):
    """Cada teste começa e termina sem card aberto: a fila é do banco inteiro, então um resto estragaria o próximo."""
    _cancelar_cards_abertos(banco)
    yield
    _cancelar_cards_abertos(banco)


# --- ajudas ---------------------------------------------------------------------------------------------------------
def _toque_no_card(motor, card, evento, conteudo, toque):
    """Toque do fundador que muda um campo. Resultado normal é APLICADO ou REACAO (Motor._evento recusa REACAO)."""
    versao = motor._card(card)['versao']
    with motor._con('authenticated') as con:
        resposta = con.execute(
            "SELECT helena_v2.aplicar_evento('card', %s, 'FUNDADOR', %s, '{}'::jsonb, null, null, %s, %s, %s, true, '{}'::text[]) AS r",
            (card, evento, versao, Jsonb(conteudo), toque)).fetchone()['r']
    assert resposta['resultado'] in ('APLICADO', 'REACAO'), resposta


def _mudar_prioridade(motor, card, prioridade):
    _toque_no_card(motor, card, 'MUDAR_PRIORIDADE', {'prioridade': prioridade}, f'prio-{secrets.token_hex(4)}')


def _criar_cards(motor, prioridades, rotulo):
    """Um card por prioridade, NA ORDEM dada (o primeiro é o mais velho e, sem mudança, o de prazo mais cedo)."""
    ids = []
    for prioridade in prioridades:
        card = str(motor.criar_card(PLANO, f'{rotulo}-{secrets.token_hex(4)}'))
        if prioridade:
            _mudar_prioridade(motor, card, prioridade)
        ids.append(card)
    return ids


def _ordem(despachante):
    return [str(linha['id']) for linha in despachante.fila()]


def _foto(banco, card):
    """Estado, linhas de histórico e execuções do card: se nada mudou, o card não foi tocado."""
    with banco.conectar() as con:
        estado = con.execute('SELECT estado FROM helena_v2.card WHERE id = %s', (card,)).fetchone()[0]
        historico = con.execute('SELECT count(*) FROM helena_v2.historico WHERE card_id = %s', (card,)).fetchone()[0]
        execucoes = con.execute('SELECT count(*) FROM helena_v2.execucao WHERE card_id = %s', (card,)).fetchone()[0]
    return estado, historico, execucoes


def _dono_da_vaga(banco, chave):
    """Quem segura o advisory lock `chave` (o application_name da conexão dedicada), ou None se está livre."""
    with banco.conectar() as con:
        linha = con.execute(
            """SELECT a.application_name FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
               WHERE l.locktype = 'advisory' AND l.granted AND l.objsubid = 1
                 AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
                 AND ((l.classid::bigint << 32) | l.objid::bigint) = %s""", (chave,)).fetchone()
    return linha[0] if linha else None


def _esperar(condicao, limite_s=15.0):
    fim = time.monotonic() + limite_s
    while time.monotonic() < fim:
        if condicao():
            return True
        time.sleep(0.05)
    return condicao()


class ExecutorMedido(ExecutorFalso):
    """ExecutorFalso que conta quantas chamadas estão DENTRO ao mesmo tempo, demora `atraso_s` e, se `segurar`, só
    sai quando o teste soltar. `juntos` dispara quando `encontro` chamadas estão dentro ao mesmo tempo."""

    def __init__(self, ref, *, atraso_s=0.0, segurar=False, encontro=2):
        super().__init__(lambda execucao: Roteiro(texto=ref['motor']._texto_roteirizado(execucao), atraso_s=atraso_s))
        self.segurar, self.encontro = segurar, encontro
        self.dentro = self.max_dentro = 0
        self.entrou, self.juntos, self.soltar = threading.Event(), threading.Event(), threading.Event()
        self._medida = threading.Lock()

    def rodar(self, execucao):
        with self._medida:
            self.dentro += 1
            self.max_dentro = max(self.max_dentro, self.dentro)
            self.entrou.set()
            if self.dentro >= self.encontro:
                self.juntos.set()
        try:
            if self.segurar and not self.soltar.wait(60):
                raise TimeoutError('o teste não soltou a chamada')
            return super().rodar(execucao)
        finally:
            with self._medida:
                self.dentro -= 1


# --- 0. argumentos ----------------------------------------------------------------------------------------------------
@pytest.mark.parametrize('vagas', [0, -1, 65, True, 1.5, '2'])
def test_numero_de_vagas_invalido_e_recusado(vagas):
    with pytest.raises(ValueError):
        Despachante(object(), vagas=vagas)


# --- 1. a prioridade manda ----------------------------------------------------------------------------------------------
def test_card_de_prioridade_alta_avanca_primeiro_com_uma_vaga(banco, url_dbos):
    motor = Motor(banco.url, url_dbos)
    despachante = Despachante(motor, vagas=1, identidade='t1')
    try:
        # A baixa é a mais velha e tem o prazo mais cedo: sem a prioridade ela seria a escolhida.
        baixa, alta = _criar_cards(motor, [1, 5], 'prioridade')
        assert _ordem(despachante) == [alta, baixa]
        antes = _foto(banco, baixa)
        assert despachante.uma_rodada() == AVANCOU and despachante.ultimo_card == alta
        assert motor._card(alta)['estado'] == 'ESPERANDO_CONFIRMACAO'           # a Helena leu de volta o pedido da alta
        assert _foto(banco, baixa) == antes == ('RASCUNHO', antes[1], 0)         # a baixa nem foi tocada
        assert despachante.vaga is None                                          # a vaga volta no fim da rodada
        assert despachante.uma_rodada() == AVANCOU and despachante.ultimo_card == baixa
        assert motor._card(baixa)['estado'] == 'ESPERANDO_CONFIRMACAO'
        assert despachante.uma_rodada() == OCIOSO and despachante.ultimo_card is None   # os dois esperam o fundador
    finally:
        despachante.fechar()
        motor.fechar()


def test_empate_de_prioridade_desempata_por_prazo_e_depois_por_criacao(banco, url_dbos):
    motor = Motor(banco.url, url_dbos)
    despachante = Despachante(motor, vagas=1, identidade='t1b')
    try:
        c1, c2, c3 = _criar_cards(motor, [0, 0, 0], 'desempate')
        assert _ordem(despachante) == [c1, c2, c3]                              # prazos naturais crescem na ordem de criação
        cedo = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        for card in (c3, c2):
            _toque_no_card(motor, card, 'MUDAR_PRAZO', {'prazo': cedo}, f'prazo-{secrets.token_hex(4)}')
        assert _ordem(despachante) == [c2, c3, c1]                              # prazo mais cedo primeiro; igual: o mais velho
    finally:
        despachante.fechar()
        motor.fechar()


# --- 2. sem vaga, ninguém executa -------------------------------------------------------------------------------------
def test_card_de_baixa_so_avanca_quando_a_vaga_esta_livre(banco, url_dbos):
    ref = {}
    executor = ExecutorMedido(ref, segurar=True)
    motor = Motor(banco.url, url_dbos, executor=executor)
    ref['motor'] = motor
    dono, vizinho = Despachante(motor, vagas=1, identidade='dono'), Despachante(motor, vagas=1, identidade='vizinho')
    resultado, thread = [], None
    try:
        alta, baixa = _criar_cards(motor, [5, 1], 'vaga-ocupada')
        thread = threading.Thread(target=lambda: resultado.append(dono.uma_rodada()), daemon=True)
        thread.start()
        assert executor.entrou.wait(30), 'o dono não chegou a chamar o agente'
        assert dono.vaga == 0                                                   # segura a vaga ENQUANTO o agente trabalha
        antes = _foto(banco, baixa)
        for _ in range(3):
            assert vizinho.uma_rodada() == ESPERANDO_VAGA and vizinho.ultimo_card is None
        assert _foto(banco, baixa) == antes and antes[0] == 'RASCUNHO' and antes[2] == 0   # nada foi executado para a baixa
        executor.soltar.set()
        thread.join(60)
        assert resultado == [AVANCOU] and dono.ultimo_card == alta and dono.vaga is None
        assert vizinho.uma_rodada() == AVANCOU and vizinho.ultimo_card == baixa           # vaga livre: agora é a vez dela
        assert vizinho.metricas['esperando_vaga'] == 3
    finally:
        executor.soltar.set()
        if thread is not None:
            thread.join(60)
        dono.fechar()
        vizinho.fechar()
        motor.fechar()


# --- 3. dois despachantes, uma vaga -----------------------------------------------------------------------------------
def _amostrar(banco, parar, saida):
    """Olha o banco a cada ~20 ms: execuções VIVAS (e de quantos cards) e vagas seguradas agora."""
    with banco.conectar() as con:
        while not parar.is_set():
            linhas = con.execute("SELECT card_id, count(*) FROM helena_v2.execucao WHERE estado = 'VIVA' "
                                 "GROUP BY card_id").fetchall()
            vagas = con.execute(
                """SELECT count(*) FROM pg_locks l WHERE l.locktype = 'advisory' AND l.granted AND l.objsubid = 1
                     AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
                     AND ((l.classid::bigint << 32) | l.objid::bigint) BETWEEN %s AND %s""",
                (CHAVE_BASE_PADRAO, CHAVE_BASE_PADRAO + 63)).fetchone()[0]
            saida['amostras'] += 1
            saida['max_vivas'] = max(saida['max_vivas'], sum(n for _c, n in linhas))
            saida['max_cards_com_viva'] = max(saida['max_cards_com_viva'], len(linhas))
            saida['max_vagas_seguras'] = max(saida['max_vagas_seguras'], vagas)
            time.sleep(0.02)


# O plano de um serviço só (RAVI + ISABELA) tem, por card, no máximo UMA execução VIVA por vez: aí vale a frase
# literal "nunca duas execuções VIVAS". No plano principal a máquina de estados abre E1, E2 e E3 de uma vez (3 VIVAS no
# mesmo card, com o motor rodando um agente por vez) e abre outras sozinha quando o fundador toca: a linha de
# execuções VIVAS não mede "agentes rodando"; lá só se afirma o que se mede: agentes juntos e vagas seguradas.
@pytest.mark.parametrize('plano,literal', [
    pytest.param(PLANO_DOSSIE, True, id='plano_de_um_servico'),
    pytest.param(PLANO, False, marks=LONGO, id='plano_principal'),
])
def test_dois_despachantes_com_uma_vaga_nunca_rodam_dois_agentes_juntos_e_os_dois_cards_chegam_a_pronto(
        banco, url_dbos, plano, literal):
    ref = {}
    executor = ExecutorMedido(ref, atraso_s=0.5)              # o MESMO executor nos dois motores: o DBOS é um só por processo
    m1 = Motor(banco.url, url_dbos, executor=executor)
    m2 = Motor(banco.url, url_dbos, executor=executor)
    ref['motor'] = m2
    registro = []
    d1 = Despachante(m1, vagas=1, identidade='A', registrar=registro.append)
    d2 = Despachante(m2, vagas=1, identidade='B', registrar=registro.append)
    parar = threading.Event()
    amostra = {'amostras': 0, 'max_vivas': 0, 'max_cards_com_viva': 0, 'max_vagas_seguras': 0}
    threads = []
    estados = None
    inicio = time.monotonic()
    try:
        cards = [str(m1.criar_card(plano, f'dois-despachantes-{secrets.token_hex(4)}')) for _ in range(2)]
        threads = [threading.Thread(target=d.rodar, args=(parar, 0.05), daemon=True) for d in (d1, d2)]
        threads.append(threading.Thread(target=_amostrar, args=(banco, parar, amostra), daemon=True))
        for t in threads:
            t.start()
        limite = time.monotonic() + 600
        while time.monotonic() < limite:
            for card in cards:
                _toque_do_fundador(m1, card)                      # os únicos toques previstos: confirmar e aprovar o parecer
            estados = [m1._card(card)['estado'] for card in cards]
            if estados == ['PRONTO', 'PRONTO']:
                break
            time.sleep(0.1)
    finally:
        parar.set()
        for t in threads:
            t.join(60)
        m1.fechar()
        m2.fechar()
    espera = sum(d.metricas[k] for d in (d1, d2) for k in ('esperando_vaga', 'teto_de_vivas'))
    print(f"\ndois despachantes, 1 vaga, {time.monotonic() - inicio:.0f} s: amostras={amostra['amostras']} "
          f"max VIVAS no banco={amostra['max_vivas']} max cards com VIVA={amostra['max_cards_com_viva']} "
          f"max vagas seguradas={amostra['max_vagas_seguras']} max agentes juntos={executor.max_dentro} "
          f"rodadas sem vaga/teto={espera} avancos={d1.metricas['avancos']}+{d2.metricas['avancos']}")
    assert estados == ['PRONTO', 'PRONTO'], (estados, d1.metricas, d2.metricas, registro)
    assert not any(linha.startswith('ERRO') for linha in registro), registro
    assert executor.max_dentro == 1                               # NUNCA dois agentes ao mesmo tempo (medido dentro do executor)
    assert amostra['amostras'] > 20 and amostra['max_vivas'] >= 1  # o amostrador enxergava o banco de verdade
    assert amostra['max_vagas_seguras'] == 1                      # o banco nunca mostrou duas vagas seguradas (e viu uma)
    if literal:
        assert amostra['max_vivas'] == 1                          # NUNCA duas execuções VIVAS ao mesmo tempo
        assert amostra['max_cards_com_viva'] == 1
    assert espera > 0                                             # houve disputa de verdade: alguém ficou sem vaga
    assert d1.metricas['avancos'] + d2.metricas['avancos'] > 5


# --- 4. a vaga volta sozinha ---------------------------------------------------------------------------------------------
@pytest.mark.parametrize('morte', ['conexao_fechada_no_cliente', 'sessao_morta_no_servidor'])
def test_vaga_e_liberada_quando_a_conexao_do_dono_morre(banco, url_dbos, morte):
    motor = Motor(banco.url, url_dbos)
    dono = Despachante(motor, vagas=1, identidade='dono')
    espera = Despachante(motor, vagas=1, identidade='espera')
    try:
        (card,) = _criar_cards(motor, [0], 'dono-morre')
        assert dono.adquirir_vaga() == 0
        assert _dono_da_vaga(banco, CHAVE_BASE_PADRAO) == 'helena-despacho:dono'      # o banco diz quem segura
        antes = _foto(banco, card)
        assert espera.uma_rodada() == ESPERANDO_VAGA and _foto(banco, card) == antes   # com o dono vivo, nada acontece
        if morte == 'conexao_fechada_no_cliente':
            dono._conexao.close()
        else:                                                      # como um processo ou uma rede que cai: o cliente nem avisa
            with banco.conectar() as adm:
                adm.execute('SELECT pg_terminate_backend(%s)', (dono._conexao.info.backend_pid,))
        assert _esperar(lambda: _dono_da_vaga(banco, CHAVE_BASE_PADRAO) is None), 'o PostgreSQL não soltou a vaga'
        assert espera.uma_rodada() == AVANCOU and espera.ultimo_card == card         # ninguém limpou nada à mão
        assert motor._card(card)['estado'] == 'ESPERANDO_CONFIRMACAO'
        assert espera.adquirir_vaga() == 0
        assert dono.adquirir_vaga() is None and dono.vaga is None and dono.metricas['vagas_perdidas'] == 1   # o antigo dono não finge
    finally:
        espera.fechar()
        dono.fechar()
        motor.fechar()


# --- 5. o fundador reordena -----------------------------------------------------------------------------------------------
def test_mudar_prioridade_do_fundador_reordena_a_proxima_escolha(banco, url_dbos):
    motor = Motor(banco.url, url_dbos)
    despachante = Despachante(motor, vagas=1, identidade='t5')
    try:
        c1, c2, c3 = _criar_cards(motor, [1, 2, 3], 'reordena')
        assert _ordem(despachante) == [c3, c2, c1]
        assert despachante.uma_rodada() == AVANCOU and despachante.ultimo_card == c3
        _mudar_prioridade(motor, c1, 9)                            # o fundador sobe o mais velho e mais baixo
        assert _ordem(despachante) == [c1, c2]
        assert despachante.uma_rodada() == AVANCOU and despachante.ultimo_card == c1       # passou na frente do c2
        assert despachante.uma_rodada() == AVANCOU and despachante.ultimo_card == c2
        assert despachante.uma_rodada() == OCIOSO
        with motor._con() as con:                                   # a mudança é registro do fundador no histórico
            toques = con.execute("SELECT count(*) AS n FROM helena_v2.historico WHERE card_id = %s AND papel = 'FUNDADOR' "
                                 "AND evento = 'MUDAR_PRIORIDADE' AND resultado = 'REACAO'", (c1,)).fetchone()['n']
        assert toques == 2                                          # o 1 da criação e o 9 da reordenação
    finally:
        despachante.fechar()
        motor.fechar()


# --- 6. o limite é o parâmetro ---------------------------------------------------------------------------------------------
def test_com_duas_vagas_duas_execucoes_coexistem_e_a_terceira_espera(banco, url_dbos):
    ref = {}
    executor = ExecutorMedido(ref, segurar=True, encontro=2)
    motor = Motor(banco.url, url_dbos, executor=executor)
    ref['motor'] = motor
    a, b, c = (Despachante(motor, vagas=2, identidade=nome) for nome in ('a', 'b', 'c'))
    resultados, threads = [], []
    try:
        x, y = _criar_cards(motor, [5, 4], 'duas-vagas')
        threads = [threading.Thread(target=lambda d=d: resultados.append(d.uma_rodada()), daemon=True) for d in (a, b)]
        for t in threads:
            t.start()
        assert executor.juntos.wait(30), 'as duas execuções não ficaram vivas ao mesmo tempo'
        with banco.conectar() as con:
            cards_vivos = con.execute("SELECT count(DISTINCT card_id) FROM helena_v2.execucao WHERE estado = 'VIVA'").fetchone()[0]
        assert cards_vivos == 2 and executor.max_dentro == 2        # dois agentes dentro, dois cards com execução VIVA
        assert sorted([a.vaga, b.vaga]) == [0, 1]                   # cada um com a sua vaga
        assert c.uma_rodada() == ESPERANDO_VAGA                     # a terceira espera: o limite é o número de vagas
        executor.soltar.set()
        for t in threads:
            t.join(60)
        assert resultados == [AVANCOU, AVANCOU]
        assert {a.ultimo_card, b.ultimo_card} == {x, y}             # um card para cada dono de vaga
        assert c.uma_rodada() == OCIOSO                             # vagas livres de novo; os dois esperam o fundador
    finally:
        executor.soltar.set()
        for t in threads:
            t.join(60)
        for d in (a, b, c):
            d.fechar()
        motor.fechar()


# --- 7 a 9. defesas -------------------------------------------------------------------------------------------------------
class MotorComCardRuim(Motor):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.ruins = set()

    def avancar(self, card_id):
        if str(card_id) in self.ruins:
            raise RuntimeError('card com defeito (simulado)')
        return super().avancar(card_id)


def test_card_com_defeito_nao_trava_os_de_prioridade_menor(banco, url_dbos):
    motor = MotorComCardRuim(banco.url, url_dbos)
    agora, linhas = [1000.0], []
    despachante = Despachante(motor, vagas=1, identidade='t7', registrar=linhas.append, relogio=lambda: agora[0],
                              espera_apos_erro_s=30)
    try:
        ruim, bom = _criar_cards(motor, [9, 1], 'defeito')
        motor.ruins.add(ruim)
        assert despachante.uma_rodada() == AVANCOU and despachante.ultimo_card == bom   # o de prioridade 9 falhou; o seguinte andou
        assert despachante.metricas['erros'] == 1 and len(linhas) == 1 and 'card com defeito' in linhas[0]
        assert despachante.uma_rodada() == OCIOSO                   # o ruim está de castigo (não repete o erro a cada volta)
        agora[0] += 31
        assert despachante.uma_rodada() == COM_ERRO                 # castigo acabou: tenta de novo e o erro volta a aparecer
        assert despachante.metricas['erros'] == 2
    finally:
        despachante.fechar()
        motor.fechar()


def test_teto_de_execucoes_vivas_no_banco_segura_o_inicio_de_outro_card(banco, url_dbos):
    """Segunda defesa: mesmo com a vaga livre, não começa card novo se OUTRO card já tem execução viva."""
    motor = Motor(banco.url, url_dbos)
    despachante = Despachante(motor, vagas=1, identidade='t9b')
    rival = Despachante(motor, vagas=1, identidade='rival')
    try:
        (outro,) = _criar_cards(motor, [0], 'teto-outro')
        # O que o avanço faz primeiro: abre a chamada da Helena (execução VIVA). Parar aqui é a queda antes do agente rodar.
        motor._linha('SELECT helena_v2.obter_chamada_coordenacao(%s::uuid) AS chave', (outro,))
        rival._conexao_viva()
        assert rival._reservar_card(outro)                           # outro dono de vaga está com esse card agora
        (novo,) = _criar_cards(motor, [9], 'teto-novo')
        antes = _foto(banco, novo)
        assert despachante.uma_rodada() == TETO_DE_VIVAS and despachante.ultimo_card is None
        assert _foto(banco, novo) == antes                           # o card novo, mesmo com prioridade 9, não foi tocado
        assert despachante.metricas['cards_ocupados'] == 1 and despachante.metricas['teto_de_vivas'] == 1
        rival._soltar_card(outro)
        # A execução viva do PRÓPRIO card não conta contra ele: é a que precisa ser retomada. O novo continua esperando.
        assert despachante.uma_rodada() == AVANCOU and despachante.ultimo_card == outro
        assert _foto(banco, novo) == antes
        assert despachante.uma_rodada() == AVANCOU and despachante.ultimo_card == novo   # sem VIVA em outro card, o novo anda
    finally:
        rival.fechar()
        despachante.fechar()
        motor.fechar()


def test_execucao_viva_do_proprio_card_nao_trava_a_retomada_nem_e_ultrapassada(banco, url_dbos):
    """Card em andamento (E1, E2 e E3 abertas de uma vez) segue na frente de um card novo de prioridade maior."""
    motor = Motor(banco.url, url_dbos)
    despachante = Despachante(motor, vagas=1, identidade='t9a')
    try:
        (andando,) = _criar_cards(motor, [0], 'em-voo')
        assert despachante.uma_rodada() == AVANCOU                  # coordenação
        assert _toque_do_fundador(motor, andando) == 'CONFIRMO'
        assert despachante.uma_rodada() == AVANCOU                  # plano válido: a máquina abre as execuções
        assert motor._card(andando)['estado'] == 'EM_ANDAMENTO'
        with banco.conectar() as con:
            vivas = con.execute("SELECT count(*) FROM helena_v2.execucao WHERE card_id = %s AND estado = 'VIVA'", (andando,)).fetchone()[0]
        assert vivas >= 1
        (novo,) = _criar_cards(motor, [9], 'ultrapassa')
        assert _ordem(despachante)[0] == novo                       # pela prioridade, o novo estaria na frente
        antes = _foto(banco, novo)
        assert despachante.uma_rodada() == AVANCOU and despachante.ultimo_card == andando   # mas o em voo não é ultrapassado
        assert _foto(banco, novo) == antes
    finally:
        despachante.fechar()
        motor.fechar()


# --- 10. o laço ---------------------------------------------------------------------------------------------------------------
def test_rodar_sobrevive_a_erro_avanca_e_ao_parar_solta_a_vaga(banco, url_dbos):
    motor = Motor(banco.url, url_dbos)
    chamadas, linhas = [0], []
    original = motor._con

    def con_instavel(papel='service_role'):
        chamadas[0] += 1
        if chamadas[0] <= 2:
            raise psycopg.OperationalError('banco fora do ar (simulado)')
        return original(papel)

    despachante = Despachante(motor, vagas=1, identidade='t10', registrar=linhas.append)
    parar = threading.Event()
    thread = threading.Thread(target=despachante.rodar, args=(parar, 0.05), daemon=True)
    try:
        (card,) = _criar_cards(motor, [0], 'laco')
        motor._con = con_instavel                                   # as 2 primeiras conexões do laço falham
        thread.start()
        assert _esperar(lambda: _foto(banco, card)[0] == 'ESPERANDO_CONFIRMACAO', 60), linhas   # o laço seguiu e avançou o card
        assert len([l for l in linhas if l.startswith('ERRO NA RODADA')]) == 2 and thread.is_alive()
        parar.set()
        thread.join(30)
        assert not thread.is_alive()
        assert _dono_da_vaga(banco, CHAVE_BASE_PADRAO) is None      # ao parar, a vaga volta
        assert despachante._conexao is None
    finally:
        parar.set()
        thread.join(30)
        motor._con = original
        despachante.fechar()
        motor.fechar()
