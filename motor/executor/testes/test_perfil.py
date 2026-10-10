"""Gerador de perfil: o que ele escreve, o que recusa, e o comando exato do Hermes."""

import os
import stat
from pathlib import Path

import pytest
import yaml

from apoio.ambiente_de_teste import PASTA_DAS_FERRAMENTAS
from executor_helena.perfil import (ConfigDoExecutor, SERVIDOR, gerar_perfil, limite_de_chamadas_vistas, montar_comando,
                                    montar_instrucoes, nomes_visiveis_das_ferramentas, resumo_do_comando, sha256_do_arquivo)
from executor_helena.tipos import ErroDePerfil, Execucao

PACOTE = "Pacote de teste do pedido."


def config(tmp_path, **kw):
    base = dict(comando_hermes=("/opt/hermes/bin/hermes",), raiz_hermes=tmp_path / "hermes",
                pasta_das_execucoes=tmp_path / "execucoes")
    base.update(kw)
    return ConfigDoExecutor(**base)


def execucao(ficha, **kw):
    if ficha.ferramentas and "fontes_permitidas" not in kw:
        kw["fontes_permitidas"] = ("https://exemplo.org/", "https://exemplo.net/lei")
    return Execucao(id=kw.pop("id", "E-1-n1"), ficha=ficha, pacote=kw.pop("pacote", PACOTE), **kw)


def ler_config(perfil):
    return yaml.safe_load((perfil.hermes_home / "config.yaml").read_text(encoding="utf-8"))


# --- pastas ------------------------------------------------------------------------------------------
def test_as_pastas_nascem_vazias_e_privadas(tmp_path, ficha_sem_ferramenta):
    perfil = gerar_perfil(config(tmp_path), execucao(ficha_sem_ferramenta))
    assert perfil.pasta == tmp_path / "execucoes" / "E-1-n1"
    assert perfil.hermes_home == tmp_path / "hermes" / "profiles" / "exec-E-1-n1"
    for pasta in (perfil.trabalho, perfil.home, perfil.codex_vazio, perfil.tmp):
        assert pasta.is_dir() and list(pasta.iterdir()) == [], pasta
    for pasta in (perfil.pasta, perfil.trabalho, perfil.hermes_home):
        assert stat.S_IMODE(pasta.stat().st_mode) == 0o700, pasta
    assert sorted(p.name for p in perfil.hermes_home.iterdir()) == ["SOUL.md", "config.yaml"]


def test_o_perfil_fica_na_pasta_de_perfis_do_hermes_da_v2(tmp_path, ficha_sem_ferramenta):
    perfil = gerar_perfil(config(tmp_path), execucao(ficha_sem_ferramenta))
    assert perfil.hermes_home.parent.name == "profiles" and perfil.hermes_home.parent.parent == tmp_path / "hermes"


def test_uma_execucao_nao_reaproveita_pasta(tmp_path, ficha_sem_ferramenta):
    gerar_perfil(config(tmp_path), execucao(ficha_sem_ferramenta))
    with pytest.raises(ErroDePerfil, match="já tem pasta"):
        gerar_perfil(config(tmp_path), execucao(ficha_sem_ferramenta))


def test_pasta_dentro_de_repositorio_e_recusada(tmp_path, ficha_sem_ferramenta):
    (tmp_path / "repo" / ".git").mkdir(parents=True)
    with pytest.raises(ErroDePerfil, match="dentro de um repositório"):
        gerar_perfil(config(tmp_path, pasta_das_execucoes=tmp_path / "repo" / "execucoes"), execucao(ficha_sem_ferramenta))
    with pytest.raises(ErroDePerfil, match="dentro de um repositório"):
        gerar_perfil(config(tmp_path, raiz_hermes=tmp_path / "repo" / "hermes"), execucao(ficha_sem_ferramenta))
    assert not (tmp_path / "repo" / "execucoes").exists()          # recusou antes de criar qualquer coisa


def test_configuracao_perigosa_e_recusada(tmp_path):
    with pytest.raises(ErroDePerfil, match="absoluto"):
        config(tmp_path, raiz_hermes=Path("relativo"))
    with pytest.raises(ErroDePerfil, match="comando_hermes"):
        config(tmp_path, comando_hermes=())
    with pytest.raises(ErroDePerfil, match="só aceita servidor local"):
        config(tmp_path, endereco_do_provedor="https://api.exemplo.com/v1")
    with pytest.raises(ErroDePerfil, match="maior que a graça"):
        config(tmp_path, graca_ao_encerrar_s=5, limite_para_encerrar_s=5)


def test_execucao_com_id_ou_pacote_ruins_e_recusada(ficha_sem_ferramenta):
    for ruim in ("", "../fora", "com espaco", "a" * 81, ".oculto", "x/y"):
        with pytest.raises(ErroDePerfil, match="id da execução"):
            Execucao(id=ruim, ficha=ficha_sem_ferramenta, pacote=PACOTE)
    with pytest.raises(ErroDePerfil, match="pacote"):
        Execucao(id="E-1", ficha=ficha_sem_ferramenta, pacote="   ")


def test_pacote_com_segredo_e_recusado_antes_de_criar_pasta(tmp_path, ficha_sem_ferramenta):
    with pytest.raises(ErroDePerfil, match="segredo"):
        gerar_perfil(config(tmp_path), execucao(ficha_sem_ferramenta, pacote="use sk-EXEMPLO_NAO_REAL_0123456789abcdef"))
    assert not (tmp_path / "execucoes").exists()


def test_ferramenta_de_leitura_exige_as_fontes(tmp_path, ficha_com_ferramentas):
    with pytest.raises(ErroDePerfil, match="fontes_permitidas"):
        gerar_perfil(config(tmp_path), Execucao(id="E-1", ficha=ficha_com_ferramentas, pacote=PACOTE))


# --- o config.yaml (cada trava conferida aqui, com texto próprio, sem usar o gabarito) --------------------------
def test_config_sem_ferramenta(tmp_path, ficha_sem_ferramenta):
    perfil = gerar_perfil(config(tmp_path), execucao(ficha_sem_ferramenta))
    c = ler_config(perfil)
    assert c["model"] == {"default": "gpt-6-sol", "provider": "openai-codex"}            # sem base_url em produção
    assert c["fallback_providers"] == [] and "fallback" not in yaml.safe_dump(c).replace("fallback_providers", "")
    assert c["memory"] == {"memory_enabled": False, "user_profile_enabled": False, "nudge_interval": 0, "provider": ""}
    assert c["skills"]["creation_nudge_interval"] == 0           # revisão em segundo plano
    assert c["curator"]["enabled"] is False
    assert c["auxiliary"]["title_generation"]["enabled"] is False
    assert c["compression"]["enabled"] is False                   # resumo automático da conversa
    assert c["agent"]["api_max_retries"] == 1                     # nenhuma nova tentativa interna
    assert c["security"]["allow_lazy_installs"] is False          # não instala nada sozinho
    assert c["toolsets"] == [SERVIDOR] and list(c["mcp_servers"]) == [SERVIDOR]
    assert c["mcp_discovery_timeout"] == 45 and c["mcp_servers"][SERVIDOR]["connect_timeout"] == 45
    assert c["mcp_servers"][SERVIDOR]["sampling"] == {"enabled": False}
    args = c["mcp_servers"][SERVIDOR]["args"]
    assert "--servidor-vazio" in args and "--ferramentas" not in args and "tools" not in c["mcp_servers"][SERVIDOR]
    assert args[args.index("--max-total") + 1] == "2" and args[args.index("--execucao") + 1] == "E-1-n1"
    assert args[args.index("--diretorio") + 1] == str(perfil.ferramentas)


def test_config_com_ferramentas_por_extenso(tmp_path, ficha_com_ferramentas):
    perfil = gerar_perfil(config(tmp_path), execucao(ficha_com_ferramentas))
    servidor = ler_config(perfil)["mcp_servers"][SERVIDOR]
    args = servidor["args"]
    assert args[args.index("--ferramentas") + 1] == "ler_pagina,buscar" and "--servidor-vazio" not in args
    assert args[args.index("--max-buscas") + 1] == "3" and args[args.index("--max-partes") + 1] == "4"
    assert args[args.index("--max-total") + 1] == "10"
    assert servidor["tools"] == {"include": ["ler_pagina", "buscar"]}
    fontes = Path(args[args.index("--lista-de-enderecos") + 1])
    assert fontes.read_text().split() == ["https://exemplo.org/", "https://exemplo.net/lei"]
    assert fontes.parent == perfil.ferramentas


def test_o_servidor_leva_a_marca_da_execucao_e_o_caminho_fixo(tmp_path, ficha_sem_ferramenta):
    servidor = ler_config(gerar_perfil(config(tmp_path), execucao(ficha_sem_ferramenta)))["mcp_servers"][SERVIDOR]
    assert servidor["env"]["HELENA_EXECUCAO"] == "E-1-n1"
    assert servidor["env"]["PYTHONPATH"] == str(PASTA_DAS_FERRAMENTAS)
    assert os.path.isabs(servidor["command"]) and servidor["args"][:2] == ["-m", "ferramentas_helena"]


def test_provedor_de_teste_so_com_endereco_local(tmp_path, ficha_sem_ferramenta):
    producao = gerar_perfil(config(tmp_path), execucao(ficha_sem_ferramenta, id="E-1"))
    assert not producao.de_teste and producao.provedor_efetivo == "openai-codex"
    teste = gerar_perfil(config(tmp_path, endereco_do_provedor="http://127.0.0.1:9999/v1"), execucao(ficha_sem_ferramenta, id="E-2"))
    assert teste.de_teste and teste.provedor_efetivo == "custom" and teste.modelo == "gpt-6-sol"
    assert ler_config(teste)["model"] == {"default": "gpt-6-sol", "provider": "custom", "base_url": "http://127.0.0.1:9999/v1"}


# --- instruções ------------------------------------------------------------------------------------------------
def test_instrucoes_sao_so_as_da_ficha(tmp_path, ficha_sem_ferramenta):
    perfil = gerar_perfil(config(tmp_path), execucao(ficha_sem_ferramenta))
    texto = (perfil.hermes_home / "SOUL.md").read_text(encoding="utf-8")
    assert texto == montar_instrucoes(ficha_sem_ferramenta)
    assert ficha_sem_ferramenta.missao in texto
    assert all(r in texto for r in ficha_sem_ferramenta.regras) and all(n in texto for n in ficha_sem_ferramenta.nunca)
    assert "CANARIO_REGRA_UM" in texto and "CANARIO_NUNCA_UM" in texto
    assert PACOTE not in texto                                   # o pedido nunca vai para as instruções
    assert montar_instrucoes(ficha_sem_ferramenta) == montar_instrucoes(ficha_sem_ferramenta)    # determinístico


def test_hashes_batem_com_os_arquivos(tmp_path, ficha_sem_ferramenta):
    perfil = gerar_perfil(config(tmp_path), execucao(ficha_sem_ferramenta))
    assert perfil.hashes == {"config.yaml": sha256_do_arquivo(perfil.hermes_home / "config.yaml"),
                             "SOUL.md": sha256_do_arquivo(perfil.hermes_home / "SOUL.md")}


# --- o comando ---------------------------------------------------------------------------------------------------
@pytest.mark.parametrize("nome", ["sem_ferramenta", "com_ferramentas"])
def test_comando_do_hermes(tmp_path, amb, nome):
    ficha = amb.ficha(nome)
    cfg = config(tmp_path)
    perfil = gerar_perfil(cfg, execucao(ficha))
    comando = montar_comando(cfg, perfil, PACOTE)
    assert comando[:3] == ("/opt/hermes/bin/hermes", "-z", PACOTE)
    assert comando[comando.index("--model") + 1] == "gpt-6-sol"
    assert comando[comando.index("--provider") + 1] == "openai-codex"
    assert comando[comando.index("--usage-file") + 1] == str(perfil.arquivo_de_uso)
    # --toolsets SEMPRE, também para quem não tem ferramenta: sem ele a lista vazia do config liberaria tudo
    assert comando[comando.index("--toolsets") + 1] == SERVIDOR


def test_o_resumo_do_comando_nao_leva_o_pacote(tmp_path, ficha_sem_ferramenta):
    cfg = config(tmp_path)
    comando = montar_comando(cfg, gerar_perfil(cfg, execucao(ficha_sem_ferramenta)), PACOTE)
    resumo = resumo_do_comando(comando)
    assert PACOTE not in " ".join(resumo) and f"<pacote de {len(PACOTE)} caracteres>" in resumo


def test_nomes_visiveis_e_limite_de_chamadas(ficha_sem_ferramenta, ficha_com_ferramentas):
    assert nomes_visiveis_das_ferramentas(ficha_sem_ferramenta) == ()
    assert nomes_visiveis_das_ferramentas(ficha_com_ferramentas) == ("mcp__ferramentas_helena__ler_pagina",
                                                                     "mcp__ferramentas_helena__buscar")
    assert limite_de_chamadas_vistas(ficha_sem_ferramenta) == 2 + 1 + 3 + 2
    assert limite_de_chamadas_vistas(ficha_com_ferramentas) == 10 + 1 + 3 + 2


def test_ambiente_do_perfil_nao_tem_segredo_e_aponta_para_pastas_vazias(tmp_path, ficha_sem_ferramenta, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-EXEMPLO_NAO_REAL_0123456789abcdef")
    perfil = gerar_perfil(config(tmp_path), execucao(ficha_sem_ferramenta))
    assert "OPENAI_API_KEY" not in perfil.ambiente
    assert perfil.ambiente["HERMES_HOME"] == str(perfil.hermes_home) and perfil.ambiente["HOME"] == str(perfil.home)
    assert perfil.ambiente["CODEX_HOME"] == str(perfil.codex_vazio) and perfil.ambiente["TMPDIR"] == str(perfil.tmp)
