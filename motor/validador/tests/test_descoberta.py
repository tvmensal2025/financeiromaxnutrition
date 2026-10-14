"""As checagens são achadas sozinhas: um arquivo novo em validador/checagens/ entra sem ninguém atualizar uma lista."""
import sys
from pathlib import Path

import validador.checagens as pacote_de_checagens
from validador.checagens import MODULOS, descobrir
from validador.registro import CHECAGENS


def test_todo_arquivo_da_pasta_checagens_foi_importado():
    pasta = Path(pacote_de_checagens.__file__).parent
    em_disco = sorted(p.stem for p in pasta.glob("*.py") if not p.stem.startswith("_"))
    assert MODULOS == em_disco and len(em_disco) >= 13
    for nome in em_disco:
        assert f"validador.checagens.{nome}" in sys.modules


def test_arquivo_novo_e_achado_sozinho_e_arquivo_com_underscore_e_ignorado(tmp_path, monkeypatch):
    pacote = tmp_path / "pacote_de_teste"
    pacote.mkdir()
    (pacote / "__init__.py").write_text("", encoding="utf-8")
    (pacote / "meu_tipo.py").write_text(
        "from validador.registro import checagem\n"
        "@checagem('CHK-DESCOBERTA-01', 'Checagem achada sozinha', 'Prova que o arquivo novo é importado.', ['C-11'])\n"
        "def f(exe):\n    return None\n", encoding="utf-8")
    (pacote / "_rascunho.py").write_text("raise RuntimeError('arquivo com underscore não deve ser importado')\n", encoding="utf-8")
    monkeypatch.syspath_prepend(str(tmp_path))
    try:
        nomes = descobrir([str(pacote)], "pacote_de_teste")
        assert nomes == ["meu_tipo"]
        assert "CHK-DESCOBERTA-01" in CHECAGENS
    finally:
        CHECAGENS.pop("CHK-DESCOBERTA-01", None)
        sys.modules.pop("pacote_de_teste.meu_tipo", None)
        sys.modules.pop("pacote_de_teste", None)
