"""O vigia, os alarmes por mais de um canal e as métricas (blocos 4 e 18 do plano, versão local).

Unidade (sem banco): canais que falham, repetição controlada, banco fora do ar, texto sem segredo, laço que não morre.
Banco: o vigia acha prazo vencido que o relógio deixou para trás e execução viva parada, e não acusa card sadio.
NÃO COMPROVADO aqui: canal realmente independente do servidor e aviso em até 15 minutos (teste 7, dia de prova).
"""
import json
import secrets
import threading
import time

import pytest
from psycopg.types.json import Jsonb

from conftest import suporte
from orquestrador import vigilancia as V
from orquestrador.vigilancia import (ALTA, Alarme, NotificadorDeArquivo, NotificadorFalso, Vigia, coletar_alarmes,
                                     coletar_metricas, limpar_texto)

SEGREDOS_FALSOS = ['postgresql://helena:SENHA_FALSA_123@db.exemplo.invalid:5432/postgres',
                   'sk-EXEMPLO_NAO_REAL_0123456789abcdef', 'eyJEXEMPLO12.NAOREALXYZ789.ASSINATURA123',
                   'password=SENHA_FALSA_123', 'Bearer EXEMPLO_NAO_REAL_abcdefghijklmnopqrstu']


class ConexaoDeMentira:
    """Devolve linhas combinadas por pedaço do SQL; entra e sai como uma conexão de verdade."""

    def __init__(self, respostas):
        self.respostas = respostas

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def execute(self, sql, args=()):
        for trecho, linhas in self.respostas.items():
            if trecho in sql:
                return _Cursor(linhas)
        return _Cursor([])


class _Cursor:
    def __init__(self, linhas):
        self.linhas = linhas

    def fetchall(self):
        return self.linhas


def _vigia(respostas, canais, **kw):
    return Vigia(lambda: ConexaoDeMentira(respostas), canais, **kw)


UM_PROBLEMA = {'helena_v2.vigia()': [('13', 'aaaaaaaa-0000-4000-8000-000000000001', 'campo formato diferente')]}


# --- texto sem segredo ---------------------------------------------------------------------------------------------
@pytest.mark.parametrize('segredo', SEGREDOS_FALSOS)
def test_limpar_texto_remove_segredos(segredo):
    saida = limpar_texto(f'falhou com {segredo} no meio')
    assert 'SENHA_FALSA' not in saida and 'EXEMPLO_NAO_REAL' not in saida and 'EXEMPLO12' not in saida
    assert 'REMOVIDO' in saida


def test_alarme_nasce_limpo_e_curto():
    alarme = Alarme('X', ALTA, 'erro ' + SEGREDOS_FALSOS[0], 'ref', detalhe='y' * 5000)
    assert 'SENHA_FALSA' not in alarme.resumo and len(alarme.detalhe) <= 300


# --- canais ---------------------------------------------------------------------------------------------------------
def test_alarme_vai_para_todos_os_canais():
    a, b = NotificadorFalso('a'), NotificadorFalso('b')
    resultado = _vigia(UM_PROBLEMA, [a, b]).uma_volta()
    assert resultado.alarmes == resultado.enviados == 1 and len(a.enviados) == len(b.enviados) == 1
    assert a.enviados[0].codigo == 'REGRA_13'


def test_canal_fora_do_ar_nao_cala_os_outros():
    fora, bom = NotificadorFalso('fora', falha=True), NotificadorFalso('bom')
    vigia = _vigia(UM_PROBLEMA, [fora, bom])
    resultado = vigia.uma_volta()
    assert resultado.enviados == 1 and resultado.canais_falhos == 1 and not resultado.sem_nenhum_canal
    assert len(bom.enviados) == 1 and vigia.metricas['canais_falhos'] == 1


def test_todos_os_canais_fora_do_ar_deixa_registro_sem_segredo_e_conta_metrica():
    registro = []
    canais = [NotificadorFalso('a', falha=True), NotificadorFalso('b', falha=True)]
    respostas = {'helena_v2.vigia()': [('13', None, 'veja ' + SEGREDOS_FALSOS[0])]}
    vigia = _vigia(respostas, canais, registrar=registro.append)
    resultado = vigia.uma_volta()
    assert resultado.sem_nenhum_canal and resultado.enviados == 0 and resultado.canais_falhos == 2
    assert vigia.metricas['voltas_sem_nenhum_canal'] == 1
    assert registro and all('SENHA_FALSA' not in linha for linha in registro) and 'ALARME SEM CANAL' in registro[0]


def test_sem_canal_nenhum_o_vigia_nem_nasce():
    with pytest.raises(ValueError, match='pelo menos um canal'):
        Vigia(lambda: ConexaoDeMentira({}), [])


# --- repetição controlada -------------------------------------------------------------------------------------------
def test_mesmo_alarme_nao_repete_dentro_da_janela_e_volta_depois():
    agora = [1000.0]
    canal = NotificadorFalso()
    vigia = _vigia(UM_PROBLEMA, [canal], repetir_a_cada_s=3600, relogio=lambda: agora[0])
    assert vigia.uma_volta().enviados == 1
    agora[0] += 300
    segunda = vigia.uma_volta()
    assert segunda.enviados == 0 and segunda.suprimidos == 1 and len(canal.enviados) == 1
    agora[0] += 3600
    assert vigia.uma_volta().enviados == 1 and len(canal.enviados) == 2


def test_alarme_que_sumiu_e_voltou_e_novo():
    agora = [0.0]
    canal = NotificadorFalso()
    respostas = dict(UM_PROBLEMA)
    vigia = _vigia(respostas, [canal], repetir_a_cada_s=3600, relogio=lambda: agora[0])
    vigia.uma_volta()
    respostas['helena_v2.vigia()'] = []                    # resolveu
    vigia.uma_volta()
    respostas['helena_v2.vigia()'] = UM_PROBLEMA['helena_v2.vigia()']     # voltou 5 minutos depois
    agora[0] += 300
    assert vigia.uma_volta().enviados == 1 and len(canal.enviados) == 2


# --- banco fora do ar -----------------------------------------------------------------------------------------------
def test_banco_fora_do_ar_vira_alarme_e_nao_derruba_a_volta():
    class Quebrada:
        def __enter__(self):
            raise ConnectionError('falha em ' + SEGREDOS_FALSOS[0])

        def __exit__(self, *_):
            return False

    canal = NotificadorFalso()
    vigia = Vigia(lambda: Quebrada(), [canal])
    resultado = vigia.uma_volta()
    assert resultado.erro_de_coleta and resultado.enviados == 1
    alarme = canal.enviados[0]
    assert alarme.codigo == 'VIGIA_SEM_BANCO' and 'SENHA_FALSA' not in alarme.detalhe + alarme.resumo
    assert vigia.metricas['voltas_com_erro_de_coleta'] == 1


# --- o laço ---------------------------------------------------------------------------------------------------------
def test_laco_roda_varias_voltas_e_sobrevive_a_uma_volta_que_estoura():
    canal, registro = NotificadorFalso(), []
    vigia = _vigia(UM_PROBLEMA, [canal], registrar=registro.append)
    original = vigia.uma_volta
    chamadas = {'n': 0}

    def com_defeito():
        chamadas['n'] += 1
        if chamadas['n'] == 2:
            raise RuntimeError('estourou com ' + SEGREDOS_FALSOS[1])
        return original()

    vigia.uma_volta = com_defeito
    parar = threading.Event()
    thread = threading.Thread(target=vigia.rodar, args=(parar, 0.05), daemon=True)
    thread.start()
    fim = time.monotonic() + 5
    while chamadas['n'] < 4 and time.monotonic() < fim:
        time.sleep(0.02)
    parar.set()
    thread.join(timeout=5)
    assert chamadas['n'] >= 4 and not thread.is_alive()
    assert any('ERRO NA VOLTA' in linha for linha in registro) and all('EXEMPLO_NAO_REAL' not in l for l in registro)


def test_canal_em_arquivo_grava_uma_linha_json_limpa(tmp_path):
    canal = NotificadorDeArquivo(tmp_path / 'pasta' / 'alarmes.jsonl')
    canal.enviar(Alarme('REGRA_13', ALTA, 'achado ' + SEGREDOS_FALSOS[0], 'card-1'))
    linhas = (tmp_path / 'pasta' / 'alarmes.jsonl').read_text(encoding='utf-8').splitlines()
    assert len(linhas) == 1 and json.loads(linhas[0])['codigo'] == 'REGRA_13' and 'SENHA_FALSA' not in linhas[0]


# --- com banco de verdade -------------------------------------------------------------------------------------------
@pytest.fixture()
def banco_do_vigia(servidor):
    banco = suporte.montar_banco(servidor, papeis_de_teste=suporte.PAPEIS_DE_TESTE)
    try:
        with banco.conectar() as con:                       # a chamada da coordenadora (como no banco do Motor)
            con.execute((suporte.MIGRACOES / '0008_resposta_coordenacao.sql').read_text(encoding='utf-8'))
        yield banco
    finally:
        suporte.derrubar_banco(banco)


import sorteio  # noqa: E402  (roteiro de uma etapa dos testes do banco; o conftest já pôs a pasta no caminho)

ROTEIRO = sorteio.ROTEIRO_UMA_ETAPA


def _novo_card(banco):
    with banco.conectar() as con:
        return con.execute("select helena_v2.criar_card('teste',%s,'pedido','Card',now()+interval '2 days',%s,%s)",
                           ('vigia-' + secrets.token_hex(5), Jsonb(ROTEIRO), 'BIZ-001')).fetchone()[0]['card_id']


def _como_servico(banco):
    return lambda: banco.conectar('service_role')


def test_card_sadio_nao_gera_alarme_e_metricas_leem_sem_erro(banco_do_vigia):
    _novo_card(banco_do_vigia)
    with banco_do_vigia.conectar('service_role') as con:
        assert coletar_alarmes(con) == []
        metricas = coletar_metricas(con)
    assert metricas['cards_por_estado'] and 'tokens_nas_ultimas_24h' in metricas
    assert Vigia(_como_servico(banco_do_vigia), [NotificadorFalso()]).uma_volta().alarmes == 0


def test_vigia_acha_prazo_vencido_e_execucao_parada(banco_do_vigia):
    card = _novo_card(banco_do_vigia)
    with banco_do_vigia.conectar('service_role') as servico:
        numero = servico.execute('select helena_v2.obter_chamada_coordenacao(%s::uuid)', (card,)).fetchone()[0]
    with banco_do_vigia.conectar() as dono:
        dono.execute("select set_config('helena_v2.funcao_unica', 'sim', false)")           # como um programa com defeito
        dono.execute("update helena_v2.card set prazo_ate = now() - interval '3 hours' where id = %s", (card,))
        dono.execute('alter table helena_v2.execucao disable trigger user')       # só neste banco descartável
        dono.execute("update helena_v2.execucao set iniciada_em = now() - interval '5 hours' where numero = %s", (numero,))
        dono.execute('alter table helena_v2.execucao enable trigger user')
    canal = NotificadorFalso()
    vigia = Vigia(_como_servico(banco_do_vigia), [canal])
    resultado = vigia.uma_volta()
    codigos = {a.codigo for a in canal.enviados}
    assert {'RELOGIO_ATRASADO', 'EXECUCAO_PARADA'} <= codigos, codigos
    assert resultado.enviados == len(canal.enviados) >= 2
    assert vigia.uma_volta().enviados == 0                                    # repetição controlada: segue calado
