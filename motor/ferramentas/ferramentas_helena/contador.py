"""Contador de chamadas por execução.

Os limites vêm da ficha (parâmetros). Contamos três coisas:
- total: toda chamada de ferramenta que chega (até a de ferramenta que não existe ou
  não foi liberada, senão um laço de chamadas inválidas nunca seria cortado);
- buscas: chamadas de "buscar";
- partes: partes de página ENTREGUES por "ler_pagina".

No limite (qualquer um dos três), o servidor passa para o "modo entrega": toda chamada
seguinte recebe "ENTREGUE AGORA" e nada é executado. Se o agente insistir mais
`insistencias_para_encerrar` vezes (padrão 3), a execução é encerrada com o motivo
"limite_de_chamadas" (no vocabulário do motor: LIMITE_CHAMADAS).

Contagem das recusas: a 1ª recusa é a resposta do limite; as 3 seguintes são as
insistências; a 3ª insistência (4ª recusa) encerra.
"""

from enum import Enum

MOTIVO_LIMITE = "limite_de_chamadas"
CLASSE_DO_MOTOR = "LIMITE_CHAMADAS"  # helena-v2/maquina/vocabulario.yaml


class Decisao(Enum):
    PERMITIDA = "permitida"
    ENTREGUE_AGORA = "entregue_agora"
    ENCERRAR = "encerrar"          # esta chamada acabou de encerrar a execução
    JA_ENCERRADA = "ja_encerrada"  # a execução já estava encerrada


class Contador:
    def __init__(self, max_total: int, max_buscas: int, max_partes: int,
                 insistencias_para_encerrar: int = 3):
        self.max_total = max_total
        self.max_buscas = max_buscas
        self.max_partes = max_partes
        self.insistencias_para_encerrar = insistencias_para_encerrar
        self.total = 0
        self.buscas = 0
        self.partes = 0
        self.recusadas = 0
        self.modo_entrega = False
        self.encerrada = False
        self.motivo = None

    @property
    def insistencias(self) -> int:
        return max(0, self.recusadas - 1)

    def autorizar(self, ferramenta: str, liberada: bool = True) -> Decisao:
        """Chamada antes de executar. Quem recebe PERMITIDA pode executar.

        `liberada` diz se a ferramenta está na lista da ficha. Ferramenta fora da lista
        conta no total (senão um laço de chamadas inválidas nunca seria cortado), mas
        os limites de buscas e de partes só valem para ferramentas liberadas.
        """
        if self.encerrada:
            return Decisao.JA_ENCERRADA
        if not self.modo_entrega and self._estouraria(ferramenta, liberada):
            self.modo_entrega = True
        if self.modo_entrega:
            self.recusadas += 1
            if self.insistencias >= self.insistencias_para_encerrar:
                self.encerrada = True
                self.motivo = MOTIVO_LIMITE
                return Decisao.ENCERRAR
            return Decisao.ENTREGUE_AGORA
        self.total += 1
        if liberada and ferramenta == "buscar":
            self.buscas += 1
        return Decisao.PERMITIDA

    def registrar_parte_entregue(self):
        self.partes += 1

    def _estouraria(self, ferramenta: str, liberada: bool) -> bool:
        if self.total + 1 > self.max_total:
            return True
        if liberada and ferramenta == "buscar" and self.buscas + 1 > self.max_buscas:
            return True
        if liberada and ferramenta == "ler_pagina" and self.partes + 1 > self.max_partes:
            return True
        return False

    def para_dict(self) -> dict:
        return {
            "total": self.total, "buscas": self.buscas, "partes": self.partes,
            "recusadas": self.recusadas, "modo_entrega": self.modo_entrega,
            "encerrada": self.encerrada, "motivo": self.motivo,
        }

    def carregar(self, dados: dict):
        self.total = int(dados["total"])
        self.buscas = int(dados["buscas"])
        self.partes = int(dados["partes"])
        self.recusadas = int(dados["recusadas"])
        self.modo_entrega = bool(dados["modo_entrega"])
        self.encerrada = bool(dados["encerrada"])
        self.motivo = dados.get("motivo")
