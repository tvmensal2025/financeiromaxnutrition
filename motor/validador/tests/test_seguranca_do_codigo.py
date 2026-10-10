"""O próprio código do validador não usa nada perigoso e não depende de nada de fora."""
import ast
import sys
from pathlib import Path

import validador

RAIZ = Path(validador.__file__).resolve().parent
RAIZ_DO_COMPONENTE = RAIZ.parent
ARQUIVOS = sorted(RAIZ.rglob("*.py"))
PROIBIDAS_NAS_CHAMADAS = {"eval", "exec", "compile", "__import__", "open_code"}
MODULOS_PROIBIDOS = {"subprocess", "os", "socket", "urllib.request", "http", "requests", "pickle", "marshal", "ctypes", "shutil", "importlib"}


def test_ha_arquivos_para_olhar():
    assert len(ARQUIVOS) >= 15


def test_nenhum_modulo_usa_eval_exec_compile_ou_import_dinamico():
    achados = []
    for arq in ARQUIVOS:
        for no in ast.walk(ast.parse(arq.read_text(encoding="utf-8"))):
            if isinstance(no, ast.Call) and isinstance(no.func, ast.Name) and no.func.id in PROIBIDAS_NAS_CHAMADAS:
                achados.append(f"{arq.name}:{no.lineno} {no.func.id}()")
    assert not achados, achados


def test_nenhum_modulo_importa_rede_processo_ou_arquivo_do_sistema():
    achados = []
    for arq in ARQUIVOS:
        for no in ast.walk(ast.parse(arq.read_text(encoding="utf-8"))):
            nomes = []
            if isinstance(no, ast.Import):
                nomes = [a.name for a in no.names]
            elif isinstance(no, ast.ImportFrom) and no.level == 0 and no.module:
                nomes = [no.module]
            achados += [f"{arq.name}:{no.lineno} importa {n}" for n in nomes if n in MODULOS_PROIBIDOS or n.split(".")[0] in {"subprocess", "socket", "requests", "pickle", "ctypes"}]
    assert not achados, achados


def test_so_biblioteca_padrao():
    """O validador usa SÓ a biblioteca padrão do Python (nada para instalar em produção)."""
    de_fora = set()
    for arq in ARQUIVOS:
        for no in ast.walk(ast.parse(arq.read_text(encoding="utf-8"))):
            if isinstance(no, ast.Import):
                de_fora |= {a.name.split(".")[0] for a in no.names}
            elif isinstance(no, ast.ImportFrom) and no.level == 0 and no.module:
                de_fora.add(no.module.split(".")[0])
    de_fora -= set(sys.stdlib_module_names)
    assert de_fora == set(), f"dependências de fora: {de_fora}"


def test_requirements_tem_versoes_fixas():
    linhas = [l.strip() for l in (RAIZ_DO_COMPONENTE / "requirements.txt").read_text(encoding="utf-8").splitlines()]
    pacotes = [l for l in linhas if l and not l.startswith("#")]
    assert pacotes, "requirements.txt vazio"
    assert all("==" in l and not any(c in l for c in "<>~*") for l in pacotes), pacotes


def test_nenhum_segredo_no_componente():
    """Nenhuma chave, senha ou token escrito em arquivo (usar variável de ambiente e 'EXEMPLO_NAO_REAL')."""
    import re

    suspeitos = re.compile(r"(sk-[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)")
    achados = []
    for arq in RAIZ_DO_COMPONENTE.rglob("*"):
        if arq.is_file() and arq.suffix in {".py", ".json", ".md", ".txt", ".ini"} and "__pycache__" not in arq.parts:
            if suspeitos.search(arq.read_text(encoding="utf-8", errors="ignore")):
                achados.append(str(arq))
    assert not achados, achados
