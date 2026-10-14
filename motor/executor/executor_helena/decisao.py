"""A decisão final de uma execução: terminou inteira? qual a falha? o texto vale como resposta?

Usada pelo executor real e pelo executor falso, para os dois decidirem IGUAL.

Regras:
  - terminou_inteira só se o Hermes disse completed=true, failed=false, saiu com código 0, ninguém o
    encerrou e o que ele imprimiu É a última mensagem do agente (veja uso.saida_e_a_resposta_do_agente);
  - o texto só é entregue se terminou inteira, passou na conferência e não tem falha (ou a falha é só de
    formato, porque o motor pode querer mostrar a resposta torta com o motivo);
  - segurança e integridade primeiro: problema de conferência de classe DESCONHECIDA vence a falha lida.
"""

from dataclasses import dataclass
from typing import Optional

from .falha import Evidencias, classificar_falha
from .tipos import (DESCONHECIDA, ENCERRADO_POR_CANCELAMENTO, FORMATO_ERRADO, Conferencia, Execucao, Falha)


@dataclass(frozen=True)
class Decisao:
    terminou_inteira: bool
    falha: Optional[Falha]
    texto: Optional[str]
    cancelada: bool


def terminou_inteira(ev: Evidencias) -> bool:
    uso = ev.uso
    return bool(ev.codigo_de_saida == 0 and ev.encerrado_por is None and ev.saida_e_resposta
                and isinstance(uso, dict) and uso.get("completed") is True and uso.get("failed") is False)


def _conferir_formato(execucao: Execucao, texto: str) -> Optional[Falha]:
    try:
        motivo = execucao.verificador_de_formato(texto)     # type: ignore[misc]
    except Exception as erro:                                # verificador quebrado não pode sumir
        return Falha(DESCONHECIDA, "VERIFICADOR_DE_FORMATO_FALHOU", type(erro).__name__)
    if motivo:
        return Falha(FORMATO_ERRADO, str(motivo)[:80], "a resposta não segue o formato combinado")
    return None


def _falha_final(falha: Optional[Falha], conferido: Conferencia) -> Optional[Falha]:
    graves = [p for p in conferido.problemas if p.classe == DESCONHECIDA]
    if graves:
        return Falha(DESCONHECIDA, graves[0].codigo, graves[0].detalhe)
    if falha is not None:
        return falha
    if conferido.problemas:
        primeiro = conferido.problemas[0]
        return Falha(primeiro.classe, primeiro.codigo, primeiro.detalhe)
    return None


def decidir(execucao: Execucao, ev: Evidencias, conferido: Conferencia, texto_impresso: Optional[str]) -> Decisao:
    cancelada = ev.encerrado_por == ENCERRADO_POR_CANCELAMENTO
    inteira = terminou_inteira(ev)
    falha = classificar_falha(ev)
    if falha is None and inteira and conferido.ok and execucao.verificador_de_formato is not None:
        falha = _conferir_formato(execucao, texto_impresso or "")
    falha = None if cancelada else _falha_final(falha, conferido)
    entrega_o_texto = inteira and conferido.ok and (falha is None or falha.classe == FORMATO_ERRADO)
    return Decisao(terminou_inteira=inteira, falha=falha, cancelada=cancelada,
                   texto=(texto_impresso or "").strip() if entrega_o_texto else None)
