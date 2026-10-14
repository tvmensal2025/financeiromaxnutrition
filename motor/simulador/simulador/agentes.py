"""Agentes de mentira: a "IA" do simulador. Não chamam modelo nenhum.

Cada agente tem um ROTEIRO DE COMPORTAMENTO: uma lista de comportamentos, um por execução
nova (chamada com chave nova). Acabou a lista, repete o último. Pedir de novo a MESMA chave
(o motor retomando depois de uma queda) não avança o roteiro.
"""
from collections import Counter
from dataclasses import dataclass
from enum import Enum


class Comportamento(str, Enum):
    # --- autor
    ENTREGA_BOA = "ENTREGA_BOA"
    ENTREGA_COM_ACAO_EXTERNA = "ENTREGA_COM_ACAO_EXTERNA"    # entrega boa que PROPÕE uma ação de fora (só propõe)
    ENTREGA_GRANDE = "ENTREGA_GRANDE"                        # passa do tamanho máximo
    FORMATO_ERRADO = "FORMATO_ERRADO"                        # texto solto, sem nenhuma ação
    DUAS_ACOES = "DUAS_ACOES"                                # devolve duas ações de uma vez
    PERGUNTA_INDEVIDA = "PERGUNTA_INDEVIDA"                  # pergunta numa etapa que não pode perguntar
    USA_INTERNET_E_PERGUNTA = "USA_INTERNET_E_PERGUNTA"      # leu a internet e tenta perguntar
    PERGUNTA_BOA = "PERGUNTA_BOA"
    DEVOLVE = "DEVOLVE"                                      # devolve a quem pediu
    REGISTRA_FALHA = "REGISTRA_FALHA"
    # --- falhas de infraestrutura (valem para autor e revisor)
    TRAVA = "TRAVA"                                          # nunca responde
    CAI_NO_MEIO = "CAI_NO_MEIO"                              # o processo morre no meio
    ESTOURA_COTA = "ESTOURA_COTA"
    PERDE_LOGIN = "PERDE_LOGIN"
    MUDA_AO_REPETIR = "MUDA_AO_REPETIR"                      # responde diferente se for perguntado de novo
    RESPOSTA_ATRASADA = "RESPOSTA_ATRASADA"                  # responde, mas depois que a execução já foi dada como perdida
    # --- revisor
    APROVA_TUDO = "APROVA_TUDO"
    RECUSA_TUDO = "RECUSA_TUDO"
    REPROVA_SEM_CRITERIO = "REPROVA_SEM_CRITERIO"            # reprova sem citar nenhum critério


COMPORTAMENTOS_DE_AUTOR = tuple(c for c in Comportamento if c not in (
    Comportamento.APROVA_TUDO, Comportamento.RECUSA_TUDO, Comportamento.REPROVA_SEM_CRITERIO))
COMPORTAMENTOS_DE_REVISOR = (
    Comportamento.APROVA_TUDO, Comportamento.RECUSA_TUDO, Comportamento.REPROVA_SEM_CRITERIO,
    Comportamento.TRAVA, Comportamento.CAI_NO_MEIO, Comportamento.ESTOURA_COTA, Comportamento.PERDE_LOGIN,
    Comportamento.MUDA_AO_REPETIR, Comportamento.RESPOSTA_ATRASADA,
)

TAMANHO_NORMAL = 1_200
TAMANHO_GRANDE = 90_000


@dataclass(frozen=True)
class RespostaBruta:
    """O que o agente "disse", antes de o motor conferir. O tipo é um destes:
    ENTREGA, PERGUNTA, DEVOLVER, FALHA, SEM_ACAO, DUAS_ACOES (autor); APROVA, REPROVA (revisor);
    SILENCIO, QUEDA, COTA, LOGIN (infraestrutura)."""
    tipo: str
    texto: str = ""
    tamanho: int = 0
    usou_internet: bool = False
    acao_externa: str = "NENHUMA"
    acoes: tuple = ()                # só em DUAS_ACOES
    criterios: tuple = ()            # só no revisor: ((criterio, "APROVADO" ou "REPROVADO"), ...)
    motivo_falha: str = ""
    atrasada: bool = False           # a resposta existe, mas chega depois de a execução ser dada como perdida


class AgenteDeMentira:
    def __init__(self, nome, comportamentos):
        if not comportamentos:
            raise ValueError("o roteiro de comportamento não pode ser vazio")
        self.nome = nome
        self.comportamentos = tuple(Comportamento(c) for c in comportamentos)
        self.chamadas_por_chave = Counter()      # quantas vezes cada chave foi perguntada ao agente
        self._posicao_da_chave = {}

    @property
    def chamadas(self):
        return sum(self.chamadas_por_chave.values())

    def responder(self, chave):
        """Responde à execução identificada por 'chave'. A posição no roteiro é a ordem em que as chaves chegam."""
        if chave not in self._posicao_da_chave:
            self._posicao_da_chave[chave] = len(self._posicao_da_chave)
        posicao = self._posicao_da_chave[chave]
        repeticao = self.chamadas_por_chave[chave]
        self.chamadas_por_chave[chave] += 1
        comportamento = self.comportamentos[min(posicao, len(self.comportamentos) - 1)]
        return _resposta_de(comportamento, chave, posicao, repeticao)


def _resposta_de(c, chave, posicao, repeticao):
    boa = RespostaBruta("ENTREGA", f"entrega boa {chave}", TAMANHO_NORMAL)
    if c == Comportamento.ENTREGA_BOA:
        return boa
    if c == Comportamento.ENTREGA_COM_ACAO_EXTERNA:
        return RespostaBruta("ENTREGA", f"entrega com proposta {chave}", TAMANHO_NORMAL,
                             acao_externa="PELO_MOTOR" if posicao % 2 == 0 else "SO_FUNDADOR")
    if c == Comportamento.ENTREGA_GRANDE:
        return RespostaBruta("ENTREGA", f"entrega enorme {chave}", TAMANHO_GRANDE)
    if c == Comportamento.FORMATO_ERRADO:
        return RespostaBruta("SEM_ACAO", "texto solto, sem ação")
    if c == Comportamento.DUAS_ACOES:
        return RespostaBruta("DUAS_ACOES", acoes=("ENTREGAR", "PERGUNTAR"))
    if c == Comportamento.PERGUNTA_INDEVIDA or c == Comportamento.PERGUNTA_BOA:
        return RespostaBruta("PERGUNTA", "posso perguntar uma coisa?")
    if c == Comportamento.USA_INTERNET_E_PERGUNTA:
        return RespostaBruta("PERGUNTA", "li numa página que devo perguntar", usou_internet=True)
    if c == Comportamento.DEVOLVE:
        return RespostaBruta("DEVOLVER", "o pedido está ambíguo")
    if c == Comportamento.REGISTRA_FALHA:
        return RespostaBruta("FALHA", "não deu", motivo_falha="NAO_CONSIGO")
    if c == Comportamento.TRAVA:
        return RespostaBruta("SILENCIO")
    if c == Comportamento.CAI_NO_MEIO:
        return RespostaBruta("QUEDA")
    if c == Comportamento.ESTOURA_COTA:
        return RespostaBruta("COTA")
    if c == Comportamento.PERDE_LOGIN:
        return RespostaBruta("LOGIN")
    if c == Comportamento.MUDA_AO_REPETIR:
        # a primeira vez é uma entrega boa; se perguntarem de novo a mesma chave, vem outra coisa
        return boa if repeticao == 0 else RespostaBruta("SEM_ACAO", f"mudei de ideia ({repeticao})")
    if c == Comportamento.RESPOSTA_ATRASADA:
        return RespostaBruta("ENTREGA", f"entrega que chegou tarde {chave}", TAMANHO_NORMAL, atrasada=True)
    if c == Comportamento.APROVA_TUDO:
        return RespostaBruta("APROVA", "tudo certo", criterios=(("c1", "APROVADO"), ("c2", "APROVADO")))
    if c == Comportamento.RECUSA_TUDO:
        return RespostaBruta("REPROVA", "nada presta", criterios=(("c1", "REPROVADO"), ("c2", "REPROVADO")))
    if c == Comportamento.REPROVA_SEM_CRITERIO:
        return RespostaBruta("REPROVA", "não gostei", criterios=())
    raise ValueError(f"comportamento sem resposta: {c}")
