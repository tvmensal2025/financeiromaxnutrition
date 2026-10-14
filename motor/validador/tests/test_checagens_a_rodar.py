"""Cada serviço roda só as checagens da sua especificação (modelo.checagens_a_rodar).

O que é: a prova de que a lista restringe o que roda (fora dela vira NAO_SE_APLICA, menos as CHK-ACAO-*) e de que
sem a lista roda tudo, como antes. De onde vem a lista: o adaptador monta (comuns do portão 1 + criterio_de_pronto do tipo).
Como mudar: a lista mora no YAML do tipo (deliverables/<tipo>.yaml, criterio_de_pronto.codigo); aqui só o comportamento.
"""
import copy
import json
from pathlib import Path

import pytest

from validador import ErroDeContexto, validar
from spec_helena import prova

PASTA = Path(__file__).resolve().parent.parent / "exemplos"


def _exemplo():
    resposta = json.loads((PASTA / "convite_resposta.json").read_text(encoding="utf-8"))
    contexto = json.loads((PASTA / "convite_contexto.json").read_text(encoding="utf-8"))
    return resposta, contexto


def _status(relatorio):
    return {c.id: c.status for c in relatorio.checagens}


def test_sem_a_lista_roda_todas_como_antes():
    resposta, contexto = _exemplo()
    contexto["modelo"].pop("checagens_a_rodar", None)
    status = _status(validar(resposta, contexto))
    assert status["CHK-GANHO-01"] in ("PASSOU", "FALHOU")


def test_com_a_lista_o_que_esta_fora_nao_se_aplica_e_as_de_acao_sempre_rodam():
    resposta, contexto = _exemplo()
    contexto["modelo"]["checagens_a_rodar"] = ["CHK-COMUM-01"]
    status = _status(validar(resposta, contexto))
    assert status["CHK-GANHO-01"] == "NAO_SE_APLICA"
    assert status["CHK-COMUM-05"] == "NAO_SE_APLICA"
    assert status["CHK-COMUM-01"] in ("PASSOU", "FALHOU")
    assert status["CHK-ACAO-01"] in ("PASSOU", "FALHOU")


def test_checagem_fora_da_lista_nao_recusa_mas_dentro_da_lista_recusa():
    _, contexto = _exemplo()
    ruim = json.loads((PASTA / "convite_com_defeito_resposta.json").read_text(encoding="utf-8"))
    todas = validar(ruim, copy.deepcopy(contexto))
    assert any(c.id == "CHK-GANHO-01" and c.status == "FALHOU" for c in todas.checagens), "o exemplo ruim deve falhar em CHK-GANHO-01"
    contexto["modelo"]["checagens_a_rodar"] = ["CHK-COMUM-01"]
    so_comum = validar(ruim, copy.deepcopy(contexto))
    assert _status(so_comum)["CHK-GANHO-01"] == "NAO_SE_APLICA"
    contexto["modelo"]["checagens_a_rodar"] = ["CHK-GANHO-01"]
    com_ganho = validar(ruim, contexto)
    assert any(c.id == "CHK-GANHO-01" and c.status == "FALHOU" for c in com_ganho.checagens)


def test_lista_mal_formada_e_erro_de_contexto():
    resposta, contexto = _exemplo()
    contexto["modelo"]["checagens_a_rodar"] = "CHK-COMUM-01"
    with pytest.raises(ErroDeContexto):
        validar(resposta, contexto)


def test_o_adaptador_monta_a_lista_com_as_comuns_e_o_criterio_de_pronto_do_tipo():
    spec = prova.spec_padrao()
    from spec_helena.modelo import montar_modelo
    for tipo in ("calculo", "copy", "parecer"):
        modelo = montar_modelo(spec, tipo)
        lista = modelo["checagens_a_rodar"]
        comuns = [c["id"] for c in spec.checagens_comuns]
        assert lista[:len(comuns)] == comuns
        assert set(lista) - set(comuns) == set(spec.tipo(tipo)["criterio_de_pronto"]["codigo"]) - set(comuns)
        assert not any(i.startswith(("CHK-CALC-", "CHK-LEI-", "CHK-FONTE-", "CHK-TEMA-", "CHK-GANHO-")) for i in lista)
