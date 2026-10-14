"""Protege a receita visual preparada para a v1 contra reversões de segurança."""

from pathlib import Path
import re
import shutil
import subprocess

import pytest


RAIZ = Path(__file__).resolve().parent.parent
PATCH = RAIZ / "docs/arquivo/reversao-visual-v1-seletiva-20261013.patch"
PROTEGIDOS = (
    "src/auth.tsx",
    "src/contexts/BusinessContext.tsx",
    "src/contexts/SessionBusinessBoundary.tsx",
    "src/styles/helena-premium.css",
)
ALVOS = {
    "src/App.tsx",
    "src/components/Layout.tsx",
    "src/pages/Login.tsx",
    "src/pages/OAuthConsent.tsx",
    "src/main.tsx",
    "tailwind.config.ts",
}


def conferir_protegidos(pasta: Path, antes: dict[str, bytes]) -> None:
    for nome, conteudo in antes.items():
        assert (pasta / nome).read_bytes() == conteudo, f"reversão alterou {nome}"


def conferir_layout(pasta: Path) -> None:
    layout = (pasta / "src/components/Layout.tsx").read_text()
    assert 'currentBusiness?.nome || "Empresa não selecionada"' in layout
    assert 'currentBusiness?.nome || "iGreen"' not in layout
    assert 'className="grid h-11 w-11 place-items-center rounded-lg border border-border bg-card text-foreground md:hidden"' in layout
    assert 'className="absolute right-3 top-4 grid h-11 w-11 place-items-center rounded-lg text-foreground hover:bg-muted"' in layout
    assert '<button type="button" className="he-nav-group-toggle"' in layout


def test_patch_visual_preserva_seguranca_e_rotas_v2(tmp_path: Path) -> None:
    texto = PATCH.read_text()
    assert set(re.findall(r"^\+\+\+ b/(.+)$", texto, re.MULTILINE)) == ALVOS
    for nome in ALVOS | set(PROTEGIDOS):
        destino = tmp_path / nome
        destino.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(RAIZ / nome, destino)
    antes = {nome: (tmp_path / nome).read_bytes() for nome in PROTEGIDOS}

    subprocess.run(["git", "apply", "--check", str(PATCH)], cwd=tmp_path, check=True)
    subprocess.run(["git", "apply", str(PATCH)], cwd=tmp_path, check=True)

    conferir_protegidos(tmp_path, antes)
    conferir_layout(tmp_path)
    app = (tmp_path / "src/App.tsx").read_text()
    assert "<SessionBusinessBoundary>" in app
    assert 'path="/cards-v2"' in app and 'path="/configuracoes-v2"' in app
    assert 'import "./styles/helena-premium.css"' not in (tmp_path / "src/main.tsx").read_text()


def test_defeito_plantado_em_auth_e_detectado(tmp_path: Path) -> None:
    nome = "src/auth.tsx"
    destino = tmp_path / nome
    destino.parent.mkdir(parents=True)
    shutil.copyfile(RAIZ / nome, destino)
    antes = {nome: destino.read_bytes()}
    destino.write_bytes(antes[nome] + b"\n// alteracao indevida de seguranca\n")
    with pytest.raises(AssertionError, match="reversão alterou src/auth.tsx"):
        conferir_protegidos(tmp_path, antes)


@pytest.mark.parametrize("original,defeito", [
    ('currentBusiness?.nome || "Empresa não selecionada"', 'currentBusiness?.nome || "iGreen"'),
    ('grid h-11 w-11 place-items-center rounded-lg border', 'grid h-8 w-8 place-items-center rounded-lg border'),
    ('<button type="button" className="he-nav-group-toggle"', '<button className="he-nav-group-toggle"'),
])
def test_defeitos_plantados_no_layout_sao_detectados(tmp_path: Path, original: str, defeito: str) -> None:
    destino = tmp_path / "src/components/Layout.tsx"
    destino.parent.mkdir(parents=True)
    layout = (RAIZ / "src/components/Layout.tsx").read_text()
    assert original in layout
    destino.write_text(layout.replace(original, defeito, 1))
    with pytest.raises(AssertionError):
        conferir_layout(tmp_path)
