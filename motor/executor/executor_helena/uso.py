"""Leitura dos REGISTROS que uma execução deixa. Nada aqui interpreta o texto do agente.

Quatro fontes, todas escritas por programa (nunca pelo agente):

  uso.json         o registro de uso do Hermes (--usage-file): completed, failed, api_calls, model, provider
  sessions/request_dump_*.json   o Hermes grava quando a chamada ao provedor falha de vez: status HTTP,
                   tipo e código do erro. É daqui que se distingue cota de login de queda do provedor.
  state.db         a sessão do Hermes (SQLite): chamadas ao modelo, teto de voltas, mensagens e
                   chamadas de ferramenta. Usado para contar, nunca para ler o que o agente disse.
  estado.json      o do NOSSO servidor de ferramentas: listou as ferramentas?, quantas chamadas, encerrou
                   por limite?

Estas leituras foram escritas contra o hermes-agent 0.19.0 (esquema do state.db e do request_dump
conferidos no código e em execuções reais). Se uma versão nova mudar o formato, a leitura devolve None
e a falha cai em DESCONHECIDA: nunca chuta.
"""

import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

from .tipos import RegistroDeUso

TAMANHO_MAXIMO_DE_REGISTRO = 5_000_000
# O Hermes 0.19.0 grava "(empty)" no lugar de uma resposta vazia do modelo.
RESPOSTAS_VAZIAS_DO_HERMES = ("", "(empty)")


# --- arquivos JSON simples ---------------------------------------------------------------------------
def _json_do_arquivo(caminho: Path) -> Optional[dict]:
    try:
        if Path(caminho).stat().st_size > TAMANHO_MAXIMO_DE_REGISTRO:
            return None
        dados = json.loads(Path(caminho).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return dados if isinstance(dados, dict) else None


def ler_arquivo_de_uso(caminho: Path) -> Optional[dict]:
    return _json_do_arquivo(caminho)


def ler_estado_das_ferramentas(pasta: Path) -> Optional[dict]:
    return _json_do_arquivo(Path(pasta) / "estado.json")


def ferramentas_listadas(servidor: Optional[dict]) -> Tuple[str, ...]:
    """As ferramentas que o Hermes pediu e recebeu do nosso servidor (vazio se nem chegou a pedir)."""
    if servidor and servidor.get("listou_ferramentas") is True and isinstance(servidor.get("ferramentas"), list):
        return tuple(sorted(str(nome) for nome in servidor["ferramentas"]))
    return ()


# --- erro do provedor (request_dump) -----------------------------------------------------------------
@dataclass(frozen=True)
class ErroDoProvedor:
    motivo_do_dump: str            # ex.: max_retries_exhausted, non_retryable_client_error
    status: Optional[int]
    tipo: Optional[str]
    codigo: Optional[str]
    voltar_em_s: Optional[int]


def _inteiro_ou_none(valor: Any) -> Optional[int]:
    return valor if isinstance(valor, int) and not isinstance(valor, bool) else None


def _texto_ou_none(valor: Any) -> Optional[str]:
    return valor if isinstance(valor, str) else None


def ler_erro_do_provedor(hermes_home: Path) -> Optional[ErroDoProvedor]:
    """O request_dump mais novo. Só lê o bloco `error`; nunca o corpo do pedido (tem o pacote)."""
    pasta = Path(hermes_home) / "sessions"
    if not pasta.is_dir():
        return None
    candidatos = sorted(pasta.glob("request_dump_*.json"), key=lambda p: p.stat().st_mtime)
    if not candidatos:
        return None
    dados = _json_do_arquivo(candidatos[-1])
    erro = dados.get("error") if dados else None
    if not isinstance(erro, dict):
        return None
    corpo = erro.get("body") if isinstance(erro.get("body"), dict) else {}
    return ErroDoProvedor(
        motivo_do_dump=_texto_ou_none(dados.get("reason")) or "",
        status=_inteiro_ou_none(erro.get("status_code")) or _inteiro_ou_none(erro.get("response_status")),
        tipo=_texto_ou_none(erro.get("type")) or _texto_ou_none(corpo.get("type")),
        codigo=_texto_ou_none(erro.get("code")) or _texto_ou_none(corpo.get("code")),
        voltar_em_s=_inteiro_ou_none(corpo.get("resets_in_seconds")))


# --- sessão do Hermes (state.db) ---------------------------------------------------------------------
@dataclass(frozen=True)
class Sessao:
    id: str
    fim: Optional[str]
    chamadas_ao_modelo: int
    max_iteracoes: Optional[int]
    resultados_de_ferramenta: int
    chamadas_invalidas: int                     # chamadas a ferramenta que NÃO é da ficha
    houve_resposta_do_assistente: bool          # existe ao menos uma mensagem do agente na sessão
    ultima_do_assistente: Optional[str]         # só para conferir identidade com a saída; nunca é interpretada
    ultima_tem_chamada_de_ferramenta: bool
    ultimo_finish_reason: Optional[str]
    modelo: Optional[str]
    prompt_de_sistema: Optional[str]


def _abrir_somente_leitura(hermes_home: Path) -> Optional[sqlite3.Connection]:
    caminho = Path(hermes_home) / "state.db"
    if not caminho.exists():
        return None
    try:
        return sqlite3.connect(f"file:{caminho}?mode=ro", uri=True, timeout=2.0)
    except sqlite3.Error:
        return None


def contar_resultados_de_ferramenta(hermes_home: Path) -> int:
    """Quantas chamadas de ferramenta já foram respondidas na sessão (usado pelo vigia, durante a execução)."""
    conexao = _abrir_somente_leitura(hermes_home)
    if conexao is None:
        return 0
    try:
        return int(conexao.execute("SELECT COUNT(*) FROM messages WHERE role = 'tool'").fetchone()[0])
    except sqlite3.Error:
        return 0
    finally:
        conexao.close()


def _nomes_das_chamadas(texto_json: Optional[str]) -> List[str]:
    try:
        chamadas = json.loads(texto_json) if texto_json else []
    except ValueError:
        return ["<ilegivel>"]
    nomes = []
    for chamada in chamadas if isinstance(chamadas, list) else []:
        funcao = chamada.get("function") if isinstance(chamada, dict) else None
        nomes.append(str(funcao.get("name")) if isinstance(funcao, dict) and funcao.get("name") else "<sem_nome>")
    return nomes


def ler_sessao(hermes_home: Path, nomes_validos: Sequence[str]) -> Optional[Sessao]:
    """A sessão mais nova do state.db. `nomes_validos` = como o modelo vê as ferramentas da ficha."""
    conexao = _abrir_somente_leitura(hermes_home)
    if conexao is None:
        return None
    try:
        sessao = conexao.execute(
            "SELECT id, end_reason, api_call_count, model_config, model, system_prompt FROM sessions "
            "ORDER BY started_at DESC LIMIT 1").fetchone()
        if sessao is None:
            return None
        id_, fim, chamadas, configuracao, modelo, prompt = sessao
        try:
            max_iteracoes = _inteiro_ou_none(json.loads(configuracao or "{}").get("max_iterations"))
        except ValueError:
            max_iteracoes = None
        mensagens = conexao.execute(
            "SELECT role, content, tool_calls, finish_reason FROM messages WHERE session_id = ? ORDER BY id",
            (id_,)).fetchall()
    except sqlite3.Error:
        return None
    finally:
        conexao.close()
    validos = set(nomes_validos)
    invalidas = sum(1 for _, _, chamadas_json, _ in mensagens for nome in _nomes_das_chamadas(chamadas_json)
                    if nome not in validos)
    do_assistente = [m for m in mensagens if m[0] == "assistant"]
    ultima = do_assistente[-1] if do_assistente else None
    return Sessao(
        id=str(id_), fim=_texto_ou_none(fim), chamadas_ao_modelo=int(chamadas or 0), max_iteracoes=max_iteracoes,
        resultados_de_ferramenta=sum(1 for m in mensagens if m[0] == "tool"), chamadas_invalidas=invalidas,
        houve_resposta_do_assistente=ultima is not None,
        ultima_do_assistente=_texto_ou_none(ultima[1]) if ultima else None,
        ultima_tem_chamada_de_ferramenta=bool(ultima and _nomes_das_chamadas(ultima[2])),
        ultimo_finish_reason=_texto_ou_none(ultima[3]) if ultima else None,
        modelo=_texto_ou_none(modelo), prompt_de_sistema=_texto_ou_none(prompt))


def resposta_do_agente_e_vazia(sessao: Sessao) -> bool:
    """A última mensagem do agente existe, não pede ferramenta e está vazia (ou é o "(empty)" do Hermes)."""
    if not sessao.houve_resposta_do_assistente or sessao.ultima_tem_chamada_de_ferramenta:
        return False
    return (sessao.ultima_do_assistente or "").strip() in RESPOSTAS_VAZIAS_DO_HERMES


# Frases PRÓPRIAS do Hermes 0.19.0 (não do modelo) que não deixam outro registro. Lista fechada.
FRASES_DO_HERMES = {"CONTEXTO_GRANDE": "Context overflow and auto-compaction is disabled"}


def codigo_da_frase_do_hermes(saida: Optional[str], arquivo_de_uso: Optional[dict], sessao: Optional[Sessao]) -> Optional[str]:
    """Reconhece uma frase do próprio Hermes, mas SÓ quando o registro prova que o texto não é do agente.

    Provas exigidas: o registro de uso diz failed=true E a sessão não tem nenhuma mensagem do agente.
    Fora disso (execução normal, ou o agente escrevendo a mesma frase) devolve None. O caso existe porque
    o Hermes, ao estourar o tamanho da conversa com o resumo automático desligado, não grava o erro em
    nenhum arquivo: só imprime a frase.
    """
    if not saida or not isinstance(arquivo_de_uso, dict) or arquivo_de_uso.get("failed") is not True:
        return None
    if sessao is None or sessao.houve_resposta_do_assistente:
        return None
    for codigo, prefixo in FRASES_DO_HERMES.items():
        if saida.strip().startswith(prefixo):
            return codigo
    return None


def saida_e_a_resposta_do_agente(saida: Optional[str], sessao: Optional[Sessao]) -> bool:
    """True só se o que o Hermes imprimiu É a última mensagem do agente gravada na sessão.

    Quando o Hermes falha (cota, limite de voltas, resposta vazia...) ele imprime uma frase PRÓPRIA no
    mesmo lugar da resposta, com código de saída 0. Essa frase não está entre as mensagens do agente.
    Comparar com a sessão separa as duas coisas sem interpretar nenhum texto.
    """
    if saida is None or sessao is None or sessao.ultima_do_assistente is None or sessao.ultima_tem_chamada_de_ferramenta:
        return False
    impresso, gravado = saida.strip(), sessao.ultima_do_assistente.strip()
    return bool(impresso) and bool(gravado) and (impresso == gravado or impresso in gravado)


def exportar_conversa(hermes_home: Path, limite_bytes: int) -> Tuple[Dict[str, Any], ...]:
    """A conversa da execução, para o motor guardar no banco antes de apagar a pasta."""
    conexao = _abrir_somente_leitura(hermes_home)
    if conexao is None:
        return ()
    try:
        linhas = conexao.execute(
            "SELECT m.role, m.content, m.tool_calls, m.tool_name, m.timestamp FROM messages m "
            "WHERE m.session_id = (SELECT id FROM sessions ORDER BY started_at DESC LIMIT 1) ORDER BY m.id").fetchall()
    except sqlite3.Error:
        return ()
    finally:
        conexao.close()
    saida: List[Dict[str, Any]] = []
    gasto = 0
    for papel, conteudo, chamadas, ferramenta, instante in linhas:
        item = {"papel": papel, "conteudo": conteudo, "chamadas": chamadas, "ferramenta": ferramenta, "instante": instante}
        gasto += len(json.dumps(item, ensure_ascii=False))
        if gasto > limite_bytes:
            saida.append({"papel": "sistema", "conteudo": "[conversa cortada: passou do limite guardado]",
                          "chamadas": None, "ferramenta": None, "instante": None})
            break
        saida.append(item)
    return tuple(saida)


# --- o registro de uso que o executor entrega -------------------------------------------------------
def montar_registro_de_uso(uso: Optional[dict], servidor: Optional[dict]) -> RegistroDeUso:
    """Junta o que o Hermes disse (uso.json) com o que o nosso servidor contou. Cada campo diz de onde veio."""
    uso = uso or {}
    contadores = (servidor or {}).get("contadores") or {}
    origem = {}

    def do_hermes(campo: str, chave: str, tipo):
        valor = uso.get(chave)
        if isinstance(valor, tipo) and not (tipo is int and isinstance(valor, bool)):
            origem[campo] = f"hermes:uso.json:{chave}"
            return valor
        return None

    chamadas_de_ferramenta = contadores.get("total") if isinstance(contadores.get("total"), int) else None
    if chamadas_de_ferramenta is not None:
        origem["chamadas_de_ferramenta"] = "ferramentas:estado.json:contadores.total"
    usou_internet = (servidor or {}).get("usou_internet")
    if isinstance(usou_internet, bool):
        origem["usou_internet"] = "ferramentas:estado.json:usou_internet"
    return RegistroDeUso(
        modelo=do_hermes("modelo", "model", str), provedor=do_hermes("provedor", "provider", str),
        chamadas_ao_modelo=do_hermes("chamadas_ao_modelo", "api_calls", int),
        tokens_entrada=do_hermes("tokens_entrada", "input_tokens", int),
        tokens_saida=do_hermes("tokens_saida", "output_tokens", int),
        tokens_total=do_hermes("tokens_total", "total_tokens", int),
        completo=do_hermes("completo", "completed", bool), falhou=do_hermes("falhou", "failed", bool),
        id_da_sessao=do_hermes("id_da_sessao", "session_id", str),
        chamadas_de_ferramenta=chamadas_de_ferramenta,
        usou_internet=usou_internet if isinstance(usou_internet, bool) else None, origem=origem)
