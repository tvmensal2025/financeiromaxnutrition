"""Adaptador do OpenClaw contra o OpenClaw DE MENTIRA (executor_helena/openclaw_falso.py). Sem rede, sem cota.

Prova o caminho (lançar, ler o envelope, classificar, cancelar, limpar), não o OpenClaw real: isso é do dia de prova.
"""

import sys
import threading
import time
from pathlib import Path

import pytest

from cenarios import verificador_de_acao
from executor_helena import adaptador_openclaw, registro
from executor_helena.adaptador_openclaw import ConfigDoOpenClaw, ExecutorOpenClaw
from executor_helena.tipos import (COTA, DESCONHECIDA, FERRAMENTA, FORMATO_ERRADO, LOGIN, PROVEDOR, QUEDA, TEMPO,
                                   ErroDePerfil, Resultado)

FALSO = Path(adaptador_openclaw.__file__).with_name("openclaw_falso.py")


def _executor(tmp_path, modo, **kw):
    casa = tmp_path / "openclaw-home"
    casa.mkdir(exist_ok=True)
    config = ConfigDoOpenClaw(comando_openclaw=(sys.executable, str(FALSO), "--simular", modo), openclaw_home=casa,
                              pasta_das_execucoes=tmp_path / "execucoes", **kw)
    return ExecutorOpenClaw(config)


def _rodar(amb, tmp_path, modo, ficha=None, **kw):
    executor = _executor(tmp_path, modo)
    return executor, executor.rodar(amb.execucao(ficha or amb.ficha("sem_ferramenta"), **kw))


def test_boa_execucao(amb, tmp_path):
    _, r = _rodar(amb, tmp_path, "boa")
    assert isinstance(r, Resultado) and r.ok and r.texto and r.terminou_inteira and r.falha is None
    assert r.codigo_de_saida == 0 and r.modelo_usado == "gpt-6-sol" and r.provedor_usado == "openai"
    assert r.uso.tokens_total == 128 and r.uso.chamadas_de_ferramenta == 0 and r.sobras == ()
    assert r.conversa and r.conversa[0]["conteudo"] == r.texto
    assert any("assinatura x chave paga" in aviso for aviso in r.conferencia.avisos)


def test_o_comando_nunca_pede_reserva_e_fixa_a_config(amb, tmp_path):
    _, r = _rodar(amb, tmp_path, "boa")
    assert "--fallback" not in r.comando and "--auth-env-only" not in r.comando
    assert "--config" in r.comando and r.comando[r.comando.index("--model") + 1] == "openai/gpt-6-sol"
    assert not list((r.pasta / "trabalho").iterdir())                    # nada escrito na pasta do agente


@pytest.mark.parametrize("modo,classe,codigo", [
    ("erro_429", COTA, "rate_limit_exceeded"), ("login_recusado", LOGIN, "invalid_api_key"),
    ("erro_500", PROVEDOR, "server_error"), ("erro_estranho", DESCONHECIDA, "algo_que_ninguem_conhece"),
    ("queda_no_meio", QUEDA, "MORTO_PELO_SINAL_9"), ("sigterm_externo", QUEDA, "MORTO_PELO_SINAL_15"),
    ("envelope_quebrado", DESCONHECIDA, "SEM_REGISTRO_DE_USO"),
    ("status_estranho", DESCONHECIDA, "REGISTRO_DE_USO_ILEGIVEL"), ("resposta_vazia", FORMATO_ERRADO, "RESPOSTA_VAZIA"),
])
def test_falha_classificada_pelo_registro(amb, tmp_path, modo, classe, codigo):
    _, r = _rodar(amb, tmp_path, modo)
    assert r.falha is not None and (r.falha.classe, r.falha.codigo) == (classe, codigo), r.falha
    assert r.texto is None and not r.ok


def test_formato_errado_so_com_verificador(amb, tmp_path):
    _, sem = _rodar(amb, tmp_path, "formato_errado")
    assert sem.ok
    _, com = _rodar(amb, tmp_path, "formato_errado", verificador_de_formato=verificador_de_acao)
    assert com.falha.classe == FORMATO_ERRADO and com.terminou_inteira and com.texto


def test_modelo_trocado_pelo_runtime_nao_vale(amb, tmp_path):
    _, r = _rodar(amb, tmp_path, "modelo_trocado")
    assert not r.ok and r.texto is None
    assert {p.codigo for p in r.conferencia.problemas} == {"MODELO_DIFERENTE_DA_FICHA", "PROVEDOR_DIFERENTE_DA_FICHA"}


def test_ferramenta_usada_sem_permissao_e_grave(amb, tmp_path):
    _, r = _rodar(amb, tmp_path, "ferramenta_usada")
    assert r.falha.classe == DESCONHECIDA and r.falha.codigo == "FERRAMENTA_USADA_SEM_PERMISSAO" and r.texto is None


def test_tempo_esgotado_mata_o_grupo_em_ate_15s(amb, tmp_path):
    _, r = _rodar(amb, tmp_path, "lenta", tempo_max_s=1.5)
    assert r.falha.classe == TEMPO and r.encerrado_por == "TEMPO" and r.texto is None
    assert r.sobras == () and r.tempo_para_encerrar_s is not None and r.tempo_para_encerrar_s <= 15


def test_timeout_do_proprio_openclaw_tambem_e_tempo(amb, tmp_path):
    _, r = _rodar(amb, tmp_path, "timeout_proprio")
    assert r.falha.classe == TEMPO and r.texto is None


def test_cancelar(amb, tmp_path):
    executor = _executor(tmp_path, "lenta")
    execucao = amb.execucao(amb.ficha("sem_ferramenta"), tempo_max_s=60)
    saida = {}
    linha = threading.Thread(target=lambda: saida.update(r=executor.rodar(execucao)))
    linha.start()
    for _ in range(100):
        if executor.cancelar(execucao.id):
            break
        time.sleep(0.05)
    linha.join(30)
    r = saida["r"]
    assert r.cancelada and r.falha is None and r.texto is None and r.sobras == ()
    assert r.tempo_para_encerrar_s is not None and r.tempo_para_encerrar_s <= 15
    assert executor.cancelar("E-X") is False


def test_ficha_com_ferramenta_e_recusada_sem_lancar(amb, tmp_path):
    _, r = _rodar(amb, tmp_path, "boa", ficha=amb.ficha("com_ferramentas"))
    assert r.falha.classe == FERRAMENTA and r.falha.codigo == "FERRAMENTAS_NAO_LIGADAS_NO_OPENCLAW"
    assert r.codigo_de_saida is None and r.pasta is None and not (tmp_path / "execucoes").exists()


def test_programa_que_nao_existe(amb, tmp_path):
    casa = tmp_path / "casa"
    casa.mkdir()
    executor = ExecutorOpenClaw(ConfigDoOpenClaw(comando_openclaw=(str(tmp_path / "nao-existe"),), openclaw_home=casa,
                                                 pasta_das_execucoes=tmp_path / "execucoes"))
    r = executor.rodar(amb.execucao(amb.ficha("sem_ferramenta")))
    assert r.falha.classe == DESCONHECIDA and r.falha.codigo == "RUNTIME_NAO_LANCOU"


def test_limpar_e_idempotente(amb, tmp_path):
    executor, r = _rodar(amb, tmp_path, "boa")
    assert r.pasta.exists()
    executor.limpar(r)
    executor.limpar(r)
    assert not r.pasta.exists()


def test_config_recusa_caminho_relativo(tmp_path):
    with pytest.raises(ErroDePerfil):
        ConfigDoOpenClaw(comando_openclaw=("openclaw",), openclaw_home=Path("relativo"), pasta_das_execucoes=tmp_path)


def test_esta_em_homologacao_e_nunca_em_producao():
    assert "openclaw" in registro.nomes_em_homologacao() and "openclaw" not in registro.nomes_aprovados()
    with pytest.raises(registro.ErroDeRegistro, match="pronto para conectar"):
        registro.montar_executor({"HELENA_V2_EXECUTOR": "openclaw"})
    assert set(adaptador_openclaw.ESTADO_DAS_GARANTIAS) == set(ExecutorOpenClaw.capacidades.__dataclass_fields__)
