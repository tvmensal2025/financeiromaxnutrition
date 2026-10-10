"""Ambiente do agente: construído do zero, só com a lista permitida."""

import os
from pathlib import Path

import pytest

from executor_helena.ambiente import FIXAS, MARCADOR, PATH_SEGURO, construir_ambiente
from executor_helena.tipos import ErroDePerfil

ISCAS = {"OPENAI_API_KEY": "sk-EXEMPLO_NAO_REAL_0123456789abcdef", "GITHUB_TOKEN": "ghp_EXEMPLO_NAO_REAL_0123456789abcdef",
         "SUPABASE_SERVICE_ROLE_KEY": "eyJEXEMPLO.NAO_REAL_0123456789.abcdefghij", "DATABASE_URL": "postgresql://u:EXEMPLO_NAO_REAL@h/b"}


def montar(tmp_path, **kw):
    return construir_ambiente(hermes_home=tmp_path / "h", home=tmp_path / "home", codex_home=tmp_path / "codex",
                              tmp=tmp_path / "tmp", id_execucao="E-1-n1", **kw)


def test_nada_do_ambiente_do_motor_e_copiado(tmp_path, monkeypatch):
    for nome, valor in ISCAS.items():
        monkeypatch.setenv(nome, valor)
    monkeypatch.setenv("VARIAVEL_QUALQUER", "valor")
    ambiente = montar(tmp_path)
    assert not set(ISCAS) & set(ambiente)
    assert "VARIAVEL_QUALQUER" not in ambiente
    assert not any(v in ISCAS.values() for v in ambiente.values())
    assert ambiente["HOME"] == str(tmp_path / "home") and ambiente["HOME"] != os.environ["HOME"]


def test_so_a_lista_permitida_entra(tmp_path):
    ambiente = montar(tmp_path)
    esperados = set(FIXAS) | {"PATH", "HOME", "HERMES_HOME", "CODEX_HOME", "TMPDIR", MARCADOR}
    assert set(ambiente) == esperados
    assert ambiente["PATH"] == PATH_SEGURO and ambiente[MARCADOR] == "E-1-n1"
    assert ambiente["CODEX_HOME"] == str(tmp_path / "codex") and ambiente["HERMES_HOME"] == str(tmp_path / "h")


def test_travas_do_hermes_ligadas_por_variavel(tmp_path):
    ambiente = montar(tmp_path)
    assert ambiente["HERMES_DISABLE_LAZY_INSTALLS"] == "1"        # não instala nada sozinho
    assert ambiente["HERMES_STREAM_RETRIES"] == "0"               # sem nova tentativa interna de conexão
    assert ambiente["TZ"] == "America/Sao_Paulo" and ambiente["HERMES_TIMEZONE"] == "America/Sao_Paulo"


def test_pasta_do_hermes_entra_no_path(tmp_path):
    assert montar(tmp_path, pasta_do_hermes=Path("/opt/hermes/bin"))["PATH"] == f"/opt/hermes/bin:{PATH_SEGURO}"


def test_variavel_extra_comum_passa(tmp_path):
    assert montar(tmp_path, extras={"NO_PROXY": "127.0.0.1"})["NO_PROXY"] == "127.0.0.1"


@pytest.mark.parametrize("extras", [
    {"OPENAI_API_KEY": "qualquer"},                       # nome de segredo
    {"MINHA_CHAVE": "x"},
    {"GITHUB_USUARIO": "fulano"},                          # prefixo proibido
    {"PROXY": "http://usuario:EXEMPLO_NAO_REAL@proxy:8080"},   # valor com senha
    {"INOFENSIVA": ISCAS["GITHUB_TOKEN"]},                 # valor com cara de token
    {"HOME": "/home/do/motor"},                            # o executor define; ninguém troca
    {"CODEX_HOME": "/home/do/motor/.codex"},
    {"HERMES_HOME": "/outro"},
    {"minuscula": "x"},                                    # nome fora do padrão
    {"HERMES_STREAM_RETRIES": "2"},
])
def test_extras_perigosos_sao_recusados(tmp_path, extras):
    with pytest.raises(ErroDePerfil):
        montar(tmp_path, extras=extras)
