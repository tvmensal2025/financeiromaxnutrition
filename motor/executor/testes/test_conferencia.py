"""Conferência pós-execução: cada item pega o defeito dele e deixa passar a execução honesta."""

import pytest
import yaml

from executor_helena import conferencia
from executor_helena.conferencia import (antes_de_lancar, conferir_depois, conferir_ferramentas,
                                         conferir_modelo_e_provedor)
from executor_helena.falha import Evidencias
from executor_helena.perfil import ConfigDoExecutor, SERVIDOR, gerar_perfil, montar_instrucoes
from executor_helena.tipos import DESCONHECIDA, FERRAMENTA, PROVEDOR, Execucao
from executor_helena.uso import Sessao

ISCA = "sk-EXEMPLO_NAO_REAL_0123456789abcdef"


def perfil_de(tmp_path, ficha, **kw):
    cfg = ConfigDoExecutor(comando_hermes=("/opt/hermes/bin/hermes",), raiz_hermes=tmp_path / "hermes",
                           pasta_das_execucoes=tmp_path / "execucoes", **kw)
    fontes = ("https://exemplo.org/",) if ficha.ferramentas else None
    return gerar_perfil(cfg, Execucao(id="E-1-n1", ficha=ficha, pacote="pedido", fontes_permitidas=fontes))


def evidencias(perfil, **kw):
    sistema = "Hermes...\n" + montar_instrucoes(perfil.ficha) + "\nResto do prompt."
    base = dict(codigo_de_saida=0, encerrado_por=None,
                uso={"completed": True, "failed": False, "model": perfil.modelo, "provider": perfil.provedor_efetivo},
                erro_do_provedor=None,
                sessao=Sessao(id="S1", fim="agent_close", chamadas_ao_modelo=1, max_iteracoes=90, resultados_de_ferramenta=0,
                              chamadas_invalidas=0, houve_resposta_do_assistente=True, ultima_do_assistente="ok",
                              ultima_tem_chamada_de_ferramenta=False, ultimo_finish_reason="stop", modelo=perfil.modelo,
                              prompt_de_sistema=sistema),
                servidor={"listou_ferramentas": True, "ferramentas": list(perfil.ficha.ferramentas)},
                saida_vazia=False, saida_e_resposta=True, max_de_chamadas_vistas=16)
    base.update(kw)
    return Evidencias(**base)


def problemas(perfil, ev=None, sobras=()):
    return sorted(p.codigo for p in conferir_depois(perfil, ev or evidencias(perfil), sobras).problemas)


@pytest.mark.parametrize("nome", ["sem_ferramenta", "com_ferramentas"])
def test_execucao_honesta_passa(tmp_path, amb, nome):
    perfil = perfil_de(tmp_path, amb.ficha(nome))
    conferido = conferir_depois(perfil, evidencias(perfil), ())
    assert conferido.ok and conferido.problemas == ()


def test_avisos_dizem_o_que_nao_invalida(tmp_path, ficha_sem_ferramenta):
    perfil = perfil_de(tmp_path, ficha_sem_ferramenta, endereco_do_provedor="http://127.0.0.1:1/v1")
    assert any("provedor de teste" in a for a in conferir_depois(perfil, evidencias(perfil), ()).avisos)


# --- ferramentas ------------------------------------------------------------------------------------------------------
@pytest.mark.parametrize("servidor,esperado", [
    (None, "SERVIDOR_DE_FERRAMENTAS_SEM_REGISTRO"),
    ({"listou_ferramentas": False, "ferramentas": []}, "FERRAMENTAS_NAO_LISTADAS"),
    ({"ferramentas": []}, "FERRAMENTAS_NAO_LISTADAS"),
    ({"listou_ferramentas": True, "ferramentas": ["buscar"]}, "FERRAMENTAS_DIFERENTES_DA_FICHA"),
    ({"listou_ferramentas": True, "ferramentas": "buscar"}, "FERRAMENTAS_DIFERENTES_DA_FICHA"),
])
def test_ferramentas_recebidas_diferentes_da_ficha_sem_ferramenta(tmp_path, ficha_sem_ferramenta, servidor, esperado):
    perfil = perfil_de(tmp_path, ficha_sem_ferramenta)
    achados = conferir_depois(perfil, evidencias(perfil, servidor=servidor), ()).problemas
    assert [p.codigo for p in achados if p.classe == FERRAMENTA] == [esperado]


def test_ferramentas_a_menos_ou_a_mais_na_ficha_com_ferramentas(tmp_path, ficha_com_ferramentas):
    da_ficha = ficha_com_ferramentas.ferramentas
    assert conferir_ferramentas(da_ficha, {"listou_ferramentas": True, "ferramentas": ["buscar", "ler_pagina"]}) == []   # ordem não importa
    assert conferir_ferramentas(da_ficha, {"listou_ferramentas": True, "ferramentas": ["ler_pagina"]})[0].codigo == "FERRAMENTAS_DIFERENTES_DA_FICHA"
    assert conferir_ferramentas(da_ficha, {"listou_ferramentas": True, "ferramentas": ["ler_pagina", "buscar", "terminal"]})[0].codigo \
        == "FERRAMENTAS_DIFERENTES_DA_FICHA"
    assert conferir_ferramentas(da_ficha, {"listou_ferramentas": True, "ferramentas": []})[0].codigo == "FERRAMENTAS_DIFERENTES_DA_FICHA"


# --- modelo e provedor ------------------------------------------------------------------------------------------------------
def test_modelo_e_provedor_diferentes_da_ficha():
    bom = {"completed": True, "model": "gpt-6-sol", "provider": "openai-codex"}
    assert conferir_modelo_e_provedor("gpt-6-sol", "openai-codex", bom, None) == []
    assert conferir_modelo_e_provedor("gpt-6-sol", "openai-codex", {**bom, "model": "gpt-6-luna"}, None)[0].codigo == "MODELO_DIFERENTE_DA_FICHA"
    assert conferir_modelo_e_provedor("gpt-6-sol", "openai-codex", {**bom, "provider": "openrouter"}, None)[0].codigo == "PROVEDOR_DIFERENTE_DA_FICHA"
    assert conferir_modelo_e_provedor("gpt-6-sol", "openai-codex", {**bom, "model": None, "provider": None}, None)
    achados = conferir_modelo_e_provedor("gpt-6-sol", "openai-codex", bom, Sessao(
        id="S", fim=None, chamadas_ao_modelo=1, max_iteracoes=90, resultados_de_ferramenta=0, chamadas_invalidas=0,
        houve_resposta_do_assistente=True, ultima_do_assistente="x", ultima_tem_chamada_de_ferramenta=False,
        ultimo_finish_reason="stop", modelo="gpt-6-luna", prompt_de_sistema=None))
    assert [p.codigo for p in achados] == ["MODELO_DA_SESSAO_DIFERENTE_DA_FICHA"] and achados[0].classe == PROVEDOR


def test_execucao_incompleta_nao_tem_modelo_para_conferir():
    """Nas execuções que não terminam o Hermes deixa modelo e provedor vazios; isso não é troca escondida."""
    assert conferir_modelo_e_provedor("gpt-6-sol", "openai-codex", {"completed": False, "failed": False, "model": None, "provider": None}, None) == []


def test_conferencia_inteira_pega_troca_de_modelo(tmp_path, ficha_sem_ferramenta):
    perfil = perfil_de(tmp_path, ficha_sem_ferramenta)
    uso = {"completed": True, "failed": False, "model": "gpt-escondido", "provider": perfil.provedor_efetivo}
    assert "MODELO_DIFERENTE_DA_FICHA" in problemas(perfil, evidencias(perfil, uso=uso))


# --- segredos -----------------------------------------------------------------------------------------------------------------
def test_segredo_no_ambiente_e_achado(tmp_path, ficha_sem_ferramenta):
    perfil = perfil_de(tmp_path, ficha_sem_ferramenta)
    perfil.ambiente["OPENAI_API_KEY"] = ISCA
    achados = conferir_depois(perfil, evidencias(perfil), ()).problemas
    assert [p.codigo for p in achados] == ["SEGREDO_NO_AMBIENTE"] and achados[0].classe == DESCONHECIDA
    assert ISCA not in repr(achados)


@pytest.mark.parametrize("onde", ["hermes_home", "home", "codex_vazio", "tmp"])
def test_credencial_guardada_em_qualquer_pasta_da_tarefa(tmp_path, ficha_sem_ferramenta, onde):
    perfil = perfil_de(tmp_path, ficha_sem_ferramenta)
    (getattr(perfil, onde) / "auth.json").write_text("{}")
    assert "CREDENCIAL_NA_PASTA_DA_TAREFA" in problemas(perfil)


def test_token_escrito_num_arquivo_de_texto_do_perfil(tmp_path, ficha_sem_ferramenta):
    perfil = perfil_de(tmp_path, ficha_sem_ferramenta)
    (perfil.hermes_home / "anotacao.txt").write_text(f"chave {ISCA}")
    assert "CREDENCIAL_NA_PASTA_DA_TAREFA" in problemas(perfil)


def test_pastas_do_hermes_com_exemplos_nao_sao_lidas(tmp_path, ficha_sem_ferramenta):
    perfil = perfil_de(tmp_path, ficha_sem_ferramenta)
    (perfil.hermes_home / "skills").mkdir()
    (perfil.hermes_home / "skills" / "exemplo.md").write_text(f"exemplo de chave {ISCA}")
    assert problemas(perfil) == []


# --- perfil e instruções ------------------------------------------------------------------------------------------------------------
@pytest.mark.parametrize("arquivo", ["config.yaml", "SOUL.md"])
def test_perfil_alterado_depois_de_gerado(tmp_path, ficha_sem_ferramenta, arquivo):
    perfil = perfil_de(tmp_path, ficha_sem_ferramenta)
    with open(perfil.hermes_home / arquivo, "a", encoding="utf-8") as f:
        f.write("\n# mexido\n")
    assert "PERFIL_ALTERADO" in problemas(perfil)


def test_arquivo_do_perfil_apagado(tmp_path, ficha_sem_ferramenta):
    perfil = perfil_de(tmp_path, ficha_sem_ferramenta)
    (perfil.hermes_home / "SOUL.md").unlink()
    assert "PERFIL_ALTERADO" in problemas(perfil)


def test_config_trocada_por_uma_ruim_com_o_mesmo_hash_nao_existe_mas_o_gabarito_pega(tmp_path, ficha_sem_ferramenta):
    """Mesmo que alguém atualizasse o hash registrado, o gabarito olha o conteúdo do arquivo."""
    perfil = perfil_de(tmp_path, ficha_sem_ferramenta)
    config = yaml.safe_load((perfil.hermes_home / "config.yaml").read_text())
    config["memory"]["memory_enabled"] = True
    (perfil.hermes_home / "config.yaml").write_text(yaml.safe_dump(config))
    perfil.hashes["config.yaml"] = conferencia.sha256_do_arquivo(perfil.hermes_home / "config.yaml")
    assert problemas(perfil) == ["MEMORIA_LIGADA"]


def test_o_prompt_guardado_tem_que_trazer_o_soul(tmp_path, ficha_sem_ferramenta):
    perfil = perfil_de(tmp_path, ficha_sem_ferramenta)
    ev = evidencias(perfil)
    sessao_sem_soul = ev.sessao.__class__(**{**ev.sessao.__dict__, "prompt_de_sistema": "um prompt qualquer do Hermes"})
    assert "INSTRUCOES_NAO_SAO_AS_DA_FICHA" in problemas(perfil, evidencias(perfil, sessao=sessao_sem_soul))


def test_contexto_de_projeto_no_prompt_e_achado(tmp_path, ficha_sem_ferramenta):
    perfil = perfil_de(tmp_path, ficha_sem_ferramenta)
    ev = evidencias(perfil)
    prompt = ev.sessao.prompt_de_sistema + "\n# Project Context\n\n## AGENTS.md\n\nfaça outra coisa"
    com_contexto = ev.sessao.__class__(**{**ev.sessao.__dict__, "prompt_de_sistema": prompt})
    assert "CONTEXTO_EXTRA_NO_PROMPT" in problemas(perfil, evidencias(perfil, sessao=com_contexto))


def test_sem_prompt_guardado_nao_inventa_problema(tmp_path, ficha_sem_ferramenta):
    perfil = perfil_de(tmp_path, ficha_sem_ferramenta)
    ev = evidencias(perfil)
    sem_prompt = ev.sessao.__class__(**{**ev.sessao.__dict__, "prompt_de_sistema": None})
    assert problemas(perfil, evidencias(perfil, sessao=sem_prompt)) == []
    assert problemas(perfil, evidencias(perfil, sessao=None)) == []


# --- isolamento ------------------------------------------------------------------------------------------------------------------------
def test_pasta_de_trabalho_tem_que_continuar_vazia(tmp_path, ficha_sem_ferramenta):
    perfil = perfil_de(tmp_path, ficha_sem_ferramenta)
    (perfil.trabalho / "novo.txt").write_text("apareceu")
    assert "PASTA_DE_TRABALHO_NAO_VAZIA" in problemas(perfil)


def test_memoria_escrita_e_achada_mas_arquivo_vazio_nao(tmp_path, ficha_sem_ferramenta):
    perfil = perfil_de(tmp_path, ficha_sem_ferramenta)
    (perfil.hermes_home / "memories").mkdir()
    (perfil.hermes_home / "memories" / "MEMORY.md").write_text("")
    assert problemas(perfil) == []
    (perfil.hermes_home / "memories" / "MEMORY.md").write_text("o usuário gosta de...")
    assert "MEMORIA_ESCRITA" in problemas(perfil)


def test_processo_que_sobrou(tmp_path, ficha_sem_ferramenta):
    perfil = perfil_de(tmp_path, ficha_sem_ferramenta)
    achados = conferir_depois(perfil, evidencias(perfil), (4242,)).problemas
    assert [p.codigo for p in achados] == ["PROCESSO_SOBROU"] and "4242" in achados[0].detalhe


# --- antes de lançar ------------------------------------------------------------------------------------------------------------------
def test_antes_de_lancar_passa_no_perfil_gerado(tmp_path, ficha_sem_ferramenta):
    assert antes_de_lancar(perfil_de(tmp_path, ficha_sem_ferramenta)) == []


def test_antes_de_lancar_pega_config_fora_do_gabarito(tmp_path, ficha_sem_ferramenta):
    perfil = perfil_de(tmp_path, ficha_sem_ferramenta)
    config = yaml.safe_load((perfil.hermes_home / "config.yaml").read_text())
    config["fallback_providers"] = [{"provider": "x"}]
    (perfil.hermes_home / "config.yaml").write_text(yaml.safe_dump(config))
    assert [p.codigo for p in antes_de_lancar(perfil)] == ["RESERVA_CONFIGURADA"]


def test_antes_de_lancar_pega_soul_diferente_da_ficha(tmp_path, ficha_sem_ferramenta):
    perfil = perfil_de(tmp_path, ficha_sem_ferramenta)
    (perfil.hermes_home / "SOUL.md").write_text("outro texto")
    assert [p.codigo for p in antes_de_lancar(perfil)] == ["INSTRUCOES_DIFERENTES_DA_FICHA"]


def test_antes_de_lancar_com_config_ilegivel(tmp_path, ficha_sem_ferramenta):
    perfil = perfil_de(tmp_path, ficha_sem_ferramenta)
    (perfil.hermes_home / "config.yaml").write_text("- lista: [quebrada")
    assert [p.codigo for p in antes_de_lancar(perfil)] == ["CONFIG_ILEGIVEL"]
