"""Portão 1, parte A: a RESPOSTA como um todo — uma ação só, permitida, e coerente com o uso da internet."""
from ..execucao import ACOES_LIBERADAS
from ..registro import checagem
from ..resultado import Falha

ID1, ID2, ID3 = "CHK-ACAO-01", "CHK-ACAO-02", "CHK-ACAO-03"


@checagem(ID1, "Exatamente uma ação, no formato",
          "Resposta sem ação, com duas ações ou fora do formato era aceita e andava pelo processo (formato errado: 1 nova tentativa).",
          ["K-13", "A-17"])
def uma_acao_no_formato(exe):
    return [Falha(ID1, motivo, "resposta", msg, trecho) for motivo, msg, trecho in exe.erros_de_formato]


@checagem(ID2, "Ação permitida ao serviço",
          "Um agente podia devolver PEDIR_SUBCARD (desligado até a fase 4) ou uma ação que o serviço dele não libera.",
          ["K-13", "A-17", "MAQ-08"])
def acao_permitida(exe):
    if not exe.formato_ok:
        return None
    if exe.acao == "PEDIR_SUBCARD":
        return [Falha(ID2, "ACAO_DESLIGADA", "resposta.acao", "PEDIR_SUBCARD está desligado até a fase 4. Conta como formato errado.", exe.acao)]
    if exe.acao not in ACOES_LIBERADAS:
        return [Falha(ID2, "ACAO_DESCONHECIDA", "resposta.acao", f"A ação '{exe.acao}' não existe. As ações são: {', '.join(ACOES_LIBERADAS)}.", str(exe.acao))]
    permitidas = exe.modelo.get("acoes_permitidas")
    if permitidas is not None and exe.acao not in permitidas:
        return [Falha(ID2, "ACAO_FORA_DO_SERVICO", "resposta.acao",
                      f"O serviço só libera estas ações: {', '.join(permitidas)}. Veio {exe.acao}.", exe.acao)]
    return []


@checagem(ID3, "Quem leu a internet só entrega ou registra falha",
          "Um texto plantado num site podia virar pergunta para o fundador ou devolução de pedido.",
          ["C-7"])
def quem_leu_internet_so_entrega(exe):
    if not exe.formato_ok or exe.acao not in ACOES_LIBERADAS:
        return None
    if exe.usou_internet and exe.acao in ("PERGUNTAR", "DEVOLVER_A_QUEM_PEDIU"):
        return [Falha(ID3, "ACAO_APOS_LER_A_INTERNET", "resposta.acao",
                      f"Depois de ler a internet só se pode ENTREGAR ou REGISTRAR_FALHA. Veio {exe.acao}.", exe.acao)]
    return []
