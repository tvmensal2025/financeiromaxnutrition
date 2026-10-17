"""O vigia, os alarmes por mais de um canal e as métricas (blocos 4 e 18 do plano, versão local).

Unidade (sem banco): canais que falham, repetição controlada, banco fora do ar, texto sem segredo, laço que não morre.
Banco: o vigia acha prazo vencido que o relógio deixou para trás e execução viva parada, e não acusa card sadio.
Canal por webhook (servidor http.server local numa thread): entrega, 500, redirecionamento, timeout, URL que nunca
aparece em erro/repr/traceback, URL remota sem https recusada, variável ausente = erro no construtor sem rede.
Banco: a sessão marcada somente leitura (como o `vigiar` abre) continua lendo tudo e recusa qualquer escrita.
NÃO COMPROVADO aqui: canal realmente independente do servidor e aviso em até 15 minutos (teste 7, dia de prova);
entrega num fornecedor real de webhook (HTTPS de verdade, certificado de verdade).
"""
import json
import secrets
import socket
import threading
import time
import traceback
import urllib.request

import psycopg
import pytest
from psycopg.types.json import Jsonb

from apoio.servidor_webhook import ServidorWebhook
from conftest import suporte
from orquestrador import vigilancia as V
from orquestrador.vigilancia import (ALTA, Alarme, ErroDeWebhook, NotificadorDeArquivo, NotificadorFalso,
                                     NotificadorHttp, Vigia, coletar_alarmes, coletar_metricas, limpar_texto)

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


def test_metricas_contam_tokens_da_coordenacao_autor_e_revisor():
    class Cursor:
        def __init__(self, linhas):
            self.linhas = linhas

        def fetchall(self):
            return self.linhas

        def fetchone(self):
            return self.linhas[0]

    class Banco:
        def __init__(self):
            self.leituras = []

        def execute(self, consulta, args=()):
            if 'SELECT tipo, estado, count(*)' in consulta:
                return Cursor([])
            if 'SELECT avg(extract' in consulta:
                return Cursor([(None,)])
            if 'SELECT motivo, count(*)' in consulta or 'SELECT estado, count(*)' in consulta:
                return Cursor([])
            if 'SELECT numero, tipo FROM helena_v2.execucao' in consulta:
                return Cursor([(1, 'HELENA'), (2, 'AUTOR'), (3, 'REVISOR')])
            self.leituras.append((consulta, args[0]))
            if 'ler_resposta_coordenacao' in consulta:
                return Cursor([{'r': {'evidencias': {'uso': {'tokens_total': 30}}}}])
            uso = ({'uso': {'tokens_total': 10}} if args[0] == 2
                   else {'evidencias': {'uso': {'tokens_total': 20}}})
            return Cursor([{'r': uso}])

    banco = Banco()
    metricas = coletar_metricas(banco)
    assert metricas['tokens_nas_ultimas_24h'] == 60
    assert metricas['execucoes_com_uso_registrado'] == 3
    assert banco.leituras[0][0] == 'SELECT helena_v2.ler_resposta_coordenacao(%s) AS r'


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


# --- canal por webhook ----------------------------------------------------------------------------------------------
VARIAVEL = 'HELENA_V2_ALARME_WEBHOOK_URL'
SEGREDO_DA_URL = 'TOKEN_SECRETO_DA_URL_9f3a7c'
UM_ALARME = Alarme('REGRA_13', ALTA, 'achado no card', 'card-1', detalhe='isto não vai no corpo')


def _canal(url, **opcoes):
    """Canal de TESTE: só o teste liga `permitir_local`; o comando `vigiar` nunca liga."""
    return NotificadorHttp(ambiente={VARIAVEL: url}, permitir_local=True, **opcoes)


def _textos_do_erro(erro, canal=None):
    texto = [str(erro), repr(erro), ''.join(traceback.format_exception(erro))]
    if canal is not None:
        texto += [str(canal), repr(canal)]
    return '\n'.join(texto)


@pytest.fixture()
def sem_rede(monkeypatch):
    """Qualquer tentativa de rede derruba o teste: usada onde o canal tem de recusar ANTES de tocar na rede."""
    def proibido(*_, **__):
        pytest.fail('o canal tentou usar a rede')
    monkeypatch.setattr(socket.socket, 'connect', proibido)
    monkeypatch.setattr(socket, 'create_connection', proibido)
    monkeypatch.setattr(urllib.request.OpenerDirector, 'open', proibido)


@pytest.mark.parametrize('status', [200, 201, 204])
def test_webhook_2xx_e_entregue_e_o_corpo_leva_so_os_quatro_campos(status):
    with ServidorWebhook(status) as servidor:
        _canal(servidor.url('/hook/abc')).enviar(UM_ALARME)
    (metodo, caminho, cabecalhos, corpo), = servidor.recebidos
    assert metodo == 'POST' and caminho == '/hook/abc'
    assert cabecalhos['Content-Type'].startswith('application/json')
    assert json.loads(corpo) == {'codigo': 'REGRA_13', 'gravidade': 'ALTA', 'resumo': 'achado no card', 'referencia': 'card-1'}


def test_webhook_referencia_vazia_vai_como_null():
    with ServidorWebhook() as servidor:
        _canal(servidor.url()).enviar(Alarme('VIGIA_SEM_BANCO', ALTA, 'sem banco'))
    assert json.loads(servidor.recebidos[0][3])['referencia'] is None


def test_webhook_corpo_passa_por_limpar_texto_mesmo_se_o_alarme_chegar_sujo():
    alarme = Alarme('REGRA_13', ALTA, 'ok', 'card-1')
    object.__setattr__(alarme, 'resumo', 'falhou com ' + SEGREDOS_FALSOS[0])        # contorna o __post_init__ de propósito
    object.__setattr__(alarme, 'referencia', SEGREDOS_FALSOS[1])
    with ServidorWebhook() as servidor:
        _canal(servidor.url()).enviar(alarme)
    corpo = servidor.recebidos[0][3]
    assert 'SENHA_FALSA' not in corpo and 'EXEMPLO_NAO_REAL' not in corpo and 'REMOVIDO' in corpo


@pytest.mark.parametrize('status', [400, 401, 404, 429, 500, 503])
def test_webhook_fora_de_2xx_levanta_e_mostra_so_o_codigo(status):
    with ServidorWebhook(status) as servidor:
        canal = _canal(servidor.url('/hook/' + SEGREDO_DA_URL))
        with pytest.raises(ErroDeWebhook, match=f'HTTP {status}') as erro:
            canal.enviar(UM_ALARME)
    assert SEGREDO_DA_URL not in _textos_do_erro(erro.value, canal) and f':{servidor.porta}' not in _textos_do_erro(erro.value, canal)


@pytest.mark.parametrize('status', [301, 302, 303, 307, 308])
def test_webhook_nao_segue_redirecionamento(status):
    with ServidorWebhook() as outro, ServidorWebhook(status, redirecionar_para=outro.url('/destino')) as origem:
        with pytest.raises(ErroDeWebhook, match=f'HTTP {status}'):
            _canal(origem.url('/hook/' + SEGREDO_DA_URL)).enviar(UM_ALARME)
    assert len(origem.recebidos) == 1 and outro.recebidos == []          # o aviso nunca foi reenviado para outro endereço


def test_webhook_timeout_levanta_sem_esperar_a_resposta():
    with ServidorWebhook(segurar_s=3.0) as servidor:
        canal = _canal(servidor.url('/hook/' + SEGREDO_DA_URL), timeout_s=0.3)
        inicio = time.monotonic()
        with pytest.raises(ErroDeWebhook, match='a tempo') as erro:
            canal.enviar(UM_ALARME)
        assert time.monotonic() - inicio < 2.5
    assert SEGREDO_DA_URL not in _textos_do_erro(erro.value, canal)


def test_webhook_timeout_padrao_e_de_5_segundos_e_vai_para_a_chamada_de_rede(monkeypatch):
    usados = []

    def falsa(self, pedido, data=None, timeout=None):
        usados.append(timeout)
        raise OSError('sem rede de verdade neste teste')
    monkeypatch.setattr(urllib.request.OpenerDirector, 'open', falsa)
    canal = _canal('http://127.0.0.1:9/hook')
    assert canal.timeout_s == 5 and V.TIMEOUT_DO_WEBHOOK_S == 5
    with pytest.raises(ErroDeWebhook):
        canal.enviar(UM_ALARME)
    assert usados == [5]


def test_webhook_conexao_recusada_levanta_sem_mostrar_a_url():
    with socket.socket() as livre:
        livre.bind(('127.0.0.1', 0))
        porta = livre.getsockname()[1]                      # ninguém escuta nesta porta depois que o socket fecha
    canal = _canal(f'http://127.0.0.1:{porta}/hook/{SEGREDO_DA_URL}')
    with pytest.raises(ErroDeWebhook, match='não pôde ser contatado') as erro:
        canal.enviar(UM_ALARME)
    assert SEGREDO_DA_URL not in _textos_do_erro(erro.value, canal) and str(porta) not in _textos_do_erro(erro.value, canal)


def test_webhook_https_contra_servidor_sem_tls_falha_e_nao_mostra_a_url():
    with ServidorWebhook() as servidor:                     # fala http puro: o aperto de mão TLS tem de falhar
        canal = NotificadorHttp(ambiente={VARIAVEL: f'https://127.0.0.1:{servidor.porta}/hook/{SEGREDO_DA_URL}'}, timeout_s=2)
        with pytest.raises(ErroDeWebhook) as erro:
            canal.enviar(UM_ALARME)
    assert SEGREDO_DA_URL not in _textos_do_erro(erro.value, canal)


def test_erro_do_webhook_nao_encadeia_a_excecao_de_rede():
    with ServidorWebhook(500) as servidor:
        with pytest.raises(ErroDeWebhook) as erro:
            _canal(servidor.url('/hook/' + SEGREDO_DA_URL)).enviar(UM_ALARME)
    assert erro.value.__cause__ is None and erro.value.__context__ is None


def test_repr_e_str_do_canal_nunca_mostram_a_url():
    canal = _canal(f'http://127.0.0.1:1234/hook/{SEGREDO_DA_URL}')
    assert SEGREDO_DA_URL not in repr(canal) + str(canal) and VARIAVEL in repr(canal)


@pytest.mark.parametrize('url', [
    f'http://exemplo.invalid/hook/{SEGREDO_DA_URL}',        # remota sem https
    f'http://127.0.0.1.exemplo.invalid/{SEGREDO_DA_URL}',   # parece local, não é
    f'http://localhost.exemplo.invalid/{SEGREDO_DA_URL}',
    f'http://localhost@exemplo.invalid/{SEGREDO_DA_URL}',   # o host de verdade vem depois do @
    f'http://[::1]:8080/{SEGREDO_DA_URL}',                  # só 127.0.0.1 e localhost
    f'ftp://exemplo.invalid/{SEGREDO_DA_URL}',
    f'file:///etc/{SEGREDO_DA_URL}',
    f'//exemplo.invalid/{SEGREDO_DA_URL}',
    f'exemplo.invalid/{SEGREDO_DA_URL}',
    f'https:///{SEGREDO_DA_URL}',                           # sem host
    f'https://usuario:senha@exemplo.invalid/{SEGREDO_DA_URL}',   # credencial embutida
    f'https://exemplo.invalid:porta-ruim/{SEGREDO_DA_URL}',
])
def test_webhook_recusa_url_que_nao_e_https_remota_sem_tocar_na_rede(sem_rede, url):
    with pytest.raises(ValueError) as erro:
        NotificadorHttp(ambiente={VARIAVEL: url}, permitir_local=True)
    texto = _textos_do_erro(erro.value)
    assert SEGREDO_DA_URL not in texto and 'exemplo.invalid' not in texto and VARIAVEL in texto


def test_webhook_http_local_so_com_permissao_explicita_de_teste(sem_rede):
    for local in ('http://127.0.0.1:8080/hook', 'http://localhost:8080/hook'):
        with pytest.raises(ValueError, match='só https://'):
            NotificadorHttp(ambiente={VARIAVEL: local})                       # padrão: recusado
        NotificadorHttp(ambiente={VARIAVEL: local}, permitir_local=True)      # teste local: aceito


def test_webhook_https_remoto_e_aceito_no_construtor_sem_abrir_conexao(sem_rede):
    assert NotificadorHttp(ambiente={VARIAVEL: 'https://exemplo.invalid/hook'}).nome == 'webhook'


@pytest.mark.parametrize('valor', [None, '', '   '])
def test_webhook_sem_a_variavel_e_erro_claro_no_construtor_sem_rede(sem_rede, valor):
    ambiente = {} if valor is None else {VARIAVEL: valor}
    with pytest.raises(ValueError, match=f'{VARIAVEL} não está definida'):
        NotificadorHttp(ambiente=ambiente)


def test_webhook_le_do_ambiente_do_processo_e_o_nome_da_variavel_e_parametro(monkeypatch, sem_rede):
    monkeypatch.delenv(VARIAVEL, raising=False)
    monkeypatch.delenv('OUTRO_NOME_DE_VARIAVEL', raising=False)
    with pytest.raises(ValueError, match=VARIAVEL):
        NotificadorHttp()
    monkeypatch.setenv('OUTRO_NOME_DE_VARIAVEL', 'https://exemplo.invalid/hook')
    with pytest.raises(ValueError, match=VARIAVEL):                         # a variável padrão continua ausente
        NotificadorHttp()
    assert NotificadorHttp('OUTRO_NOME_DE_VARIAVEL').variavel == 'OUTRO_NOME_DE_VARIAVEL'
    monkeypatch.setenv(VARIAVEL, 'https://exemplo.invalid/hook')
    assert NotificadorHttp().variavel == VARIAVEL


def test_webhook_e_arquivo_recebem_o_mesmo_alarme_pelo_vigia(tmp_path):
    arquivo = NotificadorDeArquivo(tmp_path / 'alarmes.jsonl')
    with ServidorWebhook() as servidor:
        resultado = _vigia(UM_PROBLEMA, [_canal(servidor.url()), arquivo]).uma_volta()
    assert resultado.enviados == 1 and resultado.canais_falhos == 0
    assert len(servidor.recebidos) == 1 and json.loads(servidor.recebidos[0][3])['codigo'] == 'REGRA_13'
    assert len((tmp_path / 'alarmes.jsonl').read_text(encoding='utf-8').splitlines()) == 1


def test_webhook_fora_do_ar_nao_cala_o_arquivo_e_o_vigia_nao_vaza_a_url(tmp_path):
    registro = []
    arquivo = NotificadorDeArquivo(tmp_path / 'alarmes.jsonl')
    with ServidorWebhook(500) as servidor:
        vigia = _vigia(UM_PROBLEMA, [_canal(servidor.url('/hook/' + SEGREDO_DA_URL)), arquivo], registrar=registro.append)
        resultado = vigia.uma_volta()
    assert resultado.enviados == 1 and resultado.canais_falhos == 1 and not resultado.sem_nenhum_canal
    assert (tmp_path / 'alarmes.jsonl').read_text(encoding='utf-8').count('REGRA_13') == 1
    assert SEGREDO_DA_URL not in ' '.join(resultado.detalhes + registro) and 'webhook falhou' in resultado.detalhes[0]


def test_so_o_webhook_fora_do_ar_deixa_registro_sem_a_url():
    registro = []
    with ServidorWebhook(503) as servidor:
        resultado = _vigia(UM_PROBLEMA, [_canal(servidor.url('/hook/' + SEGREDO_DA_URL))], registrar=registro.append).uma_volta()
    assert resultado.sem_nenhum_canal and registro and SEGREDO_DA_URL not in ' '.join(registro + resultado.detalhes)


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


def test_vigia_le_com_a_sessao_somente_leitura_como_o_comando_vigiar_abre_e_nao_consegue_escrever(banco_do_vigia):
    _novo_card(banco_do_vigia)

    def so_leitura():
        con = psycopg.connect(banco_do_vigia.url, autocommit=True, options='-c default_transaction_read_only=on')
        con.execute('set role service_role')
        return con

    resultado = Vigia(so_leitura, [NotificadorFalso()]).uma_volta()
    assert resultado.alarmes == 0 and not resultado.erro_de_coleta               # as 13 regras e as demais leituras funcionam
    with so_leitura() as con, pytest.raises(psycopg.errors.ReadOnlySqlTransaction):
        con.execute('create temp table nao_pode (a int)')                           # o próprio PostgreSQL recusa escrita
