"""(3) Reprodutibilidade: a mesma semente dá sempre o mesmo resultado.

Sem isso nenhuma falha encontrada pelo simulador poderia ser revista. A "assinatura" de uma execução é uma
impressão digital (sha256) de todos os eventos, respostas, violações e do estado final.
"""
import json
import os
import random
import subprocess
import sys
from pathlib import Path

import pytest

from ajudantes import SEMENTES_PADRAO
from mutantes import SemTetoDeExecucoes
from simulador import Cenario, Referencia, campanha, rodar
from simulador.agentes import Comportamento
from simulador.mundo import Mundo
from simulador.roteiro import ROTEIRO_PROVA, ROTEIRO_UNICA, ROTEIROS_PRONTOS

PASTA_DO_SIMULADOR = Path(__file__).resolve().parents[1]
SEMENTES = [0, 1, 2, 3, 7, 11, 42, 99, 123, 500, 1000, 4242]


def assinatura(semente, classe=Referencia, cenario=None):
    return rodar(classe(), semente, cenario).assinatura


@pytest.mark.parametrize("semente", SEMENTES)
def test_mesma_semente_mesma_assinatura(semente):
    assert assinatura(semente) == assinatura(semente)


@pytest.mark.parametrize("semente", SEMENTES)
def test_mesma_semente_mesmos_eventos_respostas_e_estado_final(semente):
    a, b = rodar(Referencia(), semente), rodar(Referencia(), semente)
    assert [e.como_dict() for e in a.eventos] == [e.como_dict() for e in b.eventos]
    assert [r.como_dict() for r in a.respostas] == [r.como_dict() for r in b.respostas]
    assert a.foto_final.como_dict() == b.foto_final.como_dict()
    assert (a.roteiro, a.parou_por, a.categorias, a.comportamentos) == (b.roteiro, b.parou_por, b.categorias, b.comportamentos)


def test_o_mesmo_objeto_alvo_pode_rodar_duas_vezes_com_o_mesmo_resultado():
    """iniciar() zera tudo: nenhum estado sobra de uma rodada para a outra."""
    alvo = Referencia()
    primeira = rodar(alvo, 31).assinatura
    rodar(alvo, 32)
    assert rodar(alvo, 31).assinatura == primeira


def test_a_ordem_das_rodadas_nao_muda_o_resultado():
    sementes = list(range(40))
    de_frente = {s: assinatura(s) for s in sementes}
    de_tras = {s: assinatura(s) for s in reversed(sementes)}
    assert de_frente == de_tras


def test_o_gerador_aleatorio_global_nao_interfere():
    """O simulador usa só o sorteador da semente; mexer no random global não muda nada."""
    random.seed(1)
    a = assinatura(77)
    random.seed(987654)
    random.random()
    b = assinatura(77)
    assert a == b


def test_rodadas_intercaladas_nao_se_misturam():
    """Duas execuções montadas ao mesmo tempo (cada uma com seu mundo) dão o mesmo que em separado."""
    sozinho = (assinatura(5), assinatura(6))
    alvo5, alvo6 = Referencia(), Referencia()
    a = rodar(alvo5, 5)
    b = rodar(alvo6, 6)
    assert (a.assinatura, b.assinatura) == sozinho


def test_o_mundo_sozinho_e_reprodutivel():
    """Mesmo mundo, mesma foto: mesmos próximos eventos."""
    def sequencia():
        alvo = Referencia()
        mundo = Mundo(2024)
        alvo.iniciar(mundo.roteiro, mundo.pedido_grande)
        saida = []
        for _ in range(25):
            proximos = mundo.proximos_eventos(alvo.foto())
            if not proximos:
                break
            for e in proximos:
                r = alvo.aplicar(e)
                mundo.observar(e, r, alvo.foto())
                saida.append(e.rotulo)
        return saida
    assert sequencia() == sequencia() and len(sequencia()) > 10


def test_sementes_diferentes_dao_sequencias_diferentes():
    """A semente de fato muda o que acontece (senão 1000 sementes seriam uma só)."""
    assinaturas = {assinatura(s) for s in range(200)}
    assert len(assinaturas) >= 190


def test_o_cenario_entra_na_assinatura():
    assert assinatura(5, cenario=Cenario(roteiro=ROTEIRO_UNICA)) != assinatura(5, cenario=Cenario(roteiro=ROTEIRO_PROVA))


@pytest.mark.parametrize("roteiro", ROTEIROS_PRONTOS, ids=lambda r: r.nome)
def test_cenario_fixo_tambem_e_reprodutivel(roteiro):
    cenario = Cenario(roteiro=roteiro, pedido_grande=False, autores={"CAIO": [Comportamento.FORMATO_ERRADO]})
    assert assinatura(9, cenario=cenario) == assinatura(9, cenario=cenario)


def test_a_assinatura_enxerga_uma_mudanca_de_comportamento_do_alvo():
    """Uma implementação diferente deixa uma assinatura diferente em alguma semente (a assinatura não é cega)."""
    diferentes = sum(assinatura(s) != assinatura(s, SemTetoDeExecucoes) for s in range(60))
    assert diferentes > 0


def test_a_campanha_inteira_e_reprodutivel():
    a, b = campanha(Referencia, range(150)), campanha(Referencia, range(150))
    assert (a.total, a.desfechos, a.parou_por, a.eventos, a.destinos, a.categorias, a.comportamentos) == \
           (b.total, b.desfechos, b.parou_por, b.eventos, b.destinos, b.categorias, b.comportamentos)


def test_a_campanha_acha_a_mesma_primeira_semente_com_defeito():
    a = campanha(SemTetoDeExecucoes, range(100), parar_na_primeira=True)
    b = campanha(SemTetoDeExecucoes, range(100), parar_na_primeira=True)
    assert a.primeira_semente_com_violacao() == b.primeira_semente_com_violacao() is not None


def test_a_assinatura_inclui_as_violacoes():
    sem_defeito, com_defeito = rodar(Referencia(), 4), rodar(SemTetoDeExecucoes(), 4)
    if com_defeito.violacoes:
        assert sem_defeito.assinatura != com_defeito.assinatura


# ----------------------------------------------------------------------------- outro processo, outra "sorte" do Python
SCRIPT = """
import json
from simulador import Referencia, rodar
print(json.dumps({s: rodar(Referencia(), s).assinatura for s in range(30)}))
"""


def _assinaturas_em_outro_processo(hash_seed):
    ambiente = dict(os.environ, PYTHONHASHSEED=str(hash_seed), PYTHONDONTWRITEBYTECODE="1")
    saida = subprocess.run([sys.executable, "-c", SCRIPT], cwd=PASTA_DO_SIMULADOR, env=ambiente, capture_output=True,
                           text=True, check=True, timeout=120).stdout
    return {int(k): v for k, v in json.loads(saida).items()}


def test_outro_processo_com_outra_ordem_de_hash_da_o_mesmo_resultado():
    """PYTHONHASHSEED muda a ordem de sets e dicionários de texto. O resultado não pode depender disso."""
    aqui = {s: assinatura(s) for s in range(30)}
    for hash_seed in (0, 1, 31337):
        assert _assinaturas_em_outro_processo(hash_seed) == aqui, f"PYTHONHASHSEED={hash_seed}"


# ----------------------------------------------------------------------------- valores de referência (fotografia)
# Se algum destes falhar sem você ter mexido no gerador, o sorteador do Python ou a ordem dos sorteios mudou.
# Se você mexeu no gerador de propósito, imprima as novas e troque aqui:
#     python -c "from simulador import *; print([rodar(Referencia(), s).assinatura[:16] for s in range(3)])"
FOTOGRAFIA = {0: '0ec6bd0efaf01364', 1: '62a5ad277020fa96', 2: 'd4ac8ab10ad709ec'}


def test_fotografia_das_primeiras_sementes():
    atuais = {s: rodar(Referencia(), s).assinatura[:16] for s in FOTOGRAFIA}
    assert atuais == FOTOGRAFIA, f"troque FOTOGRAFIA por {atuais}"


def test_a_campanha_grande_e_reprodutivel_semente_a_semente():
    """Reexecutar um intervalo das sementes padrão devolve os mesmos desfechos."""
    intervalo = range(SEMENTES_PADRAO.start, SEMENTES_PADRAO.start + 50)
    a = [rodar(Referencia(), s).desfecho for s in intervalo]
    b = [rodar(Referencia(), s).desfecho for s in intervalo]
    assert a == b
