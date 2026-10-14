"""Peças comuns dos testes: cenários escritos à mão, fotos para os testes das invariantes e contas de campanha.

Os cenários são listas de eventos. Só entram os eventos que alguém de fora manda; os que o motor dispara
sozinho (iniciar execução, plano válido, card pronto...) o alvo faz por conta própria.
"""
from simulador import Referencia, jogar
from simulador.eventos import Foto, FotoAcao, FotoEtapa, autor, fundador, helena, motor, relogio, revisor
from simulador.roteiro import ROTEIRO_UNICA

SEMENTES_PADRAO = range(1200)          # "1000+ sementes" do pedido


# ---------------------------------------------------------------------------- eventos curtos
def entrega(etapa, ator, acao_externa="NENHUMA", usou_internet="NAO", chave="atual"):
    return autor("ENTREGAR", etapa, ator, chave, parecer="OK", acao_externa=acao_externa, usou_internet=usou_internet)


def portao_ok(etapa, escolhido):
    return motor("PORTAO1_OK", etapa, escolhido=escolhido)


def falha_de_formato(etapa):
    return motor("FALHA", etapa, classe="FORMATO_ERRADO")


# ---------------------------------------------------------------------------- cenários (roteiro "unica": U1, autor CAIO)
# O pedido é pequeno (pedido_grande=False): a leitura da Helena já valida o plano e a etapa começa.
COMECO_UNICA = [helena("LER_DE_VOLTA")]
FELIZ_UNICA = COMECO_UNICA + [entrega("U1", "CAIO"), portao_ok("U1", "CLARA"), revisor("APROVAR", "U1", "CLARA")]
# U1 vai para o fundador revisar e ele nunca responde: lembretes em 24h e 48h e depois o padrão.
FUNDADOR_REVISA_E_NAO_RESPONDE = COMECO_UNICA + [
    entrega("U1", "CAIO"), portao_ok("U1", "FUNDADOR"),
    relogio("LEMBRETE_24H", "U1"), relogio("LEMBRETE_48H", "U1"), relogio("PRAZO_ESPERA_VENCIDO", "U1"),
]
# A entrega propõe uma ação de fora que o motor sabe fazer; o card fica pronto e a ação nasce como proposta (A1).
PROPOE_ACAO_DO_MOTOR = COMECO_UNICA + [
    entrega("U1", "CAIO", acao_externa="PELO_MOTOR"), portao_ok("U1", "CLARA"), revisor("APROVAR", "U1", "CLARA"),
]
PROPOE_ACAO_SO_DO_FUNDADOR = COMECO_UNICA + [
    entrega("U1", "CAIO", acao_externa="SO_FUNDADOR"), portao_ok("U1", "CLARA"), revisor("APROVAR", "U1", "CLARA"),
]
# O fundador dá o ok, o motor executa sozinho e a ação conclui.
ACAO_AUTORIZADA_E_CONCLUIDA = PROPOE_ACAO_DO_MOTOR + [fundador("APROVAR", "acao:A1"), motor("ACAO_CONCLUIDA", "acao:A1")]
# O fundador dá o ok, o motor executa e a ação falha.
ACAO_AUTORIZADA_E_FALHA = PROPOE_ACAO_DO_MOTOR + [fundador("APROVAR", "acao:A1"), motor("ACAO_FALHOU", "acao:A1")]
# O fundador esquece da ação: lembrete em 24h e o padrão (que expira, nunca executa).
ACAO_ESQUECIDA = PROPOE_ACAO_DO_MOTOR + [relogio("LEMBRETE_24H", "acao:A1"), relogio("PRAZO_ESPERA_VENCIDO", "acao:A1")]


def formato_errado_seguido(vezes):
    """A etapa U1 falha de formato 'vezes' vezes seguidas, sem ordem do fundador no meio."""
    return COMECO_UNICA + [falha_de_formato("U1")] * vezes


def ajustes_seguidos(vezes):
    """E1 (do roteiro 'prova') é aprovada e o fundador pede ajuste, 'vezes' vezes. E2 fica de fora, então o card não fecha."""
    eventos = [helena("LER_DE_VOLTA")]
    for _ in range(vezes):
        eventos += [entrega("E1", "CAIO"), portao_ok("E1", "CLARA"), revisor("APROVAR", "E1", "CLARA"),
                    fundador("PEDIR_AJUSTE", "E1", motivo_ajuste="TOM")]
    return eventos


# ---------------------------------------------------------------------------- cenários (roteiro "prova": E1, E2 -> EJ -> ER)
PROVA_E1_APROVADA = [
    helena("LER_DE_VOLTA"), entrega("E1", "CAIO"), portao_ok("E1", "CLARA"), revisor("APROVAR", "E1", "CLARA"),
]
# E2 (Isabela) e EJ (Clara, que julga E2) aprovadas: ER ainda não começou.
# Na máquina real o jurídico tem o fundador como segundo revisor: só o Aprovar dele faz o parecer valer. A referência
# não tem segundo revisor e recusa o último toque (vira comentário); no fim as duas mostram EJ aprovada.
PROVA_E2_E_EJ_APROVADAS = [
    helena("LER_DE_VOLTA"),
    entrega("E2", "ISABELA", usou_internet="SIM"), portao_ok("E2", "RAVI"), revisor("APROVAR", "E2", "RAVI"),
    entrega("EJ", "CLARA", usou_internet="SIM"), portao_ok("EJ", "HELENA"), revisor("APROVAR", "EJ", "HELENA"),
    fundador("APROVAR", "EJ"),
]
# E1 aprovada; E2 ainda trabalhando. Depois a decisão muda: o que usava a decisão tem que ser refeito.
DECISAO_MUDA_COM_E1_APROVADA = PROVA_E1_APROVADA + [fundador("PEDIR_AJUSTE", motivo_ajuste="ERRO_DE_FATO")]
# O fundador pede ajuste em E2 depois de EJ (que a julga) ter sido aprovada sobre ela.
AJUSTE_EM_E2_COM_EJ_APROVADA = PROVA_E2_E_EJ_APROVADAS + [fundador("PEDIR_AJUSTE", "E2", motivo_ajuste="TOM")]


# ---------------------------------------------------------------------------- rodar
def rodar_lista(eventos, roteiro=ROTEIRO_UNICA, alvo=None, pedido_grande=False):
    """Aplica o cenário escrito à mão. Alvo padrão: a implementação de referência."""
    return jogar(alvo if alvo is not None else Referencia(), roteiro, list(eventos), pedido_grande)


def nomes_violados(execucao):
    return sorted({v.invariante for v in execucao.violacoes})


# ---------------------------------------------------------------------------- fotos para os testes das invariantes
def donos():
    return Referencia.DONOS_E_PRAZOS


def etapa(id_="U1", estado="EXECUTANDO", **campos):
    return FotoEtapa(id_, estado, **campos)


def acao(id_="A1", estado="PROPOSTA", **campos):
    return FotoAcao(id_, estado, **campos)


def foto(card="EM_ANDAMENTO", etapas=(), acoes=(), donos_=None, **campos_do_card):
    cartao = {"estado": card, "motivo": "NENHUM", "ordens": 0, "perguntas": 0, "lembretes": 0, "nivel_prazo": 0,
              "mudancas_prazo": 0, "fim": "NENHUM"}
    cartao.update(campos_do_card)
    return Foto(cartao, {e.id: e for e in etapas}, {a.id: a for a in acoes}, donos_ if donos_ is not None else donos())
