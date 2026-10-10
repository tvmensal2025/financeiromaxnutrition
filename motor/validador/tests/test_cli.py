"""A linha de comando: python -m validador ..."""
import json
import subprocess
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[1]
EXEMPLOS = RAIZ / "exemplos"


def cli(*args):
    return subprocess.run([sys.executable, "-m", "validador", *map(str, args)], cwd=RAIZ, capture_output=True, text=True)


@pytest.mark.parametrize("nome", ["convite", "dossie", "calculo", "parecer"])
def test_exemplos_honestos_saem_com_codigo_zero(nome):
    p = cli("validar", "--resposta", EXEMPLOS / f"{nome}_resposta.json", "--contexto", EXEMPLOS / f"{nome}_contexto.json")
    assert p.returncode == 0, p.stdout + p.stderr
    rel = json.loads(p.stdout)
    assert rel["aprovada"] is True and rel["resumo"]["recusas"] == 0
    assert rel["veredito"] == ("APROVADA_COM_MARCAS" if nome == "parecer" else "APROVADA")  # parecer: a LGPD ainda não tem texto conferido


def test_exemplo_com_defeito_sai_com_codigo_um_e_mostra_o_item():
    p = cli("validar", "--resposta", EXEMPLOS / "convite_com_defeito_resposta.json", "--contexto", EXEMPLOS / "convite_contexto.json")
    assert p.returncode == 1
    rel = json.loads(p.stdout)
    assert rel["veredito"] == "RECUSADA"
    assert [(f["id"], f["item"]) for f in rel["recusas"]] == [("CHK-GANHO-01", "entrega.texto_do_convite#linha2")]


def test_saida_em_texto_simples():
    p = cli("validar", "--texto", "--resposta", EXEMPLOS / "convite_com_defeito_resposta.json", "--contexto", EXEMPLOS / "convite_contexto.json")
    assert p.returncode == 1
    assert "Veredito: RECUSADA" in p.stdout and "CHK-GANHO-01" in p.stdout and "onde: entrega.texto_do_convite" in p.stdout


def test_saida_pode_ir_para_arquivo(tmp_path):
    destino = tmp_path / "veredito.json"
    p = cli("validar", "--saida", destino, "--resposta", EXEMPLOS / "dossie_resposta.json", "--contexto", EXEMPLOS / "dossie_contexto.json")
    assert p.returncode == 0
    assert json.loads(destino.read_text(encoding="utf-8"))["veredito"] == "APROVADA"


def test_resposta_com_duas_acoes_e_lida_como_texto_e_recusada(tmp_path):
    um = (EXEMPLOS / "dossie_resposta.json").read_text(encoding="utf-8")
    dois = tmp_path / "dois.json"
    dois.write_text(um + "\n" + um, encoding="utf-8")
    p = cli("validar", "--resposta", dois, "--contexto", EXEMPLOS / "dossie_contexto.json")
    assert p.returncode == 1
    assert json.loads(p.stdout)["recusas"][0]["motivo"] == "VARIAS_ACOES"


@pytest.mark.parametrize("args,trecho", [
    (["--resposta", "nao_existe.json", "--contexto", str(EXEMPLOS / "dossie_contexto.json")], "nao_existe.json"),
    (["--resposta", str(EXEMPLOS / "dossie_resposta.json"), "--contexto", str(EXEMPLOS / "dossie_resposta.json")], "modelo"),
])
def test_erro_de_arquivo_ou_de_contexto_sai_com_codigo_dois(args, trecho):
    p = cli("validar", *args)
    assert p.returncode == 2 and trecho in p.stderr


def test_contexto_que_nao_e_json_sai_com_codigo_dois(tmp_path):
    ruim = tmp_path / "ruim.json"
    ruim.write_text("{ isto não é json", encoding="utf-8")
    p = cli("validar", "--resposta", EXEMPLOS / "dossie_resposta.json", "--contexto", ruim)
    assert p.returncode == 2 and p.stderr.startswith("Erro:")


def test_lista_de_checagens_mostra_id_gravidade_e_furo():
    p = cli("checagens")
    assert p.returncode == 0
    for id_ in ("CHK-COMUM-06", "CHK-FONTE-01", "CHK-CALC-02", "CHK-LEI-01", "CHK-TEMA-01", "CHK-GANHO-01", "CHK-ACAO-01"):
        assert id_ in p.stdout
    assert "fecha: C-8, K-1, M-15" in p.stdout and "[MARCA]" in p.stdout and "[RECUSA]" in p.stdout


def test_sem_comando_mostra_ajuda():
    p = cli()
    assert p.returncode == 2 and "usage" in p.stderr.lower()
