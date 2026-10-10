"""As peças pequenas do simulador, uma a uma: eventos, roteiros, agentes de mentira, motor de mentira, mundo e execução."""
import dataclasses

import pytest

from ajudantes import FELIZ_UNICA, rodar_lista
from simulador import Campanha, Cenario, Execucao, Mundo, Referencia, campanha, jogar, rodar
from simulador import eventos as ev
from simulador.agentes import (COMPORTAMENTOS_DE_AUTOR, COMPORTAMENTOS_DE_REVISOR, TAMANHO_GRANDE, TAMANHO_NORMAL,
                               AgenteDeMentira, Comportamento, RespostaBruta, _resposta_de)
from simulador.motor_falso import LIMITE_DE_TAMANHO, RegistroDeRespostas, so_de_agente, traduzir
from simulador.mundo import CATEGORIAS, PESOS_AUTOR, PESOS_PADRAO, PESOS_REVISOR, PESOS_SO_ESTEIRA
from simulador.roteiro import ROTEIRO_LINHA, ROTEIRO_PROVA, ROTEIRO_UNICA, ROTEIROS_PRONTOS, Etapa, Roteiro
from simulador.vocabulario import AGENTES, FUNDADOR, e_conhecido, e_final, ESTADOS


# ============================================================================ eventos
def test_evento_vira_jornada_da_maquina_real():
    assert ev.autor("ENTREGAR", "E1", "CAIO", parecer="OK").para_jornada() == {
        "papel": "AUTOR", "evento": "ENTREGAR", "alvo": "E1", "params": {"parecer": "OK"}, "ator": "CAIO"}
    assert ev.helena("LER_DE_VOLTA").para_jornada() == {"papel": "HELENA", "evento": "LER_DE_VOLTA"}


def test_chave_antiga_vira_chave_ou_versao_vista():
    assert ev.autor("ENTREGAR", "E1", "CAIO", "antiga").para_jornada()["chave"] == "antiga"
    assert ev.fundador("APROVAR", "E1", "antiga").para_jornada()["versao_vista"] == "antiga"
    assert "chave" not in ev.fundador("APROVAR", "E1", "antiga").para_jornada()


def test_evento_e_imutavel_e_tem_rotulo_legivel():
    e = ev.revisor("APROVAR", "E1", "CLARA", "antiga")
    with pytest.raises(dataclasses.FrozenInstanceError):
        e.evento = "REPROVAR"
    assert e.rotulo == "REVISOR APROVAR em E1 por CLARA [antiga]"
    assert ev.motor("PORTAO1_OK", "E1", escolhido="CLARA").rotulo == "MOTOR PORTAO1_OK(escolhido=CLARA) em E1"


@pytest.mark.parametrize("atalho,papel", [(ev.autor, "AUTOR"), (ev.revisor, "REVISOR")])
def test_atalhos_de_agente(atalho, papel):
    e = atalho("APROVAR", "E1", "CLARA")
    assert (e.papel, e.alvo, e.ator) == (papel, "E1", "CLARA")


def test_atalhos_sem_agente():
    assert ev.helena("LER_DE_VOLTA").papel == "HELENA" and ev.fundador("CANCELAR").papel == "FUNDADOR"
    assert ev.motor("TODAS_PRONTAS").papel == "MOTOR" and ev.relogio("PRAZO_80").papel == "RELOGIO"
    assert ev.vigia("REGRA_QUEBRADA").papel == "VIGIA"
    assert ev.fundador("CANCELAR").alvo == "card" and ev.fundador("CANCELAR").ator is None


def test_resposta_vira_dicionario():
    r = ev.Resposta(True, "PASSAGEM", (("MOTOR", "INICIAR_EXECUCAO", "E1"),))
    assert r.como_dict() == {"aceito": True, "destino": "PASSAGEM", "automaticos": [["MOTOR", "INICIAR_EXECUCAO", "E1"]]}


# ============================================================================ vocabulário
def test_estados_conhecidos_e_finais():
    assert e_conhecido("card", "RASCUNHO") and e_conhecido("card", "PRONTO") and not e_conhecido("card", "VOANDO")
    assert e_final("card", "PRONTO") and not e_final("card", "EM_ANDAMENTO")
    assert e_final("acao_externa", "NAO_CONFIRMADA") and not e_final("acao_externa", "INCERTA")
    for maquina in ESTADOS:
        assert not set(ESTADOS[maquina]["abertos"]) & set(ESTADOS[maquina]["finais"])


def test_vinte_e_um_agentes_sem_repeticao():
    assert len(AGENTES) == 21 == len(set(AGENTES)) and FUNDADOR not in AGENTES


# ============================================================================ roteiro
def test_roteiro_ids_e_busca_por_id():
    assert ROTEIRO_PROVA.ids() == ["E1", "E2", "EJ", "ER"]
    assert ROTEIRO_PROVA.etapa("EJ").julga == ("E2",)
    with pytest.raises(KeyError):
        ROTEIRO_PROVA.etapa("E9")


@pytest.mark.parametrize("roteiro", ROTEIROS_PRONTOS, ids=lambda r: r.nome)
def test_roteiros_prontos_sao_coerentes(roteiro):
    ids = roteiro.ids()
    assert len(ids) == len(set(ids))
    for i, e in enumerate(roteiro.etapas):
        assert e.autor in AGENTES
        assert set(e.revisores) <= set(AGENTES) | {FUNDADOR}
        assert set(e.depende_de) <= set(ids[:i]), "depende só de etapas anteriores (sem ciclo)"
        assert set(e.julga) <= set(e.depende_de), "quem julga depende da julgada"
        validos = roteiro.revisores_validos(e.id)
        assert validos[-1] == FUNDADOR and len(validos) == len(set(validos))
        assert not set(validos) & {x for x in roteiro.proibidos_de_revisar(e.id) if x != FUNDADOR}


def test_proibidos_de_revisar():
    assert ROTEIRO_PROVA.proibidos_de_revisar("E2") == ["CLARA", "HELENA", "ISABELA"]
    assert ROTEIRO_PROVA.proibidos_de_revisar("ER") == ["HELENA"]
    assert ROTEIRO_LINHA.proibidos_de_revisar("L1") == ["BIANCA"]


def test_revisores_validos_na_ordem_da_ficha_e_o_fundador_por_ultimo():
    assert ROTEIRO_PROVA.revisores_validos("E2") == ["RAVI", FUNDADOR]
    assert ROTEIRO_PROVA.revisores_validos("E1") == ["CLARA", "HELENA", FUNDADOR]
    assert ROTEIRO_PROVA.revisores_validos("EJ") == ["HELENA", FUNDADOR]


def test_etapa_sem_nenhum_revisor_possivel_fica_com_o_fundador():
    r = Roteiro("so_fundador", (Etapa("X1", "CAIO", ("CAIO",)),))
    assert r.revisores_validos("X1") == [FUNDADOR]


def test_roteiro_vira_jornada_com_listas():
    e = ROTEIRO_PROVA.para_jornada()["etapas"][2]
    assert e["id"] == "EJ" and e["julga"] == ["E2"] and e["depende_de"] == ["E2"] and e["internet"] is True
    assert isinstance(e["acoes_permitidas"], list)


# ============================================================================ agentes de mentira
TIPOS = {
    Comportamento.ENTREGA_BOA: "ENTREGA", Comportamento.ENTREGA_COM_ACAO_EXTERNA: "ENTREGA",
    Comportamento.ENTREGA_GRANDE: "ENTREGA", Comportamento.FORMATO_ERRADO: "SEM_ACAO", Comportamento.DUAS_ACOES: "DUAS_ACOES",
    Comportamento.PERGUNTA_INDEVIDA: "PERGUNTA", Comportamento.USA_INTERNET_E_PERGUNTA: "PERGUNTA",
    Comportamento.PERGUNTA_BOA: "PERGUNTA", Comportamento.DEVOLVE: "DEVOLVER", Comportamento.REGISTRA_FALHA: "FALHA",
    Comportamento.TRAVA: "SILENCIO", Comportamento.CAI_NO_MEIO: "QUEDA", Comportamento.ESTOURA_COTA: "COTA",
    Comportamento.PERDE_LOGIN: "LOGIN", Comportamento.MUDA_AO_REPETIR: "ENTREGA",
    Comportamento.RESPOSTA_ATRASADA: "ENTREGA", Comportamento.APROVA_TUDO: "APROVA", Comportamento.RECUSA_TUDO: "REPROVA",
    Comportamento.REPROVA_SEM_CRITERIO: "REPROVA",
}


@pytest.mark.parametrize("comportamento", list(Comportamento), ids=lambda c: c.value)
def test_cada_comportamento_responde_o_tipo_certo(comportamento):
    assert _resposta_de(comportamento, "E1/AUTOR/1", 0, 0).tipo == TIPOS[comportamento]


def test_todo_comportamento_esta_na_tabela_e_em_algum_papel():
    assert set(TIPOS) == set(Comportamento)
    assert set(COMPORTAMENTOS_DE_AUTOR) | set(COMPORTAMENTOS_DE_REVISOR) == set(Comportamento)


def test_detalhes_das_respostas_de_mentira():
    assert _resposta_de(Comportamento.ENTREGA_GRANDE, "k", 0, 0).tamanho == TAMANHO_GRANDE > LIMITE_DE_TAMANHO
    assert _resposta_de(Comportamento.ENTREGA_BOA, "k", 0, 0).tamanho == TAMANHO_NORMAL < LIMITE_DE_TAMANHO
    assert _resposta_de(Comportamento.USA_INTERNET_E_PERGUNTA, "k", 0, 0).usou_internet is True
    assert _resposta_de(Comportamento.RESPOSTA_ATRASADA, "k", 0, 0).atrasada is True
    assert _resposta_de(Comportamento.RECUSA_TUDO, "k", 0, 0).criterios and not _resposta_de(
        Comportamento.REPROVA_SEM_CRITERIO, "k", 0, 0).criterios
    assert _resposta_de(Comportamento.DUAS_ACOES, "k", 0, 0).acoes == ("ENTREGAR", "PERGUNTAR")
    assert _resposta_de(Comportamento.ENTREGA_COM_ACAO_EXTERNA, "k", 0, 0).acao_externa == "PELO_MOTOR"
    assert _resposta_de(Comportamento.ENTREGA_COM_ACAO_EXTERNA, "k", 1, 0).acao_externa == "SO_FUNDADOR"
    assert _resposta_de(Comportamento.MUDA_AO_REPETIR, "k", 0, 1).tipo == "SEM_ACAO"


def test_agente_sem_roteiro_de_comportamento_e_recusado():
    with pytest.raises(ValueError):
        AgenteDeMentira("CAIO", [])
    with pytest.raises(ValueError):
        AgenteDeMentira("CAIO", ["COMPORTAMENTO_INEXISTENTE"])


def test_agente_segue_o_roteiro_uma_chave_nova_por_comportamento_e_repete_o_ultimo():
    a = AgenteDeMentira("CAIO", ["FORMATO_ERRADO", "ENTREGA_BOA"])
    assert [a.responder(f"c{i}").tipo for i in range(4)] == ["SEM_ACAO", "ENTREGA", "ENTREGA", "ENTREGA"]


def test_pedir_a_mesma_chave_de_novo_nao_avanca_o_roteiro():
    a = AgenteDeMentira("CAIO", ["FORMATO_ERRADO", "ENTREGA_BOA"])
    assert a.responder("c1").tipo == "SEM_ACAO" and a.responder("c1").tipo == "SEM_ACAO"
    assert a.chamadas_por_chave["c1"] == 2 and a.chamadas == 2
    assert a.responder("c2").tipo == "ENTREGA"


def test_agente_que_muda_ao_repetir_muda_so_na_segunda_pergunta_da_mesma_chave():
    a = AgenteDeMentira("CAIO", ["MUDA_AO_REPETIR"])
    assert a.responder("c1").tipo == "ENTREGA" and a.responder("c1").tipo == "SEM_ACAO"
    assert a.responder("c2").tipo == "ENTREGA"


def test_pesos_dos_comportamentos_cobrem_todos_os_do_papel():
    assert set(PESOS_AUTOR) == set(COMPORTAMENTOS_DE_AUTOR)
    assert set(PESOS_REVISOR) == set(COMPORTAMENTOS_DE_REVISOR)
    assert max(PESOS_AUTOR, key=PESOS_AUTOR.get) == Comportamento.ENTREGA_BOA
    assert max(PESOS_REVISOR, key=PESOS_REVISOR.get) == Comportamento.APROVA_TUDO


# ============================================================================ motor de mentira
def test_registro_grava_a_primeira_resposta_e_nao_chama_o_agente_de_novo():
    """Queda no meio: a resposta gravada é reusada sem gastar cota (o agente não é perguntado outra vez)."""
    agente = AgenteDeMentira("CAIO", ["MUDA_AO_REPETIR"])
    registro = RegistroDeRespostas()
    primeira = registro.obter("E1/AUTOR/1", agente)
    segunda = registro.obter("E1/AUTOR/1", agente)
    assert primeira is segunda and primeira.tipo == "ENTREGA" and agente.chamadas == 1


def _bruta(tipo, **campos):
    return RespostaBruta(tipo, **campos)


@pytest.mark.parametrize("papel,bruta,evento", [
    ("AUTOR", _bruta("ENTREGA", tamanho=1200), ("AUTOR", "ENTREGAR")),
    ("AUTOR", _bruta("PERGUNTA"), ("AUTOR", "PERGUNTAR")),
    ("AUTOR", _bruta("DEVOLVER"), ("AUTOR", "DEVOLVER_A_QUEM_PEDIU")),
    ("AUTOR", _bruta("FALHA", motivo_falha="FALTAM_DADOS"), ("AUTOR", "REGISTRAR_FALHA")),
    ("AUTOR", _bruta("SILENCIO"), ("RELOGIO", "TEMPO_ESGOTADO")),
    ("AUTOR", _bruta("QUEDA"), ("VIGIA", "SEM_EXECUCAO_VIVA")),
    ("AUTOR", _bruta("COTA"), ("MOTOR", "FALHA_INFRA")),
    ("AUTOR", _bruta("LOGIN"), ("MOTOR", "FALHA_INFRA")),
    ("AUTOR", _bruta("SEM_ACAO"), ("MOTOR", "FALHA")),
    ("AUTOR", _bruta("DUAS_ACOES"), ("MOTOR", "FALHA")),
    ("AUTOR", _bruta("APROVA"), ("MOTOR", "FALHA")),             # o autor aprovando é resposta de outro papel
    ("REVISOR", _bruta("APROVA"), ("REVISOR", "APROVAR")),
    ("REVISOR", _bruta("REPROVA", criterios=(("c1", "REPROVADO"),)), ("REVISOR", "REPROVAR")),
    ("REVISOR", _bruta("REPROVA"), ("MOTOR", "FALHA")),          # reprovou sem citar critério
    ("REVISOR", _bruta("ENTREGA"), ("MOTOR", "FALHA")),          # o revisor entregando é resposta de outro papel
    ("REVISOR", _bruta("SILENCIO"), ("RELOGIO", "TEMPO_ESGOTADO")),
    ("REVISOR", _bruta("QUEDA"), ("VIGIA", "SEM_EXECUCAO_VIVA")),
    ("REVISOR", _bruta("COTA"), ("MOTOR", "FALHA_INFRA")),
])
def test_traducao_da_fala_do_agente_em_evento(papel, bruta, evento):
    [e] = traduzir(papel, "E1", "CAIO", bruta)
    assert (e.papel, e.evento) == evento and e.alvo == "E1"


def test_traducao_entrega_leva_os_parametros_do_motor():
    [e] = traduzir("AUTOR", "E1", "CAIO", _bruta("ENTREGA", tamanho=10, usou_internet=True, acao_externa="PELO_MOTOR"))
    assert e.params == {"parecer": "OK", "acao_externa": "PELO_MOTOR", "usou_internet": "SIM"} and e.ator == "CAIO"
    [f] = traduzir("AUTOR", "E1", "CAIO", _bruta("FALHA"))
    assert f.params["motivo_falha"] == "NAO_CONSIGO"


def test_entrega_grande_demais_so_acima_do_limite():
    [no_limite] = traduzir("AUTOR", "E1", "CAIO", _bruta("ENTREGA", tamanho=LIMITE_DE_TAMANHO))
    [acima] = traduzir("AUTOR", "E1", "CAIO", _bruta("ENTREGA", tamanho=LIMITE_DE_TAMANHO + 1))
    assert no_limite.evento == "ENTREGAR" and (acima.evento, acima.params["classe"]) == ("FALHA", "GRANDE_DEMAIS")


def test_falha_de_infra_leva_a_classe():
    assert traduzir("AUTOR", "E1", "CAIO", _bruta("COTA"))[0].params == {"classe": "COTA"}
    assert traduzir("REVISOR", "E1", "CLARA", _bruta("LOGIN"))[0].params == {"classe": "LOGIN"}


def test_so_de_agente_filtra_o_que_um_agente_de_verdade_escreveria():
    lote = [ev.autor("ENTREGAR", "E1", "CAIO"), ev.motor("FALHA", "E1"), ev.relogio("TEMPO_ESGOTADO", "E1"),
            ev.revisor("APROVAR", "E1", "CLARA"), ev.vigia("SEM_EXECUCAO_VIVA", "E1")]
    assert [e.papel for e in so_de_agente(lote)] == ["AUTOR", "REVISOR"]


# ============================================================================ mundo
def test_pesos_cobrem_todas_as_categorias():
    assert set(PESOS_PADRAO) == set(CATEGORIAS) == set(PESOS_SO_ESTEIRA)
    assert {c for c, p in PESOS_SO_ESTEIRA.items() if p} == {"esteira", "fundador"}


def test_peso_zero_desliga_a_categoria():
    c = campanha(Referencia, range(150), Cenario(pesos={"queda": 0, "repeticao": 0, "atrasada": 0, "ilegal": 0}))
    assert not {"queda", "repeticao", "atrasada", "ilegal"} & set(c.categorias)
    assert c.ok


def test_cenario_fixa_o_roteiro_e_o_tamanho_do_pedido():
    for semente in range(20):
        m = Mundo(semente, Cenario(roteiro=ROTEIRO_LINHA, pedido_grande=False))
        assert m.roteiro is ROTEIRO_LINHA and m.pedido_grande is False
    sorteados = {Mundo(s).roteiro.nome for s in range(60)}
    assert sorteados == {r.nome for r in ROTEIROS_PRONTOS}
    assert {Mundo(s).pedido_grande for s in range(60)} == {True, False}


def test_cenario_fixa_o_roteiro_de_comportamento_dos_agentes():
    m = Mundo(1, Cenario(roteiro=ROTEIRO_UNICA, autores={"CAIO": [Comportamento.TRAVA]},
                         revisores={"CLARA": [Comportamento.RECUSA_TUDO]}))
    assert m.autores["CAIO"].comportamentos == (Comportamento.TRAVA,)
    assert m.revisores["CLARA"].comportamentos == (Comportamento.RECUSA_TUDO,)
    assert set(m.revisores) == {"CLARA", "HELENA"}


def test_sorteio_de_comportamentos_tem_de_um_a_cinco_e_so_os_do_papel():
    for semente in range(100):
        m = Mundo(semente)
        for a in m.autores.values():
            assert 1 <= len(a.comportamentos) <= 5 and set(a.comportamentos) <= set(COMPORTAMENTOS_DE_AUTOR)
        for r in m.revisores.values():
            assert 1 <= len(r.comportamentos) <= 5 and set(r.comportamentos) <= set(COMPORTAMENTOS_DE_REVISOR)


@pytest.mark.parametrize("depois", [0, 1, 3])
def test_card_final_recebe_so_alguns_toques_e_para(depois):
    """Com o card fechado e nenhuma ação aberta, o mundo ainda manda 'depois' eventos (que o alvo tem que recusar) e para."""
    alvo = Referencia()
    m = Mundo(5, Cenario(roteiro=ROTEIRO_UNICA, pedido_grande=False, passos_depois_do_fim=depois))
    alvo.iniciar(m.roteiro, False)
    alvo.aplicar(ev.helena("LER_DE_VOLTA"))
    alvo.aplicar(ev.fundador("CANCELAR"))
    lotes = 0
    while m.proximos_eventos(alvo.foto()):
        lotes += 1
        assert lotes <= depois
    assert lotes == depois and m.parou_por == "final"


def test_mundo_so_manda_resposta_de_agente_para_execucao_que_o_alvo_iniciou():
    """As chamadas dos agentes nascem de INICIAR_EXECUCAO/INICIAR_REVISAO que o alvo dispara (observar)."""
    alvo = Referencia()
    m = Mundo(3, Cenario(roteiro=ROTEIRO_UNICA, pedido_grande=False))
    alvo.iniciar(m.roteiro, False)
    assert m.em_voo == {}
    r = alvo.aplicar(ev.helena("LER_DE_VOLTA"))
    m.observar(ev.helena("LER_DE_VOLTA"), r, alvo.foto())
    assert list(m.em_voo) == [("U1", "AUTOR")] and m.em_voo[("U1", "AUTOR")].chave == "U1/AUTOR/1"


def test_a_chamada_perdida_vira_orfa_e_pode_chegar_atrasada_com_chave_antiga():
    alvo = Referencia()
    m = Mundo(3, Cenario(roteiro=ROTEIRO_UNICA, pedido_grande=False, autores={"CAIO": [Comportamento.ENTREGA_BOA]}))
    alvo.iniciar(m.roteiro, False)
    for e in (ev.helena("LER_DE_VOLTA"),):
        m.observar(e, alvo.aplicar(e), alvo.foto())
    queda = ev.vigia("SEM_EXECUCAO_VIVA", "U1")           # o processo cai: a execução 1 é dada como perdida
    m.observar(queda, alvo.aplicar(queda), alvo.foto())
    assert [c.chave for c in m.orfas] == ["U1/AUTOR/1"] and m.em_voo[("U1", "AUTOR")].chave == "U1/AUTOR/2"
    [atrasado] = m._cat_atrasada(alvo.foto())
    assert atrasado.chave == "antiga" and atrasado.evento == "ENTREGAR" and m.orfas == []


# ============================================================================ execução
def test_rodar_para_por_passos_quando_o_limite_e_curto():
    x = rodar(Referencia(), 1, max_passos=2)
    assert x.parou_por == "passos" and len(x.eventos) >= 2


def test_execucao_resume_e_tem_assinatura_de_64_caracteres():
    x = rodar(Referencia(), 7)
    assert isinstance(x, Execucao) and x.ok and len(x.assinatura) == 64
    assert x.resumo().startswith("semente 7 [") and "0 violações" in x.resumo()
    assert x.desfecho == x.foto_final.card["estado"] and len(x.eventos) == len(x.respostas)


def test_jogar_sem_semente_e_com_lista_de_eventos():
    x = jogar(Referencia(), ROTEIRO_UNICA, FELIZ_UNICA, pedido_grande=False)
    assert x.semente is None and x.parou_por == "lista" and x.desfecho == "PRONTO" and x.eventos == list(FELIZ_UNICA)


def test_campanha_conta_e_para_na_primeira_violacao():
    c = campanha(Referencia, range(25))
    assert isinstance(c, Campanha) and c.total == 25 and c.ok and c.primeira_semente_com_violacao() is None
    assert sum(c.desfechos.values()) == 25 and sum(c.destinos.values()) == sum(c.eventos.values())


def test_a_foto_final_e_o_estado_do_alvo_no_fim():
    alvo = Referencia()
    x = rodar_lista(FELIZ_UNICA, ROTEIRO_UNICA, alvo)
    assert x.foto_final.mesmo_estado_que(alvo.foto())
