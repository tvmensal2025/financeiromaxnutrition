"""Gabarito do perfil: cada trava quebrada é percebida, e o perfil gerado passa limpo."""

import copy

import pytest
import yaml

from executor_helena.gabarito import violacoes_do_perfil
from executor_helena.perfil import ConfigDoExecutor, SERVIDOR, gerar_perfil
from executor_helena.tipos import Execucao


def gerar(tmp_path, ficha, **kw):
    cfg = ConfigDoExecutor(comando_hermes=("/opt/hermes/bin/hermes",), raiz_hermes=tmp_path / "hermes",
                           pasta_das_execucoes=tmp_path / "execucoes", **kw)
    fontes = ("https://exemplo.org/",) if ficha.ferramentas else None
    perfil = gerar_perfil(cfg, Execucao(id="E-1-n1", ficha=ficha, pacote="pedido", fontes_permitidas=fontes))
    return perfil, yaml.safe_load((perfil.hermes_home / "config.yaml").read_text())


def codigos(config, perfil):
    return sorted(p.codigo for p in violacoes_do_perfil(config, perfil.ficha, perfil.provedor_efetivo, perfil.de_teste))


@pytest.mark.parametrize("nome", ["sem_ferramenta", "com_ferramentas"])
def test_perfil_gerado_passa_limpo(tmp_path, amb, nome):
    perfil, config = gerar(tmp_path, amb.ficha(nome))
    assert codigos(config, perfil) == []


def test_perfil_de_teste_com_endereco_passa_limpo(tmp_path, ficha_sem_ferramenta):
    perfil, config = gerar(tmp_path, ficha_sem_ferramenta, endereco_do_provedor="http://127.0.0.1:9999/v1")
    assert codigos(config, perfil) == []


def mudar(caminho, valor):
    def aplicar(config):
        alvo = config
        for chave in caminho[:-1]:
            alvo = alvo.setdefault(chave, {})
        alvo[caminho[-1]] = valor
    return aplicar


def apagar(caminho):
    def aplicar(config):
        alvo = config
        for chave in caminho[:-1]:
            alvo = alvo[chave]
        del alvo[caminho[-1]]
    return aplicar


def args_do_servidor(mexer):
    def aplicar(config):
        mexer(config["mcp_servers"][SERVIDOR]["args"])
    return aplicar


def trocar_arg(nome, valor):
    def mexer(args):
        args[args.index(nome) + 1] = valor
    return args_do_servidor(mexer)


DEFEITOS = [
    ("MODELO_FORA_DA_FICHA", mudar(("model", "default"), "gpt-escondido")),
    ("PROVEDOR_FORA_DA_FICHA", mudar(("model", "provider"), "openrouter")),
    ("ENDERECO_DE_PROVEDOR_NAO_PREVISTO", mudar(("model", "base_url"), "https://api.exemplo.com/v1")),
    ("RESERVA_CONFIGURADA", mudar(("fallback_providers",), [{"provider": "openrouter", "model": "x"}])),
    ("RESERVA_CONFIGURADA", mudar(("model", "fallback_model"), "gpt-6-luna")),
    ("RESERVA_CONFIGURADA", mudar(("auxiliary", "fallback"), {"provider": "x"})),
    ("RESERVA_CONFIGURADA", mudar(("fallback_providers_extra",), [])),
    ("MEMORIA_LIGADA", mudar(("memory", "memory_enabled"), True)),
    ("MEMORIA_LIGADA", apagar(("memory", "memory_enabled"))),                # sem a chave vale o padrão do Hermes (ligado)
    ("PERFIL_DO_USUARIO_LIGADO", mudar(("memory", "user_profile_enabled"), True)),
    ("MEMORIA_COM_REVISAO_EM_SEGUNDO_PLANO", mudar(("memory", "nudge_interval"), 10)),
    ("MEMORIA_EXTERNA", mudar(("memory", "provider"), "mem0")),
    ("REVISAO_DE_HABILIDADES_LIGADA", mudar(("skills", "creation_nudge_interval"), 10)),
    ("CURADORIA_LIGADA", mudar(("curator", "enabled"), True)),
    ("CURADORIA_LIGADA", apagar(("curator",))),
    ("RESUMO_AUTOMATICO_LIGADO", mudar(("compression", "enabled"), True)),
    ("TITULO_AUTOMATICO_LIGADO", mudar(("auxiliary", "title_generation", "enabled"), True)),
    ("INSTALACAO_AUTOMATICA_LIGADA", mudar(("security", "allow_lazy_installs"), True)),
    ("NOVA_TENTATIVA_INTERNA_LIGADA", mudar(("agent", "api_max_retries"), 3)),
    ("NOVA_TENTATIVA_INTERNA_LIGADA", mudar(("agent", "api_max_retries"), 0)),
    ("LISTA_DE_FERRAMENTAS_DIFERENTE", mudar(("toolsets",), ["hermes-cli"])),
    ("LISTA_DE_FERRAMENTAS_DIFERENTE", mudar(("toolsets",), [])),            # lista vazia libera tudo no Hermes
    ("LISTA_DE_FERRAMENTAS_DIFERENTE", apagar(("toolsets",))),
    ("SERVIDORES_DIFERENTES", mudar(("mcp_servers", "outro"), {"command": "x"})),
    ("SERVIDORES_DIFERENTES", mudar(("mcp_servers",), {})),
    ("LIMITE_DE_CHAMADAS_FORA_DA_FICHA", trocar_arg("--max-total", "999")),
    ("SERVIDOR_PODE_PEDIR_RESPOSTA_AO_MODELO", mudar(("mcp_servers", SERVIDOR, "sampling", "enabled"), True)),
    ("SERVIDOR_PODE_PEDIR_RESPOSTA_AO_MODELO", apagar(("mcp_servers", SERVIDOR, "sampling"))),
    ("ESPERA_PELO_SERVIDOR_CURTA", mudar(("mcp_servers", SERVIDOR, "connect_timeout"), 15)),
    ("ESPERA_DA_PRIMEIRA_VOLTA_CURTA", mudar(("mcp_discovery_timeout",), 1.5)),
    ("ESPERA_DA_PRIMEIRA_VOLTA_CURTA", apagar(("mcp_discovery_timeout",))),
]


@pytest.mark.parametrize("esperado,defeito", DEFEITOS, ids=[f"{i}-{d[0]}" for i, d in enumerate(DEFEITOS)])
def test_cada_defeito_e_percebido(tmp_path, ficha_sem_ferramenta, esperado, defeito):
    perfil, config = gerar(tmp_path, ficha_sem_ferramenta)
    estragado = copy.deepcopy(config)
    defeito(estragado)
    assert esperado in codigos(estragado, perfil), codigos(estragado, perfil)


def test_servidor_vazio_exigido_para_quem_nao_tem_ferramenta(tmp_path, ficha_sem_ferramenta):
    perfil, config = gerar(tmp_path, ficha_sem_ferramenta)
    config["mcp_servers"][SERVIDOR]["args"] += ["--ferramentas", "buscar"]
    assert "SERVIDOR_NAO_ESTA_VAZIO" in codigos(config, perfil)
    config["mcp_servers"][SERVIDOR]["args"].remove("--servidor-vazio")
    assert "SERVIDOR_NAO_ESTA_VAZIO" in codigos(config, perfil)


def test_ferramentas_do_servidor_precisam_ser_as_da_ficha(tmp_path, ficha_com_ferramentas):
    perfil, config = gerar(tmp_path, ficha_com_ferramentas)
    config["mcp_servers"][SERVIDOR]["args"][config["mcp_servers"][SERVIDOR]["args"].index("--ferramentas") + 1] = "ler_pagina"
    assert "FERRAMENTAS_DO_SERVIDOR_DIFERENTES_DA_FICHA" in codigos(config, perfil)


def test_filtro_de_ferramentas_precisa_repetir_a_ficha(tmp_path, ficha_com_ferramentas):
    perfil, config = gerar(tmp_path, ficha_com_ferramentas)
    config["mcp_servers"][SERVIDOR]["tools"]["include"] = ["ler_pagina"]
    assert "FILTRO_DE_FERRAMENTAS_DIFERENTE_DA_FICHA" in codigos(config, perfil)
    del config["mcp_servers"][SERVIDOR]["tools"]
    assert "FILTRO_DE_FERRAMENTAS_DIFERENTE_DA_FICHA" in codigos(config, perfil)


def test_tipo_do_valor_importa(tmp_path, ficha_sem_ferramenta):
    """False e 0 não são a mesma coisa para o Hermes: 'memory_enabled: 0' deve ser percebido como diferente do esperado."""
    perfil, config = gerar(tmp_path, ficha_sem_ferramenta)
    config["memory"]["memory_enabled"] = "false"
    assert "MEMORIA_LIGADA" in codigos(config, perfil)
