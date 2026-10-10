# -*- coding: utf-8 -*-
"""Testes da máquina de passagens.

1. A tabela real passa na prova (camadas 1, 2 e 3), em menos de 60 s, sem violação conhecida.
2. TESTES DE MUTAÇÃO: cada mutação planta um defeito na tabela (ou no vocabulário) e o
   teste exige que a prova acuse a regra certa. Uma prova que deixa passar um defeito
   plantado não vale (mesmo princípio do validador no plano v3). Cada furo apontado pelos
   atacantes tem pelo menos uma mutação que o reabre e precisa ser pega.
3. Jornadas: replay() reproduz eventos com papel e devolve estado final e violações. Os
   cenários dos atacantes viraram jornadas fixas.
4. Os 21 agentes, um por um, de ponta a ponta.

Rodar: cd helena-v2 && python -m pytest -q maquina/test_maquina.py
"""
import copy
import sys
from pathlib import Path

import jsonschema
import pytest
import yaml

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
import provar as P  # noqa: E402

VOCAB = yaml.safe_load((AQUI / "vocabulario.yaml").read_text(encoding="utf-8"))
TABELA = yaml.safe_load((AQUI / "passagens.yaml").read_text(encoding="utf-8"))


def linha(t, maquina, rid):
    for ln in t["linhas"][maquina]:
        if ln["id"] == rid:
            return ln
    raise KeyError(rid)


def tira_linha(t, maquina, rid):
    antes = len(t["linhas"][maquina])
    t["linhas"][maquina] = [ln for ln in t["linhas"][maquina] if ln["id"] != rid]
    assert len(t["linhas"][maquina]) == antes - 1, rid


# ----------------------------------------------------------------------------- tabela real
def test_tabela_real_passa_na_prova():
    rel, med = P.provar(copy.deepcopy(VOCAB), copy.deepcopy(TABELA), usar_cache=True)
    assert rel.vazio(), [f"[{i['regra']}] {i['mensagem']}" for i in rel.lista()]
    assert med["tempo_total"] < 60, f"prova levou {med['tempo_total']:.1f} s"
    c1 = med["camada1"]
    assert all(v["estados"] > 0 and v["transicoes"] > 0 for v in c1.values())
    assert all(v["reproduzidos"] > 0 for v in c1.values()), "regra 13: a amostra do histórico precisa ser reproduzida"
    c2 = med["camada2"]
    assert c2["finais"].get("PRONTO", 0) > 0, "o card precisa conseguir ficar pronto"
    assert c2["finais"].get("CANCELADO", 0) > 0 and c2["finais"].get("ENCERRADO_COM_FALHA", 0) > 0
    assert c2["vivacidade"] > 0, "a conferência 'tudo aprovado chega a PRONTO' precisa ter o que conferir"
    assert c2["prazo"] > 0 and c2["independentes"], "o prazo do card precisa ser conferido à parte"


def test_vocabulario_e_fonte_unica_dos_nomes():
    eventos = {(papel, ev) for papel, evs in VOCAB["acoes"].items() for ev in evs}
    for maquina, linhas in TABELA["linhas"].items():
        estados = set(VOCAB["maquinas"][maquina]["abertos"]) | set(VOCAB["maquinas"][maquina]["finais"])
        assert set(TABELA["estados"][maquina]) == estados
        for ln in linhas:
            assert (ln["papel"], ln["evento"]) in eventos, ln["id"]
            des = ln["de"] if isinstance(ln["de"], list) else [ln["de"]]
            assert all(d in estados for d in des), ln["id"]
            assert ln["para"] == "MESMO" or ln["para"] in estados, ln["id"]
    # sub-card existe no vocabulário, desligado, e nenhuma linha o aceita (MEL-24)
    assert VOCAB["acoes"]["AUTOR"]["PEDIR_SUBCARD"].get("desligado")
    assert not any(ln["evento"] == "PEDIR_SUBCARD" for lns in TABELA["linhas"].values() for ln in lns)


def test_os_21_agentes_e_o_dominio_do_revisor_vem_deles():
    agentes = VOCAB["identidades"]["agentes"]
    assert len(agentes) == 21 and len(set(agentes)) == 21 and agentes[0] == "HELENA"
    for personagem in ("SIRLENE", "DOUTOR_VITAL", "ALEX", "RAFAEL"):   # personagens do produto eLiving™, nunca funcionários
        assert personagem not in agentes
    maqs = P.montar(VOCAB, TABELA)
    assert set(maqs["etapa"].dominio["revisor"]) == set(agentes) | {"FUNDADOR", "NENHUM"}
    assert set(maqs["etapa"].parametros[("MOTOR", "PORTAO1_OK")]["escolhido"]) == set(agentes) | {"FUNDADOR"}


def test_efeito_que_copia_parametro_recusa_valor_fora_do_dominio():
    # furo 4: mesmo com a guarda dizendo 'válido', o banco nunca grava um revisor fora de identidades
    maqs = P.montar(VOCAB, TABELA)
    me = maqs["etapa"]
    s = list(me.inicial())
    s[0] = "VALIDACAO"
    cfg = P.perfis_do_roteiro(P.ROTEIRO_DE_PROVA, TABELA, VOCAB)[0]["cfg"]
    q = dict(cfg, estado_card="EM_ANDAMENTO", revisor_valido=True)
    assert me.casar(tuple(s), "MOTOR", "PORTAO1_OK", dict(q, escolhido="LUCAS")) == []
    assert [l.id for l in me.casar(tuple(s), "MOTOR", "PORTAO1_OK", dict(q, escolhido="BRUNO"))] == ["E40"]


def test_todo_estado_aberto_tem_dono_e_prazo_escritos_uma_vez():
    for maquina, ests in TABELA["estados"].items():
        for nome, d in ests.items():
            if d.get("final"):
                continue
            assert d.get("dono") in VOCAB["papeis"], (maquina, nome)
            assert d.get("prazo") in TABELA["prazos"], (maquina, nome)
    for nome, pz in TABELA["prazos"].items():
        assert pz["no_prazo"].get("evento"), f"prazo {nome} sem evento: 'na hora' também precisa de consequência"


def test_impressao_digital_muda_com_a_tabela():
    t2 = copy.deepcopy(TABELA)
    t2["tetos"]["TETO_EXECUCOES"]["valor"] = 7
    assert P.impressao_digital(VOCAB, TABELA) != P.impressao_digital(VOCAB, t2)


def test_ordem_sua_no_teto_nunca_vira_comentario():
    """Para todo estado de espera e toda ordem sua (pedir ajuste, refazer, esperar, modelo menor,
    confirmar de novo): se ela é aceita abaixo do teto de ordens, NO teto também há linha."""
    maqs = P.montar(VOCAB, TABELA)
    me, mc = maqs["etapa"], maqs["card"]
    pf = P.perfis_do_roteiro(P.ROTEIRO_DE_PROVA, TABELA, VOCAB)[2]   # EJ: julgadora, para cobrir os pareceres
    ordens = [("PEDIR_AJUSTE", {"motivo_ajuste": "TOM"})] + [("RESPONDER", {"opcao": o}) for o in ("REFAZER", "ESPERAR", "MODELO_MENOR", "CONFIRMO")]
    conferidos = 0
    for m, estados, motivos in ((me, ["ESPERANDO_FUNDADOR", "APROVADA"], me.dominio["motivo"]),
                                (mc, ["ESPERANDO_FUNDADOR", "ESPERANDO_CONFIRMACAO"], mc.dominio["motivo"])):
        for est in estados:
            for mot in motivos:
                for evento, params in ordens:
                    s = list(m.inicial())
                    s[0], s[m.idx["motivo"]] = est, mot
                    if m is me:
                        s[m.idx["espera"]] = "INTERNA"
                    q = dict(pf["cfg"], estado_card="EM_ANDAMENTO", anteriores_satisfeitas=True, **params) if m is me else dict(params)
                    abaixo = m.casar(tuple(s), "FUNDADOR", evento, q)
                    s[m.idx["ordens"]] = m.teto_var["ordens"]
                    no_teto = m.casar(tuple(s), "FUNDADOR", evento, q)
                    if abaixo:
                        conferidos += 1
                        assert no_teto, f"{m.nome}.{est}/{mot}: {evento} {params} vira comentário no teto de ordens"
    assert conferidos >= 6


# ----------------------------------------------------------------------------- mutações
def m_remover_dono(v, t):
    del t["estados"]["etapa"]["REVISAO"]["dono"]


def m_remover_prazo(v, t):
    del t["estados"]["card"]["EM_ANDAMENTO"]["prazo"]


def m_saida_de_um_final(v, t):
    t["linhas"]["etapa"].append({"id": "M03", "de": "PRONTA", "evento": "PEDIR_AJUSTE", "papel": "FUNDADOR",
                                 "efeito": {}, "para": "NA_FILA"})


def m_revisor_pode_ser_o_autor(v, t):
    t["designacao_de_revisor"]["excluir"].remove("AUTOR_DA_ETAPA")


def m_revisor_nao_designado_responde(v, t):
    t["regras_gerais"]["respostas_de_revisor_exigem_revisor_designado"] = False


def m_sem_teto_de_reprovacao(v, t):
    linha(t, "etapa", "E57")["guarda"] = "exec_viva == 1"


def m_laco_infinito_de_reprovacao(v, t):
    ln = linha(t, "etapa", "E57")
    ln["guarda"] = "exec_viva == 1"
    ln["efeito"] = {"execucoes": 0, "exec_viva": 0, "leu_internet": 0, "motivo": "NORMAL", "semaforo": "NENHUM", "revisor": "NENHUM"}


def m_padrao_do_relogio_aprova(v, t):
    e91 = linha(t, "etapa", "E91")
    e91["guarda"] = "motivo != 'REVISAO' and (" + e91["guarda"] + ")"
    t["linhas"]["etapa"].append({"id": "M08", "de": "ESPERANDO_FUNDADOR", "evento": "PRAZO_ESPERA_VENCIDO", "papel": "RELOGIO",
                                 "guarda": "motivo == 'REVISAO' and lembretes >= TETO_LEMBRETES", "efeito": {}, "para": "APROVADA"})


def m_pronto_depois_de_decisao_mudou(v, t):
    ln = linha(t, "etapa", "E115")
    ln["efeito"] = {}
    ln["para"] = "MESMO"
    ln.pop("sinais", None)


def m_agente_executa_acao_externa(v, t):
    linha(t, "acao_externa", "X10")["papel"] = "AUTOR"


def m_acao_de_ia_com_efeito_externo(v, t):
    v["acoes"]["AUTOR"]["PUBLICAR"] = {"efeito": "externo", "parametros": {}}


def m_quem_leu_internet_pergunta(v, t):
    linha(t, "etapa", "E21")["guarda"] = "permite_perguntar and perguntas < TETO_PERGUNTAS and not prazo_de_terceiro"


def m_resposta_antiga_grava(v, t):
    t["regras_gerais"]["respostas_de_agente_exigem_chave_atual"] = []


def m_duas_execucoes_vivas(v, t):
    t["linhas"]["etapa"].append({"id": "M14", "de": "EXECUTANDO", "evento": "INICIAR_EXECUCAO", "papel": "MOTOR",
                                 "efeito": {}, "para": "MESMO"})


def m_helena_muda_prazo(v, t):
    for r in t["reacoes"]:
        if r["evento"] == "SUGERIR_PRAZO":
            r["muda_campo"] = "prazo"


def m_falha_de_infra_gasta_tentativa(v, t):
    linha(t, "etapa", "E31")["efeito"]["execucoes"] = "+1"


def m_falha_de_infra_sem_teto(v, t):
    linha(t, "etapa", "E31")["guarda"] = "classe in ('PROVEDOR', 'QUEDA', 'FERRAMENTA')"


def m_ajuste_nao_volta_ao_autor(v, t):
    linha(t, "etapa", "E111")["para"] = "REVISAO"


def m_dependente_anda_com_anterior_falhada(v, t):
    t["predicados"]["satisfaz_dependencia"].append("FALHOU")


def m_card_pronto_com_etapa_cancelada(v, t):
    t["predicados"]["conta_como_pronta"].append("FALHOU")


def m_cancelamento_nao_chega_em_resolucao(v, t):
    tira_linha(t, "etapa", "E104")


def m_subcard_ligado(v, t):
    t["linhas"]["etapa"].append({"id": "M22", "de": "EXECUTANDO", "evento": "PEDIR_SUBCARD", "papel": "AUTOR",
                                 "efeito": {"execucoes": "+1", "exec_viva": 0}, "para": "EM_RESOLUCAO"})


def m_toque_sem_destino(v, t):
    del t["recusa_do_fundador"]


def m_duas_linhas_para_o_mesmo_evento(v, t):
    copia = copy.deepcopy(linha(t, "etapa", "E54"))
    copia["id"] = "M24"
    t["linhas"]["etapa"].append(copia)


def m_plano_invalido_deixa_etapas_andarem(v, t):
    linha(t, "card", "C11")["para"] = "ESPERANDO_FUNDADOR"


def m_sem_teto_de_6_execucoes(v, t):
    linha(t, "etapa", "E10")["guarda"] = "motivo == 'NORMAL'"


# --- furo 1 e 15: pergunta do card que perdeu o objeto
def m_sem_motivo_resolvido(v, t):
    tira_linha(t, "card", "C27")


# --- furo 2: a trava 'etapa só anda com o card ativo' mora na tabela
def m_sem_trava_de_card_ativo(v, t):
    del t["regras_gerais"]["etapa_so_anda_com_card_ativo"]


def m_card_ativo_inclui_validando_plano(v, t):
    t["regras_gerais"]["etapa_so_anda_com_card_ativo"]["card_ativo"].append("VALIDANDO_PLANO")


# --- furos 3 e 9: ação externa só nasce do card pronto, uma por etapa
def m_acao_nasce_na_entrega(v, t):
    linha(t, "etapa", "E20")["sinais"] = [{"sinal": "CRIAR_ACAO_EXTERNA", "se": "acao_externa != 'NENHUMA'"}]


def m_acao_nasce_na_aprovacao(v, t):
    linha(t, "etapa", "E54")["sinais"] = ["CRIAR_ACAO_EXTERNA"]


def m_incerta_vira_falhou(v, t):
    linha(t, "acao_externa", "X34")["para"] = "FALHOU"


# --- furo 4: revisor fora do vocabulário / nunca explorado
def m_dominio_do_revisor_escrito_a_mao(v, t):
    t["variaveis"]["etapa"]["revisor"] = {"dominio": ["NENHUM", "HELENA", "CAIO", "ISABELA", "CLARA", "RAVI", "FUNDADOR", "LUCAS"],
                                          "inicial": "NENHUM"}


def m_revisor_valido_nunca_designado(v, t):
    linha(t, "etapa", "E40")["guarda"] = "revisor_valido and escolhido != 'FUNDADOR' and escolhido != 'RAVI'"


# --- furo 5: espera de infraestrutura que não se desfaz / laço falha-volta
def m_retomada_sem_teto(v, t):
    linha(t, "etapa", "E99")["guarda"] = "motivo == 'INFRA'"


def m_retomada_zera_o_infra(v, t):
    linha(t, "etapa", "E99")["efeito"]["infra"] = 0


# --- furo 6 e 17: prazo do card
def m_aviso_80_fora_do_validando_plano(v, t):
    linha(t, "card", "C23")["de"].remove("VALIDANDO_PLANO")


def m_mudar_prazo_volta_a_ser_reacao(v, t):
    tira_linha(t, "card", "C26")
    for r in t["reacoes"]:
        if r["evento"] == "MUDAR_PRAZO":
            r.pop("guarda")


def m_nivel_perdido_trava_os_seguintes(v, t):
    linha(t, "card", "C24")["guarda"] = "nivel_prazo == 1"


# --- furo 7: estados 'na hora' sem relógio
def m_na_hora_sem_evento(v, t):
    t["prazos"]["na_hora"]["no_prazo"] = {"papel": "MOTOR", "evento": None}


def m_ok_autorizado_nunca_vence(v, t):
    tira_linha(t, "acao_externa", "X13")


def m_validador_parado_gasta_tentativa(v, t):
    linha(t, "etapa", "E47")["efeito"]["execucoes"] = "+1"


# --- furos 8 e 16: ordem sua no teto vira comentário
def m_esperar_no_teto_vira_comentario(v, t):
    tira_linha(t, "etapa", "E98")


def m_refazer_do_card_no_teto_vira_comentario(v, t):
    tira_linha(t, "card", "C29")


def m_quarto_ajuste_volta_a_ser_reacao(v, t):
    tira_linha(t, "etapa", "E117")
    t["reacoes"].append({"papel": "FUNDADOR", "evento": "PEDIR_AJUSTE", "maquina": "etapa", "estados": ["APROVADA"],
                         "guarda": "ordens >= TETO_ORDENS", "efeito_fora": "este card segue como está"})


def m_substituir_sem_avisar_o_card(v, t):
    linha(t, "etapa", "E117")["sinais"] = []


# --- furo 10: toque sobre versão que você não viu
def m_sem_versao_vista(v, t):
    del t["regras_gerais"]["toques_do_fundador_exigem_versao_vista"]


# --- furo 11: jurídico com você como segundo revisor; regra 4 com quem revisa o parecer
def m_juridico_aprovado_so_pela_ia(v, t):
    linha(t, "etapa", "E54")["guarda"] = "exec_viva == 1"
    tira_linha(t, "etapa", "E74")


def m_mesmo_revisor_na_julgada_e_na_julgadora(v, t):
    t["designacao_de_revisor"]["excluir"].remove("REVISORES_DOS_JULGADORES")


# --- furo 12: o uso da internet viaja dentro da resposta
def m_pergunta_sem_olhar_o_uso_da_execucao(v, t):
    linha(t, "etapa", "E21")["guarda"] = ("(leu_internet == 0 or not tem_internet) and permite_perguntar "
                                          "and perguntas < TETO_PERGUNTAS and not prazo_de_terceiro")


def m_formato_nao_herda_a_internet(v, t):
    linha(t, "etapa", "E24")["efeito"]["leu_internet"] = 0


# --- furo 13: entradas só por sinal; fim registrado como seu só com toque seu
def m_entradas_direto_do_motor(v, t):
    t["regras_gerais"]["entradas_so_por_sinal"] = False


def m_dependencias_prontas_sem_guarda(v, t):
    linha(t, "etapa", "E01").pop("guarda")


def m_motor_encerra_o_card_como_se_fosse_voce(v, t):
    linha(t, "etapa", "E28")["sinais"] = ["ENCERRAR_CARD"]


# --- furo 14: chave da Helena
def m_helena_sem_chave(v, t):
    t["regras_gerais"]["respostas_de_agente_exigem_chave_atual"].remove("HELENA")


# --- furo 18: o agente escolhe o regime da sua espera; padrão sem lembrete
def m_agente_escolhe_o_tipo_da_espera(v, t):
    v["acoes"]["AUTOR"]["PERGUNTAR"]["parametros"]["tipo"] = ["INTERNA", "EXTERNA"]
    linha(t, "etapa", "E21")["efeito"]["espera"] = "$tipo"


def m_espera_externa_sem_lembrete(v, t):
    linha(t, "etapa", "E91")["guarda"] = "(espera == 'INTERNA' and lembretes >= TETO_LEMBRETES) or espera == 'EXTERNA'"


def m_acao_expira_sem_lembrete(v, t):
    linha(t, "acao_externa", "X04").pop("guarda")


MUTACOES = [
    ("remover o dono de um estado", m_remover_dono, "R01"),
    ("remover o prazo de um estado", m_remover_prazo, "R01"),
    ("criar uma saída de um final", m_saida_de_um_final, "R02"),
    ("permitir REVISOR aprovar a própria entrega (designação)", m_revisor_pode_ser_o_autor, "R04"),
    ("permitir resposta de revisor não designado (o autor)", m_revisor_nao_designado_responde, "R04"),
    ("tirar o teto de reprovação", m_sem_teto_de_reprovacao, "R05"),
    ("laço infinito de reprovação (zera execuções)", m_laco_infinito_de_reprovacao, "R02"),
    ("permitir padrão do relógio aprovar entrega", m_padrao_do_relogio_aprova, "R09"),
    ("permitir PRONTO depois de DECISAO_MUDOU sem refazer", m_pronto_depois_de_decisao_mudou, "R10"),
    ("permitir o agente executar ação externa", m_agente_executa_acao_externa, "R08"),
    ("dar efeito externo a uma ação de IA", m_acao_de_ia_com_efeito_externo, "R08"),
    ("permitir AUTOR que leu a internet PERGUNTAR", m_quem_leu_internet_pergunta, "INTERNET"),
    ("aceitar resposta de execução antiga", m_resposta_antiga_grava, "R03"),
    ("iniciar segunda execução com uma viva", m_duas_execucoes_vivas, "R03"),
    ("permitir à Helena mudar o prazo", m_helena_muda_prazo, "R07"),
    ("falha de infraestrutura gastar tentativa", m_falha_de_infra_gasta_tentativa, "R12"),
    ("falha de infraestrutura sem teto", m_falha_de_infra_sem_teto, "R12"),
    ("ajuste do fundador ir para o revisor", m_ajuste_nao_volta_ao_autor, "R05"),
    ("dependente andar com a anterior falhada", m_dependente_anda_com_anterior_falhada, "R06"),
    ("card pronto com etapa cancelada", m_card_pronto_com_etapa_cancelada, "R09"),
    ("cancelamento não chegar à etapa em resolução", m_cancelamento_nao_chega_em_resolucao, "LIGACAO"),
    ("ligar o sub-card na v2.0", m_subcard_ligado, "R06"),
    ("toque do fundador sem destino", m_toque_sem_destino, "R11"),
    ("duas linhas para o mesmo evento", m_duas_linhas_para_o_mesmo_evento, "R13"),
    ("plano inválido deixar as etapas andarem", m_plano_invalido_deixa_etapas_andarem, "R06"),
    ("tirar o teto de 6 execuções", m_sem_teto_de_6_execucoes, "R05"),
    # furos apontados pelos atacantes (cada um reabre o furo e precisa ser pego)
    ("furo 1/15: tirar a linha MOTIVO_RESOLVIDO (tudo aprovado preso numa pergunta velha)", m_sem_motivo_resolvido, "R02"),
    ("furo 2: tirar da tabela a trava 'etapa só anda com o card ativo'", m_sem_trava_de_card_ativo, "R06"),
    ("furo 2: card ativo incluir VALIDANDO_PLANO", m_card_ativo_inclui_validando_plano, "R06"),
    ("furo 3/9: ação externa nascer na entrega, antes dos portões", m_acao_nasce_na_entrega, "R08"),
    ("furo 3/9: ação externa nascer na aprovação, antes do card pronto", m_acao_nasce_na_aprovacao, "R08"),
    ("furo 9: ação incerta virar FALHOU pelo padrão", m_incerta_vira_falhou, "R08"),
    ("furo 4: domínio do revisor escrito à mão, fora de identidades", m_dominio_do_revisor_escrito_a_mao, "ESTRUTURA"),
    ("furo 4: revisor válido que a prova nunca alcança", m_revisor_valido_nunca_designado, "R04"),
    ("furo 5: capacidade volta sem teto (laço falha e volta)", m_retomada_sem_teto, "R02"),
    ("furo 5: capacidade volta zerando o infra (laço falha e volta)", m_retomada_zera_o_infra, "R02"),
    ("furo 6: aviso de 80% fora do VALIDANDO_PLANO", m_aviso_80_fora_do_validando_plano, "R01"),
    ("furo 6/17: MUDAR_PRAZO voltar a ser só reação", m_mudar_prazo_volta_a_ser_reacao, "R01"),
    ("furo 6: nível de prazo perdido travar os seguintes", m_nivel_perdido_trava_os_seguintes, "R01"),
    ("furo 7: prazo 'na hora' sem evento", m_na_hora_sem_evento, "R01"),
    ("furo 7: ok autorizado nunca vencer", m_ok_autorizado_nunca_vence, "R01"),
    ("furo 7: validador parado gastar tentativa do autor", m_validador_parado_gasta_tentativa, "R12"),
    ("furo 8: ESPERAR no teto de ordens virar comentário", m_esperar_no_teto_vira_comentario, "R11"),
    ("furo 8: REFAZER do card no teto virar comentário", m_refazer_do_card_no_teto_vira_comentario, "R11"),
    ("furo 16: 4º ajuste voltar a ser reação ('o card segue como está')", m_quarto_ajuste_volta_a_ser_reacao, "R10"),
    ("furo 16: ajuste no teto descartar a peça sem substituir o card", m_substituir_sem_avisar_o_card, "R02"),
    ("furo 10: tirar a conferência da versão vista", m_sem_versao_vista, "R09"),
    ("furo 11: parecer jurídico aprovado só pela IA", m_juridico_aprovado_so_pela_ia, "R09"),
    ("furo 11: mesmo revisor na julgada e na julgadora", m_mesmo_revisor_na_julgada_e_na_julgadora, "R04"),
    ("furo 12: pergunta aceita sem olhar o uso da execução", m_pergunta_sem_olhar_o_uso_da_execucao, "INTERNET"),
    ("furo 12: tentativa de formato não herdar a internet", m_formato_nao_herda_a_internet, "INTERNET"),
    ("furo 13: entradas aceitas direto do motor", m_entradas_direto_do_motor, "R02"),
    ("furo 13: DEPENDENCIAS_PRONTAS sem guarda", m_dependencias_prontas_sem_guarda, "R06"),
    ("furo 13: motor encerrar o card como se fosse você", m_motor_encerra_o_card_como_se_fosse_voce, "R13"),
    ("furo 14: resposta antiga da Helena gravar", m_helena_sem_chave, "R03"),
    ("furo 18: o agente escolher o tipo da sua espera", m_agente_escolhe_o_tipo_da_espera, "R07"),
    ("furo 18: espera externa cair no padrão sem lembrete", m_espera_externa_sem_lembrete, "R01"),
    ("furo 18: ação proposta expirar sem lembrete", m_acao_expira_sem_lembrete, "R01"),
]


@pytest.mark.parametrize("nome,mutacao,regra", MUTACOES, ids=[m[0] for m in MUTACOES])
def test_mutacao_e_pega_pela_prova(nome, mutacao, regra):
    v, t = copy.deepcopy(VOCAB), copy.deepcopy(TABELA)
    mutacao(v, t)
    rel, _med = P.provar(v, t, parar_em={regra}, usar_cache=True)
    assert regra in rel.regras(), f"a prova NÃO pegou: {nome}; acusou {rel.regras()}"


def test_sao_pelo_menos_dez_mutacoes():
    assert len(MUTACOES) >= 10


def test_prova_com_outros_agentes_do_organograma():
    """Furo 4: a prova não pode valer só para os 5 da primeira meta. Um roteiro com outros agentes
    passa, e todo revisor válido da ficha é de fato percorrido (senão a prova acusa R04)."""
    rot = {"etapas": [
        {"id": "S1", "autor": "OLIVIA", "revisores": ["BRUNO", "MARINA", "FUNDADOR"], "internet": True,
         "acoes_permitidas": ["ENTREGAR", "PERGUNTAR", "REGISTRAR_FALHA"]},
        {"id": "REL", "autor": "HELENA", "revisores": ["HELENA", "THEO"], "depende_de": ["S1"]}]}
    rel, med = P.provar(copy.deepcopy(VOCAB), copy.deepcopy(TABELA), roteiro=rot)
    assert rel.vazio(), [f"[{i['regra']}] {i['mensagem']}" for i in rel.lista()]
    assert med["camada2"]["finais"].get("PRONTO", 0) > 0


def test_roteiro_com_agente_fora_do_vocabulario_e_estrutura():
    rot = copy.deepcopy(P.ROTEIRO_DE_PROVA)
    rot["etapas"][0]["revisores"] = ["LUCAS"]
    rel, _ = P.provar(copy.deepcopy(VOCAB), copy.deepcopy(TABELA), roteiro=rot)
    assert rel.regras() == ["ESTRUTURA"], rel.regras()
    with pytest.raises(P.ErroTabela):
        P.replay({"id": "lucas", "roteiro": rot, "eventos": []})


# ----------------------------------------------------------------------------- jornadas
def _jornada(eventos, esperado=None, **extra):
    j = {"id": "teste", "eventos": eventos}
    if esperado:
        j["esperado"] = esperado
    j.update(extra)
    return j


INICIO = [{"papel": "HELENA", "evento": "LER_DE_VOLTA"},
          {"papel": "FUNDADOR", "evento": "RESPONDER", "params": {"opcao": "CONFIRMO"}}]


def _aprova(etapa, julgadora=False, **params):
    """Entregar, portão 1, revisor aprova; no jurídico, você aprova como segundo revisor."""
    ev = [{"papel": "AUTOR", "evento": "ENTREGAR", "alvo": etapa, **({"params": params} if params else {})},
          {"papel": "MOTOR", "evento": "PORTAO1_OK", "alvo": etapa},
          {"papel": "REVISOR", "evento": "APROVAR", "alvo": etapa}]
    if julgadora or etapa == "EJ":
        ev.append({"papel": "FUNDADOR", "evento": "APROVAR", "alvo": etapa})
    return ev


def _ajuste(etapa):
    return [{"papel": "FUNDADOR", "evento": "PEDIR_AJUSTE", "alvo": etapa, "params": {"motivo_ajuste": "TOM"}}]


R = lambda e, alvo="card": {"papel": "RELOGIO", "evento": e, "alvo": alvo}  # noqa: E731


def test_jornada_feliz_de_ponta_a_ponta():
    ev = INICIO + _aprova("E1") + _aprova("E2") + _aprova("EJ") + _aprova("ER")
    r = P.replay(_jornada(ev, {"estado_card": "PRONTO", "etapas": {"E1": "PRONTA", "E2": "PRONTA", "EJ": "PRONTA", "ER": "PRONTA"},
                               "violacoes": 0, "recusados": 0}))
    assert r["confere"], (r["divergencias"], r["violacoes"])
    revisores = {h["alvo"]: h.get("ator") for h in r["historico"] if h["papel"] == "REVISOR"}
    # a revisão do relatório nunca é da autora (HELENA); a do convite nunca é de quem o julga depois
    # (CLARA, autora do jurídico, nem HELENA, revisora do jurídico)
    assert revisores["ER"] != "HELENA" and revisores["E2"] not in ("CLARA", "HELENA")
    assert revisores["EJ"] != revisores["E2"]
    # furo 11: o jurídico só fica aprovado com o SEU Aprovar, depois do revisor de IA
    passos_ej = [(h["papel"], h["evento"]) for h in r["historico"] if h["alvo"] == "EJ" and h["evento"] == "APROVAR"]
    assert passos_ej == [("REVISOR", "APROVAR"), ("FUNDADOR", "APROVAR")]


def test_jornada_juridico_pede_ajuste_e_a_peca_volta_ao_autor():
    ev = INICIO + _aprova("E1") + _aprova("E2") + _aprova("EJ", parecer="AJUSTE")
    r = P.replay(_jornada(ev))
    assert r["etapas"]["E2"] == "EXECUTANDO" and r["etapas"]["EJ"] == "AGUARDANDO_ANTERIORES"
    assert not r["violacoes"]


def test_jornada_juridico_espera_o_seu_aprovar():
    ev = INICIO + _aprova("E2") + _aprova("EJ")[:3]   # só o revisor de IA aprovou
    r = P.replay(_jornada(ev))
    assert r["etapas"]["EJ"] == "ESPERANDO_FUNDADOR" and r["final"]["etapas"]["EJ"]["motivo"] == "REVISAO"
    assert r["final"]["etapas"]["EJ"]["revisor"] == "FUNDADOR" and not r["violacoes"]


def test_quem_leu_internet_e_pergunta_vira_formato_errado():
    # furo 12 (jornada B): o uso da internet vem DENTRO da resposta; não há ordem de eventos que deixe passar
    ev = INICIO + [{"papel": "AUTOR", "evento": "PERGUNTAR", "alvo": "E2", "params": {"usou_internet": "SIM"}}]
    r = P.replay(_jornada(ev))
    assert r["conversoes"] and r["conversoes"][0]["para"] == "MOTOR FALHA"
    e2 = r["final"]["etapas"]["E2"]
    assert e2["formato"] == 1 and e2["leu_internet"] == 1 and r["etapas"]["E2"] != "ESPERANDO_FUNDADOR"
    # a nova tentativa de formato herda a restrição: mesmo dizendo que não usou, não pergunta
    r2 = P.replay(_jornada(ev + [{"papel": "AUTOR", "evento": "PERGUNTAR", "alvo": "E2", "params": {"usou_internet": "NAO"}}]))
    assert r2["etapas"]["E2"] == "EM_RESOLUCAO" and len(r2["conversoes"]) == 2
    assert not r["violacoes"] and not r2["violacoes"]


def test_resposta_de_execucao_antiga_e_recusada():
    ev = INICIO + [{"papel": "AUTOR", "evento": "ENTREGAR", "alvo": "E1", "chave": "antiga"}]
    r = P.replay(_jornada(ev))
    assert r["etapas"]["E1"] == "EXECUTANDO" and len(r["recusados"]) == 1 and not r["violacoes"]


def test_resposta_antiga_da_helena_e_recusada():
    # furo 14 (G1): leitura de volta de chamada antiga não grava
    ev = [{"papel": "MOTOR", "evento": "FALHA", "params": {"classe": "FORMATO_ERRADO"}},
          {"papel": "HELENA", "evento": "LER_DE_VOLTA", "chave": "antiga"}]
    r = P.replay(_jornada(ev))
    assert r["estado_card"] == "RASCUNHO" and r["recusados"][-1]["evento"] == "HELENA LER_DE_VOLTA" and not r["violacoes"]
    # (G3) recomendação de chamada antiga não grava
    ev = INICIO + [{"papel": "AUTOR", "evento": "REGISTRAR_FALHA", "alvo": "E1"},
                   {"papel": "HELENA", "evento": "RECOMENDAR", "alvo": "E1", "params": {"opcao": "SEGUIR_SEM"}, "chave": "antiga"}]
    r = P.replay(_jornada(ev))
    assert r["etapas"]["E1"] == "EM_RESOLUCAO" and r["recusados"][-1]["evento"] == "HELENA RECOMENDAR" and not r["violacoes"]


def test_numero_de_execucao_e_declarado_e_resposta_da_execucao_dada_como_morta_nao_grava():
    # furo 14: a chave é um número monotônico do banco, nunca 'execucoes' (que zera em rodada nova)
    ne = TABELA["regras_gerais"]["numero_de_execucao"]
    assert ne["nunca_zera"] is True and ne["nao_e"] == "execucoes"
    assert TABELA["macros"]["NOVA_RODADA"]["execucoes"] == 0   # por isso 'execucoes' nunca pode ser a chave
    assert set(TABELA["regras_gerais"]["respostas_de_agente_exigem_chave_atual"]) == {"AUTOR", "REVISOR", "HELENA"}
    # INICIAR, o vigia dá a execução como morta, INICIAR de novo; a resposta da 1ª chega atrasada
    ev = INICIO + [{"papel": "VIGIA", "evento": "SEM_EXECUCAO_VIVA", "alvo": "E1"},
                   {"papel": "AUTOR", "evento": "ENTREGAR", "alvo": "E1", "chave": "antiga"}]
    r = P.replay(_jornada(ev))
    assert r["etapas"]["E1"] == "EXECUTANDO" and r["final"]["etapas"]["E1"]["execucoes"] == 0
    assert r["recusados"][-1]["evento"] == "AUTOR ENTREGAR" and not r["violacoes"]


def test_cancelar_cancela_em_cascata_e_resposta_tardia_vira_card_novo():
    ev = INICIO + _aprova("E1") + [{"papel": "AUTOR", "evento": "ENTREGAR", "alvo": "E2", "params": {"acao_externa": "SO_FUNDADOR"}},
                                   {"papel": "FUNDADOR", "evento": "CANCELAR"},
                                   {"papel": "FUNDADOR", "evento": "RESPONDER", "params": {"opcao": "CONFIRMO"}}]
    r = P.replay(_jornada(ev, {"estado_card": "CANCELADO"}))
    assert r["confere"], r["divergencias"]
    assert all(st == "CANCELADA" for st in r["etapas"].values())
    assert r["acoes"] == {}, "ação de entrega que não passou pelos portões nunca vira proposta"
    assert r["recusados"][-1]["destino"] == "CARD_NOVO_LIGADO" and r["final"]["cards_ligados"] == 1


def test_padrao_nunca_aprova_e_o_card_pergunta_antes_de_cancelar():
    # o revisor não consegue conferir (risco alto) e você não responde: lembretes, padrão cancela a etapa,
    # o card pergunta, você não responde de novo, e o padrão cancela o card. Nada é aprovado.
    ev = INICIO + [{"papel": "AUTOR", "evento": "ENTREGAR", "alvo": "E1"},
                   {"papel": "MOTOR", "evento": "PORTAO1_OK", "alvo": "E1"},
                   {"papel": "REVISOR", "evento": "NAO_CONSIGO_CONFERIR", "alvo": "E1"}]
    for _ in range(2):
        ev += [R("LEMBRETE_24H", "E1"), R("LEMBRETE_48H", "E1"), R("PRAZO_ESPERA_VENCIDO", "E1")]
        ev += [R("LEMBRETE_24H"), R("LEMBRETE_48H"), R("PRAZO_ESPERA_VENCIDO")]
    r = P.replay(_jornada(ev))
    assert r["estado_card"] == "CANCELADO" and r["final"]["card"]["fim"] == "PADRAO"
    assert not any(h["evento"] == "APROVAR" for h in r["historico"])
    assert not r["violacoes"]


def test_quarta_ordem_substitui_o_card_e_ele_nunca_fica_pronto():
    # furo 16: o 4º ajuste não é comentário; o card é substituído por um card novo ligado
    ev = INICIO + _aprova("E1")
    for _ in range(3):
        ev += _ajuste("E1") + _aprova("E1")
    ev += _ajuste("E1") + _aprova("E2") + _aprova("EJ") + _aprova("ER")
    r = P.replay(_jornada(ev))
    assert r["final"]["card"]["ordens"] == 3
    assert r["estado_card"] == "CANCELADO" and r["final"]["card"]["fim"] == "SUBSTITUIDO"
    assert r["final"]["etapas"]["E1"]["fim"] == "SUBSTITUIDO" and r["final"]["cards_ligados"] == 1
    assert not r["violacoes"]


def test_decisao_nova_refaz_quem_dependia():
    ev = INICIO + _aprova("E1") + _aprova("E2") + [{"papel": "MOTOR", "evento": "DECISAO_MUDOU"}]
    r = P.replay(_jornada(ev))
    assert r["etapas"]["E1"] == "EXECUTANDO" and r["etapas"]["E2"] == "EXECUTANDO"
    assert r["etapas"]["EJ"] == "AGUARDANDO_ANTERIORES" and not r["violacoes"]


def test_acao_externa_so_do_card_pronto_pelo_motor_depois_do_seu_ok_e_uma_vez():
    ev = (INICIO + _aprova("E1", acao_externa="PELO_MOTOR")
          + [{"papel": "FUNDADOR", "evento": "APROVAR", "alvo": "acao:A1"}]   # ainda não existe: comentário
          + _aprova("E2") + _aprova("EJ") + _aprova("ER")
          + [{"papel": "AUTOR", "evento": "EXECUTAR_ACAO", "alvo": "acao:A1"},
             {"papel": "FUNDADOR", "evento": "APROVAR", "alvo": "acao:A1"},
             R("TEMPO_ESGOTADO", "acao:A1"),
             {"papel": "MOTOR", "evento": "EXECUTAR_ACAO", "alvo": "acao:A1"}])
    r = P.replay(_jornada(ev))
    assert r["estado_card"] == "PRONTO" and r["acoes"] == {"A1": "INCERTA"}   # sem confirmação, não repete: você confere
    assert r["final"]["acoes"]["A1"]["origem"] == "E1"
    execs = [h for h in r["historico"] if h["evento"] == "EXECUTAR_ACAO"]
    assert len(execs) == 1 and execs[0]["papel"] == "MOTOR"
    assert r["recusados"][0]["destino"] == "COMENTARIO_NO_CARD"
    assert any(x["evento"] == "AUTOR EXECUTAR_ACAO" for x in r["recusados"]) and not r["violacoes"]


def test_acao_de_entrega_reprovada_recusada_ou_velha_nunca_e_executada():
    # furos 3 e 9 (j3): três entregas propõem a ação; só a que passou pelos portões, no card pronto, vira proposta
    ent = {"papel": "AUTOR", "evento": "ENTREGAR", "alvo": "E1", "params": {"acao_externa": "PELO_MOTOR"}}
    ev = INICIO + [ent, {"papel": "MOTOR", "evento": "PORTAO1_OK", "alvo": "E1"}, {"papel": "REVISOR", "evento": "REPROVAR", "alvo": "E1"},
                   ent, {"papel": "MOTOR", "evento": "PORTAO1_RECUSOU", "alvo": "E1"},
                   ent, {"papel": "MOTOR", "evento": "PORTAO1_OK", "alvo": "E1"}, {"papel": "REVISOR", "evento": "APROVAR", "alvo": "E1"},
                   {"papel": "MOTOR", "evento": "DECISAO_MUDOU"}]
    for a in ("A1", "A2", "A3"):
        ev += [{"papel": "FUNDADOR", "evento": "APROVAR", "alvo": "acao:" + a}, {"papel": "MOTOR", "evento": "ACAO_CONCLUIDA", "alvo": "acao:" + a}]
    r = P.replay(_jornada(ev))
    assert r["acoes"] == {} and not any(h["evento"] == "EXECUTAR_ACAO" for h in r["historico"])
    # refeita sem ação externa, o card fecha sem nenhuma proposta; refeita com ação, nasce UMA
    fim = _aprova("E1") + _aprova("E2") + _aprova("EJ") + _aprova("ER")
    r = P.replay(_jornada(ev + fim))
    assert r["estado_card"] == "PRONTO" and r["acoes"] == {} and not r["violacoes"]
    fim = _aprova("E1", acao_externa="PELO_MOTOR") + _aprova("E2") + _aprova("EJ") + _aprova("ER")
    r = P.replay(_jornada(ev + fim + [{"papel": "FUNDADOR", "evento": "APROVAR", "alvo": "acao:A1"},
                                      {"papel": "MOTOR", "evento": "ACAO_CONCLUIDA", "alvo": "acao:A1"}]))
    assert r["acoes"] == {"A1": "EXECUTADA"} and len([h for h in r["historico"] if h["evento"] == "EXECUTAR_ACAO"]) == 1
    assert not r["violacoes"]


def test_historico_reconstroi_o_card():
    ev = INICIO + _aprova("E1") + _aprova("E2") + [{"papel": "FUNDADOR", "evento": "APROVAR", "alvo": "E1"}]
    r = P.replay(_jornada(ev))
    j2 = {"id": "historico", "automatico": False,
          "eventos": [{k: v for k, v in h.items() if k in ("papel", "evento", "alvo", "params", "ator", "chave", "versao_vista")}
                      for h in r["historico"]]}
    r2 = P.replay(j2)
    assert r2["final"] == r["final"] and not r2["violacoes"]


def test_esquema_da_jornada_recusa_resposta_sem_opcao():
    with pytest.raises(jsonschema.ValidationError):
        P.replay(_jornada(INICIO[:1] + [{"papel": "FUNDADOR", "evento": "RESPONDER"}]))
    with pytest.raises(jsonschema.ValidationError):
        P.replay(_jornada([{"papel": "ESTAGIARIO", "evento": "ENTREGAR"}]))


# --- furos 1 e 15: pergunta do card que perdeu o objeto
def test_nao_pode_resolvido_fecha_pronto_sem_o_seu_toque():
    # j1: o jurídico diz NAO_PODE, o card pergunta; com o card ainda esperando, você pede ajuste na E2,
    # o jurídico é refeito e sai OK; mais 2 ajustes na E1 (ordens = 3); a ER é aprovada
    ev = INICIO + _aprova("E1") + _aprova("E2") + _aprova("EJ", parecer="NAO_PODE")
    r0 = P.replay(_jornada(ev))
    assert r0["estado_card"] == "ESPERANDO_FUNDADOR" and r0["final"]["card"]["motivo"] == "NAO_PODE"
    ev += _ajuste("E2") + _aprova("E2") + _aprova("EJ") + _ajuste("E1") + _aprova("E1") + _ajuste("E1") + _aprova("E1") + _aprova("ER")
    r = P.replay(_jornada(ev))
    assert r["final"]["card"]["ordens"] == 3
    assert r["estado_card"] == "PRONTO", (r["estado_card"], r["final"]["card"]["motivo"])
    assert any(h["evento"] == "MOTIVO_RESOLVIDO" and h["via"] == "automatico" for h in r["historico"])
    assert not r["violacoes"]


def test_decisao_nova_sobre_nao_pode_fecha_pronto():
    # jornada H: 2 decisões novas; NAO_PODE; a 3ª decisão refaz tudo e a pergunta perde o objeto
    dec = [{"papel": "MOTOR", "evento": "DECISAO_MUDOU"}]
    ev = INICIO + dec * 2 + _aprova("E1") + _aprova("E2") + _aprova("EJ", parecer="NAO_PODE") + dec
    ev += _aprova("E1") + _aprova("E2") + _aprova("EJ") + _aprova("ER")
    r = P.replay(_jornada(ev))
    assert r["final"]["card"]["ordens"] == 3 and r["estado_card"] == "PRONTO" and not r["violacoes"]


# --- furo 2: a trava 'etapa só anda com o card ativo' está na tabela
def test_etapa_nao_anda_com_o_plano_invalido_mesmo_chamando_a_tabela_direto():
    ev = [{"papel": "HELENA", "evento": "LER_DE_VOLTA"}, {"papel": "FUNDADOR", "evento": "RESPONDER", "params": {"opcao": "CONFIRMO"}},
          {"papel": "MOTOR", "evento": "PLANO_INVALIDO"},
          {"papel": "MOTOR", "evento": "DEPENDENCIAS_PRONTAS", "alvo": "E1"},
          {"papel": "MOTOR", "evento": "INICIAR_EXECUCAO", "alvo": "E1"}]
    r = P.replay(_jornada(ev, automatico=False))
    assert r["estado_card"] == "ESPERANDO_CONFIRMACAO" and r["etapas"]["E1"] == "AGUARDANDO_ANTERIORES"
    assert [x["evento"] for x in r["recusados"]] == ["MOTOR DEPENDENCIAS_PRONTAS", "MOTOR INICIAR_EXECUCAO"]
    maqs = P.montar(VOCAB, TABELA)
    me = maqs["etapa"]
    cfg = P.perfis_do_roteiro(P.ROTEIRO_DE_PROVA, TABELA, VOCAB)[0]["cfg"]
    s = me.inicial()
    for estado_card in ("RASCUNHO", "ESPERANDO_CONFIRMACAO", "VALIDANDO_PLANO", None):
        assert me.casar(s, "MOTOR", "DEPENDENCIAS_PRONTAS", dict(cfg, estado_card=estado_card, anteriores_satisfeitas=True)) == []
    assert [l.id for l in me.casar(s, "MOTOR", "DEPENDENCIAS_PRONTAS", dict(cfg, estado_card="EM_ANDAMENTO", anteriores_satisfeitas=True))] == ["E01"]


# --- furo 5: a espera de infraestrutura se desfaz quando a capacidade volta
def test_capacidade_volta_e_a_etapa_volta_a_trabalhar():
    E = lambda p, e, **k: {"papel": p, "evento": e, "alvo": "E2", **({"params": k} if k else {})}  # noqa: E731
    ev = INICIO + [E("MOTOR", "FALHA_INFRA", classe="COTA"), E("RELOGIO", "AVISO_1H"), E("RELOGIO", "ESPERA_6H")]
    r0 = P.replay(_jornada(ev))
    assert r0["etapas"]["E2"] == "ESPERANDO_FUNDADOR" and r0["final"]["etapas"]["E2"]["motivo"] == "INFRA"
    ev += [E("MOTOR", "CAPACIDADE_VOLTOU"), E("RELOGIO", "LEMBRETE_24H"), E("RELOGIO", "LEMBRETE_48H"), E("RELOGIO", "PRAZO_ESPERA_VENCIDO"),
           R("LEMBRETE_24H"), R("LEMBRETE_48H"), R("PRAZO_ESPERA_VENCIDO")]
    r = P.replay(_jornada(ev))
    assert r["etapas"]["E2"] == "EXECUTANDO" and r["estado_card"] == "EM_ANDAMENTO"
    assert r["final"]["etapas"]["E2"]["infra"] == P.carregar()[1]["tetos"]["TETO_INFRA"]["valor"]   # a próxima falha chama você
    assert not r["violacoes"]
    # a próxima falha chama você na hora, e a capacidade voltar de novo não a tira da espera (sem laço)
    r2 = P.replay(_jornada(ev + [E("MOTOR", "FALHA_INFRA", classe="COTA"), E("MOTOR", "CAPACIDADE_VOLTOU")]))
    assert r2["etapas"]["E2"] == "ESPERANDO_FUNDADOR" and r2["recusados"][-1]["evento"] == "MOTOR CAPACIDADE_VOLTOU"


# --- furo 6: prazo do card
def test_mudar_o_prazo_rearma_os_avisos():
    niveis = [R("PRAZO_80"), R("PRAZO_VENCIDO"), R("PRAZO_MAIS_1H")]
    ev = INICIO + niveis + [{"papel": "FUNDADOR", "evento": "MUDAR_PRAZO"}]
    r = P.replay(_jornada(ev))
    assert r["final"]["card"]["nivel_prazo"] == 0
    r = P.replay(_jornada(ev + niveis))
    assert r["final"]["card"]["nivel_prazo"] == 3 and not r["recusados"] and not r["violacoes"]


def test_nivel_de_prazo_perdido_nao_trava_os_seguintes():
    ev = [{"papel": "HELENA", "evento": "LER_DE_VOLTA"}, {"papel": "FUNDADOR", "evento": "RESPONDER", "params": {"opcao": "CONFIRMO"}},
          R("PRAZO_80"), {"papel": "MOTOR", "evento": "PLANO_VALIDO"}, R("PRAZO_VENCIDO"), R("PRAZO_MAIS_1H")]
    r = P.replay(_jornada(ev, automatico=False))
    assert r["final"]["card"]["nivel_prazo"] == 3 and not r["recusados"]
    ev = INICIO + [R("PRAZO_MAIS_1H")]   # o relógio pulou 80% e vencido: o +1h ainda vale
    assert P.replay(_jornada(ev))["final"]["card"]["nivel_prazo"] == 3


# --- furo 7: estados 'na hora' com relógio
def test_validador_que_nao_roda_nao_gasta_tentativa_do_autor():
    ev = INICIO + [{"papel": "AUTOR", "evento": "ENTREGAR", "alvo": "E1"},
                   {"papel": "MOTOR", "evento": "FALHA_INFRA", "alvo": "E1", "params": {"classe": "BANCO"}}]
    r = P.replay(_jornada(ev))
    e1 = r["final"]["etapas"]["E1"]
    assert r["etapas"]["E1"] == "VALIDACAO" and e1["execucoes"] == 1 and e1["infra"] == 1   # roda de novo, sem gastar
    ev += [R("TEMPO_ESGOTADO", "E1"), {"papel": "MOTOR", "evento": "FALHA_INFRA", "alvo": "E1", "params": {"classe": "BANCO"}}]
    r = P.replay(_jornada(ev))
    e1 = r["final"]["etapas"]["E1"]
    assert r["etapas"]["E1"] == "ESPERANDO_FUNDADOR" and e1["motivo"] == "INFRA" and e1["execucoes"] == 1
    assert not r["violacoes"]


def test_ok_autorizado_vence_se_o_motor_nao_comeca():
    maqs = P.montar(VOCAB, TABELA)
    ma = maqs["acao_externa"]
    s = list(ma.inicial())
    s[0], s[ma.idx["ok_registrado"]] = "AUTORIZADA", 1
    lns = ma.casar(tuple(s), "RELOGIO", "TEMPO_ESGOTADO", {"tem_ferramenta": True})
    assert [l.id for l in lns] == ["X13"] and ma.aplicar(tuple(s), lns[0], {})[0] == "EXPIRADA"


def test_validando_plano_sem_resposta_espera_voce_sem_etapa_andar():
    ev = INICIO[:2] + [R("TEMPO_ESGOTADO"), R("TEMPO_ESGOTADO")]
    r = P.replay(_jornada(ev, automatico=False))
    assert r["estado_card"] == "ESPERANDO_CONFIRMACAO" and r["final"]["card"]["motivo"] == "VALIDADOR_FALHOU"
    assert all(st == "AGUARDANDO_ANTERIORES" for st in r["etapas"].values())
    r = P.replay(_jornada(ev + [{"papel": "FUNDADOR", "evento": "RESPONDER", "params": {"opcao": "CONFIRMO"}},
                                {"papel": "MOTOR", "evento": "PLANO_VALIDO"}], automatico=False))
    assert r["estado_card"] == "EM_ANDAMENTO" and r["final"]["card"]["ordens"] == 1 and not r["violacoes"]


# --- furo 8: no teto de ordens, ESPERAR não vira comentário
def test_esperar_no_teto_de_ordens_abre_card_novo_e_nao_cai_no_padrao():
    ev = INICIO + _aprova("E1")
    for _ in range(3):
        ev += _ajuste("E1") + _aprova("E1")
    ev += [{"papel": "MOTOR", "evento": "FALHA_INFRA", "alvo": "E2", "params": {"classe": "PROVEDOR"}}] * 3
    ev += [{"papel": "FUNDADOR", "evento": "RESPONDER", "alvo": "E2", "params": {"opcao": "ESPERAR"}}]
    r = P.replay(_jornada(ev))
    assert r["final"]["card"]["ordens"] == 3
    assert r["estado_card"] == "CANCELADO" and r["final"]["card"]["fim"] == "SUBSTITUIDO"
    assert r["final"]["etapas"]["E2"]["fim"] == "SUBSTITUIDO" and r["final"]["cards_ligados"] == 1
    assert not r["violacoes"]


# --- furo 10: toque sobre versão que você não viu
def test_toque_sobre_versao_antiga_nao_aprova_a_entrega_nova():
    rev_fund = [{"papel": "AUTOR", "evento": "ENTREGAR", "alvo": "E2"},
                {"papel": "MOTOR", "evento": "PORTAO1_OK", "alvo": "E2", "params": {"escolhido": "FUNDADOR"}}]
    ev = INICIO + rev_fund + [{"papel": "MOTOR", "evento": "DECISAO_MUDOU"}] + rev_fund
    ev += [{"papel": "FUNDADOR", "evento": "APROVAR", "alvo": "E2", "versao_vista": "antiga"}]
    r = P.replay(_jornada(ev))
    assert r["etapas"]["E2"] == "ESPERANDO_FUNDADOR" and r["final"]["etapas"]["E2"]["motivo"] == "REVISAO"
    assert r["recusados"][-1]["destino"] == "COMENTARIO_NO_CARD" and not r["violacoes"]
    r = P.replay(_jornada(ev + [{"papel": "FUNDADOR", "evento": "APROVAR", "alvo": "E2"}]))
    assert r["etapas"]["E2"] == "APROVADA" and not r["violacoes"]


# --- furo 13: entradas só por sinal
def test_entradas_diretas_do_motor_sao_recusadas():
    # F1b: dependências prontas com a anterior em espera
    ev = [{"papel": "HELENA", "evento": "LER_DE_VOLTA"}, {"papel": "FUNDADOR", "evento": "RESPONDER", "params": {"opcao": "CONFIRMO"}},
          {"papel": "MOTOR", "evento": "PLANO_VALIDO"}, {"papel": "MOTOR", "evento": "DEPENDENCIAS_PRONTAS", "alvo": "EJ"}]
    r = P.replay(_jornada(ev, automatico=False))
    assert r["etapas"]["EJ"] == "AGUARDANDO_ANTERIORES" and r["recusados"][-1]["evento"] == "MOTOR DEPENDENCIAS_PRONTAS"
    # F2, F3 e G2: decisão nova, card pronto e encerrar o card direto do motor
    ev = INICIO + _aprova("E1") + [{"papel": "MOTOR", "evento": "DECISAO_MUDOU", "alvo": "E1"}] * 10
    ev += [{"papel": "MOTOR", "evento": "CARD_PRONTO", "alvo": "E1"}, {"papel": "MOTOR", "evento": "ENCERRAR_CARD"}]
    r = P.replay(_jornada(ev))
    assert r["etapas"]["E1"] == "APROVADA" and r["estado_card"] == "EM_ANDAMENTO" and r["final"]["card"]["ordens"] == 0
    assert len(r["recusados"]) == 12 and all("só por sinal" in x["motivo"] for x in r["recusados"])
    assert not r["violacoes"]


# --- furo 17: resposta depois do padrão vira decisão guardada
def test_resposta_tardia_viaja_para_a_versao_nova():
    ev = INICIO + [{"papel": "AUTOR", "evento": "PERGUNTAR", "alvo": "E1"},
                   R("LEMBRETE_24H", "E1"), R("LEMBRETE_48H", "E1"), R("PRAZO_ESPERA_VENCIDO", "E1"),
                   {"papel": "FUNDADOR", "evento": "RESPONDER", "alvo": "E1", "params": {"opcao": "RESPOSTA_A"}}]
    r = P.replay(_jornada(ev))
    assert r["estado_card"] == "ESPERANDO_FUNDADOR" and r["recusados"][-1]["destino"] == "RESPOSTA_GUARDADA"
    r = P.replay(_jornada(ev + [{"papel": "FUNDADOR", "evento": "RESPONDER", "params": {"opcao": "REFAZER"}}]))
    e1 = r["final"]["etapas"]["E1"]
    assert e1["versao"] == 1 and e1["respostas_da_versao"] == ["RESPOSTA_A"] and not r["violacoes"]
    # com o card fechado, a mesma resposta abre o card novo ligado
    r = P.replay(_jornada(ev[:-1] + [{"papel": "FUNDADOR", "evento": "CANCELAR"}] + ev[-1:]))
    assert r["recusados"][-1]["destino"] == "CARD_NOVO_LIGADO" and r["final"]["cards_ligados"] == 1


# --- furo 18: o regime da espera é do código; nenhum padrão sem lembrete
def test_padrao_so_depois_de_lembrete_e_tipo_pelo_roteiro():
    ev = INICIO + [{"papel": "AUTOR", "evento": "PERGUNTAR", "alvo": "E2"}, R("PRAZO_ESPERA_VENCIDO", "E2")]
    r = P.replay(_jornada(ev))
    assert r["final"]["etapas"]["E2"]["espera"] == "EXTERNA"   # E2 tem prazo de terceiro no roteiro
    assert r["etapas"]["E2"] == "ESPERANDO_FUNDADOR" and r["recusados"][-1]["evento"] == "RELOGIO PRAZO_ESPERA_VENCIDO"
    r = P.replay(_jornada(ev[:-1] + [R("LEMBRETE_24H", "E2"), R("PRAZO_ESPERA_VENCIDO", "E2")]))
    assert r["etapas"]["E2"] == "CANCELADA" and r["final"]["etapas"]["E2"]["fim"] == "PADRAO" and not r["violacoes"]
    r = P.replay(_jornada(INICIO + [{"papel": "AUTOR", "evento": "PERGUNTAR", "alvo": "E1"}]))
    assert r["final"]["etapas"]["E1"]["espera"] == "INTERNA"
    assert "tipo" not in VOCAB["acoes"]["AUTOR"]["PERGUNTAR"]["parametros"]


# ----------------------------------------------------------------------------- os 21 agentes de ponta a ponta
AGENTES = VOCAB["identidades"]["agentes"]


@pytest.mark.parametrize("agente", AGENTES)
def test_cada_agente_de_ponta_a_ponta(agente):
    """Cada um dos 21 agentes como autor de um serviço, revisado por outro agente, e a Helena
    consolidando o relatório: pedido -> card -> especialista -> revisão -> resultado no card."""
    revisor = AGENTES[(AGENTES.index(agente) + 1) % len(AGENTES)]
    rev_relatorio = [a for a in AGENTES if a not in ("HELENA", agente)][0]
    rot = {"etapas": [
        {"id": "S1", "nome": f"serviço de {agente}", "autor": agente, "revisores": [revisor], "internet": agente != "HELENA",
         "acoes_permitidas": ["ENTREGAR", "PERGUNTAR", "DEVOLVER_A_QUEM_PEDIU", "REGISTRAR_FALHA"]},
        {"id": "REL", "nome": "relatório da Helena", "autor": "HELENA", "revisores": [rev_relatorio], "depende_de": ["S1"]}]}
    ev = INICIO + _aprova("S1") + _aprova("REL")
    r = P.replay(_jornada(ev, {"estado_card": "PRONTO", "etapas": {"S1": "PRONTA", "REL": "PRONTA"}, "violacoes": 0, "recusados": 0},
                          roteiro=rot, agente=agente))
    assert r["confere"], (r["divergencias"], r["violacoes"], r["recusados"])
    rev = {h["alvo"]: h["ator"] for h in r["historico"] if h["papel"] == "REVISOR"}
    assert rev == {"S1": revisor, "REL": rev_relatorio} and agente != revisor
