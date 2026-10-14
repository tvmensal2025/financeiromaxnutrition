"""O quadro de cobertura: as contas, o texto e o README em dia."""
import pytest

from spec_helena import cobertura as C
from spec_helena import listar_casos, prova

from . import spec_de_mentira as mentira
from .test_regua_dos_casos import marca_sempre, nunca_pega


# ---- o README tem sempre o quadro de agora ---------------------------------------------------
def test_o_readme_tem_o_quadro_de_cobertura_em_dia():
    texto = C.README.read_text(encoding="utf-8")
    trecho = C.trecho_do_readme(texto)
    assert trecho is not None, f"o README precisa dos marcadores {C.MARCA_ABRE} e {C.MARCA_FECHA}"
    atual = C.markdown(C.quadro_atual()).strip()
    assert trecho == atual, ("O quadro do README está velho. Rode:  python -m spec_helena --atualizar-readme\n\n"
                             f"--- README ---\n{trecho}\n--- agora ---\n{atual}")


def test_o_readme_tem_a_ressalva_em_portugues_simples():
    trecho = C.trecho_do_readme(C.README.read_text(encoding="utf-8"))
    x, y = C.totais(C.quadro_atual())
    assert (f"O portão 1 cobre {x} de {y} checagens citadas pelas entregas dos agentes do primeiro card; "
            "as demais estão marcadas FUTURA; a rubrica (RUB-...) é do revisor, não do código.") in trecho


def test_o_readme_tem_a_secao_de_cobertura():
    assert "## Cobertura das checagens da especificação" in C.README.read_text(encoding="utf-8")


def test_atualizar_readme_reescreve_so_o_trecho(tmp_path):
    arq = tmp_path / "README.md"
    arq.write_text(f"antes\n{C.MARCA_ABRE}\nvelho\n{C.MARCA_FECHA}\ndepois\n", encoding="utf-8")
    assert C.atualizar_readme(arq) is True
    novo = arq.read_text(encoding="utf-8")
    assert novo.startswith("antes\n") and novo.endswith("\ndepois\n") and "velho" not in novo
    assert C.trecho_do_readme(novo) == C.markdown(C.quadro_atual()).strip()
    assert C.atualizar_readme(arq) is False        # segunda vez: nada a mudar


# ---- o quadro cobre todos os tipos do primeiro card ------------------------------------------
def test_o_quadro_lista_cada_chk_dos_tipos_do_primeiro_card():
    spec = prova.spec_padrao()
    quadro = dict(C.montar_quadro(spec, prova.avaliacoes_da_spec()))
    for tipo in C.TIPOS_DO_PRIMEIRO_CARD:
        if spec.tipo(tipo) is None:
            assert tipo not in quadro            # dossie: só aparece quando o arquivo existir
            continue
        assert [l.id for l in quadro[tipo]] == [c["id"] for c in spec.checagens_do_tipo(tipo)]
    assert [l.id for l in quadro[C.NOME_DO_GRUPO_COMUM]] == [f"CHK-COMUM-{n:02d}" for n in range(1, 11)]


def test_nada_aparece_como_implementada_se_nao_esta_no_codigo():
    for _, linhas in C.quadro_atual():
        for l in linhas:
            if l.estado == C.IMPLEMENTADA:
                assert prova.registrada(l.id), l
            if not prova.registrada(l.id):
                assert (l.estado, l.motivo) == (C.FUTURA, C.MOTIVO_NAO_EXISTE)


# ---- as contas, com uma especificação de mentira ---------------------------------------------
def quadro_de_mentira(spec):
    avaliacoes = [prova.avaliar(spec, c) for c in listar_casos(spec)]
    por_id = {l.id: l for _, ls in C.montar_quadro(spec, avaliacoes, tipos=("teste", "dossie")) for l in ls}
    return por_id, C.montar_quadro(spec, avaliacoes, tipos=("teste", "dossie"))


@pytest.fixture()
def spec(tmp_path):
    return mentira.criar(tmp_path)


def test_futura_quando_a_checagem_nao_existe(spec):
    por_id, quadro = quadro_de_mentira(spec)
    assert (por_id["CHK-TESTE-01"].estado, por_id["CHK-TESTE-01"].motivo) == (C.FUTURA, C.MOTIVO_NAO_EXISTE)
    assert [nome for nome, _ in quadro] == [C.NOME_DO_GRUPO_COMUM, "teste"]       # dossie não existe nesta especificação


def test_implementada_quando_existe_passa_no_caso_bom_e_pega_o_defeito(spec):
    with mentira.registrada("CHK-TESTE-01", mentira.chk_teste_01):
        por_id, quadro = quadro_de_mentira(spec)
    assert por_id["CHK-TESTE-01"].estado == C.IMPLEMENTADA
    assert C.totais(quadro) == (1, 3)                       # CHK-COMUM-01 (sem defeito na mentira), TESTE-01 ok, TESTE-02 futura


def test_futura_quando_existe_mas_nao_pega_o_defeito(spec):
    with mentira.registrada("CHK-TESTE-01", nunca_pega):
        por_id, _ = quadro_de_mentira(spec)
    assert (por_id["CHK-TESTE-01"].estado, por_id["CHK-TESTE-01"].motivo) == (C.FUTURA, C.MOTIVO_NAO_PEGA)


def test_futura_quando_existe_mas_nenhum_caso_bom_a_exercita(spec):
    with mentira.registrada("CHK-TESTE-01", lambda exe: None):          # sempre "não se aplica"
        por_id, _ = quadro_de_mentira(spec)
    assert (por_id["CHK-TESTE-01"].estado, por_id["CHK-TESTE-01"].motivo) == (C.FUTURA, C.MOTIVO_SEM_CASO_BOM)


def test_futura_quando_existe_mas_a_especificacao_nao_tem_defeito_para_ela(spec):
    por_id, _ = quadro_de_mentira(spec)                                  # CHK-COMUM-01 existe de verdade; a mentira não a ataca
    assert (por_id["CHK-COMUM-01"].estado, por_id["CHK-COMUM-01"].motivo) == (C.FUTURA, C.MOTIVO_SEM_CASO_RUIM)


def test_a_gravidade_da_especificacao_entra_na_conta(spec):
    with mentira.registrada("CHK-TESTE-02", marca_sempre, gravidade="MARCA"):
        por_id, _ = quadro_de_mentira(spec)
    assert por_id["CHK-TESTE-02"].estado == C.FUTURA and por_id["CHK-TESTE-02"].motivo == C.MOTIVO_SEM_CASO_BOM    # marca em toda resposta: nunca "passou"


# ---- o texto -----------------------------------------------------------------------------------
@pytest.mark.parametrize("ids,esperado", [
    (["CHK-COPY-01", "CHK-COPY-02", "CHK-COPY-03"], "CHK-COPY-01 a 03"),
    (["CHK-COPY-01", "CHK-COPY-02"], "CHK-COPY-01, CHK-COPY-02"),
    (["CHK-A-01", "CHK-A-02", "CHK-A-03", "CHK-B-01", "CHK-B-02", "CHK-B-04"], "CHK-A-01 a 03, CHK-B-01, CHK-B-02, CHK-B-04"),
    (["CHK-PARECER-AJUSTE", "CHK-PARECER-TEMAS"], "CHK-PARECER-AJUSTE, CHK-PARECER-TEMAS"),
])
def test_abreviar_ids_seguidos(ids, esperado):
    assert C.abreviar(ids) == esperado


def test_o_markdown_diz_x_de_y_e_o_detalhe_lista_todas():
    quadro = C.quadro_atual()
    x, y = C.totais(quadro)
    assert f"cobre {x} de {y} checagens" in C.markdown(quadro)
    detalhe = C.markdown(quadro, detalhe=True)
    assert all(l.id in detalhe for _, ls in quadro for l in ls)
