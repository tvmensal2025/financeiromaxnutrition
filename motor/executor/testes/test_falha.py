"""Leitor de falha: a classe sai do REGISTRO de uso e do código de saída, nunca do texto do agente.

Cada linha da tabela é um fato (números, marcas e códigos) e a classe que o leitor tem de dar.
"""

import dataclasses

import pytest

from executor_helena.falha import Evidencias, classe_do_erro_do_provedor, classificar_falha
from executor_helena.tipos import (CLASSES_DE_FALHA, COTA, DESCONHECIDA, FORMATO_ERRADO, GRANDE_DEMAIS, LIMITE_CHAMADAS, LOGIN,
                                   PROVEDOR, QUEDA, TEMPO, Falha)
from executor_helena.uso import ErroDoProvedor, Sessao

USO_BOM = {"completed": True, "failed": False, "api_calls": 1, "model": "gpt-6-sol", "provider": "openai-codex"}
USO_FALHOU = {"completed": False, "failed": True, "api_calls": 1, "model": None, "provider": None}
USO_INCOMPLETO = {"completed": False, "failed": False, "api_calls": 4, "model": None, "provider": None}


def sessao(**kw):
    base = dict(id="S1", fim="agent_close", chamadas_ao_modelo=1, max_iteracoes=90, resultados_de_ferramenta=0,
                chamadas_invalidas=0, houve_resposta_do_assistente=True, ultima_do_assistente="resposta",
                ultima_tem_chamada_de_ferramenta=False, ultimo_finish_reason="stop", modelo="gpt-6-sol", prompt_de_sistema="p")
    base.update(kw)
    return Sessao(**base)


def erro(status=None, tipo=None, codigo=None, voltar=None):
    return ErroDoProvedor("max_retries_exhausted", status, tipo, codigo, voltar)


def ev(**kw):
    base = dict(codigo_de_saida=0, encerrado_por=None, uso=USO_BOM, erro_do_provedor=None, sessao=sessao(), servidor=None,
                saida_vazia=False, saida_e_resposta=True, max_de_chamadas_vistas=16, frase_do_hermes=None)
    base.update(kw)
    return Evidencias(**base)


def resposta(**kw):
    falha = classificar_falha(ev(**kw))
    return None if falha is None else (falha.classe, falha.codigo)


def test_execucao_boa_nao_tem_falha():
    assert classificar_falha(ev()) is None


# --- quem encerrou ------------------------------------------------------------------------------------------------
def test_o_executor_encerrou_por_tempo_ou_por_limite():
    assert resposta(encerrado_por="TEMPO", codigo_de_saida=-15, uso=None) == (TEMPO, "TEMPO_ESGOTADO")
    assert resposta(encerrado_por="LIMITE_CHAMADAS", codigo_de_saida=-15, uso=None) == (LIMITE_CHAMADAS, "LIMITE_DE_CHAMADAS")


def test_cancelar_nao_e_falha():
    assert classificar_falha(ev(encerrado_por="CANCELAMENTO", codigo_de_saida=-15, uso=None)) is None


def test_o_tempo_vence_qualquer_outro_sinal():
    erro_429 = erro(429, "usage_limit_reached")
    assert resposta(encerrado_por="TEMPO", uso=USO_FALHOU, erro_do_provedor=erro_429, codigo_de_saida=-15) == (TEMPO, "TEMPO_ESGOTADO")


def test_servidor_de_ferramentas_encerrou_por_limite():
    servidor = {"encerrada": True, "motivo_encerramento": "limite_de_chamadas"}
    assert resposta(servidor=servidor) == (LIMITE_CHAMADAS, "SERVIDOR_ENCERROU_POR_LIMITE")
    assert resposta(servidor={"encerrada": True, "motivo_encerramento": "outro"}) is None
    assert resposta(servidor={"encerrada": False, "motivo_encerramento": "limite_de_chamadas"}) is None


# --- processo sumiu ---------------------------------------------------------------------------------------------------
@pytest.mark.parametrize("sinal", [9, 11, 6])
def test_morto_por_sinal_que_nao_foi_nosso_e_queda(sinal):
    assert resposta(codigo_de_saida=-sinal, uso=None) == (QUEDA, f"MORTO_PELO_SINAL_{sinal}")


def test_sem_codigo_de_saida_e_queda():
    assert resposta(codigo_de_saida=None, uso=None) == (QUEDA, "SEM_CODIGO_DE_SAIDA")


def test_sem_registro_de_uso_nunca_chuta():
    assert resposta(uso=None) == (DESCONHECIDA, "SEM_REGISTRO_DE_USO")
    assert resposta(uso={"completed": "sim", "failed": 0}) == (DESCONHECIDA, "REGISTRO_DE_USO_ILEGIVEL")
    assert resposta(uso={}) == (DESCONHECIDA, "REGISTRO_DE_USO_ILEGIVEL")


# --- o Hermes disse que falhou: a classe vem do erro gravado do provedor -----------------------------------------------------
@pytest.mark.parametrize("dado,classe,codigo", [
    (erro(429, "usage_limit_reached", "rate_limit_exceeded", 3600), COTA, "HTTP_429"),
    (erro(402), COTA, "HTTP_402"),
    (erro(None, "usage_limit_reached"), COTA, "usage_limit_reached"),
    (erro(None, None, "insufficient_quota"), COTA, "insufficient_quota"),
    (erro(401, "invalid_request_error", "token_expired"), LOGIN, "HTTP_401"),
    (erro(403, None, "token_expired"), LOGIN, "HTTP_403"),
    (erro(400, None, "invalid_api_key"), LOGIN, "HTTP_400"),
    (erro(500), PROVEDOR, "HTTP_500"), (erro(502), PROVEDOR, "HTTP_502"), (erro(503, "server_error"), PROVEDOR, "HTTP_503"),
    (erro(504), PROVEDOR, "HTTP_504"), (erro(529), PROVEDOR, "HTTP_529"), (erro(408), PROVEDOR, "HTTP_408"),
    (erro(None, "EmptyStreamError"), PROVEDOR, "EmptyStreamError"),
    (erro(None, "ReadTimeout"), PROVEDOR, "ReadTimeout"),
    (erro(413), GRANDE_DEMAIS, "HTTP_413"),
    (erro(400, "invalid_request_error", "context_length_exceeded"), GRANDE_DEMAIS, "HTTP_400"),
    (erro(418, "teapot_error"), DESCONHECIDA, "HTTP_418"),
    (erro(403), DESCONHECIDA, "HTTP_403"),
    (erro(404, "not_found"), DESCONHECIDA, "HTTP_404"),
    (erro(None, None, None), DESCONHECIDA, "ERRO_SEM_NOME"),
])
def test_classe_do_erro_do_provedor(dado, classe, codigo):
    falha = classe_do_erro_do_provedor(dado)
    assert (falha.classe, falha.codigo) == (classe, codigo)
    assert resposta(uso=USO_FALHOU, erro_do_provedor=dado, saida_e_resposta=False) == (classe, codigo)


def test_cota_informa_quando_volta():
    assert classe_do_erro_do_provedor(erro(429, "usage_limit_reached", "rate_limit_exceeded", 3600)).voltar_em_s == 3600
    assert classe_do_erro_do_provedor(erro(429)).voltar_em_s is None


def test_falhou_sem_erro_gravado_e_desconhecida():
    assert resposta(uso=USO_FALHOU, saida_e_resposta=False) == (DESCONHECIDA, "FALHA_SEM_ERRO_REGISTRADO")


def test_frase_do_hermes_de_contexto_grande():
    assert resposta(uso=USO_FALHOU, saida_e_resposta=False, frase_do_hermes="CONTEXTO_GRANDE") == (GRANDE_DEMAIS, "CONTEXTO_MAIOR_QUE_O_MODELO")
    # com erro gravado, vale o erro gravado
    assert resposta(uso=USO_FALHOU, saida_e_resposta=False, frase_do_hermes="CONTEXTO_GRANDE",
                    erro_do_provedor=erro(429)) == (COTA, "HTTP_429")


# --- terminou sem estar completo ------------------------------------------------------------------------------------------------
def test_resposta_cortada_pelo_limite_do_modelo():
    assert resposta(uso=USO_INCOMPLETO, saida_e_resposta=False, sessao=sessao(ultimo_finish_reason="length")) \
        == (GRANDE_DEMAIS, "SAIDA_CORTADA_NO_LIMITE")


def test_voltas_esgotadas_e_laco():
    assert resposta(uso=USO_INCOMPLETO, saida_e_resposta=False,
                    sessao=sessao(chamadas_ao_modelo=90, max_iteracoes=90, ultima_tem_chamada_de_ferramenta=True)) \
        == (LIMITE_CHAMADAS, "LACO_DE_CHAMADAS")


def test_ferramenta_inexistente_pedida_de_novo():
    assert resposta(uso=USO_INCOMPLETO, saida_e_resposta=False,
                    sessao=sessao(chamadas_ao_modelo=3, chamadas_invalidas=2, ultima_tem_chamada_de_ferramenta=True)) \
        == (LIMITE_CHAMADAS, "LACO_DE_CHAMADAS")


def test_mais_resultados_de_ferramenta_que_o_teto_do_vigia():
    assert resposta(uso=USO_INCOMPLETO, saida_e_resposta=False, max_de_chamadas_vistas=16,
                    sessao=sessao(resultados_de_ferramenta=17, ultima_tem_chamada_de_ferramenta=True))[0] == LIMITE_CHAMADAS
    assert resposta(uso=USO_INCOMPLETO, saida_e_resposta=False, codigo_de_saida=1, max_de_chamadas_vistas=16,
                    sessao=sessao(resultados_de_ferramenta=16)) == (DESCONHECIDA, "EXECUCAO_INCOMPLETA")


def test_corte_no_meio_da_resposta_e_queda():
    assert resposta(codigo_de_saida=2, uso=USO_INCOMPLETO, saida_vazia=True, saida_e_resposta=False) == (QUEDA, "CORTE_NO_MEIO_DA_RESPOSTA")


@pytest.mark.parametrize("mudanca", [
    dict(codigo_de_saida=1, saida_vazia=True),                          # outro código de saída
    dict(codigo_de_saida=2, saida_vazia=False),                         # imprimiu alguma coisa
    dict(codigo_de_saida=2, saida_vazia=True, erro_do_provedor=erro(500)),   # há um erro gravado
])
def test_incompleto_sem_causa_conhecida_nao_vira_queda(mudanca):
    assert resposta(uso=USO_INCOMPLETO, saida_e_resposta=False, **{"saida_vazia": True, **mudanca})[0] == DESCONHECIDA


def test_queda_com_ferramenta_invalida_antes_nao_vira_limite_de_chamadas():
    """Uma ferramenta errada isolada seguida de corte de conexão (código 2) é QUEDA?  Não: sem prova, é desconhecida."""
    falha = resposta(codigo_de_saida=2, uso=USO_INCOMPLETO, saida_vazia=True, saida_e_resposta=False,
                     sessao=sessao(chamadas_invalidas=1, ultima_tem_chamada_de_ferramenta=True))
    assert falha == (DESCONHECIDA, "EXECUCAO_INCOMPLETA")


# --- terminou completo ----------------------------------------------------------------------------------------------------------------
def test_completo_com_saida_diferente_de_zero_e_desconhecido():
    assert resposta(codigo_de_saida=1) == (DESCONHECIDA, "SAIDA_1_COM_USO_COMPLETO")


def test_completo_sem_conseguir_ler_a_sessao_e_desconhecido():
    assert resposta(sessao=None) == (DESCONHECIDA, "SESSAO_ILEGIVEL")


def test_completo_mas_cortado_pelo_limite_do_modelo():
    assert resposta(sessao=sessao(ultimo_finish_reason="length")) == (GRANDE_DEMAIS, "SAIDA_CORTADA_NO_LIMITE")


@pytest.mark.parametrize("vazia", ["", "(empty)", None])
def test_completo_com_resposta_vazia_e_formato_errado(vazia):
    assert resposta(saida_e_resposta=False, sessao=sessao(ultima_do_assistente=vazia)) == (FORMATO_ERRADO, "RESPOSTA_VAZIA")


def test_completo_com_saida_que_nao_e_a_do_agente_e_desconhecido():
    assert resposta(saida_e_resposta=False) == (DESCONHECIDA, "SAIDA_DIFERENTE_DA_SESSAO")


# --- a regra de ouro --------------------------------------------------------------------------------------------------------------------
def test_as_evidencias_nao_carregam_texto_do_agente():
    """O leitor não tem como ler o texto: o tipo das evidências só tem números, marcas e códigos."""
    campos = {c.name: c.type for c in dataclasses.fields(Evidencias)}
    assert not {"texto", "saida", "resposta", "conteudo"} & set(campos)
    assert set(campos) == {"codigo_de_saida", "encerrado_por", "uso", "erro_do_provedor", "sessao", "servidor", "saida_vazia",
                           "saida_e_resposta", "max_de_chamadas_vistas", "frase_do_hermes"}
    campos_da_sessao = {c.name for c in dataclasses.fields(Sessao)}
    assert "ultima_do_assistente" in campos_da_sessao          # existe só para a conferência de identidade (uso.py)


def test_so_as_dez_classes_do_executor_saem_daqui():
    assert len(CLASSES_DE_FALHA) == 10 and len(set(CLASSES_DE_FALHA)) == 10
    with pytest.raises(ValueError):
        Falha("BANCO", "X")
    with pytest.raises(ValueError):
        Falha("cota", "X")


def test_quem_gasta_tentativa():
    gastam = {c for c in CLASSES_DE_FALHA if Falha(c, "X").gasta_tentativa}
    assert gastam == {TEMPO, LIMITE_CHAMADAS, GRANDE_DEMAIS, FORMATO_ERRADO, DESCONHECIDA}
