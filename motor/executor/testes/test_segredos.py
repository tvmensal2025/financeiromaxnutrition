"""Detector de segredos: acha chaves e tokens conhecidos e deixa passar texto comum."""

import pytest

from executor_helena.segredos import (nome_parece_segredo, segredos_na_pasta, segredos_no_ambiente,
                                       segredos_no_texto)

ISCAS = {
    "CHAVE_SK": "sk-EXEMPLO_NAO_REAL_0123456789abcdef",
    "TOKEN_GITHUB": "ghp_EXEMPLO_NAO_REAL_0123456789abcdef",
    "TOKEN_GITHUB_FINO": "github_pat_EXEMPLO_NAO_REAL_0123456789abcdef",
    "JWT": "eyJEXEMPLO.NAO_REAL_0123456789.abcdefghij",
    "TOKEN_SUPABASE": "sbp_EXEMPLO_NAO_REAL_0123456789abcdef",
    "CHAVE_AWS": "AKIAEXEMPLONAOREAL12",
    "TOKEN_SLACK": "xoxb-EXEMPLO-NAO-REAL-0123456789",
    "CHAVE_GOOGLE": "AIzaEXEMPLO_NAO_REAL_0123456789abcdefghij",
    "CHAVE_PRIVADA": "-----BEGIN RSA PRIVATE KEY-----",
    "URL_COM_SENHA": "postgresql://usuario:EXEMPLO_NAO_REAL@127.0.0.1:5432/banco",
    "BEARER": "Authorization: Bearer EXEMPLO_NAO_REAL_0123456789abcdef",
}


@pytest.mark.parametrize("codigo,isca", sorted(ISCAS.items()))
def test_cada_formato_de_segredo_e_achado(codigo, isca):
    assert codigo in segredos_no_texto(f"antes {isca} depois")


@pytest.mark.parametrize("texto", [
    "Faça o plano de prática para a semana.",
    "O artigo 19 do Marco Civil trata de responsabilidade; veja https://exemplo.org/lei.",
    "hash de arquivo: " + "a" * 64,
    "sk- sozinho não é chave",
    "http://127.0.0.1:8080/v1",
    "e-mail de contato: alguem@exemplo.org",
])
def test_texto_comum_nao_e_segredo(texto):
    assert segredos_no_texto(texto) == []


@pytest.mark.parametrize("nome", ["OPENAI_API_KEY", "GITHUB_TOKEN", "SUPABASE_SERVICE_ROLE_KEY", "DB_PASSWORD",
                                  "SENHA_DO_BANCO", "MINHA_CHAVE", "COOKIE_DA_SESSAO", "AWS_REGION", "DATABASE_URL",
                                  "TYPESAFE_QUALQUER_COISA", "dbos_system_database_url"])
def test_nomes_de_segredo(nome):
    assert nome_parece_segredo(nome)


@pytest.mark.parametrize("nome", ["PATH", "HOME", "HERMES_HOME", "CODEX_HOME", "TZ", "LANG", "HELENA_EXECUCAO",
                                  "HERMES_STREAM_RETRIES", "TMPDIR", "PYTHONDONTWRITEBYTECODE", "NO_COLOR"])
def test_nomes_inocentes(nome):
    assert not nome_parece_segredo(nome)


def test_ambiente_com_segredo_por_nome_e_por_valor():
    achados = segredos_no_ambiente({"PATH": "/usr/bin", "OPENAI_API_KEY": "x", "DESCRICAO": ISCAS["TOKEN_GITHUB"]})
    assert any(a.startswith("OPENAI_API_KEY") for a in achados)
    assert any(a.startswith("DESCRICAO") and "TOKEN_GITHUB" in a for a in achados)
    assert segredos_no_ambiente({"PATH": "/usr/bin", "HOME": "/tmp/x"}) == []


def test_o_valor_do_segredo_nunca_aparece_no_relatorio():
    achados = segredos_no_ambiente({"DESCRICAO": ISCAS["TOKEN_GITHUB"], "OUTRO": ISCAS["CHAVE_SK"]})
    assert achados and not any("EXEMPLO_NAO_REAL" in a for a in achados)


def test_pasta_com_credencial_por_nome_e_por_conteudo(tmp_path):
    (tmp_path / "config.yaml").write_text("modelo: x\n")
    (tmp_path / "nota.md").write_text(f"chave: {ISCAS['CHAVE_SK']}\n")
    (tmp_path / "memories").mkdir()
    (tmp_path / "memories" / "USER.md").write_text(f"token {ISCAS['TOKEN_GITHUB']}")
    (tmp_path / "profundo").mkdir()
    (tmp_path / "profundo" / "auth.json").write_text("{}")
    (tmp_path / "skills").mkdir()
    (tmp_path / "skills" / "exemplo.md").write_text(f"exemplo: {ISCAS['CHAVE_SK']}")
    (tmp_path / "state.db").write_bytes(b"SQLite\0" + ISCAS["CHAVE_SK"].encode())
    achados = dict(segredos_na_pasta(tmp_path, ignorar=("skills",)))
    assert achados["nota.md"] == "CHAVE_SK"
    assert achados["memories/USER.md"] == "TOKEN_GITHUB"
    assert achados["profundo/auth.json"] == "ARQUIVO_DE_CREDENCIAL"
    assert "skills/exemplo.md" not in achados and "state.db" not in achados and "config.yaml" not in achados


def test_pasta_limpa_e_pasta_que_nao_existe(tmp_path):
    (tmp_path / "config.yaml").write_text("modelo: x\n")
    assert segredos_na_pasta(tmp_path) == []
    assert segredos_na_pasta(tmp_path / "nao_existe") == []
