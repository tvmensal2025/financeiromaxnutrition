"""O registro dos executores aprovados: a única lista de runtimes que o motor de produção aceita.

O que é: trocar de runtime (Hermes, EVE, OpenClaw ou outro) é escolher um NOME aqui, sem mexer no motor,
nas fichas, no banco nem nas telas. O nome vem da variável de ambiente HELENA_V2_EXECUTOR (padrão: hermes).

Como funciona a segurança:
  - a lista mora no CÓDIGO (APROVADOS), revisada por pull request; configuração editável, ficha e tela
    não carregam plugin nem escolhem classe;
  - nome desconhecido, classe fora da lista ou runtime que não declara todas as garantias (Capacidades)
    fazem o motor recusar a partida (falha fechada);
  - cada adaptador declara os NOMES das variáveis de ambiente de que precisa (nunca valores).

Dois degraus:
  - APROVADOS: o que roda em produção. Só entra quem declara TODAS as garantias e passou na conformidade REAL.
  - EM_HOMOLOGACAO: adaptadores escritos e testados contra um FALSO do runtime, prontos para CONECTAR, mas ainda sem
    prova no runtime de verdade. Nunca rodam em produção: o motor recusa a partida e diz o que falta
    (`python -m orquestrador conferir-runtime` mostra a ficha de conexão de cada um, sem rede e sem valores).
    Promover = provar as garantias no runtime real e mover o Adaptador de EM_HOMOLOGACAO para APROVADOS por pull request.

Como adicionar um executor novo: veja motor/executor/README.md ("Como adicionar um executor novo").
Em resumo: escreva a classe com rodar, cancelar, limpar e capacidades; faça-a passar em
testes/test_conformidade.py; acrescente um Adaptador em EM_HOMOLOGACAO e, depois da prova real, em APROVADOS.
"""

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Mapping, Optional, Tuple

from .adaptador_eve import ExecutorEve
from .adaptador_eve import montar_config_do_ambiente as montar_config_da_eve
from .adaptador_openclaw import ExecutorOpenClaw
from .adaptador_openclaw import montar_config_do_ambiente as montar_config_do_openclaw
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


# --- OpenClaw (em homologação) -----------------------------------------------------------------------
VARIAVEIS_DO_OPENCLAW = ("HELENA_V2_OPENCLAW_BIN", "HELENA_V2_OPENCLAW_HOME", "HELENA_V2_EXECUCOES_DIR")


def _montar_openclaw(ambiente: Mapping[str, str]) -> Executor:
    return ExecutorOpenClaw(montar_config_do_openclaw(ambiente))


ADAPTADOR_OPENCLAW = Adaptador(nome="openclaw", classe=ExecutorOpenClaw, variaveis=VARIAVEIS_DO_OPENCLAW,
                               montar=_montar_openclaw)

# --- EVE (em homologação) ----------------------------------------------------------------------------
# HELENA_V2_EVE_TOKEN: credencial da rota do servidor da EVE (o valor só é lido na montagem; nunca impresso).
VARIAVEIS_DA_EVE = ("HELENA_V2_EVE_URL", "HELENA_V2_EVE_TOKEN", "HELENA_V2_EXECUCOES_DIR")


def _montar_eve(ambiente: Mapping[str, str]) -> Executor:
    return ExecutorEve(montar_config_da_eve(ambiente))


ADAPTADOR_EVE = Adaptador(nome="eve", classe=ExecutorEve, variaveis=VARIAVEIS_DA_EVE, montar=_montar_eve)

# Prontos para conectar, ainda NÃO aprovados para produção (veja o topo do arquivo). Cada um declara com honestidade o
# que está confirmado: o que falta aparece em `ficha_de_conexao`.
EM_HOMOLOGACAO: Tuple[Adaptador, ...] = (ADAPTADOR_OPENCLAW, ADAPTADOR_EVE)


def nomes_em_homologacao() -> Tuple[str, ...]:
    return tuple(adaptador.nome for adaptador in EM_HOMOLOGACAO)


def nomes_aprovados() -> Tuple[str, ...]:
    return tuple(adaptador.nome for adaptador in APROVADOS)


def classes_aprovadas() -> Tuple[type, ...]:
    return tuple(adaptador.classe for adaptador in APROVADOS)


def conferir_registro(aprovados: Tuple[Adaptador, ...] = APROVADOS, *, exigir_garantias: bool = True) -> None:
    """Levanta ErroDeRegistro se algum adaptador da lista não cumpre o contrato. Roda nos testes e na partida.

    `exigir_garantias=False` é para a lista EM_HOMOLOGACAO: confere a FORMA (classe, nome, variáveis) mas aceita garantias
    ainda não cumpridas, que ficam à mostra na ficha de conexão."""
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
        if exigir_garantias and faltando:
            raise ErroDeRegistro(f"{adaptador.nome}: faltam garantias exigidas pelo motor: {', '.join(faltando)}")
        if any(not nome.isupper() or " " in nome or "=" in nome for nome in adaptador.variaveis):
            raise ErroDeRegistro(f"{adaptador.nome}: as variáveis devem ser NOMES em maiúsculas, nunca valores")


def conferir_homologacao() -> None:
    """A lista EM_HOMOLOGACAO tem a forma certa e não se mistura com a de produção."""
    conferir_registro(EM_HOMOLOGACAO, exigir_garantias=False)
    repetidos = set(nomes_em_homologacao()) & set(nomes_aprovados())
    if repetidos:
        raise ErroDeRegistro(f"nome em homologação e aprovado ao mesmo tempo: {', '.join(sorted(repetidos))}")
    if set(classe for classe in (a.classe for a in EM_HOMOLOGACAO)) & set(classes_aprovadas()):
        raise ErroDeRegistro("a mesma classe está em homologação e aprovada")


def adaptador_configurado(ambiente: Optional[Mapping[str, str]] = None) -> Adaptador:
    """O adaptador escolhido por HELENA_V2_EXECUTOR (padrão: hermes). Nome desconhecido = erro."""
    ambiente = os.environ if ambiente is None else ambiente
    nome = (ambiente.get(VARIAVEL_DO_EXECUTOR) or EXECUTOR_PADRAO).strip().lower()
    conferir_registro()
    for adaptador in APROVADOS:
        if adaptador.nome == nome:
            return adaptador
    conferir_homologacao()
    for adaptador in EM_HOMOLOGACAO:
        if adaptador.nome == nome:
            faltando = ", ".join(adaptador.classe.capacidades.faltando_para_producao()) or "nenhuma (falta só a prova real)"
            raise ErroDeRegistro(
                f"executor {nome!r} está pronto para conectar, mas ainda não está no registro aprovado para produção "
                f"(garantias que faltam: {faltando}); veja `python -m orquestrador conferir-runtime`; "
                f"opções aprovadas: {', '.join(nomes_aprovados())}")
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


def ficha_de_conexao(adaptador: Adaptador, aprovado: bool, ambiente: Optional[Mapping[str, str]] = None) -> dict:
    """O que falta para CONECTAR este runtime: só NOMES (nunca valores) e garantias. Não abre rede nem arquivo."""
    ambiente = os.environ if ambiente is None else ambiente
    return {
        "nome": adaptador.nome,
        "estado": "APROVADO_PARA_PRODUCAO" if aprovado else "PRONTO_PARA_CONECTAR_NAO_APROVADO",
        "variaveis_exigidas": list(adaptador.variaveis),
        "variaveis_faltando": list(variaveis_faltando(adaptador, ambiente)),
        "garantias_faltando": list(adaptador.classe.capacidades.faltando_para_producao()),
        # o que a documentação oficial e os testes já dizem de cada garantia (só texto revisado no código, nunca valor)
        "o_que_se_sabe": dict(getattr(adaptador.classe, "estado_das_garantias", None) or {}),
    }


def fichas_de_conexao(ambiente: Optional[Mapping[str, str]] = None) -> list:
    """A ficha de cada runtime conhecido (aprovados primeiro) e qual deles o ambiente escolhe agora."""
    ambiente = os.environ if ambiente is None else ambiente
    escolhido = (ambiente.get(VARIAVEL_DO_EXECUTOR) or EXECUTOR_PADRAO).strip().lower()
    conferir_registro()
    conferir_homologacao()
    fichas = [ficha_de_conexao(a, True, ambiente) for a in APROVADOS] + [ficha_de_conexao(a, False, ambiente) for a in EM_HOMOLOGACAO]
    for ficha in fichas:
        ficha["escolhido"] = ficha["nome"] == escolhido
    return fichas
