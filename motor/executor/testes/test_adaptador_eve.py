"""Adaptador da EVE contra o servidor DE MENTIRA (executor_helena/eve_falso.py) em 127.0.0.1. Sem rede externa, sem cota.

Prova o caminho (criar sessão, ler o fluxo, classificar, cancelar, guardar a conversa), não a EVE real.
"""

import threading
import time
from pathlib import Path

import pytest

from cenarios import verificador_de_acao
from executor_helena import adaptador_eve, registro
from executor_helena.adaptador_eve import ConfigDaEve, ExecutorEve
from executor_helena.eve_falso import ServidorEveFalso
from executor_helena.tipos import (COTA, DESCONHECIDA, FERRAMENTA, FORMATO_ERRADO, GRANDE_DEMAIS, LOGIN, PROVEDOR, QUEDA,
                                   TEMPO, ErroDePerfil)

TOKEN = "token-de-teste-da-rota"
FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def ficha_openai(amb, tmp_path):
    """A EVE em servidor não roda a assinatura: o teste usa um models.yaml com provedor `openai` (chave de API)."""
    modelos = tmp_path / "models-openai.yaml"
    modelos.write_text((FIXTURES / "models.yaml").read_text(encoding="utf-8").replace("openai-codex", "openai"),
                       encoding="utf-8")
    return amb.ficha("sem_ferramenta", modelos=modelos)


def _executor(servidor, tmp_path, token=TOKEN, **kw):
    return ExecutorEve(ConfigDaEve(url_base=servidor.url, token=token, pasta_das_execucoes=tmp_path / "execucoes", **kw))


def _rodar(amb, tmp_path, ficha, modo, *, config=None, **kw):
    with ServidorEveFalso(modo, token=TOKEN) as servidor:
        executor = _executor(servidor, tmp_path, **(config or {}))
        return executor, executor.rodar(amb.execucao(ficha, **kw)), servidor


def test_boa_execucao(amb, tmp_path, ficha_openai):
    executor, r, servidor = _rodar(amb, tmp_path, ficha_openai, "boa")
    assert r.ok and r.texto and r.terminou_inteira and r.falha is None and r.codigo_de_saida == 0
    assert r.modelo_usado == "gpt-6-sol" and r.provedor_usado == "openai"
    assert r.uso.tokens_entrada == 120 and r.uso.tokens_saida == 8 and r.uso.chamadas_ao_modelo == 1
    tipos = [item["tipo"] for item in r.conversa]
    assert "message.completed" in tipos and "message.appended" not in tipos      # só blocos concluídos
    assert all(p["com_credencial"] for p in servidor.pedidos)
    assert (r.pasta / "eventos.ndjson").exists()


def test_o_token_nunca_aparece(amb, tmp_path, ficha_openai):
    executor, r, _ = _rodar(amb, tmp_path, ficha_openai, "boa")
    assert TOKEN not in repr(executor.config) and TOKEN not in repr(r)
    assert TOKEN not in (r.pasta / "eventos.ndjson").read_text(encoding="utf-8")


@pytest.mark.parametrize("modo,classe,codigo", [
    ("erro_429", COTA, "HTTP_429"), ("login_recusado", LOGIN, "HTTP_401"), ("erro_500", PROVEDOR, "HTTP_503"),
    ("erro_estranho", DESCONHECIDA, "ALGO_QUE_NINGUEM_CONHECE"), ("queda_no_meio", QUEDA, "SEM_CODIGO_DE_SAIDA"),
    ("saida_cortada", GRANDE_DEMAIS, "SAIDA_CORTADA_NO_LIMITE"), ("resposta_vazia", FORMATO_ERRADO, "RESPOSTA_VAZIA"),
    ("rota_recusa", LOGIN, "ROTA_DA_EVE_RECUSOU_401"), ("sem_versao", DESCONHECIDA, "FLUXO_DA_EVE_FORA_DO_CONTRATO"),
    ("linha_quebrada", DESCONHECIDA, "LINHA_ILEGIVEL"), ("ferramenta_usada", DESCONHECIDA, "FERRAMENTA_USADA_SEM_PERMISSAO"),
])
def test_falha_classificada_pelo_registro(amb, tmp_path, ficha_openai, modo, classe, codigo):
    _, r, _ = _rodar(amb, tmp_path, ficha_openai, modo)
    assert r.falha is not None and (r.falha.classe, r.falha.codigo) == (classe, codigo), r.falha
    assert r.texto is None and not r.ok


def test_formato_errado_so_com_verificador(amb, tmp_path, ficha_openai):
    _, sem, _ = _rodar(amb, tmp_path, ficha_openai, "formato_errado")
    assert sem.ok
    _, com, _ = _rodar(amb, tmp_path, ficha_openai, "formato_errado", verificador_de_formato=verificador_de_acao)
    assert com.falha.classe == FORMATO_ERRADO and com.terminou_inteira and com.texto


def test_modelo_trocado_no_meio_nao_vale(amb, tmp_path, ficha_openai):
    _, r, _ = _rodar(amb, tmp_path, ficha_openai, "modelo_trocado")
    assert not r.ok and r.texto is None
    assert {"MODELO_TROCADO_NO_MEIO", "MODELO_DIFERENTE_DA_FICHA"} <= {p.codigo for p in r.conferencia.problemas}


def test_repeticao_da_propria_eve_vira_aviso(amb, tmp_path, ficha_openai):
    _, r, _ = _rodar(amb, tmp_path, ficha_openai, "com_repeticao")
    assert r.ok and any("MODEL_CALL_ATTEMPT_RETRIED" in aviso for aviso in r.conferencia.avisos)


def test_credencial_errada_e_login(amb, tmp_path, ficha_openai):
    with ServidorEveFalso("boa", token=TOKEN) as servidor:
        r = _executor(servidor, tmp_path, token="outro").rodar(amb.execucao(ficha_openai))
    assert r.falha.classe == LOGIN and r.texto is None


def test_tempo_esgotado_cancela_e_confirma(amb, tmp_path, ficha_openai):
    _, r, servidor = _rodar(amb, tmp_path, ficha_openai, "lenta", tempo_max_s=1.5)
    assert r.falha.classe == TEMPO and r.encerrado_por == "TEMPO" and r.texto is None
    assert r.tempo_para_encerrar_s is not None and r.tempo_para_encerrar_s <= 15
    assert any(p["caminho"].endswith("/cancel") for p in servidor.pedidos)


def test_cancelamento_sem_confirmacao_e_grave(amb, tmp_path, ficha_openai):
    _, r, _ = _rodar(amb, tmp_path, ficha_openai, "cancelamento_ignorado", tempo_max_s=1.0,
                     config={"limite_para_encerrar_s": 1.0})
    assert r.falha.classe == DESCONHECIDA and r.falha.codigo == "CANCELAMENTO_NAO_CONFIRMADO"


def test_turno_que_termina_no_instante_do_corte_conta_como_encerrado(amb, tmp_path, ficha_openai):
    _, r, _ = _rodar(amb, tmp_path, ficha_openai, "completa_no_corte", tempo_max_s=1.0)
    assert r.falha.classe == TEMPO and r.texto is None
    assert "CANCELAMENTO_NAO_CONFIRMADO" not in {p.codigo for p in r.conferencia.problemas}


def test_uso_com_tipo_estranho_nao_derruba(amb, tmp_path, ficha_openai):
    _, r, _ = _rodar(amb, tmp_path, ficha_openai, "uso_estranho")
    assert r.ok and r.uso.tokens_entrada == 0 and r.uso.tokens_saida == 0


def test_cancelar(amb, tmp_path, ficha_openai):
    with ServidorEveFalso("lenta", token=TOKEN) as servidor:
        executor = _executor(servidor, tmp_path)
        execucao = amb.execucao(ficha_openai, tempo_max_s=60)
        saida = {}
        linha = threading.Thread(target=lambda: saida.update(r=executor.rodar(execucao)))
        linha.start()
        for _ in range(100):
            if executor.cancelar(execucao.id):
                break
            time.sleep(0.05)
        linha.join(30)
    r = saida["r"]
    assert r.cancelada and r.falha is None and r.texto is None and r.tempo_para_encerrar_s <= 15
    assert executor.cancelar("E-X") is False


def test_eve_fora_do_ar(amb, tmp_path, ficha_openai):
    with ServidorEveFalso("boa") as servidor:
        url = servidor.url
    r = ExecutorEve(ConfigDaEve(url_base=url, pasta_das_execucoes=tmp_path / "x")).rodar(amb.execucao(ficha_openai))
    assert r.falha.classe == QUEDA and r.falha.codigo == "EVE_INALCANCAVEL"


def test_assinatura_chatgpt_e_recusada_sem_chamar(amb, tmp_path):
    with ServidorEveFalso("boa", token=TOKEN) as servidor:
        r = _executor(servidor, tmp_path).rodar(amb.execucao(amb.ficha("sem_ferramenta")))
        assert servidor.pedidos == []
    assert r.falha.classe == PROVEDOR and r.falha.codigo == "ASSINATURA_NAO_RODA_NA_EVE_EM_SERVIDOR"


def test_ficha_com_ferramenta_e_recusada_sem_chamar(amb, tmp_path):
    with ServidorEveFalso("boa", token=TOKEN) as servidor:
        r = _executor(servidor, tmp_path).rodar(amb.execucao(amb.ficha("com_ferramentas")))
        assert servidor.pedidos == []
    assert r.falha.classe == FERRAMENTA and r.falha.codigo == "FERRAMENTAS_NAO_LIGADAS_NA_EVE"


def test_limpar_e_idempotente(amb, tmp_path, ficha_openai):
    executor, r, _ = _rodar(amb, tmp_path, ficha_openai, "boa")
    executor.limpar(r)
    executor.limpar(r)
    assert not r.pasta.exists()


@pytest.mark.parametrize("url", ["http://eve.exemplo.com", "ftp://127.0.0.1", "https://u:s@eve.exemplo.com",
                                 "https://eve.exemplo.com/?x=1"])
def test_config_recusa_endereco_inseguro(tmp_path, url):
    with pytest.raises(ErroDePerfil):
        ConfigDaEve(url_base=url, pasta_das_execucoes=tmp_path)


def test_esta_em_homologacao_e_nunca_em_producao():
    assert "eve" in registro.nomes_em_homologacao() and "eve" not in registro.nomes_aprovados()
    with pytest.raises(registro.ErroDeRegistro, match="pronto para conectar"):
        registro.montar_executor({"HELENA_V2_EXECUTOR": "eve", "HELENA_V2_EVE_URL": "https://x.exemplo",
                                  "HELENA_V2_EVE_TOKEN": "x", "HELENA_V2_EXECUCOES_DIR": "/tmp/x"})
    assert set(adaptador_eve.ESTADO_DAS_GARANTIAS) == set(ExecutorEve.capacidades.__dataclass_fields__)
    eve = next(f for f in registro.fichas_de_conexao({"HELENA_V2_EVE_TOKEN": "nao-pode-aparecer"}) if f["nome"] == "eve")
    assert eve["estado"] == "PRONTO_PARA_CONECTAR_NAO_APROVADO" and "HELENA_V2_EVE_TOKEN" not in eve["variaveis_faltando"]
    assert eve["o_que_se_sabe"]["guarda_conversa"].startswith("CONFIRMADO") and "nao-pode-aparecer" not in repr(eve)
