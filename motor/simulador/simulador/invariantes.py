"""As invariantes: o que NUNCA pode acontecer, em nenhuma sequência de eventos.

Cada invariante é uma função pequena que olha UM passo (o evento, a resposta do alvo e a foto
antes e depois) e devolve a lista de defeitos que achou (vazia = tudo certo).
O Verificador roda todas depois de cada evento. Para criar uma invariante nova: escreva a função
com @invariante("nome") e acrescente um caso negativo em testes/test_invariantes.py (um teste confere que
nenhuma ficou sem caso negativo) e, se der, uma mutação em testes/mutantes.py que só ela pega.

Cuidado ao escrever: o motor anda sozinho DEPOIS de cada evento (a aprovação da última etapa já fecha o card, o ok do
fundador já dispara a execução da ação). Estados de passagem como APROVADA e AUTORIZADA podem nem aparecer na foto.
"""
from dataclasses import dataclass, field

from .eventos import Evento, Foto, Resposta
from .roteiro import Roteiro
from .vocabulario import (
    ACAO_FINAIS, BOTOES_COM_VERSAO, CARD_ANTES_DO_PLANO, CARD_FINAIS, DESTINOS_DE_UM_TOQUE, ETAPA_FINAIS,
    EVENTOS_DE_INFRA, EVENTOS_DO_PAPEL, FUNDADOR, LIMITE_INICIOS_SEM_ORDEM, ORDENS_QUE_REABREM, PAPEIS_DE_IA,
    TETO_EXECUCOES, TETO_LEMBRETES, TETO_MUDANCAS_PRAZO, TETO_NIVEL_PRAZO, TETO_ORDENS, TETO_PERGUNTAS,
    e_conhecido, e_final,
)

# Estados de uma ação que só existem depois de o fundador ter dado o ok.
DEPOIS_DO_OK = ("AUTORIZADA", "EXECUTANDO_ACAO", "INCERTA", "EXECUTADA", "FALHOU", "NAO_CONFIRMADA")

# Contadores do card que têm teto próprio (regra 5: "todo contador dentro do teto").
TETOS_DO_CARD = {"ordens": TETO_ORDENS, "perguntas": TETO_PERGUNTAS, "lembretes": TETO_LEMBRETES,
                 "nivel_prazo": TETO_NIVEL_PRAZO, "mudancas_prazo": TETO_MUDANCAS_PRAZO}


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
    """Ordem do fundador que reabre o trabalho (pedir ajuste, refazer, esperar, modelo menor) ou decisão nova:
    o teto de execuções recomeça (as ordens têm teto próprio). Mudar prazo, aprovar, cancelar... não recomeçam nada."""
    ev = p.evento
    if not p.resposta.aceito:
        return False
    if ev.papel == FUNDADOR:
        return ev.evento == "PEDIR_AJUSTE" or (ev.evento == "RESPONDER" and ev.params.get("opcao") in ORDENS_QUE_REABREM)
    return False


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
    """Etapa só chega a APROVADA (ou PRONTA), e ação só ganha autorização, por um aprovar de quem pode
    (revisor ou fundador). Nem relógio, nem padrão, nem motor aprova. Vale mesmo quando o motor anda sozinho
    logo depois (a aprovação da última etapa já fecha o card no mesmo passo e o APROVADA nem aparece na foto)."""
    msgs = []
    ev = p.evento
    for i, d in p.depois.etapas.items():
        if d.estado in ("APROVADA", "PRONTA") and p.antes.etapas[i].estado not in ("APROVADA", "PRONTA"):
            if not (p.resposta.aceito and ev.papel in ("REVISOR", FUNDADOR) and ev.evento == "APROVAR" and ev.alvo == i):
                msgs.append(f"etapa {i} ficou {d.estado} por {ev.rotulo}")
    for i, d in p.depois.acoes.items():
        antes = p.antes.acoes.get(i)
        if d.estado in ("AUTORIZADA", "EXECUTANDO_ACAO", "EXECUTADA") and (antes is None or antes.estado not in DEPOIS_DO_OK):
            if not (p.resposta.aceito and ev.papel == FUNDADOR and ev.evento == "APROVAR" and ev.alvo == f"acao:{i}"):
                msgs.append(f"ação {i} ficou {d.estado} por {ev.rotulo}")
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
    if ev.papel == FUNDADOR and ev.evento == "PEDIR_AJUSTE" and ev.alvo == "card" and p.resposta.aceito:
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


# ----------------------------------------------------------------------------- 10b. regra 5 (contadores com teto próprio)
@invariante("contadores_dentro_do_teto")
def contadores_dentro_do_teto(p):
    """Nenhum contador passa do seu teto: ordens, perguntas, lembretes, nível e mudanças de prazo do card;
    lembretes de cada etapa e de cada ação. (O teto de execuções tem invariante própria.)"""
    msgs = [f"card: {nome} = {p.depois.card[nome]} (teto {teto})"
            for nome, teto in TETOS_DO_CARD.items() if p.depois.card.get(nome, 0) > teto]
    msgs += [f"etapa {e.id}: lembretes = {e.lembretes} (teto {TETO_LEMBRETES})"
             for e in p.depois.etapas.values() if e.lembretes > TETO_LEMBRETES]
    msgs += [f"ação {a.id}: lembretes = {a.lembretes} (teto {TETO_LEMBRETES})"
             for a in p.depois.acoes.values() if a.lembretes > TETO_LEMBRETES]
    return msgs


# ----------------------------------------------------------------------------- 10c. regra 3 (uma execução viva por etapa)
@invariante("uma_execucao_viva_por_etapa")
def uma_execucao_viva_por_etapa(p):
    """No máximo uma execução viva por etapa, e só enquanto a etapa executa ou revisa."""
    msgs = []
    for e in p.depois.etapas.values():
        if e.exec_viva not in (0, 1):
            msgs.append(f"etapa {e.id} com {e.exec_viva} execuções vivas (só 0 ou 1)")
        elif e.exec_viva == 1 and e.estado not in ("EXECUTANDO", "REVISAO"):
            msgs.append(f"etapa {e.id} com execução viva em {e.estado}")
    return msgs


# ----------------------------------------------------------------------------- 10d. regra 6 (ninguém trabalha sem a anterior)
@invariante("ninguem_trabalha_sem_a_anterior")
def ninguem_trabalha_sem_a_anterior(p):
    """Etapa que depende de outra só trabalha (fila, execução, validação, revisão, espera ou resolução) com a
    anterior aprovada ou pulada. Reaberta a anterior, quem dependia volta a aguardar no mesmo passo."""
    d = p.depois
    return [f"etapa {e.id} em {e.estado} com a anterior {dep} em {d.etapas[dep].estado}"
            for e in d.etapas.values() if e.estado not in ETAPA_FINAIS + ("AGUARDANDO_ANTERIORES", "APROVADA")
            for dep in p.roteiro.etapa(e.id).depende_de if not _satisfaz(d.etapas[dep])]


# ----------------------------------------------------------------------------- 10e. regra 7 (só o fundador muda o prazo)
@invariante("so_o_fundador_muda_o_prazo")
def so_o_fundador_muda_o_prazo(p):
    """O número de mudanças de prazo só sobe, e os avisos do prazo só são rearmados, por um MUDAR_PRAZO do fundador
    aceito no card. Sugestão da Helena, relógio ou motor nunca mudam o prazo."""
    a, d, ev = p.antes.card, p.depois.card, p.evento
    mudou = d.get("mudancas_prazo", 0) != a.get("mudancas_prazo", 0) or d.get("nivel_prazo", 0) < a.get("nivel_prazo", 0)
    if mudou and not (p.resposta.aceito and ev.papel == FUNDADOR and ev.evento == "MUDAR_PRAZO" and ev.alvo == "card"):
        return [f"o prazo do card mudou por {ev.rotulo}"]
    return []


# ----------------------------------------------------------------------------- 10f. regra 11 (todo toque tem destino)
@invariante("todo_toque_do_fundador_tem_destino")
def todo_toque_do_fundador_tem_destino(p):
    """Botão do fundador sobre algo que existe ou vira passagem, ou termina em reação, comentário no card, card novo
    ligado ou resposta guardada. Nunca é jogado fora em silêncio."""
    ev, a = p.evento, p.antes
    existe = ev.alvo == "card" or ev.alvo in a.etapas or (ev.alvo.startswith("acao:") and ev.alvo[5:] in a.acoes)
    if ev.papel == FUNDADOR and ev.evento in EVENTOS_DO_PAPEL[FUNDADOR] and existe:
        if not p.resposta.aceito and p.resposta.destino not in DESTINOS_DE_UM_TOQUE:
            return [f"{ev.rotulo} foi {p.resposta.destino}, sem destino"]
    return []


# ----------------------------------------------------------------------------- 10g. regra 12 (infraestrutura não gasta execução)
@invariante("infra_nao_gasta_execucao")
def infra_nao_gasta_execucao(p):
    """Falha de infraestrutura (cota, login, queda, banco, ferramenta, sem processo vivo) não conta como execução."""
    if p.evento.evento in EVENTOS_DE_INFRA and p.resposta.aceito:
        return [f"etapa {i} gastou execução ({p.antes.etapas[i].execucoes} -> {d.execucoes}) numa falha de infraestrutura"
                for i, d in p.depois.etapas.items() if d.execucoes > p.antes.etapas[i].execucoes]
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
