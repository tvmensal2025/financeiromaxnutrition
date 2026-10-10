"""O servidor como o Hermes o usa: um processo, JSON por linha na entrada e na saída.

Aqui não há páginas falsas: as chamadas usam só endereços que são recusados antes de
qualquer rede, então nada sai do computador.
"""

import ast
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from ferramentas_helena.registro import ler_estado, ler_registro

RAIZ = Path(__file__).resolve().parent.parent


def linha(**campos):
    return json.dumps({"jsonrpc": "2.0", **campos})


def chamada(i, nome, argumentos=None):
    return linha(id=i, method="tools/call", params={"name": nome, "arguments": argumentos or {}})


def rodar(tmp_path, argumentos, entrada=()):
    """Roda o servidor de verdade, com ambiente mínimo (sem nenhum segredo)."""
    comando = [sys.executable, "-m", "ferramentas_helena", "--execucao", "E-1-n1",
               "--diretorio", str(tmp_path / "exec"), *argumentos]
    ambiente = {"PATH": os.environ.get("PATH", ""), "PYTHONPATH": str(RAIZ), "LC_ALL": "C.UTF-8"}
    processo = subprocess.run(
        comando, input=("\n".join(entrada) + "\n").encode("utf-8"), capture_output=True,
        cwd=RAIZ, env=ambiente, timeout=60,
    )
    respostas = [json.loads(l) for l in processo.stdout.decode("utf-8").splitlines()]
    return processo.returncode, respostas, processo.stderr.decode("utf-8")


COM_FERRAMENTAS = ["--ferramentas", "ler_pagina,buscar", "--max-buscas", "10", "--max-partes", "30",
                   "--max-total", "45", "--qualquer-endereco-publico"]


def test_conversa_completa_de_partida(tmp_path):
    codigo, respostas, erro = rodar(tmp_path, COM_FERRAMENTAS, [
        linha(id=1, method="initialize", params={"protocolVersion": "2025-06-18", "capabilities": {},
                                                  "clientInfo": {"name": "hermes", "version": "x"}}),
        linha(method="notifications/initialized"),
        linha(id=2, method="tools/list"),
    ])
    assert codigo == 0 and erro == ""
    assert [r["id"] for r in respostas] == [1, 2]
    assert [t["name"] for t in respostas[1]["result"]["tools"]] == ["ler_pagina", "buscar"]


def test_servidor_vazio_pelo_processo_e_laco_ate_encerrar(tmp_path):
    entrada = [linha(id=0, method="tools/list")] + [chamada(i, "terminal", {"cmd": "id"}) for i in range(1, 50)]
    codigo, respostas, _ = rodar(tmp_path, ["--servidor-vazio", "--max-total", "3"], entrada)
    assert respostas[0]["result"] == {"tools": []}
    assert [("error" in r) for r in respostas[1:4]] == [True, True, True]          # 3 recusas
    assert all("ENTREGUE AGORA" in r["result"]["content"][0]["text"] for r in respostas[4:7])
    assert respostas[7]["result"]["isError"] is True and len(respostas) == 8
    assert codigo == 4
    assert ler_estado(tmp_path / "exec")["motivo_encerramento"] == "limite_de_chamadas"


def test_laco_de_200_chamadas_e_cortado_no_limite_pelo_processo(tmp_path):
    entrada = [chamada(i, "ler_pagina", {"url": "http://169.254.169.254/latest/meta-data/"}) for i in range(200)]
    codigo, respostas, _ = rodar(tmp_path, COM_FERRAMENTAS, entrada)
    assert codigo == 4
    assert len(respostas) == 45 + 3 + 1                                           # 45 erros, 3 avisos, 1 corte
    registro = ler_registro(tmp_path / "exec")
    assert [l["resultado"] for l in registro].count("erro") == 45 and len(registro) == 49
    estado = ler_estado(tmp_path / "exec")
    assert estado["encerrada"] and estado["contadores"]["total"] == 45 and estado["classe_do_motor"] == "LIMITE_CHAMADAS"


def test_enderecos_proibidos_pelo_processo(tmp_path):
    proibidos = ["http://127.0.0.1/", "http://localhost/", "http://[::1]/", "https://exemplo.com:8443/",
                 "file:///etc/passwd", "http://usuario:senha@exemplo.com/", "https://exemplo.com/login"]
    codigo, respostas, _ = rodar(tmp_path, COM_FERRAMENTAS,
                                 [chamada(i, "ler_pagina", {"url": u}) for i, u in enumerate(proibidos)])
    assert codigo == 0
    assert all(r["result"]["isError"] and "ERRO [" in r["result"]["content"][0]["text"] for r in respostas)


def test_busca_desligada_pelo_processo(tmp_path):
    _, respostas, _ = rodar(tmp_path, COM_FERRAMENTAS, [chamada(1, "buscar", {"consulta": "termos"})])
    assert "[busca_desligada]" in respostas[0]["result"]["content"][0]["text"]


def test_lista_de_enderecos_em_arquivo(tmp_path):
    arquivo = tmp_path / "fontes.txt"
    arquivo.write_text("# fontes liberadas pelo fundador\n\nhttps://exemplo.com/termos\n", encoding="utf-8")
    argumentos = ["--ferramentas", "ler_pagina", "--max-partes", "5", "--max-total", "10",
                  "--lista-de-enderecos", str(arquivo)]
    _, respostas, _ = rodar(tmp_path, argumentos, [chamada(1, "ler_pagina", {"url": "https://exemplo.com/outra"})])
    assert "[fonte_insuficiente]" in respostas[0]["result"]["content"][0]["text"]


@pytest.mark.parametrize("argumentos", [
    ["--ferramentas", "ler_pagina", "--max-partes", "5", "--max-total", "10"],            # sem dizer a lista
    ["--ferramentas", "terminal", "--max-total", "5", "--qualquer-endereco-publico"],     # ferramenta que não existe
    ["--ferramentas", "ler_pagina", "--max-partes", "0", "--max-total", "5", "--qualquer-endereco-publico"],
    ["--ferramentas", "", "--max-total", "5", "--qualquer-endereco-publico"],              # vazio exige --servidor-vazio
    ["--ferramentas", "buscar", "--max-buscas", "5", "--max-total", "2", "--qualquer-endereco-publico"],
    ["--ferramentas", "ler_pagina", "--servidor-vazio", "--max-total", "5"],              # os dois juntos
    ["--max-total", "5"],                                                                  # nenhum dos dois
    ["--servidor-vazio"],                                                                  # sem limite de chamadas
    ["--servidor-vazio", "--max-total", "3", "--busca", "falsa"],                         # adaptador falso é só de teste
    ["--ferramentas", "ler_pagina", "--max-partes", "5", "--max-total", "10", "--lista-de-enderecos", "/nao/existe.txt"],
    ["--servidor-vazio", "--max-total", "0"],
])
def test_configuracao_errada_nao_liga(tmp_path, argumentos):
    codigo, respostas, erro = rodar(tmp_path, argumentos)
    assert codigo == 2 and respostas == [] and erro


def test_lista_com_endereco_interno_nao_liga(tmp_path):
    arquivo = tmp_path / "fontes.txt"
    arquivo.write_text("http://127.0.0.1/admin\n", encoding="utf-8")
    codigo, _, erro = rodar(tmp_path, ["--ferramentas", "ler_pagina", "--max-partes", "5", "--max-total", "10",
                                       "--lista-de-enderecos", str(arquivo)])
    assert codigo == 2 and "lista de fontes" in erro


def test_a_saida_so_tem_json_e_o_processo_termina_quando_a_entrada_fecha(tmp_path):
    codigo, respostas, erro = rodar(tmp_path, COM_FERRAMENTAS, [linha(id=1, method="ping"), "lixo que não é json"])
    assert codigo == 0 and erro == ""
    assert respostas[0]["result"] == {} and respostas[1]["error"]["code"] == -32700


# --- regras do código-fonte (o agente nasce sem segredo; ferramentas só leem) --------------------------------------
def arquivos_do_pacote():
    return sorted((RAIZ / "ferramentas_helena").glob("*.py"))


def importados(arquivo):
    arvore = ast.parse(arquivo.read_text(encoding="utf-8"))
    nomes = set()
    for no in ast.walk(arvore):
        if isinstance(no, ast.Import):
            nomes.update(a.name.split(".")[0] for a in no.names)
        elif isinstance(no, ast.ImportFrom) and no.level == 0 and no.module:
            nomes.add(no.module.split(".")[0])
    return nomes


def test_o_pacote_usa_so_a_biblioteca_padrao():
    for arquivo in arquivos_do_pacote():
        fora = {n for n in importados(arquivo) if n not in sys.stdlib_module_names}
        assert not fora, f"{arquivo.name} importa de fora: {fora}"


def test_o_pacote_nao_roda_comandos_nem_le_o_ambiente_nem_fala_com_a_openai():
    proibidos_nos_imports = {"subprocess", "ctypes", "pickle", "shelve", "marshal", "multiprocessing", "pty"}
    proibidos_no_texto = ["os.environ", "getenv", "os.system", "os.popen", "eval(", "exec(", "__import__",
                          "openai", "OPENAI", "api_key", "API_KEY"]
    for arquivo in arquivos_do_pacote():
        assert not (importados(arquivo) & proibidos_nos_imports), arquivo.name
        codigo = arquivo.read_text(encoding="utf-8")
        for trecho in proibidos_no_texto:
            assert trecho not in codigo, f"{arquivo.name} contém {trecho!r}"


def test_nenhum_arquivo_do_componente_tem_chave_ou_token():
    # só nomes e exemplos "EXEMPLO_NAO_REAL"; nenhum valor com cara de segredo
    padroes = ["sk-", "ghp_", "eyJhbGci", "-----BEGIN", "AKIA", "xoxb-", "service_role"]
    for arquivo in list(RAIZ.rglob("*.py")) + list(RAIZ.rglob("*.md")) + list(RAIZ.rglob("*.txt")):
        if "__pycache__" in arquivo.parts or arquivo.name == "test_stdio.py":
            continue
        texto = arquivo.read_text(encoding="utf-8")
        for padrao in padroes:
            assert padrao not in texto, f"{arquivo.relative_to(RAIZ)} contém {padrao!r}"
