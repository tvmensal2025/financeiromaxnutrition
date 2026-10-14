"""Executor falso: cumpre o contrato sem o Hermes e passa pelo mesmo leitor de falha e pela mesma decisão."""

import threading
import time

import pytest

from cenarios import TEXTO_DIZ_COTA, verificador_de_acao
from executor_helena.executor import Executor
from executor_helena.executor_falso import ExecutorFalso, Roteiro
from executor_helena.provedor_falso import Simulacao
from executor_helena.tipos import (COTA, DESCONHECIDA, FERRAMENTA, FORMATO_ERRADO, GRANDE_DEMAIS, LIMITE_CHAMADAS, LOGIN, PROVEDOR,
                                   QUEDA, TEMPO, Execucao)


def execucao(ficha, id="E-1-n1", **kw):
    return Execucao(id=id, ficha=ficha, pacote="pedido", **kw)


def test_e_um_executor(ficha_sem_ferramenta):
    falso = ExecutorFalso()
    assert isinstance(falso, Executor)
    r = falso.rodar(execucao(ficha_sem_ferramenta))
    assert r.ok and r.texto and r.terminou_inteira and r.falha is None and r.ferramentas_recebidas == ()
    assert (r.modelo_usado, r.provedor_usado) == ("gpt-6-sol", "openai-codex") and r.codigo_de_saida == 0


def test_guarda_as_execucoes_recebidas_na_ordem(ficha_sem_ferramenta):
    falso = ExecutorFalso()
    falso.rodar(execucao(ficha_sem_ferramenta, "E-1"))
    falso.rodar(execucao(ficha_sem_ferramenta, "E-2"))
    assert [e.id for e in falso.execucoes] == ["E-1", "E-2"]


def test_roteiros_em_sequencia_e_o_ultimo_se_repete(ficha_sem_ferramenta):
    falso = ExecutorFalso([Roteiro(Simulacao.ERRO_429), Roteiro(Simulacao.LOGIN_RECUSADO), Roteiro(Simulacao.BOA)])
    resultados = [falso.rodar(execucao(ficha_sem_ferramenta, f"E-{i}")) for i in range(4)]
    assert [r.falha.classe if r.falha else None for r in resultados] == [COTA, LOGIN, None, None]


def test_roteiro_por_funcao(ficha_sem_ferramenta):
    falso = ExecutorFalso(lambda e: Roteiro(Simulacao.ERRO_429) if e.id.endswith("ruim") else Roteiro())
    assert falso.rodar(execucao(ficha_sem_ferramenta, "E-ruim")).falha.classe == COTA
    assert falso.rodar(execucao(ficha_sem_ferramenta, "E-bom")).ok


@pytest.mark.parametrize("simulacao,classe,codigo", [
    (Simulacao.ERRO_429, COTA, "HTTP_429"), (Simulacao.LOGIN_RECUSADO, LOGIN, "HTTP_401"),
    (Simulacao.ERRO_500, PROVEDOR, "HTTP_503"), (Simulacao.RESPOSTA_INVALIDA, PROVEDOR, "EmptyStreamError"),
    (Simulacao.QUEDA_NO_MEIO, QUEDA, "CORTE_NO_MEIO_DA_RESPOSTA"), (Simulacao.CONTEXTO_GRANDE, GRANDE_DEMAIS, "CONTEXTO_MAIOR_QUE_O_MODELO"),
    (Simulacao.SAIDA_CORTADA, GRANDE_DEMAIS, "SAIDA_CORTADA_NO_LIMITE"), (Simulacao.RESPOSTA_VAZIA, FORMATO_ERRADO, "RESPOSTA_VAZIA"),
    (Simulacao.ERRO_ESTRANHO, DESCONHECIDA, "HTTP_418"), (Simulacao.LACO_DE_FERRAMENTA, LIMITE_CHAMADAS, "LIMITE_DE_CHAMADAS"),
])
def test_cada_simulacao_vira_a_classe_certa_pelo_leitor_de_verdade(ficha_sem_ferramenta, simulacao, classe, codigo):
    r = ExecutorFalso(Roteiro(simulacao)).rodar(execucao(ficha_sem_ferramenta))
    assert (r.falha.classe, r.falha.codigo) == (classe, codigo)
    assert not r.terminou_inteira and r.texto is None and not r.ok


def test_quando_a_cota_volta(ficha_sem_ferramenta):
    r = ExecutorFalso(Roteiro(Simulacao.ERRO_429, voltar_em_s=7200)).rodar(execucao(ficha_sem_ferramenta))
    assert r.falha.voltar_em_s == 7200 and not r.falha.gasta_tentativa


def test_tempo_esgotado(ficha_sem_ferramenta):
    r = ExecutorFalso(Roteiro(Simulacao.LENTA, atraso_s=5)).rodar(execucao(ficha_sem_ferramenta, tempo_max_s=0.2))
    assert r.falha.classe == TEMPO and r.encerrado_por == "TEMPO" and r.tempo_s < 2
    ok = ExecutorFalso(Roteiro(Simulacao.BOA, atraso_s=0.05)).rodar(execucao(ficha_sem_ferramenta, tempo_max_s=5))
    assert ok.ok


def test_cancelamento_de_outra_thread(ficha_sem_ferramenta):
    falso = ExecutorFalso(Roteiro(atraso_s=30))
    resultado = {}
    fio = threading.Thread(target=lambda: resultado.update(r=falso.rodar(execucao(ficha_sem_ferramenta, tempo_max_s=60))))
    fio.start()
    time.sleep(0.2)
    assert falso.cancelar("E-1-n1") is True
    fio.join(5)
    r = resultado["r"]
    assert r.cancelada and r.falha is None and r.texto is None and not r.ok and r.tempo_s < 5
    assert falso.cancelar("E-1-n1") is False and falso.cancelar("E-outra") is False


def test_agente_diz_cota_com_provedor_saudavel_nao_e_cota(ficha_sem_ferramenta):
    r = ExecutorFalso(Roteiro(Simulacao.BOA, texto=TEXTO_DIZ_COTA)).rodar(execucao(ficha_sem_ferramenta))
    assert r.ok and r.falha is None and r.texto == TEXTO_DIZ_COTA


def test_verificador_de_formato_vale_tambem_no_falso(ficha_sem_ferramenta):
    r = ExecutorFalso(Roteiro(Simulacao.FORMATO_ERRADO, texto="sem acao nenhuma")).rodar(
        execucao(ficha_sem_ferramenta, verificador_de_formato=verificador_de_acao))
    assert r.falha.classe == FORMATO_ERRADO and r.terminou_inteira and r.texto == "sem acao nenhuma"


def test_a_conferencia_vale_no_falso_ferramenta_ausente_e_ferramentas_diferentes(ficha_sem_ferramenta):
    ausente = ExecutorFalso(Roteiro(sem_listar_ferramentas=True)).rodar(execucao(ficha_sem_ferramenta))
    assert ausente.falha.classe == FERRAMENTA and ausente.falha.codigo == "FERRAMENTAS_NAO_LISTADAS" and ausente.texto is None
    diferentes = ExecutorFalso(Roteiro(ferramentas_servidas=("buscar",))).rodar(execucao(ficha_sem_ferramenta))
    assert diferentes.falha.codigo == "FERRAMENTAS_DIFERENTES_DA_FICHA" and not diferentes.ok


def test_a_conferencia_vale_no_falso_troca_escondida_de_modelo_e_provedor(ficha_sem_ferramenta):
    modelo = ExecutorFalso(Roteiro(modelo="gpt-escondido")).rodar(execucao(ficha_sem_ferramenta))
    assert modelo.falha.classe == PROVEDOR and modelo.falha.codigo == "MODELO_DIFERENTE_DA_FICHA" and modelo.texto is None
    provedor = ExecutorFalso(Roteiro(provedor="openrouter")).rodar(execucao(ficha_sem_ferramenta))
    assert provedor.falha.codigo == "PROVEDOR_DIFERENTE_DA_FICHA"


def test_ferramentas_da_ficha_aparecem_como_recebidas(ficha_com_ferramentas):
    r = ExecutorFalso().rodar(execucao(ficha_com_ferramentas, fontes_permitidas=("https://exemplo.org/",)))
    assert r.ferramentas_recebidas == ("buscar", "ler_pagina") and r.ok
