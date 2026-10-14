"""Os casos de prova da especificação (helena-v2/casos/) contra o validador.

O que é: para cada caso de helena-v2/casos/**, o adaptador (spec_helena/) monta a resposta e o contexto, o validador roda, e
conferimos o que a especificação promete:
  caso BOM   nenhuma checagem do código recusa (e as de `deve_passar_em` não acusam nada);
  caso RUIM  cada CHK de `deve_falhar_em` que já existe no código pega o defeito (com a gravidade da especificação);
             cada CHK que ainda NÃO existe está na lista ADIADAS abaixo e o caso fica "skipped" com o motivo;
             defeito do revisor (RUB-...) passa no código.
Três listas explícitas ficam NESTE arquivo, e o teste é rigoroso nos dois sentidos com todas elas (nada some em silêncio):
  ADIADAS                   CHK da especificação que ainda não existem no código. Falha se uma CHK da lista passar a existir
                            (lista velha: apague a linha) ou se um caso apontar para uma CHK que não está na lista nem no código.
  DIVERGENCIAS_EM_CASOS_BONS  recusas do código a respostas BOAS da especificação (formatos que não casam). Falha se a divergência
                            desaparecer (apague a linha) ou se aparecer uma nova (investigue; não acrescente sem entender).
  FUROS_CONHECIDOS          defeitos da especificação que uma CHK já existente deixa passar. Mesma regra.
Como mudar: ao implementar uma CHK, apague o id dela de ADIADAS. Ao consertar uma divergência, apague a linha dela.
"""
import pytest

from spec_helena import prova
from validador import CHECAGENS

SPEC = prova.spec_padrao()
AVALIACOES = prova.avaliacoes_da_spec()
MOTIVO_ADIADA = "checagem ainda não implementada"


# ---------------------------------------------------------------------------------------
# 1. O que ainda não existe no código (a fila de trabalho dos próximos agentes)
# ---------------------------------------------------------------------------------------
from .adiadas import ADIADAS  # noqa: E402  (um arquivo por tipo, em tests/adiadas/; é a fila de quem implementa)

# ---------------------------------------------------------------------------------------
# 2. Respostas BOAS da especificação que o código recusa hoje: (id da checagem, motivo) -> por quê
#    Cada serviço roda só as checagens da sua especificação (modelo.checagens_a_rodar: comuns + criterio_de_pronto do tipo),
#    então as checagens ANTIGAS (CHK-CALC, CHK-FONTE, CHK-LEI, CHK-TEMA...) não entram aqui. Sobram as comuns; quando uma
#    delas ainda não entende um desenho da especificação, a divergência fica escrita aqui até alguém decidir.
# ---------------------------------------------------------------------------------------
DIVERGENCIAS_EM_CASOS_BONS = {
    # (vazio: as três divergências antigas foram consertadas na raiz — coluna opcional, conferência de palavras só onde há
    # afirmação e detector de idioma que ignora dinheiro. Se uma resposta BOA voltar a ser recusada por checagem comum, o teste
    # acusa; só acrescente aqui depois de entender por quê, com o motivo escrito.)
}

# ---------------------------------------------------------------------------------------
# 3. Defeitos da especificação que uma CHK que JÁ existe deixa passar: id do caso -> (CHK, por quê)
# ---------------------------------------------------------------------------------------
FUROS_CONHECIDOS = {}  # nenhum no momento: COPY-RUIM-03 e CALC-RUIM-13 (CHK-COMUM-05) foram consertados em checagens/acao_externa.py


def _tipo_do_caso(av):
    return SPEC.servicos.get(av.caso.servico, {}).get("tipo_de_entrega")


def _casos_que_rodam():
    """As avaliações de casos cujo tipo já tem arquivo na especificação (as demais aparecem quando o arquivo existir).
    Caso de serviço que nem está no servicos.yaml entra na lista de propósito: vai falhar em test_o_caso_foi_montado_e_rodou."""
    return [a for a in AVALIACOES if _tipo_do_caso(a) is None or SPEC.tipo(_tipo_do_caso(a)) is not None]


BONS = [a for a in _casos_que_rodam() if a.caso.bom]
RUINS = [a for a in _casos_que_rodam() if not a.caso.bom]


# ---------------------------------------------------------------------------------------
# As réguas (funções puras, testadas também com casos de mentira em test_regua_dos_casos.py)
# ---------------------------------------------------------------------------------------
def problemas_do_caso_bom(av, divergencias=None) -> list:
    """O que está errado numa resposta boa: recusa fora das divergências conhecidas, ou acusação em `deve_passar_em`."""
    divergencias = DIVERGENCIAS_EM_CASOS_BONS if divergencias is None else divergencias
    achados = []
    for f in av.relatorio.falhas:
        conhecida = (f.id, f.motivo) in divergencias
        if f.gravidade == "RECUSA" and not conhecida:
            achados.append(f"recusada por {f.id}/{f.motivo} em {f.item}: {f.mensagem}")
        elif f.id in av.caso.deve_passar_em and not conhecida:
            achados.append(f"{f.id} deveria passar (deve_passar_em) mas acusou {f.motivo} em {f.item}")
    return achados


def problemas_do_caso_ruim(spec, av, adiadas=None, furos=None) -> tuple:
    """(problemas, ids adiados). Para cada CHK do `deve_falhar_em`: se existe no código tem de pegar; se não, tem de estar em ADIADAS."""
    adiadas = ADIADAS if adiadas is None else adiadas
    furos = FUROS_CONHECIDOS if furos is None else furos
    problemas, adiados = [], []
    for id_ in (i for i in av.caso.deve_falhar_em if i.startswith("CHK-")):
        if prova.registrada(id_):
            if not prova.pegou(spec, av, id_):
                if furos.get(av.caso.id, (None,))[0] != id_:
                    visto = sorted({(f.id, f.gravidade) for f in av.relatorio.falhas})
                    problemas.append(f"{id_} existe no código mas NÃO pegou o defeito (gravidade da especificação: {spec.gravidade(id_)}); falhas vistas: {visto}")
            elif furos.get(av.caso.id, (None,))[0] == id_:
                problemas.append(f"{id_} agora pega o defeito: apague {av.caso.id} de FUROS_CONHECIDOS")
        elif id_ in adiadas:
            adiados.append(id_)
        else:
            problemas.append(f"{id_} não existe no código e não está em ADIADAS: acrescente-o na lista (motivo: {MOTIVO_ADIADA}) ou implemente a CHK")
    return problemas, adiados


def adiadas_velhas(adiadas=None) -> list:
    """Ids da lista ADIADAS que já existem no código (lista velha: é para apagá-los da lista)."""
    return sorted(i for i in (ADIADAS if adiadas is None else adiadas) if prova.registrada(i))


def problemas_do_defeito_do_revisor(av, tolerados=None) -> list:
    """Defeito que só o revisor pega (RUB-...): o código não pode recusá-lo, a não ser pelas divergências conhecidas."""
    tolerados = set(DIVERGENCIAS_EM_CASOS_BONS) if tolerados is None else tolerados
    return [f"o código recusou por {i}/{m}, mas este defeito é do revisor (portão 2)" for i, m in sorted(av.recusas() - tolerados)]


# ---------------------------------------------------------------------------------------
# Os testes
# ---------------------------------------------------------------------------------------
def test_ha_casos_da_especificacao():
    assert len(BONS) >= 20 and len(RUINS) >= 100, "os casos da especificação sumiram? (helena-v2/casos/)"


def test_casos_de_tipos_que_ainda_nao_tem_arquivo_aparecem_quando_existirem():
    esperando = sorted({_tipo_do_caso(a) for a in AVALIACOES if _tipo_do_caso(a) and SPEC.tipo(_tipo_do_caso(a)) is None})
    if esperando:
        pytest.skip(f"estes tipos têm casos mas ainda não têm deliverables/<tipo>.yaml: {', '.join(esperando)}")


@pytest.mark.parametrize("av", _casos_que_rodam(), ids=lambda a: a.caso.id)
def test_o_caso_foi_montado_e_rodou(av):
    assert av.erro is None, f"o adaptador não conseguiu montar o caso {av.caso.id}: {av.erro}"


@pytest.mark.parametrize("av", BONS, ids=lambda a: a.caso.id)
def test_caso_bom_nao_e_recusado(av):
    assert av.rodou, av.erro
    problemas = problemas_do_caso_bom(av)
    assert not problemas, f"{av.caso.id} é um caso BOM da especificação:\n  " + "\n  ".join(problemas)


@pytest.mark.parametrize("av", RUINS, ids=lambda a: a.caso.id)
def test_caso_ruim_e_pego(av):
    assert av.rodou, av.erro
    caso = av.caso
    alvos = caso.deve_falhar_em
    assert alvos or caso.dados.get("passa_no_codigo"), f"{caso.id}: o caso ruim não diz deve_falhar_em nem passa_no_codigo"
    if caso.so_o_revisor_pega:
        problemas = problemas_do_defeito_do_revisor(av)
        assert not problemas, f"{caso.id} ({alvos or 'passa_no_codigo'}):\n  " + "\n  ".join(problemas)
        return
    problemas, adiados = problemas_do_caso_ruim(SPEC, av)
    assert not problemas, f"{caso.id}:\n  " + "\n  ".join(problemas)
    if adiados:
        pytest.skip(f"{MOTIVO_ADIADA}: {', '.join(adiados)}")


# ---- as listas explícitas não podem ficar velhas -------------------------------------------
def test_adiadas_sao_ids_da_especificacao_e_ainda_nao_existem_no_codigo():
    na_spec = set(SPEC.todas_as_checagens())
    desconhecidas = sorted(ADIADAS - na_spec)
    assert not desconhecidas, f"ADIADAS tem id que não está em helena-v2/deliverables: {desconhecidas}"
    velhas = adiadas_velhas()
    assert not velhas, f"ADIADAS está velha: estas CHK já existem no código, apague-as da lista: {velhas}"


def test_divergencias_conhecidas_ainda_acontecem():
    vistas = {par for av in BONS if av.rodou for par in av.recusas()}
    velhas = sorted(set(DIVERGENCIAS_EM_CASOS_BONS) - vistas)
    assert not velhas, f"Estas divergências sumiram (conserto feito?). Apague de DIVERGENCIAS_EM_CASOS_BONS: {velhas}"


def test_furos_conhecidos_apontam_para_casos_e_checagens_que_existem():
    por_id = {a.caso.id: a for a in AVALIACOES}
    for caso_id, (chk, _) in FUROS_CONHECIDOS.items():
        assert caso_id in por_id, f"FUROS_CONHECIDOS cita o caso {caso_id}, que não existe mais: apague a linha"
        assert chk in por_id[caso_id].caso.deve_falhar_em and prova.registrada(chk), f"{caso_id}: {chk} não é mais o alvo ou deixou de existir"
