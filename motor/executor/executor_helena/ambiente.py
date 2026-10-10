"""Ambiente do processo do agente: construído do ZERO, só com o que está na lista permitida.

O ambiente do motor (que tem senhas, chaves do banco, tokens) NUNCA é copiado. Entra apenas:
  - o que o Hermes precisa para achar a sua pasta (HOME, HERMES_HOME, TMPDIR, PATH);
  - CODEX_HOME apontando para uma pasta VAZIA, para o Hermes não adotar o login do Codex;
  - travas do Hermes ligadas por variável (sem instalar nada, sem nova tentativa de conexão);
  - o fuso de Brasília e a marca da execução (usada para achar processos que sobrarem).

`extras` existe para casos como um proxy da VPS, mas cada um passa pelo detector de segredos.
"""

import re
from pathlib import Path
from typing import Dict, Mapping, Optional

from .segredos import nome_parece_segredo, segredos_no_texto
from .tipos import ErroDePerfil

MARCADOR = "HELENA_EXECUCAO"          # id da execução; também vai no env do servidor de ferramentas

FIXAS = {
    "LANG": "C.UTF-8",
    "LC_ALL": "C.UTF-8",
    "TZ": "America/Sao_Paulo",
    "HERMES_TIMEZONE": "America/Sao_Paulo",
    "PYTHONDONTWRITEBYTECODE": "1",
    "PYTHONNOUSERSITE": "1",
    "NO_COLOR": "1",
    "HERMES_DISABLE_LAZY_INSTALLS": "1",   # o Hermes não instala nada sozinho durante a tarefa
    "HERMES_STREAM_RETRIES": "0",          # sem nova tentativa interna de conexão (padrão do Hermes: 2)
    "HERMES_NONINTERACTIVE": "1",
}
NOMES_QUE_O_EXECUTOR_DEFINE = frozenset(FIXAS) | {"PATH", "HOME", "HERMES_HOME", "CODEX_HOME", "TMPDIR", MARCADOR}
PADRAO_DE_NOME = re.compile(r"^[A-Z][A-Z0-9_]*$")
PATH_SEGURO = "/usr/local/bin:/usr/bin:/bin"


def construir_ambiente(*, hermes_home: Path, home: Path, codex_home: Path, tmp: Path, id_execucao: str,
                       pasta_do_hermes: Optional[Path] = None,
                       extras: Optional[Mapping[str, str]] = None) -> Dict[str, str]:
    """Devolve o ambiente completo do processo. Não lê os.environ em momento nenhum."""
    caminho = PATH_SEGURO if pasta_do_hermes is None else f"{pasta_do_hermes}:{PATH_SEGURO}"
    ambiente = {
        **FIXAS,
        "PATH": caminho,
        "HOME": str(home),
        "HERMES_HOME": str(hermes_home),
        "CODEX_HOME": str(codex_home),
        "TMPDIR": str(tmp),
        MARCADOR: id_execucao,
    }
    for nome, valor in (extras or {}).items():
        if not isinstance(nome, str) or not PADRAO_DE_NOME.match(nome):
            raise ErroDePerfil(f"variável extra com nome inválido: {nome!r}.")
        if nome in NOMES_QUE_O_EXECUTOR_DEFINE:
            raise ErroDePerfil(f"variável extra {nome} é do executor e não pode ser trocada.")
        if nome_parece_segredo(nome):
            raise ErroDePerfil(f"variável extra {nome} tem nome de segredo: o agente nasce sem segredo.")
        if not isinstance(valor, str) or segredos_no_texto(valor):
            raise ErroDePerfil(f"variável extra {nome} tem valor com cara de segredo (ou não é texto).")
        ambiente[nome] = valor
    return ambiente
