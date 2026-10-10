"""As invariantes: o que NUNCA pode acontecer, em nenhuma sequência de eventos.

Cada invariante é uma função pequena que olha UM passo (o evento, a resposta do alvo e a foto
antes e depois) e devolve a lista de defeitos que achou (vazia = tudo certo).
O Verificador roda todas depois de cada evento. Para criar uma invariante nova: escreva a função
com @invariante("nome") e acrescente um caso negativo em testes/test_invariantes.py.
"""
from dataclasses import dataclass, field

from .eventos import Evento, Foto, Resposta
from .roteiro import Roteiro
from .vocabulario import (
    ACAO_FINAIS, BOTOES_COM_VERSAO, CARD_ANTES_DO_PLANO, CARD_FINAIS, ETAPA_FINAIS, FUNDADOR, LIMITE_INICIOS_SEM_ORDEM,
    PAPEIS_DE_IA, TETO_EXECUCOES, e_conhecido, e_final,
)


@dataclass(frozen=True)
class Violacao:
    invariante: str
    passo: int
    evento: str
    mensagem: str

    def como_dict(self):
        return {"invariante": self.invariante, "passo": self.passo, "evento": self.evento, "mensagem": self.mensagem}


@dataclass
class Passo:
    indice: int
    evento: Evento
    resposta: Resposta
    antes: Foto
    depois: Foto
    roteiro: Roteiro
    memoria: dict = field(default_factory=dict)      # o que o Verificador lembra de um passo para o outro


INVARIANTES = {}


def invariante(nome):
    def registrar(funcao):
        INVARIANTES[nome] = funcao
        return funcao
    return registrar


def _entidades(foto):
    """(máquina, estado, nome) de tudo que a foto mostra."""
    yield "card", foto.card["estado"], "card"
    for e in foto.etapas.values():
        yield "etapa", e.estado, f"etapa {e.id}"
    for a in foto.acoes.values():
        yield "acao_externa", a.estado, f"ação {a.id}"


def _satisfaz(e):
    """Uma etapa libera quem depende dela quando está aprovada (ou pronta, ou pulada)."""
    return e.estado in ("APROVADA", "PRONTA") or (e.estado == "ENCERRADA_COM_FALHA" and e.fim == "PULADA")


def _abre_rodada_nova(p):
    """Ordem do fundador ou decisão nova: o teto de execuções recomeça (as ordens têm teto próprio)."""
    ev = p.evento
    return p.resposta.aceito and (ev.papel == FUNDADOR or (ev.papel == "MOTOR" and ev.evento == "DECISAO_MUDOU"))


# ----------------------------------------------------------------------------- 1. regra 5
@invariante("teto_de_execucoes")
def teto_de_execucoes(p):
    """Nenhuma etapa passa de 6 execuções. Confere o contador do alvo e, à parte, conta quantas
    execuções começaram sem nenhuma ordem do fundador no meio."""
    msgs = [f"etapa {e.id} com {e.execucoes} execuções (teto {TETO_EXECUCOES})"
            for e in p.depois.etapas.values() if e.execucoes > TETO_EXECUCOES]
    inicios = p.memoria.setdefault("inicios", {})
    if _abre_rodada_nova(p):
        inicios.clear()
    for _papel, evento, alvo in p.resposta.automaticos:
        if evento in ("INICIAR_EXECUCAO", "INICIAR_REVISAO"):
            inicios[alvo] = inicios.get(alvo, 0) + 1
            if inicios[alvo] == LIMITE_INICIOS_SEM_ORDEM + 1:
                msgs.append(f"etapa {alvo} começou {inicios[alvo]} execuções sem ordem do fundador (limite {LIMITE_INICIOS_SEM_ORDEM})")
    return msgs


# ----------------------------------------------------------------------------- 2. regra 1
@invariante("dono_e_prazo")
def dono_e_prazo(p):
    """Todo estado aberto (do card, de cada etapa e de cada ação) tem dono e prazo."""
    msgs = []
    for maquina, estado, nome in _entidades(p.depois):
        if not e_conhecido(maquina, estado):
            msgs.append(f"{nome} em estado fora do vocabulário: {estado}")
        elif not e_final(maquina, estado):
            dono, prazo = p.depois.donos.get(maquina, {}).get(estado) or (None, None)
            if not dono:
                msgs.append(f"{nome} em {estado} sem dono")
            if not prazo:
                msgs.append(f"{nome} em {estado} sem prazo")
    return msgs


# ----------------------------------------------------------------------------- 3. regra 4
@invariante("ninguem_aprova_a_propria_peca")
def ninguem_aprova_a_propria_peca(p):
    """O revisor nunca é o autor, nem quem vai julgar a mesma peça depois. Só o revisor
    designado aprova, e o autor nunca aprova nem reprova nada."""
    msgs = []
    for e in p.depois.etapas.values():
        if e.revisor not in ("NENHUM", FUNDADOR) and e.revisor in p.roteiro.proibidos_de_revisar(e.id):
            msgs.append(f"etapa {e.id}: o revisor {e.revisor} é proibido (autor ou quem julga a peça depois)")
    ev = p.evento
    if p.resposta.aceito and ev.alvo in p.antes.etapas:
        if ev.papel == "AUTOR" and ev.evento in ("APROVAR", "REPROVAR"):
            msgs.append(f"o autor julgou a própria peça em {ev.alvo}")
        if ev.papel == "REVISOR" and ev.evento == "APROVAR":
            if ev.ator in p.roteiro.proibidos_de_revisar(ev.alvo):
                msgs.append(f"{ev.ator} aprovou {ev.alvo} sendo proibido de revisar")
            if ev.ator != p.antes.etapas[ev.alvo].revisor:
                msgs.append(f"{ev.ator} aprovou {ev.alvo} sem ser o revisor designado ({p.antes.etapas[ev.alvo].revisor})")
    return msgs


# ----------------------------------------------------------------------------- 4. regra 9
@invariante("padrao_nunca_aprova")
def padrao_nunca_aprova(p):
    """Etapa só vira APROVADA, e ação só vira AUTORIZADA, por um aprovar de quem pode (revisor ou fundador).
    Nem relógio, nem padrão, nem motor aprova."""
    msgs = []
    ev = p.evento
    for i, d in p.depois.etapas.items():
        if d.estado == "APROVADA" and p.antes.etapas[i].estado != "APROVADA":
            if not (p.resposta.aceito and ev.papel in ("REVISOR", FUNDADOR) and ev.evento == "APROVAR" and ev.alvo == i):
                msgs.append(f"etapa {i} ficou APROVADA por {ev.rotulo}")
    for i, d in p.depois.acoes.items():
        antes = p.antes.acoes.get(i)
        if d.estado == "AUTORIZADA" and (antes is None or antes.estado != "AUTORIZADA"):
            if not (p.resposta.aceito and ev.papel == FUNDADOR and ev.evento == "APROVAR" and ev.alvo == f"acao:{i}"):
                msgs.append(f"ação {i} ficou AUTORIZADA por {ev.rotulo}")
    return msgs


# ----------------------------------------------------------------------------- 5. regra 8
@invariante("nada_externo_pelo_agente")
def nada_externo_pelo_agente(p):
    """Agente só propõe. Ação de fora nasce só no card pronto, já como proposta; só o motor executa,
    só depois do ok registrado do fundador, no máximo uma vez."""
    msgs = []
    ev = p.evento
    if ev.papel in PAPEIS_DE_IA and any(p.depois.acoes.get(i) != a for i, a in p.antes.acoes.items()):
        msgs.append(f"{ev.rotulo} mexeu numa ação externa")
    executar = ("MOTOR", "EXECUTAR_ACAO")
    for i, a in p.depois.acoes.items():
        antes = p.antes.acoes.get(i)
        nome = f"ação {i}"
        if antes is None:
            if a.estado != "PROPOSTA":
                msgs.append(f"{nome} nasceu já em {a.estado}")
            if p.depois.card["estado"] != "PRONTO":
                msgs.append(f"{nome} nasceu com o card em {p.depois.card['estado']}")
        if a.estado in ("AUTORIZADA", "EXECUTANDO_ACAO", "EXECUTADA") and not a.ok_registrado:
            msgs.append(f"{nome} em {a.estado} sem o ok registrado do fundador")
        if a.tentativas > 1:
            msgs.append(f"{nome} executada {a.tentativas} vezes (máximo 1)")
        if a.ok_registrado and (antes is None or not antes.ok_registrado):
            if not (ev.papel == FUNDADOR and ev.evento == "APROVAR" and ev.alvo == f"acao:{i}"):
                msgs.append(f"{nome} ganhou o ok registrado por {ev.rotulo}")
        if a.estado == "EXECUTANDO_ACAO" and (antes is None or antes.estado != "EXECUTANDO_ACAO"):
            disparou = (executar[0], executar[1], f"acao:{i}") in p.resposta.automaticos or (
                ev.papel == executar[0] and ev.evento == executar[1] and ev.alvo == f"acao:{i}")
            if not disparou:
                msgs.append(f"{nome} começou a executar sem o disparo do motor")
    return msgs


# ----------------------------------------------------------------------------- 6. regra 10
@invariante("pronto_sem_informacao_velha")
def pronto_sem_informacao_velha(p):
    """O card só fica PRONTO com tudo aprovado e fresco. Decisão nova ou anterior reaberta
    nunca deixa uma etapa aprovada sobre informação velha."""
    msgs = []
    d = p.depois
    if d.card["estado"] == "PRONTO":
        msgs += [f"card PRONTO com a etapa {e.id} em {e.estado}" for e in d.etapas.values()
                 if not (e.estado == "PRONTA" or _satisfaz(e))]
    for e in d.etapas.values():
        if e.estado in ("APROVADA", "PRONTA"):
            for dep in p.roteiro.etapa(e.id).depende_de:
                if not _satisfaz(d.etapas[dep]):
                    msgs.append(f"etapa {e.id} em {e.estado} sobre a anterior {dep}, que está em {d.etapas[dep].estado}")
    ev = p.evento
    if ev.papel == "MOTOR" and ev.evento == "DECISAO_MUDOU" and ev.alvo == "card" and p.resposta.aceito:
        for i, antes in p.antes.etapas.items():
            if antes.estado == "APROVADA" and p.roteiro.etapa(i).usa_decisao and d.etapas[i].estado == "APROVADA":
                msgs.append(f"etapa {i} continuou APROVADA depois de a decisão mudar")
    return msgs


# ----------------------------------------------------------------------------- 7. regra 2
@invariante("card_final_nao_volta")
def card_final_nao_volta(p):
    """Card final (pronto, cancelado ou encerrado) não volta a andar; etapa e ação finais também não."""
    msgs = []
    a, d = p.antes, p.depois
    if a.card["estado"] in CARD_FINAIS and a.card != d.card:
        msgs.append(f"o card final {a.card['estado']} mudou depois de {p.evento.rotulo}")
    for i, x in a.etapas.items():
        y = d.etapas.get(i)
        if x.estado in ETAPA_FINAIS and (y is None or (y.versao == x.versao and y.estado != x.estado)):
            msgs.append(f"a etapa final {i} saiu de {x.estado} para {y.estado if y else 'nada'}")
    for i, x in a.acoes.items():
        y = d.acoes.get(i)
        if x.estado in ACAO_FINAIS and (y is None or y.estado != x.estado):
            msgs.append(f"a ação final {i} saiu de {x.estado} para {y.estado if y else 'nada'}")
    return msgs


# ----------------------------------------------------------------------------- 8. regra 6 e cancelamento em cascata
@invariante("etapas_seguem_o_card")
def etapas_seguem_o_card(p):
    """Card cancelado ou encerrado fecha as etapas e as ações abertas junto (cascata);
    enquanto o plano não vale, nenhuma etapa anda."""
    msgs = []
    d = p.depois
    estado = d.card["estado"]
    if estado in ("CANCELADO", "ENCERRADO_COM_FALHA"):
        msgs += [f"card {estado} e a etapa {e.id} continua em {e.estado}" for e in d.etapas.values()
                 if e.estado not in ETAPA_FINAIS]
        msgs += [f"card {estado} e a ação {a.id} continua em {a.estado}" for a in d.acoes.values()
                 if a.estado in ("PROPOSTA", "AUTORIZADA")]
    if estado in CARD_ANTES_DO_PLANO:
        msgs += [f"a etapa {e.id} está em {e.estado} com o card em {estado}" for e in d.etapas.values()
                 if e.estado not in ETAPA_FINAIS and e.estado != "AGUARDANDO_ANTERIORES"]
    return msgs


# ----------------------------------------------------------------------------- 9. regra 3 e A-6
@invariante("resposta_antiga_nao_grava")
def resposta_antiga_nao_grava(p):
    """Resposta de execução que já passou (autor, revisor, Helena) e toque do fundador sobre uma
    versão que ele não viu (aprovar, pedir ajuste, responder) nunca mudam o estado."""
    ev = p.evento
    if ev.chave != "antiga":
        return []
    vale_a_regra = ev.papel in PAPEIS_DE_IA or (ev.papel == FUNDADOR and ev.evento in BOTOES_COM_VERSAO)
    if vale_a_regra and (p.resposta.aceito or not p.antes.mesmo_estado_que(p.depois)):
        return [f"{ev.rotulo} mudou o estado"]
    return []


# ----------------------------------------------------------------------------- 10. regra 11 / reações
@invariante("recusa_nao_muda_nada")
def recusa_nao_muda_nada(p):
    """Evento recusado (ou que virou só comentário ou reação) não muda nada."""
    if not p.resposta.aceito and not p.antes.mesmo_estado_que(p.depois):
        return [f"{p.evento.rotulo} foi {p.resposta.destino} mas o estado mudou"]
    return []


# ----------------------------------------------------------------------------- 11. plano l. 93
@invariante("quem_leu_internet_so_entrega")
def quem_leu_internet_so_entrega(p):
    """Se a execução usou a internet, só vale Entregar ou Registrar falha: nunca pergunta nem pedido para outro agente."""
    ev = p.evento
    if (ev.papel == "AUTOR" and ev.evento in ("PERGUNTAR", "DEVOLVER_A_QUEM_PEDIU", "PEDIR_SUBCARD")
            and ev.params.get("usou_internet") == "SIM" and p.resposta.aceito and p.resposta.destino == "PASSAGEM"):
        return [f"{ev.rotulo} foi aceito mesmo com o agente tendo usado a internet"]
    return []


# ----------------------------------------------------------------------------- 12. o que o próprio alvo acusa
@invariante("o_alvo_nao_acusou")
def o_alvo_nao_acusou(p):
    """Violações que o próprio alvo declara (a máquina real confere as 13 regras de ferro em cada replay)."""
    return [f"[{regra}] {mensagem}" for regra, mensagem in p.resposta.violacoes_do_alvo]


class Verificador:
    """Roda todas as invariantes depois de cada evento."""

    def __init__(self, roteiro, invariantes=None):
        self.roteiro = roteiro
        self.invariantes = dict(INVARIANTES if invariantes is None else invariantes)
        self.memoria = {}
        self.indice = 0
        self.violacoes = []

    def conferir(self, evento, resposta, antes, depois):
        passo = Passo(self.indice, evento, resposta, antes, depois, self.roteiro, self.memoria)
        achadas = []
        for nome, funcao in self.invariantes.items():
            achadas += [Violacao(nome, self.indice, evento.rotulo, m) for m in funcao(passo)]
        self.indice += 1
        self.violacoes += achadas
        return achadas

    def conferir_final(self, acusacoes_do_alvo):
        """Acusações que o alvo só faz no fim (ex.: a máquina real confere que o histórico reconstrói o card)."""
        achadas = [Violacao("o_alvo_nao_acusou", self.indice, "fim", f"[{r}] {m}") for r, m in acusacoes_do_alvo]
        self.violacoes += achadas
        return achadas
