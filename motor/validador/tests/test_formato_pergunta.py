"""A saída PERGUNTAR respeita o esquema e só recomenda opção apresentada."""
import copy
import json

import pytest

from validador import validar


CONTEXTO = {"modelo": {"acoes_permitidas": ["PERGUNTAR"]}}
PERGUNTA = {
    "acao": "PERGUNTAR",
    "pergunta": "Qual opção você prefere para continuar?",
    "opcoes": [
        {"letra": "A", "texto": "Primeira opção", "consequencia": "Seguimos com a primeira opção."},
        {"letra": "B", "texto": "Segunda opção", "consequencia": "Seguimos com a segunda opção."},
    ],
}


def _motivos(resposta):
    return {f.motivo for f in validar(resposta, CONTEXTO).falhas_de("CHK-ACAO-01")}


def test_pergunta_valida_com_duas_ou_tres_opcoes_passa():
    duas = copy.deepcopy(PERGUNTA)
    duas["recomendacao"] = "B"
    assert validar(json.dumps(duas), CONTEXTO).aprovada

    tres = copy.deepcopy(duas)
    tres["opcoes"].append({"letra": "C", "texto": "Terceira opção", "consequencia": "Seguimos com a terceira opção."})
    tres["recomendacao"] = "C"
    assert validar(json.dumps(tres), CONTEXTO).aprovada


@pytest.mark.parametrize("resposta", [
    '{"acao":"ENTREGAR","acao":"PERGUNTAR","pergunta":"Qual opção você prefere para continuar?",'
    '"opcoes":[{"letra":"A","texto":"Primeira opção","consequencia":"Seguimos com a primeira opção."},'
    '{"letra":"B","texto":"Segunda opção","consequencia":"Seguimos com a segunda opção."}]}',
    '{"acao":"PERGUNTAR","pergunta":"Qual opção você prefere para continuar?",'
    '"opcoes":[{"letra":"A","texto":"Primeira opção","texto":"Outra opção",'
    '"consequencia":"Seguimos com a primeira opção."},'
    '{"letra":"B","texto":"Segunda opção","consequencia":"Seguimos com a segunda opção."}]}',
])
def test_chave_repetida_em_qualquer_nivel_recusa(resposta):
    assert _motivos(resposta) == {"CHAVE_REPETIDA"}


@pytest.mark.parametrize("alteracao", [
    {"texto": 123},
    {"texto": "x"},
    {"texto": "x" * 161},
    {"consequencia": None},
    {"consequencia": "x"},
    {"consequencia": "x" * 201},
    {"campo_extra": "texto que o esquema não permite"},
])
def test_opcao_fora_do_esquema_recusa(alteracao):
    resposta = copy.deepcopy(PERGUNTA)
    resposta["opcoes"][0].update(alteracao)
    assert "OPCOES_INVALIDAS" in _motivos(resposta)


def test_recomendacao_precisa_existir_nas_opcoes():
    resposta = copy.deepcopy(PERGUNTA)
    resposta["recomendacao"] = "C"
    assert _motivos(resposta) == {"RECOMENDACAO_SEM_OPCAO"}
