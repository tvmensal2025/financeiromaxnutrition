"""Testes das checagens do tipo COPY (CHK-COPY-01 a 10): validador/checagens/spec_copy.py e spec_copy_fatos.py.

O que é: além dos casos da especificação (que test_casos_da_spec.py já roda), aqui se provam os disfarces, as bordas e a falha fechada:
termo de ganho disfarçado, lista do pacote, regra só da eLiving, contato, número, tabela de afirmações, tamanho, parâmetros que faltam,
texto gigante e entrega estragada. Cada resposta de teste parte de um caso BOM da especificação (helena-v2/casos/SRV-COPY), por isso nenhuma
lista ou regra é repetida aqui: os termos que o teste usa são só exemplos de frases.
Como mudar: para provar uma frase nova, acrescente-a na lista do teste; para mudar uma regra, mude o copy.yaml (não este arquivo).
"""
import copy
import dataclasses
import functools
import json
import random
import time

import pytest

from spec_helena import listar_casos, prova
from spec_helena.caso import montar_entrada
from validador import CHECAGENS, ErroDeContexto, validar

SPEC = prova.spec_padrao()
CASOS = {c.id: c for c in listar_casos(SPEC)}
IDS = [c["id"] for c in SPEC.checagens_do_tipo("copy")]
BOA = "COPY-BOA-01"       # BIZ-003 (Humano Digital), WhatsApp
BOA_ELIVING = "COPY-BOA-04"  # BIZ-004 (eLiving), com slogan


@functools.lru_cache(maxsize=None)
def _entrada_do_caso(caso_id):
    return montar_entrada(SPEC, CASOS[caso_id])


def montar(caso_id=BOA, mexer=None):
    """(resposta como dict, contexto) do caso da especificação, já copiados, depois de `mexer(resposta, contexto)`."""
    resposta, contexto = _entrada_do_caso(caso_id)
    resposta, contexto = json.loads(resposta), copy.deepcopy(contexto)  # cópia: os parâmetros do contexto são os mesmos objetos da especificação lida
    if mexer:
        mexer(resposta, contexto)
    return resposta, contexto


def rodar(caso_id=BOA, mexer=None):
    resposta, contexto = montar(caso_id, mexer)
    return validar(json.dumps(resposta, ensure_ascii=False), contexto)


def com_frase(frase, caso_id=BOA, secao="versao_final"):
    """Relatório da boa com a frase acrescentada no fim de uma seção."""
    def mexer(resposta, _):
        resposta["entrega"][secao] += " " + frase
    return rodar(caso_id, mexer)


def pegou(rel, id_) -> bool:
    return any(f.id == id_ for f in rel.recusas)


def status(rel, id_) -> str:
    return next(c.status for c in rel.checagens if c.id == id_)


def na_fonte(contexto, prefixo, texto):
    """Acrescenta texto às fontes importadas do contexto cujo id começa com `prefixo` (como se o pedido ou o pacote dissessem isso)."""
    for fonte in contexto["fontes_importadas"]:
        if fonte["fonte_importada_id"].startswith(prefixo):
            fonte["texto"] += "\n" + texto


# ---------------------------------------------------------------------------------------
# O registro e a prova de cada checagem
# ---------------------------------------------------------------------------------------
@pytest.mark.parametrize("id_", IDS)
def test_o_registro_bate_com_a_especificacao(id_):
    spec = next(c for c in SPEC.checagens_do_tipo("copy") if c["id"] == id_)
    registrada = CHECAGENS[id_]
    assert registrada.gravidade == spec["gravidade"]
    assert list(registrada.fecha_furos) == list(spec["fecha_furos"])


@pytest.mark.parametrize("id_", IDS)
def test_cada_checagem_tem_uma_boa_em_que_passa_e_um_defeito_que_ela_pega(id_):
    avaliacoes = [a for a in prova.avaliacoes_da_spec() if a.caso.servico == "SRV-COPY"]
    assert any(a.caso.bom and prova.passou(a, id_) for a in avaliacoes), f"{id_}: nenhuma resposta boa a exercita"
    assert any(not a.caso.bom and id_ in a.caso.deve_falhar_em and prova.pegou(SPEC, a, id_) for a in avaliacoes), f"{id_}: nenhum defeito a prova"


@pytest.mark.parametrize("id_", IDS)
def test_defeito_da_checagem_so_e_pego_por_ela(id_, monkeypatch):
    """Desligada a checagem, o defeito que a nomeia passa limpo: nenhuma outra checagem cobre o mesmo furo (o defeito viola só uma coisa)."""
    defeitos = [c for c in CASOS.values() if c.servico == "SRV-COPY" and not c.bom and id_ in c.deve_falhar_em]
    assert defeitos
    monkeypatch.setitem(CHECAGENS, id_, dataclasses.replace(CHECAGENS[id_], funcao=lambda exe: []))
    for caso in defeitos:
        resposta, contexto = montar_entrada(SPEC, caso)
        rel = validar(resposta, contexto)
        assert rel.falhas == [], f"{caso.id}: com {id_} desligada ainda falha em {[(f.id, f.motivo) for f in rel.falhas]}"


@pytest.mark.parametrize("caso_id", [c.id for c in CASOS.values() if c.servico == "SRV-COPY" and c.bom])
def test_resposta_boa_passa_limpa_nas_checagens_do_copy(caso_id):
    rel = rodar(caso_id)
    assert [(f.id, f.motivo) for f in rel.falhas if f.id.startswith("CHK-COPY")] == []
    assert all(status(rel, i) in ("PASSOU", "NAO_SE_APLICA") for i in IDS)


# ---------------------------------------------------------------------------------------
# CHK-COPY-01: ganho, inclusive disfarçado
# ---------------------------------------------------------------------------------------
GANHO = [
    "Você pode ter renda extra.", "Você pode ter RENDA extra.", "Sem promessa de renda.", "Ganhe agora.", "Você ganha um prêmio.",
    "O salário é bom.", "O pagamento sai todo mês.", "Sem comissão nenhuma.", "Receba um bônus.", "O valor por hora é bom.",
    "Você pode ter 50 reais.", "Você pode ter R$ 50.", "Você pode ter US$ 5.", "Você pode ter €5.", "Você pode ter $$$.",
    "Você pode ter 💰.", "Tempo livre vira recompensa.", "Complemente o orçamento.",
    "Você pode ter rеnda.",           # o 'е' é cirílico
    "Você pode ter r e n d a.", "Você pode ter ren-da.", "Você pode ter r3nda.", "Você pode ter ＲＥＮＤＡ.", "Você pode ter g4nh0.",
]


@pytest.mark.parametrize("frase", GANHO)
def test_ganho_e_disfarces_sao_recusados(frase):
    assert pegou(com_frase(frase), "CHK-COPY-01"), frase


@pytest.mark.parametrize("frase", ["Quem mora longe também pode participar.", "A evolução de cada pessoa importa.", "Estamos felizes com o convite."])
def test_texto_sem_ganho_passa(frase):
    assert not pegou(com_frase(frase), "CHK-COPY-01")


def test_ganho_dito_na_tabela_de_afirmacoes_tambem_e_visto():
    def mexer(resposta, _):
        resposta["entrega"]["afirmacoes"][0]["frase"] = "Você ganha dinheiro."
    rel = rodar(BOA, mexer)
    assert any(f.id == "CHK-COPY-01" and f.item == "entrega.afirmacoes[0].frase" for f in rel.recusas)


def test_o_slogan_do_pacote_escrito_igual_e_a_unica_excecao():
    assert not pegou(rodar(BOA_ELIVING), "CHK-COPY-01")           # o slogan tem 'ganha' e passa
    pacote_slogan = "Onde sua evolução ganha direção."

    def com_slogan_diferente(resposta, _):
        resposta["entrega"]["versao_final"] = resposta["entrega"]["versao_final"].replace(pacote_slogan, pacote_slogan.upper())
    assert pegou(rodar(BOA_ELIVING, com_slogan_diferente), "CHK-COPY-01")

    def com_ganho_ao_lado(resposta, _):
        resposta["entrega"]["versao_final"] += " " + pacote_slogan + " Você ganha dinheiro."
    assert pegou(rodar(BOA_ELIVING, com_ganho_ao_lado), "CHK-COPY-01")


def test_ganho_partido_em_duas_linhas_nao_escapa():
    def mexer(resposta, _):
        resposta["entrega"]["versao_final"] += "\nO valor por\nhora é bom."
    assert pegou(rodar(BOA, mexer), "CHK-COPY-01")


# ---------------------------------------------------------------------------------------
# CHK-COPY-02: lista do pacote
# ---------------------------------------------------------------------------------------
def test_termo_do_pacote_e_visto_sem_ligar_para_caixa_nem_acento():
    for frase in ("É uma contratação.", "É uma CONTRATACAO.", "Tem carteira assinada.", "É um emprego."):
        assert pegou(com_frase(frase), "CHK-COPY-02"), frase


def test_pacote_sem_lista_passa():
    for mexer in (lambda r, c: c["pacote_da_empresa"].pop("termos_proibidos_em_todo_texto"),
                  lambda r, c: c["pacote_da_empresa"].update(termos_proibidos_em_todo_texto=[]),
                  lambda r, c: c.update(pacote_da_empresa=None)):
        def tudo(r, c, mexer=mexer):
            r["entrega"]["versao_final"] += " É uma contratação."
            mexer(r, c)
        rel = rodar(BOA, tudo)
        assert status(rel, "CHK-COPY-02") == "PASSOU"


def test_lista_do_pacote_mal_escrita_para_com_erro_de_contexto():
    def mexer(resposta, contexto):
        contexto["pacote_da_empresa"]["termos_proibidos_em_todo_texto"] = "emprego"
    with pytest.raises(ErroDeContexto, match="termos_proibidos_em_todo_texto"):
        rodar(BOA, mexer)


# ---------------------------------------------------------------------------------------
# CHK-COPY-03, 04 e 10: listas fechadas
# ---------------------------------------------------------------------------------------
@pytest.mark.parametrize("frase", ["Tem garantia de resultado.", "Resultado garantido!", "Sem risco nenhum.", "Corra para participar.", "CORRA!",
                                   "Últimas   vagas.", "Só hoje!", "Vaga garantida."])
def test_promessa_e_pressao(frase):
    assert pegou(com_frase(frase), "CHK-COPY-03"), frase


@pytest.mark.parametrize("frase", ["Isso ajuda a emagrecer.", "Isso não é tratamento médico.", "Tem diagnóstico incluído.", "Não é remédio.",
                                   "Você pode perder peso.", "Receita médica não é preciso."])
def test_orientacao_de_saude(frase):
    assert pegou(com_frase(frase), "CHK-COPY-04"), frase


@pytest.mark.parametrize("frase", ["Envie seu CPF.", "Seu C P F, por favor.", "Seu C.P.F., por favor.", "Mande sua senha.", "Mande o código de verificação.",
                                   "Manda um exame.", "Seu RG, por favor.", "Mande a foto do documento.", "Dados bancários não são necessários."])
def test_dado_sensivel(frase):
    assert pegou(com_frase(frase), "CHK-COPY-10"), frase


@pytest.mark.parametrize("frase", ["Procuramos pessoas curiosas.", "A curadoria é nossa.", "Um exemplo simples.", "Nossa senhora, que dia!", "Corrida de rua."])
def test_so_vale_a_palavra_inteira(frase):
    """'cura' não está em 'procura' nem 'curadoria'; 'exame' não está em 'exemplo'; 'corra' não está em 'corrida'."""
    rel = com_frase(frase)
    assert not [f for f in rel.recusas if f.id in ("CHK-COPY-03", "CHK-COPY-04", "CHK-COPY-10")], frase


def test_sigla_so_vale_como_palavra_inteira():
    for frase in ("Uma foto do RGB.", "A CNHx é outra coisa."):
        assert not pegou(com_frase(frase), "CHK-COPY-10"), frase


# ---------------------------------------------------------------------------------------
# CHK-COPY-05: só na eLiving
# ---------------------------------------------------------------------------------------
def test_regra_da_eliving_nao_se_aplica_a_outra_empresa():
    rel = com_frase("Conte as calorias e siga uma dieta.")      # Humano Digital (BIZ-003)
    assert status(rel, "CHK-COPY-05") == "NAO_SE_APLICA" and not pegou(rel, "CHK-COPY-05")


@pytest.mark.parametrize("frase", ["A eLiving é um contador de calorias.", "Nada de dieta aqui.", "É um app de academia.", "Conte calorias.", "Faça DIETAS."])
def test_regra_da_eliving_vale_no_card_da_eliving(frase):
    rel = com_frase(frase, BOA_ELIVING)
    assert status(rel, "CHK-COPY-05") == "FALHOU" and pegou(rel, "CHK-COPY-05"), frase


def test_empresa_desconhecida_para_com_erro_de_contexto():
    def mexer(resposta, contexto):
        contexto["pacote_da_empresa"] = None
        contexto["pedido"] = {}
    with pytest.raises(ErroDeContexto, match="empresa"):
        rodar(BOA, mexer)


def test_se_alguma_fonte_diz_que_e_a_eliving_vale_a_regra_mais_rigida():
    def mexer(resposta, contexto):
        contexto["pedido"]["empresa"] = "BIZ-004"               # o pacote ainda diz BIZ-003
        resposta["entrega"]["versao_final"] += " Siga uma dieta."
    assert pegou(rodar(BOA, mexer), "CHK-COPY-05")


# ---------------------------------------------------------------------------------------
# CHK-COPY-06: contatos
# ---------------------------------------------------------------------------------------
CONTATOS = ["Veja https://www.humano.com.br/convite.", "Veja www.humano.com.br.", "Veja humano.com.br/convite.", "Veja humano.com.",
            "Veja HUMANO.ORG.", "Veja exemplo.net.", "Veja loja.app.", "Veja exemplo.io.", "Escreva para contato@humano.com.br.", "Siga @humano_digital.",
            "Ligue (11) 91234-5678.", "Ligue 91234-5678.", "Ligue 1234-5678.", "Ligue +55 11 91234-5678.", "Ligue 11912345678.",
            "Ligue 0800 123 4567.", "Meu CPF é 123.456.789-09.", "Meu CEP é 01310-100."]


@pytest.mark.parametrize("frase", CONTATOS)
def test_contato_que_ninguem_informou_e_recusado(frase):
    assert pegou(com_frase(frase), "CHK-COPY-06"), frase


@pytest.mark.parametrize("frase", ["O dia a dia no celular.", "Em 14/10/2026 às 18:30.", "São 10 pessoas.", "Mimix e Hub.", "Tudo bem? Até logo.mande msg.",
                                   "Em 14.10.2026 e em 2026-10-14.", "Mande uma mensagem."])
def test_texto_comum_nao_vira_contato(frase):
    assert not pegou(com_frase(frase), "CHK-COPY-06"), frase


def test_contato_que_esta_igual_no_pedido_passa():
    def mexer(resposta, contexto):
        na_fonte(contexto, "FON-PEDIDO", "Meu perfil é @humano_digital e o site é https://www.humano.com.br/convite. Ligue (11) 91234-5678.")
        resposta["entrega"]["versao_final"] += " Perfil @Humano_Digital, site https://www.humano.com.br/convite e telefone (11) 91234-5678."
    assert not pegou(rodar(BOA, mexer), "CHK-COPY-06")


def test_contato_do_pacote_tambem_vale():
    def mexer(resposta, contexto):
        contexto["pacote_da_empresa"]["canais_confirmados"] = ["@humano_oficial"]
        na_fonte(contexto, "FON-PACOTE", "@humano_oficial")
        resposta["entrega"]["versao_final"] += " Siga @humano_oficial."
    assert not pegou(rodar(BOA, mexer), "CHK-COPY-06")


def test_telefone_diferente_do_do_pedido_e_recusado():
    def mexer(resposta, contexto):
        na_fonte(contexto, "FON-PEDIDO", "Ligue (11) 91234-5678.")
        resposta["entrega"]["versao_final"] += " Ligue (11) 91234-5679."
    assert pegou(rodar(BOA, mexer), "CHK-COPY-06")


def test_o_mesmo_numero_e_dito_uma_vez_so():
    rel = com_frase("Meu CPF é 123.456.789-09.")
    assert len([f for f in rel.falhas_de("CHK-COPY-06")]) == 1


# ---------------------------------------------------------------------------------------
# CHK-COPY-07: números
# ---------------------------------------------------------------------------------------
@pytest.mark.parametrize("frase", ["São 5 horas por semana.", "Cerca de 1.200 pessoas.", "Cerca de 10 mil pessoas.", "Cerca de 1,5 mil pessoas.",
                                   "Com 0,5 de chance.", "Vitamina B12.", "Chamo 10.000 pessoas.", "Chamo 10 milhões de pessoas.", "Em 2026-10-14 começamos.",
                                   "Uma chance de 1.2.3.", "Cerca de 3.5 pessoas.", "Chamo ９９ pessoas."])
def test_numero_solto_e_recusado(frase):
    assert pegou(com_frase(frase), "CHK-COPY-07"), frase


@pytest.mark.parametrize("frase", ["São 10 pessoas.", "Mais 10,0 pessoas.", "A1 é o primeiro passo.", "Sem número nenhum."])
def test_numero_do_pedido_passa(frase):
    assert not pegou(com_frase(frase), "CHK-COPY-07"), frase


def test_numero_vale_pelo_valor_e_nao_pela_escrita():
    def mexer(resposta, contexto):
        na_fonte(contexto, "FON-PEDIDO", "Cerca de 1.200 pessoas e 2 mil vagas. Meio ponto: 0,5.")
        resposta["entrega"]["versao_final"] += " São 1200 pessoas, 1,2 mil pessoas, 2.000 vagas e 0.5 ponto."
    assert not pegou(rodar(BOA, mexer), "CHK-COPY-07")


def test_data_e_hora_so_valem_se_estao_no_pedido():
    def com_data_no_pedido(resposta, contexto):
        na_fonte(contexto, "FON-PEDIDO", "A conversa será em 14/10/2026 às 18:30.")
        resposta["entrega"]["versao_final"] += " A conversa será em 14/10/2026 às 18:30."
    assert not pegou(rodar(BOA, com_data_no_pedido), "CHK-COPY-07")

    def com_outra_data(resposta, contexto):
        na_fonte(contexto, "FON-PEDIDO", "A conversa será em 14/10/2026 às 18:30.")
        resposta["entrega"]["versao_final"] += " A conversa será em 15/10/2026 às 19:30."
    rel = rodar(BOA, com_outra_data)
    assert {f.motivo for f in rel.falhas_de("CHK-COPY-07")} == {"DATA_OU_HORA_SOLTA"}


def test_numero_de_codigo_do_pacote_nao_conta_como_quantidade():
    """O pacote da Humano Digital cita BIZ-003, DEC-024 e DEC-025: o texto não pode ganhar o número 24 ou 3 por causa disso."""
    for frase in ("Somos 24 pessoas.", "São 3 passos.", "São 25 pessoas."):
        assert pegou(com_frase(frase), "CHK-COPY-07"), frase


# ---------------------------------------------------------------------------------------
# CHK-COPY-08: tabela de afirmações
# ---------------------------------------------------------------------------------------
def linha(i):
    return lambda resposta: resposta["entrega"]["afirmacoes"][i]


def motivos_da_08(mexer, caso_id=BOA):
    return {f.motivo for f in rodar(caso_id, mexer).falhas_de("CHK-COPY-08")}


def test_id_fora_do_padrao_ou_repetido():
    assert motivos_da_08(lambda r, c: linha(0)(r).update(id="A9")) == {"ID_FORA_DO_PADRAO"}
    assert motivos_da_08(lambda r, c: linha(1)(r).update(id="A1")) == {"ID_REPETIDO"}
    assert motivos_da_08(lambda r, c: linha(1)(r).update(id=3)) == {"ID_FORA_DO_PADRAO"}


def test_frase_que_nao_esta_no_texto():
    assert motivos_da_08(lambda r, c: linha(2)(r).update(frase="você grava atividades no telefone")) == {"FRASE_FORA_DO_TEXTO"}
    assert motivos_da_08(lambda r, c: linha(2)(r).update(frase="")) == {"FRASE_FORA_DO_TEXTO"}
    assert motivos_da_08(lambda r, c: linha(2)(r).update(frase="Você grava atividades do dia a dia no celular")) == {"FRASE_FORA_DO_TEXTO"}  # a caixa vale
    assert motivos_da_08(lambda r, c: linha(2)(r).update(frase="gravações")) == set()                  # palavra inteira, no texto
    assert motivos_da_08(lambda r, c: linha(2)(r).update(frase="gravaçõe")) == {"FRASE_FORA_DO_TEXTO"}  # pedaço de palavra não vale


def test_frase_pode_estar_so_na_alternativa_curta():
    def mexer(resposta, _):
        linha(0)(resposta)["frase"] = "Tudo bem não responder."          # só a alternativa curta tem esta frase
        resposta["entrega"]["versao_final"] = resposta["entrega"]["versao_final"].replace("tudo bem não responder", "tudo certo não responder")
    assert motivos_da_08(mexer) == set()


def test_apoio_que_nao_e_literal_ou_nao_existe():
    assert motivos_da_08(lambda r, c: linha(0)(r)["apoio"].update(trecho_original="Vou chamar as primeiras 10 pessoas pelo Telegram, todas adultas e conhecidas minhas.")) == {"APOIO_NAO_ESTA_NA_FONTE"}
    assert motivos_da_08(lambda r, c: linha(0)(r)["apoio"].update(trecho_original="vou chamar as primeiras 10 pessoas pelo whatsapp, todas adultas e conhecidas minhas.")) == {"APOIO_NAO_ESTA_NA_FONTE"}
    assert motivos_da_08(lambda r, c: linha(0)(r)["apoio"].update(fonte_importada_id="FON-INVENTADA")) == {"FONTE_INEXISTENTE"}
    assert motivos_da_08(lambda r, c: linha(0)(r)["apoio"].pop("fonte_importada_id")) == {"APOIO_SEM_FONTE"}
    assert motivos_da_08(lambda r, c: linha(0).__call__(r).pop("apoio")) == {"APOIO_AUSENTE"}


def test_apoio_curto_so_vale_se_for_frase_inteira():
    assert motivos_da_08(lambda r, c: linha(0)(r)["apoio"].update(trecho_original="primeiras 10 pessoas pelo WhatsApp")) == {"APOIO_CURTO_DEMAIS"}
    # frase inteira de poucas palavras (a CHK-COMUM-06 pode ter a sua opinião; aqui só vale a regra da CHK-COPY-08)
    assert motivos_da_08(lambda r, c: linha(0)(r)["apoio"].update(trecho_original="A pessoa pode tirar dúvidas antes de decidir e pode também não responder")) == set()


def test_apoio_com_leitura_id_nunca_vale():
    def mexer(resposta, _):
        apoio = linha(0)(resposta)["apoio"]
        apoio.pop("fonte_importada_id")
        apoio.update(leitura_id="LEI-001", parte=1)
    assert motivos_da_08(mexer) == {"APOIO_DE_PAGINA_LIDA"}


def test_apoio_com_aspas_e_espacos_diferentes_continua_literal():
    def mexer(resposta, _):
        linha(1)(resposta)["apoio"]["trecho_original"] = "“A  Humano Digital conecta pessoas adultas a oportunidades de dados para inteligência artificial, na Mimix e no Hub.”"
    assert motivos_da_08(mexer) == set()


def test_apoio_pode_vir_do_pacote():
    assert motivos_da_08(lambda r, c: None, BOA_ELIVING) == set()            # A2 da boa 04 cita o slogan do pacote (FON-PACOTE-BIZ-004)


# ---------------------------------------------------------------------------------------
# CHK-COPY-09: tamanho da alternativa
# ---------------------------------------------------------------------------------------
def com_tamanhos(final, alternativa):
    def mexer(resposta, _):
        resposta["entrega"]["versao_final"] = "a" * final
        resposta["entrega"]["alternativa_curta"] = "b" * alternativa
    return {f.motivo for f in rodar(BOA, mexer).falhas_de("CHK-COPY-09")}


def test_alternativa_na_borda_dos_60_por_cento_e_dos_400_caracteres():
    assert com_tamanhos(500, 300) == set()                                          # exatamente 60%
    assert com_tamanhos(500, 301) == {"ALTERNATIVA_COMPRIDA_COMO_A_FINAL"}
    assert com_tamanhos(1000, 400) == set()                                         # exatamente 400
    assert com_tamanhos(1000, 401) == {"ALTERNATIVA_GRANDE_DEMAIS"}
    assert com_tamanhos(600, 500) == {"ALTERNATIVA_GRANDE_DEMAIS", "ALTERNATIVA_COMPRIDA_COMO_A_FINAL"}


def test_espaco_nas_pontas_nao_conta_no_tamanho():
    def mexer(resposta, _):
        resposta["entrega"]["versao_final"] = "  " + "a" * 500 + "  "
        resposta["entrega"]["alternativa_curta"] = "\n" + "b" * 300 + "\n"
    assert rodar(BOA, mexer).falhas_de("CHK-COPY-09") == []


# ---------------------------------------------------------------------------------------
# Falha fechada: parâmetros, formato e contexto
# ---------------------------------------------------------------------------------------
def test_sem_os_parametros_num_contexto_antigo_nao_se_aplica():
    def mexer(resposta, contexto):
        contexto["modelo"].pop("parametros_das_checagens")
        contexto["modelo"].pop("checagens_a_rodar")
        resposta["entrega"]["versao_final"] += " Você ganha renda."
    rel = rodar(BOA, mexer)
    assert all(status(rel, i) == "NAO_SE_APLICA" for i in IDS)


@pytest.mark.parametrize("id_", IDS)
def test_checagem_da_lista_sem_parametros_para_com_erro_de_contexto(id_):
    def mexer(resposta, contexto):
        contexto["modelo"]["parametros_das_checagens"].pop(id_)
    with pytest.raises(ErroDeContexto, match=id_):
        rodar(BOA, mexer)


def test_resposta_que_nao_e_entrega_nao_se_aplica():
    rel = validar(json.dumps({"acao": "REGISTRAR_FALHA", "motivo_falha": "FALTAM_DADOS", "explicacao": "Faltou o pacote da empresa."}), montar()[1])
    assert all(status(rel, i) == "NAO_SE_APLICA" for i in IDS)
    rel = validar("isto não é JSON", montar()[1])
    assert all(status(rel, i) == "NAO_SE_APLICA" for i in IDS)


@pytest.mark.parametrize("lugar", ["versao_finl", "afirmacoes.frasee", "versao_final.frase"])
def test_onde_olhar_que_o_modelo_nao_tem_para_com_erro_de_contexto(lugar):
    """Erro de digitação no 'onde' do copy.yaml não pode fazer a checagem deixar de olhar o texto em silêncio."""
    def mexer(resposta, contexto):
        contexto["modelo"]["parametros_das_checagens"]["CHK-COPY-03"]["onde"].append(lugar)
    with pytest.raises(ErroDeContexto, match="modelo do serviço|não tem a coluna"):
        rodar(BOA, mexer)


def test_padrao_de_contato_que_o_codigo_nao_conhece_para_com_erro_de_contexto():
    def mexer(resposta, contexto):
        contexto["modelo"]["parametros_das_checagens"]["CHK-COPY-06"]["padroes"].append("número de passaporte (AA000000)")
    with pytest.raises(ErroDeContexto, match="passaporte"):
        rodar(BOA, mexer)


def test_a_lista_da_especificacao_e_que_manda():
    """Palavra nova na lista do copy.yaml passa a ser recusada, sem mexer no código."""
    def mexer(resposta, contexto):
        contexto["modelo"]["parametros_das_checagens"]["CHK-COPY-03"]["termos"].append("imperdível")
        resposta["entrega"]["versao_final"] += " Uma chance imperdível."
    assert pegou(rodar(BOA, mexer), "CHK-COPY-03")
    assert not pegou(com_frase("Uma chance imperdível."), "CHK-COPY-03")


LIXO = [None, True, 0, -1, 3.14, "", " ", "x", [], {}, [[]], {"a": 1}, "​", "💰", 10 ** 40, ["a", None], {"texto": None}, {"trecho_original": None},
        {"trecho_original": "x" * 50, "fonte_importada_id": []}, "a" * 5000]
LIXO_DE_PARAMETRO = [None, 0, "x", [], {}, ["a", None]]


def caminhos(o, p=()):
    yield p
    if isinstance(o, dict):
        for k, v in o.items():
            yield from caminhos(v, p + (k,))
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from caminhos(v, p + (i,))


def estragar(alvo, rng):
    for _ in range(rng.randint(1, 3)):
        p = rng.choice(list(caminhos(alvo)))
        if not p:
            continue
        pai = alvo
        for k in p[:-1]:
            pai = pai[k]
        if rng.random() < 0.3 and isinstance(pai, dict):
            pai.pop(p[-1], None)
        else:
            pai[p[-1]] = copy.deepcopy(rng.choice(LIXO))


@pytest.mark.parametrize("caso_id", [c.id for c in CASOS.values() if c.servico == "SRV-COPY" and c.bom])
def test_entrega_estragada_nunca_derruba_nenhuma_checagem_do_copy(caso_id):
    rng = random.Random(f"copy-{caso_id}")
    for _ in range(40):
        resposta, contexto = montar(caso_id)
        estragar(resposta, rng)
        rel = validar(json.dumps(resposta, default=str), contexto)
        internos = [(f.id, f.trecho) for f in rel.falhas if f.motivo == "ERRO_INTERNO_DA_CHECAGEM"]
        assert not internos, (internos, json.dumps(resposta, default=str)[:300])


@pytest.mark.parametrize("id_", IDS)
def test_parametro_estragado_so_levanta_erro_de_contexto(id_):
    """Parâmetro mal escrito na especificação para o validador com uma mensagem clara (nunca um erro estranho nem uma aprovação calada)."""
    chaves = list(montar()[1]["modelo"]["parametros_das_checagens"][id_])
    for chave in chaves:
        for lixo in LIXO_DE_PARAMETRO:
            resposta, contexto = montar()
            contexto["modelo"]["parametros_das_checagens"][id_][chave] = copy.deepcopy(lixo)
            try:
                rel = validar(json.dumps(resposta, ensure_ascii=False), contexto)
            except ErroDeContexto:
                continue
            assert not [f for f in rel.falhas if f.motivo == "ERRO_INTERNO_DA_CHECAGEM"], (id_, chave, lixo)


# ---------------------------------------------------------------------------------------
# Texto gigante ou patológico não trava
# ---------------------------------------------------------------------------------------
PATOLOGICOS = [   # 50 mil caracteres: se alguma conta fosse quadrática (n x n), levaria minutos
    ("palavra gigante", "a" * 50_000), ("hífens", "a-" * 25_000), ("pontos", "a." * 25_000), ("arrobas", "@" * 25_000),
    ("e-mails quebrados", "a@" * 15_000), ("dígitos soltos", "1 " * 25_000), ("links quebrados", "http://" + "a/@" * 12_000),
    ("letras soltas", "a " * 25_000), ("muitas linhas", "x\n" * 25_000), ("ganho disfarçado", "r e n d a, ren-da, r3nda e g a n h o. " * 1000),
    ("siglas soltas", "C P F " * 8_000), ("números colados", "1.2.3.4.5." * 5_000), ("telefones", "(11) 91234-5678 " * 3_000),
]


@pytest.mark.parametrize("nome,texto", PATOLOGICOS, ids=[p[0] for p in PATOLOGICOS])
def test_texto_patologico_nao_trava(nome, texto):
    def mexer(resposta, _):
        resposta["entrega"]["versao_final"] += " " + texto
    t = time.perf_counter()
    rodar(BOA, mexer)
    assert time.perf_counter() - t < 5, nome
