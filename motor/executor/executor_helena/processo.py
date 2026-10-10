"""Lança o Hermes como processo próprio, vigia e encerra.

O que garante:
  - o processo nasce numa sessão/grupo novo, sem entrada (stdin fechado) e com o ambiente que o
    chamador montou (nunca o ambiente do motor);
  - a saída vai para ARQUIVOS (nada de pipe que enche e trava);
  - o TEMPO máximo é aplicado por aqui: passou, mata a árvore inteira (ver arvore.py), em até
    `limite_para_encerrar_s` (15 s no plano);
  - o CANCELAMENTO externo (um Event) encerra do mesmo jeito, em até `intervalo_s` + o tempo de matar;
  - os VIGIAS (funções que devolvem um motivo ou None) também podem encerrar: é assim que o limite de
    chamadas corta um laço;
  - depois que o processo termina (por qualquer motivo) procura sobras e mata.

Escreve processo.json logo ao lançar. Se o motor cair, `matar_sobras` lê esse arquivo e limpa.
"""

import json
import os
import subprocess
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, Optional, Sequence, Tuple

from . import arvore
from .tipos import ENCERRADO_POR_CANCELAMENTO, ENCERRADO_POR_TEMPO

Vigia = Callable[[], Optional[str]]


class ErroDeLancamento(OSError):
    """O processo nem chegou a nascer (programa não achado, pasta sumiu...)."""


@dataclass(frozen=True)
class SaidaDoProcesso:
    codigo: Optional[int]                 # negativo = morto por sinal
    duracao_s: float
    encerrado_por: Optional[str]          # None se terminou sozinho
    tempo_para_encerrar_s: Optional[float]
    sobras: Tuple[int, ...]
    pid: int


def _abrir_saida(caminho: Path):
    return os.fdopen(os.open(caminho, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "wb")


def executar(argv: Sequence[str], *, cwd: Path, env: Dict[str, str], arquivo_de_saida: Path,
             arquivo_de_erros: Path, arquivo_do_processo: Path, id_execucao: str, tempo_max_s: float,
             cancelamento: threading.Event, vigias: Sequence[Vigia] = (), graca_s: float = 3.0,
             limite_para_encerrar_s: float = 15.0, intervalo_s: float = 0.2) -> SaidaDoProcesso:
    with _abrir_saida(arquivo_de_saida) as saida, _abrir_saida(arquivo_de_erros) as erros:
        try:
            processo = subprocess.Popen(list(argv), cwd=cwd, env=env, stdin=subprocess.DEVNULL, stdout=saida,
                                        stderr=erros, start_new_session=True, close_fds=True)
        except OSError as erro:
            raise ErroDeLancamento(f"não consegui lançar {argv[0]!r}: {erro}") from erro
    comeco = time.monotonic()
    pgid = processo.pid                      # start_new_session: o líder do grupo é o próprio processo
    inicio = arvore.inicio_do_processo(processo.pid) or 0
    conhecidos: Dict[int, int] = {processo.pid: inicio}
    _gravar_processo(arquivo_do_processo, processo.pid, pgid, inicio, id_execucao)

    motivo: Optional[str] = None
    proximo_censo = 0.0
    prazo = comeco + tempo_max_s
    while processo.poll() is None:
        agora = time.monotonic()
        if cancelamento.is_set():
            motivo = ENCERRADO_POR_CANCELAMENTO
        elif agora >= prazo:
            motivo = ENCERRADO_POR_TEMPO
        else:
            for vigia in vigias:
                motivo = vigia()
                if motivo:
                    break
        if motivo:
            break
        if agora >= proximo_censo:
            arvore.anotar_descendentes(processo.pid, conhecidos)
            proximo_censo = agora + 0.5
        cancelamento.wait(intervalo_s)        # acorda na hora se pedirem para cancelar

    inicio_da_parada = time.monotonic()
    folga = graca_s if motivo else min(graca_s, 1.0)      # saiu sozinho: só varre as sobras, sem esperar muito
    sobras = arvore.encerrar_tudo(raiz_pid=processo.pid, pgid=pgid, id_execucao=id_execucao, conhecidos=conhecidos,
                                  graca_s=folga, limite_s=limite_para_encerrar_s)
    try:
        codigo = processo.wait(timeout=max(0.5, limite_para_encerrar_s - (time.monotonic() - inicio_da_parada)))
    except subprocess.TimeoutExpired:           # nem o SIGKILL funcionou
        codigo = None
        sobras = tuple(sorted(set(sobras) | {processo.pid}))
    fim = time.monotonic()
    return SaidaDoProcesso(codigo=codigo, duracao_s=fim - comeco, encerrado_por=motivo,
                           tempo_para_encerrar_s=(fim - inicio_da_parada) if motivo else None,
                           sobras=sobras, pid=processo.pid)


def _gravar_processo(caminho: Path, pid: int, pgid: int, inicio: int, id_execucao: str):
    dados = {"pid": pid, "pgid": pgid, "inicio": inicio, "id_execucao": id_execucao, "lancado_em": time.time()}
    descritor = os.open(caminho, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descritor, "w", encoding="utf-8") as arquivo:
        json.dump(dados, arquivo)


def matar_sobras(pasta_das_execucoes: Path, *, graca_s: float = 2.0, limite_s: float = 10.0) -> Tuple[str, ...]:
    """Para o motor chamar ao voltar de uma queda: mata o que uma vida anterior deixou rodando.

    Olha cada <pasta>/<id>/processo.json. Só mata se o processo ainda tem a mesma hora de início
    (outro processo com o mesmo número é deixado em paz). Devolve os ids das execuções limpas.
    """
    limpas = []
    base = Path(pasta_das_execucoes)
    if not base.is_dir():
        return ()
    for arquivo in sorted(base.glob("*/processo.json")):
        try:
            dados = json.loads(arquivo.read_text(encoding="utf-8"))
            pid, pgid, inicio, id_execucao = dados["pid"], dados["pgid"], dados["inicio"], dados["id_execucao"]
        except (OSError, ValueError, KeyError):
            continue
        conhecidos = {pid: inicio} if arvore.esta_vivo(pid, inicio) else {}
        raiz, grupo = (pid, pgid) if conhecidos else (None, None)     # número reaproveitado: não tocar
        if not arvore.alvos_vivos(raiz_pid=raiz, pgid=grupo, id_execucao=id_execucao, conhecidos=conhecidos):
            continue
        arvore.encerrar_tudo(raiz_pid=raiz, pgid=grupo, id_execucao=id_execucao, conhecidos=conhecidos,
                             graca_s=graca_s, limite_s=limite_s)
        limpas.append(id_execucao)
    return tuple(limpas)
