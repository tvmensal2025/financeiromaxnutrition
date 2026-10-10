"""(2) Mutações: versões estragadas da referência que o checador de invariantes PRECISA pegar.

Para cada defeito (mutantes.py) são três provas:
  1. o cenário curto roda limpo na referência (controle: o cenário em si não é o problema);
  2. o mesmo cenário na versão estragada é acusado pela invariante certa;
  3. a busca ALEATÓRIA (sementes) também acha o defeito, sem ninguém dizer onde procurar.
As cinco mutações do pedido original estão marcadas com "(pedido)" na descrição.
"""
import pytest

from ajudantes import nomes_violados, rodar_lista
from mutantes import MUTACOES
from simulador import INVARIANTES, Referencia, rodar
from simulador.referencia import Referencia as _Ref

LIMITE_DE_SEMENTES = 500          # as mutações aparecem nas primeiras ~30 sementes; sobra folga


def nome(m):
    return m.classe.__name__


def primeira_semente(classe, invariante, limite=LIMITE_DE_SEMENTES):
    """Primeira semente em que a invariante acusa a versão estragada (None se nenhuma em 'limite')."""
    for semente in range(limite):
        if invariante in nomes_violados(rodar(classe(), semente)):
            return semente
    return None


@pytest.mark.parametrize("m", MUTACOES, ids=nome)
def test_controle_o_cenario_curto_na_referencia_limpa_nao_acusa_nada(m):
    assert nomes_violados(rodar_lista(m.cenario, m.roteiro, Referencia())) == [], m.descricao


@pytest.mark.parametrize("m", MUTACOES, ids=nome)
def test_o_cenario_curto_na_versao_estragada_e_acusado_pela_invariante_certa(m):
    x = rodar_lista(m.cenario, m.roteiro, m.classe())
    assert m.invariante in nomes_violados(x), f"{m.descricao}: nada acusado ({m.classe.__name__})"


@pytest.mark.parametrize("m", MUTACOES, ids=nome)
def test_a_busca_aleatoria_acha_a_mutacao_sozinha(m):
    semente = primeira_semente(m.classe, m.invariante)
    assert semente is not None, f"{m.descricao}: {LIMITE_DE_SEMENTES} sementes não acharam ({m.classe.__name__})"


# ----------------------------------------------------------------------------- as cinco do pedido, por nome
CINCO_DO_PEDIDO = {
    "remover o teto de execuções": "SemTetoDeExecucoes",
    "permitir auto-aprovação": ("PortaoAceitaQualquerRevisor", "QualquerUmAprovaComoRevisor", "AutorAprovaAPropriaPeca"),
    "permitir o padrão do relógio aprovar a entrega": "PadraoDoRelogioAprovaAEntrega",
    "permitir o agente executar a ação externa": "AgenteExecutaAcaoExterna",
    "deixar etapa aprovada sobre informação velha": ("DecisaoNovaNaoRefazNada", "AjusteNaoRefazQuemDepende",
                                                      "CardFechaComEtapaPendente"),
}


def test_as_cinco_mutacoes_do_pedido_estao_na_lista():
    existentes = {m.classe.__name__ for m in MUTACOES}
    for descricao, classes in CINCO_DO_PEDIDO.items():
        for classe in ((classes,) if isinstance(classes, str) else classes):
            assert classe in existentes, f"falta a mutação '{descricao}': {classe}"


def test_remover_o_teto_faz_a_etapa_passar_de_seis_execucoes():
    """O defeito em números: com o teto, o máximo é 6; sem o teto, a mesma entrada passa de 6."""
    from ajudantes import formato_errado_seguido
    from simulador.roteiro import ROTEIRO_UNICA
    from mutantes import SemTetoDeExecucoes
    com = rodar_lista(formato_errado_seguido(9), ROTEIRO_UNICA, Referencia())
    sem = rodar_lista(formato_errado_seguido(9), ROTEIRO_UNICA, SemTetoDeExecucoes())
    assert com.foto_final.etapas["U1"].execucoes == 6 and not com.violacoes
    assert sem.foto_final.etapas["U1"].execucoes == 9
    assert any("9 execuções (teto 6)" in v.mensagem for v in sem.violacoes)


def test_padrao_do_relogio_aprovando_a_ultima_etapa_fecha_o_card_e_mesmo_assim_e_acusado():
    """A aprovação da última etapa fecha o card no mesmo passo: o APROVADA nem aparece na foto. Foi um buraco do checador."""
    from ajudantes import FUNDADOR_REVISA_E_NAO_RESPONDE
    from mutantes import PadraoDoRelogioAprovaAEntrega
    from simulador.roteiro import ROTEIRO_UNICA
    x = rodar_lista(FUNDADOR_REVISA_E_NAO_RESPONDE, ROTEIRO_UNICA, PadraoDoRelogioAprovaAEntrega())
    assert x.foto_final.card["estado"] == "PRONTO"
    assert any(v.invariante == "padrao_nunca_aprova" and "PRONTA por RELOGIO" in v.mensagem for v in x.violacoes)


# ----------------------------------------------------------------------------- a lista é completa
GANCHOS = ["_cabe_mais_uma_execucao", "_revisor_valido", "_destino_do_padrao_da_etapa", "_padrao_da_acao", "_chave_vale",
           "_toque_em_card_fechado", "_decisao_reabre", "_dependentes_reabrem", "_ao_entregar_proposta", "_pode_perguntar",
           "_cancelar_etapas", "_ao_pausar_tudo", "_evento_conhecido", "_todas_aprovadas", "_pode_executar_a_acao",
           "_anteriores_aprovadas", "_falha_de_infra", "_sem_passagem"]


@pytest.mark.parametrize("gancho", GANCHOS)
def test_todo_ponto_de_decisao_da_referencia_tem_uma_mutacao_que_o_estraga(gancho):
    """referencia.py avisa: cada ponto de decisão é um método pequeno que uma mutação estraga."""
    assert hasattr(_Ref, gancho), f"{gancho} sumiu da referência"
    estragam = [m.classe.__name__ for m in MUTACOES if gancho in vars(m.classe)]
    assert estragam, f"nenhuma mutação estraga {gancho}"


def test_nenhuma_mutacao_e_igual_a_referencia():
    for m in MUTACOES:
        assert issubclass(m.classe, Referencia) and m.classe is not Referencia
        assert {k for k in vars(m.classe) if not k.startswith("__")}, f"{m.classe.__name__} não muda nada"


def test_toda_invariante_exceto_a_do_alvo_tem_mutacao_que_ela_pega():
    """O_alvo_nao_acusou só fala quando o próprio alvo acusa (a máquina real); a referência nunca acusa."""
    cobertas = {m.invariante for m in MUTACOES}
    assert set(INVARIANTES) - cobertas == {"o_alvo_nao_acusou"}


def test_as_mutacoes_nao_se_repetem():
    nomes = [m.classe.__name__ for m in MUTACOES]
    assert len(nomes) == len(set(nomes))
