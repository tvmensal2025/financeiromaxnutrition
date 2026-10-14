"""As peças que passam entre o simulador e o alvo: Evento (entra), Resposta (sai) e Foto (o estado visível).

O Evento tem o mesmo formato dos eventos de uma jornada da máquina real (helena-v2/maquina).
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Evento:
    papel: str                       # AUTOR, REVISOR, HELENA, FUNDADOR, MOTOR, RELOGIO ou VIGIA
    evento: str                      # nome do vocabulário, ex.: ENTREGAR
    alvo: str = "card"               # "card", o id de uma etapa ou "acao:A1"
    params: dict = field(default_factory=dict)
    ator: str = None                 # quem responde (AUTOR/REVISOR), ex.: CAIO
    chave: str = "atual"             # "atual" ou "antiga" (resposta de execução que já passou;
                                     # no FUNDADOR é a versão da peça que ele viu)

    def para_jornada(self):
        """Formato de evento da máquina real (para o adaptador)."""
        d = {"papel": self.papel, "evento": self.evento}
        if self.alvo != "card":
            d["alvo"] = self.alvo
        if self.params:
            d["params"] = dict(self.params)
        if self.ator:
            d["ator"] = self.ator
        if self.chave != "atual":
            d["versao_vista" if self.papel == "FUNDADOR" else "chave"] = self.chave
        return d

    def como_dict(self):
        return {"papel": self.papel, "evento": self.evento, "alvo": self.alvo, "params": dict(self.params),
                "ator": self.ator, "chave": self.chave}

    @property
    def rotulo(self):
        ps = ",".join(f"{k}={v}" for k, v in sorted(self.params.items()))
        return (f"{self.papel} {self.evento}" + (f"({ps})" if ps else "") +
                (f" em {self.alvo}" if self.alvo != "card" else "") +
                (f" por {self.ator}" if self.ator else "") + ("" if self.chave == "atual" else f" [{self.chave}]"))


# ---- atalhos para escrever eventos sem repetir o papel
def autor(evento, etapa, ator, chave="atual", **params):
    return Evento("AUTOR", evento, etapa, params, ator, chave)


def revisor(evento, etapa, ator, chave="atual", **params):
    return Evento("REVISOR", evento, etapa, params, ator, chave)


def helena(evento, alvo="card", chave="atual", **params):
    return Evento("HELENA", evento, alvo, params, None, chave)


def fundador(evento, alvo="card", chave="atual", **params):
    return Evento("FUNDADOR", evento, alvo, params, None, chave)


def motor(evento, alvo="card", **params):
    return Evento("MOTOR", evento, alvo, params)


def relogio(evento, alvo="card"):
    return Evento("RELOGIO", evento, alvo)


def vigia(evento, alvo="card"):
    return Evento("VIGIA", evento, alvo)


@dataclass
class Resposta:
    """O que o alvo respondeu a um evento."""
    aceito: bool                     # uma passagem foi aplicada e o estado pode ter mudado
    destino: str = "PASSAGEM"        # PASSAGEM, FORMATO_ERRADO (resposta sem passagem vira formato errado),
                                     # REACAO, COMENTARIO_NO_CARD, CARD_NOVO_LIGADO, RECUSADO
    automaticos: tuple = ()          # eventos do motor que dispararam sozinhos depois: ((papel, evento, alvo), ...)
    violacoes_do_alvo: tuple = ()    # o que o próprio alvo acusou: ((regra, mensagem), ...)

    def como_dict(self):
        return {"aceito": self.aceito, "destino": self.destino, "automaticos": [list(a) for a in self.automaticos]}


# ---------------------------------------------------------------- a foto: o estado que o verificador enxerga
@dataclass(frozen=True)
class FotoEtapa:
    id: str
    estado: str
    revisor: str = "NENHUM"
    execucoes: int = 0
    exec_viva: int = 0
    versao: int = 0
    motivo: str = "NENHUM"
    semaforo: str = "NENHUM"
    fim: str = "NENHUM"
    lembretes: int = 0


@dataclass(frozen=True)
class FotoAcao:
    id: str
    estado: str
    origem: str = ""
    ok_registrado: int = 0
    tentativas: int = 0
    lembretes: int = 0


@dataclass(frozen=True)
class Foto:
    card: dict                       # {"estado", "motivo", "ordens", "lembretes", "nivel_prazo", "fim", ...}
    etapas: dict                     # id -> FotoEtapa
    acoes: dict                      # id -> FotoAcao
    donos: dict                      # maquina -> {estado: (dono, prazo)}

    def mesmo_estado_que(self, outra):
        """Igual em tudo que muda (o dono e o prazo de cada estado são fixos)."""
        return self.card == outra.card and self.etapas == outra.etapas and self.acoes == outra.acoes

    def como_dict(self):
        return {
            "card": dict(self.card),
            "etapas": {i: vars(e) for i, e in sorted(self.etapas.items())},
            "acoes": {i: vars(a) for i, a in sorted(self.acoes.items())},
        }
