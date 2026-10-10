"""O servidor falso de provedor: grava cada pedido e simula cada situação do jeito combinado."""

import http.client
import json
import threading
import time
import urllib.error
import urllib.request

import pytest

from executor_helena.provedor_falso import (Cenario, NOME_DA_FERRAMENTA_INEXISTENTE, ServidorDeProvedorFalso, Simulacao,
                                            TEXTO_FORMATO_ERRADO, TEXTO_PADRAO)


@pytest.fixture
def servidor():
    with ServidorDeProvedorFalso() as s:
        yield s


def chat(servidor, mensagens=None, ferramentas=None, stream=False, modelo="gpt-teste"):
    corpo = {"model": modelo, "messages": mensagens or [{"role": "user", "content": "oi"}], "stream": stream}
    if ferramentas:
        corpo["tools"] = [{"type": "function", "function": {"name": n}} for n in ferramentas]
    pedido = urllib.request.Request(servidor.endereco + "/chat/completions", data=json.dumps(corpo).encode(),
                                    headers={"Content-Type": "application/json", "X-Teste": "sim"})
    return urllib.request.urlopen(pedido, timeout=10)


def json_do_chat(servidor, **kw):
    with chat(servidor, **kw) as resposta:
        return json.loads(resposta.read())


def eventos_sse(servidor, **kw):
    with chat(servidor, stream=True, **kw) as resposta:
        linhas = resposta.read().decode().split("\n\n")
    dados = [l[len("data: "):] for l in linhas if l.startswith("data: ")]
    assert dados[-1] == "[DONE]"
    return [json.loads(d) for d in dados[:-1]]


def status_do_erro(servidor, **kw):
    with pytest.raises(urllib.error.HTTPError) as erro:
        chat(servidor, **kw)
    return erro.value.code, json.loads(erro.value.read()), dict(erro.value.headers)


# --- gravação ------------------------------------------------------------------------------------------------------
def test_so_escuta_em_127_0_0_1(servidor):
    assert servidor._http.server_address[0] == "127.0.0.1" and servidor.endereco.startswith("http://127.0.0.1:")


def test_grava_cada_pedido_de_chat_com_ferramentas_e_mensagens(servidor):
    json_do_chat(servidor, ferramentas=["mcp__x__buscar", "mcp__x__ler"],
                 mensagens=[{"role": "system", "content": "SISTEMA UM"}, {"role": "system", "content": "SISTEMA DOIS"},
                            {"role": "user", "content": [{"type": "text", "text": "PEDIDO"}]},
                            {"role": "tool", "content": "r1"}, {"role": "tool", "content": "r2"}])
    (pedido,) = servidor.pedidos_de_chat()
    assert pedido.nomes_das_ferramentas() == ("mcp__x__buscar", "mcp__x__ler")
    assert pedido.texto_do_sistema() == "SISTEMA UM\nSISTEMA DOIS" and pedido.texto_do_usuario() == "PEDIDO"
    assert pedido.resultados_de_ferramenta() == 2 and pedido.metodo == "POST" and pedido.cabecalhos["x-teste"] == "sim"
    assert pedido.corpo["model"] == "gpt-teste" and pedido.instante > 0


def test_pedido_sem_ferramentas_grava_lista_vazia(servidor):
    json_do_chat(servidor)
    assert servidor.pedidos_de_chat()[0].nomes_das_ferramentas() == ()


def test_sondas_sao_gravadas_mas_nao_contam_como_chat(servidor):
    with pytest.raises(urllib.error.HTTPError) as erro:
        urllib.request.urlopen(servidor.endereco + "/models", timeout=5)
    assert erro.value.code == 404
    assert len(servidor.pedidos()) == 1 and servidor.pedidos_de_chat() == []


def test_limpar_e_definir(servidor):
    json_do_chat(servidor)
    servidor.limpar()
    assert servidor.pedidos() == []
    servidor.definir(Cenario(Simulacao.ERRO_500))
    assert status_do_erro(servidor)[0] == 503


def test_dois_servidores_sao_independentes():
    with ServidorDeProvedorFalso() as a, ServidorDeProvedorFalso(Cenario(Simulacao.ERRO_429)) as b:
        assert a.porta != b.porta
        json_do_chat(a)
        assert len(a.pedidos_de_chat()) == 1 and b.pedidos_de_chat() == []


# --- respostas boas ------------------------------------------------------------------------------------------------------------
def test_resposta_boa_normal_e_em_partes(servidor):
    normal = json_do_chat(servidor)
    assert normal["choices"][0]["message"]["content"] == TEXTO_PADRAO and normal["choices"][0]["finish_reason"] == "stop"
    partes = eventos_sse(servidor)
    assert partes[0]["choices"][0]["delta"]["content"] == TEXTO_PADRAO
    assert partes[1]["choices"][0]["finish_reason"] == "stop" and partes[-1]["usage"]["total_tokens"] == 15


def test_texto_personalizado(servidor):
    servidor.definir(Cenario(texto="meu texto"))
    assert json_do_chat(servidor)["choices"][0]["message"]["content"] == "meu texto"


def test_formato_errado_responde_normal_com_texto_fora_do_formato(servidor):
    servidor.definir(Cenario(Simulacao.FORMATO_ERRADO))
    assert json_do_chat(servidor)["choices"][0]["message"]["content"] == TEXTO_FORMATO_ERRADO


def test_saida_cortada_marca_finish_reason_length(servidor):
    servidor.definir(Cenario(Simulacao.SAIDA_CORTADA))
    assert json_do_chat(servidor)["choices"][0]["finish_reason"] == "length"
    assert eventos_sse(servidor)[1]["choices"][0]["finish_reason"] == "length"


def test_resposta_vazia(servidor):
    servidor.definir(Cenario(Simulacao.RESPOSTA_VAZIA))
    assert json_do_chat(servidor)["choices"][0]["message"]["content"] == ""


def test_resposta_invalida_nao_tem_choices(servidor):
    servidor.definir(Cenario(Simulacao.RESPOSTA_INVALIDA))
    assert json_do_chat(servidor)["choices"] == []


# --- erros ---------------------------------------------------------------------------------------------------------------------------
def test_erro_429_diz_quando_a_cota_volta(servidor):
    servidor.definir(Cenario(Simulacao.ERRO_429, segundos_para_voltar=1800))
    status, corpo, cabecalhos = status_do_erro(servidor)
    assert status == 429 and corpo["error"]["type"] == "usage_limit_reached" and corpo["error"]["resets_in_seconds"] == 1800
    assert cabecalhos["Retry-After"] == "1800"


def test_login_recusado_500_contexto_e_estranho(servidor):
    servidor.definir(Cenario(Simulacao.LOGIN_RECUSADO))
    assert status_do_erro(servidor)[0:2] == (401, {"error": {"message": "Your authentication token has expired. Please sign in again.",
                                                           "type": "invalid_request_error", "code": "token_expired"}})
    servidor.definir(Cenario(Simulacao.ERRO_500))
    assert status_do_erro(servidor)[0] == 503
    servidor.definir(Cenario(Simulacao.CONTEXTO_GRANDE))
    status, corpo, _ = status_do_erro(servidor)
    assert status == 400 and corpo["error"]["code"] == "context_length_exceeded"
    servidor.definir(Cenario(Simulacao.ERRO_ESTRANHO))
    assert status_do_erro(servidor)[0] == 418


# --- laço de ferramenta -----------------------------------------------------------------------------------------------------------------
def test_laco_pede_ferramenta_ate_a_ultima_volta_e_depois_responde(servidor):
    servidor.definir(Cenario(Simulacao.LACO_DE_FERRAMENTA, voltas_do_laco=3, argumentos='{"q": "volta {n}"}'))
    mensagens = [{"role": "user", "content": "oi"}]
    for volta in (1, 2, 3):
        corpo = json_do_chat(servidor, mensagens=list(mensagens), ferramentas=["mcp__x__buscar", "outra"])
        chamada = corpo["choices"][0]["message"]["tool_calls"][0]
        assert corpo["choices"][0]["finish_reason"] == "tool_calls" and chamada["function"]["name"] == "mcp__x__buscar"
        assert json.loads(chamada["function"]["arguments"]) == {"q": f"volta {volta}"}
        mensagens += [{"role": "assistant", "content": None, "tool_calls": [chamada]}, {"role": "tool", "content": "r"}]
    final = json_do_chat(servidor, mensagens=mensagens, ferramentas=["mcp__x__buscar"])
    assert final["choices"][0]["message"]["content"] == TEXTO_PADRAO


def test_laco_sem_ferramentas_chama_uma_que_nao_existe(servidor):
    servidor.definir(Cenario(Simulacao.LACO_DE_FERRAMENTA))
    chamada = json_do_chat(servidor)["choices"][0]["message"]["tool_calls"][0]
    assert chamada["function"]["name"] == NOME_DA_FERRAMENTA_INEXISTENTE


def test_laco_com_ferramenta_escolhida_e_em_partes(servidor):
    servidor.definir(Cenario(Simulacao.LACO_DE_FERRAMENTA, ferramenta="escolhida", argumentos='{"a": 1}'))
    partes = eventos_sse(servidor, ferramentas=["outra"])
    inicio = partes[0]["choices"][0]["delta"]["tool_calls"][0]
    assert inicio["function"]["name"] == "escolhida" and partes[1]["choices"][0]["delta"]["tool_calls"][0]["function"]["arguments"] == '{"a": 1}'
    assert partes[2]["choices"][0]["finish_reason"] == "tool_calls"


# --- queda e lentidão ---------------------------------------------------------------------------------------------------------------------
def test_queda_no_meio_corta_a_conexao_sem_terminar(servidor):
    servidor.definir(Cenario(Simulacao.QUEDA_NO_MEIO))
    with pytest.raises((http.client.IncompleteRead, http.client.RemoteDisconnected, ConnectionError)):
        with chat(servidor, stream=True) as resposta:
            resposta.read()


def test_resposta_lenta_espera_e_depois_responde(servidor):
    servidor.definir(Cenario(Simulacao.LENTA, atraso_s=0.4))
    comeco = time.monotonic()
    assert json_do_chat(servidor)["choices"][0]["message"]["content"] == TEXTO_PADRAO
    assert time.monotonic() - comeco >= 0.4


def test_parar_nao_espera_a_resposta_lenta():
    servidor = ServidorDeProvedorFalso(Cenario(Simulacao.LENTA, atraso_s=120)).iniciar()
    cliente = threading.Thread(target=lambda: _ignorar(lambda: chat(servidor).read()), daemon=True)
    cliente.start()
    time.sleep(0.3)
    comeco = time.monotonic()
    servidor.parar()
    assert time.monotonic() - comeco < 5


def _ignorar(funcao):
    try:
        funcao()
    except Exception:
        pass
