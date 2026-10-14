# -*- coding: utf-8 -*-
"""Sorteio de eventos para o teste diferencial (provar.py contra a função do banco).

O QUE É: monta sequências aleatórias de eventos (com semente fixa, então sempre as mesmas) no formato
das jornadas (jornada.schema.json). Mistura eventos que a tabela aceita no estado atual (para o card
andar fundo, até ficar pronto, ser cancelado, substituído...) com eventos soltos do vocabulário (para provar
também as recusas, as reações e os toques sem passagem).

DE ONDE VEM: só lê o vocabulário e a tabela (via provar.montar). Não decide nada: quem diz o que acontece
são o provar.replay e o banco, e o teste exige que digam o mesmo. Para o card andar, o sorteio pergunta ao
provar o que cada candidato faria e prefere os que chegam mais perto de "pronto" (sem nenhuma regra escrita aqui).

COMO MUDAR: pesos e roteiros no começo do arquivo.
"""
import math
import random
import re
from collections import defaultdict, deque

import ajudas as A

P = A.P

ROTEIRO_UMA_ETAPA = {"etapas": [
    {"id": "E1", "nome": "só uma", "autor": "CAIO", "revisores": ["CLARA", "HELENA"], "depende_de": [], "julga": [],
     "internet": False, "pulavel": True, "usa_decisao": True,
     "acoes_permitidas": ["ENTREGAR", "PERGUNTAR", "DEVOLVER_A_QUEM_PEDIU", "REGISTRAR_FALHA"]}]}

ROTEIRO_DUAS_COM_JURIDICO = {"etapas": [
    {"id": "E1", "nome": "texto", "autor": "ISABELA", "revisores": ["CAIO", "FUNDADOR"], "depende_de": [], "julga": [],
     "internet": True, "pulavel": False, "usa_decisao": True, "prazo_de_terceiro": True,
     "acoes_permitidas": ["ENTREGAR", "PERGUNTAR", "REGISTRAR_FALHA"]},
    {"id": "E2", "nome": "parecer", "autor": "CLARA", "revisores": ["HELENA", "FUNDADOR"], "depende_de": ["E1"], "julga": ["E1"],
     "internet": True, "pulavel": False, "usa_decisao": True, "acoes_permitidas": ["ENTREGAR", "REGISTRAR_FALHA"]}]}

ROTEIROS = [P.ROTEIRO_DE_PROVA, ROTEIRO_UMA_ETAPA, ROTEIRO_DUAS_COM_JURIDICO]


def distancias(maquina, alvos):
    """Menor número de passagens (ignorando as guardas) de cada estado até algum estado de `alvos`."""
    entra = defaultdict(set)
    for ln in maquina.linhas:
        entra[ln.para].add(ln.de)
    dist = {a: 0 for a in alvos}
    fila = deque(alvos)
    while fila:
        e = fila.popleft()
        for de in entra[e]:
            if de not in dist:
                dist[de] = dist[e] + 1
                fila.append(de)
    return dist


class Sorteador:
    TERMINAIS = {("FUNDADOR", "CANCELAR")}

    def __init__(self, vocab, tabela, roteiro, semente, inexploradas=()):
        """`inexploradas` = {(máquina, id da linha)} que as sequências anteriores ainda não exercitaram: o sorteio as prefere."""
        self.vocab, self.tab, self.roteiro = vocab, tabela, roteiro
        self.rng = random.Random(semente)
        self.ambicao = self.rng.choice([0.3, 0.8, 1.6])   # quanto prefere o que chega mais perto do pronto
        self.maqs = P.montar(vocab, tabela)
        self.perfis = {p["id"]: p for p in P.perfis_do_roteiro(roteiro, tabela, vocab)}
        self.agentes = list(vocab["identidades"]["agentes"])
        self.botoes = list(vocab["botoes_do_fundador"])
        self.eventos_de = defaultdict(set)   # (maquina, estado) -> {(papel, evento)}
        self.literais = defaultdict(set)     # (maquina, estado, papel, evento) -> textos entre aspas citados nas guardas
        for nome, m in self.maqs.items():
            for ln in m.linhas:
                self.eventos_de[(nome, ln.de)].add((ln.papel, ln.evento))
                self.literais[(nome, ln.de, ln.papel, ln.evento)] |= set(re.findall(r"'([A-Z_0-9]+)'", ln.guarda_txt or ""))
        ines = set(inexploradas)
        self.quentes = {(nome, ln.de, ln.papel, ln.evento) for nome, m in self.maqs.items() for ln in m.linhas if (nome, ln.bruta["id"]) in ines}
        self.todos = sorted({(papel, ev) for papel, evs in vocab["acoes"].items() for ev in evs})
        self.dist = {"card": distancias(self.maqs["card"], ["PRONTO"]),
                     "etapa": distancias(self.maqs["etapa"], ["APROVADA", "PRONTA"]),
                     "acao_externa": distancias(self.maqs["acao_externa"], ["EXECUTADA"])}

    # ------------------------------------------------------------------ quão perto do pronto
    def distancia_total(self, foto):
        d = self.dist["card"].get(foto["card"]["estado"], 30)
        for e in foto["etapas"].values():
            d += self.dist["etapa"].get(e["estado"], 30)
        for a in foto["acoes"].values():
            d += self.dist["acao_externa"].get(a["estado"], 30)
        return d

    # ------------------------------------------------------------------ um candidato
    def alvo(self, foto):
        r = self.rng.random()
        acoes = sorted(foto["acoes"])
        if acoes and r < 0.25:
            a = self.rng.choice(acoes)
            return "acao:" + a, "acao_externa", foto["acoes"][a]["estado"], None
        if r < 0.45:
            return "card", "card", foto["card"]["estado"], None
        i = self.rng.choice(sorted(self.perfis))
        return i, "etapa", foto["etapas"][i]["estado"], foto["etapas"][i]

    def params(self, papel, evento, maquina, estado, alvo_etapa):
        dom = self.maqs["etapa"].parametros.get((papel, evento), {})
        citados = self.literais.get((maquina, estado, papel, evento), set())
        p = {}
        for nome, valores in dom.items():
            uteis = [v for v in valores if v in citados]
            if nome == "escolhido" and alvo_etapa is not None and self.rng.random() < 0.85:
                p[nome] = self.rng.choice(self.perfis[alvo_etapa]["revisores_validos"])
            elif nome == "parecer":
                p[nome] = self.rng.choice(["OK", "OK", "OK", "AJUSTE", "NAO_PODE"])
            elif nome == "acao_externa":
                p[nome] = self.rng.choice(["NENHUMA", "SO_FUNDADOR", "PELO_MOTOR"])
            elif nome == "usou_internet":
                p[nome] = self.rng.choice(["NAO", "NAO", "SIM"])
            elif uteis and self.rng.random() < 0.85:
                p[nome] = self.rng.choice(uteis)
            else:
                p[nome] = self.rng.choice(valores)
        return {k: str(v) for k, v in p.items()}

    def um(self, foto):
        """Um evento no formato da jornada, olhando a fotografia atual (a do provar)."""
        alvo, maquina, estado, linha_etapa = self.alvo(foto)
        livres = sorted(self.eventos_de.get((maquina, estado), set()))
        botoes = [("FUNDADOR", b) for b in self.botoes]
        agente = []
        if maquina == "etapa":
            agente = [("AUTOR", a) for a in self.vocab["acoes"]["AUTOR"]] + [("REVISOR", a) for a in self.vocab["acoes"]["REVISOR"]]
        r = self.rng.random()
        if r < 0.70 and livres:
            quentes = [x for x in livres if (maquina, estado, *x) in self.quentes]
            papel, evento = self.rng.choice(quentes if quentes and self.rng.random() < 0.7 else livres)
        elif r < 0.88:
            papel, evento = self.rng.choice(botoes + agente)
        else:
            papel, evento = self.rng.choice(self.todos)
        e = {"papel": papel, "evento": evento, "alvo": alvo}
        i_etapa = alvo if maquina == "etapa" else None
        p = self.params(papel, evento, maquina, estado, i_etapa)
        if p:
            e["params"] = p
        if papel == "AUTOR" and i_etapa and self.rng.random() < 0.3:
            e["ator"] = self.rng.choice([self.perfis[i_etapa]["autor"], self.rng.choice(self.agentes)])
        if papel == "REVISOR" and i_etapa:
            desig = linha_etapa.get("revisor", "NENHUM")
            e["ator"] = desig if (desig != "NENHUM" and self.rng.random() < 0.85) else self.rng.choice(self.agentes)
        if papel in ("AUTOR", "REVISOR", "HELENA") and self.rng.random() < 0.10:
            e["chave"] = "antiga"
        if papel == "FUNDADOR" and evento in P.ESPEC_BOTOES_COM_VERSAO and self.rng.random() < 0.10:
            e["versao_vista"] = "antiga"
        return e

    def terminal(self, e):
        return (e["papel"], e["evento"]) in self.TERMINAIS or (e["evento"] == "RESPONDER" and e.get("params", {}).get("opcao") == "ENCERRAR")

    # ------------------------------------------------------------------ o escolhido
    def proximo(self, foto, tentar, candidatos=14):
        """Escolhe o próximo evento. `tentar(e)` devolve (saida, foto_depois): como o provar trataria o candidato.
        Quase sempre vale um que o provar aceita, de preferência o que chega mais perto do pronto;
        de vez em quando vale um qualquer (prova as recusas)."""
        cands = [self.um(foto) for _ in range(candidatos)]
        if self.rng.random() > 0.015:   # cancelar e encerrar acabam o card: só de vez em quando
            sobrou = [e for e in cands if not self.terminal(e)]
            cands = sobrou or cands
        provas = [tentar(e) for e in cands]
        aceitos = [(e, f) for e, (o, f) in zip(cands, provas) if o in ("APLICADO", "CONVERTIDO")]
        if self.rng.random() > 0.02:    # idem para o que acaba o card sem ficar pronto (ex.: a 4ª ordem substitui o card)
            sobrou = [(e, f) for e, f in aceitos if f["card"]["estado"] not in ("CANCELADO", "ENCERRADO_COM_FALHA")]
            aceitos = sobrou if sobrou or not aceitos else []
        if aceitos and self.rng.random() < 0.92:
            base = self.distancia_total(foto)
            pesos = [max(math.exp(-self.ambicao * (self.distancia_total(f) - base)), 0.002) for _, f in aceitos]
            return self.rng.choices([e for e, _ in aceitos], weights=pesos)[0]
        return self.rng.choice(cands)
