"""Os consertos das checagens comuns que tiraram as divergências de respostas BOAS da especificação.

O que é: testes pequenos, com tabelas de mentira, para (1) coluna opcional, (2) conferência de palavras em comum só onde a
linha traz afirmação e (3) o detector de idioma diante de dinheiro. Os casos reais da especificação são provados em
test_casos_da_spec.py (DIVERGENCIAS_EM_CASOS_BONS está vazio); aqui o que se prova é que a detecção NÃO ficou mais fraca.
Como mudar: ao mudar a regra, mude o teste correspondente; nada aqui copia números da especificação.
"""
import json

from validador import validar

from . import fabrica as F


def _modelo(colunas, extra=None):
    secao = {"id": "linhas", "titulo": "Linhas", "tipo_de_campo": "tabela", "obrigatoria": True, "colunas": colunas}
    secao.update(extra or {})
    return {"tipo": "teste", "servico": "SRV-TESTE", "limite": 7000, "secoes": [secao],
            "acoes_permitidas": ["ENTREGAR", "REGISTRAR_FALHA"], "acao_externa_permitida": ["NENHUMA"]}


def _resposta(linhas):
    return json.dumps({"acao": "ENTREGAR", "parecer": "OK", "acao_externa": {"tipo": "NENHUMA"}, "entrega": {"linhas": linhas}}, ensure_ascii=False)


def _motivos(resposta, modelo, id_="CHK-COMUM-01"):
    rel = validar(resposta, F.contexto_base(modelo))
    return sorted(f.motivo for f in rel.falhas if f.id == id_)


# ---------------------------------------------------------------------------------------
# 1) Coluna opcional
# ---------------------------------------------------------------------------------------
COLUNAS = [{"id": "nome", "tipo_de_campo": "texto"},
           {"id": "apoio", "tipo_de_campo": "citacao", "obrigatoria": False}]


def test_coluna_opcional_pode_faltar_na_linha():
    assert _motivos(_resposta([{"nome": "primeiro passo"}]), _modelo(COLUNAS)) == []


def test_coluna_sem_o_campo_continua_obrigatoria():
    colunas = [{"id": "nome", "tipo_de_campo": "texto"}, {"id": "apoio", "tipo_de_campo": "citacao"}]
    assert _motivos(_resposta([{"nome": "primeiro passo"}]), _modelo(colunas)) == ["COLUNA_FALTANDO"]


def test_coluna_obrigatoria_true_explicita_tambem_e_exigida():
    colunas = [{"id": "nome", "tipo_de_campo": "texto", "obrigatoria": True}]
    assert _motivos(_resposta([{}]), _modelo(colunas)) == ["COLUNA_FALTANDO"]


def test_coluna_opcional_que_vem_tem_de_ter_o_formato_certo():
    linha = {"nome": "primeiro passo", "apoio": "texto solto em vez de citação"}
    assert _motivos(_resposta([linha]), _modelo(COLUNAS)) == ["FORMATO_DA_CELULA"]


def test_coluna_opcional_nao_deixa_passar_coluna_inventada():
    assert _motivos(_resposta([{"nome": "x", "invento": "y"}]), _modelo(COLUNAS)) == ["COLUNA_DESCONHECIDA"]


# ---------------------------------------------------------------------------------------
# 2) Palavras em comum só onde a linha traz afirmação
# ---------------------------------------------------------------------------------------
def _linha(afirmacao, trecho, parte=1):
    return {"id": "L1", "afirmacao": afirmacao, "prova": F.cit(trecho, parte=parte)}


COL_AFIRMACAO = [{"id": "id", "tipo_de_campo": "texto"},
                 {"id": "afirmacao", "tipo_de_campo": "texto", "apoiada_por_citacao": True},
                 {"id": "prova", "tipo_de_campo": "citacao"}]
COL_INDICE = [{"id": "id", "tipo_de_campo": "texto"},
              {"id": "afirmacao", "tipo_de_campo": "texto"},
              {"id": "prova", "tipo_de_campo": "citacao"}]
AFIRMA_IDADE = "O participante precisa ter pelo menos 18 anos de idade para enviar vídeos."
AFIRMA_PAGAMENTO = "Os pagamentos saem em dólares por transferência internacional, com tarifas do banco."


def test_linha_com_afirmacao_continua_exigindo_palavra_em_comum():
    resposta = _resposta([_linha(AFIRMA_IDADE, F.F_ENCERRAR, parte=2)])
    assert _motivos(resposta, _modelo(COL_AFIRMACAO), "CHK-COMUM-06") == ["OUTRA_CLAUSULA"]


def test_linha_com_afirmacao_e_citacao_certa_passa():
    resposta = _resposta([_linha(AFIRMA_IDADE, F.F_IDADE)])
    assert _motivos(resposta, _modelo(COL_AFIRMACAO), "CHK-COMUM-06") == []


def test_tabela_sem_coluna_de_afirmacao_e_so_indice_ou_exemplo():
    resposta = _resposta([_linha(AFIRMA_IDADE, F.F_ENCERRAR, parte=2)])
    assert _motivos(resposta, _modelo(COL_INDICE), "CHK-COMUM-06") == []


def test_tabela_de_indice_continua_com_a_conferencia_do_numero_da_clausula():
    # a conferência de cláusula e a de site não dependem da coluna marcada
    resposta = _resposta([_linha("Conforme a cláusula 3, vale a regra de idade.", F.F_IDADE)])
    assert _motivos(resposta, _modelo(COL_INDICE), "CHK-COMUM-06") == ["OUTRA_CLAUSULA"]


def test_tabela_de_indice_continua_exigindo_trecho_que_existe_na_pagina():
    resposta = _resposta([_linha(AFIRMA_IDADE, "Trecho que ninguém escreveu em nenhuma página lida nesta execução, inventado do zero.")])
    assert _motivos(resposta, _modelo(COL_INDICE), "CHK-COMUM-06") == ["CITACAO_NAO_ENCONTRADA"]


def test_so_a_coluna_marcada_conta_como_afirmacao():
    # a coluna 'id' tem uma palavra do trecho, mas só 'afirmacao' é a afirmação
    linha = {"id": "participante", "afirmacao": AFIRMA_PAGAMENTO, "prova": F.cit(F.F_IDADE)}
    assert _motivos(_resposta([linha]), _modelo(COL_AFIRMACAO), "CHK-COMUM-06") == ["OUTRA_CLAUSULA"]

