"""(1) Sequências aleatórias com semente fixa: 1000+ sementes na implementação de referência, zero violação.

Se um destes testes falhar, a mensagem mostra a primeira semente com defeito. Para ver o que aconteceu:

    from simulador import Referencia, rodar
    x = rodar(Referencia(), SEMENTE)
    print(x.violacoes); [print(e.rotulo) for e in x.eventos]
"""
from collections import Counter, defaultdict

import pytest

from ajudantes import SEMENTES_PADRAO
from simulador import Cenario, Referencia, campanha, rodar
from simulador.agentes import Comportamento
from simulador.mundo import CATEGORIAS, PESOS_SO_ESTEIRA
from simulador.roteiro import ROTEIRO_LINHA, ROTEIRO_PROVA, ROTEIRO_UNICA, ROTEIROS_PRONTOS
from simulador.vocabulario import ESTADOS, TETO_EXECUCOES


def mostrar(c):
    """Texto curto para a mensagem de erro: as primeiras sementes com defeito."""
    linhas = [f"{len(c.com_violacao)} de {c.total} sementes violaram; por invariante: {dict(c.por_invariante)}"]
    for x in c.com_violacao[:3]:
        linhas.append(f"  {x.resumo()} -> {x.violacoes[0]}")
    return "\n".join(linhas)


@pytest.fixture(scope="module")
def grande():
    """A campanha principal (roda uma vez e serve a vários testes)."""
    return campanha(Referencia, SEMENTES_PADRAO)


def test_mais_de_mil_sementes_sem_nenhuma_violacao(grande):
    assert grande.total >= 1000
    assert grande.ok, mostrar(grande)


def test_toda_sequencia_chega_ao_fim_sozinha(grande):
    """Nenhuma rodada ficou presa (sem_movimento) nem estourou o limite de passos."""
    assert dict(grande.parou_por) == {"final": grande.total}


def test_a_campanha_fecha_o_card_de_todas_as_formas(grande):
    assert set(grande.desfechos) == {"PRONTO", "CANCELADO", "ENCERRADO_COM_FALHA"}
    assert min(grande.desfechos.values()) > grande.total * 0.05      # nenhum desfecho é raridade


def test_a_campanha_usa_todas_as_categorias_de_evento(grande):
    assert set(CATEGORIAS) <= set(grande.categorias)
    assert "depois_do_fim" in grande.categorias


def test_a_campanha_chega_ao_teto_de_execucoes_e_nunca_passa(grande):
    assert grande.execucoes_por_etapa_max == TETO_EXECUCOES


def test_a_campanha_produz_todos_os_destinos_de_um_evento(grande):
    esperados = {"PASSAGEM", "RECUSADO", "COMENTARIO_NO_CARD", "REACAO", "CARD_NOVO_LIGADO", "FORMATO_ERRADO"}
    assert esperados <= set(grande.destinos)


def test_a_campanha_usa_todos_os_comportamentos_dos_agentes(grande):
    """Cada comportamento de IA de mentira aparece nas respostas (o nome do tipo de resposta é o que a campanha conta)."""
    tipos = set(grande.comportamentos)
    assert {"ENTREGA", "PERGUNTA", "DEVOLVER", "FALHA", "SEM_ACAO", "DUAS_ACOES", "APROVA", "REPROVA",
            "SILENCIO", "QUEDA", "COTA", "LOGIN"} <= tipos


class _Gravador(Referencia):
    """A referência de sempre, anotando todo estado que o card, as etapas e as ações visitaram."""
    visitados = defaultdict(set)

    def aplicar(self, ev):
        resposta = super().aplicar(ev)
        f = self.foto()
        _Gravador.visitados["card"].add(f.card["estado"])
        _Gravador.visitados["etapa"].update(e.estado for e in f.etapas.values())
        _Gravador.visitados["acao_externa"].update(a.estado for a in f.acoes.values())
        return resposta


def test_a_campanha_visita_todos_os_estados_que_a_referencia_consegue_mostrar():
    """Passam despercebidos só os estados que a referência atravessa no mesmo passo (o motor anda sozinho) ou
    que ela não tem (cancelar ação só aconteceria com o card aberto, mas a ação só nasce no card pronto)."""
    _Gravador.visitados = defaultdict(set)
    for semente in range(400):
        rodar(_Gravador(), semente)
    nao_visitados = {m: (set(ESTADOS[m]["abertos"]) | set(ESTADOS[m]["finais"])) - _Gravador.visitados[m]
                     for m in ESTADOS}
    assert nao_visitados == {"card": {"VALIDANDO_PLANO"}, "etapa": {"NA_FILA"},
                             "acao_externa": {"AUTORIZADA", "CANCELADA"}}


@pytest.mark.parametrize("roteiro", ROTEIROS_PRONTOS, ids=lambda r: r.nome)
@pytest.mark.parametrize("pedido_grande", [True, False], ids=["pedido_grande", "pedido_pequeno"])
def test_cada_roteiro_e_cada_tamanho_de_pedido_sem_violacao(roteiro, pedido_grande):
    c = campanha(Referencia, range(300), Cenario(roteiro=roteiro, pedido_grande=pedido_grande))
    assert c.ok, mostrar(c)
    assert c.total == 300


def test_so_a_esteira_e_o_fundador_sem_violacao():
    """Sem quedas, repetições, respostas atrasadas e eventos ilegais: o caminho normal do sistema."""
    c = campanha(Referencia, range(600), Cenario(pesos=PESOS_SO_ESTEIRA))
    assert c.ok, mostrar(c)
    assert "PRONTO" in c.desfechos


@pytest.mark.parametrize("categoria", [c for c in CATEGORIAS if c not in ("esteira", "fundador")])
def test_cada_categoria_de_evento_pesada_sozinha_sem_violacao(categoria):
    """Aumenta uma categoria de cada vez (peso 40 contra os pesos de sempre) para estressar aquele tipo de evento."""
    c = campanha(Referencia, range(150), Cenario(pesos={categoria: 40}))
    assert c.ok, mostrar(c)
    assert c.categorias[categoria] > 0


@pytest.mark.parametrize("comportamento", [Comportamento.FORMATO_ERRADO, Comportamento.TRAVA, Comportamento.CAI_NO_MEIO,
                                           Comportamento.ESTOURA_COTA, Comportamento.PERDE_LOGIN,
                                           Comportamento.MUDA_AO_REPETIR, Comportamento.RESPOSTA_ATRASADA,
                                           Comportamento.ENTREGA_COM_ACAO_EXTERNA, Comportamento.PERGUNTA_BOA,
                                           Comportamento.USA_INTERNET_E_PERGUNTA, Comportamento.DUAS_ACOES],
                         ids=lambda c: c.value)
def test_agente_que_sempre_se_comporta_do_mesmo_jeito_sem_violacao(comportamento):
    """Todo autor repete o mesmo comportamento para sempre (o roteiro de comportamento repete o último)."""
    autores = {n: [comportamento] for n in ("CAIO", "ISABELA", "CLARA", "HELENA", "BIANCA", "DANIEL")}
    c = campanha(Referencia, range(100), Cenario(roteiro=ROTEIRO_PROVA, autores=autores))
    assert c.ok, mostrar(c)


@pytest.mark.parametrize("comportamento", [Comportamento.RECUSA_TUDO, Comportamento.REPROVA_SEM_CRITERIO,
                                           Comportamento.TRAVA, Comportamento.CAI_NO_MEIO, Comportamento.APROVA_TUDO],
                         ids=lambda c: c.value)
def test_revisor_que_sempre_se_comporta_do_mesmo_jeito_sem_violacao(comportamento):
    revisores = {n: [comportamento] for n in ("CLARA", "HELENA", "RAVI", "CAIO", "DANIEL", "BIANCA")}
    c = campanha(Referencia, range(100), Cenario(roteiro=ROTEIRO_PROVA, revisores=revisores))
    assert c.ok, mostrar(c)


def test_agente_que_so_erra_formato_nunca_passa_de_seis_execucoes():
    """O caso que o teto existe para evitar: o autor erra para sempre. A etapa para na 6ª execução."""
    cenario = Cenario(roteiro=ROTEIRO_UNICA, autores={"CAIO": [Comportamento.FORMATO_ERRADO]}, pesos=PESOS_SO_ESTEIRA,
                      pedido_grande=False)
    c = campanha(Referencia, range(50), cenario)
    assert c.ok, mostrar(c)
    assert c.execucoes_por_etapa_max == TETO_EXECUCOES


def test_amostra_de_sementes_espalhadas_pelo_espaco():
    """Sementes grandes e estranhas (negativas, enormes, texto) também são sequências válidas."""
    sementes = [0, -1, 2**31, 2**63 + 5, 10**18, "helena", "ecosistema", "", 3.5]
    c = campanha(Referencia, sementes)
    assert c.ok, mostrar(c)
    assert Counter(c.parou_por) == {"final": len(sementes)}


def test_linha_nunca_deixa_a_etapa_do_meio_perguntar():
    """No roteiro 'linha', L2 só pode entregar ou registrar falha. A pergunta indevida é formato errado, nunca espera."""
    autores = {"DANIEL": [Comportamento.PERGUNTA_INDEVIDA]}
    cenario = Cenario(roteiro=ROTEIRO_LINHA, autores=autores, pesos=PESOS_SO_ESTEIRA, pedido_grande=False)
    perguntas = 0
    for semente in range(100):
        x = rodar(Referencia(), semente, cenario)
        assert x.ok, x.violacoes
        for e, r in zip(x.eventos, x.respostas):
            if (e.papel, e.evento, e.alvo) == ("AUTOR", "PERGUNTAR", "L2"):
                perguntas += 1
                assert r.destino == "FORMATO_ERRADO", f"semente {semente}: pergunta indevida virou {r.destino}"
        assert x.foto_final.etapas["L2"].estado != "ESPERANDO_FUNDADOR" or x.foto_final.etapas["L2"].motivo != "PERGUNTA"
    assert perguntas > 50          # o cenário de fato provocou a pergunta indevida
