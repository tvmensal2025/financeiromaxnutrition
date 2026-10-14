"""O que é: regressão coletada do ataque de fidelidade parcial, preservado ao lado.
Como mudar: acrescente provas de equivalência entre o banco e provar.py.
"""
# Cópia convertida em regressão e coletada pelo pytest; o ataque parcial original permanece para auditoria.
# -*- coding: utf-8 -*-
"""ATAQUE 1 (fidelidade): tenta quebrar a igualdade entre a função do banco e a máquina de referência (provar.py).

O QUE É: casos escritos para ACHAR diferença entre o banco (helena_v2.aplicar_evento) e o provar.py/replay: contadores
no teto, número de versão e chave de execução velhos DE VERDADE (não só "uma casa para trás"), revisor igual ao autor,
ação externa repetida, card cancelado no meio, sinais em cascata, roteiros fora do comum e partes do YAML que o gerador
poderia deixar de fora em silêncio. Só ficam aqui os casos que PASSAM (viram teste de regressão). Os que o banco falhou
foram para o relato do ataque, com o comando que reproduz; não estão neste arquivo.
Quatro jeitos de comparar: (1) DUELO passo a passo (cada evento nos dois lados; destino, estado e contadores iguais);
(2) SONDA: a partir de um estado de borda, os eventos do vocabulário contra todo alvo, com chave/versão/ator atuais e
velhos, são mandados ao banco dentro de uma transação que é desfeita, e comparados com o provar; (3) MECÂNICA: as
funções internas do banco (achar a linha, aplicar os efeitos, criar o card) contra o provar, em milhares de sorteios;
(4) ALEATÓRIO em roteiros diferentes dos três de sempre, olhando também os campos escondidos (portão 1, entrega fresca).

DE ONDE VEM: só usa o provar.py (a especificação executável), o banco e os ajudantes de ajudas.py. Nenhuma regra é escrita aqui.
COMO MUDAR: caso novo = uma linha em ESTADOS_DE_BORDA (lista de eventos + as linhas da tabela que ele TEM de exercitar) ou um
teste novo. HELENA_V2_ATAQUE_ESCALA=3 manda a sonda completa em todos os estados e roda mais sequências aleatórias.
"""
import copy
import itertools
import json
import os
import random
import re
import time
from contextlib import contextmanager

import psycopg
import pytest
from psycopg.types.json import Jsonb

import ajudas as A
import conftest as C
import gerar_passagens as G
import sorteio as S

P = A.P
VOCAB, TAB = P.carregar()
MAQUINAS = P.montar(VOCAB, TAB)
COMPARTILHADOS = {"ordens", "perguntas", "voltas"}
ESCALA = int(os.environ.get("HELENA_V2_ATAQUE_ESCALA", "1"))
FINAIS_DO_CARD = ("PRONTO", "CANCELADO", "ENCERRADO_COM_FALHA")
NOMES_POSSIVEIS = list(VOCAB["identidades"]["agentes"]) + [VOCAB["identidades"]["fundador"]]


# ============================================================================== o ajudante do ataque
def ev(papel, evento, alvo="card", **kw):
    """Um evento no formato das jornadas. ator, chave e versao_vista vão como estão; o resto vira parâmetro."""
    e = {"papel": papel, "evento": evento, "alvo": alvo}
    params = {k: str(v) for k, v in kw.items() if k not in ("ator", "chave", "versao_vista")}
    if params:
        e["params"] = params
    for k in ("ator", "chave", "versao_vista"):
        if k in kw:
            e[k] = kw[k]
    return e


class MundoAtaque(A.Mundo):
    """O Mundo de sempre, mais um jeito de mandar ao banco o número VERDADEIRO de um toque velho.
    Um evento com `_chave_real` ou `_versao_real` leva esse número ao banco (o provar só vê `chave: antiga` ou `versao_vista: antiga`)."""

    def evento(self, e, nao_disparar=None):
        if "_chave_real" not in e and "_versao_real" not in e:
            return super().evento(e, nao_disparar)
        papel, evento, alvo = e["papel"], e["evento"], e.get("alvo", "card")
        i_etapa = alvo if alvo in self.perfis else None
        params = self.params_de(papel, evento, e.get("params"), i_etapa)
        maquina, alvo_id = self.maquina_do_alvo(alvo)
        if params is None or maquina is None:
            return None
        ator = e.get("ator")
        if ator is None and i_etapa:
            ator = self.perfis[i_etapa]["autor"] if papel == "AUTOR" else self.chamar("select revisor from helena_v2.etapa where id = %s", (alvo_id,))
        return self.chamar("select helena_v2.aplicar_evento(%s, %s, %s, %s, %s, %s, %s, %s, null, null, %s, %s)",
                           (maquina, alvo_id, papel, evento, Jsonb(params), ator, e.get("_chave_real"), e.get("_versao_real"),
                            self.auto, self.nao_disparar))


def sem_privados(e):
    return {k: v for k, v in e.items() if not k.startswith("_")}


class Duelo:
    """Um card dirigido nos dois lados (provar.replay e banco), conferido a CADA evento."""

    def __init__(self, con, roteiro, auto=False, cartao=None, nome="caso"):
        self.con, self.roteiro, self.auto, self.nome = con, roteiro, auto, nome
        self.j = {"id": f"ataque-{nome}", "roteiro": roteiro, "eventos": [], "automatico": auto,
                  "card": cartao or {"pedido_grande": False, "plano_valido": True}}
        self.capt = {}
        with A.ReplayRapido():
            self.mundo = MundoAtaque(con, self.j, VOCAB, TAB, numero=f"ataque-{nome}-{time.time_ns()}")
            self.foto_py = A.foto_do_replay(P.replay(self.j, VOCAB, TAB, conferir_historico=False), COMPARTILHADOS)
        self.exigir(A.comparar(self.foto_py, self.mundo.foto()), "no começo")

    def exigir(self, difs, onde):
        assert not difs, f"[{self.nome}] {onde}: " + " | ".join(map(str, difs[:6]))

    def passo(self, e):
        """Manda um evento ao provar e ao banco e exige que digam o mesmo. Devolve a resposta do banco (None = nem foi mandado)."""
        if callable(e):
            e = e(self)
        if "_captura" in e:
            self.capt[e["_captura"]] = e["_valor"](self.mundo)
            return None
        self.j["eventos"].append(sem_privados(e))
        k = len(self.j["eventos"]) - 1
        with A.ReplayRapido():
            res_py = P.replay(self.j, VOCAB, TAB, conferir_historico=False)
            esperado = A.destino_do_replay(res_py, k)
            self.foto_py = A.foto_do_replay(res_py, COMPARTILHADOS)
            try:
                r = self.mundo.evento(e)
            except psycopg.Error as erro:
                pytest.fail(f"[{self.nome}] passo {k} {json.dumps(sem_privados(e), ensure_ascii=False)}: o BANCO LEVANTOU "
                            f"{type(erro).__name__}: {str(erro)[:300]} (o provar: {esperado})")
            difs = A.comparar(self.foto_py, self.mundo.foto())
        obtido = "RECUSADO" if r is None else r["resultado"]
        if obtido != esperado:
            difs.insert(0, f"destino do evento: provar={esperado} banco={obtido} ({r})")
        if res_py["violacoes"]:
            difs.append(f"o próprio provar acusou violação: {res_py['violacoes'][:2]}")
        difs += [f"conferir_historico: {x}" for x in self.mundo.linhas("select * from helena_v2.conferir_historico(%s)", (self.mundo.card,))]
        self.exigir(difs, f"passo {k} {json.dumps(sem_privados(e), ensure_ascii=False)}")
        return r

    def passos(self, eventos):
        return [self.passo(e) for e in eventos]

    def linhas_usadas(self):
        return {r["base_id"] for r in self.mundo.linhas(
            "select distinct p.base_id from helena_v2.historico h join helena_v2.card c on c.id = h.card_id "
            "join helena_v2.passagem p on p.maquina = h.maquina and p.linha_id = h.linha_id where c.id = %s or c.card_pai_id = %s",
            (self.mundo.card, self.mundo.card))}

    def exigir_linhas(self, queria):
        faltou = set(queria) - self.linhas_usadas()
        assert not faltou, f"[{self.nome}] o caso não chegou às linhas {sorted(faltou)}: o ataque não ataca nada"

    def estado(self, alvo="card"):
        return self.mundo.estado_da(alvo)

    def etapa(self, codigo):
        return self.mundo.linha_da_etapa(codigo)

    def card(self):
        return self.mundo.linhas("select * from helena_v2.card where id = %s", (self.mundo.card,))[0]

    def acao(self, codigo):
        return self.mundo.linhas("select * from helena_v2.acao_externa where card_id = %s and codigo = %s", (self.mundo.card, codigo))[0]


def duelar(con, eventos, roteiro, auto=False, cartao=None, nome="caso"):
    d = Duelo(con, roteiro, auto, cartao, nome)
    d.passos(eventos)
    return d


# ---------------------------------------------------------------------------- números velhos de verdade
def guarda(nome, funcao):
    """Evento especial: guarda um número do banco agora (a chave ou a versão que um toque velho vai levar depois)."""
    return {"_captura": nome, "_valor": funcao}


def chave_da(codigo):
    return lambda m: m.linha_da_etapa(codigo)["execucao_atual"]


def versao_da(codigo):
    return lambda m: m.linha_da_etapa(codigo)["versao"]


def versao_do_card(m):
    return m.chamar("select versao from helena_v2.card where id = %s", (m.card,))


def com_chave_morta(evento, nome):
    """O mesmo evento, mas levando ao banco o número que a execução tinha ANTES de morrer (o provar vê `chave: antiga`)."""
    return lambda d: dict(evento, chave="antiga", _chave_real=d.capt[nome])


def com_versao_velha(evento, nome):
    return lambda d: dict(evento, versao_vista="antiga", _versao_real=d.capt[nome])


def com_versao_atual(evento, funcao_versao):
    return lambda d: dict(evento, _versao_real=funcao_versao(d.mundo))


# ---------------------------------------------------------------------------- roteiros
UMA = S.ROTEIRO_UMA_ETAPA
DUAS = S.ROTEIRO_DUAS_COM_JURIDICO
PADRAO = P.ROTEIRO_DE_PROVA
TODAS_AS_ACOES = ["ENTREGAR", "PERGUNTAR", "DEVOLVER_A_QUEM_PEDIU", "REGISTRAR_FALHA"]


def etapa_de_roteiro(i, autor, revisores, depende=(), julga=(), internet=False, pulavel=False, terceiro=False, acoes=TODAS_AS_ACOES):
    return {"id": i, "nome": i, "autor": autor, "revisores": list(revisores), "depende_de": list(depende), "julga": list(julga),
            "internet": internet, "pulavel": pulavel, "usa_decisao": True, "prazo_de_terceiro": terceiro, "acoes_permitidas": list(acoes)}


# Roteiros que o provar NÃO percorre (ele só prova o PADRAO): losango de dependências, duas julgadoras da mesma peça,
# uma julgadora de duas etapas, só o fundador como revisor, várias etapas puláveis em paralelo.
LOSANGO = {"etapas": [
    etapa_de_roteiro("A", "CAIO", ["CLARA", "HELENA"], pulavel=True),
    etapa_de_roteiro("B", "ISABELA", ["CAIO", "FUNDADOR"], ["A"], pulavel=True, terceiro=True),
    etapa_de_roteiro("C", "RAVI", ["CLARA", "HELENA"], ["A"], internet=True),
    etapa_de_roteiro("D", "HELENA", ["CAIO", "CLARA", "RAVI"], ["B", "C"])]}
TODOS_OS_ROTEIROS = {
    "padrao": PADRAO, "uma": UMA, "duas_com_juridico": DUAS, "losango": LOSANGO,
    "duas_julgadoras": {"etapas": [
        etapa_de_roteiro("E1", "CAIO", ["CLARA", "HELENA"]),
        etapa_de_roteiro("J1", "CLARA", ["HELENA", "FUNDADOR"], ["E1"], ["E1"], internet=True),
        etapa_de_roteiro("J2", "RAVI", ["CAIO", "FUNDADOR"], ["E1"], ["E1"]),
        etapa_de_roteiro("ER", "HELENA", ["CAIO", "MARINA"], ["J1", "J2"])]},
    "julga_duas": {"etapas": [
        etapa_de_roteiro("E1", "CAIO", ["CLARA", "HELENA", "RAVI"], pulavel=True),
        etapa_de_roteiro("E2", "ISABELA", ["CLARA", "HELENA", "FUNDADOR"], internet=True, terceiro=True),
        etapa_de_roteiro("EJ", "CLARA", ["HELENA", "RAVI", "FUNDADOR"], ["E1", "E2"], ["E1", "E2"])]},
    "so_fundador": {"etapas": [
        etapa_de_roteiro("E1", "HELENA", ["FUNDADOR"]),
        etapa_de_roteiro("E2", "CAIO", [], ["E1"], pulavel=True),
        etapa_de_roteiro("E3", "CLARA", ["CLARA", "CLARA", "FUNDADOR", "HELENA"], ["E2"])]},
    "paralelas_pulaveis": {"etapas": [
        etapa_de_roteiro("P1", "CAIO", ["CLARA"], pulavel=True),
        etapa_de_roteiro("P2", "ISABELA", ["HELENA", "FUNDADOR"], pulavel=True, terceiro=True),
        etapa_de_roteiro("P3", "RAVI", ["CAIO"], pulavel=True, internet=True),
        etapa_de_roteiro("FIM", "HELENA", ["CLARA", "CAIO"], ["P1", "P2", "P3"])]},
}


def perfis_de(roteiro):
    return {p["id"]: p for p in P.perfis_do_roteiro(roteiro, TAB, VOCAB)}


# ---------------------------------------------------------------------------- peças de jornada
INICIO = [ev("HELENA", "LER_DE_VOLTA"), ev("MOTOR", "PLANO_VALIDO")]


def executando(e="E1"):
    return [ev("MOTOR", "DEPENDENCIAS_PRONTAS", e), ev("MOTOR", "INICIAR_EXECUCAO", e)]


def iniciar(e="E1"):
    return ev("MOTOR", "INICIAR_EXECUCAO", e)


def entregar(e="E1", parecer="OK", acao="NENHUMA"):
    return ev("AUTOR", "ENTREGAR", e, parecer=parecer, acao_externa=acao, usou_internet="NAO")


def revisao(e, revisor):
    return [ev("MOTOR", "PORTAO1_OK", e, escolhido=revisor), ev("MOTOR", "INICIAR_REVISAO", e)]


def aprovar(roteiro, codigo, acao="NENHUMA", parecer="OK"):
    """Leva a etapa até APROVADA pelo caminho que a ficha dela permite (revisor de IA; se for o jurídico, mais o seu Aprovar;
    se só você pode revisar, o portão 1 já manda a revisão para você)."""
    pf = perfis_de(roteiro)[codigo]
    reais = [r for r in pf["revisores_validos"] if r != "FUNDADOR"]
    if reais:
        eventos = executando(codigo) + [entregar(codigo, parecer, acao)] + revisao(codigo, reais[0]) + [ev("REVISOR", "APROVAR", codigo)]
        if pf["cfg"]["julgadora"]:
            eventos.append(ev("FUNDADOR", "APROVAR", codigo))
        return eventos
    return executando(codigo) + [entregar(codigo, parecer, acao), ev("MOTOR", "PORTAO1_OK", codigo, escolhido="FUNDADOR"), ev("FUNDADOR", "APROVAR", codigo)]


def ajuste(e="E1"):
    return ev("FUNDADOR", "PEDIR_AJUSTE", e, motivo_ajuste="TOM")


def falha_infra(e="E1", classe="PROVEDOR"):
    return ev("MOTOR", "FALHA_INFRA", e, classe=classe)


def registrar_falha(e="E1"):
    return ev("AUTOR", "REGISTRAR_FALHA", e, motivo_falha="NAO_CONSIGO", usou_internet="NAO")


def perguntar(e="E1"):
    return ev("AUTOR", "PERGUNTAR", e, usou_internet="NAO")


def responder(opcao, alvo="card"):
    return ev("FUNDADOR", "RESPONDER", alvo, opcao=opcao)


# ============================================================================== a SONDA: eventos de um estado, desfeitos depois
def todas_as_sondas(codigos_etapas, codigos_acoes):
    """Todo (papel, evento, parâmetros) do vocabulário contra o card, cada etapa e cada ação; com chave/versão/ator atuais e velhos."""
    sondas = []
    for alvo in ["card"] + list(codigos_etapas) + ["acao:" + a for a in codigos_acoes]:
        eh_etapa = alvo in codigos_etapas
        for papel, evs in VOCAB["acoes"].items():
            for evento, d in evs.items():
                dominios = {k: P.expandir_dominio(v, VOCAB, "sonda") for k, v in ((d or {}).get("parametros") or {}).items()}
                nomes = sorted(dominios)
                for valores in itertools.product(*[dominios[n] for n in nomes]):
                    base = {"papel": papel, "evento": evento, "alvo": alvo}
                    if nomes:
                        base["params"] = {n: str(v) for n, v in zip(nomes, valores)}
                    if papel in ("AUTOR", "REVISOR", "HELENA"):
                        atores = ({"AUTOR": [None, "OUTRO"], "REVISOR": [None, "AUTOR_DA_ETAPA", "JULGADOR", "FUNDADOR", "OUTRO"]}.get(papel, [None])
                                  if eh_etapa else [None])
                        for chave, ator in itertools.product(("atual", "antiga"), atores):
                            sondas.append(dict(base, chave=chave, **({"ator": ator} if ator else {})))
                    elif papel == "FUNDADOR":
                        sondas += [dict(base, versao_vista=v) for v in ("atual", "antiga")]
                    else:
                        sondas.append(base)
    return sondas


def agente_de_verdade(e, perfis):
    """Troca os apelidos de ator (AUTOR_DA_ETAPA, JULGADOR, OUTRO...) por agentes reais do roteiro."""
    ator = e.get("ator")
    if ator is None or e["alvo"] not in perfis:
        return e
    pf = perfis[e["alvo"]]
    outros = [a for a in VOCAB["identidades"]["agentes"] if a != pf["autor"] and a not in pf["julgadores"]]
    real = {"AUTOR_DA_ETAPA": pf["autor"], "JULGADOR": (pf["julgadores"] or [outros[0]])[0], "FUNDADOR": "FUNDADOR", "OUTRO": outros[0]}[ator]
    return dict(e, ator=real)


def interessa(e, d):
    """A sonda interessa se o estado do alvo TEM passagem para esse evento, se é um botão seu, se é entrada por sinal ou se é uma
    reação. O resto (milhares de recusas parecidas) entra só numa amostra fixa; ESCALA=3 manda tudo."""
    alvo, estado = e["alvo"], None
    if alvo == "card":
        maquina, estado = MAQUINAS["card"], d.foto_py["card"]["estado"]
    elif alvo.startswith("acao:"):
        maquina, estado = MAQUINAS["acao_externa"], d.foto_py["acoes"][alvo[5:]]["estado"]
    else:
        maquina, estado = MAQUINAS["etapa"], d.foto_py["etapas"][alvo]["estado"]
    return (e["papel"] == "FUNDADOR" or (estado, e["evento"]) in maquina.por_chave or e["evento"] in maquina.entradas
            or any(r["evento"] == e["evento"] for r in TAB["reacoes"]))


def sondar(d, completo=False, semente=1):
    """A partir do estado atual do duelo `d`, manda as sondas ao provar (replay) e ao banco (numa transação desfeita) e compara.
    Devolve quantas sondas foram. Falha com as primeiras diferenças."""
    rng = random.Random(semente)
    acoes = [a["codigo"] for a in d.mundo.linhas("select codigo from helena_v2.acao_externa where card_id = %s", (d.mundo.card,))]
    todas = todas_as_sondas(list(d.mundo.perfis), acoes)
    tudo = completo or ESCALA >= 3
    sondas = [s for s in todas if tudo or interessa(s, d) or rng.random() < 0.08]
    n0 = len(d.j["eventos"])
    achados = []
    with A.ReplayRapido():
        for s in sondas:
            e = agente_de_verdade(s, d.mundo.perfis)
            res_py = P.replay(dict(d.j, eventos=d.j["eventos"] + [e]), VOCAB, TAB, conferir_historico=False)
            esperado = A.destino_do_replay(res_py, n0)
            foto_py = A.foto_do_replay(res_py, COMPARTILHADOS)
            erro, r, foto_db = None, None, None
            with d.con.transaction():
                try:
                    r = d.mundo.evento(e)
                    foto_db = d.mundo.foto()
                except psycopg.Error as ex:
                    erro = f"{type(ex).__name__}: {str(ex)[:200]}"
                raise psycopg.Rollback()
            if erro:
                achados.append((e, [f"o BANCO LEVANTOU {erro} (provar: {esperado})"]))
                continue
            difs = A.comparar(foto_py, foto_db)
            obtido = "RECUSADO" if r is None else r["resultado"]
            if obtido != esperado:
                difs.insert(0, f"destino: provar={esperado} banco={obtido}")
            if res_py["violacoes"]:
                difs.append(f"o provar acusou violação: {res_py['violacoes'][:2]}")
            if difs:
                achados.append((e, difs))
    assert not achados, f"[{d.nome}] {len(achados)} de {len(sondas)} sondas divergem; as primeiras: " + \
        " || ".join(f"{json.dumps(e, ensure_ascii=False)} => {difs[:3]}" for e, difs in achados[:3])
    return len(sondas)


# ============================================================================== (1) ESTADOS DE BORDA: duelo até lá + sonda
def ordens_por_ajuste_na_aprovada(rodadas):
    eventos = INICIO + aprovar(UMA, "E1")
    for _ in range(rodadas):
        eventos += [ajuste("E1"), iniciar("E1"), entregar("E1")] + revisao("E1", "CLARA") + [ev("REVISOR", "APROVAR", "E1")]
    return eventos


def ordens_por_ajuste_na_revisao_sua(rodadas):
    eventos = INICIO + executando("E1") + [entregar("E1"), ev("MOTOR", "PORTAO1_OK", "E1", escolhido="FUNDADOR")]
    for _ in range(rodadas):
        eventos += [ajuste("E1"), iniciar("E1"), entregar("E1"), ev("MOTOR", "PORTAO1_OK", "E1", escolhido="FUNDADOR")]
    return eventos


def tres_quedas(e="E1"):
    """Três falhas de infraestrutura seguidas na mesma rodada: a cada queda a etapa volta à fila e recomeça; a 3ª chama você."""
    return [falha_infra(e), iniciar(e), falha_infra(e), iniciar(e), falha_infra(e)]


def ordens_por_espera_de_infra(rodadas):
    eventos = INICIO + executando("E1") + tres_quedas()
    for _ in range(rodadas):
        eventos += [responder("ESPERAR", "E1"), iniciar("E1")] + tres_quedas()
    return eventos


def duas_perguntas_gastas():
    return (INICIO + executando("E1") + [perguntar(), responder("RESPOSTA_A", "E1"), iniciar("E1"), perguntar(), responder("RESPOSTA_B", "E1"), iniciar("E1")])


def revisao_depois_de_execucoes(n_antes):
    """Gasta `n_antes` execuções (cada entrega e cada resposta de revisor gasta uma) e chega na revisão."""
    eventos = INICIO + executando("E1")
    for _ in range(n_antes // 2):
        eventos += [entregar("E1")] + revisao("E1", "CLARA") + [ev("REVISOR", "REPROVAR", "E1"), iniciar("E1")]
    return eventos + [entregar("E1")] + revisao("E1", "CLARA")


def losango_tudo_aprovado():
    eventos = list(INICIO)
    for codigo in "ABCD":
        eventos += aprovar(LOSANGO, codigo)
    return eventos


def juridico_pedindo_ajuste():
    # DUAS: E1 (ISABELA) aprovada; E2 (CLARA, julga E1) entrega parecer AJUSTE, o revisor de IA aprova e o parecer espera o seu Aprovar
    return INICIO + aprovar(DUAS, "E1") + executando("E2") + [entregar("E2", parecer="AJUSTE")] + revisao("E2", "HELENA") + [ev("REVISOR", "APROVAR", "E2")]


def com_duas_acoes():
    return INICIO + aprovar(DUAS, "E1", acao="PELO_MOTOR") + aprovar(DUAS, "E2", acao="SO_FUNDADOR") + [ev("MOTOR", "TODAS_PRONTAS")]


def cancelado_com_a_revisao_viva():
    return (INICIO + executando("E1") + [entregar("E1")] + revisao("E1", "CLARA") + [ev("MOTOR", "DEPENDENCIAS_PRONTAS", "E2"), ev("FUNDADOR", "CANCELAR")])


def falhou_e_o_card_pergunta():
    padrao = [ev("RELOGIO", "LEMBRETE_24H", "E1"), ev("RELOGIO", "LEMBRETE_48H", "E1"), ev("RELOGIO", "PRAZO_ESPERA_VENCIDO", "E1")]
    return (INICIO + executando("E1") + [perguntar()] + padrao + [responder("RESPOSTA_A", "E1"), responder("RESPOSTA_B", "E1"), ev("MOTOR", "PERGUNTAR_AO_FUNDADOR")])


def borda(nome, roteiro, eventos, queria, auto=False, grande=False, completo=False):
    return pytest.param(roteiro, auto, grande, eventos, queria, completo, id=nome)


ESTADOS_DE_BORDA = [
    borda("duas_ordens_gastas_com_a_etapa_aprovada", UMA, ordens_por_ajuste_na_aprovada(2), {"E111", "E54"}),
    borda("ordens_no_teto_com_a_etapa_aprovada", UMA, ordens_por_ajuste_na_aprovada(3), {"E111", "E54"}, completo=True),
    borda("quarta_ordem_na_aprovada_substitui_o_card", UMA, ordens_por_ajuste_na_aprovada(3) + [ajuste("E1")], {"E117", "C28"}),
    borda("ordens_no_teto_esperando_voce_na_revisao", UMA, ordens_por_ajuste_na_revisao_sua(3), {"E84", "E41"}, completo=True),
    borda("quarta_ordem_na_revisao_sua_substitui_o_card", UMA, ordens_por_ajuste_na_revisao_sua(3) + [ajuste("E1")], {"E96", "C28"}),
    borda("ordens_no_teto_esperando_voce_por_infra", UMA, ordens_por_espera_de_infra(3), {"E88", "E33"}, completo=True),
    borda("quarta_ordem_por_infra_substitui_o_card", UMA, ordens_por_espera_de_infra(3) + [responder("MODELO_MENOR", "E1")], {"E98", "C28"}),
    borda("duas_perguntas_gastas_a_terceira_vira_formato_errado", UMA, duas_perguntas_gastas(), {"E21", "E80"}, completo=True),
    borda("terceira_pergunta_convertida_em_falha_de_formato", UMA, duas_perguntas_gastas() + [perguntar()], {"E121"}),
    borda("cinco_execucoes_gastas_na_revisao", UMA, revisao_depois_de_execucoes(4), {"E57", "E50"}),
    borda("terceira_reprovacao_vai_para_resolucao", UMA, revisao_depois_de_execucoes(4) + [ev("REVISOR", "REPROVAR", "E1")], {"E58", "E57"}),
    borda("seis_execucoes_gastas_a_revisao_nao_comeca", UMA, INICIO + executando("E1") + [ev("MOTOR", "FALHA", "E1", classe="FORMATO_ERRADO"), iniciar("E1"),
          ev("RELOGIO", "TEMPO_ESGOTADO", "E1"), iniciar("E1"), ev("MOTOR", "FALHA", "E1", classe="LIMITE_CHAMADAS"), iniciar("E1"), entregar("E1")]
          + revisao("E1", "CLARA") + [ev("REVISOR", "REPROVAR", "E1"), iniciar("E1"), entregar("E1"), ev("MOTOR", "PORTAO1_OK", "E1", escolhido="CLARA"),
                                      ev("MOTOR", "INICIAR_REVISAO", "E1"), ev("MOTOR", "TETO_EXECUCOES", "E1")], {"E51", "E57"}),
    borda("infra_no_teto_esperando_voce", UMA, INICIO + executando("E1") + tres_quedas(), {"E31", "E33"}, completo=True),
    borda("infra_a_um_passo_do_teto_executando", UMA, INICIO + executando("E1") + [falha_infra(classe="COTA"), ev("MOTOR", "CAPACIDADE_VOLTOU", "E1"), iniciar("E1"),
                                                                                    falha_infra(classe="LOGIN"), ev("MOTOR", "CAPACIDADE_VOLTOU", "E1"), iniciar("E1")], {"E32", "E14"}),
    borda("capacidade_volta_com_a_infra_no_teto_nao_desfaz_a_espera", UMA, INICIO + executando("E1") + tres_quedas() + [ev("MOTOR", "CAPACIDADE_VOLTOU", "E1")], {"E33"}),
    borda("capacidade_volta_antes_da_sua_resposta", UMA, INICIO + [ev("MOTOR", "DEPENDENCIAS_PRONTAS", "E1"), ev("MOTOR", "SEM_CAPACIDADE", "E1", classe="COTA"),
          ev("RELOGIO", "AVISO_1H", "E1"), ev("RELOGIO", "ESPERA_6H", "E1"), ev("MOTOR", "CAPACIDADE_VOLTOU", "E1")], {"E12", "E15", "E16", "E99"}),
    borda("aviso_de_capacidade_no_teto", UMA, INICIO + [ev("MOTOR", "DEPENDENCIAS_PRONTAS", "E1"), ev("MOTOR", "SEM_CAPACIDADE", "E1", classe="COTA"), ev("RELOGIO", "AVISO_1H", "E1")],
          {"E12", "E15"}),
    borda("formato_tempo_e_chamadas_nos_tetos", UMA, INICIO + executando("E1") + [ev("MOTOR", "FALHA", "E1", classe="FORMATO_ERRADO"), iniciar("E1"), ev("RELOGIO", "TEMPO_ESGOTADO", "E1"),
                                                                               iniciar("E1"), ev("MOTOR", "FALHA", "E1", classe="LIMITE_CHAMADAS"), iniciar("E1")], {"E121", "E29", "E26"}),
    borda("reprovacoes_no_teto_na_revisao", UMA, INICIO + executando("E1") + [entregar("E1")] + revisao("E1", "CLARA") + [ev("REVISOR", "REPROVAR", "E1"), iniciar("E1"), entregar("E1")]
          + revisao("E1", "CLARA") + [ev("REVISOR", "REPROVAR", "E1"), iniciar("E1"), entregar("E1")] + revisao("E1", "CLARA"), {"E57"}),
    borda("replan_no_teto_em_resolucao", UMA, INICIO + executando("E1") + [registrar_falha(), ev("HELENA", "RECOMENDAR", "E1", opcao="REFAZER"), responder("REFAZER", "E1"), iniciar("E1"),
                                                                            registrar_falha()], {"E100", "E85", "E23"}),
    borda("voltas_do_juridico_com_parecer_de_ajuste", DUAS, juridico_pedindo_ajuste(), {"E74"}),
    borda("lembretes_no_teto_esperando_voce", UMA, INICIO + executando("E1") + [perguntar(), ev("RELOGIO", "LEMBRETE_24H", "E1"), ev("RELOGIO", "LEMBRETE_48H", "E1")], {"E21", "E89", "E90"}),
    borda("espera_externa_com_um_lembrete", PADRAO, INICIO + executando("E2") + [perguntar("E2"), ev("RELOGIO", "LEMBRETE_24H", "E2")], {"E120", "E89"}),
    borda("prazo_do_card_no_teto", UMA, INICIO + [ev("FUNDADOR", "MUDAR_PRAZO")] * 3 + [ev("RELOGIO", "PRAZO_80"), ev("RELOGIO", "PRAZO_VENCIDO"), ev("RELOGIO", "PRAZO_MAIS_1H")],
          {"C23", "C24", "C25", "C26"}),
    borda("validador_do_plano_cai_uma_vez", UMA, [ev("HELENA", "LER_DE_VOLTA"), ev("RELOGIO", "TEMPO_ESGOTADO")], {"C02", "C30"}),
    borda("helena_falhou_uma_vez_no_rascunho", UMA, [ev("MOTOR", "FALHA", "card", classe="FORMATO_ERRADO")], {"C03"}),
    borda("pedido_grande_esperando_confirmacao_com_lembrete", UMA, [ev("HELENA", "LER_DE_VOLTA"), ev("RELOGIO", "LEMBRETE_24H")], {"C01", "C07"}, grande=True),
    borda("pedido_grande_validador_cai_duas_vezes", UMA, [ev("HELENA", "LER_DE_VOLTA"), responder("CONFIRMO")] + [ev("RELOGIO", "TEMPO_ESGOTADO")] * 2, {"C06", "C31"}, grande=True),
    borda("padrao_um_aprovado_e_um_em_revisao", PADRAO, INICIO + aprovar(PADRAO, "E1") + executando("E2") + [entregar("E2")] + revisao("E2", "RAVI"), {"E54", "E50"}),
    borda("losango_tudo_aprovado_pronto_para_cascata", LOSANGO, losango_tudo_aprovado(), {"E54", "E01"}),
    borda("card_pronto_com_duas_acoes", DUAS, com_duas_acoes(), {"E110", "C12"}),
    borda("card_cancelado_com_a_revisao_viva", PADRAO, cancelado_com_a_revisao_viva(), {"C22", "E73"}),
    borda("etapa_falhou_e_o_card_pergunta_com_resposta_guardada", UMA, falhou_e_o_card_pergunta(), {"E91", "C13"}),
    borda("tudo_automatico_ate_o_pronto", UMA, INICIO + [entregar("E1"), ev("MOTOR", "PORTAO1_OK", "E1", escolhido="CLARA"), ev("REVISOR", "APROVAR", "E1")], {"E10", "C12"}, auto=True),
]


@pytest.mark.parametrize("roteiro,auto,grande,eventos,queria,completo", ESTADOS_DE_BORDA)
def test_estado_de_borda_duelo_ate_la_e_sonda(con, request, roteiro, auto, grande, eventos, queria, completo):
    """Chega ao estado de borda passo a passo (banco = provar a cada evento) e de lá manda os eventos que importam, desfeitos depois."""
    nome = request.node.callspec.id
    d = duelar(con, eventos, roteiro, auto, {"pedido_grande": grande, "plano_valido": True}, nome=nome)
    d.exigir_linhas(queria)
    assert sondar(d, completo, semente=len(nome)) > 100


# ============================================================================== (2) NÚMEROS VELHOS DE VERDADE
def test_versao_velha_de_verdade_numa_segunda_pergunta_da_etapa(con):
    """Você viu a 1ª pergunta (versão v1). A etapa respondeu, voltou ao trabalho e perguntou de novo (versão nova). Responder com a v1 não vale."""
    eventos = INICIO + executando("E1") + [perguntar(), guarda("v1", versao_da("E1")), responder("RESPOSTA_A", "E1"), iniciar("E1"), perguntar()]
    d = duelar(con, eventos, UMA, nome="versao-pergunta")
    assert d.etapa("E1")["versao"] > d.capt["v1"] and d.estado("E1") == "ESPERANDO_FUNDADOR"
    r = d.passo(com_versao_velha(responder("RESPOSTA_A", "E1"), "v1"))
    assert r["resultado"] == "COMENTARIO_NO_CARD" and d.estado("E1") == "ESPERANDO_FUNDADOR"
    r = d.passo(com_versao_atual(responder("RESPOSTA_A", "E1"), versao_da("E1")))
    assert r["resultado"] == "APLICADO" and d.estado("E1") == "NA_FILA"


def test_versao_velha_de_verdade_na_revisao_que_espera_voce(con):
    """A 1ª entrega esperou o seu Aprovar (versão va). Você pediu ajuste, veio outra entrega. O Aprovar com a va não aprova a peça nova."""
    eventos = (INICIO + executando("E1") + [entregar("E1"), ev("MOTOR", "PORTAO1_OK", "E1", escolhido="FUNDADOR"), guarda("va", versao_da("E1")),
                                            ajuste("E1"), iniciar("E1"), entregar("E1"), ev("MOTOR", "PORTAO1_OK", "E1", escolhido="FUNDADOR")])
    d = duelar(con, eventos, UMA, nome="versao-revisao")
    r = d.passo(com_versao_velha(ev("FUNDADOR", "APROVAR", "E1"), "va"))
    assert r["resultado"] == "COMENTARIO_NO_CARD" and d.estado("E1") == "ESPERANDO_FUNDADOR"
    r = d.passo(com_versao_atual(ev("FUNDADOR", "APROVAR", "E1"), versao_da("E1")))
    assert r["resultado"] == "APLICADO" and d.estado("E1") == "APROVADA"


def test_versao_velha_de_verdade_na_etapa_aprovada_de_novo(con):
    """Você viu a etapa aprovada (versão va). Ela foi reaberta e aprovada outra vez. O Pedir ajuste com a va não vale: a peça é outra."""
    eventos = (INICIO + aprovar(UMA, "E1") + [guarda("va", versao_da("E1")), ajuste("E1"), iniciar("E1"), entregar("E1")] + revisao("E1", "CLARA") + [ev("REVISOR", "APROVAR", "E1")])
    d = duelar(con, eventos, UMA, nome="versao-aprovada")
    r = d.passo(com_versao_velha(ajuste("E1"), "va"))
    assert r["resultado"] == "COMENTARIO_NO_CARD" and d.estado("E1") == "APROVADA" and d.card()["ordens"] == 1
    r = d.passo(com_versao_atual(ajuste("E1"), versao_da("E1")))
    assert r["resultado"] == "APLICADO" and d.card()["ordens"] == 2


def test_versao_velha_de_verdade_na_segunda_pergunta_do_card(con):
    """O card perguntou (vc), você mandou refazer, a etapa falhou de novo e o card perguntou outra vez (versão nova). Pular com a vc não vale."""
    segunda = [responder("REFAZER"), ev("MOTOR", "DEPENDENCIAS_PRONTAS", "E1"), iniciar("E1"), perguntar(), ev("RELOGIO", "LEMBRETE_24H", "E1"), ev("RELOGIO", "LEMBRETE_48H", "E1"),
               ev("RELOGIO", "PRAZO_ESPERA_VENCIDO", "E1"), ev("MOTOR", "PERGUNTAR_AO_FUNDADOR")]
    d = duelar(con, falhou_e_o_card_pergunta() + [guarda("vc", versao_do_card)] + segunda, UMA, nome="versao-card")
    assert d.card()["versao"] > d.capt["vc"] and d.estado("card") == "ESPERANDO_FUNDADOR"
    r = d.passo(com_versao_velha(responder("PULAR"), "vc"))
    assert r["resultado"] == "COMENTARIO_NO_CARD" and d.estado("card") == "ESPERANDO_FUNDADOR"
    r = d.passo(com_versao_atual(responder("PULAR"), versao_do_card))
    assert r["resultado"] == "APLICADO" and d.estado("card") != "ESPERANDO_FUNDADOR"


def test_versao_velha_de_verdade_na_confirmacao_do_card(con):
    """Pedido grande: o validador do plano cai, você confirma de novo (ordem sua), cai de novo e o card volta a pedir. O Confirmo da vez anterior não vale."""
    caiu = [ev("RELOGIO", "TEMPO_ESGOTADO")] * 2
    eventos = [ev("HELENA", "LER_DE_VOLTA"), responder("CONFIRMO")] + caiu + [guarda("vc", versao_do_card), responder("CONFIRMO")] + caiu
    d = duelar(con, eventos, UMA, cartao={"pedido_grande": True, "plano_valido": True}, nome="versao-confirmacao")
    assert d.estado("card") == "ESPERANDO_CONFIRMACAO" and d.card()["motivo"] == "VALIDADOR_FALHOU" and d.card()["ordens"] == 1
    r = d.passo(com_versao_velha(responder("CONFIRMO"), "vc"))
    assert r["resultado"] == "COMENTARIO_NO_CARD" and d.card()["ordens"] == 1
    r = d.passo(com_versao_atual(responder("CONFIRMO"), versao_do_card))
    assert r["resultado"] == "APLICADO" and d.card()["ordens"] == 2


def test_cancelar_vale_com_qualquer_versao_e_nunca_vira_comentario(con):
    """Cancelar não depende da versão vista (regras_gerais): com uma versão velha de verdade ainda cancela."""
    eventos = INICIO + executando("E1") + [perguntar(), guarda("v1", versao_da("E1")), responder("RESPOSTA_A", "E1"), iniciar("E1"), perguntar()]
    d = duelar(con, eventos, UMA, nome="cancelar-velho")
    r = d.passo(com_versao_velha(ev("FUNDADOR", "CANCELAR"), "v1"))
    assert r["resultado"] == "APLICADO" and d.estado("card") == "CANCELADO" and d.estado("E1") == "CANCELADA"


def ate_executando_com_a_chave_guardada(nome="k"):
    return INICIO + executando("E1") + [guarda(nome, chave_da("E1"))]


MORTES_DA_EXECUCAO = [
    pytest.param([ev("VIGIA", "SEM_EXECUCAO_VIVA", "E1")], {"E34"}, id="o_vigia_acha_que_ela_morreu"),
    pytest.param([ev("RELOGIO", "TEMPO_ESGOTADO", "E1")], {"E29"}, id="o_relogio_estoura_o_tempo"),
    pytest.param([ev("FUNDADOR", "PEDIR_AJUSTE", motivo_ajuste="TOM")], {"E38"}, id="uma_decisao_nova_chega"),
    pytest.param([falha_infra()], {"E31"}, id="a_infraestrutura_cai"),
    pytest.param([ev("MOTOR", "FALHA", "E1", classe="FORMATO_ERRADO")], {"E121"}, id="o_motor_registra_falha_de_formato"),
    pytest.param([ev("FUNDADOR", "CANCELAR")], {"C22", "E39"}, id="voce_cancela_o_card"),
]


@pytest.mark.parametrize("mortes,queria", MORTES_DA_EXECUCAO)
def test_resposta_atrasada_de_execucao_morta_nao_grava_e_a_nova_grava(con, request, mortes, queria):
    """O autor demorou: a execução morreu (de seis jeitos) e a resposta dele chega com a chave de verdade da morta. Tem de ser recusada;
    e, quando a etapa recomeça, a chave nova grava normalmente (a morta continua sem valer)."""
    d = duelar(con, ate_executando_com_a_chave_guardada() + mortes, UMA, nome="morta-" + request.node.callspec.id[:24])
    d.exigir_linhas(queria)
    for resposta in (entregar("E1"), perguntar(), registrar_falha()):
        assert d.passo(com_chave_morta(resposta, "k"))["resultado"] == "RECUSADO"
    if d.estado("card") == "CANCELADO":
        return
    if d.estado("E1") == "NA_FILA":
        d.passo(iniciar("E1"))
    assert d.estado("E1") == "EXECUTANDO" and d.etapa("E1")["execucao_atual"] != d.capt["k"]
    assert d.passo(com_chave_morta(entregar("E1"), "k"))["resultado"] == "RECUSADO" and d.estado("E1") == "EXECUTANDO"
    d.passo(entregar("E1"))
    assert d.estado("E1") == "VALIDACAO"


def test_a_mesma_resposta_do_autor_duas_vezes_so_grava_uma(con):
    """ENTREGAR com a chave atual grava; mandar a MESMA resposta outra vez (a chave morreu ao gravar) é recusado e não cria segunda entrega."""
    d = duelar(con, ate_executando_com_a_chave_guardada(), UMA, nome="entrega-repetida")
    d.passo(entregar("E1"))
    assert d.passo(com_chave_morta(entregar("E1"), "k"))["resultado"] == "RECUSADO"
    assert d.mundo.chamar("select count(*) from helena_v2.entrega where card_id = %s", (d.mundo.card,)) == 1


def test_resposta_atrasada_do_revisor_com_a_chave_de_verdade(con):
    """O revisor morreu (o vigia achou), a revisão foi refeita com chave nova; a resposta atrasada do primeiro (chave velha) não decide nada."""
    eventos = (INICIO + executando("E1") + [entregar("E1")] + revisao("E1", "CLARA") + [guarda("kr", chave_da("E1")), ev("VIGIA", "SEM_EXECUCAO_VIVA", "E1"), ev("MOTOR", "INICIAR_REVISAO", "E1")])
    d = duelar(con, eventos, UMA, nome="revisor-atrasado")
    d.exigir_linhas({"E69", "E50"})
    for resposta in (ev("REVISOR", "APROVAR", "E1"), ev("REVISOR", "REPROVAR", "E1"), ev("REVISOR", "NAO_CONSIGO_CONFERIR", "E1")):
        r = d.passo(com_chave_morta(resposta, "kr"))
        assert r["resultado"] == "RECUSADO" and d.estado("E1") == "REVISAO"
    d.passo(ev("REVISOR", "APROVAR", "E1"))
    assert d.estado("E1") == "APROVADA"


def test_a_chave_de_uma_execucao_nao_serve_a_outra_da_mesma_etapa(con):
    """A chave que era do autor não aprova na revisão; a do revisor, usada pelo autor, vira falha de formato do revisor (como no provar)."""
    eventos = INICIO + executando("E1") + [guarda("ka", chave_da("E1")), entregar("E1")] + revisao("E1", "CLARA")
    d = duelar(con, eventos, UMA, nome="chave-cruzada")
    r = d.passo(com_chave_morta(ev("REVISOR", "APROVAR", "E1"), "ka"))
    assert r["resultado"] == "RECUSADO" and d.estado("E1") == "REVISAO"
    r = d.passo(entregar("E1"))
    assert r["resultado"] == "CONVERTIDO" and d.estado("E1") == "REVISAO" and d.etapa("E1")["formato"] == 1


def test_chamada_antiga_da_helena_nao_grava_e_a_atual_grava(con):
    """Duas chamadas da Helena para o mesmo rascunho: a resposta da primeira (número de verdade) não grava; a da segunda grava."""
    d = Duelo(con, UMA, False, None, "helena-velha")
    r = d.passo(ev("HELENA", "LER_DE_VOLTA", chave="antiga"))
    assert r["resultado"] == "RECUSADO" and d.estado("card") == "RASCUNHO"
    assert d.card()["chamada_helena"] is not None            # a chamada atual continua aberta, esperando a resposta certa
    r = d.passo(ev("HELENA", "LER_DE_VOLTA"))
    assert r["resultado"] == "APLICADO" and d.estado("card") == "VALIDANDO_PLANO" and d.card()["chamada_helena"] is None


# ============================================================================== (3) REVISOR IGUAL AO AUTOR (e quem julga depois)
@pytest.mark.parametrize("roteiro_nome", ["padrao", "duas_com_juridico", "julga_duas", "so_fundador", "losango", "duas_julgadoras"])
def test_ninguem_fora_da_ficha_vira_revisor_e_so_o_designado_responde(con, roteiro_nome):
    """No portão 1 de cada etapa, o motor escolhe cada um dos 22 nomes possíveis; só os válidos (não o autor, não quem julga depois) passam.
    Depois, cada um dos 22 tenta responder como revisor: só o designado grava. Tudo desfeito em seguida; a etapa é então aprovada de verdade."""
    roteiro = TODOS_OS_ROTEIROS[roteiro_nome]
    d = Duelo(con, roteiro, False, None, "revisor-" + roteiro_nome)
    d.passos(INICIO)
    perfis = d.mundo.perfis
    escolhas_validas = escolhas_recusadas = respostas_recusadas = 0
    for codigo, pf in perfis.items():
        assert all(d.estado(ant) in ("APROVADA", "PRONTA") for ant in pf["depende_de"])
        d.passos(executando(codigo) + [entregar(codigo)])
        assert d.estado(codigo) == "VALIDACAO"
        for escolhido in NOMES_POSSIVEIS:
            with d.con.transaction():
                r = d.mundo.evento(ev("MOTOR", "PORTAO1_OK", codigo, escolhido=escolhido))
                valido = escolhido in pf["revisores_validos"]
                assert (r["resultado"] == "APLICADO") == valido, (codigo, escolhido, r, pf["revisores_validos"])
                escolhas_validas += valido
                escolhas_recusadas += not valido
                if valido and escolhido != "FUNDADOR":
                    d.mundo.evento(ev("MOTOR", "INICIAR_REVISAO", codigo))
                    for ator in [n for n in NOMES_POSSIVEIS if n != escolhido] + [escolhido]:
                        r2 = d.mundo.evento(ev("REVISOR", "REPROVAR", codigo, ator=ator))
                        assert (r2["resultado"] == "APLICADO") == (ator == escolhido), (codigo, escolhido, ator, r2)
                        respostas_recusadas += ator != escolhido
                raise psycopg.Rollback()
        if pf["cfg"]["julgadora"]:
            assert pf["autor"] not in pf["revisores_validos"]
        reais = [r for r in pf["revisores_validos"] if r != "FUNDADOR"]
        if reais:
            d.passos(revisao(codigo, reais[0]) + [ev("REVISOR", "APROVAR", codigo)] + ([ev("FUNDADOR", "APROVAR", codigo)] if pf["cfg"]["julgadora"] else []))
        else:
            d.passos([ev("MOTOR", "PORTAO1_OK", codigo, escolhido="FUNDADOR"), ev("FUNDADOR", "APROVAR", codigo)])
        assert d.estado(codigo) == "APROVADA"
    assert escolhas_validas >= len(perfis) and escolhas_recusadas >= 18 * len(perfis) and respostas_recusadas >= len(perfis)


# ============================================================================== (4) AÇÃO EXTERNA REPETIDA
def duas_acoes_prontas(con, nome):
    d = duelar(con, com_duas_acoes(), DUAS, nome=nome)
    d.exigir_linhas({"E110"})
    assert d.estado("card") == "PRONTO" and {a["tem_ferramenta"] for a in d.mundo.linhas("select * from helena_v2.acao_externa where card_id = %s", (d.mundo.card,))} == {True, False}
    return d


def test_acao_externa_aprovada_duas_vezes_e_executada_uma_vez_so(con):
    d = duas_acoes_prontas(con, "acao-repetida")
    alvo = "acao:A1"
    assert d.acao("A1")["tem_ferramenta"]
    d.passo(ev("FUNDADOR", "APROVAR", alvo))
    assert d.acao("A1")["estado"] == "AUTORIZADA"
    for repetido in (ev("FUNDADOR", "APROVAR", alvo), ev("FUNDADOR", "APROVAR", alvo), ev("MOTOR", "EXECUTAR_ACAO", alvo), ev("MOTOR", "EXECUTAR_ACAO", alvo)):
        d.passo(repetido)
    a = d.acao("A1")
    assert a["estado"] == "EXECUTANDO_ACAO" and a["tentativas"] == 1 and a["ok_registrado"] == 1
    d.passo(ev("MOTOR", "ACAO_CONCLUIDA", alvo))
    for depois in (ev("MOTOR", "EXECUTAR_ACAO", alvo), ev("MOTOR", "ACAO_CONCLUIDA", alvo), ev("MOTOR", "ACAO_FALHOU", alvo), ev("FUNDADOR", "APROVAR", alvo),
                   ev("RELOGIO", "TEMPO_ESGOTADO", alvo), ev("FUNDADOR", "CANCELAR", alvo), responder("NAO_ACONTECEU", alvo)):
        d.passo(depois)
    a = d.acao("A1")
    assert a["estado"] == "EXECUTADA" and a["tentativas"] == 1
    d.exigir_linhas({"X01", "X10", "X20"})


def test_acao_sem_ferramenta_nao_e_autorizada_nem_executada(con):
    d = duas_acoes_prontas(con, "acao-sem-ferramenta")
    alvo = "acao:A2"
    assert not d.acao("A2")["tem_ferramenta"]
    d.passos([ev("FUNDADOR", "APROVAR", alvo), ev("MOTOR", "EXECUTAR_ACAO", alvo), ev("FUNDADOR", "APROVAR", alvo)])
    assert d.acao("A2")["estado"] == "PROPOSTA" and d.acao("A2")["ok_registrado"] == 0 and d.acao("A2")["tentativas"] == 0
    d.passos([ev("RELOGIO", "PRAZO_ESPERA_VENCIDO", alvo), ev("RELOGIO", "LEMBRETE_24H", alvo), ev("RELOGIO", "PRAZO_ESPERA_VENCIDO", alvo)])
    assert d.acao("A2")["estado"] == "EXPIRADA"          # o padrão só corre depois do lembrete e nunca executa
    d.passo(ev("MOTOR", "EXECUTAR_ACAO", alvo))
    assert d.acao("A2")["tentativas"] == 0


def test_a_acao_incerta_nunca_e_refeita_e_so_vira_falha_com_a_sua_palavra(con):
    d = duas_acoes_prontas(con, "acao-incerta")
    alvo = "acao:A1"
    d.passos([ev("FUNDADOR", "APROVAR", alvo), ev("MOTOR", "EXECUTAR_ACAO", alvo), ev("RELOGIO", "TEMPO_ESGOTADO", alvo)])
    assert d.acao("A1")["estado"] == "INCERTA"
    for tentativa in (ev("MOTOR", "EXECUTAR_ACAO", alvo), ev("MOTOR", "ACAO_FALHOU", alvo), ev("RELOGIO", "PRAZO_ESPERA_VENCIDO", alvo), responder("FEITO_POR_MIM", alvo), ev("FUNDADOR", "APROVAR", alvo)):
        d.passo(tentativa)
        assert d.acao("A1")["estado"] == "INCERTA" and d.acao("A1")["tentativas"] == 1
    d.passos([ev("RELOGIO", "LEMBRETE_24H", alvo), ev("RELOGIO", "LEMBRETE_48H", alvo), ev("RELOGIO", "PRAZO_ESPERA_VENCIDO", alvo)])
    assert d.acao("A1")["estado"] == "NAO_CONFIRMADA"
    d.exigir_linhas({"X22", "X34"})


def test_o_mesmo_toque_duas_vezes_nao_repete_a_acao(con):
    """O toque leva um número único: o mesmo número duas vezes (rede lenta, duplo clique) não autoriza nem executa duas vezes."""
    d = duas_acoes_prontas(con, "toque-repetido")
    a1 = d.acao("A1")
    chamada = "select helena_v2.aplicar_evento('acao_externa', %s, 'FUNDADOR', 'APROVAR', '{}'::jsonb, null, null, %s, null, 'toque-unico-1', true)"
    primeira = d.mundo.chamar(chamada, (a1["id"], a1["versao"]))
    historico = d.mundo.chamar("select count(*) from helena_v2.historico where card_id = %s", (d.mundo.card,))
    segunda = d.mundo.chamar(chamada, (a1["id"], a1["versao"]))
    assert primeira["resultado"] == "APLICADO" and segunda["resultado"] == "REPETIDO"
    assert d.mundo.chamar("select count(*) from helena_v2.historico where card_id = %s", (d.mundo.card,)) == historico
    assert d.acao("A1")["tentativas"] <= 1


# ============================================================================== (5) CARD CANCELADO NO MEIO
MOMENTOS_DO_CANCELAMENTO = [
    pytest.param(False, [], id="no_rascunho"),
    pytest.param(True, [ev("HELENA", "LER_DE_VOLTA")], id="esperando_confirmacao"),
    pytest.param(False, [ev("HELENA", "LER_DE_VOLTA")], id="validando_o_plano"),
    pytest.param(False, INICIO + executando("E1"), id="com_a_etapa_executando"),
    pytest.param(False, INICIO + executando("E1") + [entregar("E1")], id="com_a_etapa_em_validacao"),
    pytest.param(False, INICIO + executando("E1") + [entregar("E1")] + revisao("E1", "CLARA"), id="com_a_etapa_em_revisao"),
    pytest.param(False, INICIO + executando("E1") + [perguntar()], id="com_a_etapa_esperando_voce"),
    pytest.param(False, INICIO + executando("E1") + [registrar_falha()], id="com_a_etapa_em_resolucao"),
    pytest.param(False, INICIO + aprovar(PADRAO, "E1"), id="com_a_etapa_aprovada"),
    pytest.param(False, INICIO + aprovar(PADRAO, "E1") + executando("E2") + [entregar("E2")], id="com_etapas_em_estados_diferentes"),
]


@pytest.mark.parametrize("grande,antes", MOMENTOS_DO_CANCELAMENTO)
def test_cancelar_no_meio_cancela_tudo_e_nada_atrasado_volta_a_andar(con, request, grande, antes):
    nome = request.node.callspec.id
    d = Duelo(con, PADRAO, False, {"pedido_grande": grande, "plano_valido": True}, "cancela-" + nome)
    d.passos(antes)
    d.passo(ev("FUNDADOR", "CANCELAR"))
    assert d.estado("card") == "CANCELADO"
    assert all(d.estado(c) == "CANCELADA" for c in d.mundo.perfis), [d.estado(c) for c in d.mundo.perfis]
    assert not d.mundo.linhas("select * from helena_v2.execucao where card_id = %s and estado = 'VIVA' and tipo <> 'HELENA'", (d.mundo.card,))
    for codigo in d.mundo.perfis:
        for resposta in (entregar(codigo), ev("REVISOR", "APROVAR", codigo), perguntar(codigo)):
            assert d.passo(resposta)["resultado"] == "RECUSADO"
    for depois in (ev("FUNDADOR", "APROVAR"), ev("FUNDADOR", "CANCELAR"), responder("CONFIRMO"), ev("MOTOR", "PLANO_VALIDO"), ev("MOTOR", "TODAS_PRONTAS"),
                   ev("RELOGIO", "PRAZO_VENCIDO"), ev("MOTOR", "DECISAO_MUDOU")):
        d.passo(depois)
    assert d.estado("card") == "CANCELADO"
    d.passo(ev("FUNDADOR", "PEDIR_AJUSTE"))        # card fechado: pedir ajuste abre card novo ligado (nunca reabre este)
    assert d.estado("card") == "CANCELADO" and d.mundo.foto()["cards_ligados"] >= 1
    sondar(d, semente=len(nome))


# ============================================================================== (6) SINAIS EM CASCATA
def test_cascata_reabrir_a_raiz_do_losango_reabre_todos_que_dependem_dela(con):
    """Raiz aprovada; B, C e D aprovadas sobre ela. Seu ajuste na raiz reabre a raiz e desce em cadeia (B e C, depois D, que depende das duas)."""
    d = duelar(con, losango_tudo_aprovado(), LOSANGO, nome="cascata-losango")
    assert [d.estado(c) for c in "ABCD"] == ["APROVADA"] * 4
    d.passo(ajuste("A"))
    d.exigir_linhas({"E111", "E114"})
    assert d.estado("A") == "NA_FILA" and all(d.estado(c) == "AGUARDANDO_ANTERIORES" for c in "BCD")
    assert d.etapa("D")["semaforo"] == "NENHUM" and d.etapa("D")["entrega_fresca"] is False
    d.passos(executando("A")[1:] + [entregar("A")] + revisao("A", "CLARA") + [ev("REVISOR", "APROVAR", "A")])
    assert d.estado("A") == "APROVADA" and d.estado("B") == "AGUARDANDO_ANTERIORES"
    sondar(d, semente=3)


def test_cascata_com_cada_dependente_num_estado_diferente(con):
    """B executando e C em revisão quando a raiz é reaberta: as duas voltam a esperar, as chaves vivas morrem, a resposta atrasada da revisão não vale."""
    base = INICIO + aprovar(LOSANGO, "A") + [ev("MOTOR", "DEPENDENCIAS_PRONTAS", "B"), ev("MOTOR", "DEPENDENCIAS_PRONTAS", "C")]
    d = duelar(con, base + [iniciar("B"), iniciar("C"), entregar("C")] + revisao("C", "HELENA") + [guarda("kc", chave_da("C"))], LOSANGO, nome="cascata-mista")
    assert d.estado("B") == "EXECUTANDO" and d.estado("C") == "REVISAO"
    d.passo(ajuste("A"))
    d.exigir_linhas({"E111", "E37", "E71"})
    assert d.estado("B") == d.estado("C") == "AGUARDANDO_ANTERIORES"
    assert d.etapa("B")["execucao_atual"] is None and d.etapa("C")["execucao_atual"] is None
    assert d.passo(com_chave_morta(ev("REVISOR", "APROVAR", "C"), "kc"))["resultado"] == "RECUSADO"


def test_cascata_dentro_de_cascata_a_decisao_nova_chega_a_dependente_que_ja_foi_reaberta(con):
    """A decisão nova avisa as etapas abertas na ordem do roteiro. A raiz (aprovada) reabre e avisa quem depende dela, que volta a esperar
    ANTES de a decisão chegar nelas; a decisão então acha as duas já esperando e só zera as tentativas (E03). Nenhum sinal se perde."""
    eventos = (INICIO + aprovar(LOSANGO, "A") + [ev("MOTOR", "DEPENDENCIAS_PRONTAS", "B"), ev("MOTOR", "DEPENDENCIAS_PRONTAS", "C"), iniciar("B"), iniciar("C"), entregar("C")]
               + revisao("C", "HELENA"))
    d = duelar(con, eventos, LOSANGO, nome="cascata-decisao")
    ordens = d.card()["ordens"]
    d.passo(ev("FUNDADOR", "PEDIR_AJUSTE", motivo_ajuste="TOM"))
    assert d.card()["ordens"] == ordens + 1
    d.exigir_linhas({"C16", "E115", "E37", "E71", "E03"})
    assert [d.estado(c) for c in "ABC"] == ["NA_FILA", "AGUARDANDO_ANTERIORES", "AGUARDANDO_ANTERIORES"]


def test_cascata_do_parecer_juridico_de_ajuste(con):
    d = duelar(con, juridico_pedindo_ajuste(), DUAS, nome="cascata-juridico")
    assert d.estado("E2") == "ESPERANDO_FUNDADOR" and d.etapa("E2")["motivo"] == "REVISAO"
    d.passo(ev("FUNDADOR", "APROVAR", "E2"))
    d.exigir_linhas({"E82", "E112"})
    assert d.estado("E1") == "NA_FILA" and d.estado("E2") == "AGUARDANDO_ANTERIORES" and d.card()["voltas"] == 1
    sondar(d, semente=4)


def test_cascata_dependencia_que_muda_com_quem_depende_esperando_voce(con):
    """Quem depende está esperando VOCÊ (pergunta) quando a raiz é reaberta: a espera some, o lembrete zera."""
    eventos = (INICIO + aprovar(LOSANGO, "A") + [ev("MOTOR", "DEPENDENCIAS_PRONTAS", "B"), iniciar("B"), perguntar("B"), ev("RELOGIO", "LEMBRETE_24H", "B"), ajuste("A")])
    d = duelar(con, eventos, LOSANGO, nome="cascata-espera")
    d.exigir_linhas({"E92", "E111"})
    assert d.estado("B") == "AGUARDANDO_ANTERIORES" and d.etapa("B")["lembretes"] == 0 and d.etapa("B")["motivo"] == "NENHUM"


# ============================================================================== (7) ALEATÓRIO EM ROTEIROS DE FORA, COM OS CAMPOS ESCONDIDOS
@contextmanager
def fantasmas_da_especificacao():
    """Pega, a cada replay, as variáveis escondidas que a ESPECIFICAÇÃO mantém por etapa (provar.conferir_etapa) para o teste comparar com o banco."""
    ultimo = {}
    conferir_original, replay_original = P.conferir_etapa, P.replay

    def conferir(m, pre, ev_, ln, pos, pf, tetos):
        g, V = conferir_original(m, pre, ev_, ln, pos, pf, tetos)
        ultimo[pf["id"]] = g
        return g, V

    def replay(*a, **k):
        ultimo.clear()
        return replay_original(*a, **k)

    P.conferir_etapa, P.replay = conferir, replay
    try:
        yield ultimo
    finally:
        P.conferir_etapa, P.replay = conferir_original, replay_original


def campos_escondidos(d, ultimo):
    """Fantasma da especificação (g_fresca, g_portao, g_viva, g_leu, g_lemb) contra o campo real do banco. Devolve as diferenças."""
    difs = []
    for codigo, e in d.foto_py["etapas"].items():
        if e["versao"] != 0 or codigo not in ultimo or e["estado"] in ("PRONTA", "CANCELADA", "ENCERRADA_COM_FALHA"):
            continue
        gv, _ge, _gi, gf, gp, gl, glb = ultimo[codigo]
        linha = d.etapa(codigo)
        if bool(gf) != linha["entrega_fresca"]:
            difs.append(f"{codigo}: entrega fresca provar={gf} banco={linha['entrega_fresca']} (estado {linha['estado']})")
        if bool(gp) != linha["portao1_ok"]:
            difs.append(f"{codigo}: portão 1 provar={gp} banco={linha['portao1_ok']} (estado {linha['estado']})")
        if gv != linha["exec_viva"]:
            difs.append(f"{codigo}: execução viva provar={gv} banco={linha['exec_viva']}")
        if gl == 1 and linha["leu_internet"] == 0:          # o banco mais travado que a especificação é seguro; mais solto, não
            difs.append(f"{codigo}: leu a internet provar={gl} banco={linha['leu_internet']}")
        if linha["estado"] == "ESPERANDO_FUNDADOR" and bool(glb) != (linha["lembretes"] >= 1):
            difs.append(f"{codigo}: lembrete entregue provar={glb} banco lembretes={linha['lembretes']}")
    return difs


def sequencia_aleatoria(con, nome_roteiro, semente, auto, passos):
    roteiro = TODOS_OS_ROTEIROS[nome_roteiro]
    sor = S.Sorteador(VOCAB, TAB, roteiro, semente)
    cartao = {"pedido_grande": semente % 3 != 0, "plano_valido": semente % 7 != 0}
    d = Duelo(con, roteiro, auto, cartao, f"aleatorio-{nome_roteiro}-{semente}-{'auto' if auto else 'manual'}")
    depois_do_final = 0
    with fantasmas_da_especificacao() as ultimo:
        for _ in range(passos):
            if d.foto_py["card"]["estado"] in FINAIS_DO_CARD:
                depois_do_final += 1
                if depois_do_final > 6:
                    break

            def tentar(e):
                with A.ReplayRapido():
                    r = P.replay(dict(d.j, eventos=d.j["eventos"] + [e]), VOCAB, TAB, conferir_historico=False)
                return A.destino_do_replay(r, len(d.j["eventos"])), A.foto_do_replay(r, COMPARTILHADOS)

            e = sor.proximo(d.foto_py, tentar)
            d.passo(e)                       # o último replay feito aqui deixa em `ultimo` os fantasmas do estado de agora
            d.exigir(campos_escondidos(d, ultimo), f"campos escondidos depois de {json.dumps(e, ensure_ascii=False)}")
    return len(d.j["eventos"])


@pytest.mark.parametrize("roteiro", sorted(TODOS_OS_ROTEIROS))
def test_aleatorio_em_roteiros_de_fora_o_banco_faz_o_mesmo_e_os_campos_escondidos_batem(con, roteiro):
    total = 0
    for semente in range(1, 1 + 2 * ESCALA):
        for auto in (False, True):
            total += sequencia_aleatoria(con, roteiro, 700 + semente, auto, 60)
    assert total > 100


# ============================================================================== (8) MECÂNICA DIRETA: as funções de dentro do banco contra o provar
def sortear_estado(rng, m):
    vals = {}
    for var in m.vars:
        if var in m.teto_var:
            t = m.teto_var[var]
            vals[var] = rng.choice([0, 0, t, max(t - 1, 0), rng.randint(0, t)])
        else:
            vals[var] = rng.choice(m.dominio[var])
    return vals


@pytest.mark.parametrize("nome", ["card", "etapa", "acao_externa"])
def test_achar_a_linha_no_banco_e_o_mesmo_do_provar_em_estados_sorteados(con, nome):
    """A função interna _achar_linha (chave, versão, card ativo, ator, parâmetros, guarda) contra Maquina.casar_cands, em estados
    sorteados (também os que o card nunca alcança). Número de execução e de chamada só existem onde existem de verdade."""
    m = MAQUINAS[nome]
    rng = random.Random(20261011 + len(nome))
    estados_do_card = list(TAB["estados"]["card"])
    chaves = list(m.por_chave)
    diferencas, achou = [], 0
    for _ in range(2500 * ESCALA):
        de, evento = rng.choice(chaves)
        papel = rng.choice(sorted({ln.papel for ln in m.por_chave[(de, evento)]}))
        vals = sortear_estado(rng, m)
        autor = rng.choice(VOCAB["identidades"]["agentes"])
        versao = rng.choice([3, 4, 5])
        execucao = 777 if (nome == "etapa" and vals.get("exec_viva") == 1) else None
        helena = rng.choice([None, 888])
        v = {"estado": de, "versao": versao, **vals, "autor": autor, "execucao_atual": execucao, "chamada_helena": helena}
        params = {p: rng.choice(dom) for p, dom in m.parametros.get((papel, evento), {}).items()}
        q = {c: rng.random() < 0.5 for c in P.CONFIG_NOMES[nome] + P.PREDICADOS_NOMES[nome]}
        q.update(params)
        if "escolhido" in params:
            q["revisor_valido"] = rng.random() < 0.6
        estado_card = rng.choice(estados_do_card)
        q["estado_card"] = estado_card
        ator, chave_db, chave_py, vista = None, None, "atual", None
        if papel in ("AUTOR", "REVISOR"):
            ator = rng.choice([None, autor, vals.get("revisor", autor), rng.choice(VOCAB["identidades"]["agentes"])])
            chave_db = execucao if rng.random() < 0.75 else rng.choice([776, None, execucao])
            if execucao is None and chave_db is None:
                continue                       # sem execução viva o banco recusa por falta de número; o provar não tem esse conceito
            chave_py = "atual" if chave_db == execucao else "antiga"
        elif papel == "HELENA":
            chave_db = helena if rng.random() < 0.75 else rng.choice([887, None, helena])
            if helena is None and chave_db is None:
                continue
            chave_py = "atual" if chave_db == helena else "antiga"
        elif papel == "FUNDADOR":
            vista = rng.choice([versao, versao, versao - 1, None])
            chave_py = "atual" if vista == versao else "antiga"
        s = tuple([de] + [vals[x] for x in m.vars])
        cands = [ln for ln in m.por_chave[(de, evento)] if ln.papel == papel]
        esperado = sorted({ln.id for ln in m.casar_cands(s, cands, P._EvSimples(papel, q, ator, chave_py), autor if nome == "etapa" else None)})
        achou += bool(esperado)
        try:
            r = con.execute("select helena_v2._achar_linha(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                            (nome, papel, evento, Jsonb(v), Jsonb(q), Jsonb(params), ator, chave_db, vista, estado_card)).fetchone()[0]
            obtido = [r] if r else []
        except psycopg.Error as erro:
            obtido = ["DUAS LINHAS" if "REGRA 13" in str(erro) else str(erro)[:80]]
        if esperado != obtido and not (len(esperado) > 1 and obtido == ["DUAS LINHAS"]):
            diferencas.append((de, evento, papel, vals, q, ator, chave_db, vista, estado_card, esperado, obtido))
    assert not diferencas, diferencas[:2]
    assert achou > 400, "o sorteio precisa achar linha em muitos casos, senão não prova nada"


def test_os_efeitos_no_banco_dao_o_mesmo_estado_novo_do_provar_em_todas_as_linhas(con):
    rng = random.Random(5)
    comparados = 0
    for nome, m in MAQUINAS.items():
        ops = {r[0]: r for r in con.execute("select linha_id, efeitos, para from helena_v2.passagem where maquina = %s", (nome,))}
        for ln in m.linhas:
            params = {p: rng.choice(dom) for p, dom in m.parametros.get((ln.papel, ln.evento), {}).items()}
            for _ in range(8 * ESCALA):
                vals = sortear_estado(rng, m)
                esperado = dict(zip(["estado"] + m.vars, m.aplicar(tuple([ln.de] + [vals[x] for x in m.vars]), ln, params)))
                _id, efeitos, para = ops[ln.id]
                obtido = con.execute("select helena_v2._efeitos(%s, %s, %s) || jsonb_build_object('estado', %s::text)",
                                     (Jsonb({"estado": ln.de, **vals}), Jsonb(efeitos), Jsonb(params), para)).fetchone()[0]
                assert all(obtido.get(k) == v for k, v in esperado.items()), (nome, ln.id, vals, esperado, obtido)
                comparados += 1
    assert comparados > 1000


def roteiro_sorteado(rng):
    """Roteiros bons e ruins: ciclo, dependência que não existe, julga sem depender, autor ou revisor desconhecido, ficha vazia..."""
    k = rng.randint(1, 5)
    ids = [rng.choice(["E1", "E2", "E3", "E4", "E5", "EJ", "ER"]) if rng.random() < 0.1 else f"E{i + 1}" for i in range(k)]
    etapas = []
    for i, id_ in enumerate(ids):
        deps = rng.sample(ids, rng.randint(0, min(2, len(ids)))) if rng.random() < 0.7 else []
        if rng.random() < 0.85:
            deps = [d for d in deps if d in ids[:i]]
        julga = [d for d in deps if rng.random() < 0.4] if rng.random() < 0.8 else rng.sample(ids, rng.randint(0, 1))
        e = etapa_de_roteiro(id_, rng.choice(VOCAB["identidades"]["agentes"]) if rng.random() < 0.97 else rng.choice(["FUNDADOR", "ZZZ"]),
                             [rng.choice(NOMES_POSSIVEIS) for _ in range(rng.randint(0, 4))], deps, julga, rng.random() < 0.5, rng.random() < 0.5, rng.random() < 0.3,
                             rng.sample(TODAS_AS_ACOES, rng.randint(0, 4)))
        if rng.random() < 0.1:
            e.pop("acoes_permitidas")
        etapas.append(e)
    return {"etapas": etapas}


def test_criar_card_aceita_e_recusa_os_mesmos_roteiros_do_provar_e_deriva_as_mesmas_fichas(con):
    rng = random.Random(1)
    aceitos = recusados = 0
    for i in range(500 * ESCALA):
        roteiro = roteiro_sorteado(rng)
        try:
            perfis = P.perfis_do_roteiro(roteiro, TAB, VOCAB)
        except P.ErroTabela:
            perfis = None
        try:
            card = con.execute("select helena_v2.criar_card('roteiro', %s, 'm', 't', %s, %s, 'e', '{}'::jsonb, 0, false)",
                               (f"r{i}-{time.time_ns()}", A.PRAZO_DO_CARD, Jsonb(roteiro))).fetchone()[0]["card_id"]
        except psycopg.Error:
            card = None
        assert (perfis is not None) == (card is not None), (perfis is not None, card is not None, json.dumps(roteiro, ensure_ascii=False)[:600])
        if perfis is None:
            recusados += 1
            continue
        aceitos += 1
        linhas = con.execute("select codigo, autor, revisores_validos, julgadores, depende_de, julga, tem_internet, julgadora, julgada, pulavel, permite_perguntar, "
                             "permite_devolver, usa_decisao, prazo_de_terceiro from helena_v2.etapa where card_id = %s order by ordem", (card,)).fetchall()
        for pf, linha in zip(perfis, linhas):
            c = pf["cfg"]
            assert tuple(linha) == (pf["id"], pf["autor"], pf["revisores_validos"], pf["julgadores"], pf["depende_de"], pf["julga"], c["tem_internet"], c["julgadora"],
                                    c["julgada"], c["pulavel"], c["permite_perguntar"], c["permite_devolver"], c["usa_decisao"], c["prazo_de_terceiro"])
    assert aceitos > 150 and recusados > 150


# ============================================================================== (9) O GERADOR NÃO DEIXA TRECHO DA TABELA FICAR DE FORA EM SILÊNCIO
def folhas(obj, caminho=()):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from folhas(v, caminho + (k,))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from folhas(v, caminho + (i,))
    else:
        yield caminho, obj


def mexer(v):
    return (not v) if isinstance(v, bool) else v + 1 if isinstance(v, int) else v + "_ZZ"


def so_o_modelo(sql, vocab, tab):
    return sql.replace(P.impressao_digital(vocab, tab), "<IMPRESSAO>")


# O que o banco NÃO lê do YAML, por ser explicação para gente (ou checagem que mora só no provar). Se um trecho novo sumir em silêncio,
# este teste falha; se um destes passar a ser lido, ele também falha (tire o nome da lista).
IGNORADO_DE_PROPOSITO = [
    ("tab", re.compile(r"^estados/(card|etapa|acao_externa)/[A-Z_]+/(padrao_nunca_aprova|depois)$")),
    ("vocab", re.compile(r"^(versao|papeis_do_sistema/\d+|botoes_do_fundador/\d+|entradas_do_app/[A-Z_]+|motivos_do_agente/\d+|motivos_de_ajuste/\d+)$")),
    ("vocab", re.compile(r"^papeis/[A-Z]+/(descricao|e_ia|pode_agir_fora)$")),
    ("vocab", re.compile(r"^motivos/[a-z_]+/\d+$")),
    ("vocab", re.compile(r"^classes_de_falha/[A-Z_]+/(gasta_tentativa|resposta|evento/\d+)$")),
    ("vocab", re.compile(r"^acoes/[A-Z]+/[A-Z0-9_]+/(nota|preenchidos_pelo_motor/\d+)$")),
]


def test_nenhum_trecho_da_tabela_some_em_silencio_no_gerador():
    """Mexe em cada folha do YAML, uma de cada vez. Ou o gerador PARA (a tabela deixou de fazer sentido), ou o SQL muda. Se nem uma coisa
    nem outra, o trecho não chega ao banco: só pode ser um dos que estão na lista IGNORADO_DE_PROPOSITO."""
    base = so_o_modelo(G.gerar(VOCAB, TAB)["0002_passagens_geradas.sql"], VOCAB, TAB)
    rng = random.Random(9)
    em_silencio, testadas = [], 0
    for nome_doc, doc in (("tab", TAB), ("vocab", VOCAB)):
        for caminho, valor in folhas(doc):
            if valor is None:
                continue
            if caminho[0] == "linhas" and ESCALA == 1 and rng.random() > 0.12:
                continue                              # as ~2000 folhas das linhas: amostra fixa (ESCALA=3 testa todas)
            novo = copy.deepcopy(doc)
            alvo = novo
            for c in caminho[:-1]:
                alvo = alvo[c]
            alvo[caminho[-1]] = mexer(valor)
            vocab2, tab2 = (VOCAB, novo) if nome_doc == "tab" else (novo, TAB)
            testadas += 1
            try:
                sql = G.gerar(vocab2, tab2)["0002_passagens_geradas.sql"]
            except Exception:
                continue
            if so_o_modelo(sql, vocab2, tab2) == base:
                em_silencio.append((nome_doc, "/".join(map(str, caminho))))
    assert testadas > 700
    sobras = [(doc, c) for doc, c in em_silencio if not any(d == doc and r.match(c) for d, r in IGNORADO_DE_PROPOSITO)]
    assert not sobras, f"trechos do YAML que o gerador ignora sem avisar: {sobras[:8]}"
    sem_uso = [(d, r.pattern) for d, r in IGNORADO_DE_PROPOSITO if not any(d == doc and r.match(c) for doc, c in em_silencio)]
    if ESCALA >= 3:
        assert not sem_uso, f"estes itens da lista de ignorados já são lidos: tire da lista: {sem_uso}"


def test_o_gerador_para_em_vez_de_gerar_um_banco_pela_metade():
    """Coisas que o YAML pode pedir e o banco não sabe: o gerador PARA e diz o quê (nunca ignora)."""
    casos = {
        "sinal condicional": lambda t: t["linhas"]["etapa"][0].__setitem__("sinais", [{"sinal": "DECISAO_MUDOU", "se": "execucoes > 0"}]),
        "alvo de sinal desconhecido": lambda t: t["ligacoes"]["CANCELAR_ETAPAS"]["para"].append("etapas_que_nao_existem"),
        "ação no card desconhecida": lambda t: t["ligacoes"].__setitem__("NOVO", {"no_card": "fazer_cafe"}),
        "estado fora do vocabulário": lambda t: t["estados"]["card"].__setitem__("ESTADO_NOVO", {"dono": "HELENA", "prazo": "prazo_do_card"}),
        "guarda com chamada de função": lambda t: t["linhas"]["card"][0].__setitem__("guarda", "len(motivo) > 1"),
        "variável sem teto nem domínio": lambda t: t["variaveis"]["card"].__setitem__("solta", {"inicial": 0}),
        "teto que não é número": lambda t: t["tetos"]["TETO_ORDENS"].__setitem__("valor", "tres"),
    }
    for nome, mutar in casos.items():
        tab2 = copy.deepcopy(TAB)
        mutar(tab2)
        with pytest.raises(Exception):
            G.gerar(VOCAB, tab2)


# ============================================================================== (10) A TABELA DO BANCO É A QUE PASSOU NA PROVA
def test_a_tabela_selada_no_banco_e_a_que_passou_na_prova_inteira(con):
    """Roda a prova completa (as 3 camadas) sobre o YAML de hoje. Só se não houver violação a impressão digital dela vale; e tem de ser a MESMA
    que está no SQL guardado, na tabela meta_tabela e no selo do banco (tabela_confere)."""
    rel, medidas = P.provar()
    assert rel.vazio(), rel.lista()[:3]
    digital = medidas["impressao_digital"]
    assert digital == P.impressao_digital(VOCAB, TAB)
    assert f"-- Impressão digital da tabela (provar.impressao_digital): {digital}" in (C.MIGRACOES / "0002_passagens_geradas.sql").read_text(encoding="utf-8")
    assert con.execute("select impressao_digital from helena_v2.meta_tabela").fetchone()[0] == digital
    assert con.execute("select helena_v2.tabela_confere()").fetchone()[0] is True
