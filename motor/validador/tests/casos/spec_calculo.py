"""Banco de casos do cálculo do Caio (CHK-CALCULO-01 a 12): defeitos plantados e respostas honestas.

O que é: cada caso parte da resposta BOA da especificação (helena-v2/casos/SRV-CALCULO/boas/boa-01.yaml, lida pelo adaptador)
e muda UM detalhe (os "remendos", como em banco.py). Roda SÓ as checagens CHK-CALCULO-* (modelo.checagens_a_rodar), com os
`parametros` do YAML do tipo: assim cada caso prova a checagem que nomeia, sem ruído das comuns.
De onde vem: a base vem da especificação, nada é copiado para cá. Como mudar: um defeito novo é uma linha Defeito(...) com o id da
checagem, o motivo esperado e os remendos; a numeração das linhas (entradas[0] = V1, contas[0] = K1, cenarios[0..2] = K3, cenarios[3..5] = K4)
é a da boa-01.
"""
import copy
import json
from functools import lru_cache

from spec_helena import prova
from spec_helena.caso import listar_casos, montar_entrada

from .. import fabrica
from ..banco import DEL, Defeito, Honesta

R = "RECUSA"
E = "r.entrega."
PEDIDO = "FON-PEDIDO-CALCULO-01"
FRASE_V3 = "A plataforma paga à empresa US$ 0,50 por hora aprovada de cada pessoa indicada."
FRASE_CAMBIO = "Quero o valor em dólar e em reais, com a cotação de R$ 5,40 por dólar que eu vi hoje no meu banco."
TABELA = ("Tabela de pagamentos da plataforma, publicada em 09/10/2026. A plataforma paga à empresa US$ 0,50 por hora aprovada de cada pessoa indicada. "
          "A cotação do dólar no boletim do banco era de R$ 5,40 por dólar naquele dia, segundo o boletim diário publicado.")
FONTE_TABELA = {"fonte_importada_id": "FON-TABELA-01", "texto": TABELA}
FRASE_TABELA_V3 = "A plataforma paga à empresa US$ 0,50 por hora aprovada de cada pessoa indicada."
FRASE_TABELA_CAMBIO = "A cotação do dólar no boletim do banco era de R$ 5,40 por dólar naquele dia, segundo o boletim diário publicado."


@lru_cache(maxsize=None)
def _caso_da_spec(id_do_caso: str):
    spec = prova.spec_padrao()
    caso = next(c for c in listar_casos(spec) if c.id == id_do_caso)
    resposta, contexto = montar_entrada(spec, caso)
    # só as checagens do cálculo (as comuns têm o seu próprio banco; a CHK-COMUM-06 tem uma divergência conhecida com estes casos)
    contexto["modelo"]["checagens_a_rodar"] = [i for i in contexto["modelo"]["checagens_a_rodar"] if i.startswith("CHK-CALCULO-")]
    return json.loads(resposta), contexto


def _base(id_do_caso):
    return lambda: copy.deepcopy(_caso_da_spec(id_do_caso))


fabrica.BASES["calculo_spec"] = _base("CALC-BOA-01")
fabrica.BASES["calculo_spec_dolar"] = _base("CALC-BOA-02")


# ---- peças para montar remendos
def entrada(id_, o_que, valor, unidade, origem, **mais):
    return {"id": id_, "o_que": o_que, "valor": {"valor": valor, "unidade": unidade, "origem": origem, **mais}}


def do_pedido(trecho):
    return {"ref": PEDIDO, "citacao": {"trecho_original": trecho, "fonte_importada_id": PEDIDO}}


def conta(id_, o_que, expressao, valor, unidade, natureza="PREVISTO"):
    return {"id": id_, "o_que": o_que, "expressao": expressao, "natureza": natureza,
            "resultado": {"valor": valor, "unidade": unidade, "origem": "CALCULADO", "ref": id_}}


def da_tabela(trecho, data="2026-10-09"):
    return {"ref": "FON-TABELA-01", "data_da_fonte": data, "citacao": {"trecho_original": trecho, "fonte_importada_id": "FON-TABELA-01"}}


def como_fonte_citada(i, trecho, data="2026-10-09"):
    """Remendos que trocam a entrada i (V3 ou V5) de dado do fundador para fonte citada (com a tabela do pacote)."""
    return [("c.fontes_importadas+", FONTE_TABELA), (f"{E}entradas[{i}].valor.origem", "FONTE_CITADA"),
            (f"{E}entradas[{i}].valor.ref", "FON-TABELA-01"),
            (f"{E}entradas[{i}].valor.citacao", {"trecho_original": trecho, "fonte_importada_id": "FON-TABELA-01"}),
            (f"{E}entradas[{i}].valor.data_da_fonte", data)]


PREMISSA_V6 = entrada("V6", "Dias de gravação por semana, suposição minha", 3, "dias", "PREMISSA")
V6_NAS_PREMISSAS = {"entrada": "V6", "por_que_este_valor": "Suposição minha para testar uma premissa que não pesa.", "como_confirmar": "Perguntar a cada pessoa quantos dias grava."}
LEITURA = E + "leitura"

DEFEITOS = [
    # ---- CHK-CALCULO-01: entradas tipadas
    Defeito("CS01", "calculo_spec", "id de entrada fora de V1 a V15", ("CHK-CALCULO-01", "ID_FORA_DO_PADRAO", R), [(E + "entradas[3].id", "V16")]),
    Defeito("CS02", "calculo_spec", "dois ids V1", ("CHK-CALCULO-01", "ID_REPETIDO", R), [(E + "entradas[1].id", "V1")]),
    Defeito("CS03", "calculo_spec", "entrada sem unidade", ("CHK-CALCULO-01", "SEM_UNIDADE", R), [(E + "entradas[1].valor.unidade", "")]),
    Defeito("CS04", "calculo_spec", "valor que não é número", ("CHK-CALCULO-01", "VALOR_INVALIDO", R), [(E + "entradas[2].valor.valor", "meio dólar")]),
    Defeito("CS05", "calculo_spec", "origem inventada", ("CHK-CALCULO-01", "ORIGEM_INVALIDA", R), [(E + "entradas[0].valor.origem", "CHUTE")]),
    Defeito("CS06", "calculo_spec", "entrada CALCULADO", ("CHK-CALCULO-01", "ORIGEM_INVALIDA", R), [(E + "entradas[2].valor.origem", "CALCULADO")]),
    Defeito("CS07", "calculo_spec", "entrada que nenhuma conta usa (número decorativo)", ("CHK-CALCULO-01", "ENTRADA_SEM_USO", R),
            [(E + "entradas+", entrada("V6", "Pessoas indicadas, repetido", 10, "pessoas", "DADO_DO_FUNDADOR", **do_pedido("Quanto entra por mês para a Humano Digital com 10 pessoas gravando 5 horas por semana na Mimix e no Hub?")))]),
    Defeito("CS08", "calculo_spec", "entrada que não é objeto", ("CHK-CALCULO-01", "ENTRADA_MALFORMADA", R), [(E + "entradas+", "V7 = 3")]),
    # ---- CHK-CALCULO-02: origem provada
    Defeito("CS09", "calculo_spec", "valor que não está no trecho citado", ("CHK-CALCULO-02", "VALOR_NAO_ESTA_NO_TRECHO", R), [(E + "entradas[2].valor.valor", 0.6)]),
    Defeito("CS10", "calculo_spec", "dado seu sem citação", ("CHK-CALCULO-02", "PROVA_SEM_CITACAO", R), [(E + "entradas[0].valor.citacao", DEL)]),
    Defeito("CS11", "calculo_spec", "ref diferente da fonte da citação", ("CHK-CALCULO-02", "REF_DIFERENTE_DA_FONTE", R), [(E + "entradas[0].valor.ref", "FON-PEDIDO-CALCULO-09")]),
    Defeito("CS12", "calculo_spec", "dado seu citando fonte que não é o pedido nem o pacote", ("CHK-CALCULO-02", "FONTE_DE_OUTRA_ORIGEM", R),
            [("c.fontes_importadas+", FONTE_TABELA), (E + "entradas[2].valor.ref", "FON-TABELA-01"),
             (E + "entradas[2].valor.citacao", {"trecho_original": FRASE_TABELA_V3, "fonte_importada_id": "FON-TABELA-01"})]),
    Defeito("CS13", "calculo_spec", "fonte que não veio no pacote", ("CHK-CALCULO-02", "FONTE_NAO_IMPORTADA", R),
            [(E + "entradas[0].valor.ref", "FON-PEDIDO-CALCULO-77"), (E + "entradas[0].valor.citacao.fonte_importada_id", "FON-PEDIDO-CALCULO-77")]),
    Defeito("CS14", "calculo_spec", "citação aponta leitura_id (o Caio não lê página)", ("CHK-CALCULO-02", "CITACAO_COM_LEITURA_ID", R),
            [(E + "entradas[0].valor.citacao.leitura_id", "LEI-001")]),
    Defeito("CS15", "calculo_spec", "premissa com ref", ("CHK-CALCULO-02", "PREMISSA_COM_REF", R), [(E + "entradas[3].valor.ref", PEDIDO)]),
    Defeito("CS16", "calculo_spec", "premissa com citação", ("CHK-CALCULO-02", "PREMISSA_COM_CITACAO", R),
            [(E + "entradas[3].valor.citacao", {"trecho_original": "Nem toda hora gravada é aprovada, e eu ainda não sei quanto é aprovado.", "fonte_importada_id": PEDIDO})]),
    Defeito("CS17", "calculo_spec", "fonte citada sem data", ("CHK-CALCULO-02", "FONTE_SEM_DATA", R),
            [*como_fonte_citada(2, FRASE_TABELA_V3), (E + "entradas[2].valor.data_da_fonte", DEL)]),
    Defeito("CS18", "calculo_spec", "data da fonte depois da criação do card", ("CHK-CALCULO-02", "DATA_NO_FUTURO", R), como_fonte_citada(2, FRASE_TABELA_V3, "2026-10-20")),
    Defeito("CS19", "calculo_spec", "data da fonte que não é data", ("CHK-CALCULO-02", "DATA_INVALIDA", R), como_fonte_citada(2, FRASE_TABELA_V3, "ontem")),
    Defeito("CS20", "calculo_spec", "fonte citada apontando para o pedido", ("CHK-CALCULO-02", "FONTE_DE_OUTRA_ORIGEM", R),
            [(E + "entradas[2].valor.origem", "FONTE_CITADA"), (E + "entradas[2].valor.data_da_fonte", "2026-10-09")]),
    Defeito("CS21", "calculo_spec", "trecho tirado de outro ponto do pedido, sem o valor", ("CHK-CALCULO-02", "VALOR_NAO_ESTA_NO_TRECHO", R),
            [(E + "entradas[0].valor.citacao.trecho_original", "Nem toda hora gravada é aprovada, e eu ainda não sei quanto é aprovado.")]),
    # ---- CHK-CALCULO-03: câmbio
    Defeito("CS22", "calculo_spec", "câmbio como premissa", ("CHK-CALCULO-03", "CAMBIO_SEM_ORIGEM_VALIDA", R),
            [(E + "entradas[4].valor.origem", "PREMISSA"), (E + "entradas[4].valor.ref", DEL), (E + "entradas[4].valor.citacao", DEL)]),
    Defeito("CS23", "calculo_spec", "câmbio de fonte citada sem data", ("CHK-CALCULO-03", "CAMBIO_SEM_DATA", R),
            [*como_fonte_citada(4, FRASE_TABELA_CAMBIO), (E + "entradas[4].valor.data_da_fonte", DEL)]),
    Defeito("CS24", "calculo_spec", "câmbio de entrega aprovada", ("CHK-CALCULO-03", "CAMBIO_SEM_ORIGEM_VALIDA", R), [(E + "entradas[4].valor.origem", "ENTREGA_APROVADA")]),
    Defeito("CS25", "calculo_spec", "câmbio escrito com barra e sem origem", ("CHK-CALCULO-03", "CAMBIO_SEM_ORIGEM_VALIDA", R),
            [(E + "entradas[4].valor.unidade", "R$/US$"), (E + "entradas[4].valor.origem", "")]),
    # ---- CHK-CALCULO-04: contas refeitas
    Defeito("CS26", "calculo_spec", "resultado que não bate", ("CHK-CALCULO-04", "RESULTADO_NAO_BATE", R), [(E + "contas[1].resultado.valor", 160)]),
    Defeito("CS27", "calculo_spec", "arredondamento errado (216,66 em vez de 216,67)", ("CHK-CALCULO-04", "RESULTADO_NAO_BATE", R), [(E + "contas[0].resultado.valor", 216.66)]),
    Defeito("CS28", "calculo_spec", "mês de 4 semanas", ("CHK-CALCULO-04", "CONSTANTE_NAO_ACEITA", R), [(E + "contas[0].expressao", "V1 × V2 × 4")]),
    Defeito("CS29", "calculo_spec", "constante com decimais", ("CHK-CALCULO-04", "TOKEN_NAO_ACEITO", R), [(E + "contas[1].expressao", "K1 × V4 ÷ 100,0")]),
    Defeito("CS30", "calculo_spec", "id que não existe", ("CHK-CALCULO-04", "ID_DESCONHECIDO", R), [(E + "contas[1].expressao", "K1 × V9 ÷ 100")]),
    Defeito("CS31", "calculo_spec", "conta usando conta posterior", ("CHK-CALCULO-04", "ID_DESCONHECIDO", R), [(E + "contas[0].expressao", "V1 × V2 × K4")]),
    Defeito("CS32", "calculo_spec", "operador de programação (* e /)", ("CHK-CALCULO-04", "TOKEN_NAO_ACEITO", R), [(E + "contas[1].expressao", "K1 * V4 / 100")]),
    Defeito("CS33", "calculo_spec", "divisão por zero", ("CHK-CALCULO-04", "DIVISAO_POR_ZERO", R), [(E + "contas[1].expressao", "K1 × V4 ÷ ( V4 - V4 )")]),
    Defeito("CS34", "calculo_spec", "função escrita na conta", ("CHK-CALCULO-04", "ID_DESCONHECIDO", R), [(E + "contas[1].expressao", "K1 × max(V4, 1) ÷ 100")]),
    Defeito("CS35", "calculo_spec", "parêntese sem fechar", ("CHK-CALCULO-04", "SINTAXE", R), [(E + "contas[1].expressao", "( K1 × V4 ÷ 100")]),
    Defeito("CS36", "calculo_spec", "ids das contas fora de ordem", ("CHK-CALCULO-04", "IDS_FORA_DE_ORDEM", R), [(E + "contas[1].id", "K5")]),
    Defeito("CS37", "calculo_spec", "id de conta repetido", ("CHK-CALCULO-04", "ID_REPETIDO", R), [(E + "contas[2].id", "K2")]),
    Defeito("CS38", "calculo_spec", "resultado da conta sem origem CALCULADO", ("CHK-CALCULO-04", "RESULTADO_SEM_ORIGEM_CALCULADO", R), [(E + "contas[0].resultado.origem", "PREMISSA")]),
    Defeito("CS39", "calculo_spec", "ref do resultado diferente do id", ("CHK-CALCULO-04", "REF_DIFERENTE_DO_ID", R), [(E + "contas[0].resultado.ref", "K9")]),
    Defeito("CS40", "calculo_spec", "conta sem resultado numérico", ("CHK-CALCULO-04", "SEM_RESULTADO", R), [(E + "contas[0].resultado.valor", "muito")]),
    Defeito("CS41", "calculo_spec", "conta sem expressão", ("CHK-CALCULO-04", "EXPRESSAO_VAZIA", R), [(E + "contas[0].expressao", "")]),
    # ---- CHK-CALCULO-05: moeda coerente
    Defeito("CS42", "calculo_spec", "soma de dólar com real", ("CHK-CALCULO-05", "SOMA_DE_MOEDAS_DIFERENTES", R),
            [(E + "contas+", conta("K5", "Soma de dólar e real", "K3 + K4", 485.33, "R$ por mês"))]),
    Defeito("CS43", "calculo_spec", "moeda vezes moeda", ("CHK-CALCULO-05", "MOEDA_VEZES_MOEDA", R),
            [(E + "contas+", conta("K5", "Dólar vezes real", "K3 × K4", 31054.5, "R$ por mês"))]),
    Defeito("CS44", "calculo_spec", "câmbio no sentido errado", ("CHK-CALCULO-05", "CAMBIO_NO_SENTIDO_ERRADO", R),
            [(E + "contas[3].expressao", "K3 ÷ V5"), (E + "contas[3].resultado.valor", 14.04)]),
    Defeito("CS45", "calculo_spec", "unidade da conta com a moeda errada", ("CHK-CALCULO-05", "MOEDA_DA_CONTA_DIFERENTE_DA_UNIDADE", R), [(E + "contas[3].resultado.unidade", "US$ por mês")]),
    Defeito("CS46", "calculo_spec", "número sem moeda dividido por moeda", ("CHK-CALCULO-05", "SEM_MOEDA_DIVIDIDO_POR_MOEDA", R),
            [(E + "contas+", conta("K5", "Aprovação por dólar", "V4 ÷ K3", 0.92, "% por dólar"))]),
    Defeito("CS47", "calculo_spec", "dólar somado a número sem moeda", ("CHK-CALCULO-05", "SOMA_DE_MOEDA_COM_OUTRA_COISA", R),
            [(E + "contas+", conta("K5", "Dólar mais aprovação", "K3 + V4", 145.83, "US$ por mês"))]),
    Defeito("CS48", "calculo_spec", "unidade com duas moedas fora do padrão", ("CHK-CALCULO-05", "UNIDADE_COM_MOEDAS_CONFUSAS", R), [(E + "entradas[2].valor.unidade", "US$ e R$ por hora aprovada")]),
    Defeito("CS49", "calculo_spec", "resultado em dólar de conta que sai sem moeda", ("CHK-CALCULO-05", "MOEDA_DA_CONTA_DIFERENTE_DA_UNIDADE", R), [(E + "contas[1].resultado.unidade", "US$ por mês")]),
    # ---- CHK-CALCULO-06: cenários
    Defeito("CS50", "calculo_spec", "cenário muda dado seu", ("CHK-CALCULO-06", "AJUSTE_FORA_DA_PREMISSA", R), [(E + "cenarios[0].ajustes", "V1 = 8")]),
    Defeito("CS51", "calculo_spec", "otimista abaixo da base", ("CHK-CALCULO-06", "ORDEM_DOS_CENARIOS", R),
            [(E + "cenarios[2].ajustes", "V4 = 60"), (E + "cenarios[2].resultado.valor", 65), (E + "cenarios[5].ajustes", "V4 = 60"), (E + "cenarios[5].resultado.valor", 351)]),
    Defeito("CS52", "calculo_spec", "falta a linha do otimista", ("CHK-CALCULO-06", "CENARIO_FALTANDO", R), [(E + "cenarios[5]", DEL)]),
    Defeito("CS53", "calculo_spec", "duas linhas BASE para a mesma conta", ("CHK-CALCULO-06", "CENARIO_REPETIDO", R), [(E + "cenarios+", {
        "cenario": "BASE", "conta": "K3", "ajustes": "—", "resultado": {"valor": 75.83, "unidade": "US$ por mês", "origem": "CALCULADO", "ref": "K3/BASE"}})]),
    Defeito("CS54", "calculo_spec", "BASE com ajuste", ("CHK-CALCULO-06", "AJUSTE_NO_BASE", R), [(E + "cenarios[1].ajustes", "V4 = 70")]),
    Defeito("CS55", "calculo_spec", "BASE diferente do resultado da conta", ("CHK-CALCULO-06", "BASE_DIFERENTE_DA_CONTA", R), [(E + "cenarios[1].resultado.valor", 70)]),
    Defeito("CS56", "calculo_spec", "resultado do cenário que o código não refaz igual", ("CHK-CALCULO-06", "RESULTADO_DO_CENARIO_NAO_BATE", R), [(E + "cenarios[0].resultado.valor", 50)]),
    Defeito("CS57", "calculo_spec", "ajuste igual ao valor da tabela de entradas", ("CHK-CALCULO-06", "AJUSTE_IGUAL_AO_VALOR", R), [(E + "cenarios[2].ajustes", "V4 = 70")]),
    Defeito("CS58", "calculo_spec", "ajustes diferentes entre as contas do mesmo cenário", ("CHK-CALCULO-06", "AJUSTES_DIFERENTES_ENTRE_CONTAS", R), [(E + "cenarios[3].ajustes", "V4 = 40")]),
    Defeito("CS59", "calculo_spec", "ajuste mal escrito", ("CHK-CALCULO-06", "AJUSTE_MAL_ESCRITO", R), [(E + "cenarios[0].ajustes", "V4 igual a 50")]),
    Defeito("CS60", "calculo_spec", "ajuste de entrada que não existe", ("CHK-CALCULO-06", "AJUSTE_FORA_DA_PREMISSA", R), [(E + "cenarios[0].ajustes", "V9 = 50")]),
    Defeito("CS61", "calculo_spec", "conservador e otimista sem ajuste", ("CHK-CALCULO-06", "NENHUM_AJUSTE", R),
            [(E + f"cenarios[{i}].ajustes", "—") for i in (0, 2, 3, 5)] + [(E + "cenarios[0].resultado.valor", 75.83), (E + "cenarios[2].resultado.valor", 75.83),
                                                                          (E + "cenarios[3].resultado.valor", 409.5), (E + "cenarios[5].resultado.valor", 409.5)]),
    Defeito("CS62", "calculo_spec", "conservador igual ao otimista (premissa que não pesa)", ("CHK-CALCULO-06", "CONSERVADOR_IGUAL_AO_OTIMISTA", R),
            [(E + "entradas+", PREMISSA_V6), (E + "premissas_a_confirmar+", V6_NAS_PREMISSAS)]
            + [(E + f"cenarios[{i}].ajustes", "V6 = 1") for i in (0, 3)] + [(E + f"cenarios[{i}].ajustes", "V6 = 2") for i in (2, 5)]
            + [(E + "cenarios[0].resultado.valor", 75.83), (E + "cenarios[2].resultado.valor", 75.83), (E + "cenarios[3].resultado.valor", 409.5), (E + "cenarios[5].resultado.valor", 409.5)]),
    Defeito("CS63", "calculo_spec", "sentido trocado (menor é melhor para uma receita)", ("CHK-CALCULO-06", "ORDEM_DOS_CENARIOS", R), [(E + "resultado_principal[0].sentido", "MENOR_E_MELHOR")]),
    Defeito("CS64", "calculo_spec", "sentido que não existe", ("CHK-CALCULO-06", "SENTIDO_INVALIDO", R), [(E + "resultado_principal[0].sentido", "TANTO_FAZ")]),
    Defeito("CS65", "calculo_spec", "resultado principal de conta que não existe", ("CHK-CALCULO-06", "PRINCIPAL_CONTA_DESCONHECIDA", R), [(E + "resultado_principal[1].conta", "K9")]),
    Defeito("CS66", "calculo_spec", "cenário de conta fora do resultado principal", ("CHK-CALCULO-06", "CONTA_FORA_DO_PRINCIPAL", R), [(E + "cenarios[3].conta", "K2")]),
    Defeito("CS67", "calculo_spec", "nome de cenário inventado", ("CHK-CALCULO-06", "CENARIO_INVALIDO", R), [(E + "cenarios[2].cenario", "SONHO")]),
    Defeito("CS68", "calculo_spec", "ref do cenário errada", ("CHK-CALCULO-06", "REF_DO_CENARIO", R), [(E + "cenarios[0].resultado.ref", "K3/BASE")]),
    Defeito("CS69", "calculo_spec", "mesma conta duas vezes no resultado principal", ("CHK-CALCULO-06", "PRINCIPAL_CONTA_REPETIDA", R), [(E + "resultado_principal[1].conta", "K3")]),
    # ---- CHK-CALCULO-07: premissas à vista
    Defeito("CS70", "calculo_spec", "premissa sem linha em premissas a confirmar", ("CHK-CALCULO-07", "PREMISSA_SEM_LINHA", R), [(E + "premissas_a_confirmar[0]", DEL)]),
    Defeito("CS71", "calculo_spec", "linha que aponta para dado seu", ("CHK-CALCULO-07", "LINHA_SEM_PREMISSA", R), [(E + "premissas_a_confirmar[0].entrada", "V3")]),
    Defeito("CS72", "calculo_spec", "duas linhas para a mesma premissa", ("CHK-CALCULO-07", "PREMISSA_COM_DUAS_LINHAS", R), [(E + "premissas_a_confirmar+", {
        "entrada": "V4", "por_que_este_valor": "Suposição minha, repetida.", "como_confirmar": "Olhar o painel da plataforma."})]),
    Defeito("CS73", "calculo_spec", "linha que aponta para entrada que não existe", ("CHK-CALCULO-07", "LINHA_SEM_PREMISSA", R), [(E + "premissas_a_confirmar+", {
        "entrada": "V9", "por_que_este_valor": "Suposição minha.", "como_confirmar": "Olhar o painel da plataforma."})]),
    # ---- CHK-CALCULO-08: previsão separada do realizado
    Defeito("CS74", "calculo_spec", "conta com premissa marcada REALIZADO", ("CHK-CALCULO-08", "REALIZADO_COM_PREMISSA", R), [(E + "contas[2].natureza", "REALIZADO")]),
    Defeito("CS75", "calculo_spec", "REALIZADO que usa premissa só por uma conta anterior", ("CHK-CALCULO-08", "REALIZADO_COM_PREMISSA", R), [(E + "contas[3].natureza", "REALIZADO")]),
    Defeito("CS76", "calculo_spec", "natureza que não existe", ("CHK-CALCULO-08", "NATUREZA_INVALIDA", R), [(E + "contas[0].natureza", "PROVAVEL")]),
    Defeito("CS77", "calculo_spec", "conta sem natureza", ("CHK-CALCULO-08", "NATUREZA_INVALIDA", R), [(E + "contas[0].natureza", DEL)]),
    # ---- CHK-CALCULO-09: nenhum número solto
    Defeito("CS78", "calculo_spec", "valor solto na leitura", ("CHK-CALCULO-09", "NUMERO_SOLTO", R), [(LEITURA, "Pela estimativa, a Humano Digital receberia cerca de US$ 900 por ano.")]),
    Defeito("CS79", "calculo_spec", "número solto nos riscos", ("CHK-CALCULO-09", "NUMERO_SOLTO", R), [(E + "riscos[0]", "Se a plataforma aprovar menos de 37% das horas, o valor cai. O sinal é a parte aprovada.")]),
    Defeito("CS80", "calculo_spec", "número solto em como confirmar", ("CHK-CALCULO-09", "NUMERO_SOLTO", R), [(E + "premissas_a_confirmar[0].como_confirmar", "Olhar o painel da plataforma depois de 45 dias.")]),
    Defeito("CS81", "calculo_spec", "número solto na pergunta", ("CHK-CALCULO-09", "NUMERO_SOLTO", R),
            [(E + "pergunta", "Quanto a Humano Digital recebe da plataforma por mês com 10 pessoas gravando 8 horas por semana?")]),
    Defeito("CS82", "calculo_spec", "número solto no o_que de uma entrada", ("CHK-CALCULO-09", "NUMERO_SOLTO", R), [(E + "entradas[0].o_que", "Pessoas gravando, entre as 25 indicadas")]),
    Defeito("CS83", "calculo_spec", "dinheiro por extenso que não existe", ("CHK-CALCULO-09", "NUMERO_SOLTO_POR_EXTENSO", R), [(LEITURA, "É uma estimativa: a empresa pode receber novecentos dólares por ano.")]),
    Defeito("CS84", "calculo_spec", "porcentagem por extenso que não existe", ("CHK-CALCULO-09", "NUMERO_SOLTO_POR_EXTENSO", R), [(LEITURA, "É uma estimativa: a plataforma aprova só trinta e cinco por cento das horas.")]),
    Defeito("CS85", "calculo_spec", "número com 'mil' que não existe", ("CHK-CALCULO-09", "NUMERO_SOLTO", R), [(LEITURA, "É uma estimativa: a empresa pode receber 2 mil dólares no ano.")]),
    Defeito("CS86", "calculo_spec", "número escrito de um jeito que não dá para ler", ("CHK-CALCULO-09", "NUMERO_ILEGIVEL", R), [(LEITURA, "É uma estimativa: a empresa pode receber US$ 1.2.3 no ano.")]),
    Defeito("CS87", "calculo_spec", "número que só bate se lido como milhar errado", ("CHK-CALCULO-09", "NUMERO_SOLTO", R), [(LEITURA, "É uma estimativa: a empresa recebe US$ 54.170 no mês.")]),
    # ---- CHK-CALCULO-10: sem certeza
    Defeito("CS88", "calculo_spec", "'garantido' (com maiúscula)", ("CHK-CALCULO-10", "CERTEZA_SOBRE_PREVISAO", R), [(LEITURA, "O cenário base está GARANTIDO pela plataforma.")]),
    Defeito("CS89", "calculo_spec", "'com certeza' dito nos riscos", ("CHK-CALCULO-10", "CERTEZA_SOBRE_PREVISAO", R), [(E + "riscos[0]", "A empresa vai receber o valor do cenário base com certeza.")]),
    Defeito("CS90", "calculo_spec", "'sem risco' negado ainda conta", ("CHK-CALCULO-10", "CERTEZA_SOBRE_PREVISAO", R), [(E + "limites[0]", "Não dá para dizer que isto é sem risco, mas o imposto fica com o contador.")]),
    Defeito("CS91", "calculo_spec", "'sem dúvida' sem o acento", ("CHK-CALCULO-10", "CERTEZA_SOBRE_PREVISAO", R), [(LEITURA, "A empresa vai receber, sem duvida, o valor do cenário base.")]),
    Defeito("CS92", "calculo_spec", "'já está no caixa'", ("CHK-CALCULO-10", "CERTEZA_SOBRE_PREVISAO", R), [(LEITURA, "O valor do cenário base já está no caixa da empresa.")]),
    Defeito("CS93", "calculo_spec", "'lucro certo' no o_que de uma conta", ("CHK-CALCULO-10", "CERTEZA_SOBRE_PREVISAO", R), [(E + "contas[2].o_que", "Lucro certo da empresa por mês, em dólar")]),
    # ---- CHK-CALCULO-11: termos do pacote
    Defeito("CS94", "calculo_spec", "termo do pacote com maiúscula e sem acento", ("CHK-CALCULO-11", "TERMO_PROIBIDO_PELO_PACOTE", R), [(LEITURA, "É uma estimativa, e não é DINHEIRO FACIL: depende da aprovação das horas.")]),
    Defeito("CS95", "calculo_spec", "termo do pacote nos limites", ("CHK-CALCULO-11", "TERMO_PROIBIDO_PELO_PACOTE", R), [(E + "limites[1]", "Isto não é renda garantida; a conta mostra o valor estimado por mês de gravação, não o caixa.")]),
    Defeito("CS96", "calculo_spec", "outro termo do pacote nas entradas", ("CHK-CALCULO-11", "TERMO_PROIBIDO_PELO_PACOTE", R), [(E + "entradas[0].o_que", "Pessoas gravando, para ganho garantido")]),
    # ---- CHK-CALCULO-12: conta fiscal
    Defeito("CS97", "calculo_spec", "imposto na descrição de uma entrada", ("CHK-CALCULO-12", "ASSUNTO_FISCAL", R), [(E + "entradas[1].o_que", "Horas gravadas por pessoa por semana, menos o Imposto")]),
    Defeito("CS98", "calculo_spec", "sigla DAS na descrição de uma conta", ("CHK-CALCULO-12", "ASSUNTO_FISCAL", R), [(E + "contas[2].o_que", "Valor que a empresa recebe por mês, em dólar, antes do DAS")]),
    Defeito("CS99", "calculo_spec", "nota fiscal na pergunta", ("CHK-CALCULO-12", "ASSUNTO_FISCAL", R),
            [(E + "pergunta", "Quanto a Humano Digital recebe da plataforma por mês, em dólar, depois de emitir a nota fiscal?")]),
    Defeito("CS100", "calculo_spec", "tributação sem acento", ("CHK-CALCULO-12", "ASSUNTO_FISCAL", R), [(E + "contas[3].o_que", "Valor por mês, em reais, com tributacao incluída")]),
    Defeito("CS101", "calculo_spec", "Simples Nacional escrito de outro jeito", ("CHK-CALCULO-12", "ASSUNTO_FISCAL", R), [(E + "contas[3].o_que", "Valor por mês, em reais, no SIMPLES NACIONAL")]),
]

HONESTAS = [
    Honesta("CH01", "calculo_spec", "cálculo honesto da especificação (boa-01)"),
    Honesta("CH02", "calculo_spec_dolar", "cálculo honesto só em dólar (boa-02)"),
    Honesta("CH03", "calculo_spec", "arredondamento escolhido: K1 com uma casa só", [(E + "contas[0].resultado.valor", 216.7)]),
    Honesta("CH04", "calculo_spec", "valor do pedido vindo de fonte citada com data (tabela do pacote)", como_fonte_citada(2, FRASE_TABELA_V3)),
    Honesta("CH05", "calculo_spec", "câmbio de fonte citada com data", como_fonte_citada(4, FRASE_TABELA_CAMBIO)),
    Honesta("CH06", "calculo_spec", "conta em dólar refeita a partir do real (real dividido pelo câmbio)",
            [(E + "contas+", conta("K5", "Valor por mês, refeito em dólar", "K4 ÷ V5", 75.83, "US$ por mês"))]),
    Honesta("CH07", "calculo_spec", "conta REALIZADO sem nenhuma premissa na cadeia", [(E + "contas[0].natureza", "REALIZADO")]),
    Honesta("CH08", "calculo_spec", "porcentagem por extenso igual a um valor da tabela", [(LEITURA, "É uma estimativa: no cenário base a plataforma aprova setenta por cento das horas.")]),
    Honesta("CH09", "calculo_spec", "'das' minúsculo e 'pis' como parte de outra palavra não são conta fiscal",
            [(E + "entradas[0].o_que", "Pessoas gravando das indicadas pela Humano Digital, sem pisar na bola")]),
    Honesta("CH10", "calculo_spec", "o pacote não traz lista de termos proibidos (passa)", [("c.pacote_da_empresa.termos_proibidos_em_todo_texto", DEL)]),
    Honesta("CH11", "calculo_spec", "número do pedido, data, hora e ids no texto livre",
            [(E + "riscos+", "Se os números do card CARD-3 mudarem até 15:30 de 12/10/2026, refaça K1 e K2 com V1 e V2; o pedido fala em 10 pessoas e 5 horas.")]),
    Honesta("CH12", "calculo_spec", "constantes do modelo (30, 52, 12) escritas no texto",
            [(E + "limites+", "O mês tem 30 dias, ou 52 ÷ 12 semanas.")]),
]
