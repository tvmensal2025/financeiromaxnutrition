"""A implementação de referência, cenário por cenário (escritos à mão), com as invariantes ligadas.

Os mesmos cenários rodam contra a máquina real em test_adaptador_maquina.py.
"""
import pytest

from ajudantes import nomes_violados, rodar_lista
from cenarios_comuns import CENARIOS, divergencias
from simulador import Referencia
from simulador.eventos import Evento, autor, fundador, helena, motor, relogio
from simulador.roteiro import ROTEIRO_UNICA


@pytest.mark.parametrize("cenario", CENARIOS, ids=lambda c: c.nome)
def test_cenario_na_referencia(cenario):
    x = rodar_lista(cenario.eventos, cenario.roteiro, Referencia(), cenario.pedido_grande)
    assert divergencias(cenario, x) == []
    assert x.violacoes == [], x.violacoes


def test_nomes_dos_cenarios_nao_se_repetem():
    nomes = [c.nome for c in CENARIOS]
    assert len(nomes) == len(set(nomes)) and len(nomes) >= 55


# ----------------------------------------------------------------------------- vocabulário
@pytest.mark.parametrize("evento", [
    Evento("AUTOR", "APROVAR", "U1", ator="CAIO"),                  # o autor não tem esse botão
    Evento("AUTOR", "REPROVAR", "U1", ator="CAIO"),
    Evento("AUTOR", "EXECUTAR_ACAO", "U1", ator="CAIO"),
    Evento("REVISOR", "ENTREGAR", "U1", ator="CLARA"),
    Evento("RELOGIO", "EXECUTAR_ACAO", "U1"),
    Evento("VIGIA", "ENTREGAR", "U1"),
    Evento("MOTOR", "INVENTADO", "U1"),
    Evento("FUNDADOR", "APAGAR_TUDO", "card"),
    Evento("FUNDADOR", "ENTREGAR", "U1"),
], ids=lambda e: e.rotulo)
def test_evento_fora_do_vocabulario_do_papel_e_recusado_sem_mudar_nada(evento):
    """Antes da correção, a referência tratava QUALQUER coisa dita pelo autor com a execução viva como
    'formato errado' (e aceitava): o checador acusava, com razão, 'o autor julgou a própria peça'."""
    alvo = Referencia()
    alvo.iniciar(ROTEIRO_UNICA, pedido_grande=False)
    alvo.aplicar(helena("LER_DE_VOLTA"))
    antes = alvo.foto()
    resposta = alvo.aplicar(evento)
    assert (resposta.aceito, resposta.destino) == (False, "RECUSADO")
    assert alvo.foto().mesmo_estado_que(antes)


def test_sem_papel_no_vocabulario_o_evento_e_recusado():
    alvo = Referencia()
    alvo.iniciar(ROTEIRO_UNICA, pedido_grande=False)
    assert alvo.aplicar(Evento("DEUS", "APROVAR", "card")).aceito is False


def test_pedir_subcard_do_autor_vivo_ainda_conta_como_formato_errado():
    """PEDIR_SUBCARD existe no vocabulário mas está desligado na v2.0: 'se chegar, conta como FORMATO_ERRADO'."""
    x = rodar_lista([helena("LER_DE_VOLTA"), autor("PEDIR_SUBCARD", "U1", "CAIO", usou_internet="NAO")])
    assert x.respostas[-1].destino == "FORMATO_ERRADO" and x.respostas[-1].aceito


# ----------------------------------------------------------------------------- iniciar de novo
def test_iniciar_zera_tudo_para_um_card_novo():
    alvo = Referencia()
    alvo.iniciar(ROTEIRO_UNICA, pedido_grande=False)
    alvo.aplicar(helena("LER_DE_VOLTA"))
    alvo.aplicar(fundador("CANCELAR"))
    assert alvo.foto().card["estado"] == "CANCELADO"
    alvo.iniciar(ROTEIRO_UNICA, pedido_grande=False)
    f = alvo.foto()
    assert f.card["estado"] == "RASCUNHO" and f.etapas["U1"].estado == "AGUARDANDO_ANTERIORES" and f.acoes == {}


def test_a_foto_e_uma_copia_e_nao_deixa_mexer_no_alvo():
    alvo = Referencia()
    alvo.iniciar(ROTEIRO_UNICA, pedido_grande=False)
    f = alvo.foto()
    f.card["estado"] = "PRONTO"
    f.donos["card"]["RASCUNHO"] = ("NINGUEM", "nunca")
    assert alvo.foto().card["estado"] == "RASCUNHO"
    assert alvo.foto().donos["card"]["RASCUNHO"] == ("HELENA", "leitura_de_volta")


def test_foto_mesmo_estado_que_ignora_os_donos_e_pega_qualquer_mudanca():
    alvo = Referencia()
    alvo.iniciar(ROTEIRO_UNICA, pedido_grande=False)
    a = alvo.foto()
    alvo.aplicar(relogio("PRAZO_80"))
    assert a.mesmo_estado_que(alvo.foto()) is False
    alvo.aplicar(helena("LER_DE_VOLTA"))
    assert alvo.foto().mesmo_estado_que(alvo.foto())


def test_o_card_cancelado_nao_executa_nada_automaticamente():
    x = rodar_lista([helena("LER_DE_VOLTA"), fundador("CANCELAR"), motor("PLANO_VALIDO")])
    assert x.respostas[-1].automaticos == () and nomes_violados(x) == []
