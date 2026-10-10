"""Leitura da ficha: campos certos, conversão da ficha antiga e recusa de ficha que deixaria o agente fazer mais que ler."""

import copy
from pathlib import Path

import pytest
import yaml

from executor_helena.ficha import ler_ficha, ler_modelos
from executor_helena.tipos import ErroDeFicha, Orcamento

FIX = Path(__file__).parent / "fixtures"
V2 = Path(__file__).resolve().parents[3] / "helena-v2"
MODELOS = FIX / "models.yaml"


def ler(nome="ficha_sem_ferramenta.yaml", **kw):
    kw.setdefault("fase_em_curso", "fase 4")
    return ler_ficha(FIX / nome, caminho_dos_modelos=MODELOS, **kw)


def com_ficha_alterada(tmp_path, nome, alterar):
    """Copia uma ficha de teste, aplica `alterar(dados)` e devolve o caminho."""
    dados = yaml.safe_load((FIX / nome).read_text(encoding="utf-8"))
    alterar(dados)
    caminho = tmp_path / "ficha.yaml"
    caminho.write_text(yaml.safe_dump(dados, allow_unicode=True), encoding="utf-8")
    return caminho


def com_modelos_alterados(tmp_path, alterar):
    dados = yaml.safe_load(MODELOS.read_text(encoding="utf-8"))
    alterar(dados)
    caminho = tmp_path / "models.yaml"
    caminho.write_text(yaml.safe_dump(dados, allow_unicode=True), encoding="utf-8")
    return caminho


# --- leitura certa ---------------------------------------------------------------------------------
def test_ficha_sem_ferramenta():
    f = ler()
    assert f.ferramentas == () and f.papel == "AUTOR" and f.servico == "SRV-PLANO-DE-PRATICA"
    assert f.orcamento == Orcamento(buscas=0, partes_de_pagina=0, chamadas_total=2, tempo_s=300)
    assert (f.modelo, f.provedor, f.apelido_do_modelo) == ("gpt-6-sol", "openai-codex", "analise-padrao")
    assert f.formato_da_ficha == "3.1" and f.identidade == "LAURA" and f.agente_id == "AGT-02"
    assert f.regras[0].startswith("CANARIO_REGRA_UM") and f.nunca[0].startswith("CANARIO_NUNCA_UM")


def test_ficha_com_ferramentas():
    f = ler("ficha_com_ferramentas.yaml")
    assert f.ferramentas == ("ler_pagina", "buscar")
    assert f.orcamento == Orcamento(buscas=3, partes_de_pagina=4, chamadas_total=10, tempo_s=900)
    assert f.acoes_permitidas == ("ENTREGAR", "REGISTRAR_FALHA")
    assert f.apelido_do_modelo == "pesquisa-padrao"


def test_a_fase_em_curso_filtra_as_ferramentas_e_zera_o_orcamento_delas():
    na_fase_3 = ler("ficha_com_ferramentas.yaml", fase_em_curso="fase 3")
    assert na_fase_3.ferramentas == ("ler_pagina",)
    assert na_fase_3.orcamento.buscas == 0 and na_fase_3.orcamento.partes_de_pagina == 4
    assert any("buscar" in a for a in na_fase_3.avisos)
    na_v2 = ler("ficha_com_ferramentas.yaml", fase_em_curso="v2.0")
    assert na_v2.ferramentas == () and na_v2.orcamento.partes_de_pagina == 0


def test_fase_em_curso_nao_tem_valor_padrao():
    with pytest.raises(TypeError):
        ler_ficha(FIX / "ficha_sem_ferramenta.yaml", caminho_dos_modelos=MODELOS)        # type: ignore[call-arg]
    with pytest.raises(ErroDeFicha, match="fase_em_curso"):
        ler(fase_em_curso="fase 9")


def test_papel_revisor_nao_tem_ferramenta_e_usa_o_modelo_de_revisao():
    f = ler("ficha_com_ferramentas.yaml", papel="REVISOR")
    assert f.ferramentas == () and f.papel == "REVISOR" and f.servico is None
    assert f.orcamento == Orcamento(0, 0, 3, 300) and f.apelido_do_modelo == "revisao-padrao"


def test_coordenacao_precisa_de_evento_e_so_existe_na_helena(tmp_path):
    helena = V2 / "agents" / "helena.yaml"
    f = ler_ficha(helena, caminho_dos_modelos=V2 / "models.yaml", fase_em_curso="fase 4",
                  papel="COORDENACAO", evento="LER_DE_VOLTA")
    assert f.ferramentas == () and f.servico == "LER_DE_VOLTA" and f.apelido_do_modelo == "coordenacao-padrao"
    with pytest.raises(ErroDeFicha, match="evento"):
        ler_ficha(helena, caminho_dos_modelos=V2 / "models.yaml", fase_em_curso="fase 4", papel="COORDENACAO")
    with pytest.raises(ErroDeFicha):
        ler(papel="COORDENACAO", evento="LER_DE_VOLTA")             # a Laura não tem coordenação


def test_fichas_reais_da_v2_continuam_legiveis():
    """ALERTA, não regressão: lê TODA ficha que existe em helena-v2/agents. Se a outra equipe mudar o formato, avisa aqui."""
    fichas = sorted((V2 / "agents").glob("*.yaml"))
    assert len(fichas) >= 2, "não achei as fichas da v2"
    for caminho in fichas:
        f = ler_ficha(caminho, caminho_dos_modelos=V2 / "models.yaml", fase_em_curso="fase 4")
        assert f.provedor == "openai-codex" and f.regras and f.nunca and f.orcamento.chamadas_total >= 1, caminho.name
        assert set(f.ferramentas) <= {"ler_pagina", "buscar"}, caminho.name
    laura = ler_ficha(V2 / "agents" / "laura.yaml", caminho_dos_modelos=V2 / "models.yaml", fase_em_curso="fase 4")
    assert laura.formato_da_ficha == "3.1" and laura.ferramentas == ()


def test_ficha_antiga_e_convertida_e_avisa():
    f = ler("ficha_antiga_com_busca.yaml")
    assert f.formato_da_ficha == "antigo" and f.ferramentas == ("buscar", "ler_pagina")    # web_search, web_extract
    assert f.orcamento == Orcamento(buscas=12, partes_de_pagina=17, chamadas_total=30, tempo_s=900)
    assert f.acoes_permitidas == ("ENTREGAR", "REGISTRAR_FALHA") and f.identidade == "CLARA DE TESTE"
    assert any("ficha antiga" in a for a in f.avisos) and any("passos 30" in a for a in f.avisos)
    assert f.servico == "ENTREGA-parecer"
    sem = ler("ficha_antiga_sem_ferramenta.yaml")
    assert sem.ferramentas == () and sem.orcamento.partes_de_pagina == 0 and sem.orcamento.chamadas_total == 12
    assert "PERGUNTAR" in sem.acoes_permitidas
    revisor = ler("ficha_antiga_com_busca.yaml", papel="REVISOR")
    assert revisor.ferramentas == () and revisor.orcamento == Orcamento(0, 0, 10, 300)


# --- recusas ---------------------------------------------------------------------------------------
def test_ferramenta_que_nao_so_le_e_recusada(tmp_path):
    def gravar(d):
        d["servicos"][0]["ferramentas"] = [{"nome": "ler_pagina", "efeito": "GRAVAR", "desde": "fase 3"}]
    with pytest.raises(ErroDeFicha, match="LÊ"):
        ler_ficha(com_ficha_alterada(tmp_path, "ficha_com_ferramentas.yaml", gravar), caminho_dos_modelos=MODELOS, fase_em_curso="fase 4")


@pytest.mark.parametrize("nome", ["terminal", "registrar_lancamento", "web_search", "escrever_arquivo", None])
def test_ferramenta_desconhecida_e_recusada(tmp_path, nome):
    def trocar(d):
        d["servicos"][0]["ferramentas"] = [{"nome": nome, "efeito": "LER", "desde": "fase 3"}]
    with pytest.raises(ErroDeFicha, match="desconhecida"):
        ler_ficha(com_ficha_alterada(tmp_path, "ficha_com_ferramentas.yaml", trocar), caminho_dos_modelos=MODELOS, fase_em_curso="fase 4")


def test_ferramenta_repetida_e_fase_invalida_sao_recusadas(tmp_path):
    def repetir(d):
        item = {"nome": "ler_pagina", "efeito": "LER", "desde": "fase 3"}
        d["servicos"][0]["ferramentas"] = [item, copy.deepcopy(item)]
    with pytest.raises(ErroDeFicha, match="repetida"):
        ler_ficha(com_ficha_alterada(tmp_path, "ficha_com_ferramentas.yaml", repetir), caminho_dos_modelos=MODELOS, fase_em_curso="fase 4")

    def fase_ruim(d):
        d["servicos"][0]["ferramentas"][0]["desde"] = "amanha"
    with pytest.raises(ErroDeFicha, match="desde"):
        ler_ficha(com_ficha_alterada(tmp_path, "ficha_com_ferramentas.yaml", fase_ruim), caminho_dos_modelos=MODELOS, fase_em_curso="fase 4")


def test_ferramentas_precisa_ser_lista(tmp_path):
    def trocar(d):
        d["servicos"][0]["ferramentas"] = "ler_pagina"
    with pytest.raises(ErroDeFicha, match="lista"):
        ler_ficha(com_ficha_alterada(tmp_path, "ficha_com_ferramentas.yaml", trocar), caminho_dos_modelos=MODELOS, fase_em_curso="fase 4")


def test_orcamento_impossivel_e_recusado(tmp_path):
    def apertar(d):
        d["servicos"][0]["orcamento"] = {"buscas": 5, "partes_de_pagina": 5, "chamadas_total": 10, "tempo_s": 100}
    with pytest.raises(ErroDeFicha, match="impossível"):
        ler_ficha(com_ficha_alterada(tmp_path, "ficha_com_ferramentas.yaml", apertar), caminho_dos_modelos=MODELOS, fase_em_curso="fase 4")


@pytest.mark.parametrize("campo,valor", [("chamadas_total", 0), ("tempo_s", -1), ("tempo_s", "300"), ("buscas", True)])
def test_orcamento_com_valor_ruim_e_recusado(tmp_path, campo, valor):
    def estragar(d):
        d["servicos"][0]["orcamento"][campo] = valor
    with pytest.raises(ErroDeFicha):
        ler_ficha(com_ficha_alterada(tmp_path, "ficha_sem_ferramenta.yaml", estragar), caminho_dos_modelos=MODELOS, fase_em_curso="fase 4")


def test_servico_com_ferramenta_so_pode_entregar_ou_registrar_falha(tmp_path):
    def liberar(d):
        d["servicos"][0]["acoes_permitidas"] = ["ENTREGAR", "PERGUNTAR", "REGISTRAR_FALHA"]
    with pytest.raises(ErroDeFicha, match="só pode ENTREGAR"):
        ler_ficha(com_ficha_alterada(tmp_path, "ficha_com_ferramentas.yaml", liberar), caminho_dos_modelos=MODELOS, fase_em_curso="fase 4")


def test_escolha_do_servico(tmp_path):
    def dois(d):
        d["servicos"].append(copy.deepcopy(d["servicos"][0]))
        d["servicos"][1]["servico"] = "SRV-OUTRO"
    caminho = com_ficha_alterada(tmp_path, "ficha_sem_ferramenta.yaml", dois)
    with pytest.raises(ErroDeFicha, match="mais de um serviço"):
        ler_ficha(caminho, caminho_dos_modelos=MODELOS, fase_em_curso="fase 4")
    assert ler_ficha(caminho, caminho_dos_modelos=MODELOS, fase_em_curso="fase 4", servico="SRV-OUTRO").servico == "SRV-OUTRO"
    with pytest.raises(ErroDeFicha, match="não tem o serviço"):
        ler_ficha(caminho, caminho_dos_modelos=MODELOS, fase_em_curso="fase 4", servico="SRV-NAO-EXISTE")


def test_apelido_de_modelo_inexistente_ou_no_papel_errado_e_recusado(tmp_path):
    def inventar(d):
        d["modelo"]["autor"] = "gpt-super-novo"
    with pytest.raises(ErroDeFicha, match="não existe em models.yaml"):
        ler_ficha(com_ficha_alterada(tmp_path, "ficha_sem_ferramenta.yaml", inventar), caminho_dos_modelos=MODELOS, fase_em_curso="fase 4")

    def papel_errado(d):
        d["modelo"]["autor"] = "revisao-padrao"
    with pytest.raises(ErroDeFicha, match="do papel REVISAO"):
        ler_ficha(com_ficha_alterada(tmp_path, "ficha_sem_ferramenta.yaml", papel_errado), caminho_dos_modelos=MODELOS, fase_em_curso="fase 4")


@pytest.mark.parametrize("campo", ["reserva", "fallback", "fallback_model", "fallback_providers"])
def test_catalogo_de_modelos_com_reserva_e_recusado(tmp_path, campo):
    def reserva_no_apelido(d):
        d["apelidos"]["analise-padrao"][campo] = "gpt-6-luna"
    with pytest.raises(ErroDeFicha, match="reserva é proibido"):
        ler_modelos(com_modelos_alterados(tmp_path, reserva_no_apelido))

    def reserva_no_topo(d):
        d[campo] = ["outro"]
    with pytest.raises(ErroDeFicha, match="reserva é proibido"):
        ler_modelos(com_modelos_alterados(tmp_path, reserva_no_topo))


def test_catalogo_sem_modelo_ou_provedor_e_recusado(tmp_path):
    def sem_provedor(d):
        del d["apelidos"]["analise-padrao"]["provedor"]
    with pytest.raises(ErroDeFicha, match="modelo e provedor"):
        ler_modelos(com_modelos_alterados(tmp_path, sem_provedor))


@pytest.mark.parametrize("campo", ["missao", "regras", "nunca", "nome", "funcao"])
def test_ficha_sem_campo_obrigatorio_e_recusada(tmp_path, campo):
    def tirar(d):
        del d[campo]
    with pytest.raises(ErroDeFicha):
        ler_ficha(com_ficha_alterada(tmp_path, "ficha_sem_ferramenta.yaml", tirar), caminho_dos_modelos=MODELOS, fase_em_curso="fase 4")


def test_ficha_antiga_com_ferramenta_que_age_e_recusada(tmp_path):
    def agir(d):
        d["ferramentas"] = ["registrar_lancamento"]
    with pytest.raises(ErroDeFicha, match="não é de leitura"):
        ler_ficha(com_ficha_alterada(tmp_path, "ficha_antiga_sem_ferramenta.yaml", agir), caminho_dos_modelos=MODELOS, fase_em_curso="fase 4")


def test_arquivos_que_nao_existem_ou_nao_sao_mapas(tmp_path):
    with pytest.raises(ErroDeFicha):
        ler_ficha(tmp_path / "nao_existe.yaml", caminho_dos_modelos=MODELOS, fase_em_curso="fase 4")
    (tmp_path / "lista.yaml").write_text("- a\n- b\n")
    with pytest.raises(ErroDeFicha, match="não é um mapa"):
        ler_ficha(tmp_path / "lista.yaml", caminho_dos_modelos=MODELOS, fase_em_curso="fase 4")
