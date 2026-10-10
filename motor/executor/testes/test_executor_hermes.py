"""ExecutorHermes: o que ele devolve, como limpa e como se comporta em situações do dia a dia."""

import json
import sys
import threading
import time

import pytest

from cenarios import verificador_de_acao
from executor_helena.executor import Executor, ExecutorHermes
from executor_helena.provedor_falso import Cenario, Simulacao
from executor_helena.tipos import DESCONHECIDA, ErroDePerfil, Execucao, Resultado


def test_e_um_executor_com_os_dois_metodos_do_contrato(amb):
    executor = amb.executor()
    assert isinstance(executor, Executor) and callable(executor.rodar) and callable(executor.cancelar)
    with pytest.raises(TypeError):
        Executor()                                               # type: ignore[abstract]


def test_o_resultado_traz_tudo_que_o_contrato_promete(amb, ficha_com_ferramentas):
    r = amb.rodar(ficha_com_ferramentas, Cenario(Simulacao.BOA), pacote="PEDIDO_DO_CARD")
    assert isinstance(r, Resultado) and r.ok
    assert r.texto and r.terminou_inteira                                         # texto
    assert r.uso.completo is True and r.uso.chamadas_ao_modelo == 1 and r.uso.origem                 # registro de uso
    assert r.codigo_de_saida == 0                                                 # código de saída
    assert r.ferramentas_recebidas == ("buscar", "ler_pagina")                    # ferramentas recebidas
    assert (r.modelo_usado, r.provedor_usado) == ("gpt-6-sol", "custom")          # modelo e provedor usados
    assert 0 < r.tempo_s < 60                                                     # tempo
    assert r.falha is None and r.conferencia.ok and not r.cancelada and r.encerrado_por is None
    assert r.sobras == () and r.tempo_para_encerrar_s is None


def test_o_comando_do_resultado_nao_leva_o_pacote_mas_diz_como_foi_lancado(amb, ficha_sem_ferramenta):
    r = amb.rodar(ficha_sem_ferramenta, Cenario(Simulacao.BOA), pacote="PEDIDO_DO_CARD_MUITO_ESPECIFICO")
    comando = " ".join(r.comando)
    assert "PEDIDO_DO_CARD_MUITO_ESPECIFICO" not in comando and "-z" in r.comando and "--toolsets" in r.comando
    assert r.comando[r.comando.index("--model") + 1] == "gpt-6-sol"


def test_a_conversa_vai_no_resultado_para_o_motor_guardar_antes_de_apagar_a_pasta(amb, ficha_sem_ferramenta):
    r = amb.rodar(ficha_sem_ferramenta, Cenario(Simulacao.BOA), pacote="PEDIDO_DO_CARD")
    assert [m["papel"] for m in r.conversa] == ["user", "assistant"]
    assert r.conversa[0]["conteudo"] == "PEDIDO_DO_CARD" and json.loads(r.conversa[1]["conteudo"])["acao"] == "ENTREGAR"


def test_texto_sai_sem_espacos_nas_pontas(amb, ficha_sem_ferramenta):
    r = amb.rodar(ficha_sem_ferramenta, Cenario(Simulacao.BOA, texto="  resposta com espaços  \n\n"))
    assert r.texto == "resposta com espaços"


def test_limpar_apaga_perfil_e_pasta_da_execucao(amb, ficha_sem_ferramenta):
    executor = amb.executor()
    r = amb.rodar(ficha_sem_ferramenta, Cenario(Simulacao.BOA), executor=executor)
    hermes_home = executor.config.raiz_hermes / "profiles" / f"exec-{r.pasta.name}"
    assert r.pasta.is_dir() and hermes_home.is_dir()
    executor.limpar(r)
    assert not r.pasta.exists() and not hermes_home.exists()
    executor.limpar(r)                                           # limpar de novo não dá erro


def test_limpar_so_apaga_dentro_das_pastas_do_executor(amb, ficha_sem_ferramenta, tmp_path):
    executor = amb.executor()
    r = amb.rodar(ficha_sem_ferramenta, Cenario(Simulacao.BOA), executor=executor)
    de_fora = tmp_path / "importante"
    de_fora.mkdir()
    (de_fora / "arquivo").write_text("nao apagar")
    executor.limpar(Resultado(**{**r.__dict__, "pasta": de_fora}))
    assert (de_fora / "arquivo").exists()
    executor.limpar(Resultado(**{**r.__dict__, "pasta": None}))     # sem pasta: nada a fazer


def test_cada_execucao_tem_perfil_e_pasta_proprios(amb, ficha_sem_ferramenta):
    executor = amb.executor()
    a = amb.rodar(ficha_sem_ferramenta, Cenario(Simulacao.BOA), executor=executor)
    b = amb.rodar(ficha_sem_ferramenta, Cenario(Simulacao.BOA), executor=executor)
    assert a.pasta != b.pasta and a.pasta.exists() and b.pasta.exists()
    perfis = list((executor.config.raiz_hermes / "profiles").iterdir())
    assert len(perfis) == 2


def test_mesmo_id_duas_vezes_e_recusado_sem_lancar_nada(amb, ficha_sem_ferramenta):
    executor = amb.executor()
    amb.rodar(ficha_sem_ferramenta, Cenario(Simulacao.BOA), executor=executor, id="E-IGUAL-n1")
    amb.provedor.limpar()
    with pytest.raises(ErroDePerfil, match="já tem pasta"):
        amb.rodar(ficha_sem_ferramenta, Cenario(Simulacao.BOA), executor=executor, id="E-IGUAL-n1")
    assert amb.provedor.pedidos_de_chat() == []


def test_erro_de_montagem_levanta_e_nao_vira_resultado(amb, ficha_com_ferramentas):
    with pytest.raises(ErroDePerfil, match="fontes_permitidas"):
        amb.executor().rodar(Execucao(id="E-1", ficha=ficha_com_ferramentas, pacote="p"))


def test_hermes_que_nao_existe_volta_como_falha_desconhecida_e_nao_como_excecao(amb, ficha_sem_ferramenta):
    executor = amb.executor(comando_hermes=("/nao/existe/hermes",))
    r = amb.rodar(ficha_sem_ferramenta, executor=executor)
    assert not r.ok and r.falha.classe == DESCONHECIDA and r.falha.codigo == "HERMES_NAO_LANCOU"
    assert r.texto is None and r.codigo_de_saida is None and not r.terminou_inteira


def test_cancelar_execucao_que_nao_existe(amb):
    assert amb.executor().cancelar("E-NAO-EXISTE") is False


def test_cancelar_so_atinge_a_execucao_pedida(amb, ficha_sem_ferramenta):
    executor = amb.executor()
    a = amb.rodar_em_segundo_plano(ficha_sem_ferramenta, Cenario(Simulacao.LENTA, atraso_s=60), executor=executor)
    b = amb.rodar_em_segundo_plano(ficha_sem_ferramenta, Cenario(Simulacao.LENTA, atraso_s=60), executor=executor)
    try:
        for andamento in (a, b):
            deadline = time.monotonic() + 20
            while len(amb.provedor.pedidos_de_chat()) < 2 and time.monotonic() < deadline:
                time.sleep(0.05)
        assert executor.cancelar(a.execucao.id) is True
        assert a.resultado(30).cancelada
        assert b._thread.is_alive(), "cancelar a execução A também parou a B"
    finally:
        executor.cancelar(b.execucao.id)
    assert b.resultado(30).cancelada


def test_tres_execucoes_ao_mesmo_tempo_nao_se_misturam(amb, ficha_sem_ferramenta):
    executor = amb.executor()
    resultados, erros = {}, []

    def rodar(indice):
        try:
            resultados[indice] = executor.rodar(amb.execucao(ficha_sem_ferramenta, pacote=f"PEDIDO_NUMERO_{indice}"))
        except Exception as erro:                       # noqa: BLE001
            erros.append(erro)

    amb.provedor.definir(Cenario(Simulacao.BOA))
    fios = [threading.Thread(target=rodar, args=(i,)) for i in range(3)]
    for fio in fios:
        fio.start()
    for fio in fios:
        fio.join(60)
    assert not erros and len(resultados) == 3 and all(r.ok for r in resultados.values())
    assert len({r.pasta for r in resultados.values()}) == 3
    pedidos = sorted(p.texto_do_usuario() for p in amb.provedor.pedidos_de_chat())
    assert pedidos == ["PEDIDO_NUMERO_0", "PEDIDO_NUMERO_1", "PEDIDO_NUMERO_2"]
    for indice, r in resultados.items():
        assert r.conversa[0]["conteudo"] == f"PEDIDO_NUMERO_{indice}"


def test_o_tempo_padrao_e_o_da_ficha_e_pode_ser_trocado(ficha_sem_ferramenta):
    assert Execucao(id="E-1", ficha=ficha_sem_ferramenta, pacote="p").tempo_efetivo_s == 300.0
    assert Execucao(id="E-1", ficha=ficha_sem_ferramenta, pacote="p", tempo_max_s=450).tempo_efetivo_s == 450.0     # 50% a mais na 2ª tentativa


def test_sem_verificador_o_executor_nao_opina_sobre_o_formato(amb, ficha_sem_ferramenta):
    assert amb.rodar(ficha_sem_ferramenta, Cenario(Simulacao.BOA, texto="qualquer coisa")).ok


def test_com_verificador_a_resposta_boa_passa(amb, ficha_sem_ferramenta):
    r = amb.rodar(ficha_sem_ferramenta, Cenario(Simulacao.BOA), verificador_de_formato=verificador_de_acao)
    assert r.ok and r.falha is None


def test_o_verificador_so_roda_em_execucao_inteira(amb, ficha_sem_ferramenta):
    chamadas = []

    def espiao(texto):
        chamadas.append(texto)
        return None
    amb.rodar(ficha_sem_ferramenta, Cenario(Simulacao.ERRO_429), verificador_de_formato=espiao)
    amb.rodar(ficha_sem_ferramenta, Cenario(Simulacao.RESPOSTA_VAZIA), verificador_de_formato=espiao)
    assert chamadas == []                                  # o texto de execução incompleta nem é lido como resposta
    amb.rodar(ficha_sem_ferramenta, Cenario(Simulacao.BOA), verificador_de_formato=espiao)
    assert len(chamadas) == 1
