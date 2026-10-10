"""Ambiente de cenário: servidor falso de provedor + pastas + executor, com o Hermes de mentira OU o real.

Os mesmos cenários (testes/cenarios.py) rodam nos dois: na suíte normal com o Hermes de mentira, e em
verificacao_real/ com o hermes-agent de verdade. Aqui fica só a montagem.
"""

import os
import shutil
import sys
import threading
import time
from pathlib import Path
from typing import Callable, Dict, List, Optional, Sequence

from executor_helena import arvore
from executor_helena.executor import ExecutorHermes
from executor_helena.ficha import ler_ficha
from executor_helena.perfil import ConfigDoExecutor, Perfil
from executor_helena.provedor_falso import Cenario, Simulacao, ServidorDeProvedorFalso
from executor_helena.tipos import Execucao, FichaDoServico, Resultado

RAIZ = Path(__file__).resolve().parents[2]
FIXTURES = RAIZ / "testes" / "fixtures"
HERMES_FALSO = RAIZ / "executor_helena" / "hermes_falso.py"
SERVIDOR_DE_TESTE = RAIZ / "testes" / "apoio" / "servidor_de_ferramentas_de_teste.py"
PASTA_DAS_FERRAMENTAS = RAIZ.parent / "ferramentas"
PACOTE_PADRAO = "Pacote de teste: faça o trabalho e responda com uma ação."


def comando_do_hermes_falso() -> Sequence[str]:
    return (sys.executable, str(HERMES_FALSO))


def ambiente_do_processo(pid: int) -> Dict[str, str]:
    """O ambiente REAL de um processo vivo (lido do /proc), para provar o que ele enxerga."""
    with open(f"/proc/{pid}/environ", "rb") as arquivo:
        itens = [i for i in arquivo.read().split(b"\0") if b"=" in i]
    return {i.split(b"=", 1)[0].decode(): i.split(b"=", 1)[1].decode("utf-8", "replace") for i in itens}


def processos_com_marca(id_execucao: str) -> List[int]:
    """Quem ainda carrega a marca da execução no ambiente (leitura própria do /proc, sem usar o código testado)."""
    procurado = f"HELENA_EXECUCAO={id_execucao}".encode()
    achados = []
    for nome in os.listdir("/proc"):
        if not nome.isdigit():
            continue
        try:
            with open(f"/proc/{nome}/stat", "rb") as arquivo:
                if arquivo.read().rsplit(b")", 1)[1].split()[0] in (b"Z", b"X"):
                    continue
            with open(f"/proc/{nome}/environ", "rb") as arquivo:
                if procurado in arquivo.read().split(b"\0"):
                    achados.append(int(nome))
        except (OSError, IndexError):
            continue
    return achados


class EmAndamento:
    """Uma execução rodando em segundo plano, para provar o que acontece DURANTE ela."""

    def __init__(self, executor: ExecutorHermes, execucao: Execucao, perfil: Perfil, provedor: ServidorDeProvedorFalso):
        self.executor, self.execucao, self.perfil, self.provedor = executor, execucao, perfil, provedor
        self._resultado: Optional[Resultado] = None
        self._erro: Optional[BaseException] = None
        self.comecou_em = time.monotonic()
        self._thread = threading.Thread(target=self._rodar, daemon=True)
        self._thread.start()

    def _rodar(self):
        try:
            self._resultado = self.executor.rodar_perfil(self.execucao, self.perfil)
        except BaseException as erro:               # noqa: BLE001 - devolvido em resultado()
            self._erro = erro

    def esperar_o_agente_estar_de_pe(self, timeout: float = 30.0):
        """O agente já pediu a resposta ao modelo: processo, servidor de ferramentas e tudo mais estão vivos."""
        fim = time.monotonic() + timeout
        while time.monotonic() < fim:
            if self.provedor.pedidos_de_chat():
                return
            time.sleep(0.02)
        raise AssertionError("o agente não chegou a pedir a resposta ao modelo")

    def pids(self) -> List[int]:
        return processos_com_marca(self.execucao.id)

    def cancelar(self) -> bool:
        return self.executor.cancelar(self.execucao.id)

    def resultado(self, timeout: float = 90.0) -> Resultado:
        self._thread.join(timeout)
        if self._thread.is_alive():
            raise AssertionError("a execução não terminou no prazo do teste")
        if self._erro is not None:
            raise self._erro
        assert self._resultado is not None
        return self._resultado


class Amb:
    """Servidor falso de provedor + pastas + executor. Um por teste."""

    def __init__(self, tmp_path: Path, comando_hermes: Sequence[str], *, real: bool = False):
        self.base = Path(tmp_path)
        self.comando_hermes = tuple(comando_hermes)
        self.real = real
        self.provedor = ServidorDeProvedorFalso().iniciar()
        self._servidores: List[ServidorDeProvedorFalso] = [self.provedor]
        self._ids: List[str] = []
        self._contador = 0
        self._fichas: Dict[str, FichaDoServico] = {}

    # --- montagem ---------------------------------------------------------------------------------
    def segundo_provedor(self, cenario: Optional[Cenario] = None) -> ServidorDeProvedorFalso:
        servidor = ServidorDeProvedorFalso(cenario).iniciar()
        self._servidores.append(servidor)
        return servidor

    def config(self, **mudancas) -> ConfigDoExecutor:
        base = dict(comando_hermes=self.comando_hermes, raiz_hermes=self.base / "hermes",
                    pasta_das_execucoes=self.base / "execucoes", endereco_do_provedor=self.provedor.endereco,
                    comando_do_servidor_de_ferramentas=(sys.executable, str(SERVIDOR_DE_TESTE)),
                    pythonpath_das_ferramentas=(PASTA_DAS_FERRAMENTAS,), intervalo_do_vigia_s=0.05)
        base.update(mudancas)
        return ConfigDoExecutor(**base)

    def executor(self, **mudancas) -> ExecutorHermes:
        return ExecutorHermes(self.config(**mudancas))

    def ficha(self, nome: str = "sem_ferramenta", **kw) -> FichaDoServico:
        """'sem_ferramenta' ou 'com_ferramentas' (fixtures), ou o caminho de uma ficha."""
        arquivo = FIXTURES / f"ficha_{nome}.yaml" if not os.sep in nome else Path(nome)
        modelos = kw.pop("modelos", FIXTURES / "models.yaml")
        return ler_ficha(arquivo, caminho_dos_modelos=modelos, fase_em_curso=kw.pop("fase_em_curso", "fase 4"), **kw)

    def novo_id(self) -> str:
        self._contador += 1
        identificador = f"E-{os.getpid()}-{self._contador}-n1"
        self._ids.append(identificador)
        return identificador

    def execucao(self, ficha: FichaDoServico, *, id: Optional[str] = None, pacote: str = PACOTE_PADRAO,
                 tempo_max_s: Optional[float] = 60.0, **kw) -> Execucao:
        if ficha.ferramentas and "fontes_permitidas" not in kw:
            kw["fontes_permitidas"] = ("https://exemplo.org/",)
        identificador = id or self.novo_id()
        if identificador not in self._ids:
            self._ids.append(identificador)
        return Execucao(id=identificador, ficha=ficha, pacote=pacote, tempo_max_s=tempo_max_s, **kw)

    # --- execução ---------------------------------------------------------------------------------
    def rodar(self, ficha: FichaDoServico, cenario: Optional[Cenario] = None, *, executor: Optional[ExecutorHermes] = None,
              plantar: Optional[Callable[[Perfil], None]] = None, **kw) -> Resultado:
        """Roda uma execução inteira. `plantar(perfil)` mexe no perfil DEPOIS de gerado e conferido, ANTES de lançar."""
        if cenario is not None:
            self.provedor.definir(cenario)
        self.provedor.limpar()
        executor = executor or self.executor()
        execucao = self.execucao(ficha, **kw)
        perfil = executor.preparar(execucao)
        if plantar is not None:
            plantar(perfil)
        return executor.rodar_perfil(execucao, perfil)

    def rodar_em_segundo_plano(self, ficha: FichaDoServico, cenario: Cenario, *, executor: Optional[ExecutorHermes] = None,
                               plantar: Optional[Callable[[Perfil], None]] = None, **kw) -> EmAndamento:
        self.provedor.definir(cenario)
        self.provedor.limpar()
        executor = executor or self.executor()
        execucao = self.execucao(ficha, **kw)
        perfil = executor.preparar(execucao)
        if plantar is not None:
            plantar(perfil)
        return EmAndamento(executor, execucao, perfil, self.provedor)

    # --- fim --------------------------------------------------------------------------------------
    def fechar(self):
        for identificador in self._ids:                   # rede de segurança: nada pode ficar vivo depois do teste
            for pid in processos_com_marca(identificador):
                try:
                    os.kill(pid, 9)
                except OSError:
                    pass
        for servidor in self._servidores:
            servidor.parar()
        shutil.rmtree(self.base, ignore_errors=True)
