"""Árvore de processos (Linux, pelo /proc): achar e encerrar TUDO que uma execução lançou.

Por que não basta matar o grupo do Hermes: no Hermes 0.19.0 o servidor de ferramentas roda em outra
sessão e outro grupo (hermes -> ajudante -> servidor). Um `killpg` no grupo do Hermes não o alcança.
Por isso o executor procura os processos por TRÊS caminhos e mata a união:

  1. o grupo de processos (e a sessão) em que o Hermes foi lançado;
  2. os descendentes, pela cadeia de pai/filho (foto tirada durante a execução e de novo na hora de matar);
  3. a MARCA da execução (HELENA_EXECUCAO=<id>) no ambiente de cada processo.

Cada alvo é guardado com a hora de início do processo, para nunca matar outro processo que herdou o mesmo número.
Um processo que mude de sessão E limpe o próprio ambiente escapa: contra isso a defesa é o container da VPS.
"""

import os
import signal
import time
from dataclasses import dataclass
from typing import Callable, Dict, Iterable, Optional, Set, Tuple

from .ambiente import MARCADOR


@dataclass(frozen=True)
class Proc:
    pid: int
    ppid: int
    pgid: int
    sid: int
    inicio: int         # hora de início, em ticks desde o boot (campo 22 do /proc/PID/stat)
    estado: str         # R, S, D, Z (zumbi = já morreu), ...


def _ler_stat(pid: int):
    try:
        with open(f"/proc/{pid}/stat", "rb") as arquivo:
            bruto = arquivo.read().decode("utf-8", errors="replace")
        resto = bruto[bruto.rindex(")") + 2:].split()
        return Proc(pid=pid, ppid=int(resto[1]), pgid=int(resto[2]), sid=int(resto[3]),
                    inicio=int(resto[19]), estado=resto[0])
    except (OSError, ValueError, IndexError):
        return None


def ler_processos() -> Dict[int, Proc]:
    tabela = {}
    for nome in os.listdir("/proc"):
        if nome.isdigit():
            info = _ler_stat(int(nome))
            if info is not None:
                tabela[info.pid] = info
    return tabela


def inicio_do_processo(pid: int):
    info = _ler_stat(pid)
    return None if info is None else info.inicio


def esta_vivo(pid: int, inicio: int) -> bool:
    info = _ler_stat(pid)
    return info is not None and info.inicio == inicio and info.estado not in ("Z", "X")


def descendentes(raiz: int, tabela: Dict[int, Proc]) -> Set[int]:
    filhos: Dict[int, list] = {}
    for info in tabela.values():
        filhos.setdefault(info.ppid, []).append(info.pid)
    achados: Set[int] = set()
    fila = [raiz]
    while fila:
        for filho in filhos.get(fila.pop(), ()):
            if filho not in achados:
                achados.add(filho)
                fila.append(filho)
    return achados


def com_marcador(id_execucao: str, tabela: Dict[int, Proc]) -> Set[int]:
    procurado = f"{MARCADOR}={id_execucao}".encode()
    achados = set()
    for pid in tabela:
        try:
            with open(f"/proc/{pid}/environ", "rb") as arquivo:
                variaveis = arquivo.read().split(b"\0")
        except OSError:
            continue
        if procurado in variaveis:
            achados.add(pid)
    return achados


def alvos_vivos(*, raiz_pid: Optional[int], pgid: Optional[int], id_execucao: str,
                conhecidos: Dict[int, int]) -> Dict[int, int]:
    """Tudo que pertence à execução e ainda está vivo: {pid: inicio}. raiz_pid e pgid podem ser None."""
    tabela = ler_processos()
    pids: Set[int] = {pid for pid, inicio in conhecidos.items() if pid in tabela and tabela[pid].inicio == inicio}
    if pgid is not None and pgid > 1:
        pids |= {p.pid for p in tabela.values() if p.pgid == pgid or p.sid == pgid}
    if raiz_pid is not None and raiz_pid > 1:
        pids.add(raiz_pid)
    pids |= com_marcador(id_execucao, tabela)
    for pid in list(pids):
        pids |= descendentes(pid, tabela)
    return {pid: tabela[pid].inicio for pid in pids
            if pid in tabela and tabela[pid].estado not in ("Z", "X") and pid != os.getpid()}


def _enviar(sinal: int, pgid: Optional[int], alvos: Dict[int, int]):
    if pgid is not None and pgid > 1 and pgid != os.getpgrp():    # nunca o nosso grupo, nunca o init
        try:
            os.killpg(pgid, sinal)
        except (ProcessLookupError, PermissionError):
            pass
    for pid, inicio in alvos.items():
        if inicio_do_processo(pid) == inicio:           # ainda é o mesmo processo
            try:
                os.kill(pid, sinal)
            except (ProcessLookupError, PermissionError):
                pass


def anotar_descendentes(raiz_pid: int, conhecidos: Dict[int, int]):
    """Acrescenta em `conhecidos` os descendentes atuais da raiz (chamado de tempos em tempos)."""
    tabela = ler_processos()
    for pid in descendentes(raiz_pid, tabela):
        conhecidos.setdefault(pid, tabela[pid].inicio)


def encerrar_tudo(*, raiz_pid: Optional[int], pgid: Optional[int], id_execucao: str, conhecidos: Dict[int, int],
                  graca_s: float, limite_s: float,
                  relogio: Callable[[], float] = time.monotonic,
                  dormir: Callable[[float], None] = time.sleep) -> Tuple[int, ...]:
    """Pede para parar (SIGTERM), espera a graça, mata (SIGKILL) e confere. Devolve os que sobraram.

    Garante o prazo: nunca passa de `limite_s` (o plano manda encerrar em até 15 s).
    """
    comeco = relogio()

    def listar():
        return alvos_vivos(raiz_pid=raiz_pid, pgid=pgid, id_execucao=id_execucao, conhecidos=conhecidos)

    alvos = listar()
    conhecidos.update(alvos)
    _enviar(signal.SIGTERM, pgid, alvos)
    while alvos and relogio() - comeco < graca_s:
        dormir(0.02)
        alvos = listar()
    while alvos and relogio() - comeco < limite_s:
        conhecidos.update(alvos)
        _enviar(signal.SIGKILL, pgid, alvos)
        dormir(0.02)
        alvos = listar()
    return tuple(sorted(alvos))


def ainda_vivos(pids_e_inicios: Iterable[Tuple[int, int]]) -> Tuple[int, ...]:
    return tuple(sorted(pid for pid, inicio in pids_e_inicios if esta_vivo(pid, inicio)))
