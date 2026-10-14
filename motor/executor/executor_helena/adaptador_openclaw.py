"""Adaptador do OpenClaw: PRONTO PARA CONECTAR, ainda NÃO aprovado para produção (registro.EM_HOMOLOGACAO).

O que é: o mesmo contrato `Executor` do Hermes, falando com o OpenClaw pelo modo sem interação
`openclaw agent exec` (um turno embutido, sem Gateway). Ele traduz o envelope `--json` do OpenClaw para as
`Evidencias` do núcleo e deixa `decisao.decidir` e `conferencia.conferir_*` classificarem a execução, como o Hermes.

Fonte (lida em 14/10/2026, OpenClaw 2026.10.3, https://raw.githubusercontent.com/openclaw/openclaw/main/docs/):
  - cli/agent.md: `agent exec`, `--message-file`, `--cwd`, `--config` (config fixada, sem herdar a do operador),
    `--model provedor/modelo`, `--timeout` (padrão 600 s), `--json`; envelope estável no stdout
    (`ok`, `status` ok|error|timeout, `final`, `usage`, `assistantTurns`, `toolSummary`, `model`, `provider`,
    `sessionId`, e `error: {message, kind}` na falha); saída 0 = ok, 1 = erro, 2 = tempo.
    `--fallback` só vale se for passado: este adaptador NUNCA passa.
  - gateway/config-tools/tool-policy.md: `tools.profile` e `tools.deny` (o deny vence; aceita `*`).
  - help/environment.md: `OPENCLAW_HOME` (pasta dos padrões, inclusive credenciais).
  - providers/openai.md e providers/openai/setup.md: um só provedor `openai` para chave de API E para a assinatura
    ChatGPT/Codex; login da assinatura com `openclaw models auth login --provider openai --device-code`.
    `--auth-env-only` pula as credenciais guardadas (a assinatura), por isso este adaptador NÃO o usa.

Como roda uma execução:
  1. ficha com ferramenta: recusa SEM lançar nada (ligar o nosso servidor de ferramentas no OpenClaw = NÃO FEITO);
  2. provedor da ficha sem tradução conhecida para o OpenClaw: recusa sem lançar;
  3. escreve o pedido (identidade da ficha + pacote) e uma config FIXADA que nega todas as ferramentas;
  4. lança `openclaw agent exec` num grupo de processos próprio, com ambiente montado do zero (sem segredo:
     o login fica na pasta OPENCLAW_HOME, nunca no ambiente), HOME vazio e pasta de trabalho vazia;
  5. o NOSSO relógio corta no tempo da ficha (o `--timeout` do OpenClaw fica só de reserva, um pouco depois);
  6. lê o envelope `--json` e devolve um `Resultado`.

O que NÃO está confirmado (por isso todas as garantias de `Capacidades` estão desligadas; veja ESTADO_DAS_GARANTIAS):
  - a lista de `error.kind` (a falha só é classificada quando o kind cai no vocabulário que o núcleo já conhece;
    o resto vira DESCONHECIDA, nunca chute);
  - se `provider` = `openai` veio da assinatura ou de chave paga (o OpenClaw usa o mesmo nome para os dois);
  - se uma pasta OPENCLAW_HOME com UM só login impede rotação de conta;
  - o motivo de parada do modelo (`length`): o envelope não traz, então "resposta cortada" não é detectada aqui;
  - a conversa completa: sem `--state-dir` o OpenClaw apaga a sessão no fim; só a resposta final é guardada;
  - a identidade da ficha (missão, regras, nunca) vai como TEXTO do pedido (`--message-file`), não como instrução de
    sistema; se o modelo a trata como o SOUL.md do Hermes é NÃO CONFIRMADO.
"""

import json
import math
import os
import shutil
import tempfile
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Mapping, Optional, Tuple

from . import processo
from .ambiente import MARCADOR, PATH_SEGURO
from .conferencia import conferir_modelo_e_provedor
from .decisao import decidir
from .executor import Executor
from .falha import Evidencias
from .perfil import limite_de_chamadas_vistas, montar_instrucoes
from .segredos import segredos_no_ambiente, segredos_no_texto
from .tipos import (DESCONHECIDA, ENCERRADO_POR_TEMPO, FERRAMENTA, PROVEDOR, Capacidades, Conferencia,
                    ErroDePerfil, Execucao, Falha, Problema, RegistroDeUso, Resultado)
from .uso import ErroDoProvedor, Sessao

VERSAO_DOCUMENTADA = "2026.10.3"

# Provedor da ficha (models.yaml) -> provedor que o OpenClaw usa no `--model` e devolve no envelope.
# `openai-codex` (assinatura ChatGPT) é o provedor `openai` do OpenClaw com o login da assinatura (providers/openai.md).
PROVEDOR_NO_OPENCLAW: Mapping[str, str] = {"openai-codex": "openai", "openai": "openai"}

# A config FIXADA de cada execução: nenhuma ferramenta (o deny vence e `*` pega todas; tool-policy.md).
CONFIG_SEM_FERRAMENTAS = {"tools": {"profile": "minimal", "deny": ["*"]}}

STATUS_CONHECIDOS = ("ok", "error", "timeout")
# "shells report SIGINT and SIGTERM as statuses 130 and 143" (cli/agent.md): sem envelope, é morte por sinal de fora.
SAIDA_POR_SINAL = {130: 2, 143: 15}
TAMANHO_MAXIMO_DO_ENVELOPE = 5_000_000

# Garantia por garantia: o que se sabe hoje. Nenhuma vira True em `Capacidades` antes do dia de prova (README).
ESTADO_DAS_GARANTIAS: Mapping[str, str] = {
    "nome": "DECISÃO NOSSA: openclaw",
    "cancela_em_ate_s": "FEITO PELO ADAPTADOR, provado só com o OpenClaw falso: o adaptador mata o grupo de processos "
                        "inteiro (processo.executar) em até 15 s; falta provar com o OpenClaw real (o `exec` pode ter filhos "
                        "fora do grupo)",
    "ferramentas_por_extenso": "NÃO CONFIRMADO: a config nega todas (`tools.deny: [\"*\"]`), mas o envelope não diz quais "
                               "ferramentas o modelo RECEBEU, só quantas chamou (`toolSummary`); ficha com ferramenta é "
                               "recusada (ligar o nosso servidor = NÃO FEITO)",
    "confere_modelo_e_provedor": "CONFIRMADO NA DOCUMENTAÇÃO (`model` e `provider` no envelope) e conferido pelo adaptador; "
                                 "NÃO CONFIRMADO se `openai` veio da assinatura ou de chave paga",
    "sem_reserva_escondida": "NÃO CONFIRMADO: o adaptador nunca passa `--fallback` e fixa a config; a rotação de conta com "
                             "credencial guardada não está descrita",
    "limita_chamadas": "NÃO CONFIRMADO: o OpenClaw só tem `--timeout`; o adaptador não vê as chamadas durante a execução",
    "falha_vem_do_registro": "PARCIAL: `status` e `error.kind` existem (documentação), a lista de `kind` não está publicada",
    "guarda_conversa": "NÃO CONFIRMADO: sem `--state-dir` a sessão é apagada no fim; só a resposta final é guardada",
}


@dataclass(frozen=True)
class ConfigDoOpenClaw:
    """Tudo que muda de um lugar para outro. Nada aqui é segredo: o login fica DENTRO de `openclaw_home`."""
    comando_openclaw: Tuple[str, ...]                 # ex.: ("/usr/local/bin/openclaw",)
    openclaw_home: Path                               # pasta preparada com o login da assinatura (veja o manual)
    pasta_das_execucoes: Path
    caminho_de_programas: str = PATH_SEGURO           # o OpenClaw é Node: o `node` precisa estar aqui
    graca_ao_encerrar_s: float = 3.0
    limite_para_encerrar_s: float = 15.0
    reserva_do_timeout_s: int = 30                    # o `--timeout` do OpenClaw fica depois do nosso relógio
    intervalo_do_vigia_s: float = 0.2

    def __post_init__(self):
        if not self.comando_openclaw:
            raise ErroDePerfil("comando_openclaw vazio.")
        for campo in ("openclaw_home", "pasta_das_execucoes"):
            if not Path(getattr(self, campo)).is_absolute():
                raise ErroDePerfil(f"{campo} precisa ser um caminho absoluto.")
        if self.limite_para_encerrar_s <= self.graca_ao_encerrar_s:
            raise ErroDePerfil("limite_para_encerrar_s precisa ser maior que a graça.")


def _dentro_de_repositorio(pasta: Path) -> bool:
    return any((p / ".git").exists() for p in [pasta, *pasta.parents])


def _ler_envelope(caminho: Path) -> Optional[dict]:
    """O envelope `--json` do stdout. None se faltar, for grande demais ou não for um objeto JSON."""
    try:
        if caminho.stat().st_size > TAMANHO_MAXIMO_DO_ENVELOPE:
            return None
        dados = json.loads(caminho.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return dados if isinstance(dados, dict) else None


def _inteiro(valor) -> Optional[int]:
    return valor if isinstance(valor, int) and not isinstance(valor, bool) else None


def _texto(valor) -> Optional[str]:
    return valor if isinstance(valor, str) else None


def _uso_do_envelope(envelope: Optional[dict]) -> Optional[dict]:
    """O envelope no formato que o núcleo lê (as mesmas chaves do uso.json do Hermes). Status desconhecido = ilegível."""
    if envelope is None:
        return None
    status = envelope.get("status")
    if status not in STATUS_CONHECIDOS:
        return {}
    uso = envelope.get("usage") if isinstance(envelope.get("usage"), dict) else {}
    completo = status == "ok" and envelope.get("ok") is True
    return {
        "completed": completo,
        "failed": status == "error",
        "model": _texto(envelope.get("model")) if completo else None,
        "provider": _texto(envelope.get("provider")) if completo else None,
        "api_calls": _inteiro(envelope.get("assistantTurns")),
        "input_tokens": _inteiro(uso.get("input")),
        "output_tokens": _inteiro(uso.get("output")),
        "total_tokens": _inteiro(uso.get("total")),
        "session_id": _texto(envelope.get("sessionId")),
    }


def _erro_do_envelope(envelope: Optional[dict]) -> Optional[ErroDoProvedor]:
    """`error.kind` vira tipo e código: o núcleo só classifica o que já está no vocabulário dele (falha.py)."""
    if not envelope or envelope.get("status") != "error" or not isinstance(envelope.get("error"), dict):
        return None
    tipo = _texto(envelope["error"].get("kind"))
    return ErroDoProvedor(motivo_do_dump="openclaw:error.kind", status=None, tipo=tipo, codigo=tipo, voltar_em_s=None)


def _ferramentas_chamadas(envelope: Optional[dict]) -> Tuple[int, Tuple[str, ...]]:
    resumo = envelope.get("toolSummary") if envelope and isinstance(envelope.get("toolSummary"), dict) else {}
    nomes = resumo.get("tools") if isinstance(resumo.get("tools"), list) else []
    return _inteiro(resumo.get("calls")) or 0, tuple(sorted(str(n) for n in nomes))


def _sessao_do_envelope(envelope: Optional[dict], chamadas_de_ferramenta: int) -> Optional[Sessao]:
    if envelope is None or envelope.get("status") not in STATUS_CONHECIDOS:
        return None
    final = _texto(envelope.get("final"))
    return Sessao(
        id=_texto(envelope.get("sessionId")) or "openclaw", fim=_texto(envelope.get("status")),
        chamadas_ao_modelo=_inteiro(envelope.get("assistantTurns")) or 0, max_iteracoes=None,
        resultados_de_ferramenta=chamadas_de_ferramenta, chamadas_invalidas=0,
        houve_resposta_do_assistente=final is not None, ultima_do_assistente=final,
        ultima_tem_chamada_de_ferramenta=False,
        ultimo_finish_reason=None,                # o envelope não traz (NÃO CONFIRMADO: resposta cortada não é vista)
        modelo=None,                              # o modelo usado vem só do envelope; a conferência é a do uso
        prompt_de_sistema=None)


class ExecutorOpenClaw(Executor):
    """O OpenClaw atrás da porta única. Em homologação: o registro recusa a partida em produção."""

    capacidades = Capacidades(
        nome="openclaw", cancela_em_ate_s=0.0, ferramentas_por_extenso=False, confere_modelo_e_provedor=False,
        sem_reserva_escondida=False, limita_chamadas=False, falha_vem_do_registro=False, guarda_conversa=False)
    estado_das_garantias = ESTADO_DAS_GARANTIAS

    def __init__(self, config: ConfigDoOpenClaw):
        self.config = config
        self._trava = threading.Lock()
        self._cancelamentos: Dict[str, threading.Event] = {}

    # --- contrato ---------------------------------------------------------------------------------
    def cancelar(self, id_da_execucao: str) -> bool:
        with self._trava:
            evento = self._cancelamentos.get(id_da_execucao)
        if evento is None:
            return False
        evento.set()
        return True

    def limpar(self, resultado: Resultado) -> None:
        if resultado.pasta is None:
            return
        pasta = Path(resultado.pasta)
        if Path(self.config.pasta_das_execucoes) in pasta.parents and pasta.exists():
            shutil.rmtree(pasta, ignore_errors=True)

    def rodar(self, execucao: Execucao) -> Resultado:
        ficha = execucao.ficha
        if ficha.ferramentas:
            return self._recusa(FERRAMENTA, "FERRAMENTAS_NAO_LIGADAS_NO_OPENCLAW",
                                "o nosso servidor de ferramentas ainda não está ligado ao OpenClaw; use o Hermes")
        provedor = PROVEDOR_NO_OPENCLAW.get(ficha.provedor)
        if provedor is None:
            return self._recusa(PROVEDOR, "PROVEDOR_SEM_TRADUCAO_NO_OPENCLAW",
                                f"o provedor {ficha.provedor!r} da ficha não tem tradução conhecida no OpenClaw")
        pedido = montar_instrucoes(ficha) + "\n---\n\n" + execucao.pacote
        if segredos_no_texto(pedido):
            return self._recusa(DESCONHECIDA, "SEGREDO_NO_PEDIDO", "o pedido tem algo com cara de segredo; nada foi lançado")
        raiz = Path(self.config.pasta_das_execucoes)
        if _dentro_de_repositorio(raiz):
            return self._recusa(DESCONHECIDA, "PASTA_DENTRO_DE_REPOSITORIO", "a pasta das execuções está dentro de um repositório")
        raiz.mkdir(parents=True, exist_ok=True)
        pasta = Path(tempfile.mkdtemp(prefix=f"{execucao.id}-", dir=raiz))
        trabalho, casa, tmp = pasta / "trabalho", pasta / "home", pasta / "tmp"
        for sub in (trabalho, casa, tmp):
            sub.mkdir()
        arquivo_do_pedido, arquivo_da_config = pasta / "pedido.md", pasta / "config.json"
        arquivo_do_pedido.write_text(pedido, encoding="utf-8")
        arquivo_da_config.write_text(json.dumps(CONFIG_SEM_FERRAMENTAS), encoding="utf-8")

        tempo = execucao.tempo_efetivo_s
        comando = tuple(self.config.comando_openclaw) + (
            "agent", "exec", "--message-file", str(arquivo_do_pedido), "--cwd", str(trabalho),
            "--config", str(arquivo_da_config), "--model", f"{provedor}/{ficha.modelo}",
            "--timeout", str(int(math.ceil(tempo)) + self.config.reserva_do_timeout_s), "--json")
        ambiente = {
            "PATH": self.config.caminho_de_programas, "HOME": str(casa), "TMPDIR": str(tmp),
            "OPENCLAW_HOME": str(self.config.openclaw_home), "OPENCLAW_NO_AUTO_UPDATE": "1",
            "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8", "TZ": "America/Sao_Paulo", "NO_COLOR": "1",
            MARCADOR: execucao.id,
        }
        if segredos_no_ambiente(ambiente):
            return self._recusa(DESCONHECIDA, "SEGREDO_NO_AMBIENTE", "o ambiente montado tem algo com cara de segredo", pasta)

        cancelamento = threading.Event()
        with self._trava:
            self._cancelamentos[execucao.id] = cancelamento
        try:
            saida = processo.executar(
                comando, cwd=trabalho, env=ambiente, arquivo_de_saida=pasta / "saida.json",
                arquivo_de_erros=pasta / "erros.txt", arquivo_do_processo=pasta / "processo.json",
                id_execucao=execucao.id, tempo_max_s=tempo, cancelamento=cancelamento,
                graca_s=self.config.graca_ao_encerrar_s, limite_para_encerrar_s=self.config.limite_para_encerrar_s,
                intervalo_s=self.config.intervalo_do_vigia_s)
        except processo.ErroDeLancamento as erro:
            return self._recusa(DESCONHECIDA, "RUNTIME_NAO_LANCOU", str(erro), pasta)
        finally:
            with self._trava:
                self._cancelamentos.pop(execucao.id, None)
        return self._avaliar(execucao, provedor, pasta, comando, saida)

    # --- tradução do envelope NATIVO para as Evidencias do núcleo ---------------------------------
    def _avaliar(self, execucao: Execucao, provedor: str, pasta: Path, comando, saida) -> Resultado:
        ficha = execucao.ficha
        envelope = _ler_envelope(pasta / "saida.json") if saida.encerrado_por is None else None
        encerrado_por = saida.encerrado_por
        if encerrado_por is None and envelope is not None and envelope.get("status") == "timeout":
            encerrado_por = ENCERRADO_POR_TEMPO          # o `--timeout` de reserva do próprio OpenClaw disparou
        codigo = saida.codigo
        if encerrado_por is None and envelope is None and codigo in SAIDA_POR_SINAL:
            codigo = -SAIDA_POR_SINAL[codigo]            # mesma convenção do Resultado: negativo = morto por sinal
        uso = _uso_do_envelope(envelope)
        chamadas, ferramentas_chamadas = _ferramentas_chamadas(envelope)
        sessao = _sessao_do_envelope(envelope, chamadas)
        final = _texto(envelope.get("final")) if envelope else None
        concluiu = bool(uso and uso.get("completed") is True and encerrado_por is None)
        evidencias = Evidencias(
            codigo_de_saida=codigo, encerrado_por=encerrado_por, uso=uso,
            erro_do_provedor=_erro_do_envelope(envelope), sessao=sessao,
            servidor={"listou_ferramentas": True, "ferramentas": [], "encerrada": False, "motivo_encerramento": None,
                      "contadores": {"total": chamadas}, "usou_internet": None},
            saida_vazia=not (final or "").strip(), saida_e_resposta=concluiu and bool((final or "").strip()),
            max_de_chamadas_vistas=limite_de_chamadas_vistas(ficha))

        problemas = []
        if chamadas or ferramentas_chamadas:
            problemas.append(Problema(DESCONHECIDA, "FERRAMENTA_USADA_SEM_PERMISSAO",
                                      f"a ficha não tem ferramenta e o OpenClaw registrou {chamadas} chamada(s)"))
        # O OpenClaw devolve o provedor dele (`openai`); compara-se com a TRADUÇÃO do provedor da ficha.
        problemas += conferir_modelo_e_provedor(ficha.modelo, provedor, uso, None)
        avisos = ()
        if ficha.provedor != provedor:
            avisos = (f"provedor {ficha.provedor!r} da ficha conferido como {provedor!r} do OpenClaw; "
                      "assinatura x chave paga NÃO CONFIRMADO pelo envelope",)
        conferido = Conferencia(problemas=tuple(problemas), avisos=avisos)
        decisao = decidir(execucao, evidencias, conferido, final if concluiu else None)
        conversa = ({"papel": "assistant", "conteudo": final},) if decisao.texto else ()
        return Resultado(
            texto=decisao.texto, terminou_inteira=decisao.terminou_inteira, uso=self._registro_de_uso(uso, chamadas),
            codigo_de_saida=codigo, ferramentas_recebidas=(), modelo_usado=(uso or {}).get("model"),
            provedor_usado=(uso or {}).get("provider"), tempo_s=saida.duracao_s, falha=decisao.falha,
            conferencia=conferido, cancelada=decisao.cancelada, encerrado_por=encerrado_por,
            tempo_para_encerrar_s=saida.tempo_para_encerrar_s, sobras=saida.sobras, pasta=pasta,
            conversa=conversa, comando=tuple(comando))

    @staticmethod
    def _registro_de_uso(uso: Optional[dict], chamadas: int) -> RegistroDeUso:
        uso = uso or {}
        origem, valores = {}, {}
        for campo, chave in (("modelo", "model"), ("provedor", "provider"), ("chamadas_ao_modelo", "api_calls"),
                             ("tokens_entrada", "input_tokens"), ("tokens_saida", "output_tokens"),
                             ("tokens_total", "total_tokens"), ("completo", "completed"), ("falhou", "failed"),
                             ("id_da_sessao", "session_id")):
            if uso.get(chave) is not None:
                valores[campo] = uso[chave]
                origem[campo] = f"openclaw:--json:{chave}"
        origem["chamadas_de_ferramenta"] = "openclaw:--json:toolSummary.calls"
        return RegistroDeUso(chamadas_de_ferramenta=chamadas, origem=origem, **valores)

    def _recusa(self, classe: str, codigo: str, detalhe: str, pasta: Optional[Path] = None) -> Resultado:
        """Nada foi lançado (ou o lançamento falhou): falha clara, sem texto."""
        problema = Problema(classe, codigo, detalhe)
        return Resultado(texto=None, terminou_inteira=False, uso=RegistroDeUso(), codigo_de_saida=None,
                         ferramentas_recebidas=(), modelo_usado=None, provedor_usado=None, tempo_s=0.0,
                         falha=Falha(classe, codigo, detalhe), conferencia=Conferencia((problema,)), pasta=pasta)


def montar_config_do_ambiente(ambiente: Mapping[str, str]) -> ConfigDoOpenClaw:
    """Para o registro: monta a config a partir dos NOMES de variáveis (os valores são caminhos, nunca segredos)."""
    binario = Path(ambiente["HELENA_V2_OPENCLAW_BIN"])
    if not binario.is_absolute() or not binario.is_file() or not os.access(binario, os.X_OK):
        raise ValueError("executável do OpenClaw não está preparado")
    casa = Path(ambiente["HELENA_V2_OPENCLAW_HOME"])
    if not casa.is_absolute() or not casa.is_dir():
        raise ValueError("pasta OPENCLAW_HOME da v2 não está preparada (faça o login da assinatura nela)")
    caminho = ambiente.get("HELENA_V2_OPENCLAW_PATH") or f"{binario.parent}:{PATH_SEGURO}"
    return ConfigDoOpenClaw(comando_openclaw=(str(binario),), openclaw_home=casa,
                            pasta_das_execucoes=Path(ambiente["HELENA_V2_EXECUCOES_DIR"]), caminho_de_programas=caminho)
