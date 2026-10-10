"""Cada invariante tem um caso que ela precisa PEGAR (negativo) e um que precisa deixar passar (positivo).

Aqui o estado é montado à mão (antes e depois de UM evento), sem nenhuma implementação no meio:
isso prova que o checador acusa o defeito mesmo quando o alvo mente. No fim, um teste confere que
nenhuma invariante ficou sem caso negativo.
"""
import pytest

from ajudantes import acao, etapa, foto
from simulador.eventos import Resposta, autor, fundador, helena, motor, relogio, revisor, vigia
from simulador.invariantes import INVARIANTES, Passo, Verificador
from simulador.roteiro import ROTEIRO_PROVA
from simulador.vocabulario import LIMITE_INICIOS_SEM_ORDEM, TETO_EXECUCOES

COBERTAS = set()


def cobre(nome):
    """Marca o teste como o caso negativo de uma invariante."""
    def marcar(funcao):
        COBERTAS.add(nome)
        return funcao
    return marcar


def achar(nome, evento, antes, depois, resposta=None, roteiro=ROTEIRO_PROVA, memoria=None):
    resposta = resposta if resposta is not None else Resposta(True)
    passo = Passo(0, evento, resposta, antes, depois, roteiro, {} if memoria is None else memoria)
    return INVARIANTES[nome](passo)


OK = Resposta(True)
RECUSADA = Resposta(False, "RECUSADO")
QUALQUER = relogio("PRAZO_80")


# ============================================================================ 1. teto_de_execucoes
@cobre("teto_de_execucoes")
def test_teto_etapa_com_sete_execucoes_e_acusada():
    f = foto(etapas=[etapa("E1", "NA_FILA", execucoes=TETO_EXECUCOES + 1)])
    assert achar("teto_de_execucoes", QUALQUER, f, f)


def test_teto_etapa_com_seis_execucoes_passa():
    f = foto(etapas=[etapa("E1", "NA_FILA", execucoes=TETO_EXECUCOES)])
    assert achar("teto_de_execucoes", QUALQUER, f, f) == []


def _inicio(alvo="E1", nome="INICIAR_EXECUCAO"):
    return Resposta(True, automaticos=(("MOTOR", nome, alvo),))


@cobre("teto_de_execucoes")
def test_teto_conta_a_parte_as_execucoes_iniciadas_sem_ordem_do_fundador():
    """Mesmo que o alvo minta no contador, a conta própria do checador pega o laço."""
    f = foto(etapas=[etapa("E1", "EXECUTANDO", execucoes=0)])       # o contador do alvo mente: sempre zero
    memoria = {}
    for _ in range(LIMITE_INICIOS_SEM_ORDEM):
        assert achar("teto_de_execucoes", QUALQUER, f, f, _inicio(), memoria=memoria) == []
    achadas = achar("teto_de_execucoes", QUALQUER, f, f, _inicio(), memoria=memoria)
    assert len(achadas) == 1 and "sem ordem do fundador" in achadas[0]


def test_teto_conta_a_parte_tambem_as_revisoes():
    f = foto(etapas=[etapa("E1", "REVISAO")])
    memoria = {}
    achadas = []
    for _ in range(LIMITE_INICIOS_SEM_ORDEM + 1):
        achadas = achar("teto_de_execucoes", QUALQUER, f, f, _inicio(nome="INICIAR_REVISAO"), memoria=memoria)
    assert achadas


def test_teto_ordem_do_fundador_aceita_zera_a_conta():
    f = foto(etapas=[etapa("E1", "EXECUTANDO")])
    memoria = {}
    for _ in range(LIMITE_INICIOS_SEM_ORDEM):
        achar("teto_de_execucoes", QUALQUER, f, f, _inicio(), memoria=memoria)
    achar("teto_de_execucoes", fundador("PEDIR_AJUSTE", "E1"), f, f, OK, memoria=memoria)       # nova rodada
    for _ in range(LIMITE_INICIOS_SEM_ORDEM):
        assert achar("teto_de_execucoes", QUALQUER, f, f, _inicio(), memoria=memoria) == []


def test_teto_decisao_nova_tambem_zera_a_conta():
    f = foto(etapas=[etapa("E1", "EXECUTANDO")])
    memoria = {}
    for _ in range(LIMITE_INICIOS_SEM_ORDEM):
        achar("teto_de_execucoes", QUALQUER, f, f, _inicio(), memoria=memoria)
    achar("teto_de_execucoes", motor("DECISAO_MUDOU"), f, f, OK, memoria=memoria)
    assert achar("teto_de_execucoes", QUALQUER, f, f, _inicio(), memoria=memoria) == []


@pytest.mark.parametrize("evento", [fundador("RESPONDER", "E1", opcao="REFAZER"), fundador("RESPONDER", "E1", opcao="ESPERAR"),
                                    fundador("RESPONDER", "E1", opcao="MODELO_MENOR")], ids=lambda e: e.rotulo)
def test_teto_ordens_de_refazer_esperar_e_modelo_menor_tambem_zeram_a_conta(evento):
    f = foto(etapas=[etapa("E1", "EXECUTANDO")])
    memoria = {}
    for _ in range(LIMITE_INICIOS_SEM_ORDEM):
        achar("teto_de_execucoes", QUALQUER, f, f, _inicio(), memoria=memoria)
    achar("teto_de_execucoes", evento, f, f, OK, memoria=memoria)
    assert achar("teto_de_execucoes", QUALQUER, f, f, _inicio(), memoria=memoria) == []


@cobre("teto_de_execucoes")
@pytest.mark.parametrize("evento", [fundador("MUDAR_PRAZO"), fundador("APROVAR", "acao:A1"), fundador("CANCELAR", "acao:A1"),
                                    fundador("RESPONDER", "E1", opcao="RESPOSTA_A"), fundador("USAR_COMO_EXEMPLO", "E1")],
                         ids=lambda e: e.rotulo)
def test_teto_toque_do_fundador_que_nao_reabre_nada_nao_zera_a_conta(evento):
    """Se qualquer toque aceito zerasse a conta, um fundador mudando o prazo esconderia um laço de execuções."""
    f = foto(etapas=[etapa("E1", "EXECUTANDO")])
    memoria = {}
    for _ in range(LIMITE_INICIOS_SEM_ORDEM):
        achar("teto_de_execucoes", QUALQUER, f, f, _inicio(), memoria=memoria)
    achar("teto_de_execucoes", evento, f, f, OK, memoria=memoria)
    assert achar("teto_de_execucoes", QUALQUER, f, f, _inicio(), memoria=memoria)


@cobre("teto_de_execucoes")
def test_teto_toque_do_fundador_recusado_nao_zera_a_conta():
    f = foto(etapas=[etapa("E1", "EXECUTANDO")])
    memoria = {}
    for _ in range(LIMITE_INICIOS_SEM_ORDEM):
        achar("teto_de_execucoes", QUALQUER, f, f, _inicio(), memoria=memoria)
    achar("teto_de_execucoes", fundador("PAUSAR_TUDO"), f, f, Resposta(False, "REACAO"), memoria=memoria)
    assert achar("teto_de_execucoes", QUALQUER, f, f, _inicio(), memoria=memoria)


# ============================================================================ 2. dono_e_prazo
@cobre("dono_e_prazo")
def test_dono_estado_fora_do_vocabulario_e_acusado():
    f = foto(etapas=[etapa("E1", "VOANDO")])
    assert any("fora do vocabulário" in m for m in achar("dono_e_prazo", QUALQUER, f, f))


@cobre("dono_e_prazo")
def test_dono_estado_aberto_sem_dono_nem_prazo_e_acusado():
    sem = {m: dict(t) for m, t in foto().donos.items()}
    del sem["etapa"]["EM_RESOLUCAO"]
    f = foto(etapas=[etapa("E1", "EM_RESOLUCAO")], donos_=sem)
    achadas = achar("dono_e_prazo", QUALQUER, f, f)
    assert any("sem dono" in m for m in achadas) and any("sem prazo" in m for m in achadas)


@cobre("dono_e_prazo")
def test_dono_prazo_vazio_e_acusado_mesmo_com_dono():
    sem = {m: dict(t) for m, t in foto().donos.items()}
    sem["acao_externa"]["PROPOSTA"] = ("FUNDADOR", "")
    f = foto(acoes=[acao("A1", "PROPOSTA")], donos_=sem)
    assert any("sem prazo" in m for m in achar("dono_e_prazo", QUALQUER, f, f))


@cobre("dono_e_prazo")
def test_dono_card_aberto_sem_dono_e_acusado():
    sem = {m: dict(t) for m, t in foto().donos.items()}
    sem["card"]["ESPERANDO_FUNDADOR"] = (None, "espera_do_fundador")
    f = foto("ESPERANDO_FUNDADOR", donos_=sem)
    assert any("card em ESPERANDO_FUNDADOR sem dono" in m for m in achar("dono_e_prazo", QUALQUER, f, f))


def test_dono_estados_finais_nao_precisam_de_dono():
    f = foto("PRONTO", etapas=[etapa("E1", "PRONTA")], acoes=[acao("A1", "EXECUTADA")])
    assert achar("dono_e_prazo", QUALQUER, f, f) == []


# ============================================================================ 3. ninguem_aprova_a_propria_peca
def test_ninguem_proibidos_de_revisar_no_roteiro_de_prova():
    assert ROTEIRO_PROVA.proibidos_de_revisar("E2") == ["CLARA", "HELENA", "ISABELA"]     # autora + quem julga depois
    assert ROTEIRO_PROVA.proibidos_de_revisar("E1") == ["CAIO"]


@cobre("ninguem_aprova_a_propria_peca")
@pytest.mark.parametrize("revisor_proibido", ["ISABELA", "CLARA", "HELENA"])
def test_ninguem_revisor_designado_proibido_e_acusado(revisor_proibido):
    antes = foto(etapas=[etapa("E2", "VALIDACAO")])
    depois = foto(etapas=[etapa("E2", "REVISAO", revisor=revisor_proibido)])
    assert achar("ninguem_aprova_a_propria_peca", motor("PORTAO1_OK", "E2", escolhido=revisor_proibido), antes, depois)


def test_ninguem_revisor_valido_e_o_fundador_passam():
    for valido in ("RAVI", "FUNDADOR"):
        antes = foto(etapas=[etapa("E2", "VALIDACAO")])
        depois = foto(etapas=[etapa("E2", "REVISAO", revisor=valido)])
        assert achar("ninguem_aprova_a_propria_peca", motor("PORTAO1_OK", "E2", escolhido=valido), antes, depois) == []


@cobre("ninguem_aprova_a_propria_peca")
@pytest.mark.parametrize("evento", ["APROVAR", "REPROVAR"])
def test_ninguem_autor_julgando_a_propria_peca_e_acusado(evento):
    f = foto(etapas=[etapa("E1", "REVISAO", revisor="CLARA")])
    achadas = achar("ninguem_aprova_a_propria_peca", autor(evento, "E1", "CAIO"), f, f)
    assert any("o autor julgou a própria peça" in m for m in achadas)


@cobre("ninguem_aprova_a_propria_peca")
def test_ninguem_revisor_que_nao_e_o_designado_aprovando_e_acusado():
    f = foto(etapas=[etapa("E1", "REVISAO", revisor="CLARA")])
    achadas = achar("ninguem_aprova_a_propria_peca", revisor("APROVAR", "E1", "HELENA"), f, f)
    assert any("sem ser o revisor designado" in m for m in achadas)


@cobre("ninguem_aprova_a_propria_peca")
def test_ninguem_autor_aprovando_como_revisor_e_acusado():
    f = foto(etapas=[etapa("E1", "REVISAO", revisor="CLARA")])
    achadas = achar("ninguem_aprova_a_propria_peca", revisor("APROVAR", "E1", "CAIO"), f, f)
    assert any("proibido de revisar" in m for m in achadas)


def test_ninguem_revisor_designado_aprovando_passa():
    antes = foto(etapas=[etapa("E1", "REVISAO", revisor="CLARA")])
    depois = foto(etapas=[etapa("E1", "APROVADA", revisor="CLARA")])
    assert achar("ninguem_aprova_a_propria_peca", revisor("APROVAR", "E1", "CLARA"), antes, depois) == []


def test_ninguem_aprovar_recusado_nao_conta():
    f = foto(etapas=[etapa("E1", "REVISAO", revisor="CLARA")])
    assert achar("ninguem_aprova_a_propria_peca", revisor("APROVAR", "E1", "CAIO"), f, f, RECUSADA) == []


# ============================================================================ 4. padrao_nunca_aprova
@cobre("padrao_nunca_aprova")
@pytest.mark.parametrize("quem", [relogio("PRAZO_ESPERA_VENCIDO", "E1"), motor("PORTAO1_OK", "E1", escolhido="CLARA"),
                                  vigia("SEM_EXECUCAO_VIVA", "E1"), helena("RECOMENDAR", "E1", opcao="SEGUIR_SEM"),
                                  autor("ENTREGAR", "E1", "CAIO")], ids=lambda e: e.rotulo)
def test_padrao_etapa_aprovada_por_quem_nao_pode_e_acusada(quem):
    antes = foto("ESPERANDO_FUNDADOR", etapas=[etapa("E1", "ESPERANDO_FUNDADOR", motivo="REVISAO")])
    depois = foto("ESPERANDO_FUNDADOR", etapas=[etapa("E1", "APROVADA")])
    assert achar("padrao_nunca_aprova", quem, antes, depois)


@cobre("padrao_nunca_aprova")
def test_padrao_aprovada_sem_a_resposta_ser_aceita_e_acusada():
    antes = foto(etapas=[etapa("E1", "REVISAO", revisor="CLARA")])
    depois = foto(etapas=[etapa("E1", "APROVADA", revisor="CLARA")])
    assert achar("padrao_nunca_aprova", revisor("APROVAR", "E1", "CLARA"), antes, depois, RECUSADA)


@cobre("padrao_nunca_aprova")
def test_padrao_aprovar_de_outra_etapa_nao_vale():
    antes = foto(etapas=[etapa("E1", "REVISAO", revisor="CLARA"), etapa("E2", "REVISAO", revisor="RAVI")])
    depois = foto(etapas=[etapa("E1", "APROVADA", revisor="CLARA"), etapa("E2", "APROVADA", revisor="RAVI")])
    achadas = achar("padrao_nunca_aprova", revisor("APROVAR", "E1", "CLARA"), antes, depois)
    assert len(achadas) == 1 and "E2" in achadas[0]


@pytest.mark.parametrize("quem", [revisor("APROVAR", "E1", "CLARA"), fundador("APROVAR", "E1")], ids=lambda e: e.rotulo)
def test_padrao_revisor_e_fundador_podem_aprovar(quem):
    antes = foto(etapas=[etapa("E1", "REVISAO", revisor="CLARA")])
    depois = foto(etapas=[etapa("E1", "APROVADA", revisor="CLARA")])
    assert achar("padrao_nunca_aprova", quem, antes, depois) == []


@cobre("padrao_nunca_aprova")
@pytest.mark.parametrize("quem", [relogio("LEMBRETE_24H", "acao:A1"), relogio("PRAZO_ESPERA_VENCIDO", "acao:A1"),
                                  motor("EXECUTAR_ACAO", "acao:A1"), autor("ENTREGAR", "E1", "CAIO"),
                                  fundador("RESPONDER", "acao:A1", opcao="CONFIRMO")], ids=lambda e: e.rotulo)
def test_padrao_acao_autorizada_por_quem_nao_e_o_fundador_aprovando_e_acusada(quem):
    antes = foto("PRONTO", acoes=[acao("A1", "PROPOSTA")])
    depois = foto("PRONTO", acoes=[acao("A1", "AUTORIZADA", ok_registrado=1)])
    assert achar("padrao_nunca_aprova", quem, antes, depois)


@cobre("padrao_nunca_aprova")
def test_padrao_ultima_etapa_que_vira_pronta_direto_por_relogio_e_acusada():
    """Quando a última etapa é aprovada o card fecha no mesmo passo e o APROVADA nem aparece na foto:
    o checador tem que olhar o PRONTA também."""
    antes = foto("EM_ANDAMENTO", etapas=[etapa("U1", "ESPERANDO_FUNDADOR", motivo="REVISAO")])
    depois = foto("PRONTO", etapas=[etapa("U1", "PRONTA")])
    assert achar("padrao_nunca_aprova", relogio("PRAZO_ESPERA_VENCIDO", "U1"), antes, depois)


def test_padrao_ultima_etapa_que_vira_pronta_por_aprovacao_valida_passa():
    antes = foto("EM_ANDAMENTO", etapas=[etapa("U1", "REVISAO", revisor="CLARA")])
    depois = foto("PRONTO", etapas=[etapa("U1", "PRONTA", revisor="CLARA")])
    assert achar("padrao_nunca_aprova", revisor("APROVAR", "U1", "CLARA"), antes, depois) == []


@cobre("padrao_nunca_aprova")
def test_padrao_acao_que_ja_nasce_executando_por_relogio_e_acusada():
    """Mesma coisa para a ação: o motor executa logo depois do ok, então o AUTORIZADA também some da foto."""
    antes = _acao_pronta("PROPOSTA")
    depois = _acao_pronta("EXECUTANDO_ACAO", ok_registrado=1, tentativas=1)
    assert achar("padrao_nunca_aprova", relogio("PRAZO_ESPERA_VENCIDO", "acao:A1"), antes, depois)


def test_padrao_acao_que_executa_depois_do_aprovar_do_fundador_passa():
    antes = _acao_pronta("PROPOSTA")
    depois = _acao_pronta("EXECUTANDO_ACAO", ok_registrado=1, tentativas=1)
    assert achar("padrao_nunca_aprova", fundador("APROVAR", "acao:A1"), antes, depois) == []


@pytest.mark.parametrize("de,para", [("EXECUTANDO_ACAO", "EXECUTADA"), ("INCERTA", "EXECUTADA"),
                                     ("AUTORIZADA", "EXECUTANDO_ACAO")])
def test_padrao_acao_que_ja_tinha_o_ok_segue_adiante_passa(de, para):
    antes = _acao_pronta(de, ok_registrado=1, tentativas=1)
    depois = _acao_pronta(para, ok_registrado=1, tentativas=1)
    assert achar("padrao_nunca_aprova", motor("ACAO_CONCLUIDA", "acao:A1"), antes, depois) == []


def test_padrao_fundador_aprova_acao_passa():
    antes = foto("PRONTO", acoes=[acao("A1", "PROPOSTA")])
    depois = foto("PRONTO", acoes=[acao("A1", "AUTORIZADA", ok_registrado=1)])
    assert achar("padrao_nunca_aprova", fundador("APROVAR", "acao:A1"), antes, depois) == []


# ============================================================================ 5. nada_externo_pelo_agente
def _acao_pronta(estado="PROPOSTA", **campos):
    return foto("PRONTO", acoes=[acao("A1", estado, **campos)])


@cobre("nada_externo_pelo_agente")
@pytest.mark.parametrize("quem", [autor("EXECUTAR_ACAO", "acao:A1", "CAIO"), revisor("APROVAR", "acao:A1", "CLARA"),
                                  helena("RECOMENDAR", "acao:A1", opcao="REFAZER")], ids=lambda e: e.rotulo)
def test_externo_ia_mexendo_numa_acao_e_acusada(quem):
    assert achar("nada_externo_pelo_agente", quem, _acao_pronta("PROPOSTA"), _acao_pronta("RECUSADA"))


@cobre("nada_externo_pelo_agente")
def test_externo_acao_que_nasce_ja_autorizada_e_acusada():
    antes = foto("PRONTO")
    depois = _acao_pronta("EXECUTANDO_ACAO", ok_registrado=1, tentativas=1)
    achadas = achar("nada_externo_pelo_agente", autor("ENTREGAR", "E1", "CAIO"), antes, depois)
    assert any("nasceu já em EXECUTANDO_ACAO" in m for m in achadas)


@cobre("nada_externo_pelo_agente")
def test_externo_acao_que_nasce_com_o_card_ainda_aberto_e_acusada():
    antes = foto("EM_ANDAMENTO")
    depois = foto("EM_ANDAMENTO", acoes=[acao("A1", "PROPOSTA")])
    achadas = achar("nada_externo_pelo_agente", autor("ENTREGAR", "E1", "CAIO"), antes, depois)
    assert any("nasceu com o card em EM_ANDAMENTO" in m for m in achadas)


@cobre("nada_externo_pelo_agente")
@pytest.mark.parametrize("estado", ["AUTORIZADA", "EXECUTANDO_ACAO", "EXECUTADA"])
def test_externo_acao_sem_o_ok_registrado_e_acusada(estado):
    f = _acao_pronta(estado, ok_registrado=0, tentativas=1)
    assert any("sem o ok registrado" in m for m in achar("nada_externo_pelo_agente", relogio("TEMPO_ESGOTADO"), f, f))


@cobre("nada_externo_pelo_agente")
def test_externo_acao_executada_duas_vezes_e_acusada():
    f = _acao_pronta("EXECUTANDO_ACAO", ok_registrado=1, tentativas=2)
    assert any("executada 2 vezes" in m for m in achar("nada_externo_pelo_agente", relogio("TEMPO_ESGOTADO"), f, f))


@cobre("nada_externo_pelo_agente")
@pytest.mark.parametrize("quem", [relogio("LEMBRETE_24H", "acao:A1"), motor("PORTAO1_OK", "E1", escolhido="CLARA"),
                                  vigia("SEM_EXECUCAO_VIVA", "E1")], ids=lambda e: e.rotulo)
def test_externo_ok_registrado_por_quem_nao_e_o_fundador_e_acusado(quem):
    achadas = achar("nada_externo_pelo_agente", quem, _acao_pronta("PROPOSTA"), _acao_pronta("PROPOSTA", ok_registrado=1))
    assert any("ganhou o ok registrado" in m for m in achadas)


@cobre("nada_externo_pelo_agente")
def test_externo_executar_sem_disparo_do_motor_e_acusado():
    antes = _acao_pronta("AUTORIZADA", ok_registrado=1)
    depois = _acao_pronta("EXECUTANDO_ACAO", ok_registrado=1, tentativas=1)
    assert any("sem o disparo do motor" in m for m in achar("nada_externo_pelo_agente", relogio("TEMPO_ESGOTADO"), antes, depois))


def test_externo_caminho_certo_passa():
    """Nasce como proposta no card pronto; o fundador aprova; o motor dispara a execução sozinho; uma tentativa."""
    assert achar("nada_externo_pelo_agente", motor("TODAS_PRONTAS"), foto("EM_ANDAMENTO"), _acao_pronta("PROPOSTA")) == []
    aprovada = _acao_pronta("AUTORIZADA", ok_registrado=1)
    assert achar("nada_externo_pelo_agente", fundador("APROVAR", "acao:A1"), _acao_pronta("PROPOSTA"), aprovada) == []
    executando = _acao_pronta("EXECUTANDO_ACAO", ok_registrado=1, tentativas=1)
    disparo = Resposta(True, automaticos=(("MOTOR", "EXECUTAR_ACAO", "acao:A1"),))
    assert achar("nada_externo_pelo_agente", fundador("APROVAR", "acao:A1"), _acao_pronta("PROPOSTA"), executando, disparo) == []


# ============================================================================ 6. pronto_sem_informacao_velha
@cobre("pronto_sem_informacao_velha")
@pytest.mark.parametrize("estado", ["NA_FILA", "EXECUTANDO", "REVISAO", "EM_RESOLUCAO", "AGUARDANDO_ANTERIORES"])
def test_velha_card_pronto_com_etapa_nao_aprovada_e_acusado(estado):
    antes = foto("EM_ANDAMENTO", etapas=[etapa("E1", "APROVADA"), etapa("E2", estado)])
    depois = foto("PRONTO", etapas=[etapa("E1", "PRONTA"), etapa("E2", estado)])
    assert achar("pronto_sem_informacao_velha", motor("TODAS_PRONTAS"), antes, depois)


@cobre("pronto_sem_informacao_velha")
def test_velha_etapa_aprovada_sobre_anterior_que_voltou_e_acusada():
    f = foto("EM_ANDAMENTO", etapas=[etapa("E2", "NA_FILA"), etapa("EJ", "APROVADA")])
    achadas = achar("pronto_sem_informacao_velha", fundador("PEDIR_AJUSTE", "E2"), f, f)
    assert any("etapa EJ em APROVADA sobre a anterior E2" in m for m in achadas)


@cobre("pronto_sem_informacao_velha")
def test_velha_etapa_pronta_sobre_anterior_que_voltou_e_acusada():
    f = foto("PRONTO", etapas=[etapa("E2", "NA_FILA"), etapa("EJ", "PRONTA")])
    assert achar("pronto_sem_informacao_velha", QUALQUER, f, f)


@cobre("pronto_sem_informacao_velha")
def test_velha_decisao_nova_com_etapa_que_continua_aprovada_e_acusada():
    f = foto("EM_ANDAMENTO", etapas=[etapa("E1", "APROVADA")])
    achadas = achar("pronto_sem_informacao_velha", motor("DECISAO_MUDOU"), f, f)
    assert any("continuou APROVADA depois de a decisão mudar" in m for m in achadas)


def test_velha_decisao_nova_com_etapa_reaberta_passa():
    antes = foto("EM_ANDAMENTO", etapas=[etapa("E1", "APROVADA")])
    depois = foto("EM_ANDAMENTO", etapas=[etapa("E1", "EXECUTANDO", exec_viva=1)])
    assert achar("pronto_sem_informacao_velha", motor("DECISAO_MUDOU"), antes, depois) == []


def test_velha_decisao_nova_recusada_nao_cobra_nada():
    f = foto("EM_ANDAMENTO", etapas=[etapa("E1", "APROVADA")])
    assert achar("pronto_sem_informacao_velha", motor("DECISAO_MUDOU"), f, f, RECUSADA) == []


def test_velha_etapa_pulada_libera_quem_depende():
    f = foto("PRONTO", etapas=[etapa("E1", "PRONTA"), etapa("E2", "ENCERRADA_COM_FALHA", fim="PULADA"),
                               etapa("EJ", "PRONTA"), etapa("ER", "PRONTA")])
    assert achar("pronto_sem_informacao_velha", QUALQUER, f, f) == []


# ============================================================================ 7. card_final_nao_volta
@cobre("card_final_nao_volta")
@pytest.mark.parametrize("final", ["PRONTO", "CANCELADO", "ENCERRADO_COM_FALHA"])
def test_final_card_final_que_volta_a_andar_e_acusado(final):
    assert achar("card_final_nao_volta", fundador("PEDIR_AJUSTE", "E1"), foto(final), foto("EM_ANDAMENTO"))


@cobre("card_final_nao_volta")
def test_final_card_final_que_muda_so_um_campo_e_acusado():
    assert achar("card_final_nao_volta", QUALQUER, foto("CANCELADO", ordens=1), foto("CANCELADO", ordens=2))


def test_final_card_final_igual_passa():
    assert achar("card_final_nao_volta", QUALQUER, foto("PRONTO"), foto("PRONTO")) == []


@cobre("card_final_nao_volta")
@pytest.mark.parametrize("final", ["PRONTA", "CANCELADA", "ENCERRADA_COM_FALHA"])
def test_final_etapa_final_que_volta_a_andar_e_acusada(final):
    assert achar("card_final_nao_volta", QUALQUER, foto(etapas=[etapa("E1", final)]), foto(etapas=[etapa("E1", "NA_FILA")]))


@cobre("card_final_nao_volta")
def test_final_etapa_final_que_some_e_acusada():
    assert achar("card_final_nao_volta", QUALQUER, foto(etapas=[etapa("E1", "PRONTA")]), foto())


def test_final_etapa_final_que_ganha_versao_nova_passa():
    """Uma versão nova da etapa (card novo ligado, resposta tardia) pode recomeçar; o que não pode é voltar na mesma versão."""
    assert achar("card_final_nao_volta", QUALQUER, foto(etapas=[etapa("E1", "ENCERRADA_COM_FALHA", versao=0)]),
                 foto(etapas=[etapa("E1", "NA_FILA", versao=1)])) == []


@cobre("card_final_nao_volta")
@pytest.mark.parametrize("final", ["EXECUTADA", "FEITA_PELO_FUNDADOR", "RECUSADA", "EXPIRADA", "FALHOU", "NAO_CONFIRMADA", "CANCELADA"])
def test_final_acao_final_que_volta_e_acusada(final):
    assert achar("card_final_nao_volta", QUALQUER, _acao_pronta(final), _acao_pronta("AUTORIZADA", ok_registrado=1))


# ============================================================================ 8. etapas_seguem_o_card
@cobre("etapas_seguem_o_card")
@pytest.mark.parametrize("card", ["CANCELADO", "ENCERRADO_COM_FALHA"])
def test_cascata_etapa_aberta_com_card_fechado_e_acusada(card):
    f = foto(card, etapas=[etapa("E1", "PRONTA"), etapa("E2", "NA_FILA")])
    assert any("etapa E2 continua em NA_FILA" in m for m in achar("etapas_seguem_o_card", QUALQUER, f, f))


@cobre("etapas_seguem_o_card")
@pytest.mark.parametrize("estado", ["PROPOSTA", "AUTORIZADA"])
def test_cascata_acao_aberta_com_card_cancelado_e_acusada(estado):
    f = foto("CANCELADO", acoes=[acao("A1", estado)])
    assert any("ação A1" in m for m in achar("etapas_seguem_o_card", QUALQUER, f, f))


@cobre("etapas_seguem_o_card")
@pytest.mark.parametrize("card", ["RASCUNHO", "ESPERANDO_CONFIRMACAO", "VALIDANDO_PLANO"])
def test_cascata_etapa_andando_antes_do_plano_valer_e_acusada(card):
    f = foto(card, etapas=[etapa("E1", "EXECUTANDO", exec_viva=1)])
    assert any("etapa E1 está em EXECUTANDO" in m for m in achar("etapas_seguem_o_card", QUALQUER, f, f))


def test_cascata_antes_do_plano_etapas_paradas_passam():
    f = foto("RASCUNHO", etapas=[etapa("E1", "AGUARDANDO_ANTERIORES"), etapa("E2", "AGUARDANDO_ANTERIORES")])
    assert achar("etapas_seguem_o_card", QUALQUER, f, f) == []


def test_cascata_card_cancelado_com_tudo_fechado_passa():
    f = foto("CANCELADO", etapas=[etapa("E1", "CANCELADA"), etapa("E2", "PRONTA")], acoes=[acao("A1", "RECUSADA")])
    assert achar("etapas_seguem_o_card", QUALQUER, f, f) == []


# ============================================================================ 9. resposta_antiga_nao_grava
@cobre("resposta_antiga_nao_grava")
@pytest.mark.parametrize("quem", [autor("ENTREGAR", "E1", "CAIO", "antiga"), revisor("APROVAR", "E1", "CLARA", "antiga"),
                                  helena("RECOMENDAR", "E1", "antiga", opcao="REFAZER"),
                                  fundador("APROVAR", "E1", "antiga"), fundador("PEDIR_AJUSTE", "E1", "antiga"),
                                  fundador("RESPONDER", "E1", "antiga", opcao="CONFIRMO")], ids=lambda e: e.rotulo)
def test_antiga_resposta_antiga_aceita_e_acusada(quem):
    f = foto(etapas=[etapa("E1", "EXECUTANDO")])
    assert achar("resposta_antiga_nao_grava", quem, f, f, OK)


@cobre("resposta_antiga_nao_grava")
def test_antiga_resposta_antiga_recusada_mas_que_mudou_o_estado_e_acusada():
    antes = foto(etapas=[etapa("E1", "EXECUTANDO")])
    depois = foto(etapas=[etapa("E1", "VALIDACAO")])
    assert achar("resposta_antiga_nao_grava", autor("ENTREGAR", "E1", "CAIO", "antiga"), antes, depois, RECUSADA)


def test_antiga_resposta_antiga_recusada_sem_mudar_nada_passa():
    f = foto(etapas=[etapa("E1", "EXECUTANDO")])
    assert achar("resposta_antiga_nao_grava", autor("ENTREGAR", "E1", "CAIO", "antiga"), f, f, RECUSADA) == []


@pytest.mark.parametrize("quem", [fundador("CANCELAR", chave="antiga"), fundador("PAUSAR_TUDO", chave="antiga")],
                         ids=lambda e: e.rotulo)
def test_antiga_botoes_sem_versao_continuam_valendo(quem):
    """Cancelar sempre vale, mesmo com a tela velha."""
    antes, depois = foto("EM_ANDAMENTO"), foto("CANCELADO")
    assert achar("resposta_antiga_nao_grava", quem, antes, depois, OK) == []


def test_antiga_chave_atual_nao_e_cobrada():
    antes, depois = foto(etapas=[etapa("E1", "EXECUTANDO")]), foto(etapas=[etapa("E1", "VALIDACAO")])
    assert achar("resposta_antiga_nao_grava", autor("ENTREGAR", "E1", "CAIO"), antes, depois, OK) == []


# ============================================================================ 10. recusa_nao_muda_nada
@cobre("recusa_nao_muda_nada")
@pytest.mark.parametrize("destino", ["RECUSADO", "COMENTARIO_NO_CARD", "REACAO", "CARD_NOVO_LIGADO"])
def test_recusa_que_mudou_o_estado_e_acusada(destino):
    antes, depois = foto("EM_ANDAMENTO"), foto("EM_ANDAMENTO", ordens=1)
    assert achar("recusa_nao_muda_nada", fundador("PAUSAR_TUDO"), antes, depois, Resposta(False, destino))


@pytest.mark.parametrize("onde", ["card", "etapa", "acao"])
def test_recusa_mudanca_em_qualquer_parte_e_acusada(onde):
    antes = foto(etapas=[etapa("E1", "EXECUTANDO")], acoes=[acao("A1", "PROPOSTA")])
    depois = {"card": foto(ordens=1, etapas=[etapa("E1", "EXECUTANDO")], acoes=[acao("A1", "PROPOSTA")]),
              "etapa": foto(etapas=[etapa("E1", "EXECUTANDO", execucoes=1)], acoes=[acao("A1", "PROPOSTA")]),
              "acao": foto(etapas=[etapa("E1", "EXECUTANDO")], acoes=[acao("A1", "PROPOSTA", lembretes=1)])}[onde]
    assert achar("recusa_nao_muda_nada", relogio("TEMPO_ESGOTADO", "E1"), antes, depois, RECUSADA)


def test_recusa_sem_mudanca_passa():
    f = foto(etapas=[etapa("E1", "EXECUTANDO")])
    assert achar("recusa_nao_muda_nada", relogio("TEMPO_ESGOTADO", "E9"), f, f, RECUSADA) == []


def test_recusa_evento_aceito_pode_mudar():
    assert achar("recusa_nao_muda_nada", fundador("CANCELAR"), foto("EM_ANDAMENTO"), foto("CANCELADO"), OK) == []


# ============================================================================ 11. quem_leu_internet_so_entrega
@cobre("quem_leu_internet_so_entrega")
@pytest.mark.parametrize("evento", ["PERGUNTAR", "DEVOLVER_A_QUEM_PEDIU", "PEDIR_SUBCARD"])
def test_internet_pergunta_ou_pedido_depois_de_ler_a_internet_e_acusado(evento):
    f = foto(etapas=[etapa("E2", "EXECUTANDO")])
    assert achar("quem_leu_internet_so_entrega", autor(evento, "E2", "ISABELA", usou_internet="SIM"), f, f, OK)


@pytest.mark.parametrize("evento", ["ENTREGAR", "REGISTRAR_FALHA"])
def test_internet_entregar_e_registrar_falha_sao_permitidos(evento):
    f = foto(etapas=[etapa("E2", "EXECUTANDO")])
    assert achar("quem_leu_internet_so_entrega", autor(evento, "E2", "ISABELA", usou_internet="SIM"), f, f, OK) == []


def test_internet_pergunta_sem_internet_ou_recusada_passa():
    f = foto(etapas=[etapa("E2", "EXECUTANDO")])
    assert achar("quem_leu_internet_so_entrega", autor("PERGUNTAR", "E2", "ISABELA", usou_internet="NAO"), f, f, OK) == []
    assert achar("quem_leu_internet_so_entrega", autor("PERGUNTAR", "E2", "ISABELA", usou_internet="SIM"), f, f, RECUSADA) == []


def test_internet_pergunta_convertida_em_formato_errado_passa():
    f = foto(etapas=[etapa("E2", "EXECUTANDO")])
    resposta = Resposta(True, "FORMATO_ERRADO")
    assert achar("quem_leu_internet_so_entrega", autor("PERGUNTAR", "E2", "ISABELA", usou_internet="SIM"), f, f, resposta) == []


# ============================================================================ 12. o_alvo_nao_acusou
@cobre("o_alvo_nao_acusou")
def test_alvo_acusacao_do_proprio_alvo_vira_violacao():
    f = foto()
    resposta = Resposta(True, violacoes_do_alvo=(("R05", "contador passou do teto"), ("R09", "aprovou sem revisor")))
    achadas = achar("o_alvo_nao_acusou", QUALQUER, f, f, resposta)
    assert len(achadas) == 2 and "[R05]" in achadas[0]


def test_alvo_sem_acusacao_passa():
    f = foto()
    assert achar("o_alvo_nao_acusou", QUALQUER, f, f, OK) == []


@cobre("o_alvo_nao_acusou")
def test_alvo_acusacao_final_vira_violacao_do_verificador():
    v = Verificador(ROTEIRO_PROVA)
    achadas = v.conferir_final((("R13", "o histórico não reconstrói o card"),))
    assert [a.invariante for a in achadas] == ["o_alvo_nao_acusou"] and v.violacoes == achadas


# ============================================================================ 13. contadores_dentro_do_teto
@cobre("contadores_dentro_do_teto")
@pytest.mark.parametrize("campo,valor", [("ordens", 4), ("perguntas", 3), ("lembretes", 3), ("nivel_prazo", 4),
                                         ("mudancas_prazo", 4)])
def test_contadores_do_card_acima_do_teto_sao_acusados(campo, valor):
    f = foto(**{campo: valor})
    achadas = achar("contadores_dentro_do_teto", QUALQUER, f, f)
    assert len(achadas) == 1 and campo in achadas[0]


@pytest.mark.parametrize("campo,valor", [("ordens", 3), ("perguntas", 2), ("lembretes", 2), ("nivel_prazo", 3),
                                         ("mudancas_prazo", 3)])
def test_contadores_do_card_no_teto_passam(campo, valor):
    f = foto(**{campo: valor})
    assert achar("contadores_dentro_do_teto", QUALQUER, f, f) == []


@cobre("contadores_dentro_do_teto")
def test_contadores_de_lembretes_de_etapa_e_acao_acima_do_teto_sao_acusados():
    f = foto("PRONTO", etapas=[etapa("E1", "ESPERANDO_FUNDADOR", lembretes=3)], acoes=[acao("A1", "PROPOSTA", lembretes=3)])
    achadas = achar("contadores_dentro_do_teto", QUALQUER, f, f)
    assert any("etapa E1" in m for m in achadas) and any("ação A1" in m for m in achadas)


# ============================================================================ 14. uma_execucao_viva_por_etapa
@cobre("uma_execucao_viva_por_etapa")
def test_viva_duas_execucoes_vivas_sao_acusadas():
    f = foto(etapas=[etapa("E1", "EXECUTANDO", exec_viva=2)])
    assert any("2 execuções vivas" in m for m in achar("uma_execucao_viva_por_etapa", QUALQUER, f, f))


@cobre("uma_execucao_viva_por_etapa")
@pytest.mark.parametrize("estado", ["NA_FILA", "VALIDACAO", "ESPERANDO_FUNDADOR", "EM_RESOLUCAO", "APROVADA", "AGUARDANDO_ANTERIORES"])
def test_viva_execucao_viva_fora_de_executando_e_revisao_e_acusada(estado):
    f = foto(etapas=[etapa("E1", estado, exec_viva=1)])
    assert achar("uma_execucao_viva_por_etapa", QUALQUER, f, f)


@pytest.mark.parametrize("estado,viva", [("EXECUTANDO", 1), ("REVISAO", 1), ("REVISAO", 0), ("NA_FILA", 0), ("PRONTA", 0)])
def test_viva_casos_certos_passam(estado, viva):
    f = foto(etapas=[etapa("E1", estado, exec_viva=viva)])
    assert achar("uma_execucao_viva_por_etapa", QUALQUER, f, f) == []


# ============================================================================ 15. ninguem_trabalha_sem_a_anterior
@cobre("ninguem_trabalha_sem_a_anterior")
@pytest.mark.parametrize("estado", ["NA_FILA", "EXECUTANDO", "VALIDACAO", "REVISAO", "ESPERANDO_FUNDADOR", "EM_RESOLUCAO"])
@pytest.mark.parametrize("anterior", ["AGUARDANDO_ANTERIORES", "NA_FILA", "EXECUTANDO", "REVISAO", "CANCELADA", "ENCERRADA_COM_FALHA"])
def test_anterior_etapa_trabalhando_com_a_anterior_nao_aprovada_e_acusada(estado, anterior):
    f = foto(etapas=[etapa("E2", anterior), etapa("EJ", estado)])
    achadas = achar("ninguem_trabalha_sem_a_anterior", QUALQUER, f, f)
    assert achadas and f"etapa EJ em {estado} com a anterior E2 em {anterior}" in achadas[0]


@pytest.mark.parametrize("anterior,fim", [("APROVADA", "NENHUM"), ("PRONTA", "CARD_PRONTO"), ("ENCERRADA_COM_FALHA", "PULADA")])
def test_anterior_aprovada_pronta_ou_pulada_libera_quem_depende(anterior, fim):
    f = foto(etapas=[etapa("E2", anterior, fim=fim), etapa("EJ", "EXECUTANDO", exec_viva=1)])
    assert achar("ninguem_trabalha_sem_a_anterior", QUALQUER, f, f) == []


def test_anterior_quem_aguarda_ou_ja_terminou_nao_e_cobrado():
    f = foto(etapas=[etapa("E2", "NA_FILA"), etapa("EJ", "AGUARDANDO_ANTERIORES"), etapa("ER", "CANCELADA")])
    assert achar("ninguem_trabalha_sem_a_anterior", QUALQUER, f, f) == []


def test_anterior_etapa_sem_dependencia_nunca_e_cobrada():
    f = foto(etapas=[etapa("E1", "EXECUTANDO", exec_viva=1), etapa("E2", "REVISAO")])
    assert achar("ninguem_trabalha_sem_a_anterior", QUALQUER, f, f) == []


# ============================================================================ 16. so_o_fundador_muda_o_prazo
@cobre("so_o_fundador_muda_o_prazo")
@pytest.mark.parametrize("quem", [helena("SUGERIR_PRAZO"), relogio("PRAZO_80"), motor("DECISAO_MUDOU"), vigia("REGRA_QUEBRADA"),
                                  autor("ENTREGAR", "E1", "CAIO"), fundador("MUDAR_PRIORIDADE"), fundador("MUDAR_PRAZO", "E1")],
                         ids=lambda e: e.rotulo)
def test_prazo_mudanca_por_quem_nao_pode_e_acusada(quem):
    assert achar("so_o_fundador_muda_o_prazo", quem, foto(mudancas_prazo=0), foto(mudancas_prazo=1))


@cobre("so_o_fundador_muda_o_prazo")
def test_prazo_mudanca_do_fundador_recusada_pelo_alvo_mas_que_mexeu_e_acusada():
    assert achar("so_o_fundador_muda_o_prazo", fundador("MUDAR_PRAZO"), foto(mudancas_prazo=0), foto(mudancas_prazo=1), RECUSADA)


@cobre("so_o_fundador_muda_o_prazo")
def test_prazo_avisos_rearmados_por_quem_nao_e_o_fundador_sao_acusados():
    assert achar("so_o_fundador_muda_o_prazo", relogio("PRAZO_80"), foto(nivel_prazo=2), foto(nivel_prazo=0))


def test_prazo_mudar_prazo_do_fundador_aceito_rearma_os_avisos_e_passa():
    antes, depois = foto(nivel_prazo=2, mudancas_prazo=1), foto(nivel_prazo=0, mudancas_prazo=2)
    assert achar("so_o_fundador_muda_o_prazo", fundador("MUDAR_PRAZO"), antes, depois) == []


def test_prazo_os_avisos_do_relogio_sobem_sem_problema():
    assert achar("so_o_fundador_muda_o_prazo", relogio("PRAZO_VENCIDO"), foto(nivel_prazo=1), foto(nivel_prazo=2)) == []


# ============================================================================ 17. todo_toque_do_fundador_tem_destino
@cobre("todo_toque_do_fundador_tem_destino")
@pytest.mark.parametrize("botao", ["APROVAR", "PEDIR_AJUSTE", "USAR_COMO_EXEMPLO", "CANCELAR", "RESPONDER", "PAUSAR_TUDO",
                                   "MUDAR_PRIORIDADE", "MUDAR_PRAZO"])
def test_destino_botao_jogado_fora_em_silencio_e_acusado(botao):
    f = foto(etapas=[etapa("E1", "EXECUTANDO")])
    assert achar("todo_toque_do_fundador_tem_destino", fundador(botao, "E1"), f, f, Resposta(False, "RECUSADO"))


@cobre("todo_toque_do_fundador_tem_destino")
def test_destino_toque_numa_acao_que_existe_tambem_precisa_de_destino():
    f = _acao_pronta("PROPOSTA")
    assert achar("todo_toque_do_fundador_tem_destino", fundador("APROVAR", "acao:A1"), f, f, Resposta(False, "RECUSADO"))


@pytest.mark.parametrize("destino", ["REACAO", "COMENTARIO_NO_CARD", "CARD_NOVO_LIGADO", "RESPOSTA_GUARDADA"])
def test_destino_cada_destino_do_toque_passa(destino):
    f = foto(etapas=[etapa("E1", "EXECUTANDO")])
    assert achar("todo_toque_do_fundador_tem_destino", fundador("APROVAR", "E1"), f, f, Resposta(False, destino)) == []


def test_destino_botao_que_virou_passagem_passa():
    f = foto(etapas=[etapa("E1", "EXECUTANDO")])
    assert achar("todo_toque_do_fundador_tem_destino", fundador("CANCELAR"), f, f, OK) == []


def test_destino_so_vale_para_botao_do_fundador_sobre_algo_que_existe():
    f = foto(etapas=[etapa("E1", "EXECUTANDO")])
    recusa = Resposta(False, "RECUSADO")
    assert achar("todo_toque_do_fundador_tem_destino", fundador("APROVAR", "E9"), f, f, recusa) == []          # alvo inexistente
    assert achar("todo_toque_do_fundador_tem_destino", fundador("APROVAR", "acao:A9"), f, f, recusa) == []
    assert achar("todo_toque_do_fundador_tem_destino", fundador("APAGAR_TUDO", "E1"), f, f, recusa) == []      # não é botão
    assert achar("todo_toque_do_fundador_tem_destino", relogio("TEMPO_ESGOTADO", "E1"), f, f, recusa) == []    # não é o fundador


# ============================================================================ 18. infra_nao_gasta_execucao
@cobre("infra_nao_gasta_execucao")
@pytest.mark.parametrize("quem", [motor("FALHA_INFRA", "E1", classe="COTA"), vigia("SEM_EXECUCAO_VIVA", "E1"),
                                  motor("SEM_CAPACIDADE", "E1", classe="LOGIN")], ids=lambda e: e.rotulo)
def test_infra_falha_de_infraestrutura_que_gasta_execucao_e_acusada(quem):
    antes = foto(etapas=[etapa("E1", "EXECUTANDO", execucoes=2, exec_viva=1)])
    depois = foto(etapas=[etapa("E1", "NA_FILA", execucoes=3)])
    assert any("gastou execução (2 -> 3)" in m for m in achar("infra_nao_gasta_execucao", quem, antes, depois))


def test_infra_sem_gasto_passa_e_falha_comum_pode_gastar():
    antes = foto(etapas=[etapa("E1", "EXECUTANDO", execucoes=2, exec_viva=1)])
    mesmo = foto(etapas=[etapa("E1", "NA_FILA", execucoes=2)])
    gastou = foto(etapas=[etapa("E1", "NA_FILA", execucoes=3)])
    assert achar("infra_nao_gasta_execucao", vigia("SEM_EXECUCAO_VIVA", "E1"), antes, mesmo) == []
    assert achar("infra_nao_gasta_execucao", relogio("TEMPO_ESGOTADO", "E1"), antes, gastou) == []        # tempo esgotado conta
    assert achar("infra_nao_gasta_execucao", motor("FALHA", "E1", classe="FORMATO_ERRADO"), antes, gastou) == []


def test_infra_recusada_nao_e_cobrada():
    antes = foto(etapas=[etapa("E1", "EXECUTANDO", execucoes=2)])
    depois = foto(etapas=[etapa("E1", "EXECUTANDO", execucoes=3)])
    assert achar("infra_nao_gasta_execucao", vigia("SEM_EXECUCAO_VIVA", "E1"), antes, depois, RECUSADA) == []


# ============================================================================ o Verificador
def test_verificador_numera_os_passos_e_guarda_o_evento():
    v = Verificador(ROTEIRO_PROVA)
    boa, ruim = foto(etapas=[etapa("E1", "NA_FILA")]), foto(etapas=[etapa("E1", "NA_FILA", execucoes=9)])
    assert v.conferir(QUALQUER, OK, boa, boa) == []
    achadas = v.conferir(relogio("TEMPO_ESGOTADO", "E1"), OK, boa, ruim)
    assert [(a.invariante, a.passo, a.evento) for a in achadas] == [("teto_de_execucoes", 1, "RELOGIO TEMPO_ESGOTADO em E1")]
    assert v.violacoes == achadas and v.indice == 2


def test_verificador_pode_rodar_so_algumas_invariantes():
    v = Verificador(ROTEIRO_PROVA, invariantes={"recusa_nao_muda_nada": INVARIANTES["recusa_nao_muda_nada"]})
    ruim = foto(etapas=[etapa("E1", "NA_FILA", execucoes=9)])
    assert v.conferir(QUALQUER, OK, ruim, ruim) == []          # o teto não está na lista
    assert v.conferir(QUALQUER, RECUSADA, foto(), foto(ordens=1))


def test_verificador_acusa_varias_invariantes_no_mesmo_passo():
    v = Verificador(ROTEIRO_PROVA)
    antes = foto("CANCELADO", etapas=[etapa("E1", "NA_FILA")])
    depois = foto("EM_ANDAMENTO", etapas=[etapa("E1", "NA_FILA", execucoes=9)])
    nomes = {a.invariante for a in v.conferir(QUALQUER, RECUSADA, antes, depois)}
    assert {"teto_de_execucoes", "card_final_nao_volta", "recusa_nao_muda_nada"} <= nomes


def test_verificador_estado_limpo_nao_acusa_nada():
    v = Verificador(ROTEIRO_PROVA)
    f = foto("RASCUNHO", etapas=[etapa(i, "AGUARDANDO_ANTERIORES") for i in ROTEIRO_PROVA.ids()])
    assert v.conferir(helena("LER_DE_VOLTA"), OK, f, f) == []


def test_violacao_vira_dicionario():
    v = Verificador(ROTEIRO_PROVA)
    ruim = foto(etapas=[etapa("E1", "NA_FILA", execucoes=9)])
    d = v.conferir(QUALQUER, OK, ruim, ruim)[0].como_dict()
    assert set(d) == {"invariante", "passo", "evento", "mensagem"}


# ============================================================================ nenhuma invariante sem caso negativo
def test_toda_invariante_tem_pelo_menos_um_caso_negativo():
    assert COBERTAS == set(INVARIANTES), f"sem caso negativo: {sorted(set(INVARIANTES) - COBERTAS)}"


def test_as_dezoito_invariantes_estao_registradas():
    assert len(INVARIANTES) == 18
    assert all(f.__doc__ for f in INVARIANTES.values()), "toda invariante precisa de uma explicação em português"
