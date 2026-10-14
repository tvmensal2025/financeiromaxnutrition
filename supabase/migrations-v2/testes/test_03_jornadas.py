# -*- coding: utf-8 -*-
"""(c) As 12 jornadas de helena-v2/casos/*/jornada*.yaml, passadas pela função do banco.

O QUE É: cada jornada roda no provar.replay (a referência) e na função helena_v2.aplicar_evento. O estado final do card,
de cada etapa e de cada ação, os contadores e as respostas guardadas têm de ser iguais, sem violação. Depois o histórico
do banco reconstrói o card (regra 13): reaplicando só os eventos de fora, sai o mesmo card.
COMO MUDAR: jornada nova em helena-v2/casos/<serviço>/jornada*.yaml entra sozinha.
"""
import glob
from pathlib import Path

import pytest
import yaml

import ajudas as A

P = A.P
ARQUIVOS = sorted(glob.glob(str(A.RAIZ / "helena-v2" / "casos" / "*" / "jornada*.yaml")))
COMPARTILHADOS = {"ordens", "perguntas", "voltas"}


def test_ha_doze_jornadas():
    assert len(ARQUIVOS) == 12, ARQUIVOS


@pytest.mark.parametrize("arquivo", ARQUIVOS, ids=lambda a: "/".join(Path(a).parts[-2:]))
def test_a_jornada_termina_no_mesmo_estado_final_do_provar_e_sem_violacao(con, arquivo):
    vocab, tab = P.carregar()
    j = yaml.safe_load(Path(arquivo).read_text(encoding="utf-8"))
    ref = P.replay(j, vocab, tab)
    assert ref["confere"] and not ref["violacoes"], "a jornada precisa passar no provar antes de passar no banco"
    m = A.Mundo(con, j, vocab, tab)
    respostas = m.rodar()
    assert A.comparar(A.foto_do_replay(ref, COMPARTILHADOS), m.foto()) == []
    foto = m.foto()
    assert foto["card"]["estado"] == ref["estado_card"]
    assert {i: e["estado"] for i, e in foto["etapas"].items()} == ref["etapas"]
    assert {a: x["estado"] for a, x in foto["acoes"].items()} == ref["acoes"]
    # o que o provar chama de "esperado" na própria jornada também vale no banco
    esp = j.get("esperado") or {}
    if "estado_card" in esp:
        assert foto["card"]["estado"] == esp["estado_card"]
    for i, st in (esp.get("etapas") or {}).items():
        assert foto["etapas"][i]["estado"] == st
    # nenhum evento da jornada foi recusado sem estar previsto: o banco recusou exatamente o que o provar recusou
    recusados_banco = sum(1 for r in respostas if r is not None and r["resultado"] in ("RECUSADO", "COMENTARIO_NO_CARD", "CARD_NOVO_LIGADO", "RESPOSTA_GUARDADA"))
    nao_enviados = sum(1 for r in respostas if r is None)   # fora do vocabulário ou sem a opção: o replay recusa antes de qualquer máquina
    assert recusados_banco + nao_enviados == len(ref["recusados"])
    # cada evento de fora virou exatamente uma linha de histórico; o resto é consequência (sinal ou automático)
    de_fora = m.linhas("select count(*) as n from helena_v2.historico where card_id = %s and origem = 'EXTERNO' and evento <> 'CARD_CRIADO' "
                       "and resultado <> 'RECUSADO'", (m.card,))[0]["n"]
    do_provar = sum(1 for h in ref["historico"] if h["via"] == "jornada")
    assert de_fora == do_provar
    automaticos = m.linhas("select count(*) as n from helena_v2.historico where card_id = %s and origem = 'AUTOMATICO'", (m.card,))[0]["n"]
    assert automaticos == sum(1 for h in ref["historico"] if h["via"] == "automatico")
    assert m.linhas("select * from helena_v2.conferir_historico(%s)", (m.card,)) == []


@pytest.mark.parametrize("arquivo", ARQUIVOS, ids=lambda a: "/".join(Path(a).parts[-2:]))
def test_o_historico_reconstroi_o_card(con, arquivo):
    """Regra 13: refaz o card só com o histórico (o pedido guardado e os eventos de fora) e chega ao mesmo estado."""
    vocab, tab = P.carregar()
    j = yaml.safe_load(Path(arquivo).read_text(encoding="utf-8"))
    m = A.Mundo(con, j, vocab, tab)
    m.rodar()
    original = m.foto()
    criado = m.linhas("select conteudo from helena_v2.historico where card_id = %s and evento = 'CARD_CRIADO'", (m.card,))
    assert len(criado) == 1
    roteiro = criado[0]["conteudo"]["roteiro"]
    # eventos de fora e automáticos, na ordem; sinais não entram (acontecem sozinhos)
    linhas = m.linhas("select * from helena_v2.historico where card_id = %s and origem in ('EXTERNO', 'AUTOMATICO') and evento <> 'CARD_CRIADO' "
                      "and resultado <> 'RECUSADO' order by id", (m.card,))
    eventos = []
    for h in linhas:
        e = {"papel": h["papel"], "evento": h["evento"], "alvo": h["alvo_codigo"] if h["maquina"] == "etapa" else
             ("card" if h["maquina"] == "card" else "acao:" + h["alvo_codigo"]), "params": {k: str(v) for k, v in h["parametros"].items()}}
        if h["ator"]:
            e["ator"] = h["ator"]
        if h["papel"] == "FUNDADOR" and h["versao_vista"] is not None and h["versao_vista"] != h["vars_antes"]["versao"]:
            e["versao_vista"] = "antiga"
        eventos.append(e)
    # RESPONDER/RECOMENDAR guardam a opção em params; os demais já vêm completos
    j2 = {"id": "refeito", "roteiro": roteiro, "automatico": False, "card": {"pedido_grande": j.get("card", {}).get("pedido_grande", True)},
          "eventos": eventos}
    m2 = A.Mundo(con, j2, vocab, tab)
    m2.rodar()
    assert A.comparar(original, m2.foto()) == []
