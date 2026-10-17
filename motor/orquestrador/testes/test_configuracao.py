"""Snapshots de configuração são dados imutáveis validados antes de uso."""
import copy
import re

import pytest

from orquestrador.configuracao import (capturar_bundle, carregar_revisao, hash_bundle, impressao_maquina,
                                       materializar_bundle, validar_bundle, verificar_revisao, RAIZ_REPO)


@pytest.fixture(scope="module")
def bundle_base():
    return capturar_bundle()


def test_bundle_operacional_exclui_casos_e_obedece_allowlist_sql(bundle_base):
    assert len(bundle_base) == 33  # 31 + helena-v2/agents/theo.yaml e deliverables/mudanca_de_codigo.yaml (SRV-ENGENHARIA, 17/10/2026)
    assert not any("/casos/" in caminho for caminho in bundle_base)
    sql = RAIZ_REPO / "supabase/migrations-v2/0006_configuracoes.sql"
    if sql.exists():
        padrao = re.search(r"where caminho !~ '([^']+)'", sql.read_text(encoding="utf-8")).group(1)
        assert all(re.fullmatch(padrao, caminho) for caminho in bundle_base)
        assert re.fullmatch(padrao, "helena-v2/casos/SRV-COPY/boas/boa-01.yaml") is None


def test_captura_materializa_e_mantem_origem_independente(bundle_base, tmp_path):
    original = copy.deepcopy(bundle_base)
    impressao = hash_bundle(original)
    raiz = materializar_bundle(original, tmp_path / "revisao-1")
    origem = materializar_bundle(original, tmp_path / "origem")
    modelo = origem / "models.yaml"
    modelo.chmod(0o644)
    modelo.write_text("versao: alterada\n", encoding="utf-8")
    spec, raiz_revisao = carregar_revisao(original, impressao, tmp_path / "revisao-1")
    assert raiz_revisao == raiz
    assert spec.servicos["SRV-COPY"]["id"] == "SRV-COPY"
    assert (tmp_path / "revisao-1/.bundle.sha256").read_text().strip() == impressao
    assert hash_bundle(original) == impressao
    with pytest.raises(ValueError, match="alterados|alterado"):
        materializar_bundle(original, tmp_path / "origem")
    with pytest.raises(ValueError, match="alterados|alterado"):
        verificar_revisao(original, tmp_path / "origem")


def test_hash_deterministico_e_revisao_diferente_nao_sobrescreve(bundle_base, tmp_path):
    primeiro = copy.deepcopy(bundle_base)
    segundo = dict(reversed(list(primeiro.items())))
    assert hash_bundle(primeiro) == hash_bundle(segundo)
    carregar_revisao(primeiro, hash_bundle(primeiro), tmp_path / "revisao")
    segundo = copy.deepcopy(primeiro)
    segundo["helena-v2/models.yaml"]["versao"] = "teste-outra-versao"
    with pytest.raises(ValueError, match="não corresponde"):
        carregar_revisao(segundo, hash_bundle(primeiro), tmp_path / "outra")
    with pytest.raises(ValueError, match="não corresponde"):
        materializar_bundle(segundo, tmp_path / "revisao")


@pytest.mark.parametrize("caminho", [
    "helena-v2/../services/chaves.yaml",
    "helena-v2/./servicos.yaml",
    "helena-v2/agents/novo.py",
    "helena-v2/schemas/https://exemplo.invalid.schema.json",
    "helena-v2/casos/SRV-COPY/boas/boa-01.yaml",
    "helena-v2/agents/" + "a" * 300 + ".yaml",
    "helena-v2/agents/caio\x00.yaml",
])
def test_recusa_caminho_fora_da_lista(bundle_base, caminho):
    bundle = dict(bundle_base)
    bundle[caminho] = {}
    with pytest.raises(ValueError, match="caminho"):
        hash_bundle(bundle)


def test_recusa_referencia_remota_e_documento_grande(bundle_base):
    bundle = copy.deepcopy(bundle_base)
    bundle["helena-v2/schemas/agent.schema.json"]["$ref"] = "https://exemplo.invalid/agent.json"
    with pytest.raises(ValueError, match="referência externa"):
        hash_bundle(bundle)
    bundle = copy.deepcopy(bundle_base)
    bundle["helena-v2/models.yaml"]["lixo"] = "x" * 512_000
    with pytest.raises(ValueError, match="limite"):
        hash_bundle(bundle)


def test_recusa_symlink_de_origem_e_destino(bundle_base, tmp_path):
    raiz = materializar_bundle(bundle_base, tmp_path / "real")
    (tmp_path / "atalho").symlink_to(raiz.parent, target_is_directory=True)
    with pytest.raises(ValueError, match="link simbólico"):
        materializar_bundle(bundle_base, tmp_path / "atalho")
    (tmp_path / "raiz-atalho").symlink_to(raiz, target_is_directory=True)
    with pytest.raises(ValueError, match="link simbólico"):
        capturar_bundle(tmp_path / "raiz-atalho")
    marcador = tmp_path / "marcador-atalho"
    marcador.mkdir()
    (marcador / ".bundle.sha256").symlink_to(raiz.parent / ".bundle.sha256")
    with pytest.raises(ValueError, match="link simbólico"):
        verificar_revisao(bundle_base, marcador)
    raiz_link = tmp_path / "subraiz-atalho"
    raiz_link.mkdir()
    (raiz_link / ".bundle.sha256").write_text(hash_bundle(bundle_base) + "\n")
    (raiz_link / "helena-v2").symlink_to(raiz, target_is_directory=True)
    with pytest.raises(ValueError, match="link simbólico"):
        verificar_revisao(bundle_base, raiz_link)


def test_recusa_esquema_permissivo_e_profundidade_excessiva(bundle_base):
    alterado = copy.deepcopy(bundle_base)
    alterado["helena-v2/schemas/agent.schema.json"] = {}
    with pytest.raises(ValueError, match="migração"):
        validar_bundle(alterado)
    profundo = copy.deepcopy(bundle_base)
    valor = {}
    for _ in range(70):
        valor = {"aninhado": valor}
    profundo["helena-v2/models.yaml"]["extra"] = valor
    with pytest.raises(ValueError, match="profundidade"):
        hash_bundle(profundo)


def test_baseline_valida_e_maquina_alterada_exige_migracao(bundle_base):
    assert impressao_maquina(bundle_base) == "4d307f25747d5381"
    validar_bundle(bundle_base)
    alterado = copy.deepcopy(bundle_base)
    alterado["helena-v2/maquina/vocabulario.yaml"]["versao"] = "nova"
    with pytest.raises(ValueError, match="migração"):
        validar_bundle(alterado)


def test_servico_aposentado_no_playbook_recusa_ativacao(bundle_base):
    alterado = copy.deepcopy(bundle_base)
    for servico in alterado["helena-v2/servicos.yaml"]["servicos"]:
        if servico["id"] == "SRV-COPY":
            servico["estado"] = "APOSENTADO"
            break
    with pytest.raises(ValueError, match="ROTEIRO-SERVICO"):
        validar_bundle(alterado)


def test_orcamento_insuficiente_recusa_ativacao(bundle_base):
    alterado = copy.deepcopy(bundle_base)
    alterado["helena-v2/playbooks/recrutar-10-pessoas.yaml"]["orcamento_meta"]["chamadas_total"] = 1
    with pytest.raises(ValueError, match="ROTEIRO-ORCAMENTO"):
        validar_bundle(alterado)
