"""CONFERÊNCIA PÓS-EXECUÇÃO: antes de contar a execução, confere que ela rodou do jeito que a ficha manda.

Itens (cada defeito vira um Problema com a classe que o motor deve usar):

  ferramentas     o que o Hermes listou do nosso servidor == a lista da ficha (inclusive vazio)   FERRAMENTA
  modelo/provedor o registro de uso e a sessão dizem o modelo e o provedor do perfil              PROVEDOR
  segredo         ambiente, pasta do perfil e pastas da execução sem credencial                   DESCONHECIDA
  perfil          config.yaml e SOUL.md terminaram iguais aos gerados, e dentro do gabarito       DESCONHECIDA
  instruções      o prompt de sistema que o Hermes guardou traz o SOUL.md e nenhum contexto extra DESCONHECIDA
  isolamento      pasta de trabalho vazia, memória sem nada escrito, nenhum processo sobrando     DESCONHECIDA

Quem falha aqui NÃO conta como execução: o texto não é entregue como resposta.
"""

from typing import List, Optional, Sequence, Tuple

import yaml

from .falha import Evidencias
from .gabarito import violacoes_do_perfil
from .perfil import Perfil, montar_instrucoes, sha256_do_arquivo
from .segredos import segredos_na_pasta, segredos_no_ambiente
from .tipos import DESCONHECIDA, FERRAMENTA, PROVEDOR, Conferencia, Problema
from .uso import Sessao

# Pastas do Hermes que guardam material dele (ou exemplos) e não são lidas à procura de segredo.
PASTAS_QUE_NAO_SAO_LIDAS = ("skills", "logs", "sessions", "sandboxes", "cron", "hooks", "audio_cache",
                            "image_cache", "pairing", "checkpoints")
# Frase que o Hermes 0.19.0 põe no prompt de sistema quando achou AGENTS.md, CLAUDE.md etc.
MARCADOR_DE_CONTEXTO_DO_PROJETO = "# Project Context"


def _config_do_disco(perfil: Perfil) -> Optional[dict]:
    try:
        dados = yaml.safe_load((perfil.hermes_home / "config.yaml").read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError):
        return None
    return dados if isinstance(dados, dict) else None


def antes_de_lancar(perfil: Perfil) -> List[Problema]:
    """Confere o arquivo que está no disco contra o gabarito. Chamado ANTES de lançar o Hermes."""
    configuracao = _config_do_disco(perfil)
    if configuracao is None:
        return [Problema(DESCONHECIDA, "CONFIG_ILEGIVEL", "não consegui ler o config.yaml gerado")]
    achados = violacoes_do_perfil(configuracao, perfil.ficha, perfil.provedor_efetivo, perfil.de_teste)
    if (perfil.hermes_home / "SOUL.md").read_text(encoding="utf-8") != montar_instrucoes(perfil.ficha):
        achados.append(Problema(DESCONHECIDA, "INSTRUCOES_DIFERENTES_DA_FICHA", "SOUL.md não é o texto gerado da ficha"))
    return achados


def conferir_ferramentas(da_ficha: Sequence[str], servidor: Optional[dict]) -> List[Problema]:
    """O que o Hermes listou do nosso servidor tem de ser EXATAMENTE a lista da ficha (vazia também)."""
    if servidor is None:
        return [Problema(FERRAMENTA, "SERVIDOR_DE_FERRAMENTAS_SEM_REGISTRO", "o servidor de ferramentas não deixou estado.json")]
    if servidor.get("listou_ferramentas") is not True:
        return [Problema(FERRAMENTA, "FERRAMENTAS_NAO_LISTADAS", "o Hermes não pediu a lista de ferramentas do nosso servidor")]
    recebidas = servidor.get("ferramentas")
    if not isinstance(recebidas, list) or sorted(recebidas) != sorted(da_ficha):
        return [Problema(FERRAMENTA, "FERRAMENTAS_DIFERENTES_DA_FICHA",
                         f"recebeu {sorted(recebidas) if isinstance(recebidas, list) else recebidas!r}, "
                         f"a ficha manda {sorted(da_ficha)}")]
    return []


def conferir_modelo_e_provedor(modelo: str, provedor: str, arquivo_de_uso: Optional[dict],
                               sessao: Optional[Sessao]) -> List[Problema]:
    """O modelo e o provedor que o Hermes diz ter usado são os do perfil (que são os da ficha)."""
    achados = []
    uso = arquivo_de_uso or {}
    if uso.get("completed") is True:              # execução incompleta ou com falha: o Hermes deixa modelo e provedor vazios
        if uso.get("model") != modelo:
            achados.append(Problema(PROVEDOR, "MODELO_DIFERENTE_DA_FICHA", f"usou {uso.get('model')!r}, a ficha manda {modelo!r}"))
        if uso.get("provider") != provedor:
            achados.append(Problema(PROVEDOR, "PROVEDOR_DIFERENTE_DA_FICHA",
                                    f"usou {uso.get('provider')!r}, a ficha manda {provedor!r}"))
    if sessao is not None and sessao.modelo not in (None, modelo):
        achados.append(Problema(PROVEDOR, "MODELO_DA_SESSAO_DIFERENTE_DA_FICHA",
                                f"a sessão guardou {sessao.modelo!r}, a ficha manda {modelo!r}"))
    return achados


def _segredos(perfil: Perfil) -> List[Problema]:
    achados = []
    for item in segredos_no_ambiente(perfil.ambiente):
        achados.append(Problema(DESCONHECIDA, "SEGREDO_NO_AMBIENTE", item))
    for pasta, rotulo in ((perfil.hermes_home, "perfil"), (perfil.home, "home"), (perfil.codex_vazio, "codex_vazio"),
                          (perfil.tmp, "tmp")):
        for arquivo, motivo in segredos_na_pasta(pasta, ignorar=PASTAS_QUE_NAO_SAO_LIDAS):
            achados.append(Problema(DESCONHECIDA, "CREDENCIAL_NA_PASTA_DA_TAREFA", f"{rotulo}/{arquivo}: {motivo}"))
    return achados


def _perfil_igual_ao_gerado(perfil: Perfil) -> List[Problema]:
    achados = []
    for nome, esperado in perfil.hashes.items():
        caminho = perfil.hermes_home / nome
        if not caminho.exists() or sha256_do_arquivo(caminho) != esperado:
            achados.append(Problema(DESCONHECIDA, "PERFIL_ALTERADO", f"{nome} terminou diferente do gerado"))
    configuracao = _config_do_disco(perfil)
    if configuracao is not None:
        achados += violacoes_do_perfil(configuracao, perfil.ficha, perfil.provedor_efetivo, perfil.de_teste)
    return achados


def _instrucoes(perfil: Perfil, ev: Evidencias) -> List[Problema]:
    achados = []
    prompt = ev.sessao.prompt_de_sistema if ev.sessao else None
    if prompt:
        if montar_instrucoes(perfil.ficha).strip() not in prompt:
            achados.append(Problema(DESCONHECIDA, "INSTRUCOES_NAO_SAO_AS_DA_FICHA", "o prompt guardado não traz o SOUL.md"))
        if MARCADOR_DE_CONTEXTO_DO_PROJETO in prompt:
            achados.append(Problema(DESCONHECIDA, "CONTEXTO_EXTRA_NO_PROMPT", "o Hermes carregou um arquivo de contexto de projeto"))
    return achados


def _isolamento(perfil: Perfil, sobras: Tuple[int, ...]) -> List[Problema]:
    achados = []
    if any(perfil.trabalho.iterdir()):
        achados.append(Problema(DESCONHECIDA, "PASTA_DE_TRABALHO_NAO_VAZIA", "apareceu arquivo na pasta de trabalho"))
    memorias = perfil.hermes_home / "memories"
    if memorias.is_dir() and any(f.is_file() and f.stat().st_size > 0 for f in memorias.rglob("*")):
        achados.append(Problema(DESCONHECIDA, "MEMORIA_ESCRITA", "o Hermes escreveu na memória"))
    if sobras:
        achados.append(Problema(DESCONHECIDA, "PROCESSO_SOBROU", f"processos que não morreram: {list(sobras)}"))
    return achados


def conferir_depois(perfil: Perfil, ev: Evidencias, sobras: Tuple[int, ...]) -> Conferencia:
    problemas: List[Problema] = []
    problemas += conferir_ferramentas(perfil.ficha.ferramentas, ev.servidor)
    problemas += conferir_modelo_e_provedor(perfil.modelo, perfil.provedor_efetivo, ev.uso, ev.sessao)
    problemas += _segredos(perfil)
    problemas += _perfil_igual_ao_gerado(perfil)
    problemas += _instrucoes(perfil, ev)
    problemas += _isolamento(perfil, sobras)
    avisos = list(perfil.ficha.avisos)
    if perfil.de_teste:
        avisos.append(f"provedor de teste: {perfil.provedor_efetivo} em servidor local (não é o provedor da ficha)")
    return Conferencia(problemas=tuple(problemas), avisos=tuple(avisos))
