# -*- coding: utf-8 -*-
"""Teste diferencial: a mesma sequência de eventos no provar.py e na função do banco, passo a passo.

O QUE É: para cada semente fixa, sorteia uma sequência de eventos (sorteio.py), manda cada evento ao
provar.replay (que reconstrói tudo a partir do zero) e à função helena_v2.aplicar_evento, e compara depois de
cada passo: o que aconteceu com o evento (aplicado, recusado, reação, comentário, card novo...), o estado de
todas as máquinas e todos os contadores. Compara também quando o evento é recusado.
Metade das sequências começa por um pedaço de uma das 12 jornadas reais, para chegar fundo (card pronto, ação externa).

DE ONDE VEM: só usa provar.py (a especificação executável) e o banco. Divergência = defeito no banco (ou na tabela gerada).

COMO MUDAR: HELENA_V2_DIF_SEMENTES muda quantas sequências por roteiro (padrão em test_04).
"""
import glob
import json
import random
import time
from pathlib import Path

import yaml

import ajudas as A
import sorteio as S

P = A.P
RAIZ = A.RAIZ
FINAIS_DO_CARD = ("PRONTO", "CANCELADO", "ENCERRADO_COM_FALHA")
ABERTAS_DA_ACAO = ("PROPOSTA", "AUTORIZADA", "EXECUTANDO_ACAO", "INCERTA")


def jornadas_reais():
    return [yaml.safe_load(Path(f).read_text(encoding="utf-8")) for f in sorted(glob.glob(str(RAIZ / "helena-v2" / "casos" / "*" / "jornada*.yaml")))]


def sequencia(con, vocab, tab, semente, auto, roteiro, passos, prefixo=None, cartao=None, inexploradas=(), compart=("ordens", "perguntas", "voltas")):
    """Roda uma sequência. Devolve (eventos, divergências, linhas de histórico do card). `prefixo` = eventos de uma jornada real."""
    sor = S.Sorteador(vocab, tab, roteiro, semente, inexploradas)
    cartao = cartao or {"pedido_grande": semente % 3 != 0, "plano_valido": semente % 7 != 0}
    j = {"id": f"dif-{semente}", "roteiro": roteiro, "eventos": [], "automatico": auto, "card": cartao}
    mundo = A.Mundo(con, j, vocab, tab, numero=f"dif-{semente}-{time.time_ns()}")
    comp = set(compart)
    foto_py = A.foto_do_replay(P.replay(j, vocab, tab, conferir_historico=False), comp)
    difs = A.comparar(foto_py, mundo.foto())
    if difs:
        return j["eventos"], [("início", difs)], mundo
    prefixo = list(prefixo or [])

    def tentar(e):
        r = P.replay(dict(j, eventos=j["eventos"] + [e]), vocab, tab, conferir_historico=False)
        return A.destino_do_replay(r, len(j["eventos"])), A.foto_do_replay(r, comp)

    depois_do_final = 0
    for k in range(len(prefixo) + passos):
        if foto_py["card"]["estado"] in FINAIS_DO_CARD:
            depois_do_final += 1
            abertas = [a for a in foto_py["acoes"].values() if a["estado"] in ABERTAS_DA_ACAO]
            if depois_do_final > (45 if abertas else 6):
                break
        e = prefixo[k] if k < len(prefixo) else sor.proximo(foto_py, tentar)
        j["eventos"].append(e)
        res_py = P.replay(j, vocab, tab, conferir_historico=False)
        r = mundo.evento(e)
        esperado = A.destino_do_replay(res_py, k)
        obtido = "RECUSADO" if r is None else r["resultado"]
        foto_py = A.foto_do_replay(res_py, comp)
        difs = A.comparar(foto_py, mundo.foto())
        if obtido != esperado:
            difs.insert(0, f"destino do evento: provar={esperado} banco={obtido} ({r})")
        if res_py["violacoes"]:
            difs.append(f"o próprio provar acusou violação: {res_py['violacoes'][:2]}")
        if difs:
            return j["eventos"], [(f"passo {k}: {json.dumps(e, ensure_ascii=False)}", difs)], mundo
    return j["eventos"], [], mundo


def rodar_tudo(con, vocab, tab, sementes, passos=110, verbose=False):
    """Todas as sequências: 3 roteiros x `sementes` x (automático ligado e desligado), mais as que partem das 12 jornadas reais."""
    divergencias, usados, finais, total_eventos = [], set(), {}, 0
    todas = {(m, b) for m, b in con.execute("select distinct maquina, base_id from helena_v2.passagem")}
    reais = jornadas_reais()
    rng = random.Random(2026)
    with A.ReplayRapido():
        plano = []
        for ir, roteiro in enumerate(S.ROTEIROS):
            for semente in range(1, sementes + 1):
                for auto in (False, True):
                    plano.append((semente + 100 * ir, auto, roteiro, [], None))
        for i, real in enumerate(reais):
            for repeticao in range(max(1, sementes // 6)):
                corte = rng.randint(max(1, len(real["eventos"]) // 3), len(real["eventos"]))
                plano.append((1000 + 10 * i + repeticao, bool(real.get("automatico", True)), real.get("roteiro") or P.ROTEIRO_DE_PROVA,
                              real["eventos"][:corte], real.get("card")))
        for semente, auto, roteiro, prefixo, cartao in plano:
            eventos, difs, mundo = sequencia(con, vocab, tab, semente, auto, roteiro, passos, prefixo, cartao, todas - usados)
            total_eventos += len(eventos)
            for linha in mundo.linhas("select distinct p.maquina, p.base_id from helena_v2.historico h join helena_v2.card c on c.id = h.card_id "
                                      "join helena_v2.passagem p on p.maquina = h.maquina and p.linha_id = h.linha_id "
                                      "where c.id = %s or c.card_pai_id = %s", (mundo.card, mundo.card)):
                usados.add((linha["maquina"], linha["base_id"]))
            est = mundo.foto()["card"]["estado"]
            finais[est] = finais.get(est, 0) + 1
            if difs:
                divergencias.append((semente, auto, difs))
            if verbose:
                print(semente, auto, len(eventos), est, "OK" if not difs else difs)
    return {"divergencias": divergencias, "linhas_usadas": usados, "finais": finais, "sequencias": len(plano), "eventos": total_eventos}
