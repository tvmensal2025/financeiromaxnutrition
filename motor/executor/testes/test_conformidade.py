"""Conformidade: o MESMO contrato vale para qualquer executor (MEL-35). Roda no falso e no Hermes (de mentira).

Trocar de executor um dia = escrever outra classe e passar por aqui. Nada disto gasta cota.
Duas partes do "teste 3 em duas partes" do plano: esta é a parte de conformidade; a específica do Hermes é test_teste3.py.
"""

import pytest

from executor_helena.runtime_alternativo import SUPORTADAS, RuntimeAlternativoDeTeste
from cenarios import verificador_de_acao
from executor_helena import registro
from executor_helena.executor import Executor
from executor_helena.executor_falso import ExecutorFalso, Roteiro
from executor_helena.provedor_falso import Cenario, Simulacao
from executor_helena.tipos import (COTA, DESCONHECIDA, FORMATO_ERRADO, GRANDE_DEMAIS, LIMITE_CHAMADAS, LOGIN, PROVEDOR, QUEDA,
                                   Resultado)


class Falso:
    nome = "falso"

    def __init__(self, amb, tmp_path=None):
        self.amb = amb

    def rodar(self, ficha, simulacao, **kw):
        return ExecutorFalso(Roteiro(simulacao, atraso_s=kw.pop("atraso_s", 0.0))).rodar(self.amb.execucao(ficha, **kw))


class ComHermes:
    nome = "hermes"

    def __init__(self, amb, tmp_path=None):
        self.amb = amb

    def rodar(self, ficha, simulacao, **kw):
        atraso = kw.pop("atraso_s", 0.0)
        cenario = Cenario(simulacao, atraso_s=atraso, voltas_do_laco=200) if simulacao is not Simulacao.LACO_DE_FERRAMENTA \
            else Cenario(simulacao, voltas_do_laco=200, atraso_s=0.01)
        return self.amb.rodar(ficha, cenario, **kw)


class Alternativo:
    """Um runtime diferente do Hermes (processo comum, registro próprio). Só sabe as simulações em SUPORTADAS."""
    nome = "processo-simples"

    def __init__(self, amb, tmp_path):
        self.amb, self.raiz = amb, tmp_path / "alternativo"

    def rodar(self, ficha, simulacao, **kw):
        if simulacao not in SUPORTADAS:
            pytest.skip(f"{simulacao.name} é uma simulação específica do Hermes; o contrato portátil não a exige")
        kw.pop("atraso_s", None)
        return RuntimeAlternativoDeTeste(self.raiz, simulacao).rodar(self.amb.execucao(ficha, **kw))


@pytest.fixture(params=[Falso, ComHermes, Alternativo], ids=["executor_falso", "executor_hermes", "runtime_alternativo"])
def forma(request, amb, tmp_path):
    return request.param(amb, tmp_path)


# Cada executor aprovado para produção TEM de ter uma forma aqui: adicionar ao registro sem provar a conformidade quebra.
FORMAS_DOS_APROVADOS = {"hermes": ComHermes}


def test_todo_executor_aprovado_tem_forma_de_conformidade():
    registro.conferir_registro()
    assert set(registro.nomes_aprovados()) <= set(FORMAS_DOS_APROVADOS), \
        "executor no registro sem teste de conformidade: acrescente a forma dele em FORMAS_DOS_APROVADOS"


def test_boa_execucao(forma, ficha_sem_ferramenta):
    r = forma.rodar(ficha_sem_ferramenta, Simulacao.BOA)
    assert isinstance(r, Resultado) and r.ok and r.texto and r.terminou_inteira and r.falha is None
    assert r.ferramentas_recebidas == () and r.codigo_de_saida == 0 and r.tempo_s >= 0 and not r.cancelada
    assert r.conferencia.ok and r.sobras == () and r.encerrado_por is None


def test_boa_execucao_de_servico_com_ferramentas(forma, ficha_com_ferramentas):
    r = forma.rodar(ficha_com_ferramentas, Simulacao.BOA)
    assert r.ok and r.ferramentas_recebidas == ("buscar", "ler_pagina")


@pytest.mark.parametrize("simulacao,classe", [
    (Simulacao.ERRO_429, COTA), (Simulacao.LOGIN_RECUSADO, LOGIN), (Simulacao.ERRO_500, PROVEDOR),
    (Simulacao.RESPOSTA_INVALIDA, PROVEDOR), (Simulacao.QUEDA_NO_MEIO, QUEDA), (Simulacao.CONTEXTO_GRANDE, GRANDE_DEMAIS),
    (Simulacao.SAIDA_CORTADA, GRANDE_DEMAIS), (Simulacao.RESPOSTA_VAZIA, FORMATO_ERRADO), (Simulacao.ERRO_ESTRANHO, DESCONHECIDA),
    (Simulacao.LACO_DE_FERRAMENTA, LIMITE_CHAMADAS),
])
def test_mesma_classe_de_falha_e_mesmas_regras_de_texto(forma, ficha_sem_ferramenta, simulacao, classe):
    r = forma.rodar(ficha_sem_ferramenta, simulacao)
    assert r.falha is not None and r.falha.classe == classe, (forma.nome, r.falha)
    assert r.texto is None and not r.terminou_inteira and not r.ok               # execução incompleta: texto não vale como resposta
    assert r.falha.gasta_tentativa == (classe in (LIMITE_CHAMADAS, GRANDE_DEMAIS, FORMATO_ERRADO, DESCONHECIDA))


def test_tempo_esgotado(forma, ficha_sem_ferramenta):
    r = forma.rodar(ficha_sem_ferramenta, Simulacao.LENTA, atraso_s=60, tempo_max_s=1.5)
    assert r.falha.classe == "TEMPO" and r.encerrado_por == "TEMPO" and r.texto is None and not r.terminou_inteira
    assert r.sobras == () and r.tempo_para_encerrar_s is not None and r.tempo_para_encerrar_s <= 15


def test_formato_errado_so_com_verificador(forma, ficha_sem_ferramenta):
    sem = forma.rodar(ficha_sem_ferramenta, Simulacao.FORMATO_ERRADO)
    assert sem.ok
    com = forma.rodar(ficha_sem_ferramenta, Simulacao.FORMATO_ERRADO, verificador_de_formato=verificador_de_acao)
    assert com.falha.classe == FORMATO_ERRADO and com.terminou_inteira and com.texto


def test_o_resultado_ok_exige_tudo(forma, ficha_sem_ferramenta):
    """ok = terminou inteira, sem falha, conferência limpa e não cancelada."""
    r = forma.rodar(ficha_sem_ferramenta, Simulacao.BOA)
    assert r.ok == (r.terminou_inteira and r.falha is None and r.conferencia.ok and not r.cancelada)


def test_cancelar_id_desconhecido_devolve_falso(amb):
    assert ExecutorFalso().cancelar("E-X") is False and amb.executor().cancelar("E-X") is False


def test_todos_sao_executores_com_as_garantias_declaradas():
    for classe in (ExecutorFalso, RuntimeAlternativoDeTeste, *registro.classes_aprovadas()):
        assert issubclass(classe, Executor)
        assert classe.capacidades.faltando_para_producao() == (), classe


def test_limpar_e_idempotente(forma, ficha_sem_ferramenta):
    r = forma.rodar(ficha_sem_ferramenta, Simulacao.BOA)
    executor = ExecutorFalso() if forma.nome == "falso" else None
    if forma.nome == "processo-simples":
        executor = RuntimeAlternativoDeTeste(forma.raiz)
    elif forma.nome == "hermes":
        executor = forma.amb.executor()
    executor.limpar(r)
    executor.limpar(r)                     # segunda vez não é erro
    assert r.pasta is None or not r.pasta.exists() or forma.nome == "falso"
