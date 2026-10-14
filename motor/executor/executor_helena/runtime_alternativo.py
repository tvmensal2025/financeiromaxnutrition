"""Um SEGUNDO runtime de agente, só para teste, bem diferente do Hermes.

O que é: prova de que o motor e as regras de decisão não dependem do Hermes. Este runtime:
  - roda um processo comum (python -c) em vez do `hermes -z`;
  - usa um registro próprio (registro.json) em vez do uso.json, do state.db e do request_dump do Hermes;
  - não tem servidor de ferramentas, perfil, SOUL.md nem login.
Mesmo assim ele cumpre o contrato Executor: traduz o registro nativo em `Evidencias` e deixa as MESMAS regras
(decisao.decidir, conferencia.conferir_*) classificarem a execução. Um adaptador real (EVE, OpenClaw...) faz igual.

Nunca entra em produção: não está em registro.APROVADOS (um teste confere). Mora no pacote, como o executor_falso,
para que os testes do executor E os do orquestrador usem o mesmo runtime de prova.
"""

import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path
from typing import Callable, Dict, List, Optional, Union

from .conferencia import conferir_ferramentas, conferir_modelo_e_provedor
from .decisao import decidir
from .executor import Executor
from .falha import Evidencias
from .provedor_falso import TEXTO_FORMATO_ERRADO, TEXTO_PADRAO, Simulacao
from .tipos import (DESCONHECIDA, ENCERRADO_POR_CANCELAMENTO, ENCERRADO_POR_TEMPO, Capacidades,
                                   Conferencia, Execucao, Falha, Problema, Resultado)
from .uso import ErroDoProvedor, Sessao, ferramentas_listadas, montar_registro_de_uso

# Simulações que este runtime sabe produzir. As específicas do Hermes (laço de ferramenta, contexto grande...) não existem aqui.
SUPORTADAS = (Simulacao.BOA, Simulacao.FORMATO_ERRADO, Simulacao.RESPOSTA_VAZIA, Simulacao.LENTA,
              Simulacao.QUEDA_NO_MEIO, Simulacao.ERRO_429)

_SCRIPT = r'''
import json, os, sys, time
modo, modelo, provedor, ferramentas = sys.argv[1], sys.argv[2], sys.argv[3], json.loads(sys.argv[4])
texto = open("texto_programado.txt").read()
sys.stdin.read()
def gravar(**campos):
    base = {"concluiu": False, "falhou": False, "modelo": None, "provedor": None, "ferramentas_listadas": ferramentas,
            "erro_http": None, "voltar_em_s": None}
    base.update(campos)
    with open("registro.json", "w") as arquivo:
        arquivo.write(json.dumps(base))
if modo in ("boa", "formato_errado"):
    open("saida.txt", "w").write(texto)
    gravar(concluiu=True, modelo=modelo, provedor=provedor)
elif modo == "vazia":
    open("saida.txt", "w").write("")
    gravar(concluiu=True, modelo=modelo, provedor=provedor)
elif modo == "lenta":
    gravar()
    time.sleep(120)
elif modo == "queda":
    gravar()
    os._exit(2)
elif modo == "cota":
    gravar(falhou=True, erro_http=429, voltar_em_s=3600)
    sys.exit(75)
'''

_MODO = {Simulacao.BOA: "boa", Simulacao.FORMATO_ERRADO: "formato_errado", Simulacao.RESPOSTA_VAZIA: "vazia",
         Simulacao.LENTA: "lenta", Simulacao.QUEDA_NO_MEIO: "queda", Simulacao.ERRO_429: "cota"}


class RuntimeAlternativoDeTeste(Executor):
    capacidades = Capacidades(
        nome="processo-simples", cancela_em_ate_s=15.0, ferramentas_por_extenso=True, confere_modelo_e_provedor=True,
        sem_reserva_escondida=True, limita_chamadas=True, falha_vem_do_registro=True, guarda_conversa=True)

    def __init__(self, raiz: Path, simulacao: Simulacao = Simulacao.BOA,
                 texto: Union[None, str, Callable[[Execucao], str]] = None):
        """`texto`: a resposta do agente (um texto, ou uma função da execução). Padrão: o texto de teste."""
        self.raiz = Path(raiz)
        self.simulacao = simulacao
        self._texto = texto
        self.execucoes: List[Execucao] = []
        self._trava = threading.Lock()
        self._cancelamentos: Dict[str, threading.Event] = {}

    # --- contrato ---------------------------------------------------------------------------------
    def cancelar(self, id_da_execucao: str) -> bool:
        with self._trava:
            evento = self._cancelamentos.get(id_da_execucao)
        if evento is None:
            return False
        evento.set()
        return True

    def limpar(self, resultado: Resultado) -> None:
        if resultado.pasta is None:
            return
        pasta = Path(resultado.pasta)
        if self.raiz in pasta.parents and pasta.exists():
            shutil.rmtree(pasta, ignore_errors=True)

    def rodar(self, execucao: Execucao) -> Resultado:
        if self.simulacao not in SUPORTADAS:
            raise ValueError(f"o runtime alternativo não simula {self.simulacao}")
        self.raiz.mkdir(parents=True, exist_ok=True)
        pasta = Path(tempfile.mkdtemp(prefix=f"{execucao.id}-", dir=self.raiz))
        ficha = execucao.ficha
        if self.simulacao is Simulacao.FORMATO_ERRADO:
            texto = TEXTO_FORMATO_ERRADO
        else:
            texto = self._texto(execucao) if callable(self._texto) else (self._texto or TEXTO_PADRAO)
        (pasta / "texto_programado.txt").write_text(texto, encoding="utf-8")
        comando = (sys.executable, "-c", _SCRIPT, _MODO[self.simulacao], ficha.modelo, ficha.provedor,
                   json.dumps(list(ficha.ferramentas)))
        with self._trava:
            self.execucoes.append(execucao)
        cancelamento = threading.Event()
        with self._trava:
            self._cancelamentos[execucao.id] = cancelamento
        comeco = time.monotonic()
        encerrado_por, tempo_para_encerrar = None, None
        try:
            try:
                processo = subprocess.Popen(comando, cwd=pasta, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
                                            stderr=subprocess.DEVNULL, env={"PATH": os.environ.get("PATH", "")},
                                            start_new_session=True)
            except OSError as erro:
                return self._sem_processo(pasta, str(erro))
            processo.stdin.write(execucao.pacote.encode())
            processo.stdin.close()
            while processo.poll() is None:
                if cancelamento.is_set():
                    encerrado_por = ENCERRADO_POR_CANCELAMENTO
                elif time.monotonic() - comeco >= execucao.tempo_efetivo_s:
                    encerrado_por = ENCERRADO_POR_TEMPO
                if encerrado_por:
                    inicio = time.monotonic()
                    self._matar_o_grupo(processo)
                    tempo_para_encerrar = time.monotonic() - inicio
                    break
                time.sleep(0.05)
            codigo = processo.wait()
        finally:
            with self._trava:
                self._cancelamentos.pop(execucao.id, None)
        return self._avaliar(execucao, pasta, comando, codigo, encerrado_por, tempo_para_encerrar,
                             time.monotonic() - comeco, processo.pid)

    # --- tradução do registro NATIVO para as Evidencias do núcleo ---------------------------------
    def _avaliar(self, execucao, pasta, comando, codigo, encerrado_por, tempo_para_encerrar, duracao, pid) -> Resultado:
        ficha = execucao.ficha
        registro = self._ler_json(pasta / "registro.json") or {}
        impresso = (pasta / "saida.txt").read_text() if (pasta / "saida.txt").exists() else ""
        concluiu = registro.get("concluiu") is True and encerrado_por is None
        erro = None
        if registro.get("erro_http") and encerrado_por is None:
            erro = ErroDoProvedor("registro_nativo", int(registro["erro_http"]), None, None, registro.get("voltar_em_s"))
        uso = {"completed": concluiu, "failed": registro.get("falhou") is True and encerrado_por is None,
               "api_calls": 1, "model": registro.get("modelo") if concluiu else None,
               "provider": registro.get("provedor") if concluiu else None}
        servidor = {"listou_ferramentas": True, "ferramentas": list(registro.get("ferramentas_listadas", [])),
                    "encerrada": False, "motivo_encerramento": None, "contadores": {"total": 0}, "usou_internet": False}
        sessao = Sessao(id="alternativa", fim="agent_close", chamadas_ao_modelo=1, max_iteracoes=None,
                        resultados_de_ferramenta=0, chamadas_invalidas=0,
                        houve_resposta_do_assistente=concluiu,
                        ultima_do_assistente=impresso if impresso.strip() else "(empty)",
                        ultima_tem_chamada_de_ferramenta=False, ultimo_finish_reason="stop", modelo=ficha.modelo,
                        prompt_de_sistema=None)
        evidencias = Evidencias(
            codigo_de_saida=codigo, encerrado_por=encerrado_por, uso=uso, erro_do_provedor=erro, sessao=sessao,
            servidor=servidor, saida_vazia=not impresso.strip() and erro is None,
            saida_e_resposta=concluiu and bool(impresso.strip()), max_de_chamadas_vistas=99)
        problemas = conferir_ferramentas(ficha.ferramentas, servidor) \
            + conferir_modelo_e_provedor(ficha.modelo, ficha.provedor, uso, sessao)
        conferido = Conferencia(problemas=tuple(problemas))
        decisao = decidir(execucao, evidencias, conferido, impresso if concluiu else None)
        sobras = self._sobras(pid)
        return Resultado(
            texto=decisao.texto, terminou_inteira=decisao.terminou_inteira, uso=montar_registro_de_uso(uso, servidor),
            codigo_de_saida=codigo, ferramentas_recebidas=ferramentas_listadas(servidor),
            modelo_usado=uso["model"], provedor_usado=uso["provider"], tempo_s=duracao, falha=decisao.falha,
            conferencia=conferido, cancelada=decisao.cancelada, encerrado_por=encerrado_por,
            tempo_para_encerrar_s=tempo_para_encerrar, sobras=sobras, pasta=pasta,
            comando=(comando[0], "-c", "<script>", comando[3]))

    def _sem_processo(self, pasta: Path, detalhe: str) -> Resultado:
        problema = Problema(DESCONHECIDA, "RUNTIME_NAO_LANCOU", detalhe)
        return Resultado(texto=None, terminou_inteira=False, uso=montar_registro_de_uso(None, None), codigo_de_saida=None,
                         ferramentas_recebidas=(), modelo_usado=None, provedor_usado=None, tempo_s=0.0,
                         falha=Falha(DESCONHECIDA, problema.codigo, problema.detalhe), conferencia=Conferencia((problema,)),
                         pasta=pasta)

    @staticmethod
    def _ler_json(caminho: Path) -> Optional[dict]:
        try:
            dados = json.loads(caminho.read_text())
        except (OSError, ValueError):
            return None
        return dados if isinstance(dados, dict) else None

    @staticmethod
    def _matar_o_grupo(processo: subprocess.Popen) -> None:
        for sinal in (signal.SIGTERM, signal.SIGKILL):
            try:
                os.killpg(processo.pid, sinal)
            except ProcessLookupError:
                return
            try:
                processo.wait(timeout=0.5 if sinal is signal.SIGTERM else 5)
                return
            except subprocess.TimeoutExpired:
                continue

    @staticmethod
    def _sobras(pid: int) -> tuple:
        try:
            os.killpg(pid, 0)
        except ProcessLookupError:
            return ()
        except PermissionError:
            return ()
        return (pid,)
