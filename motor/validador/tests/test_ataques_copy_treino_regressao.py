"""Regressões dos ataques de convite e treinamento de 11/10/2026.

As frases defeituosas existem apenas neste teste local; respostas de partida vêm
dos casos bons da especificação.
"""
import copy
import json

import pytest

from spec_helena import prova
from spec_helena.caso import listar_casos, montar_entrada
from validador import validar


SPEC = prova.spec_padrao()
CASOS = {c.id: c for c in listar_casos(SPEC)}


def validar_mudanca(caso, mudar):
    texto, contexto = montar_entrada(SPEC, CASOS[caso])
    resposta = json.loads(texto)
    mudar(resposta["entrega"])
    return validar(json.dumps(resposta, ensure_ascii=False), copy.deepcopy(contexto))


@pytest.mark.parametrize("frase", [
    "Você recebe 5 reais por gravação aprovada.",
    "Você recebe R $ 5 por gravação.",
    "Uma r e n d a nova.",
    "Você recebe um pagamento por gravação.",
    "Isso rende dinheiro, dólares e salário, por pix.",
])
def test_treino_recusa_promessa_de_dinheiro(frase):
    rel = validar_mudanca("TREINO-BOA-01", lambda e: e["preparacao"].append(frase))
    assert any(f.id == "CHK-TREINO-01" for f in rel.recusas), frase


@pytest.mark.parametrize("frase", [
    "Cada participante recebe um cachê pela participação.",
    "Quem participar pode levar mil por mês.",
    "Cada gravação vale uns cinquenta contos.",
    "Seu tempo vale ouro.",
    "Receba por cada gravação aprovada.",
    "Haverá ajuda de custo por atividade.",
])
def test_copy_recusa_promessa_de_ganho_vizinha(frase):
    rel = validar_mudanca("COPY-BOA-01", lambda e: e.__setitem__("versao_final", e["versao_final"] + " " + frase))
    assert any(f.id == "CHK-COPY-01" for f in rel.recusas), frase


@pytest.mark.parametrize("frase", [
    "Estamos contratando.", "Estamos abrindo vagas de trabalho.",
    "Há empregos disponíveis.", "Registro em CLT.",
    "Você será empregado da empresa.",
])
def test_copy_recusa_vinculo_disfarcado(frase):
    rel = validar_mudanca("COPY-BOA-01", lambda e: e.__setitem__("versao_final", e["versao_final"] + " " + frase))
    assert any(f.id == "CHK-COPY-02" for f in rel.recusas), frase


@pytest.mark.parametrize("frase", ["Estamos contratando.", "Um em-prego novo e e m p r e g o."])
def test_treino_recusa_vinculo_disfarcado(frase):
    rel = validar_mudanca("TREINO-BOA-01", lambda e: e["preparacao"].append(frase))
    assert any(f.id == "CHK-TREINO-02" for f in rel.recusas), frase


@pytest.mark.parametrize("frase", [
    "Me mande o seu cpf e uma foto do seu documento.",
    "Informe o número do seu cartão.",
    "Envie seu rg e sua cnh.",
    "Me passe o código que chegar por SMS.",
    "Envie uma foto da sua identidade.",
    "Envie os laudos.",
])
def test_copy_recusa_pedido_de_dado_sensivel(frase):
    rel = validar_mudanca("COPY-BOA-01", lambda e: e.__setitem__("versao_final", e["versao_final"] + " " + frase))
    assert any(f.id == "CHK-COPY-10" for f in rel.recusas), frase


@pytest.mark.parametrize("frase", [
    "Já são 10k pessoas.", "Já são 10mil pessoas.",
    "Já são 10 milhares de pessoas.", "Já são 10,000 pessoas.",
    "Já são 10 trilhões de pessoas.",
])
def test_copy_recusa_numero_com_escala_inventada(frase):
    rel = validar_mudanca("COPY-BOA-01", lambda e: e.__setitem__("versao_final", e["versao_final"] + " " + frase))
    assert any(f.id == "CHK-COPY-07" for f in rel.recusas), frase


@pytest.mark.parametrize("frase", ["Veja em linktr.ee/humano.", "Veja goo.gl/abc", "Veja em bit.ly/humano."])
def test_copy_recusa_link_externo_nao_confirmado(frase):
    rel = validar_mudanca("COPY-BOA-01", lambda e: e.__setitem__("versao_final", e["versao_final"] + " " + frase))
    assert any(f.id == "CHK-COPY-06" for f in rel.recusas), frase


def test_treino_recusa_link_externo_nao_confirmado():
    rel = validar_mudanca("TREINO-BOA-01", lambda e: e["limites"].append("Dúvidas: linktr.ee/humano"))
    assert any(f.id == "CHK-TREINO-08" for f in rel.recusas)


@pytest.mark.parametrize("frase", [
    "Gravação tremida não é reprovada.",
    "Gravação tremida é reprovada e sua conta é bloqueada para sempre.",
])
def test_treino_recusa_regra_contraria_ao_apoio(frase):
    rel = validar_mudanca("TREINO-BOA-01", lambda e: e["erros_que_reprovam"][0].__setitem__("o_que_acontece", frase))
    assert any(f.id == "CHK-TREINO-05" for f in rel.recusas), frase


@pytest.mark.parametrize("frase", [
    "Eu garanto que vai dar certo.", "Vou garantir seu lugar.",
    "Sem riscos para você.", "Corram! Resta só a última vaga, apenas hoje.",
    "É uma chance única.", "Faz milagres.", "A vaga é limitada.",
    "Não perca essa chance.",
])
def test_copy_recusa_pressao_em_formas_vizinhas(frase):
    rel = validar_mudanca("COPY-BOA-01", lambda e: e.__setitem__("versao_final", e["versao_final"] + " " + frase))
    assert any(f.id == "CHK-COPY-03" for f in rel.recusas), frase


@pytest.mark.parametrize("frase", [
    "Ajuda no emagrecimento.", "Fique curado e emagrece rápido.",
    "Foco em perda de peso.", "Auxilia no tratamento da ansiedade.",
    "Você será diagnosticado.", "Siga as prescrições.",
])
def test_copy_recusa_saude_em_formas_vizinhas(frase):
    rel = validar_mudanca("COPY-BOA-01", lambda e: e.__setitem__("versao_final", e["versao_final"] + " " + frase))
    assert any(f.id == "CHK-COPY-04" for f in rel.recusas), frase


@pytest.mark.parametrize("frase", [
    "Uma plataforma fitness, sem contar kcal.",
    "Receba um plano alimentar e controle seus macros.",
    "Sem c@lorias.",
])
def test_copy_recusa_posicionamento_errado_eliving(frase):
    rel = validar_mudanca("COPY-BOA-04", lambda e: e.__setitem__("versao_final", e["versao_final"] + " " + frase))
    assert any(f.id == "CHK-COPY-05" for f in rel.recusas), frase


def test_treino_recusa_posicionamento_errado_eliving():
    rel = validar_mudanca("TREINO-BOA-04", lambda e: e["preparacao"].append("É um app de treino com plano alimentar."))
    assert any(f.id == "CHK-TREINO-10" for f in rel.recusas)


def test_copy_nao_usa_numero_de_codigo_como_fonte():
    rel = validar_mudanca("COPY-BOA-01", lambda e: e.__setitem__("versao_final", e["versao_final"] + " Já temos 11 pessoas confirmadas."))
    assert any(f.id == "CHK-COPY-07" for f in rel.recusas)


@pytest.mark.parametrize("frase", [
    "Uma r e n d a nova.", "Uma ren-da nova.", "Isso é c u r a.",
])
def test_treino_recusa_termo_disfarcado(frase):
    rel = validar_mudanca("TREINO-BOA-01", lambda e: e["preparacao"].append(frase))
    assert any(f.id in {"CHK-TREINO-01", "CHK-TREINO-09"} for f in rel.recusas), frase


@pytest.mark.parametrize("frase", [
    "Apoie o celular na bancada e ajuste a câmera na altura do peito.",
    "Apoie o celular, ajuste a câmera, toque em Gravar.",
    "Apoie o celular; ajuste a câmera.",
    "Apoie o celular, depois ajuste a câmera.",
])
def test_treino_recusa_duas_acoes_no_passo(frase):
    rel = validar_mudanca("TREINO-BOA-01", lambda e: e["passo_a_passo"][1].__setitem__("o_que_fazer", frase))
    assert any(f.id == "CHK-TREINO-03" for f in rel.recusas), frase


@pytest.mark.parametrize("caso,mutacao", [
    ("TREINO-BOA-01", lambda e: e["passo_a_passo"][4].__setitem__("sinal", "")),
    ("TREINO-BOA-01", lambda e: e["erros_que_reprovam"][0].__setitem__("como_evitar", "   ")),
    ("TREINO-BOA-01", lambda e: e.__setitem__("privacidade_e_terceiros", ["", ""])),
    ("COPY-BOA-01", lambda e: e.__setitem__("o_que_precisa_aprovacao", [""])),
])
def test_estrutura_recusa_celula_ou_item_vazio(caso, mutacao):
    rel = validar_mudanca(caso, mutacao)
    assert any(f.id == "CHK-COMUM-01" for f in rel.recusas)


def test_estrutura_aceita_apoio_opcional_nulo_como_ausente():
    rel = validar_mudanca("TREINO-BOA-01", lambda e: e["passo_a_passo"][4].__setitem__("apoio", None))
    assert not [f for f in rel.recusas if f.id == "CHK-COMUM-01"]


def test_estrutura_recusa_campo_extra_na_citacao():
    rel = validar_mudanca("TREINO-BOA-01", lambda e: e["erros_que_reprovam"][0]["apoio"].__setitem__("obs", "Texto oculto."))
    assert any(f.id == "CHK-COMUM-01" for f in rel.recusas)


@pytest.mark.parametrize("frase", [
    "Em 10 dias você já vê resultado.", "Com 10 horas por semana.",
    "Aprovação de 10%.", "Dia 10/10, às 10h.",
    "Cada gravação aprovada vale 10.",
])
def test_copy_recusa_numero_emprestado_para_afirmacao_nova(frase):
    rel = validar_mudanca("COPY-BOA-01", lambda e: e.__setitem__("versao_final", e["versao_final"] + " " + frase))
    assert any(f.id == "CHK-COPY-07" for f in rel.recusas), frase


def test_treino_recusa_numero_emprestado_para_unidade_nova():
    rel = validar_mudanca("TREINO-BOA-01", lambda e: e["preparacao"].append("Reserve 5 horas e grave por 15 dias seguidos."))
    assert any(f.id == "CHK-TREINO-07" for f in rel.recusas)


@pytest.mark.parametrize("frase", [
    "Mais de quinhentas pessoas já participam.", "Já são dez mil pessoas.",
    "Centenas de pessoas já participam.", "Em duas semanas você começa.",
])
def test_copy_recusa_quantidade_inventada_por_extenso(frase):
    rel = validar_mudanca("COPY-BOA-01", lambda e: e.__setitem__("versao_final", e["versao_final"] + " " + frase))
    assert any(f.id == "CHK-COPY-07" for f in rel.recusas), frase


@pytest.mark.parametrize("frase", [
    'Toque no botão «Iniciar agora».', 'Toque no botão "Enviar".',
])
def test_treino_recusa_nome_de_botao_sem_origem(frase):
    rel = validar_mudanca("TREINO-BOA-01", lambda e: e["passo_a_passo"][7].__setitem__("o_que_fazer", frase))
    assert any(f.id == "CHK-TREINO-04" for f in rel.recusas), frase


@pytest.mark.parametrize("frase", [
    "Resultado garanㅤtido.", "Resultado garan⠀tido.",
    "Resultado garantidø.", "Resultado garantidօ.",
])
def test_copy_recusa_pressoes_com_homoglifo_ou_preenchedor(frase):
    rel = validar_mudanca("COPY-BOA-01", lambda e: e.__setitem__("versao_final", e["versao_final"] + " " + frase))
    assert any(f.id == "CHK-COPY-03" for f in rel.recusas), frase


def test_treino_recusa_nome_de_botao_inventado_sem_aspas():
    rel = validar_mudanca("TREINO-BOA-01", lambda e: e["passo_a_passo"][7].__setitem__("o_que_fazer", "Toque no botão Iniciar agora."))
    assert any(f.id == "CHK-TREINO-04" for f in rel.recusas)


def test_copy_nao_empresta_valor_de_outra_frase_com_vale():
    texto, contexto = montar_entrada(SPEC, CASOS["COPY-BOA-01"])
    resposta = json.loads(texto)
    resposta["entrega"]["versao_final"] += " Cada gravação aprovada vale 10."
    contexto["fontes_importadas"][0]["texto"] += " Este vale 5."
    rel = validar(json.dumps(resposta, ensure_ascii=False), contexto)
    assert any(f.id == "CHK-COPY-07" for f in rel.recusas)


def test_copy_nao_confunde_percentual_decimal_com_milhar():
    texto, contexto = montar_entrada(SPEC, CASOS["COPY-BOA-01"])
    resposta = json.loads(texto)
    resposta["entrega"]["versao_final"] += " Taxa de aprovação de 1,234%."
    contexto["fontes_importadas"][0]["texto"] += " Taxa de aprovação de 1234%."
    rel = validar(json.dumps(resposta, ensure_ascii=False), contexto)
    assert any(f.id == "CHK-COPY-07" for f in rel.recusas)


def test_copy_recusa_apoio_de_outra_afirmacao():
    def trocar(e):
        e["afirmacoes"][2]["apoio"] = copy.deepcopy(e["afirmacoes"][1]["apoio"])
    rel = validar_mudanca("COPY-BOA-01", trocar)
    assert any(f.id == "CHK-COPY-08" for f in rel.recusas)


def test_copy_recusa_afirmacao_trivial_na_tabela():
    rel = validar_mudanca("COPY-BOA-01", lambda e: e["afirmacoes"][2].__setitem__("frase", "Oi"))
    assert any(f.id == "CHK-COPY-08" for f in rel.recusas)
