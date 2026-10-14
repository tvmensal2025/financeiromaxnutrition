"""Provas das checagens do roteiro de treinamento (CHK-TREINO-01 a 10) que os casos da especificação não fazem sozinhos.

O que é: os casos de helena-v2/casos/SRV-ROTEIRO-TREINAMENTO provam o essencial (cada boa passa, cada defeito é pego, em
tests/test_casos_da_spec.py). Aqui ficam as provas de borda: palavra inteira, aspas, número, contato, falha fechada quando falta
parâmetro, o "desligue a checagem e o defeito escapa" e a CHK-TREINO-10 (só vale no card da eLiving, BIZ-004, e a especificação
ainda não tem caso dela).
De onde vem: parte de uma resposta boa real (TREINO-BOA-01, montada pelo adaptador) e muda UM detalhe, como o banco de casos.
Como mudar: para provar uma regra nova, acrescente um teste que copia a boa, muda um ponto e confere o motivo; a regra em si
(listas, números) é do YAML helena-v2/deliverables/roteiro_treinamento.yaml, nunca daqui.
"""
import copy
import dataclasses
import json
import random
from functools import lru_cache

import pytest

from spec_helena import prova
from spec_helena.caso import listar_casos, montar_entrada
from validador import CHECAGENS, ErroDeContexto, validar
from validador.execucao import Execucao

SPEC = prova.spec_padrao()
IDS = [f"CHK-TREINO-{n:02d}" for n in range(1, 11)]
BOA = "TREINO-BOA-01"
ELIVING = {  # pacote de teste da eLiving (BIZ-004), no mesmo desenho dos pedidos de outros serviços
    "empresa": "BIZ-004", "nome": "eLiving™", "estado": "CONFIRMADO", "fonte_importada_id": "FON-PACOTE-BIZ-004",
    "slogan": "Onde sua evolução ganha direção.", "termos_proibidos_em_todo_texto": ["app fitness", "dieta restritiva"],
}


# ---------------------------------------------------------------------------------------
# Ferramentas
# ---------------------------------------------------------------------------------------
@lru_cache(maxsize=1)
def _casos():
    return {c.id: c for c in listar_casos(SPEC)}


@lru_cache(maxsize=None)
def _entrada(caso):
    return montar_entrada(SPEC, _casos()[caso])


def base(caso=BOA):
    """(resposta como dicionário, contexto) de um caso da especificação, prontos para mexer.
    Sempre uma cópia: os parâmetros do contexto são os mesmos objetos da especificação lida, e um teste não pode estragá-los."""
    resposta, contexto = _entrada(caso)
    return json.loads(resposta), copy.deepcopy(contexto)


def rodar(mudar=None, caso=BOA):
    """Roda o validador na boa com uma mudança `mudar(resposta, contexto)` (ou sem mudança) e devolve o relatório."""
    r, c = base(caso)
    if mudar:
        mudar(r, c)
    return validar(r, c)


def falhas(id_, mudar=None, caso=BOA):
    return rodar(mudar, caso).falhas_de(id_)


def motivos(id_, mudar=None, caso=BOA):
    return sorted({f.motivo for f in falhas(id_, mudar, caso)})


def status(id_, mudar=None, caso=BOA):
    return next(c.status for c in rodar(mudar, caso).checagens if c.id == id_)


def entrega(r, secao):
    return r["entrega"][secao]


def passo(r, id_):
    return next(p for p in entrega(r, "passo_a_passo") if p["id"] == id_)


def erro(r, id_):
    return next(e for e in entrega(r, "erros_que_reprovam") if e["id"] == id_)


def params(c, id_):
    return c["modelo"]["parametros_das_checagens"][id_]


# ---------------------------------------------------------------------------------------
# O que está registrado bate com a especificação
# ---------------------------------------------------------------------------------------
@pytest.mark.parametrize("id_", IDS)
def test_o_registro_diz_o_mesmo_que_a_especificacao(id_):
    spec = SPEC.todas_as_checagens()[id_]
    assert id_ in CHECAGENS
    assert CHECAGENS[id_].gravidade == spec["gravidade"]
    assert list(CHECAGENS[id_].fecha_furos) == list(spec["fecha_furos"])


def test_toda_chk_do_tipo_esta_no_codigo():
    assert {c["id"] for c in SPEC.checagens_do_tipo("roteiro_treinamento")} <= set(CHECAGENS)


def test_a_boa_passa_em_todas_e_a_10_nao_se_aplica_fora_da_eliving():
    rel = rodar()
    estados = {c.id: c.status for c in rel.checagens if c.id in IDS}
    assert estados == {**{i: "PASSOU" for i in IDS[:9]}, "CHK-TREINO-10": "NAO_SE_APLICA"}


# ---------------------------------------------------------------------------------------
# Falha fechada e "não se aplica"
# ---------------------------------------------------------------------------------------
@pytest.mark.parametrize("id_", IDS)
def test_sem_os_parametros_da_especificacao_a_entrega_e_recusada(id_):
    def tirar(r, c):
        c["modelo"]["parametros_das_checagens"].pop(id_)
    assert motivos(id_, tirar) == ["SEM_PARAMETROS_DA_ESPECIFICACAO"]
    assert rodar(tirar).recusas


@pytest.mark.parametrize("id_", IDS)
def test_em_outro_tipo_de_entrega_nao_se_aplica(id_):
    def outro_tipo(r, c):
        c["modelo"]["tipo"] = "copy"
    assert status(id_, outro_tipo) == "NAO_SE_APLICA"


def test_se_o_modelo_perde_uma_secao_do_tipo_a_checagem_avisa_em_vez_de_calar():
    def sem_checklist(r, c):
        c["modelo"]["secoes"] = [s for s in c["modelo"]["secoes"] if s["id"] != "checklist_final"]
    assert motivos("CHK-TREINO-06", sem_checklist) == ["MODELO_SEM_A_SECAO"]


def test_parametro_com_forma_errada_recusa_dizendo_qual():
    def estraga(r, c):
        params(c, "CHK-TREINO-01")["termos"] = "garantido"
    assert motivos("CHK-TREINO-01", estraga) == ["PARAMETRO_INVALIDO"]
    assert "termos" in falhas("CHK-TREINO-01", estraga)[0].mensagem


@pytest.mark.parametrize("id_", IDS)
def test_a_checagem_nao_roda_se_a_acao_nao_e_entregar(id_):
    resposta = {"acao": "REGISTRAR_FALHA", "motivo_falha": "FALTAM_DADOS", "explicacao": "Falta a fonte com as regras de gravação da plataforma."}
    _, c = base()
    rel = validar(resposta, c)
    assert next(x.status for x in rel.checagens if x.id == id_) == "NAO_SE_APLICA"


# ---------------------------------------------------------------------------------------
# CHK-TREINO-01, 09: lista fechada, palavra inteira, sem acento nem maiúscula; a lista é do YAML
# ---------------------------------------------------------------------------------------
def com_objetivo(texto):
    def mudar(r, c):
        entrega(r, "preparacao")[0] = texto
    return mudar


@pytest.mark.parametrize("texto", [
    "Isto é garantido para quem segue os passos.", "GARANTIDO!", "Sem Risco nenhum.", "Dinheiro Facil para todos.",
    "Você pode ganhar mais.", "Cobramos R$ 5 por mês.", "Pague US$10.", "Custa 5€.", "NUNCA SERÁ REPROVADO.",
])
def test_01_pega_promessa_e_simbolo_de_dinheiro(texto):
    assert motivos("CHK-TREINO-01", com_objetivo(texto))


@pytest.mark.parametrize("texto", ["Aprenda a gravar com calma.", "Reprenda o que errou.", "A garantiaria nao e palavra.", "Ganhador de nada."])
def test_01_so_vale_palavra_inteira(texto):
    assert not falhas("CHK-TREINO-01", com_objetivo(texto))


def test_01_a_unica_excecao_e_o_slogan_igual_ao_do_pacote():
    slogan = "Onde sua evolução ganha direção."

    def com_pacote(texto, pacote):
        def mudar(r, c):
            entrega(r, "preparacao")[0] = texto
            c["pacote_da_empresa"] = pacote
        return mudar
    assert not falhas("CHK-TREINO-01", com_pacote(f"Lembre: {slogan}", {"slogan": slogan}))
    assert not falhas("CHK-TREINO-01", com_pacote("Lembre: Onde sua evolução ganha direção", {"slogan": slogan}))   # sem o ponto final
    assert falhas("CHK-TREINO-01", com_pacote(f"Lembre: {slogan}", {}))                                              # pacote sem slogan: não vale
    assert falhas("CHK-TREINO-01", com_pacote("Lembre: Onde sua evolução ganhe direção, você ganha.", {"slogan": slogan}))
    assert falhas("CHK-TREINO-01", com_pacote(f"{slogan} Sua renda cresce.", {"slogan": slogan}))                    # slogan não salva o resto


def test_01_nao_olha_o_trecho_original_das_citacoes():
    linha = "Gravação garantida é aquela em que o celular fica firme durante toda a atividade do participante."

    def mudar(r, c):
        for f in c["fontes_importadas"]:
            if f["fonte_importada_id"] == "FON-REGRAS-GRAVACAO-01":
                f["texto"] += "\n" + linha
        erro(r, "E1")["apoio"] = {"trecho_original": linha, "fonte_importada_id": "FON-REGRAS-GRAVACAO-01"}
    assert not falhas("CHK-TREINO-01", mudar)


def test_a_lista_mora_no_yaml_e_nao_no_codigo():
    """Muda o YAML (aqui, o parâmetro que o adaptador entrega) e a checagem muda sem tocar numa linha de código."""
    def novo_termo(r, c):
        params(c, "CHK-TREINO-09")["termos"] = params(c, "CHK-TREINO-09")["termos"] + ["lanche"]
    assert motivos("CHK-TREINO-09", novo_termo) == ["TERMO_DE_SAUDE"]            # a boa fala de "lanche": passou a ser proibido

    def sem_remedio(r, c):
        entrega(r, "preparacao")[0] = "Tome um remédio antes."
        params(c, "CHK-TREINO-09")["termos"] = [t for t in params(c, "CHK-TREINO-09")["termos"] if "remédio" not in t]
    assert not falhas("CHK-TREINO-09", sem_remedio)


@pytest.mark.parametrize("texto", ["Isto não é diagnóstico.", "Peça uma receita médica.", "Para emagrecer, grave.", "Vai ajudar a PERDER PESO.", "Não é tratamento médico."])
def test_09_pega_orientacao_de_saude_mesmo_negada(texto):
    assert motivos("CHK-TREINO-09", com_objetivo(texto)) == ["TERMO_DE_SAUDE"]


def test_09_a_boa_fala_de_gravar_um_lanche_sem_ser_pega():
    assert not falhas("CHK-TREINO-09")


# ---------------------------------------------------------------------------------------
# CHK-TREINO-02: a lista vem do pacote da empresa
# ---------------------------------------------------------------------------------------
def com_pacote(**campos):
    def mudar(r, c):
        c["pacote_da_empresa"] = {**(c["pacote_da_empresa"] or {}), **campos}
    return mudar


def test_02_pega_termo_da_lista_do_pacote_sem_diferenciar_acento_nem_caixa():
    def mudar(r, c):
        entrega(r, "limites")[0] = "CONTRATAÇÃO e Carteira Assinada ficam fora."
    assert len(falhas("CHK-TREINO-02", mudar)) == 1
    assert "contratação" in falhas("CHK-TREINO-02", mudar)[0].mensagem and "carteira assinada" in falhas("CHK-TREINO-02", mudar)[0].mensagem


@pytest.mark.parametrize("pacote", [{"termos_proibidos_em_todo_texto": []}, {"termos_proibidos_em_todo_texto": None}, {}, None])
def test_02_pacote_sem_lista_passa_e_guarda_o_aviso_da_faixa(pacote):
    r, c = base()
    c["pacote_da_empresa"] = pacote
    entrega(r, "limites")[0] = "Vaga de trabalho fica fora."
    assert next(x.status for x in validar(r, c).checagens if x.id == "CHK-TREINO-02") == "PASSOU"
    exe = Execucao(r, c)                                                   # o aviso fica guardado para a faixa do card
    assert CHECAGENS["CHK-TREINO-02"].funcao(exe) == []
    assert exe.memoria["avisos_da_faixa"] == ["pacote sem lista de termos"]


def test_02_o_nome_do_campo_vem_do_yaml():
    def outro_campo(r, c):
        params(c, "CHK-TREINO-02")["fonte"] = "pacote da empresa do card: palavras_que_nao_podem"
        c["pacote_da_empresa"]["palavras_que_nao_podem"] = ["lanche"]
    assert motivos("CHK-TREINO-02", outro_campo) == ["TERMO_PROIBIDO_PELO_PACOTE"]


def test_02_lista_do_pacote_mal_feita_recusa():
    assert motivos("CHK-TREINO-02", com_pacote(termos_proibidos_em_todo_texto="emprego")) == ["LISTA_DO_PACOTE_INVALIDA"]


def test_02_fonte_mal_escrita_no_yaml_recusa():
    def estraga(r, c):
        params(c, "CHK-TREINO-02")["fonte"] = "o pacote"
    assert motivos("CHK-TREINO-02", estraga) == ["PARAMETRO_INVALIDO"]


# ---------------------------------------------------------------------------------------
# CHK-TREINO-10: só no card da eLiving (BIZ-004)
# ---------------------------------------------------------------------------------------
def card_da_eliving(texto=None, pacote=None):
    def mudar(r, c):
        c["pacote_da_empresa"] = copy.deepcopy(pacote if pacote is not None else ELIVING)
        c["pedido"]["empresa"] = "BIZ-004"
        c["pedido"]["ordem_de_servico"]["empresa"] = "BIZ-004"
        if texto:
            entrega(r, "preparacao")[0] = texto
    return mudar


def test_10_nao_se_aplica_aos_cards_de_outras_empresas():
    assert status("CHK-TREINO-10", com_objetivo("Isto não é um contador de calorias.")) == "NAO_SE_APLICA"


@pytest.mark.parametrize("texto", ["Isto não é um contador de calorias.", "Nada de DIETA aqui.", "Não é app fitness.", "Conte as Calorias", "Aplicativo de academia, não."])
def test_10_na_eliving_pega_caloria_dieta_e_app_fitness_mesmo_negados(texto):
    assert motivos("CHK-TREINO-10", card_da_eliving(texto)) == ["TERMO_DE_APP_DE_CALORIAS"]


def test_10_na_eliving_a_boa_passa():
    assert status("CHK-TREINO-10", card_da_eliving()) == "PASSOU"


def test_10_na_eliving_palavra_parecida_nao_conta():
    assert not falhas("CHK-TREINO-10", card_da_eliving("A caloricidade do ambiente não importa; dietista é outra palavra."))


def test_10_sem_saber_a_empresa_confere_mesmo_assim():
    def sem_empresa(r, c):
        c["pacote_da_empresa"] = None
        c["pedido"] = {}
        entrega(r, "preparacao")[0] = "Nada de calorias."
    assert motivos("CHK-TREINO-10", sem_empresa) == ["TERMO_DE_APP_DE_CALORIAS"]


def test_10_a_empresa_vem_do_yaml():
    def outra_empresa(r, c):
        params(c, "CHK-TREINO-10")["so_empresa"] = "BIZ-003"
        entrega(r, "preparacao")[0] = "Nada de calorias."
    assert motivos("CHK-TREINO-10", outra_empresa) == ["TERMO_DE_APP_DE_CALORIAS"]    # a boa é da BIZ-003: agora é ela que a regra pega


def test_10_o_slogan_da_eliving_nao_atrapalha_a_01():
    assert not falhas("CHK-TREINO-01", card_da_eliving("Lembre: Onde sua evolução ganha direção."))


# ---------------------------------------------------------------------------------------
# CHK-TREINO-03: passos
# ---------------------------------------------------------------------------------------
def test_03_ids_em_ordem_quantidade_tamanho_uma_frase_e_duas_acoes():
    def pular(r, c):
        passo(r, "P3")["id"] = "P4"
    assert motivos("CHK-TREINO-03", pular) == ["ID_DO_PASSO_FORA_DE_ORDEM"]

    def poucos(r, c):
        entrega(r, "passo_a_passo")[:] = entrega(r, "passo_a_passo")[:2]
    assert "QUANTIDADE_DE_PASSOS" in motivos("CHK-TREINO-03", poucos)

    def grande(r, c):
        passo(r, "P1")["o_que_fazer"] = "Avise " + "bem " * 60 + "quem mora com você."
    assert motivos("CHK-TREINO-03", grande) == ["PASSO_GRANDE_DEMAIS"]

    def duas_frases(r, c):
        passo(r, "P1")["o_que_fazer"] = "Avise quem mora com você. Depois grave."
    assert motivos("CHK-TREINO-03", duas_frases) == ["PASSO_COM_MAIS_DE_UMA_FRASE"]

    def sem_ponto(r, c):
        passo(r, "P1")["o_que_fazer"] = "Avise quem mora com você"
    assert motivos("CHK-TREINO-03", sem_ponto) == ["PASSO_COM_MAIS_DE_UMA_FRASE"]


@pytest.mark.parametrize("expressao", ["e depois", "Em Seguida", "logo após", "logo depois", "e então"])
def test_03_expressoes_de_duas_acoes_vem_do_yaml(expressao):
    def mudar(r, c):
        passo(r, "P1")["o_que_fazer"] = f"Avise quem mora com você {expressao} toque em gravar."
    assert motivos("CHK-TREINO-03", mudar) == ["DUAS_ACOES_NO_PASSO"]


def test_03_ponto_dentro_de_aspas_no_fim_e_uma_frase_so():
    def mudar(r, c):
        passo(r, "P1")["o_que_fazer"] = 'Toque em "Gravar".'
    assert not falhas("CHK-TREINO-03", mudar)


def test_03_o_padrao_dos_ids_vem_do_yaml():
    def so_ate_p2(r, c):
        params(c, "CHK-TREINO-03")["ids"] = "^P([1-2])$ em sequência a partir de P1"
    assert set(motivos("CHK-TREINO-03", so_ate_p2)) == {"ID_DO_PASSO_FORA_DE_ORDEM"}
    assert len(falhas("CHK-TREINO-03", so_ate_p2)) == 6        # P3 a P8


def test_03_o_limite_de_passos_vem_do_yaml():
    def maximo_de_cinco(r, c):
        params(c, "CHK-TREINO-03")["passos"] = {"minimo": 3, "maximo": 5}
    assert motivos("CHK-TREINO-03", maximo_de_cinco) == ["QUANTIDADE_DE_PASSOS"]


# ---------------------------------------------------------------------------------------
# CHK-TREINO-04: texto entre aspas existe na fonte
# ---------------------------------------------------------------------------------------
@pytest.mark.parametrize("citado", ['"Iniciar"', "'Iniciar'", "“Iniciar”", "‘Iniciar’"])
def test_04_pega_nome_inventado_em_qualquer_tipo_de_aspas(citado):
    def mudar(r, c):
        passo(r, "P4")["o_que_fazer"] = f"Toque no botão {citado}."
    assert motivos("CHK-TREINO-04", mudar) == ["NOME_ENTRE_ASPAS_SEM_ORIGEM"]


def test_04_aspas_tipograficas_maiuscula_e_acento_nao_atrapalham():
    def mudar(r, c):
        passo(r, "P4")["o_que_fazer"] = "Toque no botão “GRAVAR”."
        passo(r, "P8")["o_que_fazer"] = "Toque no botão 'enviar  para avaliacao'."
    assert not falhas("CHK-TREINO-04", mudar)


def test_04_apostrofo_dentro_de_palavra_nao_e_aspa():
    def mudar(r, c):
        passo(r, "P1")["o_que_fazer"] = "Pegue um copo d'água e avise quem mora com você."
    assert not falhas("CHK-TREINO-04", mudar)


def test_04_olha_sinal_erro_como_evitar_checklist_e_preparacao():
    def sinal(r, c):
        passo(r, "P4")["sinal"] = 'A tela "Painel secreto" abre.'
    def como_evitar(r, c):
        erro(r, "E1")["como_evitar"] = 'Toque em "Estabilizar".'
    def erro_(r, c):
        erro(r, "E1")["erro"] = 'Deixar o "Modo turbo" ligado.'
    def checklist(r, c):
        entrega(r, "checklist_final")[0] = 'P1: você tocou em "Painel secreto"?'
    def preparacao(r, c):
        entrega(r, "preparacao")[0] = 'Abra o "Painel secreto".'
    for mudar in (sinal, como_evitar, erro_, checklist, preparacao):
        assert motivos("CHK-TREINO-04", mudar) == ["NOME_ENTRE_ASPAS_SEM_ORIGEM"], mudar.__name__


def test_04_onde_procurar_e_quais_aspas_valem_vem_do_yaml():
    def incluir_preparacao(r, c):
        params(c, "CHK-TREINO-04")["onde"] = params(c, "CHK-TREINO-04")["onde"] + ["preparacao"]
        entrega(r, "preparacao")[0] = 'Abra o "Painel secreto".'
    assert motivos("CHK-TREINO-04", incluir_preparacao) == ["NOME_ENTRE_ASPAS_SEM_ORIGEM"]

    def sem_aspas_retas(r, c):
        params(c, "CHK-TREINO-04")["aspas"] = ["“...”"]
        passo(r, "P4")["o_que_fazer"] = 'Toque no botão "Iniciar".'
    assert not falhas("CHK-TREINO-04", sem_aspas_retas)


def test_04_so_vale_a_fonte_que_o_yaml_aceita():
    def so_pedido(r, c):
        params(c, "CHK-TREINO-04")["fontes_aceitas"] = ["FON-PEDIDO-<card>"]
    assert "NOME_ENTRE_ASPAS_SEM_ORIGEM" in motivos("CHK-TREINO-04", so_pedido)      # "Gravar" está nas regras, não no pedido


# ---------------------------------------------------------------------------------------
# CHK-TREINO-05: apoio literal
# ---------------------------------------------------------------------------------------
REGRA = "Gravação tremida é reprovada."


@pytest.mark.parametrize("mudanca,motivo", [
    ({"trecho_original": "Gravação balançando é reprovada.", "fonte_importada_id": "FON-REGRAS-GRAVACAO-01"}, "APOIO_NAO_ESTA_NA_FONTE"),
    ({"trecho_original": "gravação tremida é reprovada.", "fonte_importada_id": "FON-REGRAS-GRAVACAO-01"}, "APOIO_NAO_ESTA_NA_FONTE"),   # literal: maiúscula conta
    ({"trecho_original": "Gravacao tremida e reprovada.", "fonte_importada_id": "FON-REGRAS-GRAVACAO-01"}, "APOIO_NAO_ESTA_NA_FONTE"),     # literal: acento conta
    ({"trecho_original": "Gravação tremida", "fonte_importada_id": "FON-REGRAS-GRAVACAO-01"}, "APOIO_CURTO_OU_CORTADO"),
    ({"trecho_original": REGRA, "leitura_id": "LEI-001", "parte": 1}, "APOIO_DE_PAGINA_LIDA"),
    ({"trecho_original": REGRA, "fonte_importada_id": "FON-REGRAS-GRAVACAO-01", "leitura_id": "LEI-001"}, "APOIO_DE_PAGINA_LIDA"),
    ({"trecho_original": REGRA}, "APOIO_SEM_FONTE"),
    ({"trecho_original": REGRA, "fonte_importada_id": "FON-NAO-EXISTE"}, "FONTE_DO_APOIO_NAO_ACEITA"),
    ({"trecho_original": " "}, "APOIO_SEM_TRECHO"),
    ({"fonte_importada_id": "FON-REGRAS-GRAVACAO-01"}, "APOIO_SEM_TRECHO"),
])
def test_05_apoio_que_nao_e_trecho_literal_de_fonte_aceita(mudanca, motivo):
    def mudar(r, c):
        erro(r, "E1")["apoio"] = mudanca
    assert motivo in motivos("CHK-TREINO-05", mudar)


def test_05_frase_inteira_curta_vale_e_pedaco_curto_nao():
    def frase_inteira(r, c):
        erro(r, "E1")["apoio"] = {"trecho_original": "Gravação tremida é reprovada", "fonte_importada_id": "FON-REGRAS-GRAVACAO-01"}   # sem o ponto: ainda é a frase
    assert not falhas("CHK-TREINO-05", frase_inteira)

    def pedaco_de_doze_palavras(r, c):
        erro(r, "E2")["apoio"] = {"trecho_original": "Gravação escura, em que não dá para ver as mãos com nitidez, é reprovada",
                                  "fonte_importada_id": "FON-REGRAS-GRAVACAO-01"}
    assert not falhas("CHK-TREINO-05", pedaco_de_doze_palavras)

    def pedaco_curto(r, c):
        erro(r, "E2")["apoio"] = {"trecho_original": "em que não dá para ver as mãos", "fonte_importada_id": "FON-REGRAS-GRAVACAO-01"}
    assert motivos("CHK-TREINO-05", pedaco_curto) == ["APOIO_CURTO_OU_CORTADO"]


def test_05_o_minimo_de_palavras_vem_do_yaml():
    def pedaco(r, c):
        erro(r, "E2")["apoio"] = {"trecho_original": "em que não dá para ver as mãos", "fonte_importada_id": "FON-REGRAS-GRAVACAO-01"}
        params(c, "CHK-TREINO-05")["minimo_palavras"] = 7
    assert not falhas("CHK-TREINO-05", pedaco)

    def sem_frase_inteira(r, c):
        params(c, "CHK-TREINO-05")["aceita_frase_inteira"] = False
    assert "APOIO_CURTO_OU_CORTADO" in motivos("CHK-TREINO-05", sem_frase_inteira)           # "Gravação tremida é reprovada." só vale como frase inteira


def test_05_trecho_emendado_de_duas_linhas_nao_vale():
    def emenda(r, c):
        erro(r, "E1")["apoio"] = {"trecho_original": "Gravação tremida é reprovada. Gravação escura, em que não dá para ver as mãos com nitidez, é reprovada.",
                                  "fonte_importada_id": "FON-REGRAS-GRAVACAO-01"}
    assert motivos("CHK-TREINO-05", emenda) == ["APOIO_NAO_ESTA_NA_FONTE"]


def test_05_ids_dos_erros_em_ordem_e_erro_sem_apoio():
    def pular(r, c):
        erro(r, "E2")["id"] = "E3"
    assert "ID_DO_ERRO_FORA_DE_ORDEM" in motivos("CHK-TREINO-05", pular)

    def sem_apoio(r, c):
        erro(r, "E2").pop("apoio")
    assert motivos("CHK-TREINO-05", sem_apoio) == ["ERRO_SEM_APOIO"]

    def nono_erro(r, c):
        entrega(r, "erros_que_reprovam").extend({**erro(r, "E1"), "id": f"E{n}"} for n in range(5, 10))
    assert set(motivos("CHK-TREINO-05", nono_erro)) == {"ID_DO_ERRO_FORA_DE_ORDEM"}


def test_05_apoio_de_passo_e_opcional_mas_se_existe_tem_de_valer():
    def sem(r, c):
        passo(r, "P1").pop("apoio")
    assert not falhas("CHK-TREINO-05", sem)

    def inventado(r, c):
        passo(r, "P1")["apoio"] = {"trecho_original": "O participante deve gravar com a luz do sol entrando pela janela da cozinha.", "fonte_importada_id": "FON-REGRAS-GRAVACAO-01"}
    assert motivos("CHK-TREINO-05", inventado) == ["APOIO_NAO_ESTA_NA_FONTE"]


def test_05_a_fonte_pode_ser_o_pedido_ou_o_pacote():
    def do_pedido(r, c):
        erro(r, "E1")["apoio"] = {"trecho_original": "Quem vai ler é o participante da Humano Digital: uma pessoa leiga, que lê no celular e faz tudo sozinha.",
                                  "fonte_importada_id": "FON-PEDIDO-TREINO-01"}
    assert not falhas("CHK-TREINO-05", do_pedido)


# ---------------------------------------------------------------------------------------
# CHK-TREINO-06: checklist
# ---------------------------------------------------------------------------------------
def test_06_forma_do_checklist():
    def sem_pergunta(r, c):
        entrega(r, "checklist_final")[0] = "P1: você avisou quem mora com você."
    assert motivos("CHK-TREINO-06", sem_pergunta) == ["ITEM_SEM_PERGUNTA"]

    def comprido(r, c):
        entrega(r, "checklist_final")[0] = "P1: " + "você avisou quem mora com você que ia gravar " * 5 + "?"
    assert motivos("CHK-TREINO-06", comprido) == ["ITEM_GRANDE_DEMAIS"]

    def sem_id(r, c):
        entrega(r, "checklist_final")[0] = "Você avisou quem mora com você que ia gravar?"
    assert motivos("CHK-TREINO-06", sem_id) == ["ITEM_SEM_PASSO_NEM_ERRO"]

    def id_que_nao_existe(r, c):
        entrega(r, "checklist_final")[0] = "P1 e P9: você avisou quem mora com você?"
    assert motivos("CHK-TREINO-06", id_que_nao_existe) == ["ID_QUE_NAO_EXISTE"]

    def so_id_que_nao_existe(r, c):
        entrega(r, "checklist_final")[0] = "P9: você avisou quem mora com você?"
    assert set(motivos("CHK-TREINO-06", so_id_que_nao_existe)) >= {"ID_QUE_NAO_EXISTE", "ITEM_SEM_PASSO_NEM_ERRO"}

    def poucos(r, c):
        entrega(r, "checklist_final")[:] = entrega(r, "checklist_final")[:2]
    assert "QUANTIDADE_DE_ITENS" in motivos("CHK-TREINO-06", poucos)


def test_06_todo_erro_precisa_de_pelo_menos_uma_pergunta():
    def tirar_e4(r, c):
        entrega(r, "checklist_final").pop(4)          # a pergunta que cobre o E4
    f = falhas("CHK-TREINO-06", tirar_e4)
    assert [x.motivo for x in f] == ["ERRO_SEM_PERGUNTA"] and f[0].trecho == "E4"


def test_06_item_pode_ser_objeto_com_texto():
    def objeto(r, c):
        entrega(r, "checklist_final")[0] = {"texto": "P1: você avisou quem mora com você?"}
    assert not falhas("CHK-TREINO-06", objeto)


def test_06_os_numeros_vem_do_yaml():
    def seis_so(r, c):
        params(c, "CHK-TREINO-06")["itens"] = {"minimo": 3, "maximo": 5}
    assert motivos("CHK-TREINO-06", seis_so) == ["QUANTIDADE_DE_ITENS"]

    def curto(r, c):
        params(c, "CHK-TREINO-06")["maximo_caracteres"] = 30
    assert motivos("CHK-TREINO-06", curto) == ["ITEM_GRANDE_DEMAIS"]


# ---------------------------------------------------------------------------------------
# CHK-TREINO-07: número solto
# ---------------------------------------------------------------------------------------
def com_texto_em_limites(texto, fontes_extra=()):
    def mudar(r, c):
        entrega(r, "limites")[1] = texto
        for fid, t in fontes_extra:
            c["fontes_importadas"].append({"fonte_importada_id": fid, "texto": t})
    return mudar


def test_07_os_numeros_da_fonte_passam_e_os_outros_nao():
    assert not falhas("CHK-TREINO-07", com_texto_em_limites("Cada gravação dura de 5 a 15 minutos."))
    assert motivos("CHK-TREINO-07", com_texto_em_limites("Cada gravação dura 20 minutos.")) == ["NUMERO_SOLTO"]
    assert motivos("CHK-TREINO-07", com_texto_em_limites("Cada gravação dura 5,5 minutos.")) == ["NUMERO_SOLTO"]


def test_07_ponto_de_milhar_virgula_decimal_e_mil_tem_o_mesmo_valor():
    fonte = [("FON-EXTRA-01", "O limite é de 3 mil gravações por mês e de 1.500 por dia, com 2,5 de nota.")]
    assert not falhas("CHK-TREINO-07", com_texto_em_limites("São 3.000 gravações por mês, 1500 por dia e nota 2,50.", fonte))
    assert not falhas("CHK-TREINO-07", com_texto_em_limites("São 3 mil gravações por mês.", fonte))
    assert motivos("CHK-TREINO-07", com_texto_em_limites("São 4 mil gravações por mês.", fonte)) == ["NUMERO_SOLTO"]
    assert motivos("CHK-TREINO-07", com_texto_em_limites("São 3.500 gravações por mês.", fonte)) == ["NUMERO_SOLTO"]


def test_07_ids_e_numero_de_lista_nao_contam():
    def mudar(r, c):
        entrega(r, "limites")[1] = "1. P3 e E2 estão no passo a passo."
    assert not falhas("CHK-TREINO-07", mudar)


def test_07_id_fora_do_padrao_e_numero_solto():
    def mudar(r, c):
        entrega(r, "limites")[1] = "Veja o passo P13."
    assert motivos("CHK-TREINO-07", mudar) == ["NUMERO_SOLTO"]


def test_07_numero_comprido_demais_para_ler_e_recusado():
    assert motivos("CHK-TREINO-07", com_texto_em_limites("Código " + "9" * 40 + ".")) == ["NUMERO_SOLTO"]


def test_07_id_de_documento_nao_serve_de_origem_de_numero():
    """O pacote cita DEC-024 e DEC-025: isso não torna '24' nem '25' números permitidos."""
    assert motivos("CHK-TREINO-07", com_texto_em_limites("Tem 24 horas.")) == ["NUMERO_SOLTO"]


def test_07_data_e_hora_so_valem_se_estao_no_pedido():
    def com_pedido(r, c):
        for f in c["fontes_importadas"]:
            if f["fonte_importada_id"].startswith("FON-PEDIDO-"):
                f["texto"] += " Entregar até 14/10/2026 às 18:00."
        entrega(r, "limites")[1] = "Envie até 14/10/2026 às 18:00."
    assert not falhas("CHK-TREINO-07", com_pedido)
    assert motivos("CHK-TREINO-07", com_texto_em_limites("Envie até 14/10/2026.")) == ["DATA_OU_HORA_SOLTA"]
    assert motivos("CHK-TREINO-07", com_texto_em_limites("Comece às 18:30.")) == ["DATA_OU_HORA_SOLTA"]


def test_07_as_fontes_vem_do_yaml():
    def so_pacote(r, c):
        params(c, "CHK-TREINO-07")["fontes_aceitas"] = ["FON-PACOTE-<empresa>"]
        entrega(r, "limites")[1] = "Cada gravação dura de 5 a 15 minutos."          # o 5 e o 15 estão nas regras de gravação, que agora não valem
    assert set(motivos("CHK-TREINO-07", so_pacote)) == {"NUMERO_SOLTO"}


# ---------------------------------------------------------------------------------------
# CHK-TREINO-08: contato inventado
# ---------------------------------------------------------------------------------------
def com_contato(texto, no_pedido=None, no_pacote=None):
    def mudar(r, c):
        entrega(r, "preparacao")[0] = texto
        if no_pedido:
            for f in c["fontes_importadas"]:
                if f["fonte_importada_id"].startswith("FON-PEDIDO-"):
                    f["texto"] += " " + no_pedido
        if no_pacote:
            for f in c["fontes_importadas"]:
                if f["fonte_importada_id"].startswith("FON-PACOTE-"):
                    f["texto"] += " " + no_pacote
    return mudar


@pytest.mark.parametrize("texto", [
    "Veja https://exemplo.com.br/ajuda para saber mais.", "Entre em www.humano.org.", "Acesse humanodigital.app.", "Fale em ajuda.io/duvidas",
    "Escreva para ajuda@humano.com.br.", "Siga @humanodigital no app.", "Ligue para (11) 91234-5678.", "Ligue 91234-5678.", "Ligue 1234 5678.",
    "Ligue 11912345678.", "Use o CPF 123.456.789-09.", "Informe o CEP 01310-100.",
])
def test_08_pega_contato_que_nenhuma_fonte_traz(texto):
    assert "CONTATO_NAO_VEM_DA_FONTE" in motivos("CHK-TREINO-08", com_contato(texto))


@pytest.mark.parametrize("texto", [
    "Cada gravação dura de 5 a 15 minutos.", "Veja o item 1.5 do manual.", "Termine em 12/10/2026.", "Use a Câmera.Boa vontade.", "Às 10:30 e às 18:45.",
    "Isso custa R$ 5,50.", "Uso 2 a 3 vezes por semana.",
])
def test_08_texto_comum_nao_e_contato(texto):
    assert not falhas("CHK-TREINO-08", com_contato(texto))


def test_08_contato_que_esta_no_pedido_ou_no_pacote_passa_e_o_igual_vale_sem_caixa_nem_http():
    assert not falhas("CHK-TREINO-08", com_contato("Escreva para Ajuda@Humano.com.br.", no_pedido="Dúvidas: ajuda@humano.com.br"))
    assert not falhas("CHK-TREINO-08", com_contato("Veja https://www.humano.com.br/ajuda.", no_pacote="Canal: humano.com.br/ajuda"))
    assert not falhas("CHK-TREINO-08", com_contato("Ligue (11) 91234-5678.", no_pedido="Telefone 11 912345678"))
    assert falhas("CHK-TREINO-08", com_contato("Ligue (11) 91234-5679.", no_pedido="Telefone 11 912345678"))
    assert falhas("CHK-TREINO-08", com_contato("Veja humano.com.br/outra.", no_pedido="Canal: humano.com.br/ajuda"))


def test_08_so_valem_o_pedido_e_o_pacote_nao_as_outras_fontes_importadas():
    def nas_regras(r, c):
        entrega(r, "preparacao")[0] = "Escreva para ajuda@humano.com.br."
        for f in c["fontes_importadas"]:
            if f["fonte_importada_id"] == "FON-REGRAS-GRAVACAO-01":
                f["texto"] += " Dúvidas: ajuda@humano.com.br"
    assert motivos("CHK-TREINO-08", nas_regras) == ["CONTATO_NAO_VEM_DA_FONTE"]


def test_08_as_familias_e_os_detalhes_vem_do_yaml():
    def sem_cpf(r, c):
        params(c, "CHK-TREINO-08")["padroes"] = [p for p in params(c, "CHK-TREINO-08")["padroes"] if not p.startswith("CPF")]
        entrega(r, "preparacao")[0] = "Use o CPF 123.456.789-09."
    assert not falhas("CHK-TREINO-08", sem_cpf)

    def so_site_com(r, c):
        params(c, "CHK-TREINO-08")["padroes"] = ["endereço de site (http, https, www ou nome seguido de .com)"]
        entrega(r, "preparacao")[0] = "Veja humano.org e humano.com."
    assert len(falhas("CHK-TREINO-08", so_site_com)) == 1 and "humano.com" in falhas("CHK-TREINO-08", so_site_com)[0].mensagem

    def telefone_de_10(r, c):
        params(c, "CHK-TREINO-08")["padroes"] = ["telefone com 10 dígitos, sem DDD"]
        entrega(r, "preparacao")[0] = "Ligue 1234567890."
    assert motivos("CHK-TREINO-08", telefone_de_10) == ["CONTATO_NAO_VEM_DA_FONTE"]


def test_08_familia_que_o_codigo_nao_sabe_procurar_recusa_em_vez_de_calar():
    def nova(r, c):
        params(c, "CHK-TREINO-08")["padroes"] = params(c, "CHK-TREINO-08")["padroes"] + ["chave pix"]
    assert motivos("CHK-TREINO-08", nova) == ["PADRAO_SEM_DETECTOR"]


def test_08_nao_olha_o_trecho_original_das_citacoes():
    def mudar(r, c):
        for f in c["fontes_importadas"]:
            if f["fonte_importada_id"] == "FON-REGRAS-GRAVACAO-01":
                f["texto"] += "\nDúvidas só pelo site www.exemplo-plataforma.com agora mesmo, sem falta."
        erro(r, "E1")["apoio"] = {"trecho_original": "Dúvidas só pelo site www.exemplo-plataforma.com agora mesmo, sem falta.", "fonte_importada_id": "FON-REGRAS-GRAVACAO-01"}
    assert not falhas("CHK-TREINO-08", mudar)


# ---------------------------------------------------------------------------------------
# "Desligue a checagem e o defeito da especificação escapa" (o teste de mutação, com os casos da especificação)
# ---------------------------------------------------------------------------------------
def _defeitos_de(id_):
    return [c for c in _casos().values() if not c.bom and id_ in c.deve_falhar_em]


def test_da_chk_01_a_09_cada_uma_tem_defeito_da_especificacao():
    """A CHK-TREINO-10 só vale no card da eLiving (BIZ-004) e a especificação ainda não tem pedido dessa empresa para este serviço."""
    sem = [i for i in IDS[:9] if not _defeitos_de(i)]
    assert not sem, f"estas CHK não têm defeito em helena-v2/casos/SRV-ROTEIRO-TREINAMENTO/defeitos: {sem}"


@pytest.mark.parametrize("id_", IDS)
def test_desligar_a_checagem_deixa_escapar_o_defeito_dela(id_, monkeypatch):
    casos = _defeitos_de(id_)
    if not casos:
        pytest.skip(f"{id_} ainda não tem defeito da especificação (ver tests/adiadas/tipo_treino.py)")
    for caso in casos:
        assert prova.pegou(SPEC, prova.avaliar(SPEC, caso), id_), f"{caso.id} já não era pego por {id_}"
    monkeypatch.setitem(CHECAGENS, id_, dataclasses.replace(CHECAGENS[id_], funcao=lambda exe: []))
    for caso in casos:
        assert not prova.pegou(SPEC, prova.avaliar(SPEC, caso), id_), f"{caso.id} continua pego com {id_} desligada"


@pytest.mark.parametrize("caso", [c.id for c in _casos().values() if c.servico == "SRV-ROTEIRO-TREINAMENTO" and not c.bom and c.deve_falhar_em[0].startswith("CHK-TREINO")])
def test_cada_defeito_novo_ou_antigo_viola_so_a_checagem_que_nomeia(caso):
    """Um defeito plantado = UMA coisa errada: entre as checagens do tipo, só a nomeada acusa (as comuns que já acusam nas boas ficam de fora)."""
    av = prova.avaliar(SPEC, _casos()[caso])
    nomeadas = set(_casos()[caso].deve_falhar_em)
    do_tipo = {f.id for f in av.relatorio.falhas if f.id.startswith("CHK-TREINO")}
    assert do_tipo == nomeadas, f"{caso}: acusaram {sorted(do_tipo)}, o caso nomeia {sorted(nomeadas)}"


# ---------------------------------------------------------------------------------------
# Entrega estranha nunca derruba nem passa sem conferir
# ---------------------------------------------------------------------------------------
LIXO = [None, True, 0, -1, 3.14, "", " ", "x", "<b>", [], {}, [[]], {"a": 1}, "​", "💰", 10 ** 40, ["a", None], {"texto": None}, {"trecho_original": None},
        {"trecho_original": "x" * 50, "leitura_id": {}, "parte": []}, {"fonte_importada_id": []}, {"fonte_importada_id": "FON-X", "trecho_original": 3}, "P1" * 50, "9" * 40]


def _caminhos(o, p=()):
    yield p
    if isinstance(o, dict):
        for k, v in o.items():
            yield from _caminhos(v, p + (k,))
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from _caminhos(v, p + (i,))


def _trocar(o, p, v):
    for k in p[:-1]:
        o = o[k]
    o[p[-1]] = v


@pytest.mark.parametrize("semente", range(60))
def test_entrega_ou_parametro_estragado_nunca_causa_erro_interno_nas_checagens_do_treino(semente):
    rng = random.Random(semente)
    r, c = base(rng.choice([BOA, "TREINO-BOA-02", "TREINO-BOA-03"]))
    alvo = rng.choice([r["entrega"], r["entrega"], c["modelo"]["parametros_das_checagens"], c["pacote_da_empresa"]])
    for _ in range(rng.randint(1, 4)):
        caminhos = [p for p in _caminhos(alvo) if p]
        _trocar(alvo, rng.choice(caminhos), copy.deepcopy(rng.choice(LIXO)))
    try:
        rel = validar(r, c)
    except ErroDeContexto:
        return                                         # contexto mal montado: erro de quem chama, não da checagem
    internos = [f for f in rel.falhas if f.id.startswith("CHK-TREINO") and f.motivo == "ERRO_INTERNO_DA_CHECAGEM"]
    assert not internos, [(f.id, f.mensagem, f.trecho) for f in internos]
