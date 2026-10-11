# -*- coding: utf-8 -*-
"""Cenários dirigidos: os caminhos raros da tabela (encerrar, substituir o card, pular, refazer, "não pode"), um por um.

O QUE É: cada cenário é uma lista de eventos escrita à mão, passada passo a passo pelo provar.replay e pela função do banco
(mesma comparação do teste diferencial), e depois confere que a linha da tabela que se queria exercitar de fato disparou.
O sorteio aleatório raramente chega a estes caminhos; aqui eles são garantidos.
COMO MUDAR: caminho novo = cenário novo; diga em `queria` quais linhas (ids do YAML) ele precisa exercitar.
"""
import ajudas as A
import diferencial as D
from test_05_regras import ROTEIRO_DEPENDENTE, DUAS, UMA

P = A.P


def ev(papel, evento, alvo="card", **params):
    e = {"papel": papel, "evento": evento, "alvo": alvo}
    if params:
        e["params"] = {k: str(v) for k, v in params.items()}
    return e


INICIO = [ev("HELENA", "LER_DE_VOLTA"), ev("MOTOR", "PLANO_VALIDO")]


def executando(e="E1"):
    return [ev("MOTOR", "DEPENDENCIAS_PRONTAS", e), ev("MOTOR", "INICIAR_EXECUCAO", e)]


def entregar(e="E1", parecer="OK", acao="NENHUMA"):
    return [ev("AUTOR", "ENTREGAR", e, parecer=parecer, acao_externa=acao, usou_internet="NAO")]


def aprovada_por(e, revisor):
    return [ev("MOTOR", "PORTAO1_OK", e, escolhido=revisor), ev("MOTOR", "INICIAR_REVISAO", e), ev("REVISOR", "APROVAR", e)]


PADRAO_NA_E1 = [ev("RELOGIO", "LEMBRETE_24H", "E1"), ev("RELOGIO", "LEMBRETE_48H", "E1"), ev("RELOGIO", "PRAZO_ESPERA_VENCIDO", "E1")]
E1_FALHOU = INICIO + executando("E1") + [ev("AUTOR", "PERGUNTAR", "E1", usou_internet="NAO")] + PADRAO_NA_E1 + [ev("MOTOR", "PERGUNTAR_AO_FUNDADOR")]


def rodar(con, eventos, roteiro, auto=False):
    """Roda o cenário nos dois lados, comparando a cada passo. Devolve o Mundo do banco."""
    vocab, tab = P.carregar()
    with A.ReplayRapido():
        _ev, difs, mundo = D.sequencia(con, vocab, tab, 1, auto, roteiro, 0, prefixo=eventos, cartao={"pedido_grande": False, "plano_valido": True})
    assert difs == [], difs
    return mundo


def linhas_usadas(m):
    return {r["base_id"] for r in m.linhas(
        "select distinct p.base_id from helena_v2.historico h join helena_v2.card c on c.id = h.card_id "
        "join helena_v2.passagem p on p.maquina = h.maquina and p.linha_id = h.linha_id where c.id = %s or c.card_pai_id = %s", (m.card, m.card))}


def cards_ligados(m):
    return m.linhas("select * from helena_v2.card where card_pai_id = %s", (m.card,))


def test_encerrar_pelo_botao_da_etapa_encerra_o_card_e_registra_como_seu(con):
    eventos = (INICIO + executando("E1") + [ev("AUTOR", "REGISTRAR_FALHA", "E1", motivo_falha="NAO_CONSIGO", usou_internet="NAO"),
                                              ev("HELENA", "RECOMENDAR", "E1", opcao="ENCERRAR"), ev("FUNDADOR", "RESPONDER", "E1", opcao="ENCERRAR")])
    m = rodar(con, eventos, ROTEIRO_DEPENDENTE)
    assert {"E87", "C15", "E04"} <= linhas_usadas(m) | {"E04"}
    assert m.estado_da("card") == "ENCERRADO_COM_FALHA" and m.estado_da("E1") == "ENCERRADA_COM_FALHA" and m.estado_da("E2") == "CANCELADA"
    assert m.linhas("select fim from helena_v2.card where id = %s", (m.card,))[0]["fim"] == "FUNDADOR"


def test_seu_ajuste_acima_do_teto_de_ordens_substitui_o_card(con):
    # 3 decisões novas gastam as 3 ordens; o seu ajuste na 4ª vira card novo ligado (E96 e C28)
    eventos = INICIO + executando("E1")
    for _ in range(3):
        eventos += [ev("MOTOR", "DECISAO_MUDOU"), ev("MOTOR", "INICIAR_EXECUCAO", "E1")]
    eventos += entregar("E1") + [ev("MOTOR", "PORTAO1_OK", "E1", escolhido="FUNDADOR"), ev("FUNDADOR", "PEDIR_AJUSTE", "E1", motivo_ajuste="TOM")]
    m = rodar(con, eventos, UMA)
    assert {"E96", "C28", "C16"} <= linhas_usadas(m)
    assert m.estado_da("card") == "CANCELADO" and m.estado_da("E1") == "CANCELADA"
    novos = cards_ligados(m)
    assert len(novos) == 1 and novos[0]["estado"] == "RASCUNHO"
    assert m.linhas("select fim from helena_v2.card where id = %s", (m.card,))[0]["fim"] == "SUBSTITUIDO"


def test_a_quarta_decisao_nova_tambem_substitui_o_card(con):
    eventos = INICIO + executando("E1") + [ev("MOTOR", "DECISAO_MUDOU")] * 4
    m = rodar(con, eventos, UMA)
    assert {"C17", "C16"} <= linhas_usadas(m)
    assert m.estado_da("card") == "CANCELADO" and len(cards_ligados(m)) == 1


def test_falha_de_quem_depende_o_card_pergunta_e_voce_pula(con):
    m = rodar(con, E1_FALHOU + [ev("FUNDADOR", "RESPONDER", opcao="PULAR")] + executando("E2"), ROTEIRO_DEPENDENTE)
    assert {"C13", "C18"} <= linhas_usadas(m)
    foto = m.foto()
    assert foto["puladas"] == ["E1"] and foto["etapas"]["E1"]["situacao"] == "PULADA" and foto["etapas"]["E2"]["estado"] == "EXECUTANDO"


def test_falha_de_quem_depende_o_card_pergunta_e_voce_manda_refazer_com_a_resposta_guardada(con):
    eventos = E1_FALHOU + [ev("FUNDADOR", "RESPONDER", "E1", opcao="RESPOSTA_B"), ev("FUNDADOR", "RESPONDER", opcao="REFAZER")]
    m = rodar(con, eventos, ROTEIRO_DEPENDENTE)
    assert {"C13", "C19"} <= linhas_usadas(m)
    e1 = m.linha_da_etapa("E1")
    assert e1["geracao"] == 2 and e1["estado"] == "AGUARDANDO_ANTERIORES" and list(e1["respostas_da_versao"]) == ["RESPOSTA_B"]
    assert m.chamar("select count(*) from helena_v2.etapa where card_id = %s and codigo = 'E1'", (m.card,)) == 2     # a versão velha continua no histórico
    assert m.chamar("select estado from helena_v2.etapa where card_id = %s and codigo = 'E1' and not atual", (m.card,)) == "CANCELADA"


def test_falha_de_quem_depende_voce_encerra_o_card(con):
    m = rodar(con, E1_FALHOU + [ev("FUNDADOR", "RESPONDER", opcao="ENCERRAR")], ROTEIRO_DEPENDENTE)
    assert "C21" in linhas_usadas(m)
    assert m.estado_da("card") == "ENCERRADO_COM_FALHA" and m.estado_da("E2") == "CANCELADA"


def test_refazer_acima_do_teto_de_ordens_substitui_o_card(con):
    eventos = E1_FALHOU + [ev("MOTOR", "DECISAO_MUDOU")] * 3 + [ev("FUNDADOR", "RESPONDER", opcao="REFAZER")]
    m = rodar(con, eventos, ROTEIRO_DEPENDENTE)
    assert {"C29", "C16"} <= linhas_usadas(m)
    assert m.estado_da("card") == "CANCELADO" and len(cards_ligados(m)) == 1


NAO_PODE = (INICIO + executando("E1") + entregar("E1") + aprovada_por("E1", "CAIO") + executando("E2")[:1] + [ev("MOTOR", "INICIAR_EXECUCAO", "E2")]
            + entregar("E2", parecer="NAO_PODE") + [ev("MOTOR", "PORTAO1_OK", "E2", escolhido="HELENA"), ev("MOTOR", "INICIAR_REVISAO", "E2"),
                                                    ev("REVISOR", "APROVAR", "E2"), ev("FUNDADOR", "APROVAR", "E2"), ev("MOTOR", "PERGUNTAR_AO_FUNDADOR")])


def test_parecer_nao_pode_o_card_pergunta_e_voce_manda_refazer(con):
    m = rodar(con, NAO_PODE + [ev("FUNDADOR", "RESPONDER", opcao="REFAZER")], DUAS)
    assert {"E81", "C14", "C20"} <= linhas_usadas(m)
    foto = m.foto()
    assert foto["etapas"]["E2"]["situacao"] in ("ESPERA", "TRABALHO") and foto["etapas"]["E1"]["estado"] in ("NA_FILA", "AGUARDANDO_ANTERIORES", "EXECUTANDO")


def test_a_pergunta_perde_o_objeto_e_o_card_volta_a_andar_sozinho(con):
    m = rodar(con, NAO_PODE + [ev("MOTOR", "DECISAO_MUDOU"), ev("MOTOR", "MOTIVO_RESOLVIDO")], DUAS)
    assert {"C14", "C27"} <= linhas_usadas(m)
    assert m.estado_da("card") == "EM_ANDAMENTO"


def _parecer_de_ajuste_aprovado_por_voce():
    return ([ev("MOTOR", "DEPENDENCIAS_PRONTAS", "E2"), ev("MOTOR", "INICIAR_EXECUCAO", "E2")] + entregar("E2", parecer="AJUSTE")
            + [ev("MOTOR", "PORTAO1_OK", "E2", escolhido="HELENA"), ev("MOTOR", "INICIAR_REVISAO", "E2"), ev("REVISOR", "APROVAR", "E2"),
               ev("FUNDADOR", "APROVAR", "E2")])


def _a_peca_julgada_volta_e_e_aprovada_de_novo():
    return [ev("MOTOR", "INICIAR_EXECUCAO", "E1")] + entregar("E1") + aprovada_por("E1", "CAIO")


def test_parecer_de_ajuste_aprovado_por_voce_devolve_a_peca_duas_vezes_e_na_terceira_vai_para_resolucao(con):
    eventos = INICIO + executando("E1") + entregar("E1") + aprovada_por("E1", "CAIO")
    eventos += _parecer_de_ajuste_aprovado_por_voce()                                   # 1ª volta (E82): a peça julgada volta ao autor
    eventos += _a_peca_julgada_volta_e_e_aprovada_de_novo() + _parecer_de_ajuste_aprovado_por_voce()   # 2ª volta (E82)
    eventos += _a_peca_julgada_volta_e_e_aprovada_de_novo() + _parecer_de_ajuste_aprovado_por_voce()   # 3ª: no teto (E83)
    m = rodar(con, eventos, DUAS)
    usadas = linhas_usadas(m)
    assert {"E82", "E112", "E83"} <= usadas
    assert m.estado_da("E2") == "EM_RESOLUCAO" and m.linhas("select voltas from helena_v2.card where id = %s", (m.card,))[0]["voltas"] == 2


def test_cota_que_demora_6_horas_chama_voce_e_a_capacidade_que_volta_devolve_a_etapa_a_fila(con):
    eventos = INICIO + [ev("MOTOR", "DEPENDENCIAS_PRONTAS", "E1"), ev("MOTOR", "SEM_CAPACIDADE", "E1", classe="COTA"),
                        ev("RELOGIO", "AVISO_1H", "E1"), ev("RELOGIO", "ESPERA_6H", "E1")]
    parado = rodar(con, eventos, UMA)
    assert parado.estado_da("E1") == "ESPERANDO_FUNDADOR" and parado.linha_da_etapa()["motivo"] == "INFRA"
    m = rodar(con, eventos + [ev("MOTOR", "CAPACIDADE_VOLTOU", "E1")], UMA)
    assert {"E12", "E15", "E16", "E99"} <= linhas_usadas(m)
    e = m.linha_da_etapa("E1")
    assert e["estado"] == "NA_FILA" and e["motivo"] == "NORMAL" and e["infra"] == 3 and e["execucoes"] == 0


def test_terceira_falta_de_capacidade_seguida_chama_voce_na_hora(con):
    eventos = INICIO + [ev("MOTOR", "DEPENDENCIAS_PRONTAS", "E1")]
    for _ in range(2):
        eventos += [ev("MOTOR", "SEM_CAPACIDADE", "E1", classe="LOGIN"), ev("MOTOR", "CAPACIDADE_VOLTOU", "E1")]
    eventos += [ev("MOTOR", "SEM_CAPACIDADE", "E1", classe="BANCO")]
    m = rodar(con, eventos, UMA)
    assert {"E12", "E14", "E13"} <= linhas_usadas(m)
    e = m.linha_da_etapa("E1")
    assert e["estado"] == "ESPERANDO_FUNDADOR" and e["motivo"] == "INFRA" and e["infra"] == 3


def test_vigia_devolve_a_execucao_morta_e_o_numero_dela_nao_grava_mais(con):
    eventos = INICIO + executando("E1") + [ev("VIGIA", "SEM_EXECUCAO_VIVA", "E1")]
    m = rodar(con, eventos, UMA)
    assert "E34" in linhas_usadas(m)
    assert m.chamar("select count(*) from helena_v2.execucao where etapa_id = %s and estado = 'MORTA'", (m.linha_da_etapa("E1")["id"],)) == 1
    antiga = m.chamar("select numero from helena_v2.execucao where etapa_id = %s and estado = 'MORTA'", (m.linha_da_etapa("E1")["id"],))
    m.um("MOTOR", "INICIAR_EXECUCAO", "E1")
    r = m.evento({"papel": "AUTOR", "evento": "ENTREGAR", "alvo": "E1", "params": {"parecer": "OK", "acao_externa": "NENHUMA", "usou_internet": "NAO"}, "chave": "antiga"})
    assert r["resultado"] == "RECUSADO" and m.linha_da_etapa("E1")["execucao_atual"] > antiga


def test_validador_que_cai_tres_vezes_chama_voce_sem_gastar_tentativa(con):
    eventos = INICIO + executando("E1") + entregar("E1") + [ev("MOTOR", "FALHA_INFRA", "E1", classe="BANCO")] * 3
    m = rodar(con, eventos, UMA)
    assert {"E47", "E48"} <= linhas_usadas(m)
    e = m.linha_da_etapa("E1")
    assert e["estado"] == "ESPERANDO_FUNDADOR" and e["motivo"] == "INFRA" and e["execucoes"] == 1 and e["semaforo"] == "NENHUM"
