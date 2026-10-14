"""Registro (JSONL) de cada chamada e arquivo de estado da execução.

registro.jsonl: uma linha por chamada de ferramenta, nunca reescrita (só acrescenta).
Campos: seq, ts, execucao, ferramenta, argumentos, resultado, codigo, hash (sha256 do
texto entregue ao agente) e, quando há, leitura_id/parte/de.
resultado: ok | erro | entregue_agora | encerrada | nao_liberada

estado.json: foto atual da execução (contadores, se encerrou e por quê, se usou internet).
É o que o motor lê para preencher "usou_internet" e para saber do "limite_de_chamadas".
Se o servidor cair e voltar na mesma pasta, os contadores continuam de onde estavam.
"""

import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, List, Optional

VERSAO_DO_ESTADO = 1


def hash_do_texto(texto: str) -> str:
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()


def agora_iso(epoch: float) -> str:
    return datetime.fromtimestamp(epoch, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class Registro:
    def __init__(self, caminho: Path, execucao: str, relogio: Callable[[], float] = time.time):
        self.caminho = caminho
        self.execucao = execucao
        self.relogio = relogio
        self.seq = self._contar_linhas()

    def _contar_linhas(self) -> int:
        if not self.caminho.exists():
            return 0
        with open(self.caminho, "rb") as arquivo:
            return sum(1 for linha in arquivo if linha.strip())

    def registrar(self, ferramenta: str, argumentos: dict, resultado: str, texto_entregue: str,
                  codigo: Optional[str] = None, **extra) -> dict:
        self.seq += 1
        linha = {
            "seq": self.seq,
            "ts": agora_iso(self.relogio()),
            "execucao": self.execucao,
            "ferramenta": ferramenta,
            "argumentos": _resumir(argumentos),
            "resultado": resultado,
            "codigo": codigo,
            "hash": hash_do_texto(texto_entregue),
        }
        linha.update(extra)
        with open(self.caminho, "a", encoding="utf-8") as arquivo:
            arquivo.write(json.dumps(linha, ensure_ascii=False, sort_keys=True) + "\n")
            arquivo.flush()
            os.fsync(arquivo.fileno())
        return linha


def _resumir(argumentos) -> dict:
    """Guarda os argumentos, cortando valores de texto muito longos."""
    if not isinstance(argumentos, dict):
        return {"_invalido": str(type(argumentos).__name__)}
    saida = {}
    for chave, valor in list(argumentos.items())[:10]:
        if isinstance(valor, str) and len(valor) > 500:
            valor = valor[:500] + "..."
        elif not isinstance(valor, (str, int, float, bool, type(None))):
            valor = f"<{type(valor).__name__}>"
        saida[str(chave)[:50]] = valor
    return saida


def ler_registro(diretorio: Path) -> List[dict]:
    caminho = Path(diretorio) / "registro.jsonl"
    if not caminho.exists():
        return []
    with open(caminho, encoding="utf-8") as arquivo:
        return [json.loads(linha) for linha in arquivo if linha.strip()]


def salvar_estado(diretorio: Path, dados: dict):
    caminho = Path(diretorio) / "estado.json"
    temporario = caminho.with_suffix(".json.tmp")
    with open(temporario, "w", encoding="utf-8") as arquivo:
        json.dump(dados, arquivo, ensure_ascii=False, sort_keys=True, indent=1)
        arquivo.flush()
        os.fsync(arquivo.fileno())
    os.replace(temporario, caminho)


def ler_estado(diretorio: Path) -> Optional[dict]:
    caminho = Path(diretorio) / "estado.json"
    if not caminho.exists():
        return None
    with open(caminho, encoding="utf-8") as arquivo:
        return json.load(arquivo)
