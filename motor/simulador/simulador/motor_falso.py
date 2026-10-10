"""O "motor de mentira": guarda a resposta de cada execução e traduz a fala bruta do agente em eventos.

É aqui que ficam as regras do plano v3 sobre o que o código faz com a resposta de um agente
("O agente: uma função com 5 ações" e "Falhas e esperas"). O alvo decide o que fazer com os eventos.
"""
from . import eventos as ev

LIMITE_DE_TAMANHO = 20_000       # acima disso a entrega é "grande demais"


class RegistroDeRespostas:
    """A resposta gravada de cada execução. Pedir a mesma chave de novo devolve a gravada:
    o agente NÃO é chamado outra vez (queda no meio: a resposta gravada é usada, sem gastar cota)."""

    def __init__(self):
        self._gravadas = {}

    def obter(self, chave, agente):
        if chave not in self._gravadas:
            self._gravadas[chave] = agente.responder(chave)
        return self._gravadas[chave]


def _sim_nao(valor):
    return "SIM" if valor else "NAO"


def traduzir(papel, etapa, ator, r):
    """Fala bruta (RespostaBruta) -> lista de eventos. papel: "AUTOR" ou "REVISOR"."""
    # --- falhas de infraestrutura: valem para os dois papéis
    if r.tipo == "SILENCIO":
        return [ev.relogio("TEMPO_ESGOTADO", etapa)]
    if r.tipo == "QUEDA":
        return [ev.vigia("SEM_EXECUCAO_VIVA", etapa)]
    if r.tipo in ("COTA", "LOGIN"):
        return [ev.motor("FALHA_INFRA", etapa, classe=r.tipo)]
    if papel == "REVISOR":
        if r.tipo == "APROVA":
            return [ev.revisor("APROVAR", etapa, ator)]
        if r.tipo == "REPROVA" and r.criterios:
            return [ev.revisor("REPROVAR", etapa, ator)]
        return [ev.motor("FALHA", etapa, classe="FORMATO_ERRADO")]     # reprovou sem citar critério, ou falou outra coisa
    # --- autor
    internet = _sim_nao(r.usou_internet)
    if r.tipo == "ENTREGA":
        if r.tamanho > LIMITE_DE_TAMANHO:
            return [ev.motor("FALHA", etapa, classe="GRANDE_DEMAIS")]
        return [ev.autor("ENTREGAR", etapa, ator, parecer="OK", acao_externa=r.acao_externa, usou_internet=internet)]
    if r.tipo == "PERGUNTA":
        return [ev.autor("PERGUNTAR", etapa, ator, usou_internet=internet)]
    if r.tipo == "DEVOLVER":
        return [ev.autor("DEVOLVER_A_QUEM_PEDIU", etapa, ator, usou_internet=internet)]
    if r.tipo == "FALHA":
        return [ev.autor("REGISTRAR_FALHA", etapa, ator, motivo_falha=r.motivo_falha or "NAO_CONSIGO", usou_internet=internet)]
    return [ev.motor("FALHA", etapa, classe="FORMATO_ERRADO")]         # sem ação, duas ações ou resposta de outro papel


def so_de_agente(eventos):
    """Eventos que um agente de verdade escreveria (os únicos que podem chegar atrasados com chave antiga)."""
    return [e for e in eventos if e.papel in ("AUTOR", "REVISOR")]
