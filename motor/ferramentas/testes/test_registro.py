"""Registro JSONL e estado da execução."""

import hashlib
import json

from ferramentas_helena.registro import Registro, ler_estado, ler_registro, salvar_estado


def test_cada_chamada_vira_uma_linha_com_execucao_ferramenta_resultado_e_hash(tmp_path):
    registro = Registro(tmp_path / "registro.jsonl", "E-7-n2", relogio=lambda: 1_700_000_000.0)
    registro.registrar("ler_pagina", {"url": "https://site.exemplo/", "parte": 1}, "ok", "texto entregue",
                       leitura_id="LEI-001", parte=1, de=3)
    registro.registrar("buscar", {"consulta": "x"}, "erro", "ERRO", codigo="busca_desligada")
    linhas = ler_registro(tmp_path)
    assert [l["seq"] for l in linhas] == [1, 2]
    primeira = linhas[0]
    assert primeira["execucao"] == "E-7-n2"
    assert primeira["ferramenta"] == "ler_pagina"
    assert primeira["resultado"] == "ok"
    assert primeira["hash"] == hashlib.sha256("texto entregue".encode()).hexdigest()
    assert primeira["leitura_id"] == "LEI-001" and primeira["parte"] == 1 and primeira["de"] == 3
    assert primeira["ts"] == "2023-11-14T22:13:20Z"
    assert linhas[1]["codigo"] == "busca_desligada"


def test_arquivo_e_jsonl_de_verdade(tmp_path):
    registro = Registro(tmp_path / "registro.jsonl", "E-1", relogio=lambda: 0.0)
    for i in range(3):
        registro.registrar("buscar", {"consulta": str(i)}, "ok", f"t{i}")
    bruto = (tmp_path / "registro.jsonl").read_text(encoding="utf-8").splitlines()
    assert len(bruto) == 3 and all(isinstance(json.loads(l), dict) for l in bruto)


def test_so_acrescenta_e_a_numeracao_continua_depois_de_reiniciar(tmp_path):
    caminho = tmp_path / "registro.jsonl"
    Registro(caminho, "E-1").registrar("buscar", {}, "ok", "a")
    Registro(caminho, "E-1").registrar("buscar", {}, "ok", "b")
    assert [l["seq"] for l in ler_registro(tmp_path)] == [1, 2]


def test_argumentos_enormes_sao_cortados(tmp_path):
    registro = Registro(tmp_path / "registro.jsonl", "E-1")
    registro.registrar("buscar", {"consulta": "a" * 5000, "lista": [1, 2, 3]}, "ok", "x")
    argumentos = ler_registro(tmp_path)[0]["argumentos"]
    assert len(argumentos["consulta"]) == 503 and argumentos["lista"] == "<list>"


def test_argumentos_que_nao_sao_objeto_nao_quebram(tmp_path):
    registro = Registro(tmp_path / "registro.jsonl", "E-1")
    registro.registrar("buscar", "texto solto", "erro", "x")
    assert "_invalido" in ler_registro(tmp_path)[0]["argumentos"]


def test_ler_registro_sem_arquivo(tmp_path):
    assert ler_registro(tmp_path) == []


def test_estado_vai_e_volta_sem_deixar_temporario(tmp_path):
    assert ler_estado(tmp_path) is None
    salvar_estado(tmp_path, {"execucao": "E-1", "encerrada": False})
    salvar_estado(tmp_path, {"execucao": "E-1", "encerrada": True})
    assert ler_estado(tmp_path) == {"execucao": "E-1", "encerrada": True}
    assert [p.name for p in tmp_path.iterdir()] == ["estado.json"]
