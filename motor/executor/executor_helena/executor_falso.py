"""EXECUTOR FALSO: cumpre o contrato Executor sem o Hermes e sem processo nenhum.

Usado pelo simulador da esteira e pelos testes do motor. Cada execução segue um `Roteiro` que diz o que
"aconteceu" (resposta boa, cota, login, queda, laço, tempo...). O falso NÃO decide a classe da falha
sozinho: ele monta os mesmos registros que o Hermes deixaria (as mesmas Evidencias) e passa pelo MESMO
leitor de falha e pela MESMA decisão final do executor real. Assim o simulador exercita o código de verdade.

    falso = ExecutorFalso([Roteiro(Simulacao.ERRO_429), Roteiro(Simulacao.BOA)])   # 1ª cota, depois boa
    falso.rodar(execucao).falha.classe        # "COTA"
    falso.execucoes                           # as execuções recebidas, na ordem
"""

import threading
import time
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Sequence, Union

from .conferencia import conferir_ferramentas, conferir_modelo_e_provedor
from .decisao import decidir
from .executor import Executor
from .falha import Evidencias
from .provedor_falso import TEXTO_FORMATO_ERRADO, TEXTO_PADRAO, Simulacao
from .tipos import (ENCERRADO_POR_CANCELAMENTO, ENCERRADO_POR_LIMITE, ENCERRADO_POR_TEMPO, Conferencia, Execucao,
                    Resultado)
from .uso import ErroDoProvedor, Sessao, ferramentas_listadas, montar_registro_de_uso


@dataclass(frozen=True)
class Roteiro:
    simulacao: Simulacao = Simulacao.BOA
    texto: str = TEXTO_PADRAO
    atraso_s: float = 0.0                     # quanto a "execução" demora (respeita tempo máximo e cancelamento)
    voltar_em_s: Optional[int] = None         # ERRO_429: quando a cota volta
    modelo: Optional[str] = None              # simula troca escondida de modelo (a conferência tem de pegar)
    provedor: Optional[str] = None
    ferramentas_servidas: Optional[Sequence[str]] = None   # o que o servidor listou (None = a lista da ficha)
    sem_listar_ferramentas: bool = False      # o Hermes nem chegou a pedir a lista (ferramenta ausente)


# O erro que o Hermes gravaria no request_dump para cada simulação de erro do provedor.
_ERROS = {
    Simulacao.ERRO_429: ErroDoProvedor("max_retries_exhausted", 429, "usage_limit_reached", "rate_limit_exceeded", None),
    Simulacao.LOGIN_RECUSADO: ErroDoProvedor("non_retryable_client_error", 401, "invalid_request_error", "token_expired", None),
    Simulacao.ERRO_500: ErroDoProvedor("max_retries_exhausted", 503, "server_error", None, None),
    Simulacao.RESPOSTA_INVALIDA: ErroDoProvedor("max_retries_exhausted", None, "EmptyStreamError", None, None),
    Simulacao.ERRO_ESTRANHO: ErroDoProvedor("non_retryable_client_error", 418, "teapot_error", None, None),
}
_TERMINAM_INTEIRAS = (Simulacao.BOA, Simulacao.FORMATO_ERRADO, Simulacao.RESPOSTA_VAZIA, Simulacao.LENTA)


def _sessao(modelo: str, texto: str, *, vazia: bool = False, fim: str = "stop", com_resposta: bool = True) -> Sessao:
    return Sessao(id="falsa", fim="agent_close", chamadas_ao_modelo=1, max_iteracoes=90, resultados_de_ferramenta=0,
                  chamadas_invalidas=0, houve_resposta_do_assistente=com_resposta,
                  ultima_do_assistente="(empty)" if vazia else texto, ultima_tem_chamada_de_ferramenta=False,
                  ultimo_finish_reason=fim, modelo=modelo, prompt_de_sistema=None)


class ExecutorFalso(Executor):
    def __init__(self, roteiros: Union[Roteiro, Sequence[Roteiro], Callable[[Execucao], Roteiro]] = Roteiro()):
        self._roteiros = [roteiros] if isinstance(roteiros, Roteiro) else roteiros
        self._posicao = 0
        self._trava = threading.Lock()
        self._cancelamentos: Dict[str, threading.Event] = {}
        self.execucoes: List[Execucao] = []

    def _proximo(self, execucao: Execucao) -> Roteiro:
        if callable(self._roteiros):
            return self._roteiros(execucao)
        with self._trava:
            roteiro = self._roteiros[min(self._posicao, len(self._roteiros) - 1)]
            self._posicao += 1
        return roteiro

    def cancelar(self, id_da_execucao: str) -> bool:
        with self._trava:
            evento = self._cancelamentos.get(id_da_execucao)
        if evento is None:
            return False
        evento.set()
        return True

    def rodar(self, execucao: Execucao) -> Resultado:
        roteiro = self._proximo(execucao)
        evento = threading.Event()
        with self._trava:
            self._cancelamentos[execucao.id] = evento
            self.execucoes.append(execucao)
        comeco = time.monotonic()
        demora = roteiro.atraso_s
        try:
            cancelada = evento.wait(min(demora, execucao.tempo_efetivo_s)) if demora else evento.is_set()
        finally:
            with self._trava:
                self._cancelamentos.pop(execucao.id, None)
        if cancelada:
            encerrado_por = ENCERRADO_POR_CANCELAMENTO
        elif roteiro.simulacao is Simulacao.LACO_DE_FERRAMENTA:
            encerrado_por = ENCERRADO_POR_LIMITE
        elif demora >= execucao.tempo_efetivo_s:
            encerrado_por = ENCERRADO_POR_TEMPO
        else:
            encerrado_por = None
        return self._montar(execucao, roteiro, encerrado_por, time.monotonic() - comeco)

    def _montar(self, execucao: Execucao, roteiro: Roteiro, encerrado_por: Optional[str], duracao: float) -> Resultado:
        ficha, sim = execucao.ficha, roteiro.simulacao
        livre = encerrado_por is None                       # ninguém encerrou: valem os fatos da simulação
        completa = livre and sim in _TERMINAM_INTEIRAS
        erro = _ERROS.get(sim) if livre else None
        if erro is not None and sim is Simulacao.ERRO_429 and roteiro.voltar_em_s is not None:
            erro = ErroDoProvedor(erro.motivo_do_dump, 429, erro.tipo, erro.codigo, roteiro.voltar_em_s)
        contexto_grande = livre and sim is Simulacao.CONTEXTO_GRANDE
        falhou = erro is not None or contexto_grande
        queda = livre and sim is Simulacao.QUEDA_NO_MEIO
        cortada = livre and sim is Simulacao.SAIDA_CORTADA
        modelo, provedor = roteiro.modelo or ficha.modelo, roteiro.provedor or ficha.provedor
        uso = {"completed": completa, "failed": falhou, "api_calls": 1,
               "model": modelo if completa else None, "provider": provedor if completa else None}
        servidas = ficha.ferramentas if roteiro.ferramentas_servidas is None else roteiro.ferramentas_servidas
        servidor = {"listou_ferramentas": not roteiro.sem_listar_ferramentas, "ferramentas": list(servidas), "encerrada": False,
                    "motivo_encerramento": None, "contadores": {"total": 0}, "usou_internet": False}
        texto_do_roteiro = TEXTO_FORMATO_ERRADO if sim is Simulacao.FORMATO_ERRADO and roteiro.texto == TEXTO_PADRAO else roteiro.texto
        texto = texto_do_roteiro if (completa and sim is not Simulacao.RESPOSTA_VAZIA) or cortada else ""
        sessao = _sessao(ficha.modelo, texto, vazia=livre and sim is Simulacao.RESPOSTA_VAZIA,
                         fim="length" if cortada else "stop", com_resposta=not (falhou or queda))
        evidencias = Evidencias(
            codigo_de_saida=-15 if encerrado_por else (2 if queda else 0), encerrado_por=encerrado_por, uso=uso,
            erro_do_provedor=erro, sessao=sessao, servidor=servidor, saida_vazia=not texto and not falhou,
            saida_e_resposta=completa and sim is not Simulacao.RESPOSTA_VAZIA, max_de_chamadas_vistas=99,
            frase_do_hermes="CONTEXTO_GRANDE" if contexto_grande else None)
        problemas = conferir_ferramentas(ficha.ferramentas, servidor) \
            + conferir_modelo_e_provedor(ficha.modelo, ficha.provedor, uso, sessao)
        conferido = Conferencia(problemas=tuple(problemas))
        decisao = decidir(execucao, evidencias, conferido, texto if completa else None)
        return Resultado(
            texto=decisao.texto, terminou_inteira=decisao.terminou_inteira,
            uso=montar_registro_de_uso(uso, servidor), codigo_de_saida=evidencias.codigo_de_saida,
            ferramentas_recebidas=ferramentas_listadas(servidor), modelo_usado=uso["model"], provedor_usado=uso["provider"],
            tempo_s=duracao, falha=decisao.falha, conferencia=conferido, cancelada=decisao.cancelada,
            encerrado_por=encerrado_por, tempo_para_encerrar_s=0.0 if encerrado_por else None, sobras=())
