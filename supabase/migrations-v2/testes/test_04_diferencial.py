# -*- coding: utf-8 -*-
"""(d) Teste diferencial: sequências aleatórias (semente fixa) no provar.py e na função do banco.

O QUE É: depois de CADA passo, o provar.replay e o banco têm de concordar no destino do evento (aplicado, recusado,
reação, comentário, card novo ligado, resposta guardada), no estado de todas as máquinas e em todos os contadores,
inclusive quando o evento é recusado. Ver diferencial.py e sorteio.py.
COMO MUDAR: HELENA_V2_DIF_SEMENTES (padrão 8) escolhe quantas sequências por roteiro; mais sementes, mais cobertura e mais tempo.
"""
import os

import pytest

import ajudas as A
import diferencial as D

P = A.P
SEMENTES = int(os.environ.get("HELENA_V2_DIF_SEMENTES", "8"))


@pytest.fixture(scope="module")
def resultado(banco):
    vocab, tab = P.carregar()
    with banco.conectar() as con:
        r = D.rodar_tudo(con, vocab, tab, SEMENTES)
        r["base_usadas"] = set(r["linhas_usadas"])
        r["base_todas"] = {(m, b) for m, b in con.execute("select distinct maquina, base_id from helena_v2.passagem")}
    return r


def test_nenhuma_divergencia_entre_o_provar_e_o_banco(resultado):
    assert resultado["divergencias"] == [], resultado["divergencias"][:2]
    assert resultado["sequencias"] >= 3 * 2 * SEMENTES
    assert resultado["eventos"] > 1500


def test_as_sequencias_chegam_a_finais_diferentes(resultado):
    """Se todas acabassem cedo no mesmo lugar, o teste não provaria nada."""
    assert resultado["finais"].get("PRONTO", 0) >= 1, resultado["finais"]
    assert resultado["finais"].get("CANCELADO", 0) >= 1, resultado["finais"]


def test_cobertura_das_linhas_da_tabela(resultado):
    """Quantas linhas da tabela as sequências exercitaram. O número vai no relatório do teste (pytest -s)."""
    usadas, todas = resultado["base_usadas"], resultado["base_todas"]
    por_maquina = {}
    for m, b in todas:
        t = por_maquina.setdefault(m, [0, 0])
        t[1] += 1
        t[0] += (m, b) in usadas
    print("\ncobertura das linhas pelo teste diferencial:", {m: f"{a}/{t}" for m, (a, t) in por_maquina.items()},
          "| total", f"{len(usadas)}/{len(todas)}", "| finais", resultado["finais"], "| eventos", resultado["eventos"])
    assert len(usadas) / len(todas) >= 0.55, f"cobertura baixa: {len(usadas)}/{len(todas)}"
