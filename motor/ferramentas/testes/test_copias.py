"""Cópia de cada página lida: hash, idade, partes e proteção contra adulteração."""

import hashlib
import json

import pytest

from ferramentas_helena.copias import Copias, carregar_copia
from ferramentas_helena.erros import CopiaAdulterada

TEXTO = "Cláusula 1. Primeira parte.\n\nCláusula 2. Segunda parte.\n\nCláusula 3. Terceira."
FINS = [28, 57, len(TEXTO)]   # fim de cada parte (posição exclusiva)


def guardar(copias, url="https://site.exemplo/termos", texto=TEXTO, fins=None):
    return copias.guardar(url_pedida=url, url_final=url, texto=texto,
                          fins_das_partes=fins or FINS, links=["https://site.exemplo/x"],
                          hash_bruto="b" * 64, tipo="text/html")


def test_guarda_e_devolve_com_hash_e_id(tmp_path):
    agora = [1_000_000.0]
    copias = Copias(tmp_path, relogio=lambda: agora[0])
    copia = guardar(copias)
    assert copia.leitura_id == "LEI-001"
    assert copia.hash_texto == hashlib.sha256(TEXTO.encode("utf-8")).hexdigest()
    assert copia.total_partes == 3
    assert copia.lido_em.endswith("Z") and copia.lido_em_epoch == 1_000_000.0
    assert copia.links == ("https://site.exemplo/x",)
    assert (tmp_path / "leituras" / "LEI-001.txt").read_text(encoding="utf-8") == TEXTO


def test_ids_sao_sequenciais(tmp_path):
    copias = Copias(tmp_path)
    assert [guardar(copias, url=f"https://site.exemplo/{i}").leitura_id for i in range(3)] == \
        ["LEI-001", "LEI-002", "LEI-003"]


def test_cada_parte_volta_exatamente_como_foi_entregue(tmp_path):
    copia = guardar(Copias(tmp_path))
    assert copia.parte(1) == TEXTO[:28]
    assert copia.parte(2) == TEXTO[28:57]
    assert copia.parte(3) == TEXTO[57:]
    assert "".join(copia.parte(i) for i in (1, 2, 3)) == TEXTO


@pytest.mark.parametrize("numero", [0, 4, -1])
def test_parte_fora_do_intervalo(tmp_path, numero):
    copia = guardar(Copias(tmp_path))
    with pytest.raises(IndexError):
        copia.parte(numero)


def test_idade_em_segundos(tmp_path):
    copia = guardar(Copias(tmp_path, relogio=lambda: 1000.0))
    assert copia.idade_s(agora=1090.0) == 90.0


def test_por_url_acha_a_copia_da_mesma_execucao(tmp_path):
    copias = Copias(tmp_path)
    guardar(copias)
    assert copias.por_url("https://site.exemplo/termos").leitura_id == "LEI-001"
    assert copias.por_url("https://site.exemplo/outra") is None


def test_copias_sobrevivem_a_um_reinicio(tmp_path):
    guardar(Copias(tmp_path))
    de_novo = Copias(tmp_path)
    assert de_novo.por_url("https://site.exemplo/termos").leitura_id == "LEI-001"
    assert guardar(de_novo, url="https://site.exemplo/b").leitura_id == "LEI-002"   # numeração continua


def test_validador_carrega_pela_pasta_e_o_hash_confere(tmp_path):
    guardar(Copias(tmp_path))
    copia = carregar_copia(tmp_path, "LEI-001")
    assert copia.texto == TEXTO


def test_texto_adulterado_e_detectado(tmp_path):
    guardar(Copias(tmp_path))
    caminho = tmp_path / "leituras" / "LEI-001.txt"
    caminho.write_text(TEXTO.replace("Segunda", "Segunda (editada)"), encoding="utf-8")
    with pytest.raises(CopiaAdulterada):
        carregar_copia(tmp_path, "LEI-001")


def test_hash_adulterado_nos_metadados_e_detectado(tmp_path):
    guardar(Copias(tmp_path))
    caminho = tmp_path / "leituras" / "LEI-001.json"
    meta = json.loads(caminho.read_text(encoding="utf-8"))
    meta["hash_texto"] = "0" * 64
    caminho.write_text(json.dumps(meta), encoding="utf-8")
    with pytest.raises(CopiaAdulterada):
        carregar_copia(tmp_path, "LEI-001")


def test_partes_que_nao_cobrem_o_texto_sao_detectadas(tmp_path):
    guardar(Copias(tmp_path))
    caminho = tmp_path / "leituras" / "LEI-001.json"
    meta = json.loads(caminho.read_text(encoding="utf-8"))
    meta["fins_das_partes"] = [28, 57]
    caminho.write_text(json.dumps(meta), encoding="utf-8")
    with pytest.raises(CopiaAdulterada):
        carregar_copia(tmp_path, "LEI-001")


@pytest.mark.parametrize("ruim", ["../LEI-001", "LEI-1", "lei-001", "LEI-001/../x", ""])
def test_id_malformado_e_recusado_antes_de_tocar_no_disco(tmp_path, ruim):
    with pytest.raises(ValueError):
        carregar_copia(tmp_path, ruim)
