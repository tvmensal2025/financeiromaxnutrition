# -*- coding: utf-8 -*-
"""Testes da máquina de passagens.

1. A tabela real passa na prova (camadas 1, 2 e 3), em menos de 60 s, sem violação conhecida.
2. TESTES DE MUTAÇÃO: cada mutação planta um defeito na tabela (ou no vocabulário) e o
   teste exige que a prova acuse a regra certa. Uma prova que deixa passar um defeito
   plantado não vale (mesmo princípio do validador no plano v3).
3. Jornadas: replay() reproduz eventos com papel e devolve estado final e violações.

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
    t["linhas"][maquina] = [ln for ln in t["linhas"][maquina] if ln["id"] != rid]


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


def test_todo_estado_aberto_tem_dono_e_prazo_escritos_uma_vez():
    for maquina, ests in TABELA["estados"].items():
        for nome, d in ests.items():
            if d.get("final"):
                continue
            assert d.get("dono") in VOCAB["papeis"], (maquina, nome)
            assert d.get("prazo") in TABELA["prazos"], (maquina, nome)


def test_impressao_digital_muda_com_a_tabela():
    t2 = copy.deepcopy(TABELA)
    t2["tetos"]["TETO_EXECUCOES"]["valor"] = 7
    assert P.impressao_digital(VOCAB, TABELA) != P.impressao_digital(VOCAB, t2)


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
    linha(t, "etapa", "E21")["guarda"] = "permite_perguntar and perguntas < TETO_PERGUNTAS"


def m_resposta_antiga_grava(v, t):
    t["regras_gerais"]["respostas_de_agente_exigem_chave_atual"] = False


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
]


@pytest.mark.parametrize("nome,mutacao,regra", MUTACOES, ids=[m[0] for m in MUTACOES])
def test_mutacao_e_pega_pela_prova(nome, mutacao, regra):
    v, t = copy.deepcopy(VOCAB), copy.deepcopy(TABELA)
    mutacao(v, t)
    rel, _med = P.provar(v, t, parar_em={regra}, usar_cache=True)
    assert regra in rel.regras(), f"a prova NÃO pegou: {nome}; acusou {rel.regras()}"


def test_sao_pelo_menos_dez_mutacoes():
    assert len(MUTACOES) >= 10


# ----------------------------------------------------------------------------- jornadas
def _jornada(eventos, esperado=None, **extra):
    j = {"id": "teste", "eventos": eventos}
    if esperado:
        j["esperado"] = esperado
    j.update(extra)
    return j


INICIO = [{"papel": "HELENA", "evento": "LER_DE_VOLTA"},
          {"papel": "FUNDADOR", "evento": "RESPONDER", "params": {"opcao": "CONFIRMO"}}]


def _aprova(etapa, **params):
    return [{"papel": "AUTOR", "evento": "ENTREGAR", "alvo": etapa, **({"params": params} if params else {})},
            {"papel": "MOTOR", "evento": "PORTAO1_OK", "alvo": etapa},
            {"papel": "REVISOR", "evento": "APROVAR", "alvo": etapa}]


def test_jornada_feliz_de_ponta_a_ponta():
    ev = INICIO + _aprova("E1") + _aprova("E2") + _aprova("EJ") + _aprova("ER")
    r = P.replay(_jornada(ev, {"estado_card": "PRONTO", "etapas": {"E1": "PRONTA", "E2": "PRONTA", "EJ": "PRONTA", "ER": "PRONTA"},
                               "violacoes": 0, "recusados": 0}))
    assert r["confere"], (r["divergencias"], r["violacoes"])
    # a revisão do relatório nunca é da autora (HELENA) e a do convite nunca é de quem o julga (CLARA)
    revisores = {h["alvo"]: h.get("ator") for h in r["historico"] if h["papel"] == "REVISOR"}
    assert revisores["ER"] != "HELENA" and revisores["E2"] != "CLARA"


def test_jornada_juridico_pede_ajuste_e_a_peca_volta_ao_autor():
    ev = INICIO + _aprova("E1") + _aprova("E2") + _aprova("EJ", parecer="AJUSTE")
    r = P.replay(_jornada(ev))
    assert r["etapas"]["E2"] == "EXECUTANDO" and r["etapas"]["EJ"] == "AGUARDANDO_ANTERIORES"
    assert not r["violacoes"]


def test_quem_leu_internet_e_pergunta_vira_formato_errado():
    ev = INICIO + [{"papel": "MOTOR", "evento": "LEU_INTERNET", "alvo": "E2"},
                   {"papel": "AUTOR", "evento": "PERGUNTAR", "alvo": "E2", "params": {"tipo": "INTERNA"}}]
    r = P.replay(_jornada(ev))
    assert r["conversoes"] and r["conversoes"][0]["para"] == "MOTOR FALHA"
    assert r["final"]["etapas"]["E2"]["formato"] == 1 and not r["violacoes"]


def test_resposta_de_execucao_antiga_e_recusada():
    ev = INICIO + [{"papel": "AUTOR", "evento": "ENTREGAR", "alvo": "E1", "chave": "antiga"}]
    r = P.replay(_jornada(ev))
    assert r["etapas"]["E1"] == "EXECUTANDO" and len(r["recusados"]) == 1 and not r["violacoes"]


def test_cancelar_cancela_em_cascata_e_resposta_tardia_vira_card_novo():
    ev = INICIO + _aprova("E1") + [{"papel": "AUTOR", "evento": "ENTREGAR", "alvo": "E2", "params": {"acao_externa": "SO_FUNDADOR"}},
                                   {"papel": "FUNDADOR", "evento": "CANCELAR"},
                                   {"papel": "FUNDADOR", "evento": "RESPONDER", "params": {"opcao": "CONFIRMO"}}]
    r = P.replay(_jornada(ev, {"estado_card": "CANCELADO", "acoes": {"A1": "CANCELADA"}}))
    assert r["confere"], r["divergencias"]
    assert all(st == "CANCELADA" for st in r["etapas"].values())
    assert r["recusados"][-1]["destino"] == "CARD_NOVO_LIGADO"


def test_padrao_nunca_aprova_e_o_card_pergunta_antes_de_cancelar():
    # o revisor não consegue conferir (risco alto) e você não responde: lembretes, padrão cancela a etapa,
    # o card pergunta, você não responde de novo, e o padrão cancela o card. Nada é aprovado.
    ev = INICIO + [{"papel": "AUTOR", "evento": "ENTREGAR", "alvo": "E1"},
                   {"papel": "MOTOR", "evento": "PORTAO1_OK", "alvo": "E1"},
                   {"papel": "REVISOR", "evento": "NAO_CONSIGO_CONFERIR", "alvo": "E1"}]
    for _ in range(2):
        ev += [{"papel": "RELOGIO", "evento": "LEMBRETE_24H", "alvo": "E1"}, {"papel": "RELOGIO", "evento": "LEMBRETE_48H", "alvo": "E1"},
               {"papel": "RELOGIO", "evento": "PRAZO_ESPERA_VENCIDO", "alvo": "E1"}]
        ev += [{"papel": "RELOGIO", "evento": "LEMBRETE_24H"}, {"papel": "RELOGIO", "evento": "LEMBRETE_48H"},
               {"papel": "RELOGIO", "evento": "PRAZO_ESPERA_VENCIDO"}]
    r = P.replay(_jornada(ev))
    assert r["estado_card"] == "CANCELADO" and r["final"]["card"]["fim"] == "PADRAO"
    assert not any(h["evento"] == "APROVAR" for h in r["historico"])
    assert not r["violacoes"]


def test_quarta_ordem_do_fundador_abre_card_novo_ligado():
    ev = INICIO + _aprova("E1")
    for _ in range(3):
        ev += [{"papel": "FUNDADOR", "evento": "PEDIR_AJUSTE", "alvo": "E1", "params": {"motivo_ajuste": "TOM"}}] + _aprova("E1")
    ev += [{"papel": "FUNDADOR", "evento": "PEDIR_AJUSTE", "alvo": "E1", "params": {"motivo_ajuste": "TOM"}}]
    r = P.replay(_jornada(ev))
    assert r["final"]["card"]["ordens"] == 3 and r["etapas"]["E1"] == "APROVADA"
    assert "card novo ligado" in r["reacoes"][-1]["efeito"]
    assert not r["violacoes"]


def test_decisao_nova_refaz_quem_dependia():
    ev = INICIO + _aprova("E1") + _aprova("E2") + [{"papel": "MOTOR", "evento": "DECISAO_MUDOU"}]
    r = P.replay(_jornada(ev))
    assert r["etapas"]["E1"] == "EXECUTANDO" and r["etapas"]["E2"] == "EXECUTANDO"
    assert r["etapas"]["EJ"] == "AGUARDANDO_ANTERIORES" and not r["violacoes"]


def test_acao_externa_so_pelo_motor_depois_do_seu_ok_e_uma_vez():
    ev = INICIO + [{"papel": "AUTOR", "evento": "ENTREGAR", "alvo": "E1", "params": {"acao_externa": "PELO_MOTOR"}},
                   {"papel": "AUTOR", "evento": "EXECUTAR_ACAO", "alvo": "acao:A1"},
                   {"papel": "FUNDADOR", "evento": "APROVAR", "alvo": "acao:A1"},
                   {"papel": "RELOGIO", "evento": "TEMPO_ESGOTADO", "alvo": "acao:A1"},
                   {"papel": "MOTOR", "evento": "EXECUTAR_ACAO", "alvo": "acao:A1"}]
    r = P.replay(_jornada(ev))
    assert r["acoes"]["A1"] == "INCERTA"     # sem confirmação, não repete: você confere
    execs = [h for h in r["historico"] if h["evento"] == "EXECUTAR_ACAO"]
    assert len(execs) == 1 and execs[0]["papel"] == "MOTOR"
    assert r["recusados"][0]["evento"] == "AUTOR EXECUTAR_ACAO" and not r["violacoes"]


def test_historico_reconstroi_o_card():
    ev = INICIO + _aprova("E1") + _aprova("E2")
    r = P.replay(_jornada(ev))
    j2 = {"id": "historico", "automatico": False,
          "eventos": [{k: v for k, v in h.items() if k in ("papel", "evento", "alvo", "params", "ator", "chave")} for h in r["historico"]]}
    r2 = P.replay(j2)
    assert r2["final"] == r["final"] and not r2["violacoes"]


def test_esquema_da_jornada_recusa_resposta_sem_opcao():
    with pytest.raises(jsonschema.ValidationError):
        P.replay(_jornada(INICIO[:1] + [{"papel": "FUNDADOR", "evento": "RESPONDER"}]))
    with pytest.raises(jsonschema.ValidationError):
        P.replay(_jornada([{"papel": "ESTAGIARIO", "evento": "ENTREGAR"}]))
