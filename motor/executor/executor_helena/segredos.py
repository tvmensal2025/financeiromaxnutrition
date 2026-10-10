"""Detector de segredos: acha chaves, senhas e tokens em texto, ambiente e pastas.

Serve a três travas do executor:
  1. o ambiente do agente é construído do zero e nunca leva nome/valor que pareça segredo;
  2. o pacote que vai ao agente é recusado se trouxer um segredo colado;
  3. depois da execução, a pasta do perfil não pode ter guardado token (teste 2 do plano).

Nunca devolve o valor achado: só o código do tipo e o lugar. Os exemplos dos testes usam
valores "EXEMPLO_NAO_REAL".
"""

import re
from pathlib import Path
from typing import Iterable, List, Mapping, Optional, Tuple

# Nome de variável que denuncia segredo.
NOME_DE_SEGREDO = re.compile(r"(KEY|TOKEN|SECRET|PASSW|SENHA|CHAVE|CREDENTIAL|COOKIE|BEARER|SERVICE_ROLE)", re.I)

# Prefixos de variáveis de serviços que nunca devem chegar ao agente, mesmo com nome inocente.
PREFIXOS_PROIBIDOS = ("OPENAI_", "ANTHROPIC_", "SUPABASE_", "GITHUB_", "GH_", "TYPESAFE_", "AWS_", "AZURE_",
                      "GOOGLE_", "OPENROUTER_", "NOUS_", "HF_", "TELEGRAM_", "SLACK_", "DISCORD_", "DATABASE_",
                      "POSTGRES", "PG", "DBOS_", "HEALTHCHECKS_")

# Formatos conhecidos de segredo no VALOR (texto solto, arquivo ou variável).
PADROES_DE_VALOR = (
    ("CHAVE_SK", re.compile(r"\bsk-[A-Za-z0-9_\-]{16,}")),
    ("TOKEN_GITHUB", re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{16,}")),
    ("TOKEN_GITHUB_FINO", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}")),
    ("JWT", re.compile(r"\beyJ[A-Za-z0-9_\-]{6,}\.[A-Za-z0-9_\-]{6,}\.[A-Za-z0-9_\-]{6,}")),
    ("TOKEN_SUPABASE", re.compile(r"\bsbp_[A-Za-z0-9_]{16,}")),
    ("CHAVE_AWS", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("TOKEN_SLACK", re.compile(r"\bxox[baprs]-[A-Za-z0-9\-]{10,}")),
    ("CHAVE_GOOGLE", re.compile(r"\bAIza[0-9A-Za-z_\-]{30,}")),
    ("CHAVE_PRIVADA", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("URL_COM_SENHA", re.compile(r"\b[a-z][a-z0-9+.\-]*://[^\s/:@]+:[^\s/@]+@")),
    ("BEARER", re.compile(r"\bBearer\s+[A-Za-z0-9._\-]{20,}")),
)

# Arquivos que existem para guardar credencial.
ARQUIVOS_DE_CREDENCIAL = ("auth.json", ".env", ".netrc", "credentials", "credentials.json", "id_rsa", "id_ed25519")

TAMANHO_MAXIMO_LIDO = 1_000_000


def nome_parece_segredo(nome: str) -> bool:
    nome = nome.upper()
    return bool(NOME_DE_SEGREDO.search(nome)) or nome.startswith(PREFIXOS_PROIBIDOS)


def segredos_no_texto(texto: str) -> List[str]:
    """Códigos dos formatos de segredo achados no texto (sem repetir, sem o valor)."""
    achados = []
    for codigo, padrao in PADROES_DE_VALOR:
        if padrao.search(texto) and codigo not in achados:
            achados.append(codigo)
    return achados


def segredos_no_ambiente(ambiente: Mapping[str, str]) -> List[str]:
    """Lista 'NOME: motivo' para cada variável suspeita. Vazia = limpo."""
    achados = []
    for nome, valor in ambiente.items():
        if nome_parece_segredo(nome):
            achados.append(f"{nome}: nome de segredo")
            continue
        for codigo in segredos_no_texto(str(valor)):
            achados.append(f"{nome}: {codigo}")
    return achados


def _arquivo_de_texto(caminho: Path) -> Optional[str]:
    try:
        if caminho.stat().st_size > TAMANHO_MAXIMO_LIDO:
            return None
        dados = caminho.read_bytes()
    except OSError:
        return None
    if b"\0" in dados[:2048]:
        return None
    return dados.decode("utf-8", errors="replace")


def segredos_na_pasta(pasta: Path, *, ignorar: Iterable[str] = ()) -> List[Tuple[str, str]]:
    """Procura credencial guardada numa pasta de perfil. Devolve [(arquivo relativo, motivo)].

    Dois testes: o NOME do arquivo (auth.json, .env...) em qualquer profundidade, e o FORMATO do
    conteúdo nos arquivos de texto da raiz da pasta e de memories/. Pastas em `ignorar` (como
    skills/, que traz exemplos) não são olhadas.
    """
    pasta = Path(pasta)
    ignoradas = set(ignorar)
    achados: List[Tuple[str, str]] = []
    if not pasta.is_dir():
        return achados
    for caminho in sorted(pasta.rglob("*")):
        relativo = caminho.relative_to(pasta)
        if relativo.parts and relativo.parts[0] in ignoradas:
            continue
        if not caminho.is_file():
            continue
        if caminho.name in ARQUIVOS_DE_CREDENCIAL or caminho.name.startswith("auth.json"):
            achados.append((str(relativo), "ARQUIVO_DE_CREDENCIAL"))
            continue
        olhar_conteudo = len(relativo.parts) == 1 or relativo.parts[0] == "memories"
        if olhar_conteudo and caminho.suffix not in (".db", ".db-shm", ".db-wal"):
            texto = _arquivo_de_texto(caminho)
            for codigo in segredos_no_texto(texto) if texto else []:
                achados.append((str(relativo), codigo))
    return achados
