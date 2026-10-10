"""Cópia de cada página lida, para o validador conferir citações depois.

Para cada página lida a pasta da execução ganha, em leituras/:
  LEI-001.txt   o texto limpo inteiro (o que o agente de fato recebeu, em partes)
  LEI-001.json  metadados: endereços, hash sha256, hora da leitura, onde cada parte termina

O identificador LEI-nnn é o "leitura_id" que o agente cita (helena-v2/schemas/acao.schema.json).

O validador usa assim:
    copia = carregar_copia(pasta_da_execucao, "LEI-001")   # confere o hash; erro se mudou
    copia.parte(3)          # texto da parte 3, igual ao que o agente recebeu
    copia.idade_s()         # quantos segundos faz que a página foi lida
"""

import json
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple

from .erros import CopiaAdulterada
from .registro import agora_iso, hash_do_texto

VERSAO_DA_COPIA = 1
PADRAO_DO_ID = re.compile(r"^LEI-[0-9]{3,}$")


@dataclass(frozen=True)
class Copia:
    leitura_id: str
    url_pedida: str
    url_final: str
    hash_texto: str                 # sha256 do texto limpo
    hash_bruto: str                 # sha256 do corpo baixado (antes da limpeza)
    lido_em: str                    # ISO 8601, UTC
    lido_em_epoch: float
    tipo: str
    fins_das_partes: Tuple[int, ...]  # posição (exclusiva) onde cada parte termina
    links: Tuple[str, ...]
    texto: str

    @property
    def total_partes(self) -> int:
        return len(self.fins_das_partes)

    def parte(self, numero: int) -> str:
        if not 1 <= numero <= self.total_partes:
            raise IndexError(f"{self.leitura_id} tem {self.total_partes} partes; pedida a {numero}")
        inicio = self.fins_das_partes[numero - 2] if numero > 1 else 0
        return self.texto[inicio:self.fins_das_partes[numero - 1]]

    def idade_s(self, agora: Optional[float] = None) -> float:
        return (time.time() if agora is None else agora) - self.lido_em_epoch


def _escrever(caminho: Path, conteudo: str):
    temporario = caminho.with_name(caminho.name + ".tmp")
    with open(temporario, "w", encoding="utf-8", newline="") as arquivo:
        arquivo.write(conteudo)
        arquivo.flush()
        os.fsync(arquivo.fileno())
    os.replace(temporario, caminho)


def carregar_copia(diretorio_da_execucao: Path, leitura_id: str) -> Copia:
    """Lê uma cópia do disco e confere o hash. Levanta CopiaAdulterada se não bater."""
    if not PADRAO_DO_ID.match(leitura_id):
        raise ValueError(f"leitura_id inválido: {leitura_id!r}")
    pasta = Path(diretorio_da_execucao) / "leituras"
    with open(pasta / f"{leitura_id}.json", encoding="utf-8") as arquivo:
        meta = json.load(arquivo)
    with open(pasta / f"{leitura_id}.txt", encoding="utf-8", newline="") as arquivo:
        texto = arquivo.read()
    if hash_do_texto(texto) != meta["hash_texto"]:
        raise CopiaAdulterada(f"{leitura_id}: o texto guardado não bate com o hash gravado")
    if meta["fins_das_partes"] and meta["fins_das_partes"][-1] != len(texto):
        raise CopiaAdulterada(f"{leitura_id}: as partes não cobrem o texto inteiro")
    return Copia(
        leitura_id=meta["leitura_id"], url_pedida=meta["url_pedida"], url_final=meta["url_final"],
        hash_texto=meta["hash_texto"], hash_bruto=meta["hash_bruto"], lido_em=meta["lido_em"],
        lido_em_epoch=meta["lido_em_epoch"], tipo=meta["tipo"],
        fins_das_partes=tuple(meta["fins_das_partes"]), links=tuple(meta["links"]), texto=texto,
    )


class Copias:
    """Guarda e acha as cópias de UMA execução."""

    def __init__(self, diretorio_da_execucao: Path, relogio: Callable[[], float] = time.time):
        self.diretorio = Path(diretorio_da_execucao)
        self.pasta = self.diretorio / "leituras"
        self.pasta.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.relogio = relogio
        self._por_url: Dict[str, str] = {}
        self._ultimo = 0
        for arquivo in sorted(self.pasta.glob("LEI-*.json")):
            with open(arquivo, encoding="utf-8") as f:
                meta = json.load(f)
            self._por_url[meta["url_pedida"]] = meta["leitura_id"]
            self._ultimo = max(self._ultimo, int(meta["leitura_id"].split("-")[1]))

    def por_url(self, url_pedida: str) -> Optional[Copia]:
        leitura_id = self._por_url.get(url_pedida)
        return carregar_copia(self.diretorio, leitura_id) if leitura_id else None

    def guardar(self, url_pedida: str, url_final: str, texto: str, fins_das_partes: List[int],
                links: List[str], hash_bruto: str, tipo: str) -> Copia:
        self._ultimo += 1
        leitura_id = f"LEI-{self._ultimo:03d}"
        agora = self.relogio()
        meta = {
            "versao": VERSAO_DA_COPIA, "leitura_id": leitura_id, "url_pedida": url_pedida,
            "url_final": url_final, "hash_texto": hash_do_texto(texto), "hash_bruto": hash_bruto,
            "lido_em": agora_iso(agora), "lido_em_epoch": agora, "tipo": tipo,
            "total_caracteres": len(texto), "fins_das_partes": list(fins_das_partes),
            "links": list(links),
        }
        _escrever(self.pasta / f"{leitura_id}.txt", texto)
        _escrever(self.pasta / f"{leitura_id}.json", json.dumps(meta, ensure_ascii=False, indent=1))
        self._por_url[url_pedida] = leitura_id
        return carregar_copia(self.diretorio, leitura_id)

    def listar(self) -> List[Copia]:
        return [carregar_copia(self.diretorio, f"LEI-{n:03d}") for n in range(1, self._ultimo + 1)]
