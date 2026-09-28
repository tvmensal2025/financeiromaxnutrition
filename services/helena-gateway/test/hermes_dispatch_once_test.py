"""No network or model invocation: contract tests for the opt-in dispatcher."""

import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "hermes_dispatch_once.py"
SPEC = importlib.util.spec_from_file_location("hermes_dispatch_once", SCRIPT)
dispatcher = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(dispatcher)
JOB_ID = "JOB-HR-" + "a" * 32
PROFILE = "pedro--biz003"
BRIEF = "\n".join(
    f"## {title}\nDefina dados verificáveis, responsável, limite, resultado e evidência para esta etapa específica."
    for title in dispatcher.BRIEF_SECTIONS
)


class DispatchTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name, char in (("helena--grupo", "H"), (PROFILE, "P")):
            home = self.root / name
            home.mkdir()
            (home / ".env").write_text("HELENA_GATEWAY_PROFILE_TOKEN=hhs_" + char * 40 + "\n", encoding="utf-8")
        self.job = {
            "job_id": JOB_ID, "agent_id": "AGT-18", "business_id": "BIZ-003",
            "task_id": "TSK-HR-" + "b" * 32, "provider": "HERMES",
            "external_agent_id": PROFILE, "objective": "Validar parceiros", "instruction": BRIEF,
        }
        self.calls = []
        self.model_calls = []
        self.job_status = "READY"
        self.binding_status = "ACTIVE"
        self.start_confirmed = True
        self.fail_confirmed = True

    def request(self, gateway, token, name, payload):
        self.assertEqual(gateway, dispatcher.GATEWAY)
        self.calls.append((name, payload, token))
        if name == "list_ready_jobs":
            self.assertTrue(token.endswith("H" * 40))
            return {"jobs": [self.job], "total_ready": 1}
        self.assertTrue(token.endswith("P" * 40))
        if name == "get_job":
            return {
                "job": {**self.job, "status": self.job_status},
                "task": {"task_id": self.job["task_id"], "business_id": "BIZ-003",
                         "definicao_de_pronto": "Entregar checklist com fontes e revisão."},
                "runtime_binding": {"profile_slug": PROFILE, "status": self.binding_status,
                                    "business_id": "BIZ-003", "agent_id": "AGT-18"},
            }
        if name == "claim_job":
            self.job_status = "CLAIMED"
            return {"claimed": True}
        if name == "start_job":
            if self.start_confirmed:
                self.job_status = "RUNNING"
            return {"running": self.start_confirmed}
        if name == "fail_job":
            if self.fail_confirmed:
                self.job_status = "FAILED"
            return {"failed": self.fail_confirmed}
        raise AssertionError(name)

    def run_agent(self, binary, profile, job_id, timeout, profile_token, profile_home):
        self.assertEqual(profile_token, "hhs_" + "P" * 40)
        self.assertEqual(profile_home, self.root / PROFILE)
        self.model_calls.append((binary, profile, job_id, timeout))
        self.job_status = "WAITING_HELENA"
        return 0

    def dispatch(self, job_id=JOB_ID, execute=False, run_agent=None, preflight=None, tool_preflight=None):
        return dispatcher.dispatch_once(
            self.root, dispatcher.GATEWAY, job_id, execute,
            run_agent=run_agent or self.run_agent, request=self.request,
            preflight=preflight or (lambda *args: {"status": "READY"}),
            tool_preflight=tool_preflight or (lambda *args: {"status": "READY"}),
        )

    def test_queue_check_without_job_cannot_start_model(self):
        with patch.dict(os.environ, {"HELENA_DISPATCH_ENABLED": "1"}):
            result = self.dispatch(job_id=None, execute=False)
        self.assertEqual(result, {"status": "DRY_RUN_QUEUE_ONLY", "ready_count": 1})
        self.assertEqual([call[0] for call in self.calls], ["list_ready_jobs"])
        self.assertEqual(self.model_calls, [])

    def test_dry_run_checks_exact_job_and_active_binding(self):
        self.assertEqual(self.dispatch()["status"], "DRY_RUN")
        self.assertEqual([call[0] for call in self.calls], ["list_ready_jobs", "get_job"])
        self.assertEqual(self.model_calls, [])

    def test_wrong_company_or_inactive_binding_fails_closed(self):
        self.job_status = "READY"
        self.binding_status = "CONFIGURED"
        with self.assertRaisesRegex(RuntimeError, "divergentes"):
            self.dispatch()
        self.assertEqual(self.model_calls, [])
        self.assertFalse(any(call[0] == "claim_job" for call in self.calls))

    def test_different_gateway_rejected_before_token_use(self):
        with self.assertRaisesRegex(ValueError, "endpoint aprovado"):
            dispatcher.dispatch_once(self.root, "https://elsewhere.example", JOB_ID, False, request=self.request)
        self.assertEqual(self.calls, [])

    def test_execute_requires_explicit_enable_before_claim(self):
        with patch.dict(os.environ, {"HELENA_DISPATCH_ENABLED": "0"}):
            with self.assertRaisesRegex(RuntimeError, "desligada"):
                self.dispatch(execute=True)
        self.assertFalse(any(call[0] == "claim_job" for call in self.calls))
        self.assertEqual(self.model_calls, [])

    def test_confirmed_start_runs_exactly_one_model_turn(self):
        with patch.dict(os.environ, {"HELENA_DISPATCH_ENABLED": "1"}), patch.object(dispatcher.shutil, "which", return_value="/usr/bin/hermes"):
            result = self.dispatch(execute=True)
        self.assertEqual(result["status"], "WAITING_HELENA")
        self.assertEqual(self.model_calls, [("/usr/bin/hermes", PROFILE, JOB_ID, 180)])
        self.assertEqual([call[0] for call in self.calls], [
            "list_ready_jobs", "get_job", "claim_job", "start_job", "get_job",
        ])

    def test_start_not_confirmed_never_runs_model(self):
        self.start_confirmed = False
        with patch.dict(os.environ, {"HELENA_DISPATCH_ENABLED": "1"}), patch.object(dispatcher.shutil, "which", return_value="/usr/bin/hermes"):
            result = self.dispatch(execute=True)
        self.assertEqual(result["status"], "CLAIMED_START_FAILED_RECONCILE")
        self.assertEqual(self.model_calls, [])

    def test_briefing_raso_bloqueia_antes_do_claim_e_do_modelo(self):
        self.job["instruction"] = "Faça uma análise."
        with patch.dict(os.environ, {"HELENA_DISPATCH_ENABLED": "1"}):
            with self.assertRaisesRegex(RuntimeError, "Briefing profissional"):
                self.dispatch(execute=True)
        self.assertFalse(any(call[0] in ("claim_job", "start_job") for call in self.calls))
        self.assertEqual(self.model_calls, [])

    def test_exhausted_provider_blocks_claim_and_model(self):
        with patch.dict(os.environ, {"HELENA_DISPATCH_ENABLED": "1"}), patch.object(dispatcher.shutil, "which", return_value="/usr/bin/hermes"):
            result = self.dispatch(execute=True, preflight=lambda *args: {
                "status": "PROVIDER_LIMIT", "reset_at": "2026-09-28T08:48:49Z"})
        self.assertEqual(result["status"], "PROVIDER_LIMIT")
        self.assertFalse(result["model_started"])
        self.assertEqual(self.model_calls, [])
        self.assertFalse(any(call[0] == "claim_job" for call in self.calls))

    def test_missing_mcp_blocks_claim_and_model(self):
        with patch.dict(os.environ, {"HELENA_DISPATCH_ENABLED": "1"}), patch.object(dispatcher.shutil, "which", return_value="/usr/bin/hermes"):
            result = self.dispatch(execute=True, tool_preflight=lambda *args: {"status": "MCP_UNAVAILABLE"})
        self.assertEqual(result["status"], "MCP_UNAVAILABLE")
        self.assertFalse(result["model_started"])
        self.assertFalse(any(call[0] == "claim_job" for call in self.calls))

    def test_mcp_probe_requires_discovered_tools(self):
        from unittest.mock import Mock
        probe = Path(dispatcher.__file__).with_name("hermes_mcp_preflight.py")
        self.assertTrue(probe.is_file())
        with patch.object(dispatcher.Path, "is_file", return_value=True):
            run = lambda *args, **kwargs: Mock(returncode=0, stdout=b'{"server":"helena_operacao","tool_count":15}')
            self.assertEqual(dispatcher.mcp_preflight(self.root / PROFILE, "hhs_" + "P" * 40, run), {"status": "READY"})
            run = lambda *args, **kwargs: Mock(returncode=0, stdout=b'{"server":"helena_operacao","tool_count":0}')
            self.assertEqual(dispatcher.mcp_preflight(self.root / PROFILE, "hhs_" + "P" * 40, run), {"status": "MCP_UNAVAILABLE"})

    def test_usage_preflight_fails_closed_on_unknown_and_reports_limit(self):
        from unittest.mock import Mock
        def response(payload, exit_code=0):
            return Mock(returncode=exit_code, stdout=json.dumps(payload).encode())
        runner = lambda *args, **kwargs: response({"provider": "openai-codex", "windows": [
            {"label": "Session", "used_percent": 100, "resets_at": "2026-09-28T08:48:49Z"}]})
        self.assertEqual(dispatcher.usage_preflight("hermes", PROFILE, runner)["status"], "PROVIDER_LIMIT")
        runner = lambda *args, **kwargs: response({"provider": "openai-codex", "windows": [
            {"label": "Session", "used_percent": None}]})
        self.assertEqual(dispatcher.usage_preflight("hermes", PROFILE, runner)["status"], "USAGE_UNAVAILABLE")

    def test_no_delivery_records_failure_instead_of_false_success(self):
        with patch.dict(os.environ, {"HELENA_DISPATCH_ENABLED": "1"}), patch.object(dispatcher.shutil, "which", return_value="/usr/bin/hermes"):
            result = self.dispatch(execute=True, run_agent=lambda *args: 0)
        self.assertEqual(result["status"], "FAILED")
        self.assertEqual(self.calls[-1][0], "fail_job")
        self.assertEqual(self.calls[-1][1]["error_code"], "HERMES_NO_DELIVERY")

    def test_process_error_records_failure_instead_of_stranding_running_job(self):
        def crash(*args):
            raise OSError("simulated")

        with patch.dict(os.environ, {"HELENA_DISPATCH_ENABLED": "1"}), patch.object(dispatcher.shutil, "which", return_value="/usr/bin/hermes"):
            result = self.dispatch(execute=True, run_agent=crash)
        self.assertEqual(result["status"], "FAILED")
        self.assertEqual(result["exit_code"], 125)
        self.assertEqual(self.calls[-1][1]["error_code"], "HERMES_PROCESS_FAILED")

    def test_model_process_receives_only_helena_mcp_and_bounded_turns(self):
        case = self

        class FinishedProcess:
            def wait(self, timeout):
                case.assertEqual(timeout, 180)
                return 0

        def spawn(args, **kwargs):
            self.assertEqual(args[:4], ["/usr/bin/hermes", "-p", PROFILE, "chat"])
            self.assertEqual(args[4], "--query-file")
            self.assertTrue(Path(args[5]).is_file())
            self.assertEqual(args[6:], ["--oneshot", "--toolsets", "helena_operacao", "--max-turns", "12"])
            self.assertEqual(kwargs["stdin"], dispatcher.subprocess.DEVNULL)
            self.assertEqual(kwargs["env"][dispatcher.TOKEN_NAME], "hhs_" + "P" * 40)
            self.assertEqual(kwargs["env"]["HERMES_HOME"], str(self.root / PROFILE))
            return FinishedProcess()

        with patch.object(dispatcher.subprocess, "Popen", side_effect=spawn):
            self.assertEqual(dispatcher.run_profile("/usr/bin/hermes", PROFILE, JOB_ID, 180, "hhs_" + "P" * 40, self.root / PROFILE), (0, None))

    def test_cli_error_is_classified_without_persisting_raw_output(self):
        class FailedProcess:
            def wait(self, timeout):
                return 1

        def spawn(args, **kwargs):
            kwargs["stderr"].write(b"429 usage limit reached; token=hhs_SECRET_SHOULD_NOT_LEAK")
            return FailedProcess()

        with patch.object(dispatcher.subprocess, "Popen", side_effect=spawn):
            outcome = dispatcher.run_profile("/usr/bin/hermes", PROFILE, JOB_ID, 180, "hhs_" + "P" * 40, self.root / PROFILE)
        self.assertEqual(outcome, (1, "RATE_LIMIT"))
        self.assertNotIn("SECRET", json.dumps(outcome))

    def test_failed_model_call_records_only_safe_diagnostic(self):
        with patch.dict(os.environ, {"HELENA_DISPATCH_ENABLED": "1"}), patch.object(dispatcher.shutil, "which", return_value="/usr/bin/hermes"):
            result = self.dispatch(execute=True, run_agent=lambda *args: (1, "RATE_LIMIT"))
        self.assertEqual(result["status"], "FAILED")
        self.assertEqual(result["diagnostic"], "RATE_LIMIT")
        self.assertEqual(self.calls[-1][1]["error_code"], "HERMES_PROCESS_FAILED")
        self.assertIn("RATE_LIMIT", self.calls[-1][1]["error_message"])

    def test_lost_mutation_responses_do_not_retry_or_start_model(self):
        original = self.request
        for operation, phase in (("claim_job", "CLAIM_RESPONSE_UNKNOWN"), ("start_job", "START_RESPONSE_UNKNOWN")):
            with self.subTest(operation=operation):
                self.job_status = "READY"
                self.calls.clear()
                def interrupted(gateway, token, name, payload):
                    response = original(gateway, token, name, payload)
                    if name == operation:
                        raise OSError("secret transport detail")
                    return response
                with patch.object(self, "request", side_effect=interrupted), patch.dict(os.environ, {"HELENA_DISPATCH_ENABLED": "1"}), patch.object(dispatcher.shutil, "which", return_value="hermes"):
                    result = self.dispatch(execute=True)
                self.assertEqual(result["phase"], phase)
                self.assertFalse(result["automatic_retry"])
                self.assertEqual(self.model_calls, [])
                self.assertEqual(sum(call[0] == operation for call in self.calls), 1)
                self.assertNotIn("secret", json.dumps(result))

    def test_lost_delivery_read_preserves_job_without_second_model_call(self):
        original = self.request
        def interrupted(gateway, token, name, payload):
            if name == "get_job" and self.model_calls:
                raise OSError("offline")
            return original(gateway, token, name, payload)
        with patch.object(self, "request", side_effect=interrupted), patch.dict(os.environ, {"HELENA_DISPATCH_ENABLED": "1"}), patch.object(dispatcher.shutil, "which", return_value="hermes"):
            result = self.dispatch(execute=True)
        self.assertEqual(result["phase"], "VERIFY_DELIVERY")
        self.assertEqual(result["job_id"], JOB_ID)
        self.assertEqual(len(self.model_calls), 1)
        self.assertFalse(any(call[0] == "fail_job" for call in self.calls))

    def test_receipt_records_seconds_and_reconciliation(self):
        dispatcher.save_report(self.root, dispatcher.reconcile(JOB_ID, "VERIFY_DELIVERY"))
        report = json.loads((self.root / "dispatcher-last-result.json").read_text(encoding="utf-8"))
        self.assertEqual(report["job_id"], JOB_ID)
        self.assertRegex(report["observed_at"], r"T\d{2}:\d{2}:\d{2}\+00:00$")
        self.assertNotIn("hhs_", json.dumps(report))


if __name__ == "__main__":
    unittest.main()
