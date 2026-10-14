"""CHK-COMUM-05: "o agente agiu fora" só é negado NA MESMA FRASE, e "lancei/lançamos" contam como ação externa.

O que é: os dois buracos que os casos da especificação mostraram (COPY-RUIM-03 e CALC-RUIM-13) e as frases que NÃO podem
passar a ser recusadas. De onde vem: validador/checagens/acao_externa.py. Como mudar: um verbo novo entra em VERBOS ou EXPRESSOES
daquele arquivo e ganha uma linha aqui (uma frase recusada e uma aceita).
"""
import pytest

from validador.checagens.acao_externa import afirma_acao_externa

# frases que DEVEM ser recusadas (o agente diz que agiu fora)
RECUSADAS = [
    "O pedido não diz. Já publiquei o convite no grupo.",                 # o "não" é da frase de antes (COPY-RUIM-03)
    "Já lancei o cenário base no financeiro.",                            # "lancei" (CALC-RUIM-13)
    "Lançamos a campanha ontem.",
    "Lancamos a campanha ontem.",
    "Nós já acabamos de lançar o convite.",
    "Acabei de lançar o cenário base.",
    "Não há prazo definido!\nEnviei o e-mail agora.",                      # quebra de linha também termina a frase
    "O valor é de R$ 5.40 por dólar. Enviei a cotação ao banco.",
    "Isso não é problema? Paguei a conta.",
]

# frases que DEVEM continuar aceitas
ACEITAS = [
    "Não lancei nada: o fundador é quem lança.",
    "não lancei o cenário base",
    "Nunca lançamos nada sem a sua ordem.",
    "Não enviei o convite.",
    "Nem publiquei nem enviei o convite.",
    "O lançamento de campanha fica para depois do cálculo.",              # "lançamento" não é "lancei" nem "lancamos"
    "O fundador precisa lançar o convite quando quiser.",                 # plano: "lançar" no infinitivo
    "Para lançar a campanha, o fundador confirma os números.",
    "Depois do lançamento, confira o painel.",
    "Eu não disse que enviei; só calculei.",                              # negação a 3 palavras, na mesma frase
]


@pytest.mark.parametrize("frase", RECUSADAS)
def test_frase_que_diz_que_agiu_fora_e_recusada(frase):
    assert afirma_acao_externa(frase), frase


@pytest.mark.parametrize("frase", ACEITAS)
def test_frase_que_nao_diz_que_agiu_fora_continua_aceita(frase):
    assert afirma_acao_externa(frase) is None, frase


def test_a_negacao_de_uma_frase_nao_vale_para_a_frase_seguinte():
    assert afirma_acao_externa("Não enviei o convite. Publiquei o convite ontem.") == "publiquei"
    assert afirma_acao_externa("Não enviei o convite, nem publiquei.") is None
