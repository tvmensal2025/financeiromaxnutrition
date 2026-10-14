"""Durabilidade do motor (teste 4 do plano, versão local com executor falso).

Prova, sem Hermes e sem gastar cota, que o card chega ao MESMO resultado final se o motor cair e voltar 20 vezes,
se a versão do código trocar 5 vezes no meio, e que dois motores no mesmo card não duplicam o trabalho.
O resultado final é comparado, linha a linha, com o de um card que nunca foi interrompido.
"""
import os
import random
import secrets
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

import pytest

import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict
from sqlalchemy.engine import URL

import orquestrador.motor as motor_mod
from conftest import RAIZ, servidor, suporte  # noqa: F401  (servidor é a fixture do cluster de teste)
from test_jornada import PLANO, Motor, _ate_execucao

# BANCOS PRÓPRIOS deste arquivo. Estes testes registram a configuração técnica, deixam workflows DBOS pendentes de
# processos mortos e criam muitos cards: se usassem o banco da sessão, quebrariam testes que vêm depois (por exemplo
# "sem revisão ativa o motor não faz bootstrap implícito", que exige um banco virgem).
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
    nome = 'helena_dbos_dur_' + secrets.token_hex(5)
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


# Estes testes são longos (minutos). Localmente dá para pular com HELENA_V2_PULAR_TESTES_LONGOS=1; o CI roda todos.
LONGO = pytest.mark.skipif(os.environ.get('HELENA_V2_PULAR_TESTES_LONGOS') == '1', reason='teste longo pulado por pedido')

REINICIOS_EXIGIDOS = 20
TROCAS_DE_VERSAO_EXIGIDAS = 5


def _toque_do_fundador(motor, card):
    """Faz o toque previsto do fundador, se o card estiver esperando por ele. Devolve o nome do toque ou None."""
    if motor._card(card)['estado'] == 'ESPERANDO_CONFIRMACAO':
        motor._evento('card', card, 'FUNDADOR', 'RESPONDER', {'opcao': 'CONFIRMO'},
                      toque='confirmar', nao_disparar=['PLANO_VALIDO'])
        return 'CONFIRMO'
    juridico = next((e for e in motor._etapas(card) if e['codigo'] == 'E4'), None)
    if juridico and juridico['estado'] == 'ESPERANDO_FUNDADOR':
        motor._evento('etapa', juridico['id'], 'FUNDADOR', 'APROVAR', toque='aprovar-parecer')
        return 'APROVAR'
    return None


def _um_passo(motor, card):
    """Um único passo do card (toque previsto do fundador ou um avanço do motor). Devolve o que fez."""
    if motor._card(card)['estado'] == 'PRONTO':
        return 'PRONTO'
    toque = _toque_do_fundador(motor, card)
    if toque:
        return toque
    assert motor.avancar(card), [(e['codigo'], e['estado']) for e in motor._etapas(card)]
    return 'AVANCOU'


def _impressao(motor, card):
    """O que resta no banco depois do card: tem de ser igual com ou sem interrupções."""
    with motor._con() as con:
        execucoes = con.execute(
            "SELECT tipo, estado, count(*) AS n FROM helena_v2.execucao WHERE card_id=%s GROUP BY 1,2 ORDER BY 1,2",
            (card,)).fetchall()
        entregas = con.execute(
            "SELECT etapa_codigo, versao, autor, portao1, count(*) AS n FROM helena_v2.entrega WHERE card_id=%s "
            "GROUP BY 1,2,3,4 ORDER BY 1,2,3,4", (card,)).fetchall()
        etapas = con.execute("SELECT codigo, estado FROM helena_v2.etapa WHERE card_id=%s AND atual ORDER BY codigo",
                             (card,)).fetchall()
        vivas = con.execute("SELECT count(*) AS n FROM helena_v2.execucao WHERE card_id=%s AND estado='VIVA'",
                            (card,)).fetchone()['n']
    return {'execucoes': execucoes, 'entregas': entregas, 'etapas': etapas, 'vivas': vivas,
            'estado': motor._card(card)['estado']}


def _rodar_card(banco, url_dbos, numero, *, reiniciar_a_cada=None, trocar_versao_a_cada=None, monkeypatch=None,
                reinicios_por_parada=1):
    """Conduz o card até PRONTO. `reiniciar_a_cada=N` derruba e recria o motor depois de cada N passos."""
    versao = 0
    reinicios = trocas = 0
    motor = Motor(banco.url, url_dbos)
    try:
        card = motor.criar_card(PLANO, numero)
        passos = 0
        for _ in range(400):
            if _um_passo(motor, card) == 'PRONTO':
                break
            passos += 1
            if reiniciar_a_cada and passos % reiniciar_a_cada == 0:
                for _ in range(reinicios_por_parada):
                    motor.fechar()                                  # "queda": o motor some; o estado fica no banco
                    reinicios += 1
                    if trocar_versao_a_cada and reinicios % trocar_versao_a_cada == 0 and trocas < TROCAS_DE_VERSAO_EXIGIDAS:
                        versao += 1
                        trocas += 1
                        monkeypatch.setattr(motor_mod, 'VERSAO_CODIGO', f'deploy-{versao}')    # "deploy": versão nova
                    motor = Motor(banco.url, url_dbos)
        else:
            raise AssertionError('o card não chegou a PRONTO em 400 passos')
        return {**_impressao(motor, card), 'reinicios': reinicios, 'trocas': trocas}
    finally:
        motor.fechar()


def _sem_numeros_de_execucao(impressao):
    return {k: v for k, v in impressao.items() if k not in ('reinicios', 'trocas')}


@LONGO
def test_vinte_reinicios_no_meio_do_card_dao_o_mesmo_resultado_de_um_card_sem_quedas(banco, url_dbos):
    referencia = _rodar_card(banco, url_dbos, 'durabilidade-sem-quedas')
    com_quedas = _rodar_card(banco, url_dbos, 'durabilidade-20-quedas', reiniciar_a_cada=1, reinicios_por_parada=2)
    assert referencia['estado'] == com_quedas['estado'] == 'PRONTO'
    assert com_quedas['reinicios'] >= REINICIOS_EXIGIDOS, com_quedas['reinicios']
    assert com_quedas['vivas'] == 0 and referencia['vivas'] == 0                       # nenhum resíduo
    assert _sem_numeros_de_execucao(com_quedas) == _sem_numeros_de_execucao(referencia)   # zero perda, zero duplicação


@LONGO
def test_cinco_trocas_de_versao_do_codigo_no_meio_do_card_dao_o_mesmo_resultado(banco, url_dbos, monkeypatch):
    referencia = _rodar_card(banco, url_dbos, 'versao-sem-troca')
    com_deploys = _rodar_card(banco, url_dbos, 'versao-5-deploys', reiniciar_a_cada=2, trocar_versao_a_cada=1,
                              monkeypatch=monkeypatch)
    assert com_deploys['trocas'] == TROCAS_DE_VERSAO_EXIGIDAS, com_deploys['trocas']
    assert com_deploys['vivas'] == 0
    assert _sem_numeros_de_execucao(com_deploys) == _sem_numeros_de_execucao(referencia)


@LONGO
def test_segundo_motor_no_mesmo_card_nao_duplica_a_execucao_do_agente(banco, url_dbos):
    """Dois motores disputam a mesma etapa ao mesmo tempo: no banco fica exatamente UMA execução do autor e UMA entrega."""
    primeiro, segundo = Motor(banco.url, url_dbos), Motor(banco.url, url_dbos)
    try:
        card = primeiro.criar_card(PLANO, 'dois-motores')
        etapa = _ate_execucao(primeiro, card)
        erros = []

        def disputar(motor):
            try:
                motor.executar_etapa(etapa['id'])
            except Exception as erro:                               # o perdedor pode recusar; o que importa é o banco
                erros.append(type(erro).__name__)

        threads = [threading.Thread(target=disputar, args=(m,)) for m in (primeiro, segundo)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=120)
        assert not any(t.is_alive() for t in threads)
        with primeiro._con() as con:
            autor = con.execute("SELECT count(*) AS n FROM helena_v2.execucao WHERE etapa_id=%s AND tipo='AUTOR' "
                                "AND estado IN ('RESPONDIDA','VIVA')", (etapa['id'],)).fetchone()['n']
            entregas = con.execute("SELECT count(*) AS n FROM helena_v2.entrega WHERE etapa_id=%s AND portao1='PASSOU'",
                                   (etapa['id'],)).fetchone()['n']
        print(f"\nsegundo motor: execuções do autor no banco={autor}, entregas aceitas={entregas}, "
              f"agente chamado {len(primeiro.executor.execucoes)}+{len(segundo.executor.execucoes)} vezes, erros={erros}")
        assert autor == 1 and entregas == 1
    finally:
        primeiro.fechar()
        segundo.fechar()


APOIO = Path(__file__).parent / 'apoio'
MORTES_EXIGIDAS = 20


def _lancar_motor_em_processo(banco, url_dbos, card, atraso_s):
    filho = subprocess.Popen(
        [sys.executable, str(APOIO / 'motor_em_processo.py'), banco.url, url_dbos, str(card), str(atraso_s)],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, start_new_session=True, env=os.environ.copy())
    return filho


def _esperar_linha(filho, texto, limite_s):
    """Espera o filho imprimir `texto`. Devolve False se ele morreu ou passou do limite."""
    achou = threading.Event()

    def ler():
        for linha in filho.stdout:
            if texto in linha:
                achou.set()
                return

    threading.Thread(target=ler, daemon=True).start()
    fim = time.monotonic() + limite_s
    while time.monotonic() < fim and filho.poll() is None and not achou.is_set():
        time.sleep(0.05)
    return achou.is_set()


@LONGO
def test_vinte_kill_9_de_processo_de_verdade_no_meio_do_card_dao_o_mesmo_resultado(banco, url_dbos):
    """Mata (SIGKILL) o processo do motor 20 vezes enquanto ele trabalha; o card termina igual ao de um sem mortes."""
    referencia = _rodar_card(banco, url_dbos, 'kill9-referencia')
    parente = Motor(banco.url, url_dbos)
    sorteio = random.Random(20261014)
    mortes = mortes_com_agente_vivo = lancamentos = 0
    try:
        card = parente.criar_card(PLANO, 'kill9-20-mortes')
        while lancamentos < 90 and parente._card(card)['estado'] != 'PRONTO':
            _toque_do_fundador(parente, card)
            if parente._card(card)['estado'] == 'PRONTO':
                break
            lancamentos += 1
            filho = _lancar_motor_em_processo(banco, url_dbos, card, atraso_s=0.8)
            try:
                assert _esperar_linha(filho, 'PRONTO_PARA_TRABALHAR', 90), 'o motor em processo não subiu'
                # metade das mortes cai logo na partida (queda sem progresso), metade deixa o motor trabalhar o bastante
                # (carregar a configuração leva alguns segundos num processo novo) para o card avançar de verdade
                janela = sorteio.uniform(0.5, 2.0) if sorteio.random() < 0.5 else sorteio.uniform(5.0, 11.0)
                fim = time.monotonic() + janela
                while time.monotonic() < fim and filho.poll() is None:
                    time.sleep(0.05)
                if filho.poll() is None:
                    with parente._con() as con:
                        viva = con.execute("SELECT count(*) AS n FROM helena_v2.execucao WHERE card_id=%s AND estado='VIVA'",
                                           (card,)).fetchone()['n']
                    os.killpg(filho.pid, signal.SIGKILL)
                    mortes += 1
                    mortes_com_agente_vivo += 1 if viva else 0
            finally:
                if filho.poll() is None:
                    os.killpg(filho.pid, signal.SIGKILL)
                filho.wait(timeout=30)
        estado_final = parente._card(card)['estado']
        final = _impressao(parente, card)
        print(f"\nkill -9: {mortes} mortes em {lancamentos} lançamentos ({mortes_com_agente_vivo} com agente em execução); "
              f"estado final {estado_final}")
        assert estado_final == 'PRONTO', (estado_final, lancamentos)
        assert mortes >= MORTES_EXIGIDAS, mortes
        assert final['etapas'] == referencia['etapas'] and final['vivas'] == 0
        assert final['entregas'] == referencia['entregas'], 'entrega perdida ou duplicada depois das mortes'
    finally:
        parente.fechar()
