"""Formato do que o validador devolve: uma Falha por item que não passou, e um Relatorio com tudo."""
from dataclasses import dataclass, field

VERSAO = "1.0.0"


@dataclass
class Falha:
    """Um item que não passou numa checagem.

    id        ID estável da checagem (CHK-...).
    motivo    código curto do defeito (ex.: CITACAO_CORTADA); estável, serve para os testes.
    item      onde está o problema (ex.: entrega.fatos_com_fonte[2].citacoes[0]).
    trecho    pedaço do texto que falhou (curto).
    mensagem  o que corrigir, em português simples.
    gravidade RECUSA (volta ao autor) ou MARCA (segue com marca na faixa). Preenchida pelo registro.
    """
    id: str
    motivo: str
    item: str
    mensagem: str
    trecho: str = ""
    gravidade: str = ""

    def para_dict(self) -> dict:
        return {
            "id": self.id,
            "gravidade": self.gravidade,
            "motivo": self.motivo,
            "item": self.item,
            "trecho": self.trecho,
            "mensagem": self.mensagem,
        }


@dataclass
class ResultadoDaChecagem:
    id: str
    nome: str
    status: str  # PASSOU | FALHOU | NAO_SE_APLICA
    fecha_furos: list
    o_que_fecha: str
    falhas: list = field(default_factory=list)

    def para_dict(self) -> dict:
        return {
            "id": self.id,
            "nome": self.nome,
            "status": self.status,
            "fecha_furos": self.fecha_furos,
            "o_que_fecha": self.o_que_fecha,
            "falhas": [f.para_dict() for f in self.falhas],
        }


@dataclass
class Relatorio:
    veredito: str  # APROVADA | APROVADA_COM_MARCAS | RECUSADA
    checagens: list
    premissas: list
    tempo_ms: float

    @property
    def aprovada(self) -> bool:
        return self.veredito != "RECUSADA"

    @property
    def falhas(self) -> list:
        return [f for c in self.checagens for f in c.falhas]

    @property
    def recusas(self) -> list:
        return [f for f in self.falhas if f.gravidade == "RECUSA"]

    @property
    def marcas(self) -> list:
        return [f for f in self.falhas if f.gravidade == "MARCA"]

    def ids_que_falharam(self, gravidade: str | None = None) -> set:
        return {f.id for f in self.falhas if gravidade is None or f.gravidade == gravidade}

    def falhas_de(self, id_: str) -> list:
        return [f for f in self.falhas if f.id == id_]

    def para_dict(self) -> dict:
        return {
            "versao_do_validador": VERSAO,
            "veredito": self.veredito,
            "aprovada": self.aprovada,
            "resumo": {
                "recusas": len(self.recusas),
                "marcas": len(self.marcas),
                "checagens_que_rodaram": sum(1 for c in self.checagens if c.status != "NAO_SE_APLICA"),
                "checagens_no_total": len(self.checagens),
            },
            "recusas": [f.para_dict() for f in self.recusas],
            "marcas": [f.para_dict() for f in self.marcas],
            "premissas": self.premissas,
            "checagens": [c.para_dict() for c in self.checagens],
            "tempo_ms": round(self.tempo_ms, 2),
        }
