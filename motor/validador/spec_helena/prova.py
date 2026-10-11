"""Roda os casos da especificação no validador e diz o que aconteceu (usado pelo teste dos casos e pelo quadro de cobertura).

O que é: a régua única. "O validador pegou o defeito?" e "a resposta boa passou?" são decididos AQUI, uma vez só;
tests/test_casos_da_spec.py e cobertura.py apenas usam estas respostas.
Como mudar: para mudar o que vale como "pegou", mude `pegou` (hoje: o validador acusa o id com a gravidade que a
especificação manda: RECUSA ou MARCA).
"""
from dataclasses import dataclass
from functools import lru_cache

from validador import CHECAGENS, ErroDeContexto, validar

from .caso import ErroDoAdaptador, listar_casos, montar_entrada
from .leitura import Spec


@dataclass
class Avaliacao:
    caso: object                 # spec_helena.caso.Caso
    relatorio: object = None     # validador.Relatorio, ou None se não deu para rodar
    erro: str | None = None      # por que não deu para rodar (caso ou pedido mal montado)

    @property
    def rodou(self) -> bool:
        return self.relatorio is not None

    def recusas(self) -> set:
        """Pares (id da checagem, motivo) que RECUSARAM a resposta."""
        return {(f.id, f.motivo) for f in self.relatorio.recusas} if self.rodou else set()


def avaliar(spec, caso) -> Avaliacao:
    try:
        resposta, contexto = montar_entrada(spec, caso)
        return Avaliacao(caso, validar(resposta, contexto))
    except (ErroDoAdaptador, ErroDeContexto, FileNotFoundError, KeyError) as erro:
        return Avaliacao(caso, None, f"{type(erro).__name__}: {erro}")


def pegou(spec, avaliacao, id_da_checagem) -> bool:
    """O validador acusou este id com a gravidade que a especificação manda para ele?"""
    if not avaliacao.rodou:
        return False
    gravidade = spec.gravidade(id_da_checagem)
    return any(f.gravidade == gravidade for f in avaliacao.relatorio.falhas_de(id_da_checagem))


def passou(avaliacao, id_da_checagem) -> bool:
    """A checagem rodou nesta resposta e passou (não foi 'não se aplica' nem falhou)."""
    return avaliacao.rodou and any(c.id == id_da_checagem and c.status == "PASSOU" for c in avaliacao.relatorio.checagens)


def registrada(id_da_checagem) -> bool:
    return id_da_checagem in CHECAGENS


@lru_cache(maxsize=1)
def spec_padrao() -> Spec:
    return Spec()


@lru_cache(maxsize=1)
def avaliacoes_da_spec() -> tuple:
    """Todos os casos de helena-v2/casos/ avaliados (calculado uma vez por execução)."""
    spec = spec_padrao()
    return tuple(avaliar(spec, c) for c in listar_casos(spec))
