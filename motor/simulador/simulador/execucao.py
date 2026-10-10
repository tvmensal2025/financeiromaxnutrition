"""Rodar o simulador: liga o Mundo a um Alvo e confere as invariantes depois de cada evento."""
import hashlib
import json
from collections import Counter
from dataclasses import dataclass, field

from .invariantes import Verificador
from .mundo import Mundo


@dataclass
class Execucao:
    semente: object                  # None quando os eventos foram dados à mão (jogar)
    alvo: str
    roteiro: str
    eventos: list
    respostas: list
    violacoes: list
    foto_final: object
    parou_por: str                   # final, passos ou sem_movimento
    categorias: dict = field(default_factory=dict)
    comportamentos: dict = field(default_factory=dict)

    @property
    def ok(self):
        return not self.violacoes

    @property
    def assinatura(self):
        """Impressão digital do que aconteceu. Mesma semente no mesmo alvo = mesma assinatura."""
        corpo = {
            "roteiro": self.roteiro, "parou_por": self.parou_por,
            "eventos": [e.como_dict() for e in self.eventos], "respostas": [r.como_dict() for r in self.respostas],
            "violacoes": [v.como_dict() for v in self.violacoes], "final": self.foto_final.como_dict(),
        }
        texto = json.dumps(corpo, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
        return hashlib.sha256(texto.encode("utf-8")).hexdigest()

    @property
    def desfecho(self):
        return self.foto_final.card["estado"]

    def resumo(self):
        return (f"semente {self.semente} [{self.roteiro}] -> card {self.desfecho}, {len(self.eventos)} eventos, "
                f"{len(self.violacoes)} violações")


def rodar(alvo, semente, cenario=None, max_passos=120):
    """Roda UMA sequência (decidida pela semente) contra o alvo e devolve a Execucao."""
    mundo = Mundo(semente, cenario)
    alvo.iniciar(mundo.roteiro, mundo.pedido_grande)
    verificador = Verificador(mundo.roteiro)
    foto = alvo.foto()
    eventos, respostas = [], []
    parou_por = "passos"
    for _ in range(max_passos):
        proximos = mundo.proximos_eventos(foto)
        if not proximos:
            parou_por = mundo.parou_por or "sem_movimento"
            break
        for evento in proximos:
            resposta = alvo.aplicar(evento)
            depois = alvo.foto()
            verificador.conferir(evento, resposta, foto, depois)
            mundo.observar(evento, resposta, depois)
            eventos.append(evento)
            respostas.append(resposta)
            foto = depois
    verificador.conferir_final(alvo.encerrar())
    return Execucao(semente, alvo.nome, mundo.roteiro.nome, eventos, respostas, verificador.violacoes, foto, parou_por,
                    dict(mundo.categorias), dict(mundo.comportamentos))


def jogar(alvo, roteiro, eventos, pedido_grande=True):
    """Aplica uma lista de eventos dada à mão (cenário escrito num teste) e confere as invariantes."""
    alvo.iniciar(roteiro, pedido_grande)
    verificador = Verificador(roteiro)
    foto = alvo.foto()
    respostas = []
    for evento in eventos:
        resposta = alvo.aplicar(evento)
        depois = alvo.foto()
        verificador.conferir(evento, resposta, foto, depois)
        respostas.append(resposta)
        foto = depois
    verificador.conferir_final(alvo.encerrar())
    return Execucao(None, alvo.nome, roteiro.nome, list(eventos), respostas, verificador.violacoes, foto, "lista")


@dataclass
class Campanha:
    """O resultado de muitas sementes de uma vez."""
    total: int = 0
    com_violacao: list = field(default_factory=list)          # Execucoes que violaram alguma invariante
    por_invariante: Counter = field(default_factory=Counter)  # quantas violações de cada invariante
    desfechos: Counter = field(default_factory=Counter)       # estado final do card
    parou_por: Counter = field(default_factory=Counter)
    eventos: Counter = field(default_factory=Counter)         # (papel, evento) -> quantas vezes
    destinos: Counter = field(default_factory=Counter)        # destino que o alvo deu aos eventos
    categorias: Counter = field(default_factory=Counter)
    comportamentos: Counter = field(default_factory=Counter)
    execucoes_por_etapa_max: int = 0

    @property
    def ok(self):
        return not self.com_violacao

    def primeira_semente_com_violacao(self, invariante=None):
        for x in self.com_violacao:
            if invariante is None or any(v.invariante == invariante for v in x.violacoes):
                return x.semente
        return None


def campanha(fabrica_de_alvo, sementes, cenario=None, max_passos=120, parar_na_primeira=False):
    """Roda várias sementes. 'fabrica_de_alvo' é uma função sem argumentos que devolve um alvo novo."""
    c = Campanha()
    for semente in sementes:
        x = rodar(fabrica_de_alvo(), semente, cenario, max_passos)
        c.total += 1
        c.desfechos[x.desfecho] += 1
        c.parou_por[x.parou_por] += 1
        c.categorias.update(x.categorias)
        c.comportamentos.update(x.comportamentos)
        for e, r in zip(x.eventos, x.respostas):
            c.eventos[(e.papel, e.evento)] += 1
            c.destinos[r.destino] += 1
        c.execucoes_por_etapa_max = max([c.execucoes_por_etapa_max] + [e.execucoes for e in x.foto_final.etapas.values()])
        if x.violacoes:
            c.com_violacao.append(x)
            c.por_invariante.update(v.invariante for v in x.violacoes)
            if parar_na_primeira:
                break
    return c
