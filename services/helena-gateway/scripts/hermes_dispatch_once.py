"""One bounded, opt-in Hermes dispatch. No model call in the default mode.

Run on the Hermes host, not on the Gateway host. A scheduler can invoke this
script later, after the business and model-usage policy has been approved.
"""

import argparse
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

try:
    import fcntl
except ImportError:  # The dispatcher runs on Linux; allow Windows unit tests.
    fcntl = None


GATEWAY = "https://helena-automation-helena-gateway.d9v63q.easypanel.host"
TOKEN_NAME = "HELENA_GATEWAY_PROFILE_TOKEN"
PROFILE_PATTERN = re.compile(r"[a-z][a-z0-9-]{2,79}\Z")
JOB_PATTERN = re.compile(r"JOB-HR-[a-f0-9]{32}\Z")


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
        raise RuntimeError("Gateway recusou " + name + " (HTTP " + str(error.code) + ")") from None
    if not isinstance(envelope, dict) or envelope.get("ok") is not True or not isinstance(envelope.get("result"), dict):
        raise RuntimeError("Gateway nao confirmou " + name)
    return envelope["result"]


def run_profile(binary: str, profile: str, job_id: str, timeout: int) -> int:
    prompt = (
        "Piloto interno autorizado da empresa vinculada ao job " + job_id + ". "
        "O despachante ja confirmou identidade e chamou claim_job/start_job; NAO repita essas chamadas. "
        "Use somente helena_operacao.get_work_context e get_job para verificar que o job esta RUNNING, e siga a instrucao registrada na tarefa. "
        "Registre marcos reais em record_progress, memoria e fonte em record_memory e entregue com submit_delivery "
        "usando a row_version atual e evidencia. Se impedido, use waiting_helena ou fail_job. "
        "Nao delegue, nao use complete_job, SQL direto, Terminal, web ou mensagens externas. "
        "Nao prometa fatos comerciais nao confirmados. Nao declare sucesso sem resposta confirmada do Supabase."
    )
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", prefix="helena-job-", suffix=".txt", delete=False) as handle:
        prompt_path = Path(handle.name)
        os.chmod(prompt_path, 0o600)
        handle.write(prompt)
    try:
        process = subprocess.Popen(
            [binary, "-p", profile, "chat", "--query-file", str(prompt_path), "--oneshot",
             "--toolsets", "mcp-helena_operacao", "--max-turns", "12"],
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        try:
            return process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
            return 124
    finally:
        prompt_path.unlink(missing_ok=True)


def dispatch_once(root: Path, gateway: str, approved_job: str | None, execute: bool, run_agent=run_profile, request=call_tool) -> dict:
    if gateway.rstrip("/") != GATEWAY:
        raise ValueError("Gateway fora do endpoint aprovado")
    helena_token = token_for(root, "helena--grupo")
    queue = request(gateway, helena_token, "list_ready_jobs", {"limit": 25})
    jobs = queue.get("jobs")
    if not isinstance(jobs, list):
        raise RuntimeError("Fila retornou formato invalido")
    if approved_job is None:
        return {"status": "DRY_RUN_QUEUE_ONLY", "ready_count": len(jobs)}
    eligible = [job for job in jobs if isinstance(job, dict) and job.get("job_id") == approved_job]
    if not eligible:
        return {"status": "NO_APPROVED_READY_JOB", "ready_count": len(jobs)}
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
    detail = request(gateway, profile_token, "get_job", {"job_id": job_id})
    source = detail.get("job") or {}
    binding = detail.get("runtime_binding") or {}
    if (source.get("status") != "READY" or source.get("agent_id") != agent_id or source.get("business_id") != business_id
            or source.get("task_id") != job.get("task_id") or binding.get("profile_slug") != profile or binding.get("status") != "ACTIVE"):
        raise RuntimeError("Job, tarefa e perfil divergentes; nenhuma chamada ao modelo")
    if not execute:
        return {"status": "DRY_RUN", "job_id": job_id, "profile": profile, "business_id": business_id}
    if os.environ.get("HELENA_DISPATCH_ENABLED") != "1":
        raise RuntimeError("Execucao desligada; HELENA_DISPATCH_ENABLED=1 e obrigatorio")
    binary = os.environ.get("HERMES_BIN", "hermes")
    resolved_binary = shutil.which(binary)
    if not resolved_binary:
        raise RuntimeError("CLI Hermes indisponivel; job permanece READY")
    claimed = request(gateway, profile_token, "claim_job", {"job_id": job_id, "agent_id": agent_id})
    if claimed.get("claimed") is not True:
        raise RuntimeError("Claim nao confirmado; nenhuma chamada ao modelo")
    started = request(gateway, profile_token, "start_job", {"job_id": job_id, "agent_id": agent_id})
    if started.get("running") is not True:
        return {"status": "CLAIMED_START_FAILED_RECONCILE", "job_id": job_id}
    try:
        exit_code = run_agent(resolved_binary, profile, job_id, 180)
    except OSError:
        exit_code = 125
    result = request(gateway, profile_token, "get_job", {"job_id": job_id})
    final_status = (result.get("job") or {}).get("status")
    if final_status in {"WAITING_HELENA", "COMPLETED", "FAILED"}:
        return {"status": final_status, "job_id": job_id, "exit_code": exit_code}
    if final_status in {"RUNNING", "CLAIMED"}:
        failed = request(gateway, profile_token, "fail_job", {
            "job_id": job_id, "agent_id": agent_id,
            "error_code": "HERMES_NO_DELIVERY" if exit_code == 0 else "HERMES_PROCESS_FAILED",
            "error_message": "Execucao pontual terminou sem entrega confirmada; verificar eventos e evidencias antes de qualquer repeticao.",
        })
        return {"status": "FAILED" if failed.get("failed") else "RECONCILE", "job_id": job_id, "exit_code": exit_code}
    return {"status": "RECONCILE", "job_id": job_id, "observed_status": final_status}


def main() -> int:
    parser = argparse.ArgumentParser(description="Despacho pontual e controlado do Hermes")
    parser.add_argument("--profiles-root", type=Path, default=Path("/data/profiles"))
    parser.add_argument("--job-id", help="Somente este job previamente aprovado pode executar")
    parser.add_argument("--execute", action="store_true", help="Permite claim/start e uma chamada de modelo")
    args = parser.parse_args()
    if args.execute and (not args.job_id or not JOB_PATTERN.fullmatch(args.job_id)):
        parser.error("--execute exige --job-id valido")
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
            result = dispatch_once(args.profiles_root, GATEWAY, args.job_id, args.execute)
            print(json.dumps(result, ensure_ascii=False))
            return 0 if result["status"] in {"DRY_RUN_QUEUE_ONLY", "NO_APPROVED_READY_JOB", "DRY_RUN", "WAITING_HELENA", "COMPLETED"} else 1
        except (ValueError, RuntimeError, OSError) as error:
            print(json.dumps({"status": "ERROR", "message": str(error)}, ensure_ascii=False), file=sys.stderr)
            return 1


if __name__ == "__main__":
    raise SystemExit(main())
