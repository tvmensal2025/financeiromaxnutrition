"""Trocar o modelo de um agente (ou de todos) é editar UMA linha de models.yaml: nada mais muda.

Pega as fichas REAIS da v2 (helena-v2/agents), troca os modelos do catálogo numa cópia e prova que:
  - cada ficha continua sendo lida, agora com o modelo novo;
  - o executor roda e a conferência do motor exige exatamente o modelo novo (e recusa o antigo);
  - nenhum arquivo de código foi preciso.
Se um dia uma troca exigir mexer em código, estes testes mostram onde está o acoplamento.
"""

from pathlib import Path

import pytest
import yaml

from executor_helena.executor_falso import ExecutorFalso, Roteiro
from executor_helena.provedor_falso import Cenario, Simulacao
from test_teste3 import fichas_reais

V2 = Path(__file__).resolve().parents[3] / "helena-v2"


def catalogo_trocado(tmp_path, sufixo="novo", provedor=None):
    dados = yaml.safe_load((V2 / "models.yaml").read_text(encoding="utf-8"))
    for apelido, item in dados["apelidos"].items():
        item["modelo"] = f"modelo-{sufixo}-{apelido}"
        if provedor:
            item["provedor"] = provedor
    caminho = tmp_path / "models.yaml"
    caminho.write_text(yaml.safe_dump(dados, allow_unicode=True), encoding="utf-8")
    return caminho


@pytest.mark.parametrize("nome,caminho,kw", fichas_reais(), ids=[c[0] for c in fichas_reais()])
def test_ficha_real_le_o_modelo_novo_sem_mudar_codigo(amb, tmp_path, nome, caminho, kw):
    ficha = amb.ficha(str(caminho), modelos=catalogo_trocado(tmp_path), **kw)
    assert ficha.modelo == f"modelo-novo-{ficha.apelido_do_modelo}" and "gpt-6" not in ficha.modelo


@pytest.mark.parametrize("nome,caminho,kw", fichas_reais()[:6], ids=[c[0] for c in fichas_reais()[:6]])
def test_executor_confere_o_modelo_novo_e_recusa_o_antigo(amb, tmp_path, nome, caminho, kw):
    ficha = amb.ficha(str(caminho), modelos=catalogo_trocado(tmp_path), **kw)
    boa = ExecutorFalso(Roteiro()).rodar(amb.execucao(ficha))
    assert boa.ok and boa.modelo_usado == ficha.modelo
    # Se o runtime usasse o modelo antigo (reserva escondida ou catálogo velho), o motor recusa a execução.
    velho = ExecutorFalso(Roteiro(modelo="gpt-6-sol")).rodar(amb.execucao(ficha))
    assert not velho.ok and {p.codigo for p in velho.conferencia.problemas} & {"MODELO_DIFERENTE_DA_FICHA",
                                                                              "MODELO_DA_SESSAO_DIFERENTE_DA_FICHA"}


def test_o_hermes_roda_com_o_modelo_novo_e_o_perfil_so_tem_ele(amb, tmp_path):
    caminho = V2 / "agents" / "caio.yaml"
    ficha = amb.ficha(str(caminho), modelos=catalogo_trocado(tmp_path), papel="AUTOR", servico="SRV-CALCULO")
    perfil = amb.executor().preparar(amb.execucao(ficha))                # o perfil que o Hermes leria
    texto = (perfil.hermes_home / "config.yaml").read_text(encoding="utf-8")
    assert ficha.modelo in texto and "gpt-6" not in texto, "o perfil do Hermes deve ter só o modelo do apelido"
    resultado = amb.rodar(ficha, Cenario(Simulacao.BOA))
    assert resultado.ok and resultado.modelo_usado == ficha.modelo
