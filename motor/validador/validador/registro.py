"""Registro das checagens e configuração.

Cada checagem é UMA função com ID estável (CHK-...), registrada com o decorador @checagem.
O decorador guarda, junto da função: nome, o furo que ela fecha (IDs do registro de furos do plano)
e a gravidade padrão. Assim o que a checagem faz e o que ela protege ficam no mesmo lugar.

Gravidade:
  RECUSA  a entrega volta ao autor com o item exato.
  MARCA   a entrega segue, mas chega com uma marca na faixa do card.
"""
import json
from dataclasses import dataclass
from pathlib import Path

PASTA_DADOS = Path(__file__).resolve().parent / "dados"


def carregar_json(nome: str) -> dict:
    return json.loads((PASTA_DADOS / nome).read_text(encoding="utf-8"))


# Configuração lida uma vez. As checagens consultam CONFIG na hora de rodar (não guardam cópia),
# por isso os testes de mutação conseguem "afrouxar" um número e ver o teste de defeitos falhar.
CONFIG: dict = carregar_json("configuracao.json")


@dataclass(frozen=True)
class Checagem:
    id: str
    nome: str
    o_que_fecha: str
    fecha_furos: tuple
    gravidade: str
    funcao: object


CHECAGENS: dict = {}  # id -> Checagem, na ordem em que foram registradas


def checagem(id: str, nome: str, o_que_fecha: str, fecha_furos: list, gravidade: str = "RECUSA"):
    """Registra uma função como checagem. A função recebe a Execucao e devolve lista de Falha (ou None se não se aplica)."""
    assert gravidade in ("RECUSA", "MARCA"), gravidade
    assert id.startswith("CHK-"), id

    def registrar(funcao):
        assert id not in CHECAGENS, f"ID de checagem repetido: {id}"
        CHECAGENS[id] = Checagem(id, nome, o_que_fecha, tuple(fecha_furos), gravidade, funcao)
        funcao.checagem_id = id
        return funcao

    return registrar


def gravidade_de(id: str, motivo: str = "") -> str:
    """Gravidade de uma falha: 'ID:MOTIVO' na configuração, depois 'ID', depois o padrão do registro."""
    g = CONFIG.get("gravidades", {})
    if motivo and f"{id}:{motivo}" in g:
        return g[f"{id}:{motivo}"]
    if id in g:
        return g[id]
    return CHECAGENS[id].gravidade
