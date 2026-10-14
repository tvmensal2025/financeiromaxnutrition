"""Reexecuta cenários existentes com o binário real e provedor falso local.

Não mede cota nem renovação de login. Falhas são evidências; nunca se convertem
automaticamente em aprovação do dia de prova.
"""

import pytest

import cenarios
from test_teste3 import fichas_reais


@pytest.mark.parametrize("nome,caminho,kw", fichas_reais(), ids=[c[0] for c in fichas_reais()])
def test_ferramentas_por_servico_real(amb, nome, caminho, kw):
    ficha = amb.ficha(str(caminho), modelos=caminho.parents[1] / "models.yaml", **kw)
    cenarios.cenario_ferramentas_exatas(amb, ficha)


@pytest.mark.parametrize("nome", ["sem_ferramenta", "com_ferramentas"])
def test_instrucoes_reais(amb, nome):
    cenarios.cenario_instrucoes_so_da_ficha(amb, amb.ficha(nome))


@pytest.mark.parametrize("nome", ["sem_ferramenta", "com_ferramentas"])
def test_ambiente_sem_segredo_real(amb, nome, monkeypatch):
    cenarios.cenario_sem_segredo_no_ambiente(amb, amb.ficha(nome), monkeypatch)


@pytest.mark.parametrize("nome", ["sem_ferramenta", "com_ferramentas"])
def test_laco_cortado_real(amb, nome):
    cenarios.cenario_laco_cortado(amb, amb.ficha(nome))


def test_configuracao_ou_instrucoes_alteradas_sao_recusadas(amb, ficha_sem_ferramenta):
    cenarios.cenario_perfil_alterado_e_recusado(amb, ficha_sem_ferramenta)
