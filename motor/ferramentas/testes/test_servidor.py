"""Servidor MCP em processo: protocolo, lista por extenso, servidor vazio, contador e registro."""

import hashlib
import io
import json

import pytest

import falsos
from conftest import chamar, texto_de
from ferramentas_helena.busca import AdaptadorDesligado, AdaptadorFalso, ResultadoBusca
from ferramentas_helena.erros import ErroDeConfiguracao
from ferramentas_helena.registro import ler_estado, ler_registro
from ferramentas_helena.servidor import CODIGO_DE_SAIDA_LIMITE, executar_stdio


def rpc(servidor, metodo, params=None, id_=1):
    mensagem = {"jsonrpc": "2.0", "id": id_, "method": metodo}
    if params is not None:
        mensagem["params"] = params
    return servidor.tratar(mensagem)


def pagina_de_muitas_partes(mundo, caminho="/longa"):
    mundo.paginas.rotas[caminho] = falsos.pagina("".join(f"<p>{'palavra ' * 100}</p>" for _ in range(80)))
    return f"http://site.exemplo{caminho}"


# --- protocolo -------------------------------------------------------------------------------------
def test_initialize_negocia_a_versao_e_so_oferece_ferramentas(mundo):
    servidor = mundo.servidor()
    resposta = rpc(servidor, "initialize", {"protocolVersion": "2025-03-26", "capabilities": {},
                                            "clientInfo": {"name": "teste", "version": "0"}})
    resultado = resposta["result"]
    assert resposta["jsonrpc"] == "2.0" and resposta["id"] == 1
    assert resultado["protocolVersion"] == "2025-03-26"
    assert resultado["capabilities"] == {"tools": {"listChanged": False}}
    assert resultado["serverInfo"]["name"] == "helena-ferramentas"
    assert rpc(servidor, "initialize", {"protocolVersion": "1999-01-01"})["result"]["protocolVersion"] == "2025-06-18"


def test_ping_e_metodo_desconhecido_e_notificacao(mundo):
    servidor = mundo.servidor()
    assert rpc(servidor, "ping")["result"] == {}
    assert rpc(servidor, "resources/list")["error"]["code"] == -32601
    assert servidor.tratar({"jsonrpc": "2.0", "method": "notifications/initialized"}) is None


def test_notificacao_de_tools_call_nao_executa_nada(mundo):
    servidor = mundo.servidor()
    assert servidor.tratar({"jsonrpc": "2.0", "method": "tools/call",
                            "params": {"name": "buscar", "arguments": {"consulta": "x"}}}) is None
    assert ler_registro(servidor.params.diretorio) == [] and servidor.contador.total == 0


@pytest.mark.parametrize("ruim", [
    "texto", 5, None, [], {"id": 1, "method": "ping"}, {"jsonrpc": "1.0", "id": 1, "method": "ping"},
    {"jsonrpc": "2.0", "id": 1}, {"jsonrpc": "2.0", "id": 1, "method": 7},
    {"jsonrpc": "2.0", "id": True, "method": "ping"}, {"jsonrpc": "2.0", "id": [1], "method": "ping"},
])
def test_mensagens_fora_do_padrao_dao_erro_de_requisicao(mundo, ruim):
    assert mundo.servidor().tratar(ruim)["error"]["code"] == -32600


def test_params_e_tools_call_malformados(mundo):
    servidor = mundo.servidor()
    assert rpc(servidor, "tools/list", "texto")["error"]["code"] == -32602
    assert rpc(servidor, "tools/call", {"arguments": {}})["error"]["code"] == -32602
    assert rpc(servidor, "tools/call", {"name": 5})["error"]["code"] == -32602
    assert rpc(servidor, "tools/call", {"name": "buscar", "arguments": ["x"]})["error"]["code"] == -32602


def test_id_de_texto_e_devolvido_igual(mundo):
    assert rpc(mundo.servidor(), "ping", id_="abc-1")["id"] == "abc-1"


# --- lista de ferramentas sempre por extenso ------------------------------------------------------------
def nomes(servidor):
    return [t["name"] for t in rpc(servidor, "tools/list")["result"]["tools"]]


def test_lista_de_ferramentas_e_exatamente_a_da_ficha(mundo, tmp_path):
    def servidor(n, **kw):
        return mundo.servidor(diretorio=tmp_path / f"exec{n}", **kw)
    assert nomes(servidor(1, ferramentas=("ler_pagina", "buscar"))) == ["ler_pagina", "buscar"]
    assert nomes(servidor(2, ferramentas=("buscar", "ler_pagina"))) == ["buscar", "ler_pagina"]
    assert nomes(servidor(3, ferramentas=("ler_pagina",), max_buscas=0)) == ["ler_pagina"]
    assert nomes(servidor(4, ferramentas=("buscar",), max_partes=0)) == ["buscar"]


def test_ferramentas_so_leem_e_tem_formato_fechado(mundo):
    for ferramenta in rpc(mundo.servidor(), "tools/list")["result"]["tools"]:
        assert ferramenta["annotations"]["readOnlyHint"] is True
        assert ferramenta["annotations"]["destructiveHint"] is False
        esquema = ferramenta["inputSchema"]
        assert esquema["type"] == "object" and esquema["additionalProperties"] is False
        assert ferramenta["description"]


def test_estado_diz_se_o_cliente_chegou_a_pedir_a_lista_de_ferramentas(mundo):
    servidor = mundo.servidor(ferramentas=("ler_pagina",), max_buscas=0)
    assert ler_estado(servidor.params.diretorio)["listou_ferramentas"] is False
    rpc(servidor, "tools/list")
    estado = ler_estado(servidor.params.diretorio)
    assert estado["listou_ferramentas"] is True and estado["ferramentas"] == ["ler_pagina"]
    assert mundo.servidor(ferramentas=("ler_pagina",), max_buscas=0).listou_ferramentas is True   # sobrevive à queda


def test_servidor_vazio_lista_nada(mundo):
    servidor = mundo.servidor(ferramentas=(), max_buscas=0, max_partes=0, max_total=3)
    assert rpc(servidor, "tools/list")["result"] == {"tools": []}


@pytest.mark.parametrize("nome", ["ler_pagina", "buscar", "terminal", "bash", "read_file", "web_search",
                                  "web_extract", "LER_PAGINA", "", "ler_pagina "])
def test_lista_vazia_nao_libera_nada(mundo, nome):
    servidor = mundo.servidor(ferramentas=(), max_buscas=0, max_partes=0, max_total=50)
    resposta = chamar(servidor, nome, {"url": "http://site.exemplo/", "consulta": "x"})
    assert resposta["error"]["code"] == -32602 and "não liberada" in resposta["error"]["message"]
    assert mundo.paginas.requisicoes == [] and mundo.dns.consultas == [] and mundo.conector.conexoes == []
    assert servidor.usou_internet is False


def test_ferramenta_conhecida_mas_fora_da_lista_tambem_e_recusada(mundo):
    servidor = mundo.servidor(ferramentas=("buscar",), max_partes=0)
    assert chamar(servidor, "ler_pagina", {"url": "http://site.exemplo/"})["error"]["code"] == -32602
    assert mundo.dns.consultas == []


def test_a_lista_nao_tem_valor_padrao(tmp_path):
    from ferramentas_helena.parametros import Parametros
    with pytest.raises(TypeError):                      # esquecer a lista é erro, não "libera tudo"
        Parametros(execucao="E-1", diretorio=tmp_path, max_total=1, lista_de_enderecos=None)


# --- argumentos ----------------------------------------------------------------------------------------------
@pytest.mark.parametrize("argumentos", [
    {}, {"parte": 1}, {"url": 5}, {"url": "http://site.exemplo/", "extra": 1},
    {"url": "http://site.exemplo/", "parte": 0}, {"url": "http://site.exemplo/", "parte": "1"},
])
def test_ler_pagina_com_argumentos_invalidos(mundo, argumentos):
    resposta = chamar(mundo.servidor(), "ler_pagina", argumentos)
    assert resposta["result"]["isError"] is True and "ERRO [" in texto_de(resposta)
    assert mundo.paginas.requisicoes == []


@pytest.mark.parametrize("argumentos", [{}, {"consulta": 5}, {"consulta": ""}, {"consulta": "x", "extra": 1}])
def test_buscar_com_argumentos_invalidos(mundo, argumentos):
    resposta = chamar(mundo.servidor(adaptador=AdaptadorFalso({})), "buscar", argumentos)
    assert resposta["result"]["isError"] is True and "[argumentos_invalidos]" in texto_de(resposta)


def test_erro_esperado_volta_com_codigo_estavel(mundo):
    resposta = chamar(mundo.servidor(), "ler_pagina", {"url": "http://169.254.169.254/latest/meta-data/"})
    assert resposta["result"]["isError"] is True
    assert texto_de(resposta).startswith("ERRO [bloqueado_endereco_interno]:")
    assert "169.254" not in texto_de(resposta)


def test_erro_interno_nao_vaza_detalhe_para_o_agente(mundo):
    class Quebrado(AdaptadorFalso):
        def buscar(self, consulta, limite):
            raise RuntimeError("SEGREDO_INTERNO_NAO_REAL caminho /etc/algo")

    servidor = mundo.servidor(adaptador=Quebrado({}))
    resposta = chamar(servidor, "buscar", {"consulta": "x"})
    assert "[erro_interno]" in texto_de(resposta) and "SEGREDO_INTERNO" not in texto_de(resposta)
    linha = ler_registro(servidor.params.diretorio)[0]
    assert linha["codigo"] == "erro_interno" and "SEGREDO_INTERNO" in linha["detalhe"]   # o registro guarda


def test_ler_pagina_e_buscar_funcionam_juntas(mundo):
    mundo.paginas.rotas["/termos"] = falsos.pagina("<p>termos de uso</p>")
    falso = AdaptadorFalso({"termos": [ResultadoBusca("Termos", "http://site.exemplo/termos")]})
    servidor = mundo.servidor(adaptador=falso)
    assert "http://site.exemplo/termos" in texto_de(chamar(servidor, "buscar", {"consulta": "termos"}))
    assert "termos de uso" in texto_de(chamar(servidor, "ler_pagina", {"url": "http://site.exemplo/termos"}))


# --- contador: laços de 200 chamadas cortados no limite -----------------------------------------------------------
def contar_resultados(servidor):
    contagem = {}
    for linha in ler_registro(servidor.params.diretorio):
        contagem[linha["resultado"]] = contagem.get(linha["resultado"], 0) + 1
    return contagem


def test_laco_de_200_leituras_e_cortado_no_limite_de_partes(mundo):
    url = pagina_de_muitas_partes(mundo)
    servidor = mundo.servidor(max_total=45, max_buscas=10, max_partes=30, tamanho_parte=1000)
    respostas = [chamar(servidor, "ler_pagina", {"url": url, "parte": 1 + i % 5}, id_=i) for i in range(200)]

    textos = [r["result"]["content"][0]["text"] for r in respostas]
    assert all("parte" in t and "LIMITE" not in t for t in textos[:30])          # 30 partes entregues
    assert all("ENTREGUE AGORA" in t for t in textos[30:33])                      # limite + 2 insistências
    assert all(not r["result"]["isError"] for r in respostas[30:33])
    assert respostas[33]["result"]["isError"] is True                             # a 3ª insistência encerra
    assert all("limite_de_chamadas" in t for t in textos[33:])                    # depois, tudo recusado
    assert servidor.deve_sair is True
    assert contar_resultados(servidor) == {"ok": 30, "entregue_agora": 3, "encerrada": 167}
    assert len(mundo.paginas.requisicoes) == 1                                    # nada além da 1ª leitura

    estado = ler_estado(servidor.params.diretorio)
    assert estado["encerrada"] is True and estado["motivo_encerramento"] == "limite_de_chamadas"
    assert estado["classe_do_motor"] == "LIMITE_CHAMADAS"
    assert estado["contadores"]["partes"] == 30 and estado["contadores"]["total"] == 30
    assert estado["usou_internet"] is True


def test_laco_de_200_buscas_e_cortado_no_limite_de_buscas(mundo):
    servidor = mundo.servidor(adaptador=AdaptadorFalso({}), max_total=45, max_buscas=10, max_partes=30)
    for i in range(200):
        chamar(servidor, "buscar", {"consulta": f"x{i}"}, id_=i)
    assert contar_resultados(servidor) == {"ok": 10, "entregue_agora": 3, "encerrada": 187}
    assert servidor.adaptador.chamadas.__len__() == 10                            # a busca só rodou 10 vezes


def test_chamadas_que_dao_erro_tambem_contam_no_total(mundo):
    servidor = mundo.servidor(max_total=45, max_buscas=10, max_partes=30)
    for i in range(200):
        chamar(servidor, "ler_pagina", {"url": "http://127.0.0.1/"}, id_=i)
    assert contar_resultados(servidor) == {"erro": 45, "entregue_agora": 3, "encerrada": 152}
    assert mundo.conector.conexoes == []


def test_laco_de_200_chamadas_a_ferramenta_inexistente_no_servidor_vazio(mundo):
    servidor = mundo.servidor(ferramentas=(), max_buscas=0, max_partes=0, max_total=3)
    respostas = [chamar(servidor, "terminal", {"cmd": "ls"}, id_=i) for i in range(200)]
    assert [("error" in r) for r in respostas[:3]] == [True, True, True]          # 3 recusas -32602
    assert contar_resultados(servidor) == {"nao_liberada": 3, "entregue_agora": 3, "encerrada": 194}
    assert servidor.deve_sair is True


def test_limite_de_total_corta_antes_dos_outros_quando_e_o_menor(mundo):
    servidor = mundo.servidor(adaptador=AdaptadorFalso({}), max_total=12, max_buscas=10, max_partes=2)
    for i in range(12):
        chamar(servidor, "buscar", {"consulta": f"x{i}"}, id_=i)
    assert servidor.contador.buscas == 10 and contar_resultados(servidor)["entregue_agora"] == 2


def test_apos_o_limite_a_resposta_diz_entregue_agora_sem_executar(mundo):
    mundo.paginas.rotas["/t"] = falsos.pagina("<p>oi</p>")
    servidor = mundo.servidor(ferramentas=("ler_pagina",), max_total=1, max_buscas=0, max_partes=1)
    chamar(servidor, "ler_pagina", {"url": "http://site.exemplo/t"})
    antes = len(mundo.paginas.requisicoes)
    resposta = chamar(servidor, "ler_pagina", {"url": "http://site.exemplo/t"})
    assert "ENTREGUE AGORA" in texto_de(resposta) and len(mundo.paginas.requisicoes) == antes


# --- registro de cada chamada --------------------------------------------------------------------------------------
def test_registro_tem_execucao_ferramenta_resultado_e_hash_do_que_o_agente_recebeu(mundo):
    mundo.paginas.rotas["/t"] = falsos.pagina("<p>oi</p>")
    servidor = mundo.servidor(execucao="E-55-n3", adaptador=AdaptadorFalso({}))
    entregue = [
        texto_de(chamar(servidor, "ler_pagina", {"url": "http://site.exemplo/t"})),
        texto_de(chamar(servidor, "buscar", {"consulta": "x"})),
        texto_de(chamar(servidor, "ler_pagina", {"url": "http://localhost/"})),
    ]
    linhas = ler_registro(servidor.params.diretorio)
    assert [l["ferramenta"] for l in linhas] == ["ler_pagina", "buscar", "ler_pagina"]
    assert [l["resultado"] for l in linhas] == ["ok", "ok", "erro"]
    assert all(l["execucao"] == "E-55-n3" for l in linhas)
    for linha, texto in zip(linhas, entregue):
        assert linha["hash"] == hashlib.sha256(texto.encode("utf-8")).hexdigest()
    assert linhas[0]["leitura_id"] == "LEI-001" and linhas[0]["hash_copia"]
    assert linhas[2]["codigo"] == "bloqueado_endereco_interno" and "localhost" in linhas[2]["detalhe"]
    assert [l["seq"] for l in linhas] == [1, 2, 3]


def test_chamada_recusada_por_ferramenta_nao_liberada_tambem_e_registrada(mundo):
    servidor = mundo.servidor(ferramentas=("buscar",), max_partes=0, adaptador=AdaptadorFalso({}))
    chamar(servidor, "ler_pagina", {"url": "http://site.exemplo/"})
    linha = ler_registro(servidor.params.diretorio)[0]
    assert linha["resultado"] == "nao_liberada" and linha["codigo"] == "ferramenta_nao_liberada"


# --- usou_internet (o motor lê daqui) -------------------------------------------------------------------------------------
def test_usou_internet_so_vira_verdadeiro_quando_uma_ferramenta_executa(mundo):
    servidor = mundo.servidor(adaptador=AdaptadorFalso({}))
    assert ler_estado(servidor.params.diretorio)["usou_internet"] is False
    rpc(servidor, "tools/list")
    assert ler_estado(servidor.params.diretorio)["usou_internet"] is False
    chamar(servidor, "buscar", {"consulta": "x"})
    assert ler_estado(servidor.params.diretorio)["usou_internet"] is True


def test_recusa_local_de_fonte_nao_registra_uso_de_internet(mundo):
    servidor = mundo.servidor(ferramentas=("ler_pagina",), max_buscas=0,
                             lista_de_enderecos=())
    resposta = chamar(servidor, "ler_pagina", {"url": "http://site.exemplo/fora"})

    assert resposta["result"]["isError"] is True
    assert ler_estado(servidor.params.diretorio)["usou_internet"] is False
    assert mundo.dns.consultas == [] and mundo.paginas.requisicoes == []


def test_busca_desligada_nao_registra_uso_de_internet(mundo):
    servidor = mundo.servidor(ferramentas=("buscar",), max_partes=0,
                             adaptador=AdaptadorDesligado())
    resposta = chamar(servidor, "buscar", {"consulta": "exemplo"})

    assert resposta["result"]["isError"] is True
    assert ler_estado(servidor.params.diretorio)["usou_internet"] is False


# --- queda e volta do servidor na mesma execução ---------------------------------------------------------------------------
def test_contadores_continuam_depois_de_o_servidor_cair_e_voltar(mundo):
    so_buscas = dict(ferramentas=("buscar",), max_total=6, max_buscas=6, max_partes=0)
    servidor = mundo.servidor(adaptador=AdaptadorFalso({}), **so_buscas)
    for i in range(4):
        chamar(servidor, "buscar", {"consulta": f"x{i}"})
    de_novo = mundo.servidor(adaptador=AdaptadorFalso({}), **so_buscas)
    assert de_novo.contador.total == 4 and de_novo.usou_internet is True
    chamar(de_novo, "buscar", {"consulta": "a"})
    chamar(de_novo, "buscar", {"consulta": "b"})
    assert "ENTREGUE AGORA" in texto_de(chamar(de_novo, "buscar", {"consulta": "c"}))    # o limite não reiniciou
    assert [l["seq"] for l in ler_registro(de_novo.params.diretorio)] == list(range(1, 8))


def test_execucao_encerrada_continua_encerrada_e_o_processo_sai_logo(mundo):
    so_buscas = dict(ferramentas=("buscar",), max_total=1, max_buscas=1, max_partes=0)
    servidor = mundo.servidor(adaptador=AdaptadorFalso({}), **so_buscas)
    for i in range(5):
        chamar(servidor, "buscar", {"consulta": f"x{i}"})
    assert servidor.deve_sair
    de_novo = mundo.servidor(adaptador=AdaptadorFalso({}), **so_buscas)
    assert de_novo.deve_sair is True
    assert "limite_de_chamadas" in texto_de(chamar(de_novo, "buscar", {"consulta": "mais uma"}))
    assert de_novo.adaptador.chamadas == []


def test_copias_continuam_valendo_depois_de_reiniciar(mundo):
    url = pagina_de_muitas_partes(mundo)
    servidor = mundo.servidor(tamanho_parte=1000)
    chamar(servidor, "ler_pagina", {"url": url, "parte": 1})
    de_novo = mundo.servidor(tamanho_parte=1000)
    assert "parte 2 de" in texto_de(chamar(de_novo, "ler_pagina", {"url": url, "parte": 2}))
    assert len(mundo.paginas.requisicoes) == 1


def test_pasta_de_outra_execucao_ou_com_outros_parametros_nao_liga(mundo):
    mundo.servidor(execucao="E-1-n1")
    with pytest.raises(ErroDeConfiguracao):
        mundo.servidor(execucao="E-2-n1")                       # mesma pasta, outra execução
    with pytest.raises(ErroDeConfiguracao):
        mundo.servidor(execucao="E-1-n1", max_total=999)        # mesma execução, outros limites
    with pytest.raises(ErroDeConfiguracao):
        mundo.servidor(execucao="E-1-n1", ferramentas=("buscar",), max_partes=0)


# --- laço de stdio (o que o cliente de verdade usa) --------------------------------------------------------------------------
def rodar_stdio(servidor, *linhas):
    entrada = io.BytesIO(b"".join(l if isinstance(l, bytes) else l.encode("utf-8") + b"\n" for l in linhas))
    saida = io.BytesIO()
    codigo = executar_stdio(servidor, entrada, saida)
    return codigo, [json.loads(l) for l in saida.getvalue().splitlines()], entrada


def test_stdio_responde_uma_linha_por_pedido_e_sai_zero_no_fim(mundo):
    servidor = mundo.servidor()
    codigo, respostas, _ = rodar_stdio(
        servidor,
        json.dumps({"jsonrpc": "2.0", "id": 1, "method": "ping"}),
        "",
        json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}),
        json.dumps({"jsonrpc": "2.0", "id": 2, "method": "tools/list"}),
    )
    assert codigo == 0 and [r["id"] for r in respostas] == [1, 2]


def test_stdio_json_invalido_nao_derruba_a_conversa(mundo):
    codigo, respostas, _ = rodar_stdio(
        mundo.servidor(), "isto não é json", b"\xff\xfe\n", json.dumps({"jsonrpc": "2.0", "id": 9, "method": "ping"}))
    assert codigo == 0
    assert [r.get("error", {}).get("code") for r in respostas[:2]] == [-32700, -32700]
    assert respostas[2]["id"] == 9


def test_stdio_linha_gigante_e_descartada(mundo):
    gigante = b"[" + b"1," * 600_000 + b"1]\n"
    codigo, respostas, _ = rodar_stdio(
        mundo.servidor(), gigante, json.dumps({"jsonrpc": "2.0", "id": 3, "method": "ping"}))
    assert respostas[0]["error"]["code"] == -32700 and respostas[1]["id"] == 3


def test_stdio_ao_encerrar_por_limite_sai_com_codigo_4_e_nao_le_mais(mundo):
    servidor = mundo.servidor(adaptador=AdaptadorFalso({}), ferramentas=("buscar",), max_total=1,
                              max_buscas=1, max_partes=0)
    chamadas = [json.dumps({"jsonrpc": "2.0", "id": i, "method": "tools/call",
                            "params": {"name": "buscar", "arguments": {"consulta": f"x{i}"}}})
                for i in range(200)]
    codigo, respostas, entrada = rodar_stdio(servidor, *chamadas)
    assert codigo == CODIGO_DE_SAIDA_LIMITE == 4
    assert len(respostas) == 5                                  # 1 ok + 3 "entregue agora" + a que encerra
    assert entrada.read().count(b"\n") == 195                   # o resto nem foi lido


def test_stdio_erro_inesperado_no_tratamento_vira_erro_interno(mundo, monkeypatch):
    servidor = mundo.servidor()
    monkeypatch.setattr(servidor, "tratar", lambda m: 1 / 0)
    codigo, respostas, _ = rodar_stdio(servidor, json.dumps({"jsonrpc": "2.0", "id": 1, "method": "ping"}))
    assert codigo == 0 and respostas[0]["error"]["code"] == -32603


def test_stdio_cliente_que_foi_embora_nao_gera_erro(mundo):
    class SaidaQuebrada:
        def write(self, dados):
            raise BrokenPipeError()

        def flush(self):
            pass

    entrada = io.BytesIO(json.dumps({"jsonrpc": "2.0", "id": 1, "method": "ping"}).encode() + b"\n")
    assert executar_stdio(mundo.servidor(), entrada, SaidaQuebrada()) == 0
