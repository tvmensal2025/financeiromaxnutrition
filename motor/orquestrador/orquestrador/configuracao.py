"""Revisões imutáveis dos documentos da especificação usados pelo motor local.

O bundle contém dados YAML/JSON parseados, nunca código executável. A impressão local
é uma guarda de integridade do snapshot; o hash de ``jsonb::text`` é calculado pelo
PostgreSQL e continua sendo a autoridade para o registro SQL.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import tempfile

from spec_helena import Spec
from spec_helena.leitura import ler_yaml

RAIZ_REPO = Path(__file__).resolve().parents[3]
RAIZ_BASE = RAIZ_REPO / "helena-v2"
PREFIXO = "helena-v2/"
MAQUINA = frozenset((
    "helena-v2/maquina/passagens.yaml",
    "helena-v2/maquina/vocabulario.yaml",
    "helena-v2/maquina/jornada.schema.json",
))
OBRIGATORIOS = MAQUINA | frozenset((
    "helena-v2/servicos.yaml", "helena-v2/organograma.yaml",
    "helena-v2/models.yaml",
    *(f"helena-v2/schemas/{nome}.schema.json" for nome in
      ("agent", "entrega", "acao", "card", "plano", "playbook")),
))
SCHEMAS = frozenset(p for p in OBRIGATORIOS if "/schemas/" in p)
TECNICOS = MAQUINA | SCHEMAS
MAX_DOCUMENTOS = 400
MAX_DOCUMENTO_BYTES = 512_000
MAX_BUNDLE_BYTES = 8_000_000
MAX_PROFUNDIDADE = 64


def _caminho_permitido(nome: str) -> bool:
    if not isinstance(nome, str) or not nome.startswith(PREFIXO):
        return False
    partes = nome.split("/")
    if (len(partes) < 2 or partes[0] != "helena-v2" or
            any(p in ("", ".", "..") or len(p) > 255 for p in partes) or "\\" in nome):
        return False
    relativo = "/".join(partes[1:])
    if relativo in {"servicos.yaml", "organograma.yaml", "models.yaml"}:
        return True
    if relativo in {"maquina/passagens.yaml", "maquina/vocabulario.yaml", "maquina/jornada.schema.json"}:
        return True
    pasta = partes[1]
    if len(partes) != 3:
        return False
    arquivo = partes[2]
    if pasta in {"agents", "deliverables", "playbooks"}:
        return re.fullmatch(r"[a-z0-9_-]+\.yaml", arquivo) is not None
    if pasta == "schemas":
        return re.fullmatch(r"[a-z0-9_-]+\.schema\.json", arquivo) is not None
    return False


def _json_canonico(valor) -> bytes:
    try:
        return json.dumps(valor, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
                          allow_nan=False).encode("utf-8")
    except (TypeError, ValueError, RecursionError) as erro:
        raise ValueError("documento não pode ser representado em JSON") from erro


def _validar_forma(bundle: dict) -> bytes:
    if not isinstance(bundle, dict) or not OBRIGATORIOS <= bundle.keys():
        raise ValueError("bundle sem os documentos obrigatórios")
    if len(bundle) > MAX_DOCUMENTOS:
        raise ValueError("bundle excede o limite de documentos")
    for caminho, documento in bundle.items():
        if not _caminho_permitido(caminho):
            raise ValueError(f"caminho de configuração não permitido: {caminho!r}")
        if not isinstance(documento, (dict, list)):
            raise ValueError(f"documento deve ser objeto ou lista: {caminho}")
        pilha = [(documento, 1, frozenset())]
        while pilha:
            atual, nivel, ancestrais = pilha.pop()
            if nivel > MAX_PROFUNDIDADE:
                raise ValueError(f"documento excede a profundidade: {caminho}")
            if isinstance(atual, (dict, list)):
                if id(atual) in ancestrais:
                    raise ValueError(f"documento contém ciclo: {caminho}")
                novos = ancestrais | {id(atual)}
                pilha.extend((v, nivel + 1, novos) for v in
                             (atual.values() if isinstance(atual, dict) else atual))
        bruto = _json_canonico(documento)
        if len(bruto) > MAX_DOCUMENTO_BYTES:
            raise ValueError(f"documento excede o limite: {caminho}")
        if caminho.endswith(".json"):
            def conferir_refs(valor):
                if isinstance(valor, dict):
                    for chave, item in valor.items():
                        if chave in {"$ref", "$dynamicRef", "$recursiveRef"} and (
                                not isinstance(item, str) or not item.startswith("#/")):
                            raise ValueError(f"referência externa ou inválida: {caminho}")
                        if chave == "$schema" and item != "https://json-schema.org/draft/2020-12/schema":
                            raise ValueError(f"versão de esquema desconhecida: {caminho}")
                        if chave == "$id" and (not isinstance(item, str) or
                                               ":" in item or item.startswith("/") or
                                               ".." in item.split("/")):
                            raise ValueError(f"identificador remoto ou absoluto: {caminho}")
                        conferir_refs(item)
                elif isinstance(valor, list):
                    for item in valor:
                        conferir_refs(item)
            conferir_refs(documento)
    canonico = _json_canonico(bundle)
    if len(canonico) > MAX_BUNDLE_BYTES:
        raise ValueError("bundle excede o limite total")
    return canonico


def hash_bundle(bundle: dict) -> str:
    """SHA256 canônico local (distinto do hash de ``jsonb::text`` do SQL)."""
    return hashlib.sha256(_validar_forma(bundle)).hexdigest()


def impressao_maquina(bundle: dict) -> str:
    """Mesmo algoritmo de ``maquina/provar.py`` usado em meta_tabela."""
    _validar_forma(bundle)
    maquina = {"v": bundle["helena-v2/maquina/vocabulario.yaml"],
               "t": bundle["helena-v2/maquina/passagens.yaml"]}
    return hashlib.sha256(_json_canonico(maquina)).hexdigest()[:16]


def capturar_bundle(raiz: Path = RAIZ_BASE) -> dict[str, object]:
    """Captura somente a lista fechada de documentos da configuração v2."""
    raiz = Path(raiz)
    _sem_links_no_caminho(raiz)
    caminhos = [raiz / p.removeprefix(PREFIXO) for p in OBRIGATORIOS]
    for pasta in ("agents", "deliverables", "playbooks", "schemas"):
        caminhos.extend((raiz / pasta).glob("*.yaml" if pasta != "schemas" else "*.json"))
    bundle = {}
    for arquivo in sorted(set(caminhos)):
        _sem_links_no_caminho(arquivo)
        if arquivo.is_symlink() or not arquivo.is_file():
            raise ValueError(f"arquivo de configuração ausente ou link: {arquivo.name}")
        if arquivo.stat().st_size > MAX_DOCUMENTO_BYTES:
            raise ValueError(f"documento excede o limite: {arquivo.name}")
        nome = PREFIXO + arquivo.relative_to(raiz).as_posix()
        bundle[nome] = json.loads(arquivo.read_text(encoding="utf-8")) if nome.endswith(".json") else ler_yaml(arquivo)
    _validar_forma(bundle)
    return bundle


def _verificar_materializado(destino: Path, bundle: dict, impressao: str) -> None:
    _sem_links_no_caminho(destino)
    marcador = destino / ".bundle.sha256"
    raiz = destino / "helena-v2"
    if marcador.is_symlink() or raiz.is_symlink():
        raise ValueError("snapshot contém link simbólico")
    if not marcador.is_file() or marcador.read_text(encoding="ascii").strip() != impressao:
        raise ValueError("snapshot existente não corresponde à revisão solicitada")
    if any(p.is_symlink() for p in raiz.rglob("*")):
        raise ValueError("snapshot contém link simbólico")
    achados = {p.relative_to(destino).as_posix() for p in raiz.rglob("*") if p.is_file()}
    if achados != set(bundle):
        raise ValueError("arquivos do snapshot foram alterados")
    for nome, documento in bundle.items():
        arquivo = destino / nome
        if arquivo.is_symlink() or not arquivo.is_file():
            raise ValueError("arquivo do snapshot foi substituído")
        atual = json.loads(arquivo.read_text(encoding="utf-8")) if nome.endswith(".json") else ler_yaml(arquivo)
        if _json_canonico(atual) != _json_canonico(documento):
            raise ValueError("conteúdo do snapshot foi alterado")


def _sem_links_no_caminho(caminho: Path) -> None:
    caminho = caminho.absolute()
    if any(p.is_symlink() for p in (caminho, *caminho.parents)):
        raise ValueError("caminho do snapshot contém link simbólico")


def verificar_revisao(bundle: dict, destino: Path) -> None:
    """Confira os arquivos antes de usá-los após cache/reinício."""
    _verificar_materializado(Path(destino), bundle, hash_bundle(bundle))


def _liberar_diretorios(raiz: Path) -> None:
    if raiz.exists():
        raiz.chmod(0o700)
        for pasta in raiz.rglob("*"):
            if pasta.is_dir():
                pasta.chmod(0o700)


def materializar_bundle(bundle: dict, destino: Path, *, somente_leitura: bool = True) -> Path:
    """Cria snapshot de dados sob ``destino/helena-v2``; não sobrescreve revisão."""
    impressao = hash_bundle(bundle)
    destino = Path(destino)
    _sem_links_no_caminho(destino)
    if destino.exists():
        _verificar_materializado(destino, bundle, impressao)
        return destino / "helena-v2"
    destino.parent.mkdir(parents=True, exist_ok=True)
    temporario = Path(tempfile.mkdtemp(prefix=".helena-config-", dir=destino.parent))
    try:
        for nome, documento in sorted(bundle.items()):
            arquivo = temporario / nome
            arquivo.parent.mkdir(parents=True, exist_ok=True)
            if nome.endswith(".json"):
                texto = json.dumps(documento, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
            else:
                import yaml
                texto = yaml.safe_dump(documento, allow_unicode=True, sort_keys=True)
            arquivo.write_text(texto, encoding="utf-8")
            arquivo.chmod(0o444)
        (temporario / ".bundle.sha256").write_text(impressao + "\n", encoding="ascii")
        (temporario / ".bundle.sha256").chmod(0o444)
        if somente_leitura:
            for diretorio in sorted((p for p in temporario.rglob("*") if p.is_dir()),
                                    key=lambda p: len(p.parts), reverse=True):
                diretorio.chmod(0o555)
            temporario.chmod(0o555)
        try:
            os.rename(temporario, destino)
        except OSError:
            if not destino.exists():
                raise
            _verificar_materializado(destino, bundle, impressao)
    finally:
        if temporario.exists():
            _liberar_diretorios(temporario)
            shutil.rmtree(temporario)
    _verificar_materializado(destino, bundle, impressao)
    return destino / "helena-v2"


def carregar_revisao(bundle: dict, hash_esperado: str, destino: Path) -> tuple[Spec, Path]:
    """Confere o hash canônico recebido e devolve Spec + raiz de fichas/modelos."""
    if hash_bundle(bundle) != hash_esperado:
        raise ValueError("hash local da revisão não corresponde ao conteúdo")
    raiz = materializar_bundle(bundle, destino)
    return Spec(raiz), raiz


def validar_bundle(bundle: dict, *, raiz_maquina: Path = RAIZ_BASE) -> None:
    """Aplica o validador existente e compara a máquina com o SQL compilado.

    O replay das jornadas usa o provador do checkout confiável, pois o bundle
    contém exclusivamente dados. O chamador ainda deve conferir
    ``helena_v2.tabela_confere()`` e a impressão de ``meta_tabela`` no banco.
    """
    _validar_forma(bundle)
    raiz_maquina = Path(raiz_maquina)
    for nome in TECNICOS:
        base = raiz_maquina / nome.removeprefix(PREFIXO)
        atual = json.loads(base.read_text(encoding="utf-8")) if nome.endswith(".json") else ler_yaml(base)
        if _json_canonico(bundle[nome]) != _json_canonico(atual):
            raise ValueError("máquina ou schema técnico diferente da versão compilada; exige migração")
    with tempfile.TemporaryDirectory(prefix="helena-validar-bundle-") as pasta:
        raiz = materializar_bundle(bundle, Path(pasta) / "revisao", somente_leitura=False)
        # Fixtures e jornadas são material técnico do checkout confiável. Elas
        # participam da prova, mas nunca do JSONB publicado para os cards.
        for origem in sorted((raiz_maquina / "casos").glob("**/*.yaml")):
            _sem_links_no_caminho(origem)
            alvo = raiz / origem.relative_to(raiz_maquina)
            alvo.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(origem, alvo)
        caminho_validador = raiz_maquina / "validar.py"
        spec = importlib.util.spec_from_file_location("helena_validar_bundle", caminho_validador)
        modulo = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(modulo)
        modulo.RAIZ = raiz
        dados = modulo.carregar(raiz)
        # JSONB não preserva a ordem das chaves do YAML; a máquina é idêntica à
        # versão compilada, então sua ordem normativa vem do checkout confiável.
        dados["vocab"]["acoes"]["AUTOR"] = ler_yaml(
            raiz_maquina / "maquina/vocabulario.yaml")["acoes"]["AUTOR"]
        tags = set(modulo.REGRAS) - {"JORNADA-REPLAY"}
        erros = modulo.rodar(dados, so=tags)
        provar = modulo.carregar_provar(raiz_maquina)
        for onde, jornada in dados["jornadas"].items():
            try:
                resultado = provar.replay(jornada)
                if not resultado["confere"]:
                    erros.append(f"{onde}: [JORNADA-REPLAY] divergência")
            except Exception:
                erros.append(f"{onde}: [JORNADA-REPLAY] replay falhou")
        novos, _pendentes, _resolvidas = modulo.separar(erros, modulo.ler_pendencias())
        if novos:
            # O validador SEM-CHAVE descreve só o padrão, sem revelar o valor.
            # Diante de segredos, não inclua outras mensagens que possam repetir
            # algum trecho escrito pelo usuário.
            segredos = [e for e in novos if "[SEM-CHAVE]" in e]
            detalhes = segredos if segredos else novos
            raise ValueError("configuração inválida: " + "; ".join(detalhes[:4])[:1200])
