"""O adaptador (spec_helena/): converte a especificação e os casos no que o validador recebe.

Usa uma especificação em miniatura (tests/spec_de_mentira.py) para provar cada conversão, e a especificação de verdade
para provar que o modelo de cada tipo é aceito pelo validador e usa os nomes do entrega.schema.json.
"""
import ast
import json
from pathlib import Path

import pytest

import validador
from spec_helena import ErroDoAdaptador, Spec, listar_casos, montar_contexto, montar_modelo, montar_resposta, prova
from spec_helena.caso import aplicar_variante, carregar_pedido
from validador.contexto import conferir_contexto
from validador.execucao import Execucao

from . import spec_de_mentira as mentira


@pytest.fixture()
def spec(tmp_path):
    return mentira.criar(tmp_path)


def caso(spec, id_):
    return next(c for c in listar_casos(spec) if c.id == id_)


# ---- o modelo -------------------------------------------------------------------------------
def test_o_modelo_vem_do_yaml_do_tipo_e_do_servico(spec):
    m = montar_modelo(spec, "teste")
    assert (m["tipo"], m["servico"], m["limite"]) == ("teste", "SRV-TESTE", 500)
    assert m["acoes_permitidas"] == ["ENTREGAR", "REGISTRAR_FALHA"]
    assert m["acao_externa_permitida"] == ["NENHUMA", "SO_FUNDADOR"]
    assert m["acoes_do_fundador"] == ["AF-TESTE-ENVIAR"]          # o servico traz objetos; o validador quer só o id
    s = m["secoes"][0]
    assert s == {"id": "texto", "titulo": "Texto", "tipo_de_campo": "texto", "obrigatoria": True, "limite_caracteres": 300}
    assert "validador" not in m                                     # o YAML do tipo não tem bloco `validador`: nada é inventado


def test_mudar_o_yaml_muda_o_modelo(tmp_path):
    assert montar_modelo(mentira.criar(tmp_path / "a", limite=700), "teste")["limite"] == 700
    assert montar_modelo(mentira.criar(tmp_path / "b", limite=900), "teste")["limite"] == 900


def test_so_as_checagens_com_parametros_levam_parametros(spec):
    m = montar_modelo(spec, "teste")
    assert m["parametros_das_checagens"] == {"CHK-TESTE-01": {"termos": ["proibida"]}}


def test_o_bloco_validador_do_yaml_passa_direto(tmp_path):
    spec = mentira.criar(tmp_path)
    arq = tmp_path / "deliverables" / "teste.yaml"
    arq.write_text(arq.read_text(encoding="utf-8") + "validador:\n  exige_fontes: true\n", encoding="utf-8")
    assert montar_modelo(Spec(tmp_path), "teste")["validador"] == {"exige_fontes": True}


def test_tipo_sem_arquivo_da_erro_claro(spec):
    with pytest.raises(FileNotFoundError, match="deliverables/nada.yaml"):
        montar_modelo(spec, "nada")


# ---- o contexto -----------------------------------------------------------------------------
def test_contexto_basico(spec):
    c = montar_contexto(spec, caso(spec, "T-BOA-01"))
    assert c["hoje"] == "2026-10-10"
    assert c["execucao_id"] == "EXE-T-BOA-01"
    assert c["usou_internet"] == "SIM"
    assert c["links_do_pedido"] == ["https://politica.exemplo.invalid/privacidade"]    # sem o ponto final; sem repetir
    assert c["decisoes_vigentes"] == [{"id": "DEC-901"}]
    assert c["modelo"]["acao_do_fundador_do_plano"] == "AF-TESTE-ENVIAR"
    assert c["pacote_da_empresa"]["nome"] == "Empresa de Teste"
    conferir_contexto(c)                                                                  # o validador aceita o formato


def test_paginas_lidas_vem_das_fitas_do_caso_e_juntam_as_partes(spec):
    paginas = montar_contexto(spec, caso(spec, "T-BOA-01"))["paginas_lidas"]
    assert len(paginas) == 1                                  # a fita FONTE_INSUFICIENTE não entrega página
    p = paginas[0]
    assert (p["leitura_id"], p["partes_total"], p["execucao"]) == ("LEI-T-1", 2, "EXE-T-BOA-01")
    assert p["partes"] == {"1": mentira.TEXTO_DA_POLITICA_1, "2": mentira.TEXTO_DA_POLITICA_2}


def test_caso_sem_leituras_nao_tem_paginas_e_nao_usou_internet(spec):
    c = montar_contexto(spec, caso(spec, "T-BOA-02"))
    assert c["paginas_lidas"] == [] and c["usou_internet"] == "NAO"


def test_fontes_importadas_do_pedido_e_do_pacote(spec):
    c = montar_contexto(spec, caso(spec, "T-BOA-01"))
    fontes = {f["fonte_importada_id"]: f["texto"] for f in c["fontes_importadas"]}
    assert fontes["FON-PEDIDO-CARD-T-01"] == mentira.PEDIDO_ORIGINAL        # convenção FON-PEDIDO-<card>
    assert fontes["FON-PEDIDO-T-01"] == mentira.PEDIDO_ORIGINAL             # id que o próprio pedido declara
    assert "Empresa de Teste" in fontes["FON-PACOTE-BIZ-T"]                 # convenção FON-PACOTE-<empresa>
    assert "jamais" in fontes["FON-PACOTE-BIZ-T"]
    assert fontes["FON-REGRAS-T-01"] == mentira.TEXTO_DAS_REGRAS            # fonte que o pedido traz com texto próprio


def test_variante_troca_o_pedido_e_a_fonte(spec):
    c = montar_contexto(spec, caso(spec, "T-BOA-02"))
    fontes = {f["fonte_importada_id"]: f["texto"] for f in c["fontes_importadas"]}
    assert fontes["FON-PEDIDO-T-02"] == "Quero um convite curto, sem link nenhum."
    assert fontes["FON-PEDIDO-CARD-T-01"] == "Quero um convite curto, sem link nenhum."
    assert c["pedido"]["ordem_de_servico"]["pedido_original"] == "Quero um convite curto, sem link nenhum."


def test_variante_que_nao_existe_e_erro_claro(spec):
    pedido = carregar_pedido(caso(spec, "T-BOA-01")).dados
    with pytest.raises(ErroDoAdaptador, match="variante 'NADA'"):
        aplicar_variante({"variantes": {}, **pedido}, "NADA")


def test_variante_do_relatorio_remove_item_do_pacote():
    pedido = {"pacote_do_relatorio": {"parte": {"so_voce_faz": [{"id": "PF-01"}, {"id": "PF-02"}]}}}
    novo, _, _ = aplicar_variante(pedido, {"descricao": "x", "remover_do_pacote": ["pacote_do_relatorio.parte.so_voce_faz[id=PF-01]"]})
    assert novo["pacote_do_relatorio"]["parte"]["so_voce_faz"] == [{"id": "PF-02"}]
    assert pedido["pacote_do_relatorio"]["parte"]["so_voce_faz"][0]["id"] == "PF-01"      # o original não muda


def test_variante_escrita_no_caso_com_campo_desconhecido_e_erro():
    with pytest.raises(ErroDoAdaptador, match="não conhece"):
        aplicar_variante({}, {"inventei": 1})


def test_fita_que_nao_existe_e_erro_claro(spec):
    c = caso(spec, "T-BOA-01")
    c.dados["leituras_feitas"] = ["fitas/nao-existe.yaml"]
    with pytest.raises(ErroDoAdaptador, match="não existe"):
        montar_contexto(spec, c)


# ---- a resposta -----------------------------------------------------------------------------
def test_a_resposta_e_texto_json_igual_ao_do_caso(spec):
    c = caso(spec, "T-BOA-01")
    texto = montar_resposta(c)
    assert isinstance(texto, str) and json.loads(texto) == c.dados["resposta"]


# ---- as checagens leem os parâmetros que o adaptador entrega ---------------------------------
def test_a_funcao_da_checagem_le_os_parametros_da_especificacao(tmp_path):
    spec = mentira.criar(tmp_path, parametros={"termos": ["simpático"]})     # outro termo no YAML, nenhuma linha de código mudou
    with mentira.registrada("CHK-TESTE-01", mentira.chk_teste_01):
        boa = prova.avaliar(spec, caso(spec, "T-BOA-01")).relatorio
        ruim = prova.avaliar(spec, caso(spec, "T-RUIM-01")).relatorio
    assert boa.falhas_de("CHK-TESTE-01"), "'simpático' passou a ser o termo proibido pelo YAML"
    assert not ruim.falhas_de("CHK-TESTE-01"), "'proibida' deixou de ser proibida: o YAML manda"


def test_sem_o_bloco_de_parametros_a_funcao_recebe_vazio(spec):
    c = montar_contexto(spec, caso(spec, "T-BOA-01"))
    c["modelo"].pop("parametros_das_checagens")
    assert Execucao(montar_resposta(caso(spec, "T-BOA-01")), c).parametros("CHK-TESTE-01") == {}


def test_parametros_mal_formados_param_com_erro_de_contexto(spec):
    c = montar_contexto(spec, caso(spec, "T-BOA-01"))
    c["modelo"]["parametros_das_checagens"] = {"CHK-TESTE-01": ["lista"]}
    with pytest.raises(validador.ErroDeContexto, match="parametros_das_checagens"):
        conferir_contexto(c)


# ---- o validador de produção não conhece o adaptador -----------------------------------------
def test_o_validador_nao_importa_yaml_nem_o_adaptador():
    raiz = Path(validador.__file__).resolve().parent
    achados = []
    for arq in raiz.rglob("*.py"):
        for no in ast.walk(ast.parse(arq.read_text(encoding="utf-8"))):
            nomes = [a.name for a in no.names] if isinstance(no, ast.Import) else [no.module or ""] if isinstance(no, ast.ImportFrom) and no.level == 0 else []
            achados += [f"{arq.name}: {n}" for n in nomes if n.split(".")[0] in {"yaml", "spec_helena", "jsonschema"}]
    assert not achados, achados


# ---- a especificação de verdade -------------------------------------------------------------
REAL = prova.spec_padrao()
SCHEMA = json.loads((REAL.raiz / "schemas" / "entrega.schema.json").read_text(encoding="utf-8"))["$defs"]["secao"]["properties"]


@pytest.mark.parametrize("tipo", REAL.tipos_existentes())
def test_o_modelo_de_cada_tipo_e_aceito_pelo_validador(tipo):
    m = montar_modelo(REAL, tipo)
    conferir_contexto({"modelo": m})
    assert [s["id"] for s in m["secoes"]] == [s["id"] for s in REAL.tipo(tipo)["secoes"]]
    assert m["limite"] == REAL.tipo(tipo)["limite"]
    for s in m["secoes"]:
        assert set(s) <= set(SCHEMA), f"{tipo}.{s['id']}: campo que não está no entrega.schema.json: {sorted(set(s) - set(SCHEMA))}"
    esperados = {c["id"] for c in REAL.checagens_do_tipo(tipo) if c.get("parametros")}
    assert set(m.get("parametros_das_checagens", {})) == esperados


def test_todo_arquivo_novo_abre_com_um_comentario_de_o_que_e():
    """Quem mantém não programa: cada arquivo do adaptador, das checagens e dos testes abre explicando o que é."""
    aqui = Path(__file__).resolve().parents[1]
    sem = [str(p.relative_to(aqui)) for pasta in ("spec_helena", "validador/checagens", "tests") for p in sorted((aqui / pasta).glob("*.py"))
           if p.stat().st_size and not ast.get_docstring(ast.parse(p.read_text(encoding="utf-8")))]
    assert not sem, f"estes arquivos não abrem com um comentário (o que é, de onde vem, como mudar): {sem}"


# ---- colunas opcionais e colunas de afirmação (vêm do YAML do tipo; nada é inventado) ----------
def test_as_marcas_de_coluna_do_yaml_chegam_ao_validador():
    spec = prova.spec_padrao()
    premissas = next(s for s in montar_modelo(spec, "analise_estrategica")["secoes"] if s["id"] == "premissas")
    por_id = {c["id"]: c for c in premissas["colunas"]}
    assert por_id["valor"]["obrigatoria"] is False and por_id["prova"]["obrigatoria"] is False
    assert por_id["afirmacao"]["apoiada_por_citacao"] is True and "obrigatoria" not in por_id["afirmacao"]
    passos = next(s for s in montar_modelo(spec, "roteiro_treinamento")["secoes"] if s["id"] == "passo_a_passo")
    assert {c["id"]: c.get("obrigatoria", True) for c in passos["colunas"]}["apoio"] is False
