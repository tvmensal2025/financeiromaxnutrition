"""Cenários escritos à mão que a referência E a máquina real precisam resolver do mesmo jeito.

Cada cenário diz o roteiro, os eventos e o que se espera no fim. Os mesmos cenários rodam nos dois alvos
(test_referencia.py e test_adaptador_maquina.py): se um dia a referência e a máquina discordarem, um deles
mudou de regra. Só entram aqui os caminhos em que a referência (mais simples) e a máquina têm a mesma regra;
o que a referência não tem (capacidade, plano inválido, divisão de etapa) fica de fora de propósito.

esperado: {"card": estado, "etapas": {id: estado}, "acoes": {id: estado}}
          e, quando importa, "execucoes": {id: n} e "destinos": [destino de cada evento, na ordem].
"""
from dataclasses import dataclass

from ajudantes import (ACAO_AUTORIZADA_E_CONCLUIDA, ACAO_AUTORIZADA_E_FALHA, ACAO_ESQUECIDA, AJUSTE_EM_E2_COM_EJ_APROVADA,
                       COMECO_UNICA, DECISAO_MUDA_COM_E1_APROVADA, FELIZ_UNICA, FUNDADOR_REVISA_E_NAO_RESPONDE,
                       PROPOE_ACAO_DO_MOTOR, PROPOE_ACAO_SO_DO_FUNDADOR, PROVA_E1_APROVADA, PROVA_E2_E_EJ_APROVADAS,
                       ajustes_seguidos, entrega, falha_de_formato, portao_ok)
from simulador.eventos import Evento, autor, fundador, helena, motor, relogio, revisor, vigia
from simulador.roteiro import ROTEIRO_LINHA, ROTEIRO_PROVA, ROTEIRO_UNICA


@dataclass
class Cenario:
    nome: str
    roteiro: object
    eventos: list
    esperado: dict
    pedido_grande: bool = False
    nota: str = ""

    def __repr__(self):
        return self.nome


def _c(nome, roteiro, eventos, card, etapas=None, acoes=None, grande=False, **extra):
    esperado = {"card": card, "etapas": etapas or {}, "acoes": acoes or {}, **extra}
    return Cenario(nome, roteiro, eventos, esperado, grande)


U = ROTEIRO_UNICA
ENTREGA_ATE_REVISAO = COMECO_UNICA + [entrega("U1", "CAIO"), portao_ok("U1", "CLARA")]
# o fundador revisa a peça (o portão o designa) e fica esperando
COM_O_FUNDADOR_NA_REVISAO = COMECO_UNICA + [entrega("U1", "CAIO"), portao_ok("U1", "FUNDADOR")]
# a execução da etapa gastou uma resposta e a Helena foi chamada para recomendar
EM_RESOLUCAO = COMECO_UNICA + [autor("DEVOLVER_A_QUEM_PEDIU", "U1", "CAIO", usou_internet="NAO")]
SEM_ACAO_NO_CARD_ABERTO = COMECO_UNICA + [relogio("PRAZO_80")]

CENARIOS = [
    # ------------------------------------------------------------------ caminho feliz e fim do card
    _c("feliz", U, FELIZ_UNICA, "PRONTO", {"U1": "PRONTA"}, execucoes={"U1": 2},
       destinos=["PASSAGEM"] * 4),
    _c("pedido_grande_confirmado", U,
       [helena("LER_DE_VOLTA"), fundador("RESPONDER", opcao="CONFIRMO"), entrega("U1", "CAIO"), portao_ok("U1", "CLARA"),
        revisor("APROVAR", "U1", "CLARA")], "PRONTO", {"U1": "PRONTA"}, grande=True),
    _c("pedido_grande_sem_confirmacao_cancela_pelo_padrao", U,
       [helena("LER_DE_VOLTA"), relogio("LEMBRETE_24H"), relogio("LEMBRETE_48H"), relogio("PRAZO_ESPERA_VENCIDO")],
       "CANCELADO", {"U1": "CANCELADA"}, grande=True),
    _c("padrao_do_card_nao_vence_antes_dos_lembretes", U,
       [helena("LER_DE_VOLTA"), relogio("PRAZO_ESPERA_VENCIDO"), relogio("LEMBRETE_48H"), relogio("LEMBRETE_24H")],
       "ESPERANDO_CONFIRMACAO", {"U1": "AGUARDANDO_ANTERIORES"}, grande=True,
       destinos=["PASSAGEM", "RECUSADO", "RECUSADO", "PASSAGEM"]),
    _c("fundador_cancela_o_card", U, COMECO_UNICA + [fundador("CANCELAR")], "CANCELADO", {"U1": "CANCELADA"}),
    _c("fundador_cancela_antes_de_a_helena_ler", U, [fundador("CANCELAR")], "CANCELADO", {"U1": "CANCELADA"}),
    _c("tempo_da_leitura_da_helena_esgota", U, [relogio("TEMPO_ESGOTADO")], "ESPERANDO_CONFIRMACAO",
       {"U1": "AGUARDANDO_ANTERIORES"}),
    _c("fundador_encerra_o_card_numa_etapa_em_resolucao", U,
       EM_RESOLUCAO + [helena("RECOMENDAR", "U1", opcao="ENCERRAR"), fundador("RESPONDER", "U1", opcao="ENCERRAR")],
       "ENCERRADO_COM_FALHA", {"U1": "ENCERRADA_COM_FALHA"}),
    # ------------------------------------------------------------------ revisão
    _c("revisor_reprova_e_volta_ao_autor", U, ENTREGA_ATE_REVISAO + [revisor("REPROVAR", "U1", "CLARA")], "EM_ANDAMENTO",
       {"U1": "EXECUTANDO"}, execucoes={"U1": 2}),
    _c("fundador_aprova_a_revisao", U, COM_O_FUNDADOR_NA_REVISAO + [fundador("APROVAR", "U1")], "PRONTO", {"U1": "PRONTA"}),
    _c("fundador_pede_ajuste_na_revisao", U,
       COM_O_FUNDADOR_NA_REVISAO + [fundador("PEDIR_AJUSTE", "U1", motivo_ajuste="TOM")], "EM_ANDAMENTO", {"U1": "EXECUTANDO"},
       execucoes={"U1": 0}),
    _c("fundador_nao_responde_a_revisao_nunca_aprova", U, FUNDADOR_REVISA_E_NAO_RESPONDE, "ESPERANDO_FUNDADOR",
       {"U1": "CANCELADA"}),
    _c("lembrete_na_espera_da_revisao_so_lembra", U,
       COM_O_FUNDADOR_NA_REVISAO + [relogio("LEMBRETE_24H", "U1"), relogio("LEMBRETE_48H", "U1")], "EM_ANDAMENTO",
       {"U1": "ESPERANDO_FUNDADOR"}),
    # ------------------------------------------------------------------ o que o autor pode dizer
    _c("autor_pergunta_e_o_fundador_responde", U,
       COMECO_UNICA + [autor("PERGUNTAR", "U1", "CAIO", usou_internet="NAO"), fundador("RESPONDER", "U1", opcao="RESPOSTA_A")],
       "EM_ANDAMENTO", {"U1": "EXECUTANDO"}),
    _c("autor_que_leu_a_internet_nao_pergunta_e_a_resposta_vira_formato_errado", U,
       COMECO_UNICA + [autor("PERGUNTAR", "U1", "CAIO", usou_internet="SIM")], "EM_ANDAMENTO", {"U1": "EXECUTANDO"},
       destinos=["PASSAGEM", "FORMATO_ERRADO"], execucoes={"U1": 1}),
    _c("autor_devolve_e_a_helena_recomenda_refazer", U,
       EM_RESOLUCAO + [helena("RECOMENDAR", "U1", opcao="REFAZER"), fundador("RESPONDER", "U1", opcao="REFAZER")],
       "EM_ANDAMENTO", {"U1": "EXECUTANDO"}),
    _c("autor_registra_falha", U,
       COMECO_UNICA + [autor("REGISTRAR_FALHA", "U1", "CAIO", motivo_falha="NAO_CONSIGO", usou_internet="NAO")],
       "EM_ANDAMENTO", {"U1": "EM_RESOLUCAO"}),
    _c("pergunta_numa_etapa_que_nao_pode_perguntar_e_formato_errado", ROTEIRO_LINHA,
       [helena("LER_DE_VOLTA"), entrega("L1", "BIANCA"), portao_ok("L1", "DANIEL"), revisor("APROVAR", "L1", "DANIEL"),
        autor("PERGUNTAR", "L2", "DANIEL", usou_internet="NAO")], "EM_ANDAMENTO", {"L1": "APROVADA", "L2": "EXECUTANDO"},
       destinos=["PASSAGEM", "PASSAGEM", "PASSAGEM", "PASSAGEM", "FORMATO_ERRADO"], execucoes={"L2": 1}),
    _c("um_formato_errado_ganha_nova_tentativa", U, COMECO_UNICA + [falha_de_formato("U1")], "EM_ANDAMENTO",
       {"U1": "EXECUTANDO"}, execucoes={"U1": 1}),
    _c("resposta_sem_acao_do_autor_vivo_vira_formato_errado", U,
       COMECO_UNICA + [autor("PEDIR_SUBCARD", "U1", "CAIO", usou_internet="NAO")], "EM_ANDAMENTO", {"U1": "EXECUTANDO"},
       destinos=["PASSAGEM", "FORMATO_ERRADO"], execucoes={"U1": 1}),
    _c("falha_de_provedor_nao_gasta_execucao", U,
       COMECO_UNICA + [motor("FALHA_INFRA", "U1", classe="PROVEDOR")], "EM_ANDAMENTO", {"U1": "EXECUTANDO"},
       execucoes={"U1": 0}),
    _c("queda_do_processo_nao_gasta_execucao", U, COMECO_UNICA + [vigia("SEM_EXECUCAO_VIVA", "U1")], "EM_ANDAMENTO",
       {"U1": "EXECUTANDO"}, execucoes={"U1": 0}),
    _c("terceira_queda_chama_o_fundador", U, COMECO_UNICA + [vigia("SEM_EXECUCAO_VIVA", "U1")] * 3, "EM_ANDAMENTO",
       {"U1": "ESPERANDO_FUNDADOR"}, execucoes={"U1": 0}),
    # ------------------------------------------------------------------ tudo que tem que ser recusado
    _c("autor_nao_aprova_a_propria_peca", U, COMECO_UNICA + [Evento("AUTOR", "APROVAR", "U1", ator="CAIO")], "EM_ANDAMENTO",
       {"U1": "EXECUTANDO"}, destinos=["PASSAGEM", "RECUSADO"]),
    _c("autor_nao_executa_acao_externa", U, PROPOE_ACAO_DO_MOTOR + [autor("EXECUTAR_ACAO", "acao:A1", "CAIO")], "PRONTO",
       {"U1": "PRONTA"}, {"A1": "PROPOSTA"}, destinos=["PASSAGEM"] * 4 + ["RECUSADO"]),
    _c("motor_nao_executa_acao_sem_o_ok", U, PROPOE_ACAO_DO_MOTOR + [motor("EXECUTAR_ACAO", "acao:A1")], "PRONTO",
       {"U1": "PRONTA"}, {"A1": "PROPOSTA"}, destinos=["PASSAGEM"] * 4 + ["RECUSADO"]),
    _c("portao_recusa_o_autor_como_revisor", ROTEIRO_PROVA,
       [helena("LER_DE_VOLTA"), entrega("E2", "ISABELA", usou_internet="SIM"), portao_ok("E2", "ISABELA")], "EM_ANDAMENTO",
       {"E2": "VALIDACAO"}, destinos=["PASSAGEM", "PASSAGEM", "RECUSADO"]),
    _c("portao_recusa_quem_julga_a_peca_depois", ROTEIRO_PROVA,
       [helena("LER_DE_VOLTA"), entrega("E2", "ISABELA", usou_internet="SIM"), portao_ok("E2", "CLARA")], "EM_ANDAMENTO",
       {"E2": "VALIDACAO"}, destinos=["PASSAGEM", "PASSAGEM", "RECUSADO"]),
    _c("revisor_que_nao_e_o_designado_nao_aprova", U,
       ENTREGA_ATE_REVISAO + [revisor("APROVAR", "U1", "HELENA")], "EM_ANDAMENTO", {"U1": "REVISAO"},
       destinos=["PASSAGEM"] * 3 + ["RECUSADO"]),
    _c("entrega_fora_de_hora_e_recusada", U, FELIZ_UNICA + [entrega("U1", "CAIO")], "PRONTO", {"U1": "PRONTA"},
       destinos=["PASSAGEM"] * 4 + ["RECUSADO"]),
    _c("sinal_entre_etapas_so_pelo_sinal", ROTEIRO_PROVA, [helena("LER_DE_VOLTA"), motor("DECISAO_MUDOU", "E1"),
       motor("CARD_PRONTO", "E1"), motor("CANCELADO_PAI", "E2"), motor("ENCERRAR_CARD"), motor("SUBSTITUIR_CARD")],
       "EM_ANDAMENTO", {"E1": "EXECUTANDO", "E2": "EXECUTANDO"}, destinos=["PASSAGEM"] + ["RECUSADO"] * 5),
    _c("relogio_fora_de_hora_nao_faz_nada", U, COMECO_UNICA + [relogio("LEMBRETE_48H", "U1"), relogio("PRAZO_ESPERA_VENCIDO", "U1")],
       "EM_ANDAMENTO", {"U1": "EXECUTANDO"}, destinos=["PASSAGEM", "RECUSADO", "RECUSADO"]),
    _c("a_helena_atrasada_nao_grava", U, EM_RESOLUCAO + [helena("RECOMENDAR", "U1", chave="antiga", opcao="REFAZER")],
       "EM_ANDAMENTO", {"U1": "EM_RESOLUCAO"}, destinos=["PASSAGEM", "PASSAGEM", "RECUSADO"]),
    # ------------------------------------------------------------------ chave antiga e versão antiga
    _c("entrega_atrasada_nao_grava", U, COMECO_UNICA + [entrega("U1", "CAIO", chave="antiga")], "EM_ANDAMENTO",
       {"U1": "EXECUTANDO"}, destinos=["PASSAGEM", "RECUSADO"], execucoes={"U1": 0}),
    _c("aprovar_com_a_tela_velha_vira_comentario", U, COM_O_FUNDADOR_NA_REVISAO + [fundador("APROVAR", "U1", chave="antiga")],
       "EM_ANDAMENTO", {"U1": "ESPERANDO_FUNDADOR"}, destinos=["PASSAGEM"] * 3 + ["COMENTARIO_NO_CARD"]),
    _c("pedir_ajuste_com_a_tela_velha_vira_comentario", U,
       COM_O_FUNDADOR_NA_REVISAO + [fundador("PEDIR_AJUSTE", "U1", chave="antiga", motivo_ajuste="TOM")],
       "EM_ANDAMENTO", {"U1": "ESPERANDO_FUNDADOR"}, destinos=["PASSAGEM"] * 3 + ["COMENTARIO_NO_CARD"]),
    _c("cancelar_com_a_tela_velha_ainda_vale", U, COMECO_UNICA + [fundador("CANCELAR", chave="antiga")], "CANCELADO",
       {"U1": "CANCELADA"}),
    # ------------------------------------------------------------------ toques do fundador sem passagem
    _c("pausar_tudo_e_so_reacao", U, COMECO_UNICA + [fundador("PAUSAR_TUDO")], "EM_ANDAMENTO", {"U1": "EXECUTANDO"},
       destinos=["PASSAGEM", "REACAO"]),
    _c("aprovar_o_que_nao_espera_vira_comentario", U, COMECO_UNICA + [fundador("APROVAR", "U1")], "EM_ANDAMENTO",
       {"U1": "EXECUTANDO"}, destinos=["PASSAGEM", "COMENTARIO_NO_CARD"]),
    _c("usar_como_exemplo_antes_de_aprovada_vira_comentario", U, COMECO_UNICA + [fundador("USAR_COMO_EXEMPLO", "U1")],
       "EM_ANDAMENTO", {"U1": "EXECUTANDO"}, destinos=["PASSAGEM", "COMENTARIO_NO_CARD"]),
    _c("mudar_prioridade_e_reacao", U, COMECO_UNICA + [fundador("MUDAR_PRIORIDADE")], "EM_ANDAMENTO", {"U1": "EXECUTANDO"},
       destinos=["PASSAGEM", "REACAO"]),
    _c("toque_num_card_pronto_vira_card_novo_ligado", U,
       FELIZ_UNICA + [fundador("PEDIR_AJUSTE", "U1", motivo_ajuste="TOM"), fundador("PAUSAR_TUDO"), fundador("CANCELAR")],
       "PRONTO", {"U1": "PRONTA"}, destinos=["PASSAGEM"] * 4 + ["CARD_NOVO_LIGADO", "REACAO", "COMENTARIO_NO_CARD"]),
    _c("card_cancelado_recusa_tudo", U,
       COMECO_UNICA + [fundador("CANCELAR"), entrega("U1", "CAIO"), relogio("PRAZO_80"), motor("DECISAO_MUDOU")],
       "CANCELADO", {"U1": "CANCELADA"}, destinos=["PASSAGEM", "PASSAGEM", "RECUSADO", "RECUSADO", "RECUSADO"]),
    # ------------------------------------------------------------------ prazo do card
    _c("os_tres_avisos_de_prazo_andam_em_ordem", U,
       COMECO_UNICA + [relogio("PRAZO_80"), relogio("PRAZO_VENCIDO"), relogio("PRAZO_MAIS_1H"), relogio("PRAZO_80")],
       "EM_ANDAMENTO", {"U1": "EXECUTANDO"}, destinos=["PASSAGEM"] * 4 + ["RECUSADO"]),
    _c("fundador_muda_o_prazo_e_rearma_os_avisos", U,
       COMECO_UNICA + [relogio("PRAZO_80"), fundador("MUDAR_PRAZO"), relogio("PRAZO_80")], "EM_ANDAMENTO",
       {"U1": "EXECUTANDO"}, destinos=["PASSAGEM"] * 4),
    # ------------------------------------------------------------------ ação externa
    _c("acao_do_motor_nasce_como_proposta_no_card_pronto", U, PROPOE_ACAO_DO_MOTOR, "PRONTO", {"U1": "PRONTA"},
       {"A1": "PROPOSTA"}),
    _c("acao_aprovada_executa_e_conclui", U, ACAO_AUTORIZADA_E_CONCLUIDA, "PRONTO", {"U1": "PRONTA"}, {"A1": "EXECUTADA"}),
    _c("acao_aprovada_executa_e_falha_sem_repetir", U, ACAO_AUTORIZADA_E_FALHA, "PRONTO", {"U1": "PRONTA"}, {"A1": "FALHOU"}),
    _c("acao_esquecida_expira_sem_executar", U, ACAO_ESQUECIDA, "PRONTO", {"U1": "PRONTA"}, {"A1": "EXPIRADA"}),
    _c("acao_so_do_fundador_nao_aceita_o_aprovar", U,
       PROPOE_ACAO_SO_DO_FUNDADOR + [fundador("APROVAR", "acao:A1"), fundador("RESPONDER", "acao:A1", opcao="FEITO_POR_MIM")],
       "PRONTO", {"U1": "PRONTA"}, {"A1": "FEITA_PELO_FUNDADOR"},
       destinos=["PASSAGEM"] * 4 + ["COMENTARIO_NO_CARD", "PASSAGEM"]),
    _c("acao_recusada_pelo_fundador", U, PROPOE_ACAO_DO_MOTOR + [fundador("CANCELAR", "acao:A1")], "PRONTO", {"U1": "PRONTA"},
       {"A1": "RECUSADA"}),
    _c("acao_sem_confirmacao_vira_incerta_e_o_fundador_confirma", U,
       ACAO_AUTORIZADA_E_CONCLUIDA[:-1] + [relogio("TEMPO_ESGOTADO", "acao:A1"), fundador("RESPONDER", "acao:A1", opcao="ACONTECEU")],
       "PRONTO", {"U1": "PRONTA"}, {"A1": "EXECUTADA"}),
    _c("acao_incerta_que_o_fundador_ignora_nunca_e_refeita", U,
       ACAO_AUTORIZADA_E_CONCLUIDA[:-1] + [relogio("TEMPO_ESGOTADO", "acao:A1"), relogio("LEMBRETE_24H", "acao:A1"),
                                           relogio("LEMBRETE_48H", "acao:A1"), relogio("PRAZO_ESPERA_VENCIDO", "acao:A1")],
       "PRONTO", {"U1": "PRONTA"}, {"A1": "NAO_CONFIRMADA"}),
    _c("ordem_de_acao_executada_so_uma_vez", U, ACAO_AUTORIZADA_E_CONCLUIDA + [motor("ACAO_FALHOU", "acao:A1"),
       fundador("APROVAR", "acao:A1")], "PRONTO", {"U1": "PRONTA"}, {"A1": "EXECUTADA"}),
    # ------------------------------------------------------------------ roteiro de prova (E1 || E2 -> EJ -> ER)
    _c("prova_a_etapa_que_depende_so_comeca_com_a_anterior_aprovada", ROTEIRO_PROVA, PROVA_E1_APROVADA, "EM_ANDAMENTO",
       {"E1": "APROVADA", "E2": "EXECUTANDO", "EJ": "AGUARDANDO_ANTERIORES", "ER": "AGUARDANDO_ANTERIORES"}),
    _c("prova_o_julgador_comeca_depois_da_peca_julgada", ROTEIRO_PROVA, PROVA_E2_E_EJ_APROVADAS, "EM_ANDAMENTO",
       {"E1": "EXECUTANDO", "E2": "APROVADA", "EJ": "APROVADA", "ER": "AGUARDANDO_ANTERIORES"}),
    _c("prova_decisao_nova_refaz_o_que_usava_a_decisao", ROTEIRO_PROVA, DECISAO_MUDA_COM_E1_APROVADA, "EM_ANDAMENTO",
       {"E1": "EXECUTANDO", "E2": "EXECUTANDO", "EJ": "AGUARDANDO_ANTERIORES", "ER": "AGUARDANDO_ANTERIORES"}),
    _c("prova_ajuste_na_peca_refaz_quem_a_julgou", ROTEIRO_PROVA, AJUSTE_EM_E2_COM_EJ_APROVADA, "EM_ANDAMENTO",
       {"E1": "EXECUTANDO", "E2": "EXECUTANDO", "EJ": "AGUARDANDO_ANTERIORES", "ER": "AGUARDANDO_ANTERIORES"}),
    _c("prova_a_quarta_ordem_substitui_o_card", ROTEIRO_PROVA, ajustes_seguidos(4), "CANCELADO",
       {"E1": "CANCELADA", "E2": "CANCELADA", "EJ": "CANCELADA", "ER": "CANCELADA"}),
    _c("prova_tres_ordens_ainda_cabem", ROTEIRO_PROVA, ajustes_seguidos(3), "EM_ANDAMENTO",
       {"E1": "EXECUTANDO", "E2": "EXECUTANDO", "EJ": "AGUARDANDO_ANTERIORES", "ER": "AGUARDANDO_ANTERIORES"}),
]


def _prova_de_ponta_a_ponta():
    """E1 e E2 -> EJ -> ER, todas aprovadas pelo revisor certo: o card fica pronto e o relatório (ER) é a última."""
    return [
        helena("LER_DE_VOLTA"),
        entrega("E1", "CAIO"), portao_ok("E1", "CLARA"), revisor("APROVAR", "E1", "CLARA"),
        entrega("E2", "ISABELA", usou_internet="SIM"), portao_ok("E2", "RAVI"), revisor("APROVAR", "E2", "RAVI"),
        entrega("EJ", "CLARA", usou_internet="SIM"), portao_ok("EJ", "HELENA"), revisor("APROVAR", "EJ", "HELENA"),
        fundador("APROVAR", "EJ"),       # o jurídico tem o fundador como segundo revisor (só na máquina real; a referência recusa)
        entrega("ER", "HELENA"), portao_ok("ER", "CLARA"), revisor("APROVAR", "ER", "CLARA"),
    ]


CENARIOS.append(_c("prova_de_ponta_a_ponta_chega_ao_card_pronto", ROTEIRO_PROVA, _prova_de_ponta_a_ponta(), "PRONTO",
                   {"E1": "PRONTA", "E2": "PRONTA", "EJ": "PRONTA", "ER": "PRONTA"}))


# ---------------------------------------------------------------------------- conferência (usada pelos dois alvos)
def divergencias(cenario, execucao):
    """O que a execução tem de diferente do esperado no cenário (lista vazia = igual)."""
    f, e = execucao.foto_final, cenario.esperado
    erros = []
    if f.card["estado"] != e["card"]:
        erros.append(f"card terminou em {f.card['estado']} (esperado {e['card']})")
    for i, estado in e["etapas"].items():
        if f.etapas[i].estado != estado:
            erros.append(f"etapa {i} terminou em {f.etapas[i].estado} (esperado {estado})")
    acoes = {i: a.estado for i, a in f.acoes.items()}
    if acoes != e["acoes"]:
        erros.append(f"ações terminaram em {acoes} (esperado {e['acoes']})")
    for i, n in e.get("execucoes", {}).items():
        if f.etapas[i].execucoes != n:
            erros.append(f"etapa {i} com {f.etapas[i].execucoes} execuções (esperado {n})")
    if "destinos" in e:
        destinos = [r.destino for r in execucao.respostas]
        if destinos != e["destinos"]:
            erros.append(f"destinos {destinos} (esperado {e['destinos']})")
    return erros
