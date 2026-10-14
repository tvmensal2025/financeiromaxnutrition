"""Tipos e nomes do executor. Só dados: nenhuma regra de negócio mora aqui.

Os nomes das classes de falha são os de helena-v2/maquina/vocabulario.yaml (classes_de_falha).
"""

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Mapping, Optional, Tuple

# --- classes de falha (vocabulario.yaml) ---------------------------------------------------------
COTA = "COTA"
LOGIN = "LOGIN"
PROVEDOR = "PROVEDOR"
QUEDA = "QUEDA"
FERRAMENTA = "FERRAMENTA"
TEMPO = "TEMPO"
LIMITE_CHAMADAS = "LIMITE_CHAMADAS"
GRANDE_DEMAIS = "GRANDE_DEMAIS"
FORMATO_ERRADO = "FORMATO_ERRADO"
DESCONHECIDA = "DESCONHECIDA"

# Só estas dez podem sair do executor. BANCO e SITE existem no vocabulário mas não são do executor.
CLASSES_DE_FALHA = (COTA, LOGIN, PROVEDOR, QUEDA, FERRAMENTA, TEMPO, LIMITE_CHAMADAS,
                    GRANDE_DEMAIS, FORMATO_ERRADO, DESCONHECIDA)

# Igual a vocabulario.yaml (gasta_tentativa de cada classe). Um teste confere com o arquivo.
GASTA_TENTATIVA = {
    COTA: False, LOGIN: False, PROVEDOR: False, QUEDA: False, FERRAMENTA: False,
    TEMPO: True, LIMITE_CHAMADAS: True, GRANDE_DEMAIS: True, FORMATO_ERRADO: True, DESCONHECIDA: True,
}

# Por que o executor encerrou o processo (quando foi ele).
ENCERRADO_POR_TEMPO = "TEMPO"
ENCERRADO_POR_CANCELAMENTO = "CANCELAMENTO"
ENCERRADO_POR_LIMITE = "LIMITE_CHAMADAS"

PADRAO_DO_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")

PAPEIS = ("AUTOR", "REVISOR", "COORDENACAO")


class ErroDeFicha(ValueError):
    """A ficha não serve para montar uma execução (campo faltando, ferramenta que não só lê...)."""


class ErroDePerfil(ValueError):
    """Não dá para montar o perfil com segurança (pasta dentro de um repositório, segredo no pacote...)."""


# --- ficha ---------------------------------------------------------------------------------------
@dataclass(frozen=True)
class Orcamento:
    buscas: int
    partes_de_pagina: int
    chamadas_total: int
    tempo_s: int


@dataclass(frozen=True)
class FichaDoServico:
    """O que uma execução precisa saber da ficha do agente (já resolvido para UM papel)."""
    agente_id: str
    identidade: str
    nome: str
    funcao: str
    papel: str                      # AUTOR | REVISOR | COORDENACAO
    servico: Optional[str]          # SRV-... (AUTOR) ou o evento da Helena (COORDENACAO)
    ferramentas: Tuple[str, ...]    # por extenso: "ler_pagina", "buscar". () = servidor vazio
    orcamento: Orcamento
    acoes_permitidas: Tuple[str, ...]
    apelido_do_modelo: str
    modelo: str
    provedor: str
    missao: str
    regras: Tuple[str, ...]
    nunca: Tuple[str, ...]
    versao_da_ficha: str
    formato_da_ficha: str           # "3.1" ou "antigo" (convertido; veja README)
    avisos: Tuple[str, ...] = ()


# --- execução ------------------------------------------------------------------------------------
# Verificador de formato: recebe o texto de uma execução INTEIRA e devolve None (formato bom) ou um
# código curto do defeito. Quem passa é o motor (o validador); o executor não conhece o formato.
VerificadorDeFormato = Callable[[str], Optional[str]]


@dataclass(frozen=True)
class Execucao:
    id: str                                     # ex.: "E-123-n4" (etapa + número da execução)
    ficha: FichaDoServico
    pacote: str                                 # o texto que o agente recebe (card, modelo, ações...)
    tempo_max_s: Optional[float] = None         # padrão: ficha.orcamento.tempo_s
    fontes_permitidas: Optional[Tuple[str, ...]] = None   # endereços que ler_pagina pode abrir
    verificador_de_formato: Optional[VerificadorDeFormato] = None

    def __post_init__(self):
        if not isinstance(self.id, str) or not PADRAO_DO_ID.match(self.id):
            raise ErroDePerfil("id da execução inválido: use letras, números, ponto, hífen ou sublinhado (até 80).")
        if not isinstance(self.pacote, str) or not self.pacote.strip():
            raise ErroDePerfil("o pacote da execução está vazio.")

    @property
    def tempo_efetivo_s(self) -> float:
        return float(self.tempo_max_s if self.tempo_max_s is not None else self.ficha.orcamento.tempo_s)


# --- garantias que o motor exige de qualquer executor --------------------------------------------
@dataclass(frozen=True)
class Capacidades:
    """O que um executor DECLARA garantir. O motor de produção só aceita quem garante tudo isto, e a suíte
    de conformidade (testes/test_conformidade.py) confere cada garantia contra o comportamento real.

    Quem escreve um adaptador novo (Hermes, EVE, OpenClaw ou outro) responde aqui, em código revisado.
    """
    nome: str                               # nome curto e estável do runtime (vai na variável HELENA_V2_EXECUTOR)
    cancela_em_ate_s: float                 # tempo máximo para encerrar uma execução cancelada (exigido: até 15)
    ferramentas_por_extenso: bool           # recebe a lista exata de ferramentas; lista vazia = nenhuma (B-6)
    confere_modelo_e_provedor: bool         # lê do registro do PRÓPRIO runtime qual modelo e provedor rodaram
    sem_reserva_escondida: bool             # nunca troca de modelo ou provedor sozinho (plano v3, C-15)
    limita_chamadas: bool                   # corta o laço de chamadas pelo orçamento da ficha
    falha_vem_do_registro: bool             # classifica a falha pelo registro do runtime, nunca pelo texto do agente
    guarda_conversa: bool                   # devolve a conversa para o motor guardar antes de limpar

    TETO_DE_CANCELAMENTO_S = 15.0

    def faltando_para_producao(self) -> Tuple[str, ...]:
        """Nomes das garantias que faltam. Vazio = o runtime cumpre tudo o que o motor exige."""
        faltando = [nome for nome in ("ferramentas_por_extenso", "confere_modelo_e_provedor", "sem_reserva_escondida",
                                      "limita_chamadas", "falha_vem_do_registro", "guarda_conversa")
                    if getattr(self, nome) is not True]
        if not isinstance(self.cancela_em_ate_s, (int, float)) or not 0 < self.cancela_em_ate_s <= self.TETO_DE_CANCELAMENTO_S:
            faltando.append("cancela_em_ate_s")
        if not isinstance(self.nome, str) or not re.fullmatch(r"[a-z][a-z0-9_-]{0,31}", self.nome):
            faltando.append("nome")
        return tuple(faltando)


# --- resultado -----------------------------------------------------------------------------------
@dataclass(frozen=True)
class Falha:
    classe: str
    codigo: str                     # motivo curto e estável (ex.: "HTTP_429")
    detalhe: str = ""               # frase curta para o aviso; nunca texto do agente
    voltar_em_s: Optional[int] = None   # COTA: quando a cota volta, se o provedor informou

    def __post_init__(self):
        if self.classe not in CLASSES_DE_FALHA:
            raise ValueError(f"classe de falha desconhecida: {self.classe!r}")

    @property
    def gasta_tentativa(self) -> bool:
        return GASTA_TENTATIVA[self.classe]


@dataclass(frozen=True)
class Problema:
    """Um defeito achado na conferência pós-execução."""
    classe: str                     # classe de falha que o motor deve usar
    codigo: str
    detalhe: str = ""


@dataclass(frozen=True)
class Conferencia:
    problemas: Tuple[Problema, ...] = ()
    avisos: Tuple[str, ...] = ()    # coisas a saber que não invalidam (ex.: provedor de teste)

    @property
    def ok(self) -> bool:
        return not self.problemas


@dataclass(frozen=True)
class RegistroDeUso:
    """Fatos da execução, cada um com a origem anotada em `origem`."""
    modelo: Optional[str] = None
    provedor: Optional[str] = None
    chamadas_ao_modelo: Optional[int] = None
    tokens_entrada: Optional[int] = None
    tokens_saida: Optional[int] = None
    tokens_total: Optional[int] = None
    completo: Optional[bool] = None             # o Hermes diz que terminou inteira
    falhou: Optional[bool] = None               # o Hermes diz que falhou
    id_da_sessao: Optional[str] = None
    chamadas_de_ferramenta: Optional[int] = None    # as que chegaram ao nosso servidor
    usou_internet: Optional[bool] = None
    origem: Mapping[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class Resultado:
    texto: Optional[str]                        # só existe se a execução terminou inteira e foi conferida
    terminou_inteira: bool
    uso: RegistroDeUso
    codigo_de_saida: Optional[int]              # negativo = morto por sinal; None = nem chegou a rodar
    ferramentas_recebidas: Tuple[str, ...]      # as que o Hermes listou do nosso servidor
    modelo_usado: Optional[str]
    provedor_usado: Optional[str]
    tempo_s: float
    falha: Optional[Falha]
    conferencia: Conferencia
    cancelada: bool = False
    encerrado_por: Optional[str] = None         # TEMPO | CANCELAMENTO | LIMITE_CHAMADAS (quando foi o executor)
    tempo_para_encerrar_s: Optional[float] = None
    sobras: Tuple[int, ...] = ()                # processos que não morreram (deve ser vazio)
    pasta: Optional[Path] = None                # pasta da execução (cópias das páginas, registro das ferramentas)
    conversa: Tuple[Mapping[str, Any], ...] = ()    # a conversa gravada pelo Hermes (o motor guarda no banco)
    comando: Tuple[str, ...] = ()               # o que foi lançado (o texto do pacote vai resumido)

    @property
    def ok(self) -> bool:
        return self.terminou_inteira and self.falha is None and self.conferencia.ok and not self.cancelada
