"""Parâmetros de UMA execução do servidor de ferramentas.

Os números vêm da ficha do serviço (helena-v2/agents/*.yaml, bloco orcamento):
buscas, partes_de_pagina, chamadas_total. O motor traduz a ficha para estes campos.

Regras:
- A lista de ferramentas é SEMPRE por extenso, sem valor padrão. Lista vazia = "servidor
  vazio": não libera nada (no Hermes, lista vazia liberaria todas; aqui nunca).
- A lista de endereços também é explícita: uma tupla de endereços permitidos, ou None
  para "qualquer endereço público". Não há valor padrão.
"""

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple

from .erros import ErroDeConfiguracao

FERRAMENTAS_CONHECIDAS = ("ler_pagina", "buscar")
TAMANHO_MAXIMO_DA_PARTE = 20_000  # o Hermes corta resposta grande; por isso 20 mil
PADRAO_DA_EXECUCAO = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")


@dataclass(frozen=True)
class Parametros:
    execucao: str                     # identificador da execução (ex.: "E-123-n4")
    diretorio: Path                   # pasta da execução: registro, estado e cópias
    ferramentas: Tuple[str, ...]      # por extenso; () = servidor vazio
    max_total: int                    # chamadas_total da ficha (só as que chegam aqui)
    lista_de_enderecos: Optional[Tuple[str, ...]]  # None = qualquer endereço público
    max_buscas: int = 0               # buscas da ficha (vale se "buscar" estiver na lista)
    max_partes: int = 0               # partes_de_pagina da ficha (vale com "ler_pagina")
    tamanho_parte: int = TAMANHO_MAXIMO_DA_PARTE
    tempo_leitura_s: float = 20.0     # tempo total de UMA leitura, com redirecionamentos
    max_bytes: int = 3_000_000        # corpo máximo baixado (já descomprimido)
    max_caracteres: int = 800_000     # texto máximo depois da limpeza (40 partes de 20 mil)
    max_redirecionamentos: int = 3
    redirecionar_para_outro_dominio: bool = False  # catálogo: não segue para outro domínio
    insistencias_para_encerrar: int = 3

    def __post_init__(self):
        def recusar(texto):
            raise ErroDeConfiguracao(texto)

        if not isinstance(self.execucao, str) or not PADRAO_DA_EXECUCAO.match(self.execucao):
            recusar("execucao inválida: use letras, números, ponto, hífen ou sublinhado (até 80).")
        if not isinstance(self.diretorio, Path):
            recusar("diretorio precisa ser um Path.")
        if not isinstance(self.ferramentas, (tuple, list)) or isinstance(self.ferramentas, str):
            recusar("ferramentas precisa ser uma lista por extenso (pode ser vazia).")
        ferramentas = tuple(self.ferramentas)
        for nome in ferramentas:
            if nome not in FERRAMENTAS_CONHECIDAS:
                recusar(f"ferramenta desconhecida: {nome!r}. Só existem {FERRAMENTAS_CONHECIDAS}.")
        if len(set(ferramentas)) != len(ferramentas):
            recusar("ferramentas repetidas na lista.")
        object.__setattr__(self, "ferramentas", ferramentas)

        for campo in ("max_total", "max_buscas", "max_partes", "insistencias_para_encerrar",
                      "max_bytes", "max_caracteres", "max_redirecionamentos", "tamanho_parte"):
            valor = getattr(self, campo)
            if isinstance(valor, bool) or not isinstance(valor, int):
                recusar(f"{campo} precisa ser um número inteiro.")
        if self.max_total < 1:
            recusar("max_total precisa ser pelo menos 1.")
        if self.max_buscas < 0 or self.max_partes < 0 or self.max_redirecionamentos < 0:
            recusar("limites não podem ser negativos.")
        if self.insistencias_para_encerrar < 1:
            recusar("insistencias_para_encerrar precisa ser pelo menos 1.")
        if not 50 <= self.tamanho_parte <= TAMANHO_MAXIMO_DA_PARTE:
            recusar(f"tamanho_parte precisa estar entre 50 e {TAMANHO_MAXIMO_DA_PARTE}.")
        if self.max_bytes < 1000 or self.max_caracteres < 1:
            recusar("max_bytes e max_caracteres precisam ser positivos.")
        if not isinstance(self.tempo_leitura_s, (int, float)) or self.tempo_leitura_s <= 0:
            recusar("tempo_leitura_s precisa ser positivo.")

        # Só vale o limite das ferramentas que estão na lista.
        if "buscar" in ferramentas and self.max_buscas < 1:
            recusar("'buscar' está na lista, mas max_buscas é 0.")
        if "ler_pagina" in ferramentas and self.max_partes < 1:
            recusar("'ler_pagina' está na lista, mas max_partes é 0.")
        previsto = (self.max_buscas if "buscar" in ferramentas else 0) \
            + (self.max_partes if "ler_pagina" in ferramentas else 0)
        if self.max_total < previsto:
            recusar("max_total menor que buscas + partes: a ficha não fecha a conta.")

        if self.lista_de_enderecos is not None:
            if isinstance(self.lista_de_enderecos, str) or \
                    not all(isinstance(e, str) for e in self.lista_de_enderecos):
                recusar("lista_de_enderecos precisa ser uma tupla de textos, ou None.")
            object.__setattr__(self, "lista_de_enderecos", tuple(self.lista_de_enderecos))
