"""O Hermes de mentira imita o `hermes -z` do hermes-agent 0.19.0 no que importa. Aqui se prova cada imitação.

(Que a imitação é fiel ao Hermes de verdade é provado em verificacao_real/, com os mesmos cenários.)
"""

import json
import os
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

from apoio.ambiente_de_teste import HERMES_FALSO, PASTA_DAS_FERRAMENTAS, SERVIDOR_DE_TESTE
from executor_helena.provedor_falso import Cenario, ServidorDeProvedorFalso, Simulacao


@pytest.fixture
def mundo(tmp_path):
    with ServidorDeProvedorFalso() as servidor:
        yield Mundo(tmp_path, servidor)


class Mundo:
    def __init__(self, tmp_path, servidor):
        self.base, self.servidor = tmp_path, servidor
        self.home, self.trabalho, self.casa = tmp_path / "hh", tmp_path / "trabalho", tmp_path / "casa"
        for pasta in (self.home, self.trabalho, self.casa):
            pasta.mkdir()

    def config(self, **extra):
        base = {"model": {"default": "m", "provider": "custom", "base_url": self.servidor.endereco},
                "mcp_servers": {"ferramentas_helena": {
                    "command": sys.executable,
                    "args": [str(SERVIDOR_DE_TESTE), "--execucao", "E-1", "--diretorio", str(self.base / "ferr"), "--servidor-vazio",
                             "--max-total", "3"],
                    "env": {"PYTHONPATH": str(PASTA_DAS_FERRAMENTAS), "VARIAVEL_DA_CONFIG": "veio-da-config"}}}}
        base.update(extra)
        (self.home / "config.yaml").write_text(yaml.safe_dump(base))

    def rodar(self, prompt="oi", *flags, env_extra=None, cenario=None, config=True, cwd=None):
        if cenario is not None:
            self.servidor.definir(cenario)
        if config:
            self.config()
        env = {"PATH": os.environ["PATH"], "HOME": str(self.casa), "HERMES_HOME": str(self.home), **(env_extra or {})}
        p = subprocess.run([sys.executable, str(HERMES_FALSO), "-z", prompt, "--usage-file", str(self.base / "uso.json"), *flags],
                           cwd=cwd or self.trabalho, env=env, capture_output=True, text=True, timeout=60)
        return p

    def uso(self):
        return json.loads((self.base / "uso.json").read_text())


# --- ferramentas --------------------------------------------------------------------------------------------------
def test_toolsets_liga_so_o_servidor_pedido(mundo):
    p = mundo.rodar("oi", "--model", "m", "--provider", "custom", "--toolsets", "ferramentas_helena")
    assert p.returncode == 0 and mundo.servidor.pedidos_de_chat()[0].nomes_das_ferramentas() == ()
    assert json.loads((mundo.base / "ferr" / "estado.json").read_text())["listou_ferramentas"] is True


def test_sem_toolsets_e_lista_do_config_hermes_cli_libera_ferramentas_embutidas(mundo):
    mundo.config(toolsets=["hermes-cli"])
    mundo.rodar("oi", "--model", "m", config=False)
    nomes = mundo.servidor.pedidos_de_chat()[0].nomes_das_ferramentas()
    assert "terminal" in nomes and "write_file" in nomes            # é isto que "lista vazia libera tudo" quer dizer


def test_toolsets_desconhecido_nao_serve_para_nada(mundo):
    p = mundo.rodar("oi", "--model", "m", "--toolsets", "nao_existe")
    assert p.returncode == 2 and "did not contain any valid toolsets" in p.stderr and mundo.servidor.pedidos() == []


def test_provedor_sem_modelo_e_recusado(mundo):
    p = mundo.rodar("oi", "--provider", "custom")
    assert p.returncode == 2 and "requires --model" in p.stderr


def test_o_servidor_mcp_nao_herda_o_ambiente_do_hermes(mundo, tmp_path):
    espiao = tmp_path / "espiao.py"
    espiao.write_text("import json, os, sys\nopen(%r, 'w').write(json.dumps(sorted(os.environ)))\nsys.stdin.read()\n" % str(tmp_path / "env.json"))
    mundo.config(mcp_servers={"x": {"command": sys.executable, "args": [str(espiao)], "env": {"VARIAVEL_DA_CONFIG": "1"},
                                  "connect_timeout": 1}})       # o espião não fala MCP: o Hermes desiste dele em 1 s e segue
    mundo.rodar("oi", "--model", "m", "--toolsets", "x", env_extra={"OPENAI_API_KEY": "sk-EXEMPLO_NAO_REAL_0123456789abcdef"}, config=False)
    nomes = json.loads((tmp_path / "env.json").read_text())
    assert "OPENAI_API_KEY" not in nomes and "VARIAVEL_DA_CONFIG" in nomes and "HOME" in nomes


def test_o_servidor_mcp_nasce_em_outra_sessao(mundo, tmp_path):
    espiao = tmp_path / "espiao.py"
    espiao.write_text("import os, sys\nopen(%r, 'w').write('%%d %%d' %% (os.getsid(0), os.getppid()))\nsys.stdin.read()\n" % str(tmp_path / "sessao.txt"))
    mundo.config(mcp_servers={"x": {"command": sys.executable, "args": [str(espiao)], "connect_timeout": 1}})
    mundo.rodar("oi", "--model", "m", "--toolsets", "x", config=False)
    sessao_do_servidor, pai = map(int, (tmp_path / "sessao.txt").read_text().split())
    assert sessao_do_servidor != os.getsid(0) and pai > 1


# --- instruções e contexto --------------------------------------------------------------------------------------------------
def test_o_soul_e_a_identidade_do_prompt_de_sistema(mundo):
    (mundo.home / "SOUL.md").write_text("IDENTIDADE_DE_TESTE\n")
    mundo.rodar("oi", "--model", "m")
    sistema = mundo.servidor.pedidos_de_chat()[0].texto_do_sistema()
    assert sistema.startswith("IDENTIDADE_DE_TESTE") and "# Project Context" not in sistema
    assert sqlite3.connect(mundo.home / "state.db").execute("select system_prompt from sessions").fetchone()[0] == sistema


def test_sem_soul_o_hermes_usa_a_identidade_padrao_e_cria_o_arquivo(mundo):
    mundo.rodar("oi", "--model", "m")
    assert "Hermes Agent" in mundo.servidor.pedidos_de_chat()[0].texto_do_sistema() and (mundo.home / "SOUL.md").exists()


@pytest.mark.parametrize("nome", ["AGENTS.md", "CLAUDE.md", ".cursorrules", ".hermes.md"])
def test_arquivo_de_contexto_na_pasta_atual_entra_no_prompt(mundo, nome):
    (mundo.trabalho / nome).write_text("CANARIO_" + nome)
    mundo.rodar("oi", "--model", "m")
    sistema = mundo.servidor.pedidos_de_chat()[0].texto_do_sistema()
    assert "# Project Context" in sistema and "CANARIO_" + nome in sistema


def test_hermes_md_ganha_de_agents_md(mundo):
    (mundo.trabalho / "AGENTS.md").write_text("DO_AGENTS")
    (mundo.trabalho / ".hermes.md").write_text("DO_HERMES_MD")
    mundo.rodar("oi", "--model", "m")
    sistema = mundo.servidor.pedidos_de_chat()[0].texto_do_sistema()
    assert "DO_HERMES_MD" in sistema and "DO_AGENTS" not in sistema


def test_arquivo_de_contexto_na_pasta_de_cima_nao_entra_sem_repositorio(mundo):
    (mundo.base / "AGENTS.md").write_text("DO_PAI")
    (mundo.base / ".hermes.md").write_text("DO_PAI_HERMES")
    mundo.rodar("oi", "--model", "m")
    assert "DO_PAI" not in mundo.servidor.pedidos_de_chat()[0].texto_do_sistema()


def test_hermes_md_de_cima_entra_quando_ha_repositorio(mundo):
    (mundo.base / ".git").mkdir()
    (mundo.base / ".hermes.md").write_text("DO_REPOSITORIO")
    mundo.rodar("oi", "--model", "m")
    assert "DO_REPOSITORIO" in mundo.servidor.pedidos_de_chat()[0].texto_do_sistema()


# --- como o Hermes termina ------------------------------------------------------------------------------------------------------
def test_execucao_boa_escreve_o_arquivo_de_uso_e_a_sessao(mundo):
    p = mundo.rodar("oi", "--model", "gpt-x", "--provider", "custom")
    assert p.returncode == 0 and json.loads(p.stdout)["acao"] == "ENTREGAR"
    uso = mundo.uso()
    assert uso["completed"] is True and uso["failed"] is False and uso["api_calls"] == 1
    assert uso["model"] == "gpt-x" and uso["provider"] == "custom" and uso["session_id"]
    banco = sqlite3.connect(mundo.home / "state.db")
    assert banco.execute("select count(*) from messages").fetchone()[0] == 2
    assert json.loads(banco.execute("select model_config from sessions").fetchone()[0])["max_iterations"] == 90


@pytest.mark.parametrize("simulacao,status", [(Simulacao.ERRO_429, 429), (Simulacao.LOGIN_RECUSADO, 401), (Simulacao.ERRO_500, 503)])
def test_erro_do_provedor_sai_com_zero_frase_do_hermes_e_dump(mundo, simulacao, status):
    p = mundo.rodar("oi", "--model", "m", cenario=Cenario(simulacao))
    assert p.returncode == 0 and p.stdout.startswith("API call failed after") and f"HTTP {status}" in p.stdout
    uso = mundo.uso()
    assert uso["failed"] is True and uso["completed"] is False and uso["model"] is None
    (dump,) = list((mundo.home / "sessions").glob("request_dump_*.json"))
    assert json.loads(dump.read_text())["error"]["status_code"] == status


def test_queda_no_meio_tenta_4_vezes_e_sai_com_2_sem_imprimir(mundo):
    p = mundo.rodar("oi", "--model", "m", cenario=Cenario(Simulacao.QUEDA_NO_MEIO))
    assert p.returncode == 2 and p.stdout == "" and len(mundo.servidor.pedidos_de_chat()) == 4
    assert mundo.uso()["completed"] is False and mundo.uso()["failed"] is False and not list((mundo.home / "sessions").glob("*"))


def test_resposta_vazia_tenta_4_vezes_e_diz_completo(mundo):
    p = mundo.rodar("oi", "--model", "m", cenario=Cenario(Simulacao.RESPOSTA_VAZIA))
    assert p.returncode == 0 and "No reply" in p.stdout and len(mundo.servidor.pedidos_de_chat()) == 4 and mundo.uso()["completed"] is True


def test_ferramenta_inexistente_3_vezes_encerra_com_frase_do_hermes(mundo):
    p = mundo.rodar("oi", "--model", "m", cenario=Cenario(Simulacao.LACO_DE_FERRAMENTA, voltas_do_laco=200))
    assert p.returncode == 0 and "invalid tool call" in p.stdout and len(mundo.servidor.pedidos_de_chat()) == 3
    assert mundo.uso()["completed"] is False and mundo.uso()["failed"] is False


def test_teto_de_90_voltas(mundo):
    mundo.config(mcp_servers={"ferramentas_helena": {"command": sys.executable, "args": [
        str(SERVIDOR_DE_TESTE), "--execucao", "E-1", "--diretorio", str(mundo.base / "ferr"), "--ferramentas", "buscar",
        "--max-buscas", "500", "--max-total", "500", "--qualquer-endereco-publico"],
        "env": {"PYTHONPATH": str(PASTA_DAS_FERRAMENTAS)}}})
    cenario = Cenario(Simulacao.LACO_DE_FERRAMENTA, voltas_do_laco=1000, ferramenta="mcp__ferramentas_helena__buscar",
                      argumentos='{"consulta": "c {n}"}')
    p = mundo.rodar("oi", "--model", "m", "--toolsets", "ferramentas_helena", cenario=cenario, config=False)
    assert "iteration limit" in p.stdout and mundo.uso()["api_calls"] == 90 and len(mundo.servidor.pedidos_de_chat()) == 90


def test_resposta_cortada_pede_para_continuar_3_vezes(mundo):
    p = mundo.rodar("oi", "--model", "m", cenario=Cenario(Simulacao.SAIDA_CORTADA))
    assert len(mundo.servidor.pedidos_de_chat()) == 4 and mundo.uso()["completed"] is False and p.returncode == 0


def test_contexto_grande_com_resumo_desligado(mundo):
    p = mundo.rodar("oi", "--model", "m", cenario=Cenario(Simulacao.CONTEXTO_GRANDE))
    assert p.stdout.startswith("Context overflow and auto-compaction is disabled") and mundo.uso()["failed"] is True
    assert not list((mundo.home / "sessions").glob("*"))


# --- o que o Hermes faria por conta própria (e por isso o perfil proíbe) -----------------------------------------------------------
def test_reserva_configurada_e_usada_na_primeira_falha_de_cota(mundo):
    with ServidorDeProvedorFalso(Cenario(Simulacao.BOA)) as reserva:
        mundo.config(fallback_providers=[{"provider": "custom", "model": "gpt-reserva", "base_url": reserva.endereco}])
        mundo.servidor.definir(Cenario(Simulacao.ERRO_429))
        p = mundo.rodar("oi", "--model", "m", config=False)
        assert p.returncode == 0 and len(reserva.pedidos_de_chat()) == 1 and mundo.uso()["model"] == "gpt-reserva"


def test_sem_reserva_a_cota_e_o_fim(mundo):
    with ServidorDeProvedorFalso(Cenario(Simulacao.BOA)) as reserva:
        mundo.rodar("oi", "--model", "m", cenario=Cenario(Simulacao.ERRO_429))
        assert reserva.pedidos_de_chat() == [] and len(mundo.servidor.pedidos_de_chat()) == 1


def test_login_do_codex_e_adotado_quando_o_home_o_tem(mundo):
    (mundo.casa / ".codex").mkdir()
    (mundo.casa / ".codex" / "auth.json").write_text('{"tokens": {"access_token": "EXEMPLO_NAO_REAL"}}')
    mundo.rodar("oi", "--model", "m", cenario=Cenario(Simulacao.LOGIN_RECUSADO))
    assert (mundo.home / "auth.json").exists() and len(mundo.servidor.pedidos_de_chat()) == 2


def test_com_codex_home_vazio_nada_e_adotado(mundo):
    (mundo.casa / ".codex").mkdir()
    (mundo.casa / ".codex" / "auth.json").write_text('{"tokens": {}}')
    vazio = mundo.base / "codex_vazio"
    vazio.mkdir()
    mundo.rodar("oi", "--model", "m", cenario=Cenario(Simulacao.LOGIN_RECUSADO), env_extra={"CODEX_HOME": str(vazio)})
    assert not (mundo.home / "auth.json").exists() and len(mundo.servidor.pedidos_de_chat()) == 1


# --- ganchos de teste -------------------------------------------------------------------------------------------------------------------
def test_gancho_do_filho_teimoso_cria_um_processo_em_outra_sessao(mundo):
    marca = mundo.base / "marca.txt"
    mundo.servidor.definir(Cenario(Simulacao.BOA))
    p = subprocess.Popen([sys.executable, str(HERMES_FALSO), "-z", "oi [[FILHO_TEIMOSO]]", "--model", "m"],
                         cwd=mundo.trabalho, env={"PATH": os.environ["PATH"], "HOME": str(mundo.casa), "HERMES_HOME": str(mundo.home),
                                                  "MARCA_DO_TESTE": "sim"})
    mundo.config()
    p.wait(30)
    assert p.returncode == 0
    filhos = subprocess.run(["pgrep", "-f", "time.sleep\\(600\\)"], capture_output=True, text=True).stdout.split()
    for pid in filhos:
        try:
            if b"MARCA_DO_TESTE=sim" in Path(f"/proc/{pid}/environ").read_bytes():
                os.kill(int(pid), 9)
                return
        except OSError:
            continue
    pytest.fail("o filho teimoso não foi criado")
