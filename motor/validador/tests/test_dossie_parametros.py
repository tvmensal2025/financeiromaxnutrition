"""As checagens do dossiê (CHK-DOSSIE-*) obedecem aos `parametros` do YAML e só valem para o dossiê.

O que é: a prova de que NENHUM número ou lista das checagens está escrito no código. Cada teste muda UM parâmetro no contexto
(o mesmo bloco que o adaptador monta a partir de helena-v2/deliverables/dossie.yaml) e confere que o comportamento muda junto.
Prova também que parâmetro faltando ou vazio PARA o validador (ErroDeContexto) em vez de desligar a checagem em silêncio, e que
as oito checagens dizem "não se aplica" para outro tipo de entrega e para quem não entrega (REGISTRAR_FALHA).
De onde vem: as bases dossie_boa_01, _02 e _03 (tests/casos/spec_dossie.py) são os casos bons da especificação.
Como mudar: para uma checagem nova do dossiê, acrescente a linha em CASOS_DE_PARAMETRO (qual parâmetro mexer e qual motivo aparece).
"""
import copy
import json

import pytest

from validador import ErroDeContexto, validar

from . import fabrica as F
from .banco import montar
from .casos import spec_dossie  # noqa: F401  (registra as bases dossie_boa_0N na fábrica)

FORMA, ENTIDADE, FATOS = "CHK-DOSSIE-FORMA", "CHK-DOSSIE-ENTIDADE", "CHK-DOSSIE-FATOS"
SEPARACAO, LACUNAS, AUSENCIA = "CHK-DOSSIE-SEPARACAO", "CHK-DOSSIE-LACUNAS", "CHK-DOSSIE-AUSENCIA"
RENDA, ACAO = "CHK-DOSSIE-SEM-PROMESSA-DE-RENDA", "CHK-DOSSIE-SEM-ACAO-EXTERNA"
TODAS = [FORMA, ENTIDADE, FATOS, SEPARACAO, LACUNAS, AUSENCIA, RENDA, ACAO]
B1, B2, B3 = "dossie_boa_01", "dossie_boa_02", "dossie_boa_03"
PLANTADA = "Leitura minha: a Mimix oferece renda garantida a quem indicar muitas pessoas."


def rodar(base, mexer=None, remendos=()):
    resposta, contexto = montar(base, list(remendos))
    if mexer:
        mexer(contexto["modelo"]["parametros_das_checagens"])
    return validar(resposta, contexto)


def motivos(relatorio, chk):
    return {f.motivo for f in relatorio.falhas_de(chk)}


def acrescentar(chk, chave, valor):
    return lambda p: p[chk][chave].append(valor)


def trocar(chk, **novos):
    return lambda p: p[chk].update(novos)


# (o que se muda no YAML, base, checagem, mudança nos parâmetros, motivo que passa a aparecer)
CASOS_DE_PARAMETRO = [
    ("máximo de caracteres da afirmação", B3, FORMA, lambda p: p[FORMA]["maximo"].update(afirmacao=20), "CELULA_GRANDE_DEMAIS"),
    ("máximo de caracteres do trecho citado", B3, FORMA, lambda p: p[FORMA]["maximo"].update(trecho_original=30), "CELULA_GRANDE_DEMAIS"),
    ("tipos de entidade aceitos", B2, ENTIDADE, lambda p: p[ENTIDADE].update(tipos=["EMPRESA", "LEI"]), "TIPO_DE_ENTIDADE_INVALIDO"),
    ("expressão de leitura a mais na lista", B3, SEPARACAO, acrescentar(SEPARACAO, "termos", "conta cadastrada"), "EXPRESSAO_DE_LEITURA"),
    ("palavra inteira desligada", B3, SEPARACAO, lambda p: (p[SEPARACAO]["termos"].append("pagament"), p[SEPARACAO].update(palavra_inteira=False)),
     "EXPRESSAO_DE_LEITURA"),
    ("prefixo da interpretação", B1, SEPARACAO, trocar(SEPARACAO, prefixo_da_interpretacao="Minha leitura:"), "INTERPRETACAO_SEM_PREFIXO"),
    ("mínimo de caracteres da lacuna", B2, LACUNAS, trocar(LACUNAS, caracteres_min=200), "CAMPO_VAZIO"),
    ("texto de enfeite a mais na lista", B2, LACUNAS,
     acrescentar(LACUNAS, "textos_vazios", "Política de equipamentos ou de reembolso da Mimix, se houver"), "CAMPO_VAZIO"),
    ("expressão de inexistência a mais", B2, LACUNAS, acrescentar(LACUNAS, "afirma_inexistencia", "os termos lidos não tratam"), "AFIRMA_INEXISTENCIA"),
    ("mínimo de termos procurados", B2, AUSENCIA, trocar(AUSENCIA, termos_min=5), "TERMOS_FORA_DO_NUMERO"),
    ("máximo de termos procurados", B2, AUSENCIA, trocar(AUSENCIA, termos_max=3), "TERMOS_FORA_DO_NUMERO"),
    ("separador dos termos", B2, AUSENCIA, trocar(AUSENCIA, separador=";"), "TERMOS_FORA_DO_NUMERO"),
    ("tamanho mínimo do termo", B2, AUSENCIA, trocar(AUSENCIA, caracteres_min_do_termo=20), "TERMO_CURTO"),
    ("expressão de renda a mais na lista", B2, RENDA, acrescentar(RENDA, "termos", "reembolsa equipamento"), "PROMESSA_DE_RENDA"),
    ("expressão de ação a mais na lista", B2, ACAO, acrescentar(ACAO, "termos", "equipamento"), "CONVITE_A_AGIR"),
]


@pytest.mark.parametrize("nome,base,chk,mexer,motivo", CASOS_DE_PARAMETRO, ids=[c[0] for c in CASOS_DE_PARAMETRO])
def test_mudar_o_parametro_muda_o_comportamento(nome, base, chk, mexer, motivo):
    assert not motivos(rodar(base), chk), f"{chk} deveria passar na base {base} com os parâmetros da especificação"
    assert motivo in motivos(rodar(base, mexer), chk), f"mudar '{nome}' no YAML não mudou o comportamento de {chk}"


def test_caixa_e_acento_ligados_e_desligados():
    p_ligado = trocar(SEPARACAO, termos=["PAGAMENTO"], sem_diferenca_de_maiusculas_e_acentos=True)
    p_desligado = trocar(SEPARACAO, termos=["PAGAMENTO"], sem_diferenca_de_maiusculas_e_acentos=False)
    assert "EXPRESSAO_DE_LEITURA" in motivos(rodar(B3, p_ligado), SEPARACAO)
    assert "EXPRESSAO_DE_LEITURA" not in motivos(rodar(B3, p_desligado), SEPARACAO)


def test_palavra_inteira_ligada_e_desligada():
    ligada = trocar(SEPARACAO, termos=["pagament"], palavra_inteira=True)
    desligada = trocar(SEPARACAO, termos=["pagament"], palavra_inteira=False)
    assert "EXPRESSAO_DE_LEITURA" not in motivos(rodar(B3, ligada), SEPARACAO)
    assert "EXPRESSAO_DE_LEITURA" in motivos(rodar(B3, desligada), SEPARACAO)


def test_tirar_um_termo_da_lista_do_yaml_libera_o_termo():
    remendo = [("r.entrega.interpretacoes[0].leitura", PLANTADA)]
    assert "PROMESSA_DE_RENDA" in motivos(rodar(B1, None, remendo), RENDA)
    sem = lambda p: p[RENDA].update(termos=[t for t in p[RENDA]["termos"] if t != "renda garantida"])  # noqa: E731
    assert "PROMESSA_DE_RENDA" not in motivos(rodar(B1, sem, remendo), RENDA)


# (checagem, parâmetros que o código lê): sem um deles, o validador PARA
OBRIGATORIOS = [
    (FORMA, ["maximo"]),
    (ENTIDADE, ["tipos"]),
    (SEPARACAO, ["sem_diferenca_de_maiusculas_e_acentos", "palavra_inteira", "prefixo_da_interpretacao", "termos"]),
    (LACUNAS, ["caracteres_min", "sem_diferenca_de_maiusculas_e_acentos", "textos_vazios", "afirma_inexistencia"]),
    (AUSENCIA, ["sem_diferenca_de_maiusculas_e_acentos", "separador", "termos_min", "termos_max", "caracteres_min_do_termo"]),
    (RENDA, ["sem_diferenca_de_maiusculas_e_acentos", "palavra_inteira", "termos"]),
    (ACAO, ["sem_diferenca_de_maiusculas_e_acentos", "palavra_inteira", "termos"]),
]
PARES = [(chk, nome) for chk, nomes in OBRIGATORIOS for nome in nomes]


@pytest.mark.parametrize("chk,nome", PARES, ids=[f"{c}:{n}" for c, n in PARES])
def test_parametro_faltando_para_o_validador(chk, nome):
    with pytest.raises(ErroDeContexto, match=chk):
        rodar(B1, lambda p: p[chk].pop(nome))


@pytest.mark.parametrize("chk,nome", [(c, n) for c, n in PARES if n in ("termos", "textos_vazios", "afirma_inexistencia", "tipos")],
                         ids=lambda v: str(v))
def test_lista_vazia_para_o_validador(chk, nome):
    """Lista vazia desligaria a checagem sem ninguém ver: o validador para."""
    with pytest.raises(ErroDeContexto, match=chk):
        rodar(B1, lambda p: p[chk].update({nome: []}))


def test_numero_no_formato_errado_para_o_validador():
    with pytest.raises(ErroDeContexto, match=AUSENCIA):
        rodar(B2, trocar(AUSENCIA, termos_min="dois"))
    with pytest.raises(ErroDeContexto, match=FORMA):
        rodar(B1, lambda p: p[FORMA].update(maximo={"afirmacao": "trezentos"}))


def test_sem_o_pedido_no_contexto_a_entidade_para_o_validador():
    resposta, contexto = montar(B2, [])
    contexto["fontes_importadas"] = [f for f in contexto["fontes_importadas"] if not f["fonte_importada_id"].startswith("FON-PEDIDO")]
    contexto.pop("pedido")
    with pytest.raises(ErroDeContexto, match="pedido"):
        validar(resposta, contexto)


def status(relatorio):
    return {c.id: c.status for c in relatorio.checagens}


def test_outro_tipo_de_entrega_nao_e_tocado():
    """O dossiê antigo da fábrica (sem a seção 'entidade' e sem parâmetros) não roda nenhuma CHK-DOSSIE-*."""
    resposta, contexto = F.dossie()
    st = status(validar(json.dumps(resposta, ensure_ascii=False), contexto))
    assert {i: st[i] for i in TODAS} == {i: "NAO_SE_APLICA" for i in TODAS}


def test_quem_nao_entrega_nao_e_tocado():
    resposta, contexto = montar(B2, [])
    falha = {"acao": "REGISTRAR_FALHA", "motivo_falha": "FONTE_INSUFICIENTE", "explicacao": "As páginas da lista não tratam do assunto pedido."}
    st = status(validar(json.dumps(falha, ensure_ascii=False), contexto))
    assert {i: st[i] for i in TODAS} == {i: "NAO_SE_APLICA" for i in TODAS}


def test_modelo_do_dossie_sem_a_secao_entidade_nao_passa_em_silencio():
    """Se o modelo é do dossiê (traz os parâmetros) mas perdeu a seção 'entidade', as checagens rodam e RECUSAM."""
    resposta, contexto = montar(B2, [])
    contexto["modelo"]["secoes"] = [s for s in contexto["modelo"]["secoes"] if s["id"] != "entidade"]
    rel = validar(resposta, contexto)
    assert status(rel)[FORMA] == "FALHOU" and "SECAO_A_MAIS" in motivos(rel, FORMA)
    assert "ENTIDADE_NAO_E_UMA" not in motivos(rel, ENTIDADE) and status(rel)[ENTIDADE] in ("PASSOU", "FALHOU")


def test_as_oito_checagens_rodam_nas_tres_boas_da_especificacao():
    for base in (B1, B2, B3):
        st = status(rodar(base))
        assert all(st[i] in ("PASSOU", "FALHOU") for i in TODAS), (base, st)
        assert all(st[i] == "PASSOU" for i in TODAS), (base, {i: st[i] for i in TODAS})


def test_a_entrega_nao_e_alterada_pelas_checagens():
    """Rodar a validação duas vezes dá o mesmo resultado e não mexe no contexto (sem efeito colateral)."""
    resposta, contexto = montar(B1, [])
    antes = copy.deepcopy(contexto)
    a, b = validar(resposta, contexto), validar(resposta, contexto)
    assert contexto == antes
    assert [(f.id, f.motivo, f.item) for f in a.falhas] == [(f.id, f.motivo, f.item) for f in b.falhas]
