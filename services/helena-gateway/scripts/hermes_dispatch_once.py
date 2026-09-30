"""One bounded, opt-in Hermes dispatch. No model call in the default mode.

Run on the Hermes host, not on the Gateway host. A scheduler can invoke this
script later, after the business and model-usage policy has been approved.
"""

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from hermes_execution_context import packet_prompt

try:
    import fcntl
except ImportError:  # The dispatcher runs on Linux; allow Windows unit tests.
    fcntl = None


GATEWAY = "https://helena-automation-helena-gateway.d9v63q.easypanel.host"
TOKEN_NAME = "HELENA_GATEWAY_PROFILE_TOKEN"
PROFILE_PATTERN = re.compile(r"[a-z][a-z0-9-]{2,79}\Z")
JOB_PATTERN = re.compile(r"JOB-HR-[a-f0-9]{32}\Z")
ROUTING_POLICY = "helena-brief-routing-v2"
ROUTING_MODELS = {"SIMPLE": "gpt-6-luna", "MODERATE": "gpt-6-sol", "COMPLEX": "gpt-6-astra"}
TRANSPORT_ERRORS = (OSError, ValueError)


class GatewayRefusal(RuntimeError):
    """A definitive Gateway rejection, not a lost network response."""
BRIEF_SECTIONS = (
    "Contexto e fontes", "Objetivo e impacto", "Escopo e limites",
    "Plano de trabalho", "Entregáveis", "Critérios de pronto",
    "Evidências e registro", "Revisão e encaminhamento",
)


def validate_professional_brief(detail: dict) -> None:
    """Block shallow or mismatched work before claim/start/model consumption."""
    job = detail.get("job") or {}
    task = detail.get("task") or {}
    binding = detail.get("runtime_binding") or {}
    if (not job or not task or not binding or job.get("task_id") != task.get("task_id")
            or job.get("business_id") != task.get("business_id")
            or job.get("agent_id") != binding.get("agent_id")
            or (binding.get("business_id") != job.get("business_id")
                and not (binding.get("scope_type") == "GROUP" and binding.get("agent_id") == "AGT-01"))):
        raise RuntimeError("Briefing incompleto: tarefa, empresa, executor e perfil divergentes")
    if not str(job.get("objective") or "").strip() or not str(task.get("definicao_de_pronto") or "").strip():
        raise RuntimeError("Briefing incompleto: objetivo ou definicao de pronto ausente")
    instruction = str(job.get("instruction") or "").strip()
    if not 700 <= len(instruction) <= 8000:
        raise RuntimeError("Briefing profissional exige instrucao substantiva")
    positions = []
    for title in BRIEF_SECTIONS:
        match = re.search(r"^## " + re.escape(title) + r"\r?$", instruction, re.IGNORECASE | re.MULTILINE)
        if not match:
            raise RuntimeError("Briefing profissional sem secao: " + title)
        positions.append((title, match.start(), match.end()))
    for index, (title, start, end) in enumerate(positions):
        next_start = positions[index + 1][1] if index + 1 < len(positions) else len(instruction)
        if next_start <= start:
            raise RuntimeError("Briefing profissional com secoes fora de ordem")
        if len(instruction[end:next_start].strip()) < 40:
            raise RuntimeError("Briefing profissional raso na secao: " + title)


def model_route_for(detail: dict) -> dict:
    """Use only a current, audited Jev recommendation; never trust task text as a model name."""
    job, task = detail.get("job") or {}, detail.get("task") or {}
    if job.get("agent_id") == "AGT-01":
        return {"status": "PROFILE_DEFAULT", "reason": "HELENA_SOL"}
    digest = hashlib.sha256("\n".join(str(value or "") for value in (
        job.get("objective"), job.get("instruction"), task.get("definicao_de_pronto"),
    )).encode("utf-8")).hexdigest()
    for event in detail.get("events") or []:
        if not isinstance(event, dict) or event.get("event_type") != "TYPESAFE_ROUTE":
            continue
        payload = event.get("payload") or {}
        if (event.get("job_id") != job.get("job_id") or event.get("business_id") != job.get("business_id")
                or event.get("agent_id") != job.get("agent_id") or payload.get("policy") != ROUTING_POLICY
                or payload.get("brief_hash") != digest or payload.get("task_version") != task.get("row_version")):
            continue
        route = payload.get("model_route") or {}
        tier, model = route.get("tier"), route.get("model")
        if (payload.get("status") == "RECORDED" and payload.get("recommendation") == "NO_ISSUE_DETECTED"
                and route.get("status") == "ADVICE" and ROUTING_MODELS.get(tier) == model
                and isinstance(route.get("confidence"), (float, int))
                and route["confidence"] >= (0.9 if tier == "COMPLEX" else 0.8)):
            return {"status": "JEV_ADVICE", "model": model, "tier": tier}
        return {"status": "PROFILE_DEFAULT", "reason": "JEV_UNCERTAIN"}
    return {"status": "PROFILE_DEFAULT", "reason": "NO_CURRENT_JEV_RESULT"}


def reconcile(job_id: str, phase: str) -> dict:
    # Never echo transport exceptions: they may contain credentials or payloads.
    return {"status": "RECONCILE", "job_id": job_id, "phase": phase,
            "reconciliation_required": True, "automatic_retry": False}


def save_report(directory: Path, result: dict) -> None:
    """Preserve a credential-free receipt, including uncertain outcomes."""
    directory.mkdir(parents=True, exist_ok=True)
    report = {**result, "observed_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=directory,
                                         prefix="dispatch-", suffix=".tmp", delete=False) as handle:
            path = Path(handle.name)
            os.chmod(path, 0o600)
            json.dump(report, handle, ensure_ascii=False)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(path, directory / "dispatcher-last-result.json")
    finally:
        if path is not None:
            path.unlink(missing_ok=True)


def token_for(root: Path, profile: str) -> str:
    if not PROFILE_PATTERN.fullmatch(profile):
        raise ValueError("Perfil fora do formato permitido")
    env_path = root / profile / ".env"
    if env_path.is_symlink() or not env_path.is_file() or not env_path.resolve().is_relative_to(root.resolve()):
        raise ValueError("Perfil sem arquivo de credencial")
    values = [line.partition("=")[2].strip().strip("\"'") for line in env_path.read_text(encoding="utf-8").splitlines()
              if line.startswith(TOKEN_NAME + "=")]
    if len(values) != 1 or not re.fullmatch(r"hhs_[A-Za-z0-9_-]{40,}", values[0]):
        raise ValueError("Credencial do perfil ausente ou invalida")
    return values[0]


def call_tool(gateway: str, profile_token: str, name: str, payload: dict) -> dict:
    request = urllib.request.Request(
        gateway.rstrip("/") + "/api/tools/" + name,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": "Bearer " + profile_token, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            envelope = json.load(response)
    except urllib.error.HTTPError as error:
        raise GatewayRefusal("Gateway recusou " + name + " (HTTP " + str(error.code) + ")") from None
    if not isinstance(envelope, dict) or envelope.get("ok") is not True or not isinstance(envelope.get("result"), dict):
        raise GatewayRefusal("Gateway respondeu sem confirmacao para " + name)
    return envelope["result"]


def usage_preflight(binary: str, profile: str, runner=subprocess.run) -> dict:
    """Read the provider quota without a model turn; fail closed if it is unclear."""
    try:
        response = runner(
            [binary, "-p", profile, "usage", "--provider", "openai-codex", "--json"],
            stdin=subprocess.DEVNULL, capture_output=True, timeout=20, check=False,
        )
        if response.returncode != 0 or len(response.stdout) > 65536:
            return {"status": "USAGE_UNAVAILABLE"}
        report = json.loads(response.stdout)
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return {"status": "USAGE_UNAVAILABLE"}
    windows = report.get("windows") if isinstance(report, dict) and report.get("provider") == "openai-codex" else None
    if not isinstance(windows, list) or not windows:
        return {"status": "USAGE_UNAVAILABLE"}
    for window in windows:
        if not isinstance(window, dict) or not isinstance(window.get("used_percent"), (int, float)):
            return {"status": "USAGE_UNAVAILABLE"}
        if window["used_percent"] >= 95:
            return {"status": "PROVIDER_LIMIT", "reset_at": window.get("resets_at")}
    return {"status": "READY"}


def resolve_hermes_binary() -> str | None:
    """Resolve the installed CLI without spawning processes or changing PATH."""
    configured = os.environ.get("HERMES_BIN")
    if configured:
        # An explicit operator selection must never fall through to another install.
        return shutil.which(configured)
    resolved = shutil.which("hermes")
    if resolved:
        return resolved
    for candidate in ("/opt/hermes/bin/hermes", "/opt/hermes/.venv/bin/hermes"):
        try:
            if Path(candidate).is_file() and os.access(candidate, os.X_OK):
                return candidate
        except OSError:
            continue
    return None


def mcp_preflight(profile_home: Path, profile_token: str, runner=subprocess.run) -> dict:
    """Check the same MCP discovery used by Hermes chat, without a model call."""
    probe = Path(__file__).with_name("hermes_mcp_preflight.py")
    python = os.environ.get("HERMES_PYTHON", "/opt/hermes/.venv/bin/python")
    if not probe.is_file() or not Path(python).is_file():
        return {"status": "MCP_UNAVAILABLE"}
    try:
        result = runner(
            [python, str(probe)], env={**os.environ, "HERMES_HOME": str(profile_home), TOKEN_NAME: profile_token},
            stdin=subprocess.DEVNULL, capture_output=True, timeout=30, check=False,
        )
        if result.returncode != 0 or len(result.stdout) > 1024:
            return {"status": "MCP_UNAVAILABLE"}
        report = json.loads(result.stdout)
        if report.get("server") == "helena_operacao" and report.get("tool_count", 0) >= 10:
            return {"status": "READY"}
    except (OSError, ValueError, subprocess.TimeoutExpired):
        pass
    return {"status": "MCP_UNAVAILABLE"}


def native_cli_command(binary):
    bridge = Path(__file__).with_name('install_native_mcp_pixels.py')
    python = os.environ.get('HERMES_PYTHON', '/opt/hermes/.venv/bin/python')
    if not bridge.is_file() or not Path(python).is_file():
        raise RuntimeError('Native pixel adapter unavailable before inference')
    return [python, str(bridge), '--run-hermes', binary]


def run_profile(binary: str, profile: str, job_id: str, timeout: int, profile_token: str,
                profile_home: Path, model_override: str | None = None) -> tuple[int, str | None]:
    if model_override is not None and model_override not in ROUTING_MODELS.values():
        raise ValueError("Modelo fora da lista aprovada")
    prompt = (
        "Piloto interno autorizado da empresa vinculada ao job " + job_id + ". "
        "Esta e uma execucao nova e isolada deste job. Ignore qualquer historico de chat, "
        "memoria local, spillover, resposta anterior ou resumo antigo; nao reutilize decisoes "
        "nem evidencias de outra tentativa. "
        "O despachante ja confirmou identidade e chamou claim_job/start_job; NAO repita essas chamadas. "
        "O runtime fornece abaixo o contexto autorizado completo desta tarefa. Confirme a versao com "
        "get_job view=manifest; nao repita a leitura de fontes e briefing que ja estao no pacote. "
        "Se a versao mudou, use view=page com revision, section, offset e limit=4000. "
        "Leia company_identity em get_job e respeite a empresa, publico, oferta, voz, canais e restricoes. "
        "Leia agent_quality_contract e cumpra os insumos, entregaveis, verificacoes e limites da sua funcao; "
        "o contrato nao concede permissao nem substitui o briefing. Fatos, hipoteses e pendencias devem ser separados. "
        "Para design, exija identidade APPROVED, logo autorizado e cores registradas. "
        "No direcao-arte, brand_version deve ser a row_version da empresa e logo_asset o logo cadastrado. "
        "Use as respostas atuais do contexto e das paginas lidas para confirmar que o job esta RUNNING. "
        "Mantenha a leitura no escopo desta etapa e reserve chamadas para registrar memoria e entrega. "
        "Um impedimento comprovado deve ser registrado imediatamente; nao investigue toda a campanha. "
        "O contexto valido deve ter context_version hermes-context-v2 e truncated false. "
        "Se estiver ausente, truncado ou em versao diferente, nao avance nem repita um bloqueio antigo: "
        "use fail_job com error_code CONTEXT_UNAVAILABLE e descreva a falha objetiva. "
        + ("Para GENERATED_IMAGE use helena_visual.generate_design com job_id, slot, version e design_note detalhado da peca: copy exata aprovada, personagem, cena, composicao, fontes, cores e CTA. O adaptador gera imagem nativa, aplica o logo aprovado e envia PNG privado. Para ORIGINAL_ILLUSTRATION use create_artifact_upload com svg vetorial completo. Nao troque o metodo do briefing. Abra cada resultado com get_visual_asset e confira os pixels antes de entregar. Uma falha de geracao nao autoriza tentar outra versao: registre o bloqueio. " if profile == "maya--biz003" else "")
        +
        "Registre marcos reais em record_progress. Para entregar use submit_work em uma chamada com source, summary, "
        "job_id, idempotency_key estavel e expected_task_version atual. O Gateway registra memoria e vincula evidencias. "
        "incluindo delivery: schema_version=1, title, content utilizavel sem dados internos, next_steps, limitations "
        "e acceptance_checks (criterion e finding concreto, sem inventar evidence_ref). Arte inclui artifact_refs retornados pela verificacao. A aprovacao independente "
        "exige quality_review comparando todas as evidencias e criterios ao pedido completo. "
        "separando resumo interno de material publico. Para artes, envie publication com title, caption pronta, "
        "strategy, instructions e alt_text. Leia direcao-arte: empresa, publico, fontes, personagem/produto, "
        "cena, enquadramento, tipografia, cores, copy exata e CTA. Nunca entregue apenas molduras. "
        "Se o briefing exige foto ou imagem gerada e a ferramenta nao estiver disponivel, registre "
        "bloqueio especifico; nao substitua por layout vazio nem declare qualidade visual sem ver o PNG. "
        "usando a row_version atual e evidencia. Se impedido, use waiting_helena ou fail_job. "
        "Nao use complete_job, SQL direto, Terminal, web ou mensagens externas. "
        + ("Como coordenadora, organize e persista etapas especializadas com create_task_job em DRAFT, "
           "reutilizando as existentes. Sua entrega e o plano executavel com IDs, dependencias, briefing completo, "
           "executor e revisor; nao finja produzir as artes de Maya. Submeta seu plano com evidencias para revisao. "
           "Nao libere filhos enquanto este job ocupar o WIP. Depois da revisao, a coordenacao libera a proxima etapa. "
           if profile.startswith('marina--') or profile == 'helena--grupo' else
           "Execute sua etapa. Apos aprovacao use handoff_task conforme briefing; nao crie agentes paralelos. ")
        + "Para a capacidade de um executor, get_job.runtime_binding ativo prevalece sobre o resumo fleet; "
        "MISSING no resumo de outro perfil nao prova que ele esta desconectado. "
        "Nao prometa fatos comerciais nao confirmados. Nao declare sucesso sem resposta confirmada do Supabase."
    )
    context = call_tool(GATEWAY, profile_token, 'get_work_context', {})
    if (context.get('context_version') != 'hermes-context-v2' or context.get('truncated') is not False
            or context.get('profile', {}).get('profile_slug') not in (None, profile)
            or context.get('profile', {}).get('status') != 'ACTIVE'):
        return 125, 'CONTEXT_UNAVAILABLE'
    detail = call_tool(GATEWAY, profile_token, 'get_job', {'job_id': job_id})
    if (detail.get('job', {}).get('status') != 'RUNNING'
            or detail.get('job', {}).get('agent_id') != context['profile'].get('agent_id')):
        return 125, 'CONTEXT_MISMATCH'
    prompt += packet_prompt(detail)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", prefix="helena-job-", suffix=".txt", delete=False) as handle:
        prompt_path = Path(handle.name)
        os.chmod(prompt_path, 0o600)
        handle.write(prompt)
    try:
        # Keep raw CLI output private and ephemeral. It may contain model text or credentials.
        with tempfile.TemporaryFile(mode="w+b") as output, tempfile.TemporaryFile(mode="w+b") as errors:
            process = subprocess.Popen(
                native_cli_command(binary) + ["-p", profile, "chat", "--query-file", str(prompt_path), "--oneshot",
                 "--toolsets", "helena_operacao,helena_visual" if profile == 'maya--biz003' else "helena_operacao", "--max-turns", "24"]
                + (["--model", model_override] if model_override else []),
                stdin=subprocess.DEVNULL, stdout=output, stderr=errors,
                start_new_session=True,
                # Hermes starts background MCP discovery before the -p switch is applied.
                # Bind the profile home at process start so it discovers this agent's servers.
                env={**os.environ, "HERMES_HOME": str(profile_home), TOKEN_NAME: profile_token},
            )
            try:
                exit_code = process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
                return 124, "TIMEOUT"
            if exit_code == 0:
                return 0, None
            sample = []
            for stream in (errors, output):
                stream.seek(0, os.SEEK_END)
                stream.seek(max(0, stream.tell() - 65536))
                sample.append(stream.read(65536).decode("utf-8", errors="replace").lower())
            diagnostic = " ".join(sample)
            if any(term in diagnostic for term in ("429", "rate limit", "usage limit", "quota exceeded")):
                category = "RATE_LIMIT"
            elif any(term in diagnostic for term in ("401", "unauthorized", "authentication failed")):
                category = "AUTHENTICATION"
            elif any(term in diagnostic for term in ("unrecognized arguments", "unknown toolset", "invalid choice")):
                category = "CLI_CONFIGURATION"
            else:
                category = "UNKNOWN"
            return exit_code, category
    finally:
        prompt_path.unlink(missing_ok=True)


def has_current_release(detail: dict) -> bool:
    """A persisted manager release authorizes its READY execution, not a stale release."""
    job, task = detail.get('job') or {}, detail.get('task') or {}
    if job.get('status') != 'READY' or job.get('approval_status') != 'APPROVED':
        return False
    try:
        available = datetime.fromisoformat(job['available_at'].replace('Z', '+00:00'))
    except (KeyError, ValueError, TypeError, AttributeError):
        return False
    for event in detail.get('events') or []:
        if not isinstance(event, dict) or event.get('event_type') != 'WORKFLOW_release_job':
            continue
        payload = event.get('payload') or {}
        request, response = payload.get('request') or {}, payload.get('response') or {}
        actor = event.get('agent_id')
        profile = payload.get('profile_slug')
        args = request.get('payload') or {}
        if (actor not in {'AGT-01', 'AGT-04'} or not isinstance(profile, str)
                or (actor == 'AGT-01' and profile != 'helena--grupo')
                or (actor == 'AGT-04' and not profile.startswith('marina--'))
                or request.get('profile') != profile or request.get('action') != 'release_job'
                or event.get('job_id') != job.get('job_id')
                or event.get('business_id') != job.get('business_id')
                or args.get('job_id') != job.get('job_id')
                or response.get('job_id') != job.get('job_id')
                or response.get('success') is not True or response.get('status') != 'READY'):
            continue
        try:
            released = datetime.fromisoformat(event['created_at'].replace('Z', '+00:00'))
            if (0 <= (available - released).total_seconds() <= 60
                    and int(task['row_version']) > int(args['expected_task_version'])):
                return True
        except (KeyError, ValueError, TypeError, AttributeError):
            continue
    return False


def dispatch_once(root: Path, gateway: str, approved_job: str | None, execute: bool, run_agent=run_profile, request=call_tool, preflight=None, tool_preflight=None, auto: bool = False) -> dict:
    if gateway.rstrip("/") != GATEWAY:
        raise ValueError("Gateway fora do endpoint aprovado")
    helena_token = token_for(root, "helena--grupo")
    queue = request(gateway, helena_token, "list_ready_jobs", {"limit": 25})
    jobs = queue.get("jobs")
    if not isinstance(jobs, list):
        raise RuntimeError("Fila retornou formato invalido")
    if approved_job is None and not auto:
        return {"status": "DRY_RUN_QUEUE_ONLY", "ready_count": len(jobs)}
    eligible = [job for job in jobs if isinstance(job, dict) and (auto or job.get("job_id") == approved_job)]
    if not eligible:
        return {"status": "NO_APPROVED_READY_JOB", "ready_count": len(jobs)}
    detail = None
    if auto:
        # READY alone is insufficient. Require a matching dispatch request or
        # the audited manager release for this availability window.
        selected = None
        for candidate in eligible:
            candidate_id = candidate.get("job_id")
            candidate_profile = candidate.get("external_agent_id")
            if not isinstance(candidate_id, str) or not JOB_PATTERN.fullmatch(candidate_id):
                continue
            if not isinstance(candidate_profile, str) or not PROFILE_PATTERN.fullmatch(candidate_profile):
                continue
            candidate_token = token_for(root, candidate_profile)
            current = request(gateway, candidate_token, "get_job", {"job_id": candidate_id})
            requested = any(
                event.get("event_type") == "DISPATCH_REQUESTED"
                and event.get("job_id") == candidate_id
                and event.get("business_id") == candidate.get("business_id")
                and (event.get("payload") or {}).get("dispatcher_agent_id") == "AGT-04"
                and (event.get("payload") or {}).get("target_agent_id") == candidate.get("agent_id")
                and (event.get("payload") or {}).get("target_external_agent_id") == candidate_profile
                for event in current.get("events", []) if isinstance(event, dict)
            )
            if requested or has_current_release(current):
                selected, detail = candidate, current
                break
        if selected is None:
            return {"status": "NO_DISPATCH_REQUEST", "ready_count": len(jobs), "model_started": False}
        job = selected
    else:
        job = eligible[0]
    job_id = job["job_id"]
    profile = job.get("external_agent_id")
    agent_id = job.get("agent_id")
    business_id = job.get("business_id")
    if not isinstance(job_id, str) or not JOB_PATTERN.fullmatch(job_id) or not isinstance(profile, str) or not PROFILE_PATTERN.fullmatch(profile):
        raise RuntimeError("Job ou perfil fora do formato permitido")
    if not agent_id or not business_id or not job.get("task_id") or job.get("provider") != "HERMES":
        raise RuntimeError("Job sem vinculos empresariais executaveis")
    profile_token = token_for(root, profile)
    detail = detail or request(gateway, profile_token, "get_job", {"job_id": job_id})
    source = detail.get("job") or {}
    binding = detail.get("runtime_binding") or {}
    if (source.get("status") != "READY" or source.get("agent_id") != agent_id or source.get("business_id") != business_id
            or source.get("task_id") != job.get("task_id") or binding.get("profile_slug") != profile or binding.get("status") != "ACTIVE"):
        raise RuntimeError("Job, tarefa e perfil divergentes; nenhuma chamada ao modelo")
    validate_professional_brief(detail)
    route = model_route_for(detail)
    if not execute:
        return {"status": "DRY_RUN", "job_id": job_id, "profile": profile, "business_id": business_id,
                "model_route": route}
    if os.environ.get("HELENA_DISPATCH_ENABLED") != "1":
        raise RuntimeError("Execucao desligada; HELENA_DISPATCH_ENABLED=1 e obrigatorio")
    resolved_binary = resolve_hermes_binary()
    if not resolved_binary:
        raise RuntimeError("CLI Hermes indisponivel; job permanece READY")
    usage = (preflight or usage_preflight)(resolved_binary, profile)
    if usage.get("status") != "READY":
        return {"status": usage.get("status", "USAGE_UNAVAILABLE"), "job_id": job_id,
                "reset_at": usage.get("reset_at"), "model_started": False}
    tools = (tool_preflight or mcp_preflight)(root / profile, profile_token)
    if tools.get("status") != "READY":
        return {"status": "MCP_UNAVAILABLE", "job_id": job_id, "model_started": False}
    try:
        claimed = request(gateway, profile_token, "claim_job", {"job_id": job_id, "agent_id": agent_id})
    except GatewayRefusal as error:
        return {"status": "GATEWAY_REJECTED", "job_id": job_id, "phase": "CLAIM", "reason": str(error), "automatic_retry": False, "model_started": False}
    except TRANSPORT_ERRORS:
        return reconcile(job_id, "CLAIM_RESPONSE_UNKNOWN")
    if claimed.get("claimed") is not True:
        raise RuntimeError("Claim nao confirmado; nenhuma chamada ao modelo")
    try:
        started = request(gateway, profile_token, "start_job", {"job_id": job_id, "agent_id": agent_id})
    except GatewayRefusal as error:
        return {"status": "GATEWAY_REJECTED", "job_id": job_id, "phase": "START", "reason": str(error), "automatic_retry": False, "model_started": False}
    except TRANSPORT_ERRORS:
        return reconcile(job_id, "START_RESPONSE_UNKNOWN")
    if started.get("running") is not True:
        return {**reconcile(job_id, "START_NOT_CONFIRMED"), "status": "CLAIMED_START_FAILED_RECONCILE"}
    try:
        if route.get("model"):
            outcome = run_agent(resolved_binary, profile, job_id, 900 if profile == 'maya--biz003' else 300, profile_token, root / profile, route["model"])
        else:
            outcome = run_agent(resolved_binary, profile, job_id, 900 if profile == 'maya--biz003' else 300, profile_token, root / profile)
        exit_code, diagnostic = outcome if isinstance(outcome, tuple) else (outcome, None)
    except (OSError, ValueError, GatewayRefusal):
        exit_code, diagnostic = 125, "PROCESS_START"
    try:
        result = request(gateway, profile_token, "get_job", {"job_id": job_id})
    except TRANSPORT_ERRORS:
        return {**reconcile(job_id, "VERIFY_DELIVERY"), "exit_code": exit_code, "diagnostic": diagnostic}
    final_status = (result.get("job") or {}).get("status")
    if final_status in {"WAITING_HELENA", "COMPLETED", "FAILED"}:
        return {"status": final_status, "job_id": job_id, "exit_code": exit_code, "diagnostic": diagnostic,
                "model_route": route}
    if final_status in {"RUNNING", "CLAIMED"}:
        try:
            failed = request(gateway, profile_token, "fail_job", {
                "job_id": job_id, "agent_id": agent_id,
                "error_code": "HERMES_NO_DELIVERY" if exit_code == 0 else "HERMES_PROCESS_FAILED",
                "error_message": "Execucao pontual terminou sem entrega confirmada. Diagnostico local: " + (diagnostic or "UNKNOWN") + ". Verificar eventos antes de qualquer repeticao.",
            })
        except TRANSPORT_ERRORS:
            return {**reconcile(job_id, "FAIL_RESPONSE_UNKNOWN"), "exit_code": exit_code, "diagnostic": diagnostic}
        if failed.get("failed") is not True:
            return {**reconcile(job_id, "FAIL_NOT_CONFIRMED"), "exit_code": exit_code, "diagnostic": diagnostic}
        return {"status": "FAILED", "job_id": job_id, "exit_code": exit_code, "diagnostic": diagnostic}
    return {**reconcile(job_id, "UNEXPECTED_FINAL_STATUS"), "observed_status": final_status}


def main() -> int:
    parser = argparse.ArgumentParser(description="Despacho pontual e controlado do Hermes")
    parser.add_argument("--profiles-root", type=Path, default=Path("/data/profiles"))
    parser.add_argument("--job-id", help="Somente este job previamente aprovado pode executar")
    parser.add_argument("--auto", action="store_true", help="Usa apenas o primeiro READY com DISPATCH_REQUESTED valido da Marina")
    parser.add_argument("--execute", action="store_true", help="Permite claim/start e uma chamada de modelo")
    args = parser.parse_args()
    if args.auto and args.job_id:
        parser.error("Use --auto ou --job-id, nunca ambos")
    if args.execute and not (args.auto or (args.job_id and JOB_PATTERN.fullmatch(args.job_id))):
        parser.error("--execute exige --auto ou --job-id valido")
    if fcntl is None:
        parser.error("Este despachante exige Linux no host do Hermes")
    lock_path = Path("/data/helena-runtime/dispatcher.lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a+") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print(json.dumps({"status": "ALREADY_RUNNING"}))
            return 0
        try:
            result = dispatch_once(args.profiles_root, GATEWAY, args.job_id, args.execute, auto=args.auto)
            save_report(lock_path.parent, result)
            print(json.dumps(result, ensure_ascii=False))
            return 0 if result["status"] in {"DRY_RUN_QUEUE_ONLY", "NO_APPROVED_READY_JOB", "NO_DISPATCH_REQUEST", "DRY_RUN", "WAITING_HELENA", "COMPLETED"} else 1
        except (ValueError, RuntimeError, OSError) as error:
            print(json.dumps({"status": "ERROR", "message": str(error)}, ensure_ascii=False), file=sys.stderr)
            return 1


if __name__ == "__main__":
    raise SystemExit(main())
