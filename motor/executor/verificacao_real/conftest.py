"""Portão manual para a prova do adaptador com hermes-agent real.

O provedor dos cenários é um servidor falso local. O processo Hermes é real;
somente a frase do fundador autoriza chamá-lo, fora desta automação.
"""

import shutil
from pathlib import Path

import pytest

from apoio.ambiente_de_teste import Amb


def pytest_addoption(parser):
    parser.addoption("--autorizar-hermes-real", action="store_true", default=False)


@pytest.fixture
def amb(request, tmp_path):
    if not request.config.getoption("--autorizar-hermes-real"):
        pytest.fail("Hermes real bloqueado: falta --autorizar-hermes-real após a frase do fundador")
    hermes = shutil.which("hermes")
    if hermes is None:
        pytest.fail("Executável hermes não encontrado no PATH do venv separado")
    ambiente = Amb(tmp_path / "amb", (str(Path(hermes).resolve()),), real=True)
    try:
        yield ambiente
    finally:
        ambiente.fechar()


@pytest.fixture
def ficha_sem_ferramenta(amb):
    return amb.ficha("sem_ferramenta")


@pytest.fixture
def ficha_com_ferramentas(amb):
    return amb.ficha("com_ferramentas")
