# -*- coding: utf-8 -*-
"""Sorteio de eventos para o teste diferencial (provar.py contra a função do banco).

O QUE É: monta sequências aleatórias de eventos (com semente fixa, então sempre as mesmas) no formato
das jornadas (jornada.schema.json). Mistura eventos que a tabela aceita no estado atual (para o card
andar fundo) com eventos soltos do vocabulário (para provar também as recusas, as reações e os toques sem passagem).

DE ONDE VEM: só lê o vocabulário e a tabela (via provar.montar). Não decide nada: quem diz o que acontece
são o provar.replay e o banco, e o teste exige que digam o mesmo.

COMO MUDAR: pesos e roteiros no começo do arquivo.
"""
import random

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


class Sorteador:
    def __init__(self, vocab, tabela, roteiro, semente):
        self.vocab, self.tab, self.roteiro = vocab, tabela, roteiro
        self.rng = random.Random(semente)
        self.maqs = P.montar(vocab, tabela)
        self.perfis = {p["id"]: p for p in P.perfis_do_roteiro(roteiro, tabela, vocab)}
        self.agentes = list(vocab["identidades"]["agentes"])
        self.botoes = list(vocab["botoes_do_fundador"])
        self.eventos_de = {}   # (maquina, estado) -> [(papel, evento)]
        for nome, m in self.maqs.items():
            for ln in m.linhas:
                self.eventos_de.setdefault((nome, ln.de), set()).add((ln.papel, ln.evento))
        self.todos = sorted({(papel, ev) for papel, evs in vocab["acoes"].items() for ev in evs})

    def alvo(self, foto):
        r = self.rng.random()
        acoes = sorted(foto["acoes"])
        if acoes and r < 0.15:
            a = self.rng.choice(acoes)
            return "acao:" + a, "acao_externa", foto["acoes"][a]["estado"], None
        if r < 0.40:
            return "card", "card", foto["card"]["estado"], None
        i = self.rng.choice(sorted(self.perfis))
        return i, "etapa", foto["etapas"][i]["estado"], foto["etapas"][i]

    def params(self, papel, evento, maquina, alvo_etapa):
        dom = self.maqs["etapa"].parametros.get((papel, evento), {})
        p = {}
        for nome, valores in dom.items():
            if nome == "escolhido" and alvo_etapa is not None and self.rng.random() < 0.8:
                p[nome] = self.rng.choice(self.perfis[alvo_etapa]["revisores_validos"])
            elif nome == "parecer":
                p[nome] = self.rng.choice(["OK", "OK", "OK", "AJUSTE", "NAO_PODE"])
            elif nome == "acao_externa":
                p[nome] = self.rng.choice(["NENHUMA", "SO_FUNDADOR", "PELO_MOTOR"])
            elif nome == "usou_internet":
                p[nome] = self.rng.choice(["NAO", "NAO", "SIM"])
            else:
                p[nome] = self.rng.choice(valores)
        return {k: str(v) for k, v in p.items()}

    TERMINAIS = {("FUNDADOR", "CANCELAR")}

    def terminal(self, e):
        return (e["papel"], e["evento"]) in self.TERMINAIS or (e["evento"] == "RESPONDER" and e.get("params", {}).get("opcao") == "ENCERRAR")

    def proximo(self, foto, tentar, candidatos=10):
        """Escolhe o próximo evento. `tentar(e)` diz como o provar trataria cada candidato (APLICADO, RECUSADO...).
        Quase sempre vale um que o provar aceita (o card anda fundo); de vez em quando vale um qualquer (prova as recusas)."""
        cands = [self.um(foto) for _ in range(candidatos)]
        saidas = [tentar(e) for e in cands]
        aceitos = [e for e, o in zip(cands, saidas) if o in ("APLICADO", "CONVERTIDO")]
        if aceitos and self.rng.random() < 0.9:
            pesos = [0.08 if self.terminal(e) else 1.0 for e in aceitos]
            return self.rng.choices(aceitos, weights=pesos)[0]
        return self.rng.choice(cands)

    def um(self, foto):
        """Um evento no formato da jornada, olhando a fotografia atual (a do provar)."""
        alvo, maquina, estado, linha_etapa = self.alvo(foto)
        livres = sorted(self.eventos_de.get((maquina, estado), set()))
        botoes = [("FUNDADOR", b) for b in self.botoes]
        agente = []
        if maquina == "etapa":
            agente = [("AUTOR", a) for a in self.vocab["acoes"]["AUTOR"]] + [("REVISOR", a) for a in self.vocab["acoes"]["REVISOR"]]
        r = self.rng.random()
        if r < 0.62 and livres:
            papel, evento = self.rng.choice(livres)
        elif r < 0.82:
            papel, evento = self.rng.choice(botoes + agente)
        else:
            papel, evento = self.rng.choice(self.todos)
        e = {"papel": papel, "evento": evento, "alvo": alvo}
        i_etapa = alvo if maquina == "etapa" else None
        p = self.params(papel, evento, maquina, i_etapa)
        if p:
            e["params"] = p
        if papel == "AUTOR" and i_etapa and self.rng.random() < 0.3:
            e["ator"] = self.rng.choice([self.perfis[i_etapa]["autor"], self.rng.choice(self.agentes)])
        if papel == "REVISOR" and i_etapa:
            desig = linha_etapa.get("revisor", "NENHUM")
            e["ator"] = desig if (desig != "NENHUM" and self.rng.random() < 0.85) else self.rng.choice(self.agentes)
        if papel in ("AUTOR", "REVISOR", "HELENA") and self.rng.random() < 0.12:
            e["chave"] = "antiga"
        if papel == "FUNDADOR" and evento in P.ESPEC_BOTOES_COM_VERSAO and self.rng.random() < 0.12:
            e["versao_vista"] = "antiga"
        return e
