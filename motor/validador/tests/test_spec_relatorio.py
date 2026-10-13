"""As dez checagens do relatório final (CHK-REL-*) por dentro: cada motivo, os limites e as entregas estranhas.

O que é: os casos da especificação (helena-v2/casos/SRV-RELATORIO-FINAL/) já provam que cada checagem pega UM defeito e que as
respostas boas passam (tests/test_casos_da_spec.py). Este arquivo prova o resto: os outros motivos de cada checagem, o limite exato,
o que NÃO deve ser recusado, a checagem desligada deixando o defeito escapar, e o relatório com lixo dentro nunca derrubando o validador.
De onde vem: parte da resposta boa REL-BOA-01 e do pedido do caso, lidos pelo adaptador (spec_helena); a cada teste, UMA coisa é estragada.
Os limites e listas vêm do `parametros` do YAML (relatorio_final.yaml), nunca copiados para cá.
Como mudar: para provar um motivo novo, acrescente uma linha em MUDANCAS_QUE_FALHAM (ou em MUDANCAS_QUE_PASSAM, se a mudança é honesta).
"""
import copy
import dataclasses
import json
import random

import pytest

from spec_helena import listar_casos, prova
from spec_helena.caso import montar_entrada
from validador import CHECAGENS, ErroDeContexto, validar

from .test_robustez import estragar

SPEC = prova.spec_padrao()
IDS_DO_RELATORIO = [c["id"] for c in SPEC.checagens_do_tipo("relatorio_final")]
PARAMETROS = {c["id"]: c.get("parametros") or {} for c in SPEC.checagens_do_tipo("relatorio_final")}
CASOS = {c.id: c for c in listar_casos(SPEC) if c.servico == "SRV-RELATORIO-FINAL"}
FRASE_MAX = PARAMETROS["CHK-REL-TAMANHO-DAS-LINHAS"]["frase_max"]
PASSO_MAX = PARAMETROS["CHK-REL-TAMANHO-DAS-LINHAS"]["passo_max"]


def base():
    """A resposta boa REL-BOA-01 (objeto) e o contexto do caso: cópias novas a cada chamada.

    O deepcopy é de propósito: o adaptador entrega o `parametros` com os MESMOS objetos que a especificação lida guarda na memória;
    sem a cópia, um teste que mexe numa lista de parâmetros estragaria os testes seguintes.
    """
    resposta, contexto = montar_entrada(SPEC, CASOS["REL-BOA-01"])
    return json.loads(resposta), copy.deepcopy(contexto)


@pytest.mark.parametrize("texto,refs", [
    ("Pague a indicação a cada participante.", "PF-01"),
    ("Publique o convite e contrate um anunciante.", "AF-COPY-ENVIAR-OU-PUBLICAR, E3"),
])
def test_ref_de_acao_nao_autoriza_passo_diferente(texto, refs):
    r, c = base()
    r["entrega"]["proximos_passos"].append({"ordem": 6, "passo": texto, "depois_de": "nada", "refs": refs})
    assert "ACAO_NOVA" in motivos(roda(r, c), "CHK-REL-SEM-ACAO-NOVA")


@pytest.mark.parametrize("texto", ["Fazer o envio do convite ao grupo.", "Realize a publicação do convite.",
                                     "Efetue o pagamento da indicação.", "Fazer um Pix para a plataforma.",
                                     "Manda o convite para a lista.", "Confirmar o valor transferido.",
                                     "Programar o disparo do convite.", "Chame os interessados do grupo.",
                                     "Ligue pra cada candidato.", "Telefone para os candidatos.",
                                     "Compartilhe o convite com amigos.", "Send the invite to the group.",
                                     "Envіe o convite às pessoas."])
def test_acao_externa_em_outra_forma_verbal(texto):
    r, c = base()
    r["entrega"]["proximos_passos"].append({"ordem": 6, "passo": texto, "depois_de": "nada", "refs": "E4"})
    assert "ACAO_NOVA" in motivos(roda(r, c), "CHK-REL-SEM-ACAO-NOVA")


@pytest.mark.parametrize("texto", ["sem risco", "zero furos", "nenhum risco", "sem pendência", "tudo ok", "cem por cento seguro", "completamente seguro", "nada para conferir"])
def test_promessa_disfarcada_no_resumo(texto):
    r, c = base()
    r["entrega"]["resumo"][3]["frase"] += " O plano está " + texto + "."
    assert "FRASE_DE_GARANTIA" in motivos(roda(r, c), "CHK-REL-SEM-OTIMISMO")


@pytest.mark.parametrize("texto", ["Rendas garantidas", "Ganho assegurado"])
def test_flexao_de_termo_proibido_do_pacote(texto):
    r, c = base()
    r["entrega"]["resumo"][3]["frase"] += f" {texto} para todos."
    assert "TERMO_PROIBIDO_PELO_PACOTE" in motivos(roda(r, c), "CHK-REL-PACOTE")


def test_resumo_com_frases_de_um_caractere_nao_oculta_risco_alto():
    r, c = base()
    for linha in r["entrega"]["resumo"]:
        linha.update(frase="x", refs="E1, E2, E3, E4, PF-01")
    assert "RESUMO_SEM_CONTEUDO" in motivos(roda(r, c), "CHK-REL-RISCO-ALTO-NO-RESUMO")


@pytest.mark.parametrize("texto", [
    "O cenário base seria de vinte e cinco mil dólares por semana.",
    "O cenário base seria de US$ 25k por semana.",
    "O cenário base seria de US$ 10,000 por semana.",
    "O cenário base seria de R$ 25 por semana.",
    "O cenário base seria de US$ 15 por semana.",
    "O cenário base seria de 50 horas por semana.",
])
def test_numero_inventado_ou_em_outra_grandeza_no_relatorio(texto):
    r, c = base()
    r["entrega"]["resumo"][0].update(frase=texto, refs="E1, E2")
    assert motivos(roda(r, c), "CHK-REL-NUMEROS")


def test_numeros_do_prazo_nao_provam_quantidades_do_relatorio():
    r, c = base()
    r["entrega"]["resumo"][1].update(frase="O convite foi aprovado com 3 perguntas e 18 linhas.", refs="E3, PEDIDO")
    assert "NUMERO_FORA_DAS_FONTES" in motivos(roda(r, c), "CHK-REL-NUMEROS")


def roda(resposta, contexto):
    return validar(json.dumps(resposta, ensure_ascii=False), contexto)


def motivos(rel, chk):
    return {f.motivo for f in rel.falhas_de(chk)}


def frase(r, i):
    return r["entrega"]["resumo"][i]


def passo(r, i):
    return r["entrega"]["proximos_passos"][i]


def pacote(c):
    return c["pedido"]["pacote_do_relatorio"]


def montada(c):
    return pacote(c)["parte_montada_pelo_codigo"]


def etapas_do_plano(c):
    return c["pedido"]["card"]["plano"]["etapas"]


def com_texto(r, secao, i, coluna, texto):
    r["entrega"][secao][i][coluna] = texto


# ---------------------------------------------------------------------------------------
# A base está limpa
# ---------------------------------------------------------------------------------------
def test_a_resposta_boa_passa_em_todas_as_checagens_do_relatorio():
    rel = roda(*base())
    status = {c.id: c.status for c in rel.checagens}
    assert [i for i in IDS_DO_RELATORIO if status[i] != "PASSOU"] == []
    assert rel.veredito == "APROVADA"


# ---------------------------------------------------------------------------------------
# Mudanças que a checagem TEM de pegar: (nome, mudança, checagem, motivo)
# ---------------------------------------------------------------------------------------
MUDANCAS_QUE_FALHAM = [
    # --- seções e colunas
    ("coluna a mais na linha", lambda r, c: frase(r, 0).update(riscos="x"), "CHK-REL-SO-SECOES", "COLUNA_DE_FORA"),
    ("seção a mais", lambda r, c: r["entrega"].update(numeros=[]), "CHK-REL-SO-SECOES", "SECAO_DE_FORA"),
    ("seção que não é lista", lambda r, c: r["entrega"].update(resumo="um texto solto"), "CHK-REL-SO-SECOES", "FORMATO_DA_SECAO"),
    ("linha que não é objeto", lambda r, c: r["entrega"]["resumo"].append("linha solta"), "CHK-REL-SO-SECOES", "FORMATO_DA_LINHA"),
    # --- tamanho e células vazias
    ("frase uma acima do limite", lambda r, c: com_texto(r, "resumo", 1, "frase", ("Texto curto " * 40)[:FRASE_MAX + 1]), "CHK-REL-TAMANHO-DAS-LINHAS", "LINHA_LONGA"),
    ("passo uma acima do limite", lambda r, c: com_texto(r, "proximos_passos", 1, "passo", ("Texto curto " * 40)[:PASSO_MAX + 1]), "CHK-REL-TAMANHO-DAS-LINHAS", "LINHA_LONGA"),
    ("refs vazia", lambda r, c: com_texto(r, "resumo", 1, "refs", "  "), "CHK-REL-TAMANHO-DAS-LINHAS", "CELULA_VAZIA"),
    ("depois_de sem a coluna", lambda r, c: passo(r, 1).pop("depois_de"), "CHK-REL-TAMANHO-DAS-LINHAS", "CELULA_VAZIA"),
    ("frase que não é texto", lambda r, c: com_texto(r, "resumo", 1, "frase", 7), "CHK-REL-TAMANHO-DAS-LINHAS", "CELULA_VAZIA"),
    # --- ordem dos passos
    ("ordem repetida", lambda r, c: passo(r, 2).update(ordem=2), "CHK-REL-ORDEM", "ORDEM_PULA_OU_REPETE"),
    ("ordem que não começa em 1", lambda r, c: [p.update(ordem=p["ordem"] + 1) for p in r["entrega"]["proximos_passos"]], "CHK-REL-ORDEM", "ORDEM_PULA_OU_REPETE"),
    ("ordem fora de sequência", lambda r, c: (passo(r, 0).update(ordem=2), passo(r, 1).update(ordem=1)), "CHK-REL-ORDEM", "ORDEM_PULA_OU_REPETE"),
    ("ordem que não é número", lambda r, c: passo(r, 1).update(ordem="segundo"), "CHK-REL-ORDEM", "ORDEM_INVALIDA"),
    ("ordem decimal", lambda r, c: passo(r, 1).update(ordem="2,5"), "CHK-REL-ORDEM", "ORDEM_INVALIDA"),
    ("depois_de cita a própria ordem", lambda r, c: passo(r, 2).update(depois_de="3"), "CHK-REL-ORDEM", "DEPENDENCIA_PARA_FRENTE"),
    ("depois_de cita passo que vem depois", lambda r, c: passo(r, 1).update(depois_de="4"), "CHK-REL-ORDEM", "DEPENDENCIA_PARA_FRENTE"),
    ("depois_de cita ordem maior que a própria", lambda r, c: passo(r, 4).update(depois_de="9, 4"), "CHK-REL-ORDEM", "DEPENDENCIA_PARA_FRENTE"),
    ("depois_de cita passo que não existe", lambda r, c: passo(r, 3).update(ordem=5), "CHK-REL-ORDEM", "DEPENDENCIA_INEXISTENTE"),
    ("depois_de mal escrito com 'e'", lambda r, c: passo(r, 4).update(depois_de="2 e 3"), "CHK-REL-ORDEM", "DEPENDENCIA_MAL_ESCRITA"),
    ("depois_de 'nada' junto com número", lambda r, c: passo(r, 4).update(depois_de="nada, 2"), "CHK-REL-ORDEM", "DEPENDENCIA_MAL_ESCRITA"),
    ("depois_de número gigante", lambda r, c: passo(r, 4).update(depois_de="9" * 5000), "CHK-REL-ORDEM", "DEPENDENCIA_MAL_ESCRITA"),
    # --- código interno
    ("id de agente no passo", lambda r, c: com_texto(r, "proximos_passos", 1, "passo", "Ler o parecer (AGT-06) antes de agir."), "CHK-REL-SEM-CODIGO", "CODIGO_INTERNO"),
    ("etapa 'E4' na frase", lambda r, c: com_texto(r, "resumo", 3, "frase", "A etapa E4 pede um advogado antes de passar de 10 pessoas."), "CHK-REL-SEM-CODIGO", "CODIGO_INTERNO"),
    ("nome de máquina na frase", lambda r, c: com_texto(r, "resumo", 1, "frase", "O card está em EM_ANDAMENTO."), "CHK-REL-SEM-CODIGO", "CODIGO_INTERNO"),
    ("código com caractere invisível no meio", lambda r, c: com_texto(r, "resumo", 1, "frase", "O parecer da CL​ARA foi aprovado."), "CHK-REL-SEM-CODIGO", "CODIGO_INTERNO"),
    ("apelido de modelo", lambda r, c: com_texto(r, "resumo", 1, "frase", "Foi feito pela revisao-padrao."), "CHK-REL-SEM-CODIGO", "CODIGO_INTERNO"),
    # --- otimismo
    ("'tudo certo' em maiúsculas", lambda r, c: com_texto(r, "resumo", 1, "frase", "ESTÁ TUDO CERTO com o convite."), "CHK-REL-SEM-OTIMISMO", "FRASE_DE_GARANTIA"),
    ("'sem pendências' sem acento", lambda r, c: com_texto(r, "resumo", 1, "frase", "O card ficou sem pendencias."), "CHK-REL-SEM-OTIMISMO", "FRASE_DE_GARANTIA"),
    ("'100% seguro' no passo", lambda r, c: com_texto(r, "proximos_passos", 1, "passo", "Ler o parecer: o convite é 100% seguro."), "CHK-REL-SEM-OTIMISMO", "FRASE_DE_GARANTIA"),
    ("'risco zero' com hífen", lambda r, c: com_texto(r, "resumo", 1, "frase", "O convite tem risco-zero."), "CHK-REL-SEM-OTIMISMO", "FRASE_DE_GARANTIA"),
    # --- pacote da empresa
    ("termo do pacote em maiúsculas", lambda r, c: com_texto(r, "resumo", 1, "frase", "O grupo vira RENDA GARANTIDA para a empresa."), "CHK-REL-PACOTE", "TERMO_PROIBIDO_PELO_PACOTE"),
    ("termo do pacote sem acento", lambda r, c: com_texto(r, "proximos_passos", 1, "passo", "Ler o parecer: não é dinheiro facil."), "CHK-REL-PACOTE", "TERMO_PROIBIDO_PELO_PACOTE"),
    ("termo novo na lista do pacote", lambda r, c: (c["pacote_da_empresa"]["termos_proibidos_em_todo_texto"].append("parecer jurídico"),), "CHK-REL-PACOTE", "TERMO_PROIBIDO_PELO_PACOTE"),
    ("pacote sem a lista de termos", lambda r, c: c["pacote_da_empresa"].pop("termos_proibidos_em_todo_texto"), "CHK-REL-PACOTE", "PACOTE_SEM_LISTA"),
    # --- refs
    ("linha sem refs", lambda r, c: com_texto(r, "resumo", 1, "refs", ""), "CHK-REL-REFS", "SEM_REFS"),
    ("ref ao próprio relatório", lambda r, c: com_texto(r, "resumo", 1, "refs", "E2, E5"), "CHK-REL-REFS", "REF_AO_PROPRIO_RELATORIO"),
    ("ref em minúsculas", lambda r, c: com_texto(r, "resumo", 1, "refs", "e2, E3"), "CHK-REL-REFS", "REF_DESCONHECIDA"),
    ("ref separada por ponto e vírgula", lambda r, c: com_texto(r, "resumo", 1, "refs", "E2; E3"), "CHK-REL-REFS", "REF_DESCONHECIDA"),
    ("vírgula sobrando nas refs", lambda r, c: com_texto(r, "resumo", 1, "refs", "E2,, E3"), "CHK-REL-REFS", "REF_VAZIA"),
    ("AF que o plano não deu", lambda r, c: com_texto(r, "proximos_passos", 3, "refs", "AF-INVENTADO, E3"), "CHK-REL-REFS", "ACAO_DO_FUNDADOR_INEXISTENTE"),
    ("PF que o código não montou", lambda r, c: com_texto(r, "proximos_passos", 2, "refs", "PF-99, E4"), "CHK-REL-REFS", "PASSO_FIXO_INEXISTENTE"),
    ("PF tirado da lista montada", lambda r, c: montada(c).update(so_voce_faz=[x for x in montada(c)["so_voce_faz"] if x["id"] != "PF-01"]), "CHK-REL-REFS", "PASSO_FIXO_INEXISTENTE"),
    ("etapa do plano sem entrega aprovada", lambda r, c: pacote(c)["entregas_aprovadas"].pop("E3"), "CHK-REL-REFS", "ETAPA_NAO_APROVADA"),
    ("etapa com entrega sem versão aprovada", lambda r, c: pacote(c)["entregas_aprovadas"]["E3"].pop("versao_aprovada"), "CHK-REL-REFS", "ETAPA_NAO_APROVADA"),
    ("AF de etapa que não foi aprovada", lambda r, c: pacote(c)["entregas_aprovadas"].pop("E2"), "CHK-REL-REFS", "ACAO_DO_FUNDADOR_INEXISTENTE"),
    ("mesmo AF em duas etapas e só o AF na linha",
     lambda r, c: (etapas_do_plano(c)[0].update(acao_do_fundador="AF-COPY-ENVIAR-OU-PUBLICAR"), com_texto(r, "proximos_passos", 3, "refs", "AF-COPY-ENVIAR-OU-PUBLICAR")),
     "CHK-REL-REFS", "ACAO_EM_VARIAS_ETAPAS"),
    ("pacote sem as etapas do plano", lambda r, c: c["pedido"]["card"]["plano"].pop("etapas"), "CHK-REL-REFS", "PACOTE_INCOMPLETO"),
    ("pacote sem a parte montada pelo código", lambda r, c: pacote(c).pop("parte_montada_pelo_codigo"), "CHK-REL-REFS", "PACOTE_INCOMPLETO"),
    # --- números
    ("número que só existe em outra etapa", lambda r, c: com_texto(r, "resumo", 3, "refs", "E2"), "CHK-REL-NUMEROS", "NUMERO_FORA_DAS_FONTES"),
    ("ponto decimal em vez de vírgula", lambda r, c: com_texto(r, "resumo", 0, "frase", "O cenário base usa 0.5 dólar por hora."), "CHK-REL-NUMEROS", "NUMERO_FORA_DO_FORMATO"),
    ("0,50 não vira 50", lambda r, c: (pacote(c)["entregas_aprovadas"]["E1"].update(trechos={"formula": "US$ 50 por hora"}), com_texto(r, "resumo", 0, "frase", "A plataforma paga US$ 0,50 por hora.")), "CHK-REL-NUMEROS", "NUMERO_FORA_DAS_FONTES"),
    ("número da ação do fundador sem citar a ação", lambda r, c: (montada(c)["so_voce_faz"][1].update(texto="Enviar o texto a 77 pessoas."), com_texto(r, "proximos_passos", 3, "passo", "Enviar o convite a 77 pessoas."), com_texto(r, "proximos_passos", 3, "refs", "E3, AF-TREINAMENTO-ENVIAR")), "CHK-REL-NUMEROS", "NUMERO_FORA_DAS_FONTES"),
    ("pacote sem o pedido", lambda r, c: c["pedido"]["card"].pop("ordem_de_servico"), "CHK-REL-NUMEROS", "PACOTE_INCOMPLETO"),
    # --- risco, pergunta e item sem conferir no resumo
    ("resumo sem a etapa do risco alto", lambda r, c: [l.update(refs=l["refs"].replace("E4", "E3")) for l in r["entrega"]["resumo"]], "CHK-REL-RISCO-ALTO-NO-RESUMO", "ETAPA_FORA_DO_RESUMO"),
    ("resumo sem a etapa do item sem conferir", lambda r, c: [l.update(refs=l["refs"].replace("E2", "E3")) for l in r["entrega"]["resumo"]], "CHK-REL-RISCO-ALTO-NO-RESUMO", "ETAPA_FORA_DO_RESUMO"),
    ("nova pergunta aberta numa etapa fora do resumo", lambda r, c: montada(c)["perguntas_abertas"].append({"etapa": "E3", "texto": "Qual o tom do convite?"}) or [l.update(refs=l["refs"].replace("E3", "E2")) for l in r["entrega"]["resumo"]], "CHK-REL-RISCO-ALTO-NO-RESUMO", "ETAPA_FORA_DO_RESUMO"),
    ("risco alto novo numa etapa fora do resumo", lambda r, c: montada(c)["riscos"].append({"etapa": "E3", "risco": "ALTO", "texto": "Convite promete demais."}) or [l.update(refs=l["refs"].replace("E3", "E2")) for l in r["entrega"]["resumo"]], "CHK-REL-RISCO-ALTO-NO-RESUMO", "ETAPA_FORA_DO_RESUMO"),
    ("etapa citada só nos próximos passos", lambda r, c: [l.update(refs=l["refs"].replace("E1", "E3")) for l in r["entrega"]["resumo"]], "CHK-REL-RISCO-ALTO-NO-RESUMO", "ETAPA_FORA_DO_RESUMO"),
    # --- ação de fora
    ("ação de fora sem AF nem PF", lambda r, c: com_texto(r, "proximos_passos", 4, "refs", "E2"), "CHK-REL-SEM-ACAO-NOVA", "ACAO_NOVA"),
    ("ação de fora no resumo", lambda r, c: com_texto(r, "resumo", 1, "frase", "A Helena vai divulgar o convite hoje."), "CHK-REL-SEM-ACAO-NOVA", "ACAO_NOVA"),
    ("ação de fora com AF de etapa não aprovada", lambda r, c: pacote(c)["entregas_aprovadas"].pop("E3"), "CHK-REL-SEM-ACAO-NOVA", "ACAO_NOVA"),
    ("ação de fora só com PEDIDO nas refs", lambda r, c: com_texto(r, "proximos_passos", 3, "refs", "PEDIDO, E3"), "CHK-REL-SEM-ACAO-NOVA", "ACAO_NOVA"),
    ("verbo novo na lista da especificação", lambda r, c: (c["modelo"]["parametros_das_checagens"]["CHK-REL-SEM-ACAO-NOVA"]["verbos_regex"].append(r"\bler\b"), ), "CHK-REL-SEM-ACAO-NOVA", "ACAO_NOVA"),
]


@pytest.mark.parametrize("nome,mudar,chk,motivo", MUDANCAS_QUE_FALHAM, ids=[m[0] for m in MUDANCAS_QUE_FALHAM])
def test_a_checagem_pega_o_motivo(nome, mudar, chk, motivo):
    r, c = base()
    mudar(r, c)
    rel = roda(r, c)
    assert motivo in motivos(rel, chk), f"{chk} deveria acusar {motivo}; viu {sorted(motivos(rel, chk))}; falhas de tudo: {sorted({(f.id, f.motivo) for f in rel.falhas})}"
    assert all(f.gravidade == "RECUSA" for f in rel.falhas_de(chk))


# ---------------------------------------------------------------------------------------
# Mudanças honestas, que a checagem NÃO pode recusar: (nome, mudança, checagem)
# ---------------------------------------------------------------------------------------
MUDANCAS_QUE_PASSAM = [
    ("frase exatamente no limite", lambda r, c: com_texto(r, "resumo", 1, "frase", ("Texto curto " * 40)[:FRASE_MAX]), "CHK-REL-TAMANHO-DAS-LINHAS"),
    ("passo exatamente no limite", lambda r, c: com_texto(r, "proximos_passos", 1, "passo", ("Texto curto " * 40)[:PASSO_MAX]), "CHK-REL-TAMANHO-DAS-LINHAS"),
    ("ordem escrita como texto", lambda r, c: passo(r, 2).update(ordem="3"), "CHK-REL-ORDEM"),
    ("depois_de com duas ordens anteriores", lambda r, c: passo(r, 4).update(depois_de="2, 3"), "CHK-REL-ORDEM"),
    ("depois_de 'Nada' com maiúscula", lambda r, c: passo(r, 1).update(depois_de=" Nada "), "CHK-REL-ORDEM"),
    ("nome próprio com só a primeira letra maiúscula", lambda r, c: com_texto(r, "resumo", 1, "frase", "A Clara aprovou o parecer."), "CHK-REL-SEM-CODIGO"),
    ("código na coluna refs não conta", lambda r, c: com_texto(r, "resumo", 1, "refs", "E2, E3, PEDIDO"), "CHK-REL-SEM-CODIGO"),
    ("a frase certa, sem garantia", lambda r, c: com_texto(r, "resumo", 1, "frase", "Nenhum furo conhecido em aberto no convite."), "CHK-REL-SEM-OTIMISMO"),
    ("parte de um termo não vale", lambda r, c: com_texto(r, "resumo", 1, "frase", "Está tudo certos com o convite."), "CHK-REL-SEM-OTIMISMO"),
    ("termo parecido mas fora da lista do pacote", lambda r, c: com_texto(r, "resumo", 1, "frase", "A renda extra não faz parte do convite."), "CHK-REL-PACOTE"),
    ("lista do pacote vazia", lambda r, c: c["pacote_da_empresa"].update(termos_proibidos_em_todo_texto=[]), "CHK-REL-PACOTE"),
    ("número normalizado (0,5 = 0,50)", lambda r, c: com_texto(r, "resumo", 0, "frase", "A plataforma paga US$ 0,5 por hora aprovada."), "CHK-REL-NUMEROS"),
    ("milhar com ponto (2.500 = 2500)",
     lambda r, c: (pacote(c)["entregas_aprovadas"]["E1"]["trechos"].update(total="Meta de 2500 participantes."), com_texto(r, "resumo", 0, "frase", "A meta é de 2.500 participantes.")),
     "CHK-REL-NUMEROS"),
    ("número escrito com vírgula e milhar", lambda r, c: (pacote(c)["entregas_aprovadas"]["E1"]["trechos"].update(total="Total de 1.234,5 horas."), com_texto(r, "resumo", 0, "frase", "O total é de 1.234,5 horas.")), "CHK-REL-NUMEROS"),
    ("número que vem do campo valor da entrega", lambda r, c: (pacote(c)["entregas_aprovadas"]["E1"]["trechos"].update(horas={"valor": "8,25", "unidade": "horas", "origem": "PREMISSA"}), com_texto(r, "resumo", 0, "frase", "Foram 8,25 horas.")), "CHK-REL-NUMEROS"),
    ("número do pedido citando PEDIDO", lambda r, c: (com_texto(r, "resumo", 1, "frase", "Você pediu o plano dos 7 dias."), com_texto(r, "resumo", 1, "refs", "PEDIDO")), "CHK-REL-NUMEROS"),
    ("número do texto fixo do passo fixo", lambda r, c: (montada(c)["so_voce_faz"][0].update(texto="Cadastrar a empresa em 2 plataformas."), com_texto(r, "proximos_passos", 2, "passo", "Cadastrar a empresa em 2 plataformas, como manda o passo fixo.")), "CHK-REL-NUMEROS"),
    ("número da ação do fundador citada", lambda r, c: (montada(c)["so_voce_faz"][1].update(texto="Enviar o texto a 77 pessoas."), com_texto(r, "proximos_passos", 3, "passo", "Enviar o convite a 77 pessoas.")), "CHK-REL-NUMEROS"),
    ("etapa de risco baixo e sem pergunta não obriga", lambda r, c: (montada(c)["riscos"].append({"etapa": "E3", "risco": "BAIXO", "texto": "Tom do convite."}), [l.update(refs=l["refs"].replace("E3", "E2")) for l in r["entrega"]["resumo"]]), "CHK-REL-RISCO-ALTO-NO-RESUMO"),
    ("a etapa pode vir em qualquer linha do resumo", lambda r, c: com_texto(r, "resumo", 4, "refs", "E2, E4, E1"), "CHK-REL-RISCO-ALTO-NO-RESUMO"),
    ("ação de fora em maiúsculas com AF nas refs", lambda r, c: com_texto(r, "proximos_passos", 4, "passo", "ENVIAR o roteiro a quem aceitar."), "CHK-REL-SEM-ACAO-NOVA"),
    ("'paga' e 'convite' não são verbos de ação", lambda r, c: com_texto(r, "resumo", 1, "frase", "Há indicação paga a participante e um convite aprovado."), "CHK-REL-SEM-ACAO-NOVA"),
    ("'Eu já enviei' é da CHK-COMUM-05, não desta", lambda r, c: com_texto(r, "proximos_passos", 3, "passo", "Eu já enviei o convite."), "CHK-REL-SEM-ACAO-NOVA"),
    ("mesmo AF em duas etapas com a etapa na linha", lambda r, c: etapas_do_plano(c)[0].update(acao_do_fundador="AF-COPY-ENVIAR-OU-PUBLICAR"), "CHK-REL-REFS"),
    ("ref repetida", lambda r, c: com_texto(r, "resumo", 1, "refs", "E2, E2, E3"), "CHK-REL-REFS"),
]


@pytest.mark.parametrize("nome,mudar,chk", MUDANCAS_QUE_PASSAM, ids=[m[0] for m in MUDANCAS_QUE_PASSAM])
def test_a_checagem_nao_recusa_o_que_e_honesto(nome, mudar, chk):
    r, c = base()
    mudar(r, c)
    rel = roda(r, c)
    assert not rel.falhas_de(chk), f"{chk} não deveria acusar nada, mas acusou: {[(f.motivo, f.item, f.mensagem) for f in rel.falhas_de(chk)]}"


# ---------------------------------------------------------------------------------------
# Falha fechada: parâmetro que falta para o validador; pacote malformado também
# ---------------------------------------------------------------------------------------
PRECISAM_DE_PARAMETROS = [i for i in IDS_DO_RELATORIO if PARAMETROS[i]]


@pytest.mark.parametrize("chk", PRECISAM_DE_PARAMETROS)
def test_sem_o_parametros_da_especificacao_o_validador_para(chk):
    r, c = base()
    del c["modelo"]["parametros_das_checagens"][chk]
    with pytest.raises(ErroDeContexto, match=chk):
        roda(r, c)


@pytest.mark.parametrize("nome,estragar_o_pacote", [
    ("riscos que não é lista", lambda c: montada(c).update(riscos="alto")),
    ("risco sem a etapa", lambda c: montada(c).update(riscos=[{"risco": "ALTO", "texto": "x"}])),
    ("entrega aprovada que não é objeto", lambda c: pacote(c)["entregas_aprovadas"].update(E1="aprovada")),
    ("etapas do plano que não são objetos", lambda c: c["pedido"]["card"]["plano"].update(etapas=["E1", "E2"])),
    ("etapa do relatório que não é texto", lambda c: c["pedido"].update(etapa_do_relatorio=5)),
    ("pedido que não é objeto", lambda c: c.update(pedido="texto")),
], ids=["riscos-nao-e-lista", "risco-sem-etapa", "entrega-nao-e-objeto", "etapas-nao-sao-objetos", "etapa-do-relatorio-nao-e-texto", "pedido-nao-e-objeto"])
def test_pacote_malformado_e_erro_de_quem_montou_o_contexto(nome, estragar_o_pacote):
    r, c = base()
    estragar_o_pacote(c)
    with pytest.raises(ErroDeContexto):
        roda(r, c)


def test_padrao_invalido_na_especificacao_para_o_validador():
    r, c = base()
    c["modelo"]["parametros_das_checagens"]["CHK-REL-SEM-CODIGO"]["padroes"] = ["(aberto"]
    with pytest.raises(ErroDeContexto, match="CHK-REL-SEM-CODIGO"):
        roda(r, c)


# ---------------------------------------------------------------------------------------
# Quando a checagem NÃO se aplica
# ---------------------------------------------------------------------------------------
def test_registrar_falha_nao_se_aplica():
    resposta, contexto = montar_entrada(SPEC, CASOS["REL-BOA-04"])
    rel = validar(resposta, contexto)
    status = {c.id: c.status for c in rel.checagens}
    assert {status[i] for i in IDS_DO_RELATORIO} == {"NAO_SE_APLICA"}


def test_em_outro_tipo_de_entrega_nao_se_aplica():
    r, c = base()
    c["modelo"]["tipo"] = "copy"
    rel = roda(r, c)
    assert {x.status for x in rel.checagens if x.id in IDS_DO_RELATORIO} == {"NAO_SE_APLICA"}


def test_formato_errado_nao_se_aplica_e_quem_recusa_e_a_acao():
    r, c = base()
    rel = validar(json.dumps(r, ensure_ascii=False) + " texto solto depois", c)
    assert {x.status for x in rel.checagens if x.id in IDS_DO_RELATORIO} == {"NAO_SE_APLICA"}
    assert rel.veredito == "RECUSADA"


# ---------------------------------------------------------------------------------------
# Desligar a checagem deixa o defeito da especificação escapar dela
# ---------------------------------------------------------------------------------------
DEFEITOS_DA_SPEC = [(c.id, i) for c in CASOS.values() if not c.bom for i in c.deve_falhar_em if i in IDS_DO_RELATORIO]


def test_cada_checagem_do_relatorio_tem_defeito_da_especificacao():
    assert {i for _, i in DEFEITOS_DA_SPEC} == set(IDS_DO_RELATORIO)


@pytest.mark.parametrize("caso_id,chk", DEFEITOS_DA_SPEC, ids=[f"{c}:{i}" for c, i in DEFEITOS_DA_SPEC])
def test_desligada_a_checagem_o_defeito_dela_escapa(caso_id, chk, monkeypatch):
    caso = CASOS[caso_id]
    assert prova.pegou(SPEC, prova.avaliar(SPEC, caso), chk), "antes de desligar, a checagem deveria pegar o defeito"
    monkeypatch.setitem(CHECAGENS, chk, dataclasses.replace(CHECAGENS[chk], funcao=lambda exe: []))
    assert not prova.pegou(SPEC, prova.avaliar(SPEC, caso), chk)


# ---------------------------------------------------------------------------------------
# Lixo dentro do relatório ou do pacote nunca derruba o validador (nem vira "erro interno da checagem")
# ---------------------------------------------------------------------------------------
def _internos(rel):
    return [(f.id, f.trecho) for f in rel.falhas if f.motivo == "ERRO_INTERNO_DA_CHECAGEM"]


def test_resposta_estragada_nunca_gera_erro_interno():
    rng = random.Random("relatorio-resposta")
    for _ in range(100):
        r, c = base()
        estragar(r, rng)
        rel = roda(r, c)
        assert not _internos(rel), (_internos(rel), json.dumps(r, ensure_ascii=False)[:400])


def test_pacote_estragado_so_levanta_erro_de_contexto():
    rng = random.Random("relatorio-pacote")
    for _ in range(100):
        r, c = base()
        sobra = {k: copy.deepcopy(c[k]) for k in ("pedido", "pacote_da_empresa")}
        estragar(sobra, rng)
        for k in ("pedido", "pacote_da_empresa"):
            if k in sobra:
                c[k] = sobra[k]
            else:
                c.pop(k)
        try:
            rel = roda(r, c)
        except ErroDeContexto:
            continue
        assert not _internos(rel), (_internos(rel), json.dumps(c["pedido"], ensure_ascii=False, default=str)[:400])


def test_numeros_e_refs_gigantes_nao_travam():
    r, c = base()
    com_texto(r, "resumo", 1, "frase", "Foram " + "9" * 20000 + " pessoas e " + "1.234," * 3000 + "5 horas.")
    com_texto(r, "resumo", 1, "refs", ",".join(["E2"] * 20000))
    rel = roda(r, c)
    assert not _internos(rel)
    assert "NUMERO_FORA_DO_FORMATO" in motivos(rel, "CHK-REL-NUMEROS") or "NUMERO_FORA_DAS_FONTES" in motivos(rel, "CHK-REL-NUMEROS")
