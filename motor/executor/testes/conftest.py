"""Montagem comum dos testes do executor."""

from pathlib import Path

import pytest

from apoio.ambiente_de_teste import Amb, comando_do_hermes_falso


def _dentro_de_repositorio(pasta: Path):
    return next((p for p in [pasta, *pasta.parents] if (p / ".git").exists()), None)


@pytest.fixture
def amb(tmp_path):
    """Ambiente de cenário com o Hermes de mentira. As pastas ficam FORA de qualquer repositório."""
    repositorio = _dentro_de_repositorio(tmp_path)
    assert repositorio is None, f"o diretório temporário do pytest está dentro do repositório {repositorio}"
    ambiente = Amb(tmp_path / "amb", comando_do_hermes_falso())
    yield ambiente
    ambiente.fechar()


@pytest.fixture
def ficha_sem_ferramenta(amb):
    return amb.ficha("sem_ferramenta")


@pytest.fixture
def ficha_com_ferramentas(amb):
    return amb.ficha("com_ferramentas")
