"""Contrato do contexto operacional: só dados recebidos, sem corpus de casos."""
import copy
from pathlib import Path

import pytest

from orquestrador.contexto_real import montar_contexto_real
from spec_helena import Spec
from validador.contexto import conferir_contexto


RAIZ = Path(__file__).resolve().parents[3] / "helena-v2"


def spec():
    return Spec(RAIZ)


def pedido_operacional():
    return {
        "ordem_de_servico": {
            "pedido_original": "Compare https://exemplo.invalid/termos com o documento fornecido.",
            "fontes_que_pode_ler": ["https://exemplo.invalid/termos", "https://outra.invalid/regras"],
        },
        "plano": {"etapas": [{"id": "E1", "servico": "SRV-CALCULO", "acao_do_fundador": "AF-TESTE"}]},
        "pacote_da_empresa": {"empresa": "BIZ-TESTE", "grafia": "Empresa de Teste"},
    }


def test_contexto_usa_apenas_evidencia_operacional_fornecida():
    pedido = pedido_operacional()
    fontes = {"FON-TESTE": "Havia 7 pessoas na medição fornecida."}
    decisoes = [{"id": "DEC-TESTE", "versao": 3, "valor": "7"}]
    paginas = [{"leitura_id": "LEI-TESTE", "url": "https://exemplo.invalid/termos", "execucao": "EXE-TESTE",
                "partes_total": 1, "partes": {"1": "Texto observado na página de teste."}}]
    contexto = montar_contexto_real(
        spec(), "SRV-CALCULO", pedido=pedido, fontes_importadas=fontes, decisoes=decisoes,
        execucao_id="EXE-TESTE", paginas_lidas=paginas, usou_internet=True, hoje="2026-10-13")

    conferir_contexto(contexto)
    assert contexto["execucao_id"] == "EXE-TESTE"
    assert contexto["usou_internet"] == "SIM"
    assert contexto["hoje"] == "2026-10-13"
    assert contexto["links_do_pedido"] == ["https://exemplo.invalid/termos", "https://outra.invalid/regras"]
    assert contexto["fontes_importadas"] == [{"fonte_importada_id": "FON-TESTE", "texto": fontes["FON-TESTE"]}]
    assert contexto["decisoes_vigentes"] == decisoes
    assert contexto["paginas_lidas"] == paginas
    assert contexto["pacote_da_empresa"] == pedido["pacote_da_empresa"]
    assert contexto["pedido"] == pedido
    assert contexto["modelo"]["tipo"] == "calculo"
    assert contexto["modelo"]["acao_do_fundador_do_plano"] == "AF-TESTE"
    assert "CHK-CALCULO-02" in contexto["modelo"]["checagens_a_rodar"]
    assert "CHK-COMUM-01" in contexto["modelo"]["checagens_a_rodar"]

    original = copy.deepcopy(contexto)
    pedido["pacote_da_empresa"]["grafia"] = "ALTERADO"
    fontes["FON-TESTE"] = "ALTERADO"
    decisoes[0]["valor"] = "ALTERADO"
    paginas[0]["partes"]["1"] = "ALTERADO"
    assert contexto == original


def test_ausencia_de_evidencia_nao_cria_fonte_pagina_decisao_ou_data():
    pedido = {"card": {"ordem_de_servico": {"pedido_original": "Faça a conta pedida."},
                        "plano": {"etapas": [{"id": "E1", "servico": "SRV-CALCULO"}]}},
              "fontes_importadas": [{"id": "FON-NAO-FORNECIDA", "texto": "99 pessoas"}],
              "criado_em": "2020-01-01"}
    contexto = montar_contexto_real(spec(), "SRV-CALCULO", pedido=pedido, fontes_importadas={}, decisoes=[],
                                    execucao_id="EXE-SEM-PROVA")
    conferir_contexto(contexto)
    assert contexto["usou_internet"] == "NAO"
    assert contexto["links_do_pedido"] == []
    assert contexto["fontes_importadas"] == []
    assert contexto["paginas_lidas"] == []
    assert contexto["decisoes_vigentes"] == []
    assert "hoje" not in contexto
    assert "acao_do_fundador_do_plano" not in contexto["modelo"]


def test_plano_recusa_acao_nao_textual_sem_erro_de_tipo():
    pedido = pedido_operacional()
    pedido["plano"]["etapas"][0]["acao_do_fundador"] = ["AF-TESTE"]
    with pytest.raises(ValueError, match="acao_do_fundador"):
        montar_contexto_real(spec(), "SRV-CALCULO", pedido=pedido, fontes_importadas={}, decisoes=[],
                            execucao_id="EXE-TESTE")


def test_plano_recusa_acoes_contraditorias_no_mesmo_servico():
    pedido = pedido_operacional()
    pedido["plano"]["etapas"].append({"id": "E2", "servico": "SRV-CALCULO", "acao_do_fundador": "AF-OUTRA"})
    with pytest.raises(ValueError, match="ações do fundador diferentes"):
        montar_contexto_real(spec(), "SRV-CALCULO", pedido=pedido, fontes_importadas={}, decisoes=[],
                            execucao_id="EXE-TESTE")


def test_recusa_evidencia_que_nao_pode_ser_congelada_como_json():
    with pytest.raises(ValueError, match="decisoes.*JSON"):
        montar_contexto_real(spec(), "SRV-CALCULO", pedido=pedido_operacional(), fontes_importadas={},
                            decisoes=[{"id": "DEC-TESTE", "objeto": object()}], execucao_id="EXE-TESTE")


def test_recusa_decisoes_duplicadas_que_sobrescreveriam_versao():
    with pytest.raises(ValueError, match="decisoes.*repetidos"):
        montar_contexto_real(spec(), "SRV-CALCULO", pedido=pedido_operacional(), fontes_importadas={},
                            decisoes=[{"id": "DEC-TESTE", "versao": 1}, {"id": "DEC-TESTE", "versao": 2}],
                            execucao_id="EXE-TESTE")


@pytest.mark.parametrize("mudanca,mensagem", [
    ({"servico": "SRV-INEXISTENTE"}, "serviço"),
    ({"pedido": {}}, "ordem_de_servico"),
    ({"fontes_importadas": {"FON-TESTE": None}}, "fontes_importadas"),
    ({"decisoes": [{"versao": 1}]}, "decisoes"),
    ({"paginas_lidas": [{"leitura_id": "LEI-1", "url": "https://exemplo.invalid", "partes": {"1": "x"}}]}, "execucao"),
    ({"paginas_lidas": [{"leitura_id": "LEI-1", "url": "https://exemplo.invalid", "execucao": "OUTRA", "partes": {"1": "x"}}]}, "execucao"),
    ({"paginas_lidas": [{"leitura_id": "LEI-1", "url": "https://exemplo.invalid", "execucao": "EXE-TESTE", "partes": {"1": "x"}}]}, "usou_internet"),
    ({"hoje": "2026-02-30"}, "hoje"),
])
def test_recusa_contexto_ausente_ou_contraditorio(mudanca, mensagem):
    kwargs = dict(spec=spec(), servico="SRV-CALCULO", pedido=pedido_operacional(), fontes_importadas={},
                  decisoes=[], execucao_id="EXE-TESTE")
    kwargs.update(mudanca)
    with pytest.raises(ValueError, match=mensagem):
        montar_contexto_real(**kwargs)
