"""O roteiro do card: as etapas, quem é o autor, quem pode revisar e de quem depende.

Tem o mesmo formato do campo "roteiro" das jornadas da máquina real
(helena-v2/maquina/jornada.schema.json), para o adaptador só repassar.
"""
from dataclasses import dataclass

from .vocabulario import FUNDADOR

TODAS_AS_ACOES = ("ENTREGAR", "PERGUNTAR", "DEVOLVER_A_QUEM_PEDIU", "REGISTRAR_FALHA")


@dataclass(frozen=True)
class Etapa:
    id: str
    autor: str
    revisores: tuple = ()
    depende_de: tuple = ()
    julga: tuple = ()
    internet: bool = False
    pulavel: bool = False
    prazo_de_terceiro: bool = False
    usa_decisao: bool = True
    acoes_permitidas: tuple = TODAS_AS_ACOES

    def para_jornada(self):
        return {
            "id": self.id, "autor": self.autor, "revisores": list(self.revisores),
            "depende_de": list(self.depende_de), "julga": list(self.julga), "internet": self.internet,
            "pulavel": self.pulavel, "prazo_de_terceiro": self.prazo_de_terceiro,
            "usa_decisao": self.usa_decisao, "acoes_permitidas": list(self.acoes_permitidas),
        }


@dataclass(frozen=True)
class Roteiro:
    nome: str
    etapas: tuple

    def ids(self):
        return [e.id for e in self.etapas]

    def etapa(self, id_):
        for e in self.etapas:
            if e.id == id_:
                return e
        raise KeyError(id_)

    def para_jornada(self):
        return {"etapas": [e.para_jornada() for e in self.etapas]}

    # --- regra 4: o revisor nunca é o autor, nem quem vai julgar a mesma peça depois
    def proibidos_de_revisar(self, id_):
        """Autor da etapa, autores das etapas que a julgam e os revisores possíveis dessas julgadoras."""
        proibidos = {self.etapa(id_).autor}
        for outra in self.etapas:
            if id_ in outra.julga:
                proibidos.add(outra.autor)
                proibidos.update(r for r in outra.revisores if r not in (outra.autor, FUNDADOR))
        return sorted(proibidos)

    def revisores_validos(self, id_):
        """Na ordem da ficha, sem os proibidos; o fundador é sempre a última reserva."""
        proibidos = self.proibidos_de_revisar(id_)
        validos = []
        for r in self.etapa(id_).revisores:
            if r not in proibidos and r not in validos:
                validos.append(r)
        if FUNDADOR not in validos:
            validos.append(FUNDADOR)
        return validos


# O mesmo roteiro de prova da máquina real: E1 em paralelo; E2 -> EJ (jurídico, julga E2) -> ER.
ROTEIRO_PROVA = Roteiro("prova", (
    Etapa("E1", "CAIO", ("CLARA", "HELENA"), pulavel=True),
    Etapa("E2", "ISABELA", ("CLARA", "HELENA", "RAVI", FUNDADOR), internet=True, prazo_de_terceiro=True),
    Etapa("EJ", "CLARA", ("HELENA", FUNDADOR), depende_de=("E2",), julga=("E2",), internet=True),
    Etapa("ER", "HELENA", ("HELENA", "CLARA", "CAIO"), depende_de=("E1", "E2", "EJ")),
))

# Três etapas em fila. A do meio NÃO pode perguntar (serve para testar a pergunta indevida).
ROTEIRO_LINHA = Roteiro("linha", (
    Etapa("L1", "BIANCA", ("DANIEL", "HELENA")),
    Etapa("L2", "DANIEL", ("BIANCA", "HELENA"), depende_de=("L1",), acoes_permitidas=("ENTREGAR", "REGISTRAR_FALHA")),
    Etapa("L3", "HELENA", ("CLARA",), depende_de=("L2",)),
))

# Uma etapa só.
ROTEIRO_UNICA = Roteiro("unica", (
    Etapa("U1", "CAIO", ("CLARA", "HELENA")),
))

ROTEIROS_PRONTOS = (ROTEIRO_PROVA, ROTEIRO_LINHA, ROTEIRO_UNICA)
