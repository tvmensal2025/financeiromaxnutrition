"""O núcleo: roda todas as checagens e monta o relatório.

    from validador import validar
    relatorio = validar(resposta, contexto)      # resposta: texto JSON ou objeto; contexto: dict
    relatorio.aprovada, relatorio.recusas, relatorio.marcas, relatorio.para_dict()

Regra de segurança: se uma checagem quebrar por causa de uma entrega estranha, ela RECUSA (nunca aprova
sem conferir). Só um contexto malformado (erro de quem chama) levanta ErroDeContexto.
"""
import time

from . import checagens  # noqa: F401  (a importação registra as checagens)
from .contexto import ErroDeContexto
from .execucao import ACOES_LIBERADAS, Execucao
from .registro import CHECAGENS, CONFIG, gravidade_de
from .resultado import Falha, Relatorio, ResultadoDaChecagem


CHECAGENS_DO_TAMANHO = {"CHK-ACAO-01", "CHK-ACAO-02", "CHK-ACAO-03", "CHK-COMUM-01", "CHK-COMUM-02"}


def validar(resposta, contexto: dict) -> Relatorio:
    t0 = time.perf_counter()
    exe = Execucao(resposta, contexto)
    pode_seguir = exe.formato_ok and exe.acao in ACOES_LIBERADAS
    # Texto absurdamente grande: já será recusado pelo tamanho; não gastamos tempo nas checagens pesadas.
    enorme = sum(len(i.texto) for i in exe.itens) > CONFIG["tamanho"]["maximo_analisavel"]
    resultados = []
    for ch in (CHECAGENS[i] for i in sorted(CHECAGENS)):
        if (not pode_seguir and not ch.id.startswith("CHK-ACAO-")) or (enorme and ch.id not in CHECAGENS_DO_TAMANHO):
            falhas = None
        else:
            try:
                falhas = ch.funcao(exe)
            except ErroDeContexto:
                raise
            except Exception as erro:  # noqa: BLE001 - falha fechada: checagem que quebra recusa
                falhas = [Falha(ch.id, "ERRO_INTERNO_DA_CHECAGEM", "resposta",
                                f"A checagem não conseguiu ler esta entrega ({type(erro).__name__}). Por segurança, a entrega é recusada.", str(erro)[:120])]
        if falhas is None:
            status, falhas = "NAO_SE_APLICA", []
        else:
            for f in falhas:
                f.gravidade = gravidade_de(f.id, f.motivo)
            status = "FALHOU" if falhas else "PASSOU"
        resultados.append(ResultadoDaChecagem(ch.id, ch.nome, status, list(ch.fecha_furos), ch.o_que_fecha, falhas))
    todas = [f for r in resultados for f in r.falhas]
    if any(f.gravidade == "RECUSA" for f in todas):
        veredito = "RECUSADA"
    elif todas:
        veredito = "APROVADA_COM_MARCAS"
    else:
        veredito = "APROVADA"
    return Relatorio(veredito, resultados, exe.memoria.get("premissas", []), (time.perf_counter() - t0) * 1000)
