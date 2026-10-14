"""O registro dos executores aprovados: a única lista de runtimes que o motor de produção aceita.

O que é: trocar de runtime (Hermes, EVE, OpenClaw ou outro) é escolher um NOME aqui, sem mexer no motor,
nas fichas, no banco nem nas telas. O nome vem da variável de ambiente HELENA_V2_EXECUTOR (padrão: hermes).

Como funciona a segurança:
  - a lista mora no CÓDIGO (APROVADOS), revisada por pull request; configuração editável, ficha e tela
    não carregam plugin nem escolhem classe;
  - nome desconhecido, classe fora da lista ou runtime que não declara todas as garantias (Capacidades)
    fazem o motor recusar a partida (falha fechada);
  - cada adaptador declara os NOMES das variáveis de ambiente de que precisa (nunca valores).

Como adicionar um executor novo: veja motor/executor/README.md ("Como adicionar um executor novo").
Em resumo: escreva a classe com rodar, cancelar, limpar e capacidades; faça-a passar em
testes/test_conformidade.py; acrescente um Adaptador em APROVADOS; só então ele pode rodar em produção.
"""

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Mapping, Optional, Tuple

from .executor import Executor, ExecutorHermes
from .perfil import ConfigDoExecutor
from .tipos import Capacidades

VARIAVEL_DO_EXECUTOR = "HELENA_V2_EXECUTOR"
EXECUTOR_PADRAO = "hermes"


class ErroDeRegistro(ValueError):
    """Executor desconhecido, mal configurado ou sem as garantias que o motor exige."""


@dataclass(frozen=True)
class Adaptador:
    nome: str                                           # igual a classe.capacidades.nome
    classe: type
    variaveis: Tuple[str, ...]                          # NOMES das variáveis de ambiente que o adaptador exige
    montar: Callable[[Mapping[str, str]], Executor]     # recebe o ambiente e devolve o executor pronto


# --- Hermes -----------------------------------------------------------------------------------------
VARIAVEIS_DO_HERMES = ("HELENA_V2_HERMES_BIN", "HELENA_V2_HERMES_HOME", "HELENA_V2_EXECUCOES_DIR")


def _montar_hermes(ambiente: Mapping[str, str]) -> Executor:
    binario = Path(ambiente["HELENA_V2_HERMES_BIN"])
    if not binario.is_absolute() or not binario.is_file() or not os.access(binario, os.X_OK):
        raise ValueError("executável Hermes não está preparado")
    return ExecutorHermes(ConfigDoExecutor(
        comando_hermes=(str(binario),), raiz_hermes=Path(ambiente["HELENA_V2_HERMES_HOME"]),
        pasta_das_execucoes=Path(ambiente["HELENA_V2_EXECUCOES_DIR"])))


ADAPTADOR_HERMES = Adaptador(nome="hermes", classe=ExecutorHermes, variaveis=VARIAVEIS_DO_HERMES, montar=_montar_hermes)

# A lista aprovada. EVE (Vercel), OpenClaw e outros entram aqui quando existir adaptador revisado e conforme.
APROVADOS: Tuple[Adaptador, ...] = (ADAPTADOR_HERMES,)


def nomes_aprovados() -> Tuple[str, ...]:
    return tuple(adaptador.nome for adaptador in APROVADOS)


def classes_aprovadas() -> Tuple[type, ...]:
    return tuple(adaptador.classe for adaptador in APROVADOS)


def conferir_registro(aprovados: Tuple[Adaptador, ...] = APROVADOS) -> None:
    """Levanta ErroDeRegistro se algum adaptador da lista não cumpre o contrato. Roda nos testes e na partida."""
    vistos = set()
    for adaptador in aprovados:
        if adaptador.nome in vistos:
            raise ErroDeRegistro(f"nome de executor repetido no registro: {adaptador.nome}")
        vistos.add(adaptador.nome)
        if not (isinstance(adaptador.classe, type) and issubclass(adaptador.classe, Executor)):
            raise ErroDeRegistro(f"{adaptador.nome}: a classe não é um Executor")
        if getattr(adaptador.classe, "__abstractmethods__", None):
            raise ErroDeRegistro(f"{adaptador.nome}: a classe deixou métodos do contrato sem implementar")
        capacidades = adaptador.classe.capacidades
        if not isinstance(capacidades, Capacidades):
            raise ErroDeRegistro(f"{adaptador.nome}: 'capacidades' deve ser um atributo de classe do tipo Capacidades")
        if capacidades.nome != adaptador.nome:
            raise ErroDeRegistro(f"{adaptador.nome}: o nome declarado nas capacidades é {capacidades.nome!r}")
        faltando = capacidades.faltando_para_producao()
        if faltando:
            raise ErroDeRegistro(f"{adaptador.nome}: faltam garantias exigidas pelo motor: {', '.join(faltando)}")
        if any(not nome.isupper() or " " in nome or "=" in nome for nome in adaptador.variaveis):
            raise ErroDeRegistro(f"{adaptador.nome}: as variáveis devem ser NOMES em maiúsculas, nunca valores")


def adaptador_configurado(ambiente: Optional[Mapping[str, str]] = None) -> Adaptador:
    """O adaptador escolhido por HELENA_V2_EXECUTOR (padrão: hermes). Nome desconhecido = erro."""
    ambiente = os.environ if ambiente is None else ambiente
    nome = (ambiente.get(VARIAVEL_DO_EXECUTOR) or EXECUTOR_PADRAO).strip().lower()
    conferir_registro()
    for adaptador in APROVADOS:
        if adaptador.nome == nome:
            return adaptador
    raise ErroDeRegistro(f"executor {nome!r} não está no registro aprovado; opções: {', '.join(nomes_aprovados())}")


def variaveis_faltando(adaptador: Adaptador, ambiente: Optional[Mapping[str, str]] = None) -> Tuple[str, ...]:
    ambiente = os.environ if ambiente is None else ambiente
    return tuple(nome for nome in adaptador.variaveis if not ambiente.get(nome))


def montar_executor(ambiente: Optional[Mapping[str, str]] = None) -> Executor:
    """Escolhe o adaptador pelo nome configurado, confere o ambiente e devolve o executor pronto."""
    ambiente = os.environ if ambiente is None else ambiente
    adaptador = adaptador_configurado(ambiente)
    faltando = variaveis_faltando(adaptador, ambiente)
    if faltando:
        raise ErroDeRegistro(f"executor {adaptador.nome}: faltam variáveis de ambiente: {', '.join(faltando)}")
    executor = adaptador.montar(ambiente)
    if type(executor) is not adaptador.classe:
        raise ErroDeRegistro(f"executor {adaptador.nome}: o montador devolveu outra classe")
    return executor
