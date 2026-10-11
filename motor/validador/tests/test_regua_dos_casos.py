"""A régua do teste dos casos da especificação, provada com casos de mentira.

Aqui provamos o que test_casos_da_spec.py promete:
  (i)   nada some em silêncio (CHK que não existe sem estar em ADIADAS é problema);
  (ii)  CHK que passa a existir e não pega o seu defeito faz o teste falhar (inclusive a gravidade: RECUSA ou MARCA);
  (iii) CHK em ADIADAS que já existe no código é "lista velha".
"""
import pytest

from spec_helena import listar_casos, prova
from validador.resultado import Falha

from . import spec_de_mentira as mentira
from .test_casos_da_spec import adiadas_velhas, problemas_do_caso_bom, problemas_do_caso_ruim, problemas_do_defeito_do_revisor


@pytest.fixture()
def spec(tmp_path):
    return mentira.criar(tmp_path)


def avaliar(spec, id_):
    return prova.avaliar(spec, next(c for c in listar_casos(spec) if c.id == id_))


def nunca_pega(exe):
    return [] if exe.acao == "ENTREGAR" else None


def marca_sempre(exe):
    return [Falha("CHK-TESTE-02", "MARCADA", "entrega", "marca de teste", "")] if exe.acao == "ENTREGAR" else None


def recusa_sempre(exe):
    return [Falha("CHK-TESTE-02", "RECUSADA", "entrega", "recusa de teste", "")] if exe.acao == "ENTREGAR" else None


def test_i_chk_que_nao_existe_e_nao_esta_em_adiadas_e_problema(spec):
    problemas, adiados = problemas_do_caso_ruim(spec, avaliar(spec, "T-RUIM-01"), adiadas=set(), furos={})
    assert adiados == [] and len(problemas) == 1 and "CHK-TESTE-01" in problemas[0] and "ADIADAS" in problemas[0]


def test_i_chk_que_nao_existe_mas_esta_em_adiadas_fica_adiada_com_motivo(spec):
    problemas, adiados = problemas_do_caso_ruim(spec, avaliar(spec, "T-RUIM-01"), adiadas={"CHK-TESTE-01"}, furos={})
    assert problemas == [] and adiados == ["CHK-TESTE-01"]


def test_ii_chk_que_existe_e_pega_o_defeito_esta_certo(spec):
    with mentira.registrada("CHK-TESTE-01", mentira.chk_teste_01):
        problemas, adiados = problemas_do_caso_ruim(spec, avaliar(spec, "T-RUIM-01"), adiadas=set(), furos={})
    assert problemas == [] and adiados == []


def test_ii_chk_que_existe_e_nao_pega_faz_o_teste_falhar(spec):
    with mentira.registrada("CHK-TESTE-01", nunca_pega):
        problemas, _ = problemas_do_caso_ruim(spec, avaliar(spec, "T-RUIM-01"), adiadas=set(), furos={})
    assert len(problemas) == 1 and "NÃO pegou" in problemas[0]


def test_ii_chk_que_existe_e_nao_pega_mas_esta_em_adiadas_continua_falhando(spec):
    """Estar em ADIADAS não esconde uma CHK que já existe: a lista velha é denunciada à parte e o defeito não pego também."""
    with mentira.registrada("CHK-TESTE-01", nunca_pega):
        problemas, _ = problemas_do_caso_ruim(spec, avaliar(spec, "T-RUIM-01"), adiadas={"CHK-TESTE-01"}, furos={})
    assert any("NÃO pegou" in p for p in problemas)


def test_ii_a_gravidade_da_especificacao_vale_marca_pega_como_marca(spec):
    with mentira.registrada("CHK-TESTE-02", marca_sempre, gravidade="MARCA"):
        problemas, _ = problemas_do_caso_ruim(spec, avaliar(spec, "T-RUIM-02"), adiadas=set(), furos={})
    assert problemas == []


def test_ii_a_gravidade_da_especificacao_vale_recusa_no_lugar_de_marca_nao_conta(spec):
    with mentira.registrada("CHK-TESTE-02", recusa_sempre, gravidade="RECUSA"):
        problemas, _ = problemas_do_caso_ruim(spec, avaliar(spec, "T-RUIM-02"), adiadas=set(), furos={})
    assert len(problemas) == 1 and "gravidade da especificação: MARCA" in problemas[0]


def test_iii_lista_velha_e_detectada():
    assert adiadas_velhas({"CHK-TESTE-01"}) == []
    with mentira.registrada("CHK-TESTE-01", mentira.chk_teste_01):
        assert adiadas_velhas({"CHK-TESTE-01", "CHK-COPY-01"}) == ["CHK-TESTE-01"]


def test_furo_conhecido_que_foi_consertado_faz_o_teste_falhar(spec):
    with mentira.registrada("CHK-TESTE-01", mentira.chk_teste_01):
        problemas, _ = problemas_do_caso_ruim(spec, avaliar(spec, "T-RUIM-01"), adiadas=set(), furos={"T-RUIM-01": ("CHK-TESTE-01", "x")})
    assert len(problemas) == 1 and "FUROS_CONHECIDOS" in problemas[0]


def test_furo_conhecido_que_continua_furo_nao_reclama(spec):
    with mentira.registrada("CHK-TESTE-01", nunca_pega):
        problemas, _ = problemas_do_caso_ruim(spec, avaliar(spec, "T-RUIM-01"), adiadas=set(), furos={"T-RUIM-01": ("CHK-TESTE-01", "x")})
    assert problemas == []


def test_defeito_do_revisor_passa_no_codigo_e_se_o_codigo_recusa_e_problema(spec):
    av = avaliar(spec, "T-RUIM-03")
    assert av.caso.so_o_revisor_pega and problemas_do_defeito_do_revisor(av) == []
    with mentira.registrada("CHK-TESTE-02", recusa_sempre):
        recusado = avaliar(spec, "T-RUIM-03")
        assert len(problemas_do_defeito_do_revisor(recusado)) == 1
        assert problemas_do_defeito_do_revisor(recusado, tolerados={("CHK-TESTE-02", "RECUSADA")}) == []


def test_caso_bom_recusado_por_checagem_que_existe_faz_o_teste_falhar(spec):
    with mentira.registrada("CHK-TESTE-02", recusa_sempre):
        av = avaliar(spec, "T-BOA-01")
        assert len(problemas_do_caso_bom(av, divergencias={})) == 1
        assert problemas_do_caso_bom(av, divergencias={("CHK-TESTE-02", "RECUSADA")}) == []


def test_caso_bom_com_chk_de_deve_passar_em_que_acusa_e_problema(spec):
    def acusa(exe):
        return [Falha("CHK-TESTE-01", "ACUSADA", "entrega", "acusa de teste", "")] if exe.acao == "ENTREGAR" else None
    with mentira.registrada("CHK-TESTE-01", acusa, gravidade="MARCA"):
        problemas = problemas_do_caso_bom(avaliar(spec, "T-BOA-01"), divergencias={})
    assert len(problemas) == 1 and "deve_passar_em" in problemas[0]


def test_caso_bom_que_passa_esta_certo(spec):
    with mentira.registrada("CHK-TESTE-01", mentira.chk_teste_01):
        assert problemas_do_caso_bom(avaliar(spec, "T-BOA-01"), divergencias={}) == []
