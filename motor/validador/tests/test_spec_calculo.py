"""Testes das checagens CHK-CALCULO-01 a 12 que NÃO são "um defeito plantado" (esses ficam em tests/casos/spec_calculo.py).

O que é: (1) as regras vêm do YAML (mudou o `parametros`, a checagem muda); (2) sem os parâmetros a checagem não se aplica ou recusa,
nunca aprova sem conferir; (3) as peças de leitura de número e de conta têm testes próprios; (4) conta feita em fração é exata.
De onde vem: validador/checagens/spec_calculo_*.py e helena-v2/deliverables/calculo.yaml. Como mudar: um teste novo por regra nova.
"""
import copy
import json
from decimal import Decimal
from fractions import Fraction

import pytest

from validador import validar
from validador.checagens import spec_calculo_base as B
from validador.checagens.spec_calculo_entradas import tipo_da_unidade

from . import fabrica as F
from .banco import montar
from .casos import spec_calculo as C  # registra as bases calculo_spec

MOEDAS = {"R$": "BRL", "US$": "USD", "€": "EUR"}


def rodar(remendos=(), base="calculo_spec", **mudancas_no_parametro):
    """Valida a resposta da base com remendos; `mudancas_no_parametro`: {"CHK-CALCULO-04": {"constantes_aceitas": [...]}}."""
    r, c = montar(base, list(remendos))
    for chk, mudancas in mudancas_no_parametro.items():
        c["modelo"]["parametros_das_checagens"][chk.replace("_", "-")].update(mudancas)
    return validar(r, c)


def motivos(rel, chk):
    return {f.motivo for f in rel.falhas_de(chk)}


# ---------------------------------------------------------------------------------------
# 1. A resposta boa passa em tudo, e as regras vêm do YAML
# ---------------------------------------------------------------------------------------
def test_a_boa_da_especificacao_passa_nas_12_checagens():
    rel = rodar()
    chks = [c for c in rel.checagens if c.id.startswith("CHK-CALCULO-")]
    assert len(chks) == 12 and all(c.status == "PASSOU" for c in chks), [(c.id, c.status) for c in chks]
    assert not rel.falhas


def test_constante_aceita_vem_do_yaml():
    mes_de_4_semanas = [(C.E + "contas[0].expressao", "V1 × V2 × 4")]
    assert "CONSTANTE_NAO_ACEITA" in motivos(rodar(mes_de_4_semanas), "CHK-CALCULO-04")
    com_4 = rodar(mes_de_4_semanas, CHK_CALCULO_04={"constantes_aceitas": [100, 12, 30, 52, 365, 4]})
    assert "CONSTANTE_NAO_ACEITA" not in motivos(com_4, "CHK-CALCULO-04")


def test_minimo_de_palavras_da_citacao_vem_do_yaml():
    curto = [(C.E + "entradas[0].valor.citacao.trecho_original", "10 pessoas gravando 5 horas por semana")]
    assert "TRECHO_CURTO" in motivos(rodar(curto), "CHK-CALCULO-02")
    assert "TRECHO_CURTO" not in motivos(rodar(curto, CHK_CALCULO_02={"minimo_palavras": 5}), "CHK-CALCULO-02")


def test_frase_inteira_so_vale_se_o_yaml_aceita():
    frase = [(C.E + "entradas[2].valor.citacao.trecho_original", "A plataforma paga à empresa US$ 0,50 por hora aprovada de cada pessoa indicada.")]
    assert "TRECHO_CURTO" not in motivos(rodar(frase, CHK_CALCULO_02={"minimo_palavras": 20}), "CHK-CALCULO-02")
    assert "TRECHO_CURTO" in motivos(rodar(frase, CHK_CALCULO_02={"minimo_palavras": 20, "aceita_frase_inteira": False}), "CHK-CALCULO-02")


def test_termos_de_certeza_vem_do_yaml():
    garantido = [(C.LEITURA, "O cenário base está garantido pela plataforma.")]
    assert motivos(rodar(garantido), "CHK-CALCULO-10") == {"CERTEZA_SOBRE_PREVISAO"}
    sem_o_termo = rodar(garantido, CHK_CALCULO_10={"termos": ["com certeza"]})
    assert not sem_o_termo.falhas_de("CHK-CALCULO-10")


def test_palavras_e_siglas_fiscais_vem_do_yaml():
    das = [(C.E + "contas[2].o_que", "Valor por mês, antes do DAS")]
    assert motivos(rodar(das), "CHK-CALCULO-12") == {"ASSUNTO_FISCAL"}
    assert not rodar(das, CHK_CALCULO_12={"siglas_maiusculas_palavra_inteira": ["ISS"]}).falhas_de("CHK-CALCULO-12")


def test_constantes_do_modelo_no_texto_vem_do_yaml():
    texto = [(C.LEITURA, "É uma estimativa: o ano tem 365 dias.")]
    assert not rodar(texto).falhas_de("CHK-CALCULO-09")
    assert "NUMERO_SOLTO" in motivos(rodar(texto, CHK_CALCULO_09={"constantes_do_modelo": [100, 12, 30, 52]}), "CHK-CALCULO-09")


def test_moedas_e_cambio_vem_do_yaml():
    sem_moeda = rodar(C.como_fonte_citada(4, C.FRASE_TABELA_CAMBIO) + [(C.E + "entradas[4].valor.data_da_fonte", C.DEL)],
                      CHK_CALCULO_03={"moedas": {"US$": "USD"}})
    assert "CAMBIO_SEM_DATA" not in motivos(sem_moeda, "CHK-CALCULO-03")  # sem "R$" na lista, a unidade 'R$ por US$' não é câmbio
    assert "CAMBIO_SEM_DATA" in motivos(rodar(C.como_fonte_citada(4, C.FRASE_TABELA_CAMBIO) + [(C.E + "entradas[4].valor.data_da_fonte", C.DEL)]), "CHK-CALCULO-03")


def test_pacote_com_termo_novo_recusa_sem_mexer_no_codigo():
    leitura = [(C.LEITURA, "É uma estimativa, e não uma promessa de ouro.")]
    assert not rodar(leitura).falhas_de("CHK-CALCULO-11")
    r, c = montar("calculo_spec", leitura)
    c["pacote_da_empresa"]["termos_proibidos_em_todo_texto"].append("promessa de OURO")
    assert motivos(validar(r, c), "CHK-CALCULO-11") == {"TERMO_PROIBIDO_PELO_PACOTE"}


def test_termos_do_pacote_fora_do_texto_citado_nao_contam():
    """O trecho original da citação é do pedido do fundador: termo proibido ali não é culpa do Caio."""
    r, c = montar("calculo_spec", [])
    c["pacote_da_empresa"]["termos_proibidos_em_todo_texto"].append("que eu vi hoje no meu banco")
    assert not validar(r, c).falhas_de("CHK-CALCULO-11")


# ---------------------------------------------------------------------------------------
# 2. Sem os parâmetros: não se aplica (desenho antigo) ou recusa (parâmetro quebrado)
# ---------------------------------------------------------------------------------------
def test_entrega_do_desenho_antigo_nao_roda_as_checagens_novas():
    r, c = F.calculo()
    rel = validar(r, c)
    status = {x.id: x.status for x in rel.checagens if x.id.startswith("CHK-CALCULO-")}
    assert set(status.values()) == {"NAO_SE_APLICA"} and len(status) == 12


@pytest.mark.parametrize("chk,chave", [("CHK-CALCULO-01", "ids"), ("CHK-CALCULO-02", "fontes_por_origem"), ("CHK-CALCULO-03", "moedas"),
                                       ("CHK-CALCULO-04", "constantes_aceitas"), ("CHK-CALCULO-06", "cenarios"), ("CHK-CALCULO-08", "naturezas"),
                                       ("CHK-CALCULO-09", "texto_livre"), ("CHK-CALCULO-10", "termos"), ("CHK-CALCULO-12", "palavras")])
def test_parametro_que_falta_recusa_em_vez_de_aprovar(chk, chave):
    r, c = montar("calculo_spec", [])
    del c["modelo"]["parametros_das_checagens"][chk][chave]
    rel = validar(r, c)
    assert motivos(rel, chk) == {"PARAMETROS_INVALIDOS"}, motivos(rel, chk)
    assert rel.recusas and not [f for f in rel.falhas if f.motivo == "ERRO_INTERNO_DA_CHECAGEM"]


def test_parametro_em_formato_errado_recusa():
    r, c = montar("calculo_spec", [])
    c["modelo"]["parametros_das_checagens"]["CHK-CALCULO-01"]["ids"] = "(["  # regex quebrada
    c["modelo"]["parametros_das_checagens"]["CHK-CALCULO-10"]["termos"] = "garantido"  # devia ser lista
    rel = validar(r, c)
    assert motivos(rel, "CHK-CALCULO-01") == motivos(rel, "CHK-CALCULO-10") == {"PARAMETROS_INVALIDOS"}


def test_lista_de_termos_do_pacote_quebrada_recusa():
    r, c = montar("calculo_spec", [])
    c["pacote_da_empresa"]["termos_proibidos_em_todo_texto"] = "dinheiro fácil"
    assert motivos(validar(r, c), "CHK-CALCULO-11") == {"PARAMETROS_INVALIDOS"}


def test_so_vale_para_o_tipo_calculo_e_para_entregar():
    r, c = montar("calculo_spec", [])
    c["modelo"]["tipo"] = "copy"
    assert all(x.status == "NAO_SE_APLICA" for x in validar(r, c).checagens if x.id.startswith("CHK-CALCULO-"))
    pergunta = {"acao": "PERGUNTAR", "pergunta": "Você quer o valor por semana ou por mês?",
                "opcoes": [{"letra": "A", "texto": "Por semana", "consequencia": "Soma as horas da semana"}, {"letra": "B", "texto": "Por mês", "consequencia": "Usa 52 ÷ 12 semanas"}]}
    r, c = montar("calculo_spec", [("r", pergunta)])
    assert all(x.status == "NAO_SE_APLICA" for x in validar(r, c).checagens if x.id.startswith("CHK-CALCULO-"))


# ---------------------------------------------------------------------------------------
# 3. As peças
# ---------------------------------------------------------------------------------------
@pytest.mark.parametrize("texto,esperado", [("70", "70"), ("0,50", "0.50"), ("1.234,56", "1234.56"), ("1.000", "1000"), ("54.17", "54.17"),
                                            ("0.5", "0.5"), ("12,5", "12.5"), ("1234", "1234")])
def test_numero_do_texto_le_milhar_com_ponto_e_decimal_com_virgula(texto, esperado):
    assert B.numero_do_texto(texto) == Decimal(esperado)


@pytest.mark.parametrize("texto", ["1.2.3", "1,2,3", "1..000", "abc", "", "1.00.0", ",5", "5,"])
def test_numero_do_texto_nao_chuta(texto):
    assert B.numero_do_texto(texto) is None


@pytest.mark.parametrize("palavras,valor", [(["cem"], 100), (["dez"], 10), (["mil", "e", "quinhentos"], 1500), (["dois", "mil"], 2000),
                                            (["cento", "e", "vinte", "e", "cinco"], 125), (["trinta", "e", "cinco"], 35), (["um", "milhao"], 1_000_000),
                                            (["mil"], 1000), (["zero"], 0)])
def test_numero_por_extenso(palavras, valor):
    assert B.numero_por_extenso(palavras) == Decimal(valor)


def test_numero_por_extenso_recusa_o_que_nao_e_numero():
    assert B.numero_por_extenso(["casa"]) is None and B.numero_por_extenso(["e"]) is None and B.numero_por_extenso([]) is None


def test_tolerancia_e_meia_unidade_da_ultima_casa():
    assert B.casa_da_tolerancia(Decimal("216.67")) == Fraction(1, 200)
    assert B.casa_da_tolerancia(Decimal("409.5")) == Fraction(1, 20)
    assert B.casa_da_tolerancia(Decimal("10")) == Fraction(1, 2)
    exato = Fraction(2600, 12)  # 216,666...
    assert B.bate(exato, Decimal("216.67")) and B.bate(exato, Decimal("216.7")) and B.bate(exato, Decimal("217"))
    assert not B.bate(exato, Decimal("216.66")) and not B.bate(exato, Decimal("216.6")) and not B.bate(exato, Decimal("218"))


@pytest.mark.parametrize("unidade,tipo", [("pessoas", None), ("%", None), ("US$ por hora aprovada", ("M", "USD")), ("R$ por mês", ("M", "BRL")),
                                          ("€ por mês", ("M", "EUR")), ("R$ por US$", ("C", "BRL", "USD")), ("US$/R$", ("C", "USD", "BRL")),
                                          ("US$ e R$ por hora", "ERRO"), ("R$ por R$", "ERRO"), ("reais por mês", None)])
def test_tipo_da_unidade(unidade, tipo):
    assert tipo_da_unidade(unidade, MOEDAS) == tipo


def test_conta_em_fracao_e_exata_mesmo_com_divisao_no_meio():
    """O avaliador antigo (expressao.py) recusa 216,666... × 70 por não caber em decimal; em fração a conta é exata."""
    r, c = montar("calculo_spec", [])
    exe_modelo = B._carregar(json.loads(r)["entrega"])
    exatos, erros = B.refazer(exe_modelo, [100, 12, 30, 52, 365], B.valores_das_entradas(exe_modelo))
    assert not erros
    assert exatos["K1"] == Fraction(2600, 12)
    assert exatos["K3"] == Fraction(455, 6)           # 75,8333...
    assert exatos["K4"] == Fraction(455, 6) * Fraction(54, 10)


def test_conta_que_cresce_demais_e_recusada_sem_travar():
    r, c = montar("calculo_spec", [(C.E + "contas[0].expressao", " × ".join(["V1"] * 60) + " × " + " × ".join(["V2"] * 60))])
    rel = validar(r, c)
    assert rel.recusas and not [f for f in rel.falhas if f.motivo == "ERRO_INTERNO_DA_CHECAGEM"]


def test_achar_sigla_so_em_maiuscula_e_palavra_inteira():
    assert B.achar_sigla("antes do DAS do mês", "DAS") and not B.achar_sigla("das pessoas", "DAS") and not B.achar_sigla("RADAS", "DAS")


def test_achar_termo_sem_diferenciar_acento_nem_caixa():
    from validador import texto as T
    assert B.achar_termo(T.dobrar("Isto é SEM  DÚVIDA certo"), "sem dúvida")
    assert not B.achar_termo(T.dobrar("garantidos"), "garantido")  # palavra inteira: 'garantidos' é outro termo da lista
    assert not B.achar_termo(T.dobrar("risco zeros"), "risco zero")


# ---------------------------------------------------------------------------------------
# 4. Casos de borda que o banco não cobre
# ---------------------------------------------------------------------------------------
def test_sentido_menor_e_melhor_aceita_a_ordem_inversa():
    """Um custo: o cenário conservador é o MAIOR. O código confere a ordem pelo sentido, não pela posição."""
    inverso = [(C.E + "resultado_principal[0].sentido", "MENOR_E_MELHOR"), (C.E + "cenarios[0].ajustes", "V4 = 90"), (C.E + "cenarios[0].resultado.valor", 97.5),
               (C.E + "cenarios[2].ajustes", "V4 = 50"), (C.E + "cenarios[2].resultado.valor", 54.17),
               (C.E + "cenarios[3].ajustes", "V4 = 90"), (C.E + "cenarios[3].resultado.valor", 526.5),
               (C.E + "cenarios[5].ajustes", "V4 = 50"), (C.E + "cenarios[5].resultado.valor", 292.5),
               (C.E + "resultado_principal[1].sentido", "MENOR_E_MELHOR")]
    assert not rodar(inverso).falhas_de("CHK-CALCULO-06")


def test_cenario_de_ajuste_com_numero_em_formato_brasileiro():
    escrito = [(C.E + "cenarios[0].ajustes", "V4 = 50,0"), (C.E + "cenarios[2].ajustes", "V4 = 9e1")]
    assert motivos(rodar(escrito), "CHK-CALCULO-06") == {"AJUSTE_MAL_ESCRITO"}
    assert not rodar([(C.E + "cenarios[0].ajustes", "V4 = 50,0")]).falhas_de("CHK-CALCULO-06")


def test_dois_ajustes_na_mesma_linha_sao_refeitos_juntos():
    r = rodar([(C.E + "entradas+", C.PREMISSA_V6), (C.E + "premissas_a_confirmar+", C.V6_NAS_PREMISSAS),
               (C.E + "contas[0].expressao", "V1 × V2 × V6 ÷ V6 × 52 ÷ 12"),
               (C.E + "cenarios[0].ajustes", "V4 = 50; V6 = 4,0"), (C.E + "cenarios[3].ajustes", "V6 = 4,0; V4 = 50")])
    assert not r.falhas_de("CHK-CALCULO-06") and not r.falhas_de("CHK-CALCULO-04")


def test_um_numero_por_extenso_que_esta_nas_tabelas_passa():
    assert not rodar([(C.LEITURA, "É uma estimativa: sobram dez pessoas e noventa por cento no melhor caso.")]).falhas_de("CHK-CALCULO-09")


def test_dinheiro_por_extenso_com_e_fora_da_tabela():
    assert motivos(rodar([(C.LEITURA, "É uma estimativa: a empresa pode receber mil e quinhentos reais no ano.")]), "CHK-CALCULO-09") == {"NUMERO_SOLTO_POR_EXTENSO"}


def test_numero_com_mil_das_tabelas_passa_e_fora_das_tabelas_nao():
    base = [(C.E + "entradas[0].valor.valor", 1000)]
    assert not rodar(base + [(C.LEITURA, "É uma estimativa para 1 mil pessoas gravando.")]).falhas_de("CHK-CALCULO-09")
    assert "NUMERO_SOLTO" in motivos(rodar([(C.LEITURA, "É uma estimativa para 1 mil pessoas gravando.")]), "CHK-CALCULO-09")


def test_fonte_citada_precisa_de_fonte_que_nao_seja_do_pedido():
    rel = rodar(C.como_fonte_citada(2, C.FRASE_TABELA_V3))
    assert not rel.falhas
    # a mesma fonte, citada como dado do fundador: recusada
    rel = rodar(C.como_fonte_citada(2, C.FRASE_TABELA_V3) + [(C.E + "entradas[2].valor.origem", "DADO_DO_FUNDADOR")])
    assert motivos(rel, "CHK-CALCULO-02") == {"FONTE_DE_OUTRA_ORIGEM"}


def test_entrega_aprovada_so_com_fonte_de_entrega_e_trecho_dela():
    entrega = {"fonte_importada_id": "FON-ENTREGA-CARD-TESTE-CALCULO-01-E0",
               "texto": "Resultado da etapa anterior: a Humano Digital tem 10 pessoas gravando 5 horas por semana na Mimix e no Hub neste mês."}
    remendos = [("c.fontes_importadas+", entrega), (C.E + "entradas[0].valor.origem", "ENTREGA_APROVADA"),
                (C.E + "entradas[0].valor.ref", entrega["fonte_importada_id"]),
                (C.E + "entradas[0].valor.citacao", {"trecho_original": "a Humano Digital tem 10 pessoas gravando 5 horas por semana na Mimix e no Hub neste mês.",
                                                      "fonte_importada_id": entrega["fonte_importada_id"]})]
    assert not rodar(remendos).falhas_de("CHK-CALCULO-02")
    errada = [(C.E + "entradas[0].valor.ref", "FON-PEDIDO-CALCULO-01"), (C.E + "entradas[0].valor.citacao.fonte_importada_id", "FON-PEDIDO-CALCULO-01")]
    assert motivos(rodar(remendos + errada), "CHK-CALCULO-02") == {"FONTE_DE_OUTRA_ORIGEM"}


def test_o_resultado_nao_depende_da_ordem_das_chaves_nem_de_float():
    """O adaptador entrega número como texto JSON; o validador lê como Decimal. 0.1 + 0.2 não vira 0.30000000000000004."""
    r, c = montar("calculo_spec", [(C.E + "entradas[1].valor.valor", 0.1), (C.E + "entradas[0].valor.valor", 3)])
    texto = json.dumps(r)
    assert "0.1" in texto
    assert not [f for f in validar(texto, copy.deepcopy(c)).falhas if f.motivo == "ERRO_INTERNO_DA_CHECAGEM"]
