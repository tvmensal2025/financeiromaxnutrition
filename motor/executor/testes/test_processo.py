"""Processo do agente: lançamento, tempo máximo, cancelamento, vigias e limpeza da árvore inteira.

Aqui o "agente" é um programa Python qualquer: o que se prova é a mecânica de processos.
"""

import json
import os
import signal
import stat
import subprocess
import sys
import threading
import time

import pytest

from executor_helena import arvore, processo
from executor_helena.processo import ErroDeLancamento, matar_sobras

ID = "E-PROC-1"


def vivo(pid):
    try:
        with open(f"/proc/{pid}/stat", "rb") as arquivo:
            return arquivo.read().rsplit(b")", 1)[1].split()[0] not in (b"Z", b"X")
    except OSError:
        return False


def esperar_arquivo(caminho, timeout=10):
    fim = time.monotonic() + timeout
    while time.monotonic() < fim:
        if caminho.exists() and caminho.read_text().strip():
            return caminho.read_text().strip()
        time.sleep(0.02)
    raise AssertionError(f"{caminho} não apareceu")


def executar(tmp_path, codigo, *, tempo=30.0, cancelamento=None, vigias=(), graca=1.0, limite=10.0, env_extra=None, id_execucao=ID):
    env = {"PATH": os.environ["PATH"], "HELENA_EXECUCAO": id_execucao, **(env_extra or {})}
    return processo.executar(
        [sys.executable, "-c", codigo], cwd=tmp_path, env=env, arquivo_de_saida=tmp_path / "saida.txt",
        arquivo_de_erros=tmp_path / "erros.txt", arquivo_do_processo=tmp_path / "processo.json", id_execucao=id_execucao,
        tempo_max_s=tempo, cancelamento=cancelamento or threading.Event(), vigias=vigias, graca_s=graca,
        limite_para_encerrar_s=limite, intervalo_s=0.05)


# Neto em OUTRA sessão, sem marca no ambiente e que ignora SIGTERM: o pior caso para quem só mata o grupo.
NETO_TEIMOSO = """
import os, subprocess, sys, time
neto = subprocess.Popen([sys.executable, "-c",
    "import os,signal,time; signal.signal(signal.SIGTERM, signal.SIG_IGN); open('neto.pid','w').write(str(os.getpid())); time.sleep(600)"],
    env={}, start_new_session=True, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
open('filho.pid', 'w').write(str(os.getpid()))
time.sleep(600)
"""


# --- caminho feliz --------------------------------------------------------------------------------------------
def test_termina_sozinho_e_guarda_a_saida(tmp_path):
    saida = executar(tmp_path, "print('resposta'); import sys; print('aviso', file=sys.stderr)")
    assert saida.codigo == 0 and saida.encerrado_por is None and saida.sobras == () and saida.tempo_para_encerrar_s is None
    assert (tmp_path / "saida.txt").read_text() == "resposta\n" and (tmp_path / "erros.txt").read_text() == "aviso\n"


def test_codigo_de_saida_vem_inteiro(tmp_path):
    assert executar(tmp_path, "raise SystemExit(7)").codigo == 7


def test_nasce_em_sessao_propria_sem_entrada_e_com_arquivos_privados(tmp_path):
    codigo = ("import os, sys; print(os.getsid(0) == os.getpid(), os.getpgrp() == os.getpid(), "
              "sys.stdin.read() == '')")
    executar(tmp_path, codigo)
    assert (tmp_path / "saida.txt").read_text().split() == ["True", "True", "True"]
    for nome in ("saida.txt", "erros.txt", "processo.json"):
        assert stat.S_IMODE((tmp_path / nome).stat().st_mode) == 0o600


def test_so_enxerga_o_ambiente_que_foi_dado(tmp_path, monkeypatch):
    monkeypatch.setenv("VARIAVEL_DO_MOTOR", "valor")
    executar(tmp_path, "import os; print(sorted(k for k in os.environ if k.startswith('VARIAVEL') or k == 'HELENA_EXECUCAO'))")
    assert (tmp_path / "saida.txt").read_text().strip() == "['HELENA_EXECUCAO']"


def test_registra_quem_foi_lancado(tmp_path):
    saida = executar(tmp_path, "pass")
    dados = json.loads((tmp_path / "processo.json").read_text())
    assert dados["pid"] == saida.pid and dados["pgid"] == saida.pid and dados["id_execucao"] == ID and dados["inicio"] > 0


def test_programa_que_nao_existe(tmp_path):
    with pytest.raises(ErroDeLancamento):
        processo.executar(["/nao/existe/hermes"], cwd=tmp_path, env={}, arquivo_de_saida=tmp_path / "s", arquivo_de_erros=tmp_path / "e",
                          arquivo_do_processo=tmp_path / "p", id_execucao=ID, tempo_max_s=5, cancelamento=threading.Event())


# --- tempo ------------------------------------------------------------------------------------------------------
def test_tempo_maximo_encerra_e_diz_que_foi_o_tempo(tmp_path):
    comeco = time.monotonic()
    saida = executar(tmp_path, "import time; time.sleep(600)", tempo=0.5)
    assert saida.encerrado_por == "TEMPO" and saida.codigo == -signal.SIGTERM
    assert time.monotonic() - comeco < 5 and saida.tempo_para_encerrar_s <= 15 and saida.sobras == ()


def test_tempo_mata_o_grupo_inteiro_com_o_neto_em_outra_sessao_e_sem_marca(tmp_path):
    saida = executar(tmp_path, NETO_TEIMOSO, tempo=1.5, graca=0.5)
    assert saida.encerrado_por == "TEMPO" and saida.sobras == ()
    neto, filho = int(esperar_arquivo(tmp_path / "neto.pid")), int(esperar_arquivo(tmp_path / "filho.pid"))
    assert not vivo(neto), "o neto teimoso sobrou"
    assert not vivo(filho) and not vivo(saida.pid)


def test_quem_ignora_o_pedido_de_parada_morre_no_prazo(tmp_path):
    codigo = "import signal, time; signal.signal(signal.SIGTERM, signal.SIG_IGN); open('pronto','w').write('1'); time.sleep(600)"
    comeco = time.monotonic()
    saida = executar(tmp_path, codigo, tempo=0.8, graca=0.5, limite=10)
    assert saida.encerrado_por == "TEMPO" and saida.codigo == -signal.SIGKILL
    assert saida.tempo_para_encerrar_s <= 0.5 + 3 and time.monotonic() - comeco < 8


def test_o_prazo_para_encerrar_vale_mesmo_com_graca_grande(tmp_path):
    """A graça nunca passa do limite total: o plano manda encerrar tudo em até 15 s."""
    codigo = "import signal, time; signal.signal(signal.SIGTERM, signal.SIG_IGN); time.sleep(600)"
    saida = executar(tmp_path, codigo, tempo=0.5, graca=2.0, limite=2.5)
    assert saida.codigo == -signal.SIGKILL and saida.tempo_para_encerrar_s <= 2.5 + 1.5


# --- cancelamento e vigias -----------------------------------------------------------------------------------------
def test_cancelamento_externo_encerra_rapido(tmp_path):
    evento = threading.Event()
    threading.Timer(0.4, evento.set).start()
    comeco = time.monotonic()
    saida = executar(tmp_path, NETO_TEIMOSO, tempo=120, cancelamento=evento, graca=0.5)
    assert saida.encerrado_por == "CANCELAMENTO" and saida.sobras == ()
    assert time.monotonic() - comeco < 5
    assert not vivo(int(esperar_arquivo(tmp_path / "neto.pid")))


def test_cancelamento_antes_de_lancar_encerra_na_primeira_volta(tmp_path):
    evento = threading.Event()
    evento.set()
    saida = executar(tmp_path, "import time; time.sleep(600)", tempo=120, cancelamento=evento)
    assert saida.encerrado_por == "CANCELAMENTO"


def test_vigia_pode_encerrar_com_o_proprio_motivo(tmp_path):
    chamadas = []

    def vigia():
        chamadas.append(1)
        return "LIMITE_CHAMADAS" if len(chamadas) > 5 else None

    saida = executar(tmp_path, "import time; time.sleep(600)", vigias=(vigia,))
    assert saida.encerrado_por == "LIMITE_CHAMADAS" and len(chamadas) == 6


def test_vigia_que_nao_acha_nada_deixa_terminar(tmp_path):
    assert executar(tmp_path, "pass", vigias=(lambda: None,)).encerrado_por is None


# --- sobras depois de terminar sozinho -----------------------------------------------------------------------------------
def test_filho_que_sobrou_depois_do_fim_e_morto(tmp_path):
    """O Hermes saiu, mas deixou um processo com a marca da execução rodando: a varredura final mata."""
    codigo = ("import subprocess, sys; f = subprocess.Popen([sys.executable, '-c', "
              "\"import os,signal,time; signal.signal(signal.SIGTERM, signal.SIG_IGN); open('orfao.pid','w').write(str(os.getpid())); time.sleep(600)\"],"
              " start_new_session=True, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); "
              "import time; time.sleep(0.5)")
    saida = executar(tmp_path, codigo, graca=0.3)
    assert saida.codigo == 0 and saida.encerrado_por is None and saida.sobras == ()
    assert not vivo(int(esperar_arquivo(tmp_path / "orfao.pid")))


# --- matar sobras de uma vida anterior ---------------------------------------------------------------------------------------
def lancar_teimoso(tmp_path, id_execucao):
    codigo = "import signal,time; signal.signal(signal.SIGTERM, signal.SIG_IGN); time.sleep(600)"
    return subprocess.Popen([sys.executable, "-c", codigo], env={"PATH": os.environ["PATH"], "HELENA_EXECUCAO": id_execucao},
                            start_new_session=True, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def test_matar_sobras_limpa_o_que_a_vida_anterior_deixou(tmp_path):
    pasta = tmp_path / "execucoes" / "E-VELHA-1"
    pasta.mkdir(parents=True)
    velho = lancar_teimoso(tmp_path, "E-VELHA-1")
    try:
        inicio = arvore.inicio_do_processo(velho.pid)
        (pasta / "processo.json").write_text(json.dumps({"pid": velho.pid, "pgid": velho.pid, "inicio": inicio, "id_execucao": "E-VELHA-1"}))
        assert matar_sobras(tmp_path / "execucoes", graca_s=0.3, limite_s=8) == ("E-VELHA-1",)
        velho.wait(timeout=5)
        assert not vivo(velho.pid)
        assert matar_sobras(tmp_path / "execucoes") == ()          # já limpo: nada a fazer
    finally:
        velho.kill()


def test_matar_sobras_nao_toca_em_outro_processo_com_o_mesmo_numero(tmp_path):
    """processo.json guarda a hora de início: número reaproveitado por outro programa é deixado em paz."""
    pasta = tmp_path / "execucoes" / "E-VELHA-2"
    pasta.mkdir(parents=True)
    inocente = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(600)"], start_new_session=True,
                                env={"PATH": os.environ["PATH"]})
    try:
        (pasta / "processo.json").write_text(json.dumps({"pid": inocente.pid, "pgid": inocente.pid, "inicio": 1,
                                                          "id_execucao": "E-VELHA-2"}))
        assert matar_sobras(tmp_path / "execucoes", graca_s=0.2, limite_s=3) == ()
        assert inocente.poll() is None, "matou um processo que não era da execução"
    finally:
        inocente.kill()


def test_matar_sobras_com_pasta_inexistente_ou_arquivo_quebrado(tmp_path):
    assert matar_sobras(tmp_path / "nao_existe") == ()
    pasta = tmp_path / "execucoes" / "E-X"
    pasta.mkdir(parents=True)
    (pasta / "processo.json").write_text("{quebrado")
    assert matar_sobras(tmp_path / "execucoes") == ()


# --- árvore de processos (arvore.py) --------------------------------------------------------------------------------------------
def test_ler_processos_enxerga_o_proprio_processo():
    tabela = arvore.ler_processos()
    eu = tabela[os.getpid()]
    assert eu.ppid == os.getppid() and eu.pgid == os.getpgrp() and eu.inicio > 0 and eu.estado != "Z"


def test_descendentes_pela_cadeia_de_pai_e_filho():
    P = arvore.Proc
    tabela = {1: P(1, 0, 1, 1, 1, "S"), 10: P(10, 1, 10, 10, 2, "S"), 11: P(11, 10, 10, 10, 3, "S"),
              12: P(12, 11, 12, 12, 4, "S"), 20: P(20, 1, 20, 20, 5, "S")}
    assert arvore.descendentes(10, tabela) == {11, 12} and arvore.descendentes(20, tabela) == set()


def test_marca_do_ambiente_acha_o_processo(tmp_path):
    marcado = lancar_teimoso(tmp_path, "E-MARCA-1")
    outro = lancar_teimoso(tmp_path, "E-MARCA-2")
    try:
        time.sleep(0.3)
        achados = arvore.com_marcador("E-MARCA-1", arvore.ler_processos())
        assert marcado.pid in achados and outro.pid not in achados
    finally:
        marcado.kill()
        outro.kill()


def test_zumbi_conta_como_morto():
    filho = subprocess.Popen([sys.executable, "-c", "pass"])
    inicio = arvore.inicio_do_processo(filho.pid)
    for _ in range(100):
        info = arvore.ler_processos().get(filho.pid)
        if info is not None and info.estado == "Z":
            break
        time.sleep(0.02)
    assert not arvore.esta_vivo(filho.pid, inicio)         # zumbi (ainda não recolhido) = morto
    filho.wait()


def test_numero_reaproveitado_nao_e_o_mesmo_processo():
    assert arvore.esta_vivo(os.getpid(), arvore.inicio_do_processo(os.getpid()))
    assert not arvore.esta_vivo(os.getpid(), 1)


def test_nunca_manda_sinal_ao_proprio_grupo_nem_ao_init(monkeypatch):
    enviados = []
    monkeypatch.setattr(arvore.os, "killpg", lambda g, s: enviados.append(g))
    arvore._enviar(signal.SIGTERM, os.getpgrp(), {})
    arvore._enviar(signal.SIGTERM, 1, {})
    arvore._enviar(signal.SIGTERM, 0, {})
    arvore._enviar(signal.SIGTERM, None, {})
    assert enviados == []
    arvore._enviar(signal.SIGTERM, 999999, {})
    assert enviados == [999999]
