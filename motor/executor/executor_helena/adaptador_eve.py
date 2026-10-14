"""Adaptador da EVE (Vercel): PRONTO PARA CONECTAR, ainda NÃO aprovado para produção (registro.EM_HOMOLOGACAO).

O que é: o mesmo contrato `Executor` do Hermes, falando com um servidor da EVE já ligado (`eve build` + `eve start`,
ou um deploy) pela API HTTP de sessão. Traduz o fluxo NDJSON da EVE para as `Evidencias` do núcleo e deixa
`decisao.decidir` e `conferencia.conferir_*` classificarem a execução, como o Hermes.

Fonte (lida em 14/10/2026, pacote npm `eve@0.79.0`, publicado em 13/10/2026; pasta docs/ do pacote):
  - concepts/sessions-runs-and-streaming.md: `POST /eve/v1/session` com `{"message": ...}` cria a sessão e começa o
    primeiro turno (202 + `sessionId`); `GET /eve/v1/session/<id>/stream` é NDJSON com o cabeçalho
    `x-eve-stream-version` (o cliente oficial aceita 21 a 26); `POST /eve/v1/session/<id>/cancel` é ASSÍNCRONO
    (confirma-se por `turn.cancelled`); eventos `step.started` (`modelId`), `step.completed` (`finishReason`, `usage`),
    `step.failed`/`turn.failed` (`code`, `message`, `details`), `message.completed` (`message`, `finishReason`),
    `actions.requested`, `action.result`, `turn.completed`, `turn.cancelled`, `session.failed`.
    "eve runs each durable step up to four times": a repetição é da própria EVE.
  - dist/src/protocol/message.d.ts: a forma de cada evento (campos acima).
  - agent-config.md: `chatgpt()` (assinatura ChatGPT) "cannot run in a deployment"; em servidor a EVE exige
    `AI_GATEWAY_API_KEY`, `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY` (chave PAGA). Por isso ficha com provedor
    `openai-codex` é RECUSADA aqui, sem chamar nada: usar a EVE em servidor é decisão do fundador (trocar o
    provedor no models.yaml).
  - guides/auth-and-route-protection.md: a rota exige autenticação; em servidor próprio, um verificador de bearer
    (ex.: `jwtHmac()`) em `agent/channels/eve.ts`. O adaptador manda `Authorization: Bearer` com o valor da variável
    HELENA_V2_EVE_TOKEN (o valor nunca é impresso nem gravado).
  - dist/src/harness/model-call/*.js (CÓDIGO do pacote, não documentação): `MODEL_CALL_FAILED` traz
    `details.statusCode` e `details.semanticErrorId` (ex.: `gateway-rate-limited`). Usado para separar cota, login
    e provedor; o que não estiver na tabela vira DESCONHECIDA.

O que NÃO está confirmado (todas as garantias de `Capacidades` desligadas; veja ESTADO_DAS_GARANTIAS). Além delas:
a identidade da ficha (missão, regras, nunca) vai como TEXTO da mensagem, porque a API de sessão não recebe instrução
de sistema por pedido; se o modelo a trata como o SOUL.md do Hermes é NÃO CONFIRMADO.
"""

import http.client
import json
import queue
import shutil
import socket
import tempfile
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Tuple
from urllib.parse import urlsplit

from .conferencia import conferir_modelo_e_provedor
from .decisao import decidir
from .executor import Executor
from .falha import Evidencias
from .perfil import limite_de_chamadas_vistas, montar_instrucoes
from .segredos import segredos_no_texto
from .tipos import (DESCONHECIDA, ENCERRADO_POR_CANCELAMENTO, ENCERRADO_POR_TEMPO, FERRAMENTA, LOGIN, PROVEDOR, QUEDA,
                    Capacidades, Conferencia, ErroDePerfil, Execucao, Falha, Problema, RegistroDeUso, Resultado)
from .uso import ErroDoProvedor, Sessao

VERSAO_DOCUMENTADA = "0.79.0"
VERSOES_DO_FLUXO = range(21, 27)                     # o cliente oficial aceita v21 a v26 (sessions-runs-and-streaming.md)

# Provedores que a EVE NÃO serve em servidor: a assinatura ChatGPT só roda em `eve dev` (agent-config.md).
PROVEDORES_SO_LOCAIS = frozenset({"openai-codex"})

# semanticErrorId da EVE -> código do vocabulário do núcleo (falha.py). Lido do código do pacote 0.79.0.
SEMANTICO_PARA_CODIGO: Mapping[str, str] = {
    "gateway-rate-limited": "rate_limit_exceeded", "gateway-free-tier-rate-limited": "rate_limit_exceeded",
    "gateway-budget-exhausted": "quota_exceeded", "gateway-credit-exhausted": "insufficient_quota",
    "gateway-billing-required": "billing_not_active",
    "gateway-auth-invalid-api-key": "invalid_api_key", "gateway-auth-invalid-oidc-token": "invalid_token",
    "gateway-auth-missing-credentials": "authentication_error", "model-provider-api-key-missing": "authentication_error",
}
SEMANTICO_PARA_TIPO: Mapping[str, str] = {"gateway-upstream-unavailable": "server_error"}

# Eventos de pedaço de texto: a conversa guardada fica só com os blocos concluídos.
EVENTOS_DE_PEDACO = frozenset({"message.appended", "reasoning.appended", "action.input.appended", "action.partial"})
FIM_DO_TURNO = frozenset({"turn.completed", "turn.failed", "turn.cancelled"})
FIM_DA_SESSAO = frozenset({"session.failed", "session.completed"})

ESTADO_DAS_GARANTIAS: Mapping[str, str] = {
    "nome": "DECISÃO NOSSA: eve",
    "cancela_em_ate_s": "PARCIAL: `POST .../cancel` é assíncrono (documentação); o adaptador espera `turn.cancelled` por até "
                        "15 s e, sem ele, marca CANCELAMENTO_NAO_CONFIRMADO; o prazo do servidor real NÃO CONFIRMADO",
    "ferramentas_por_extenso": "NÃO CONFIRMADO: a EVE não recebe lista de ferramentas por pedido (moram na pasta `agent/` "
                               "do servidor); ficha com ferramenta é recusada e qualquer `actions.requested` vira violação",
    "confere_modelo_e_provedor": "PARCIAL: `step.started.modelId` é conferido em CADA passo (documentação); o provedor "
                                 "real atrás do AI Gateway NÃO CONFIRMADO",
    "sem_reserva_escondida": "NÃO CONFIRMADO: a EVE repete cada passo até 4 vezes e o AI Gateway tem reserva própria; "
                             "troca de modelo vista em `step.started` é recusada, a reserva interna do Gateway não é vista",
    "limita_chamadas": "NÃO CONFIRMADO: os limites da EVE são de tokens e custo por sessão (agent.ts), não de chamadas",
    "falha_vem_do_registro": "PARCIAL: `step.failed`/`turn.failed` com `code` (documentação); `statusCode` e "
                             "`semanticErrorId` lidos do código do pacote, não da documentação",
    "guarda_conversa": "CONFIRMADO NA DOCUMENTAÇÃO (o fluxo é durável e pode ser relido); o adaptador guarda os eventos "
                       "concluídos; falta provar no servidor real",
}


@dataclass(frozen=True)
class ConfigDaEve:
    """Endereço do servidor da EVE e onde guardar os eventos. O token fica fora do repr (nunca é impresso)."""
    url_base: str                                    # https://...  (http só em 127.0.0.1/localhost: mesma máquina ou teste)
    pasta_das_execucoes: Path
    token: Optional[str] = field(default=None, repr=False)
    tempo_de_conexao_s: float = 10.0
    limite_para_encerrar_s: float = 15.0
    tamanho_maximo_do_fluxo: int = 20_000_000
    guardar_conversa_ate_bytes: int = 2_000_000

    def __post_init__(self):
        partes = urlsplit(self.url_base)
        local = partes.hostname in ("127.0.0.1", "localhost")
        if partes.scheme not in ("https", "http") or not partes.hostname or (partes.scheme == "http" and not local):
            raise ErroDePerfil("url da EVE: use https (http só para 127.0.0.1/localhost).")
        if partes.query or partes.fragment or partes.username or partes.password:
            raise ErroDePerfil("url da EVE: sem usuário, senha, consulta ou fragmento.")
        if not Path(self.pasta_das_execucoes).is_absolute():
            raise ErroDePerfil("pasta_das_execucoes precisa ser um caminho absoluto.")
        if self.limite_para_encerrar_s <= 0 or self.limite_para_encerrar_s > Capacidades.TETO_DE_CANCELAMENTO_S:
            raise ErroDePerfil("limite_para_encerrar_s entre 0 e 15 s.")


class _ErroHttp(Exception):
    def __init__(self, status: Optional[int], codigo: str):
        super().__init__(codigo)
        self.status, self.codigo = status, codigo


class _Cliente:
    """HTTP mínimo da biblioteca padrão. Uma conexão por pedido; o fluxo fica com a conexão dele."""

    def __init__(self, config: ConfigDaEve):
        partes = urlsplit(config.url_base)
        self.https = partes.scheme == "https"
        self.host, self.porta = partes.hostname, partes.port
        self.prefixo = partes.path.rstrip("/")
        self.config = config

    def _conexao(self):
        classe = http.client.HTTPSConnection if self.https else http.client.HTTPConnection
        return classe(self.host, self.porta, timeout=self.config.tempo_de_conexao_s)

    def _cabecalhos(self) -> Dict[str, str]:
        cabecalhos = {"content-type": "application/json", "accept": "application/json"}
        if self.config.token:
            cabecalhos["authorization"] = f"Bearer {self.config.token}"
        return cabecalhos

    def postar(self, caminho: str, corpo: Optional[dict]) -> Tuple[int, Dict[str, str], Any]:
        conexao = self._conexao()
        try:
            dados = json.dumps(corpo).encode() if corpo is not None else b""
            conexao.request("POST", self.prefixo + caminho, body=dados, headers=self._cabecalhos())
            resposta = conexao.getresponse()
            bruto = resposta.read(1_000_000)
            try:
                conteudo = json.loads(bruto) if bruto else None
            except ValueError:
                conteudo = None
            return resposta.status, {k.lower(): v for k, v in resposta.getheaders()}, conteudo
        finally:
            conexao.close()

    def abrir_fluxo(self, id_da_sessao: str):
        conexao = self._conexao()
        cabecalhos = self._cabecalhos()
        cabecalhos["accept"] = "application/x-ndjson"
        conexao.request("GET", f"{self.prefixo}/eve/v1/session/{id_da_sessao}/stream?startIndex=0", headers=cabecalhos)
        resposta = conexao.getresponse()
        if conexao.sock is not None:
            conexao.sock.settimeout(None)            # silêncio longo do modelo não é erro; o laço principal vigia o tempo
        return conexao, resposta


def _ler_fluxo(resposta, fila: "queue.Queue", limite_bytes: int) -> None:
    """Linha própria: cada linha do NDJSON vira um item da fila. No fim põe ("fim", motivo)."""
    lidos = 0
    try:
        while True:
            linha = resposta.readline(1_000_001)
            if not linha:
                fila.put(("fim", "FLUXO_TERMINOU"))
                return
            lidos += len(linha)
            if lidos > limite_bytes or len(linha) > 1_000_000:
                fila.put(("fim", "FLUXO_GRANDE_DEMAIS"))
                return
            if not linha.strip():
                continue
            try:
                evento = json.loads(linha)
            except ValueError:
                fila.put(("fim", "LINHA_ILEGIVEL"))
                return
            fila.put(("evento", evento if isinstance(evento, dict) else {}))
    except (OSError, http.client.HTTPException, ValueError):
        fila.put(("fim", "FLUXO_CAIU"))


def _inteiro(valor) -> int:
    """Número de tokens do evento; qualquer outra coisa conta zero (o fluxo é do runtime, não confiamos no tipo)."""
    return valor if isinstance(valor, int) and not isinstance(valor, bool) and valor >= 0 else 0


def _modelo_e_provedor(model_id: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    """`provedor/modelo` (id do AI Gateway) -> (modelo, provedor). Sem barra: modelo sem provedor."""
    if not model_id:
        return None, None
    if "/" in model_id:
        provedor, modelo = model_id.split("/", 1)
        return modelo, provedor
    return model_id, None


class ExecutorEve(Executor):
    """A EVE atrás da porta única. Em homologação: o registro recusa a partida em produção."""

    capacidades = Capacidades(
        nome="eve", cancela_em_ate_s=0.0, ferramentas_por_extenso=False, confere_modelo_e_provedor=False,
        sem_reserva_escondida=False, limita_chamadas=False, falha_vem_do_registro=False, guarda_conversa=False)
    estado_das_garantias = ESTADO_DAS_GARANTIAS

    def __init__(self, config: ConfigDaEve):
        self.config = config
        self._cliente = _Cliente(config)
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
            return self._recusa(FERRAMENTA, "FERRAMENTAS_NAO_LIGADAS_NA_EVE",
                                "a EVE não recebe a lista de ferramentas por pedido; o nosso servidor não está ligado a ela")
        if ficha.provedor in PROVEDORES_SO_LOCAIS:
            return self._recusa(PROVEDOR, "ASSINATURA_NAO_RODA_NA_EVE_EM_SERVIDOR",
                                "a EVE só usa a assinatura do ChatGPT em `eve dev`; em servidor exige chave paga "
                                "(decisão do fundador: trocar o provedor no models.yaml)")
        pedido = montar_instrucoes(ficha) + "\n---\n\n" + execucao.pacote
        if segredos_no_texto(pedido):
            return self._recusa(DESCONHECIDA, "SEGREDO_NO_PEDIDO", "o pedido tem algo com cara de segredo; nada foi enviado")
        raiz = Path(self.config.pasta_das_execucoes)
        raiz.mkdir(parents=True, exist_ok=True)
        pasta = Path(tempfile.mkdtemp(prefix=f"{execucao.id}-", dir=raiz))

        cancelamento = threading.Event()
        with self._trava:
            self._cancelamentos[execucao.id] = cancelamento
        comeco = time.monotonic()
        try:
            try:
                status, cabecalhos, corpo = self._cliente.postar("/eve/v1/session", {"message": pedido})
            except (OSError, http.client.HTTPException) as erro:
                return self._recusa(QUEDA, "EVE_INALCANCAVEL", type(erro).__name__, pasta)
            if status in (401, 403):
                return self._recusa(LOGIN, f"ROTA_DA_EVE_RECUSOU_{status}", "o servidor da EVE recusou a credencial da rota", pasta)
            id_da_sessao = (corpo or {}).get("sessionId") if isinstance(corpo, dict) else None
            id_da_sessao = id_da_sessao or cabecalhos.get("x-eve-session-id")
            if status != 202 or not isinstance(id_da_sessao, str) or not id_da_sessao.strip():
                classe = QUEDA if status >= 500 else DESCONHECIDA
                return self._recusa(classe, f"CRIAR_SESSAO_HTTP_{status}", "o servidor da EVE não aceitou o pedido", pasta)
            return self._acompanhar(execucao, pasta, id_da_sessao, cancelamento, comeco)
        finally:
            with self._trava:
                self._cancelamentos.pop(execucao.id, None)

    # --- o fluxo da sessão --------------------------------------------------------------------------
    def _acompanhar(self, execucao: Execucao, pasta: Path, id_da_sessao: str, cancelamento: threading.Event,
                    comeco: float) -> Resultado:
        try:
            conexao, resposta = self._cliente.abrir_fluxo(id_da_sessao)
        except (OSError, http.client.HTTPException) as erro:
            return self._recusa(QUEDA, "FLUXO_DA_EVE_INALCANCAVEL", type(erro).__name__, pasta)
        if resposta.status in (401, 403):
            conexao.close()
            return self._recusa(LOGIN, f"FLUXO_DA_EVE_RECUSOU_{resposta.status}", "o servidor da EVE recusou a credencial", pasta)
        versao = resposta.getheader("x-eve-stream-version")
        if resposta.status != 200 or not (versao or "").isdigit() or int(versao) not in VERSOES_DO_FLUXO:
            conexao.close()
            return self._recusa(DESCONHECIDA, "FLUXO_DA_EVE_FORA_DO_CONTRATO",
                                f"HTTP {resposta.status}, versão do fluxo {versao!r} (aceitas: 21 a 26)", pasta)

        fila: "queue.Queue" = queue.Queue()
        leitor = threading.Thread(target=_ler_fluxo, args=(resposta, fila, self.config.tamanho_maximo_do_fluxo),
                                  daemon=True, name=f"eve-{execucao.id}")
        leitor.start()
        eventos: List[dict] = []
        encerrado_por: Optional[str] = None
        inicio_da_parada: Optional[float] = None
        tempo_para_encerrar: Optional[float] = None
        fim_do_fluxo: Optional[str] = None
        terminal: Optional[str] = None
        cancelamento_confirmado = False
        prazo = comeco + execucao.tempo_efetivo_s
        try:
            while True:
                agora = time.monotonic()
                if encerrado_por is None and (cancelamento.is_set() or agora >= prazo):
                    encerrado_por = ENCERRADO_POR_CANCELAMENTO if cancelamento.is_set() else ENCERRADO_POR_TEMPO
                    inicio_da_parada = agora
                    self._pedir_cancelamento(id_da_sessao)
                if inicio_da_parada is not None and agora - inicio_da_parada > self.config.limite_para_encerrar_s:
                    break
                try:
                    tipo, conteudo = fila.get(timeout=0.1)
                except queue.Empty:
                    continue
                if tipo == "fim":
                    fim_do_fluxo = conteudo
                    break
                eventos.append(conteudo)
                nome = conteudo.get("type")
                if nome in FIM_DO_TURNO or nome in FIM_DA_SESSAO:
                    terminal = nome
                    if inicio_da_parada is not None:     # qualquer fim de turno depois do corte: nada ficou rodando
                        cancelamento_confirmado = True
                        tempo_para_encerrar = time.monotonic() - inicio_da_parada
                    break
        finally:
            self._fechar(conexao)
            leitor.join(2.0)
        self._gravar_eventos(pasta, eventos)
        return self._avaliar(execucao, pasta, id_da_sessao, eventos, terminal, fim_do_fluxo, encerrado_por,
                             cancelamento_confirmado, tempo_para_encerrar, time.monotonic() - comeco)

    def _pedir_cancelamento(self, id_da_sessao: str) -> None:
        try:
            self._cliente.postar(f"/eve/v1/session/{id_da_sessao}/cancel", None)
        except (OSError, http.client.HTTPException):
            pass                                     # sem confirmação no fluxo, a conferência acusa

    @staticmethod
    def _fechar(conexao) -> None:
        try:
            if conexao.sock is not None:
                conexao.sock.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass
        conexao.close()

    def _gravar_eventos(self, pasta: Path, eventos: List[dict]) -> None:
        with open(pasta / "eventos.ndjson", "w", encoding="utf-8") as arquivo:
            for evento in eventos:
                arquivo.write(json.dumps(evento, ensure_ascii=False) + "\n")

    # --- tradução do fluxo NATIVO para as Evidencias do núcleo --------------------------------------
    def _avaliar(self, execucao: Execucao, pasta: Path, id_da_sessao: str, eventos: List[dict], terminal: Optional[str],
                 fim_do_fluxo: Optional[str], encerrado_por: Optional[str], cancelamento_confirmado: bool,
                 tempo_para_encerrar: Optional[float], duracao: float) -> Resultado:
        ficha = execucao.ficha
        passos = [e.get("data") or {} for e in eventos if e.get("type") == "step.started"]
        concluidos = [e.get("data") or {} for e in eventos if e.get("type") == "step.completed"]
        mensagens = [e.get("data") or {} for e in eventos if e.get("type") == "message.completed"]
        falhas = [e for e in eventos if e.get("type") in ("turn.failed", "session.failed", "step.failed")]
        acoes = [a for e in eventos if e.get("type") == "actions.requested"
                 for a in ((e.get("data") or {}).get("actions") or []) if isinstance(a, dict)]
        resultados_de_ferramenta = sum(1 for e in eventos if e.get("type") == "action.result")
        ids_de_modelo = [p.get("modelId") for p in passos if isinstance(p.get("modelId"), str)]

        completo = terminal == "turn.completed" and encerrado_por is None
        falhou = terminal in ("turn.failed", "session.failed") and encerrado_por is None
        modelo, provedor = _modelo_e_provedor(ids_de_modelo[-1] if ids_de_modelo else None)
        tokens_entrada = sum(_inteiro((c.get("usage") or {}).get("inputTokens")) for c in concluidos)
        tokens_saida = sum(_inteiro((c.get("usage") or {}).get("outputTokens")) for c in concluidos)
        uso = {"completed": completo, "failed": falhou, "model": modelo if completo else None,
               "provider": provedor if completo else None, "api_calls": len(passos),
               "input_tokens": tokens_entrada, "output_tokens": tokens_saida,
               "total_tokens": tokens_entrada + tokens_saida, "session_id": id_da_sessao}
        respostas = [m for m in mensagens if m.get("finishReason") != "tool-calls"]
        final = respostas[-1].get("message") if respostas and isinstance(respostas[-1].get("message"), str) else None
        ultima = mensagens[-1] if mensagens else {}
        sessao = Sessao(
            id=id_da_sessao, fim=terminal, chamadas_ao_modelo=len(passos), max_iteracoes=None,
            resultados_de_ferramenta=resultados_de_ferramenta, chamadas_invalidas=0,
            houve_resposta_do_assistente=bool(mensagens),
            ultima_do_assistente=ultima.get("message") if isinstance(ultima.get("message"), str) else None,
            ultima_tem_chamada_de_ferramenta=ultima.get("finishReason") == "tool-calls",
            ultimo_finish_reason=(concluidos[-1].get("finishReason") if concluidos else None),
            modelo=None, prompt_de_sistema=None)
        codigo = 0 if terminal is not None else None
        evidencias = Evidencias(
            codigo_de_saida=codigo, encerrado_por=encerrado_por, uso=uso,
            erro_do_provedor=self._erro(falhas) if falhou else None, sessao=sessao,
            servidor={"listou_ferramentas": True, "ferramentas": [], "encerrada": False, "motivo_encerramento": None,
                      "contadores": {"total": len(acoes)}, "usou_internet": None},
            saida_vazia=not (final or "").strip(), saida_e_resposta=completo and bool((final or "").strip()),
            max_de_chamadas_vistas=limite_de_chamadas_vistas(ficha))

        problemas: List[Problema] = []
        if acoes:
            nomes = sorted({str(a.get("toolName") or a.get("name") or a.get("kind")) for a in acoes})
            problemas.append(Problema(DESCONHECIDA, "FERRAMENTA_USADA_SEM_PERMISSAO",
                                      f"a ficha não tem ferramenta e a EVE pediu {nomes}"))
        if len(set(ids_de_modelo)) > 1:
            problemas.append(Problema(PROVEDOR, "MODELO_TROCADO_NO_MEIO", f"a EVE usou {sorted(set(ids_de_modelo))}"))
        problemas += conferir_modelo_e_provedor(ficha.modelo, ficha.provedor, uso, None)
        if encerrado_por is not None and not cancelamento_confirmado:
            problemas.append(Problema(DESCONHECIDA, "CANCELAMENTO_NAO_CONFIRMADO",
                                      "a EVE não confirmou o cancelamento (turn.cancelled) em até 15 s"))
        if terminal is None and encerrado_por is None and fim_do_fluxo in ("FLUXO_GRANDE_DEMAIS", "LINHA_ILEGIVEL"):
            problemas.append(Problema(DESCONHECIDA, fim_do_fluxo, "o fluxo da EVE saiu do contrato"))
        avisos = tuple("a EVE repetiu uma chamada ao modelo (MODEL_CALL_ATTEMPT_RETRIED)" for e in eventos
                       if ((e.get("data") or {}).get("error") or {}).get("code") == "MODEL_CALL_ATTEMPT_RETRIED")[:1]
        conferido = Conferencia(problemas=tuple(problemas), avisos=avisos)
        decisao = decidir(execucao, evidencias, conferido, final if completo else None)
        return Resultado(
            texto=decisao.texto, terminou_inteira=decisao.terminou_inteira,
            uso=self._registro_de_uso(uso, len(acoes)), codigo_de_saida=codigo, ferramentas_recebidas=(),
            modelo_usado=uso["model"], provedor_usado=uso["provider"], tempo_s=duracao, falha=decisao.falha,
            conferencia=conferido, cancelada=decisao.cancelada, encerrado_por=encerrado_por,
            tempo_para_encerrar_s=tempo_para_encerrar, sobras=(), pasta=pasta,
            conversa=self._conversa(eventos), comando=("POST", "/eve/v1/session", id_da_sessao))

    @staticmethod
    def _erro(falhas: List[dict]) -> Optional[ErroDoProvedor]:
        """O motivo vem do evento de falha (nunca do texto do agente). Prefere o que traz detalhe do provedor."""
        for evento in reversed(falhas):
            dados = evento.get("data") or {}
            detalhes = dados.get("details") if isinstance(dados.get("details"), dict) else {}
            semantico = detalhes.get("semanticErrorId") if isinstance(detalhes.get("semanticErrorId"), str) else None
            status = detalhes.get("statusCode") if isinstance(detalhes.get("statusCode"), int) else None
            if semantico or status:
                return ErroDoProvedor(motivo_do_dump=f"eve:{dados.get('code')}", status=status,
                                      tipo=SEMANTICO_PARA_TIPO.get(semantico or "", semantico),
                                      codigo=SEMANTICO_PARA_CODIGO.get(semantico or "", semantico), voltar_em_s=None)
        if falhas:
            codigo = (falhas[-1].get("data") or {}).get("code")
            codigo = codigo if isinstance(codigo, str) else None
            return ErroDoProvedor(motivo_do_dump="eve:sem-detalhe", status=None, tipo=codigo, codigo=codigo, voltar_em_s=None)
        return None

    def _conversa(self, eventos: List[dict]) -> Tuple[Dict[str, Any], ...]:
        guardados, gasto = [], 0
        for evento in eventos:
            if evento.get("type") in EVENTOS_DE_PEDACO:
                continue
            item = {"tipo": evento.get("type"), "dados": evento.get("data"), "id": (evento.get("meta") or {}).get("id")}
            gasto += len(json.dumps(item, ensure_ascii=False))
            if gasto > self.config.guardar_conversa_ate_bytes:
                guardados.append({"tipo": "corte", "dados": "[conversa cortada: passou do limite guardado]", "id": None})
                break
            guardados.append(item)
        return tuple(guardados)

    @staticmethod
    def _registro_de_uso(uso: dict, acoes: int) -> RegistroDeUso:
        origem = {campo: f"eve:fluxo:{chave}" for campo, chave in (
            ("modelo", "step.started.modelId"), ("provedor", "step.started.modelId"), ("chamadas_ao_modelo", "step.started"),
            ("tokens_entrada", "step.completed.usage"), ("tokens_saida", "step.completed.usage"),
            ("tokens_total", "step.completed.usage"), ("completo", "turn.completed"), ("falhou", "turn.failed"),
            ("id_da_sessao", "sessionId"), ("chamadas_de_ferramenta", "actions.requested"))}
        return RegistroDeUso(
            modelo=uso["model"], provedor=uso["provider"], chamadas_ao_modelo=uso["api_calls"],
            tokens_entrada=uso["input_tokens"], tokens_saida=uso["output_tokens"], tokens_total=uso["total_tokens"],
            completo=uso["completed"], falhou=uso["failed"], id_da_sessao=uso["session_id"],
            chamadas_de_ferramenta=acoes, origem=origem)

    def _recusa(self, classe: str, codigo: str, detalhe: str, pasta: Optional[Path] = None) -> Resultado:
        problema = Problema(classe, codigo, detalhe)
        return Resultado(texto=None, terminou_inteira=False, uso=RegistroDeUso(), codigo_de_saida=None,
                         ferramentas_recebidas=(), modelo_usado=None, provedor_usado=None, tempo_s=0.0,
                         falha=Falha(classe, codigo, detalhe), conferencia=Conferencia((problema,)), pasta=pasta)


def montar_config_do_ambiente(ambiente: Mapping[str, str]) -> ConfigDaEve:
    """Para o registro. O token é lido aqui e fica só na memória do executor."""
    return ConfigDaEve(url_base=ambiente["HELENA_V2_EVE_URL"], pasta_das_execucoes=Path(ambiente["HELENA_V2_EXECUCOES_DIR"]),
                       token=ambiente["HELENA_V2_EVE_TOKEN"])
