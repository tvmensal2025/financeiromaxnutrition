"""Leituras dos registros que o Hermes deixa: uso.json, request_dump, state.db (no esquema real) e estado.json."""

import json
import os
import sqlite3

import pytest

from apoio.hermes_gravado import NOME, chamada, criar_state_db, gravar_request_dump, gravar_uso
from executor_helena import uso
from executor_helena.uso import (ErroDoProvedor, Sessao, codigo_da_frase_do_hermes, contar_resultados_de_ferramenta,
                                 exportar_conversa, ferramentas_listadas, ler_arquivo_de_uso, ler_erro_do_provedor,
                                 ler_estado_das_ferramentas, ler_sessao, montar_registro_de_uso,
                                 resposta_do_agente_e_vazia, saida_e_a_resposta_do_agente)

VALIDOS = (NOME,)


def sessao(**kw):
    base = dict(id="S1", fim="agent_close", chamadas_ao_modelo=1, max_iteracoes=90, resultados_de_ferramenta=0,
                chamadas_invalidas=0, houve_resposta_do_assistente=True, ultima_do_assistente="resposta",
                ultima_tem_chamada_de_ferramenta=False, ultimo_finish_reason="stop", modelo="gpt-6-sol", prompt_de_sistema="p")
    base.update(kw)
    return Sessao(**base)


# --- arquivos JSON ---------------------------------------------------------------------------------------------
def test_uso_json_bom_e_estragado(tmp_path):
    caminho = gravar_uso(tmp_path / "uso.json", api_calls=3)
    assert ler_arquivo_de_uso(caminho)["api_calls"] == 3
    assert ler_arquivo_de_uso(tmp_path / "nao_existe.json") is None
    (tmp_path / "ruim.json").write_text("{quebrado")
    assert ler_arquivo_de_uso(tmp_path / "ruim.json") is None
    (tmp_path / "lista.json").write_text("[1, 2]")
    assert ler_arquivo_de_uso(tmp_path / "lista.json") is None
    (tmp_path / "grande.json").write_text(json.dumps({"x": "a" * (uso.TAMANHO_MAXIMO_DE_REGISTRO + 10)}))
    assert ler_arquivo_de_uso(tmp_path / "grande.json") is None


def test_estado_das_ferramentas(tmp_path):
    assert ler_estado_das_ferramentas(tmp_path) is None
    (tmp_path / "estado.json").write_text(json.dumps({"listou_ferramentas": True, "ferramentas": ["buscar", "ler_pagina"]}))
    estado = ler_estado_das_ferramentas(tmp_path)
    assert ferramentas_listadas(estado) == ("buscar", "ler_pagina")
    assert ferramentas_listadas({"listou_ferramentas": False, "ferramentas": ["buscar"]}) == ()
    assert ferramentas_listadas({"listou_ferramentas": True, "ferramentas": "buscar"}) == ()
    assert ferramentas_listadas(None) == ()


# --- erro do provedor ------------------------------------------------------------------------------------------------
def test_request_dump_vira_erro_do_provedor(tmp_path):
    gravar_request_dump(tmp_path, status=429, tipo="usage_limit_reached", codigo="rate_limit_exceeded",
                        corpo={"resets_in_seconds": 3600})
    assert ler_erro_do_provedor(tmp_path) == ErroDoProvedor("max_retries_exhausted", 429, "usage_limit_reached",
                                                             "rate_limit_exceeded", 3600)


def test_request_dump_sem_status_usa_so_o_tipo(tmp_path):
    gravar_request_dump(tmp_path, status=None, tipo="EmptyStreamError", codigo=None)
    erro = ler_erro_do_provedor(tmp_path)
    assert erro.status is None and erro.tipo == "EmptyStreamError" and erro.voltar_em_s is None


def test_pega_o_request_dump_mais_novo(tmp_path):
    velho = gravar_request_dump(tmp_path, status=500, nome="request_dump_a.json")
    os.utime(velho, (1, 1))
    gravar_request_dump(tmp_path, status=401, nome="request_dump_b.json")
    assert ler_erro_do_provedor(tmp_path).status == 401


def test_request_dump_ausente_ou_estragado(tmp_path):
    assert ler_erro_do_provedor(tmp_path) is None
    (tmp_path / "sessions").mkdir()
    assert ler_erro_do_provedor(tmp_path) is None
    (tmp_path / "sessions" / "request_dump_x.json").write_text("nao e json")
    assert ler_erro_do_provedor(tmp_path) is None
    (tmp_path / "sessions" / "request_dump_x.json").write_text(json.dumps({"reason": "x", "error": "texto"}))
    assert ler_erro_do_provedor(tmp_path) is None


def test_o_pacote_do_pedido_nunca_e_lido_do_dump(tmp_path):
    gravar_request_dump(tmp_path)
    assert "PACOTE_SECRETO_DO_PEDIDO" not in repr(ler_erro_do_provedor(tmp_path))


# --- sessão (state.db no esquema real) ---------------------------------------------------------------------------------
def test_sessao_de_execucao_boa(tmp_path):
    criar_state_db(tmp_path, [("user", "pedido", None, None), ("assistant", "resposta", None, "stop")], chamadas_api=1, prompt="SOUL aqui")
    s = ler_sessao(tmp_path, VALIDOS)
    assert s.chamadas_ao_modelo == 1 and s.max_iteracoes == 90 and s.resultados_de_ferramenta == 0 and s.chamadas_invalidas == 0
    assert s.houve_resposta_do_assistente and s.ultima_do_assistente == "resposta" and not s.ultima_tem_chamada_de_ferramenta
    assert s.ultimo_finish_reason == "stop" and s.modelo == "gpt-6-sol" and s.prompt_de_sistema == "SOUL aqui" and s.fim == "agent_close"


def test_sessao_conta_ferramentas_validas_e_invalidas(tmp_path):
    criar_state_db(tmp_path, [
        ("user", "pedido", None, None),
        ("assistant", "", chamada(NOME, 1), "tool_calls"), ("tool", "ok", None, None),
        ("assistant", "", chamada("terminal", 2), "tool_calls"), ("tool", "não existe", None, None),
        ("assistant", "", chamada("buscar", 3), "tool_calls"), ("tool", "não existe", None, None)], chamadas_api=4)
    s = ler_sessao(tmp_path, VALIDOS)
    assert s.resultados_de_ferramenta == 3 and s.chamadas_invalidas == 2          # "terminal" e "buscar" sem o prefixo
    assert s.ultima_tem_chamada_de_ferramenta and s.chamadas_ao_modelo == 4
    assert contar_resultados_de_ferramenta(tmp_path) == 3


def test_tool_calls_ilegivel_conta_como_invalida(tmp_path):
    criar_state_db(tmp_path, [("user", "p", None, None), ("assistant", "", "{nao json", None)])
    assert ler_sessao(tmp_path, VALIDOS).chamadas_invalidas == 1


def test_sessao_sem_teto_de_voltas_e_sessao_mais_nova(tmp_path):
    criar_state_db(tmp_path, [("user", "p", None, None)], max_iteracoes=None)
    assert ler_sessao(tmp_path, VALIDOS).max_iteracoes is None
    conexao = sqlite3.connect(tmp_path / "state.db")
    conexao.execute("INSERT INTO sessions (id, source, model, started_at, api_call_count) VALUES ('S2','cli','outro',?,7)", (4102444800.0,))
    conexao.commit()
    conexao.close()
    assert ler_sessao(tmp_path, VALIDOS).id == "S2"


def test_sessao_sem_banco_ou_banco_quebrado(tmp_path):
    assert ler_sessao(tmp_path, VALIDOS) is None and contar_resultados_de_ferramenta(tmp_path) == 0
    (tmp_path / "state.db").write_bytes(b"isto nao e um banco sqlite")
    assert ler_sessao(tmp_path, VALIDOS) is None and contar_resultados_de_ferramenta(tmp_path) == 0 \
        and exportar_conversa(tmp_path, 1000) == ()


def test_banco_vazio_sem_sessao(tmp_path):
    criar_state_db(tmp_path, [])
    conexao = sqlite3.connect(tmp_path / "state.db")
    conexao.execute("DELETE FROM sessions")
    conexao.commit()
    conexao.close()
    assert ler_sessao(tmp_path, VALIDOS) is None


def test_leitura_nao_escreve_no_banco(tmp_path):
    caminho = criar_state_db(tmp_path, [("user", "p", None, None)])
    antes = caminho.read_bytes()
    ler_sessao(tmp_path, VALIDOS)
    contar_resultados_de_ferramenta(tmp_path)
    assert caminho.read_bytes() == antes


# --- a saída é a resposta do agente? ------------------------------------------------------------------------------------------
def test_saida_igual_a_ultima_mensagem_do_agente():
    assert saida_e_a_resposta_do_agente("resposta\n", sessao(ultima_do_assistente="resposta"))
    assert saida_e_a_resposta_do_agente("trecho", sessao(ultima_do_assistente="um trecho dentro"))


@pytest.mark.parametrize("saida,s", [
    ("API call failed after 1 retries: HTTP 429", sessao(houve_resposta_do_assistente=False, ultima_do_assistente=None)),
    ("⚠️ No reply: o modelo veio vazio", sessao(ultima_do_assistente="(empty)")),
    ("I reached the iteration limit", sessao(ultima_do_assistente="", ultima_tem_chamada_de_ferramenta=True)),
    ("resposta", sessao(ultima_do_assistente=None)),
    ("", sessao()),
    ("   ", sessao(ultima_do_assistente="  ")),
    (None, sessao()),
    ("resposta", None),
    ("resposta", sessao(ultima_do_assistente="resposta", ultima_tem_chamada_de_ferramenta=True)),
])
def test_saida_que_nao_e_do_agente(saida, s):
    assert not saida_e_a_resposta_do_agente(saida, s)


def test_resposta_vazia_do_agente():
    assert resposta_do_agente_e_vazia(sessao(ultima_do_assistente="(empty)"))
    assert resposta_do_agente_e_vazia(sessao(ultima_do_assistente=""))
    assert resposta_do_agente_e_vazia(sessao(ultima_do_assistente=None))
    assert not resposta_do_agente_e_vazia(sessao(ultima_do_assistente="resposta"))
    assert not resposta_do_agente_e_vazia(sessao(houve_resposta_do_assistente=False, ultima_do_assistente=None))
    assert not resposta_do_agente_e_vazia(sessao(ultima_do_assistente="", ultima_tem_chamada_de_ferramenta=True))


# --- frase do Hermes (com procedência) -------------------------------------------------------------------------------------------
FRASE = "Context overflow and auto-compaction is disabled (compression.enabled: false). Run /compress."


def test_frase_do_hermes_so_com_a_prova_de_que_nao_e_do_agente():
    sem_resposta = sessao(houve_resposta_do_assistente=False, ultima_do_assistente=None)
    assert codigo_da_frase_do_hermes(FRASE, {"failed": True}, sem_resposta) == "CONTEXTO_GRANDE"
    assert codigo_da_frase_do_hermes(FRASE, {"failed": False}, sem_resposta) is None        # o Hermes não disse que falhou
    assert codigo_da_frase_do_hermes(FRASE, {"failed": True}, sessao()) is None             # há mensagem do agente: pode ser dele
    assert codigo_da_frase_do_hermes(FRASE, {"failed": True}, None) is None
    assert codigo_da_frase_do_hermes(FRASE, None, sem_resposta) is None
    assert codigo_da_frase_do_hermes("outra coisa", {"failed": True}, sem_resposta) is None
    assert codigo_da_frase_do_hermes("", {"failed": True}, sem_resposta) is None
    assert codigo_da_frase_do_hermes("Eu disse: " + FRASE, {"failed": True}, sem_resposta) is None     # só no começo da saída


# --- conversa e registro de uso ------------------------------------------------------------------------------------------------------
def test_exportar_conversa_e_limite(tmp_path):
    criar_state_db(tmp_path, [("user", "pedido", None, None), ("assistant", "resposta " * 50, None, "stop")])
    conversa = exportar_conversa(tmp_path, 100_000)
    assert [m["papel"] for m in conversa] == ["user", "assistant"] and conversa[0]["conteudo"] == "pedido"
    cortada = exportar_conversa(tmp_path, 300)
    assert cortada[-1]["papel"] == "sistema" and "cortada" in cortada[-1]["conteudo"] and len(cortada) == 2


def test_registro_de_uso_diz_de_onde_vem_cada_campo():
    servidor = {"contadores": {"total": 4}, "usou_internet": True}
    registro = montar_registro_de_uso({"model": "gpt-6-sol", "provider": "openai-codex", "api_calls": 3, "completed": True,
                                       "failed": False, "session_id": "S1", "input_tokens": 10, "output_tokens": 5,
                                       "total_tokens": 15}, servidor)
    assert (registro.modelo, registro.provedor, registro.chamadas_ao_modelo, registro.completo, registro.falhou) == \
        ("gpt-6-sol", "openai-codex", 3, True, False)
    assert registro.chamadas_de_ferramenta == 4 and registro.usou_internet is True
    assert registro.origem["modelo"] == "hermes:uso.json:model"
    assert registro.origem["chamadas_de_ferramenta"] == "ferramentas:estado.json:contadores.total"
    assert registro.origem["usou_internet"] == "ferramentas:estado.json:usou_internet"
    assert set(registro.origem) == {"modelo", "provedor", "chamadas_ao_modelo", "completo", "falhou", "id_da_sessao",
                                    "tokens_entrada", "tokens_saida", "tokens_total", "chamadas_de_ferramenta", "usou_internet"}


def test_registro_de_uso_ignora_tipo_errado_e_falta_de_fonte():
    registro = montar_registro_de_uso({"model": 5, "api_calls": "3", "completed": "sim", "failed": 0}, None)
    assert registro.modelo is None and registro.chamadas_ao_modelo is None and registro.completo is None and registro.falhou is None
    assert registro.chamadas_de_ferramenta is None and registro.usou_internet is None and registro.origem == {}
    assert montar_registro_de_uso(None, None).modelo is None
