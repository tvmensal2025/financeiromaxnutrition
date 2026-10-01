"""No network or model invocation: contract tests for the opt-in dispatcher."""

import importlib.util
import hashlib
import json
import os
from pathlib import Path
import tempfile
import sys
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "hermes_dispatch_once.py"
sys.path.insert(0, str(SCRIPT.parent))
SPEC = importlib.util.spec_from_file_location("hermes_dispatch_once", SCRIPT)
dispatcher = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(dispatcher)
JOB_ID = "JOB-HR-" + "a" * 32
PROFILE = "pedro--biz003"
BRIEF = "\n".join(
    f"## {title}\nDefina dados verificáveis, responsável, limite, resultado e evidência para esta etapa específica."
    for title in dispatcher.BRIEF_SECTIONS
)


class BinaryResolutionTests(unittest.TestCase):
    def test_installed_cli_is_found_without_path(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(dispatcher.shutil, "which", return_value=None), patch.object(dispatcher.Path, "is_file", return_value=True), patch.object(dispatcher.os, "access", return_value=True):
            self.assertEqual(dispatcher.resolve_hermes_binary(), "/opt/hermes/bin/hermes")

    def test_explicit_missing_cli_does_not_switch_install(self):
        with patch.dict(os.environ, {"HERMES_BIN": "/missing/hermes"}, clear=True), patch.object(dispatcher.shutil, "which", return_value=None), patch.object(dispatcher.Path, "is_file") as probe:
            self.assertIsNone(dispatcher.resolve_hermes_binary())
            probe.assert_not_called()

    def test_non_executable_cli_is_refused(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(dispatcher.shutil, "which", return_value=None), patch.object(dispatcher.Path, "is_file", return_value=True), patch.object(dispatcher.os, "access", return_value=False):
            self.assertIsNone(dispatcher.resolve_hermes_binary())


class DispatchTests(unittest.TestCase):
    def setUp(self):
        launcher = patch.object(dispatcher, 'launcher_preflight', return_value={'status': 'READY'})
        self.launcher_probe = launcher.start()
        self.addCleanup(launcher.stop)
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
        self.events = []

    def test_broken_launcher_never_claims_or_consumes_attempt(self):
        self.launcher_probe.return_value = {'status': 'LAUNCHER_UNAVAILABLE', 'diagnostic': 'RUNTIME_SYNTAX'}
        with patch.dict(os.environ, {'HELENA_DISPATCH_ENABLED': '1'}), patch.object(dispatcher.shutil, 'which', return_value='hermes'):
            result = self.dispatch(execute=True)
        self.assertEqual(result['status'], 'LAUNCHER_UNAVAILABLE')
        self.assertFalse(result['model_started'])
        self.assertFalse(any(call[0] == 'claim_job' for call in self.calls))
        self.assertEqual(self.model_calls, [])

    def request(self, gateway, token, name, payload):
        self.assertEqual(gateway, dispatcher.GATEWAY)
        self.calls.append((name, payload, token))
        if name == "list_ready_jobs":
            self.assertTrue(token.endswith("H" * 40))
            return {"jobs": [self.job], "total_ready": 1}
        self.assertTrue(token.endswith("P" * 40))
        if name == "get_work_context":
            return {"context_version":"hermes-context-v2", "truncated":False,
                    "profile":{"agent_id":"AGT-18", "status":"ACTIVE", "profile_slug":PROFILE}}
        if name == "get_job":
            return {
                "job": {**self.job, "status": self.job_status},
                "task": {"task_id": self.job["task_id"], "business_id": "BIZ-003",
                         "row_version":1, "definicao_de_pronto": "Entregar checklist com fontes e revisão."},
                "runtime_binding": {"profile_slug": PROFILE, "status": self.binding_status,
                                    "business_id": "BIZ-003", "agent_id": "AGT-18"},
                "events": self.events,
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

    def test_auto_requires_marina_request_before_model(self):
        with patch.dict(os.environ, {"HELENA_DISPATCH_ENABLED": "1"}), patch.object(dispatcher.shutil, "which", return_value="/usr/bin/hermes"):
            result = dispatcher.dispatch_once(self.root, dispatcher.GATEWAY, None, True,
                run_agent=self.run_agent, request=self.request, auto=True,
                preflight=lambda *args: {"status": "READY"}, tool_preflight=lambda *args: {"status": "READY"})
        self.assertEqual(result["status"], "NO_DISPATCH_REQUEST")
        self.assertEqual(self.model_calls, [])
        self.assertFalse(any(call[0] == "claim_job" for call in self.calls))

    def test_auto_runs_only_matching_requested_job(self):
        self.events = [{"event_type": "DISPATCH_REQUESTED", "job_id": JOB_ID,
                        "business_id": "BIZ-003", "payload": {"dispatcher_agent_id": "AGT-04",
                        "target_agent_id": "AGT-18", "target_external_agent_id": PROFILE}}]
        with patch.dict(os.environ, {"HELENA_DISPATCH_ENABLED": "1"}), patch.object(dispatcher.shutil, "which", return_value="/usr/bin/hermes"):
            result = dispatcher.dispatch_once(self.root, dispatcher.GATEWAY, None, True,
                run_agent=self.run_agent, request=self.request, auto=True,
                preflight=lambda *args: {"status": "READY"}, tool_preflight=lambda *args: {"status": "READY"})
        self.assertEqual(result["status"], "WAITING_HELENA")
        self.assertEqual(len(self.model_calls), 1)

    def test_auto_rejects_request_for_another_business(self):
        self.events = [{"event_type": "DISPATCH_REQUESTED", "job_id": JOB_ID,
                        "business_id": "BIZ-002", "payload": {"dispatcher_agent_id": "AGT-04",
                        "target_agent_id": "AGT-18", "target_external_agent_id": PROFILE}}]
        self.assertEqual(dispatcher.dispatch_once(self.root, dispatcher.GATEWAY, None, True,
            run_agent=self.run_agent, request=self.request, auto=True)["status"], "NO_DISPATCH_REQUEST")
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
        self.assertEqual(self.model_calls, [("/usr/bin/hermes", PROFILE, JOB_ID, 300)])
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
            run = lambda *args, **kwargs: Mock(returncode=0, stdout=json.dumps({'server': 'helena_operacao', 'tool_count': 15, 'ready': True, 'profile': PROFILE}).encode())
            self.assertEqual(dispatcher.mcp_preflight(self.root / PROFILE, "hhs_" + "P" * 40, run), {"status": "READY"})
            run = lambda *args, **kwargs: Mock(returncode=0, stdout=b'{"server":"helena_operacao","tool_count":0}')
            self.assertEqual(dispatcher.mcp_preflight(self.root / PROFILE, "hhs_" + "P" * 40, run), {"status": "MCP_UNAVAILABLE"})
            for report in ({'ready': False, 'profile': PROFILE}, {'ready': True, 'profile': 'wrong-profile'}, {}):
                run = lambda *args, **kwargs: Mock(returncode=0, stdout=json.dumps({'server': 'helena_operacao', 'tool_count': 15, **report}).encode())
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
            self.assertEqual(args[0], sys.executable)
            self.assertEqual(Path(args[1]).name, 'install_native_mcp_pixels.py')
            self.assertEqual(args[2], '--run-hermes')
            args = args[3:]
            self.assertEqual(args[:4], ["/usr/bin/hermes", "-p", PROFILE, "chat"])
            self.assertEqual(args[4], "--query-file")
            self.assertTrue(Path(args[5]).is_file())
            prompt = Path(args[5]).read_text(encoding="utf-8")
            self.assertIn("execucao nova e isolada", prompt)
            self.assertIn("authorized-work-packet-v1", prompt)
            self.assertIn(BRIEF.replace('\n', '\\n'), prompt)
            # Inspect the JSON actually delivered to Hermes, not just a phrase in the prompt.
            packet_text = prompt.split('CONTEXTO ATUAL OBTIDO PELO RUNTIME AUTENTICADO, SEM INFERENCIA:\n', 1)[1].split('\n', 1)[0]
            packet = json.loads(packet_text)
            self.assertEqual(packet['packet_version'], 'authorized-work-packet-v1')
            self.assertIs(packet['truncated'], False)
            self.assertEqual(packet['job']['instruction'], BRIEF)
            self.assertNotIn('context_version hermes-context-v2', prompt)
            self.assertNotIn('context_version', packet)
            self.assertEqual(args[6:], ["--oneshot", "--toolsets", "helena_operacao,helena_contracts", "--max-turns", "24"])
            self.assertEqual(kwargs["stdin"], dispatcher.subprocess.DEVNULL)
            self.assertEqual(kwargs["env"][dispatcher.TOKEN_NAME], "hhs_" + "P" * 40)
            self.assertEqual(kwargs["env"]["HERMES_HOME"], str(self.root / PROFILE))
            return FinishedProcess()

        self.job_status = "RUNNING"
        with patch.dict(os.environ, {'HERMES_PYTHON': sys.executable}), patch.object(dispatcher.subprocess, "Popen", side_effect=spawn), patch.object(dispatcher, "call_tool", side_effect=self.request):
            self.assertEqual(dispatcher.run_profile("/usr/bin/hermes", PROFILE, JOB_ID, 180, "hhs_" + "P" * 40, self.root / PROFILE), (0, None))

    def test_invalid_registry_context_still_prevents_inference(self):
        for context in ({}, {'context_version': 'hermes-context-v1'},
                        {'context_version': 'hermes-context-v2', 'truncated': True}):
            with self.subTest(context=context), patch.object(dispatcher, 'call_tool', return_value=context), patch.object(dispatcher.subprocess, 'Popen') as spawn:
                self.assertEqual(dispatcher.run_profile('hermes', PROFILE, JOB_ID, 180,
                    'hhs_' + 'P' * 40, self.root / PROFILE), (125, 'CONTEXT_UNAVAILABLE'))
                spawn.assert_not_called()

    def test_cli_error_is_classified_without_persisting_raw_output(self):
        class FailedProcess:
            def wait(self, timeout):
                return 1

        def spawn(args, **kwargs):
            kwargs["stderr"].write(b"429 usage limit reached; token=hhs_SECRET_SHOULD_NOT_LEAK")
            return FailedProcess()

        self.job_status = "RUNNING"
        with patch.dict(os.environ, {'HERMES_PYTHON': sys.executable}), patch.object(dispatcher.subprocess, "Popen", side_effect=spawn), patch.object(dispatcher, "call_tool", side_effect=self.request):
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

    def test_gateway_claim_refusal_is_not_reported_as_lost_response(self):
        original = self.request
        def refused(gateway, token, name, payload):
            if name == "claim_job":
                raise dispatcher.GatewayRefusal("Gateway recusou claim_job (HTTP 400)")
            return original(gateway, token, name, payload)
        with patch.dict(os.environ, {"HELENA_DISPATCH_ENABLED": "1"}), patch.object(dispatcher.shutil, "which", return_value="hermes"), patch.object(self, "request", side_effect=refused):
            result = self.dispatch(execute=True)
        self.assertEqual(result["status"], "GATEWAY_REJECTED")
        self.assertEqual(result["phase"], "CLAIM")
        self.assertFalse(result["automatic_retry"])
        self.assertFalse(result["model_started"])
        self.assertEqual(self.model_calls, [])

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

    def test_current_jev_result_selects_model_for_exact_brief_only(self):
        detail = self.request(dispatcher.GATEWAY, "hhs_" + "P" * 40, "get_job", {"job_id": JOB_ID})
        detail["task"]["row_version"] = 7
        source = "\n".join((self.job["objective"], self.job["instruction"], detail["task"]["definicao_de_pronto"]))
        digest = hashlib.sha256(source.encode("utf-8")).hexdigest()
        self.events.append({"event_type": "TYPESAFE_ROUTE", "job_id": JOB_ID, "business_id": "BIZ-003", "agent_id": "AGT-18",
                            "payload": {"policy": dispatcher.ROUTING_POLICY, "brief_hash": digest, "task_version": 7,
                                        "status": "RECORDED", "recommendation": "NO_ISSUE_DETECTED",
                                        "model_route": {"status": "ADVICE", "tier": "COMPLEX", "model": "gpt-6-astra", "confidence": 0.96}}})
        self.assertEqual(dispatcher.model_route_for(detail)["model"], "gpt-6-astra")
        detail["task"]["row_version"] = 8
        self.assertEqual(dispatcher.model_route_for(detail)["status"], "PROFILE_DEFAULT")
        detail["task"]["row_version"] = 7
        detail["job"]["instruction"] += " changed"
        self.assertEqual(dispatcher.model_route_for(detail)["status"], "PROFILE_DEFAULT")

    def test_dispatch_passes_verified_jev_model_to_hermes_run(self):
        definition = "Entregar checklist com fontes e revisão."
        digest = hashlib.sha256("\n".join((self.job["objective"], self.job["instruction"], definition)).encode("utf-8")).hexdigest()
        self.events.append({"event_type": "TYPESAFE_ROUTE", "job_id": JOB_ID, "business_id": "BIZ-003", "agent_id": "AGT-18",
                            "payload": {"policy": dispatcher.ROUTING_POLICY, "brief_hash": digest, "task_version": 1,
                                        "status": "RECORDED", "recommendation": "NO_ISSUE_DETECTED",
                                        "model_route": {"status": "ADVICE", "tier": "MODERATE", "model": "gpt-6-sol", "confidence": 0.95}}})
        original = self.request
        def versioned(gateway, token, name, payload):
            result = original(gateway, token, name, payload)
            if name == "get_job":
                result["task"]["row_version"] = 1
            return result
        def run(*args):
            self.assertEqual(args[-1], "gpt-6-sol")
            self.job_status = "WAITING_HELENA"
            return (0, None)
        with patch.object(self, "request", side_effect=versioned), patch.dict(os.environ, {"HELENA_DISPATCH_ENABLED": "1"}), patch.object(dispatcher.shutil, "which", return_value="hermes"):
            result = self.dispatch(execute=True, run_agent=run)
        self.assertEqual(result["status"], "WAITING_HELENA")
        self.assertEqual(result["model_route"]["model"], "gpt-6-sol")

    def test_jev_cannot_override_helena_or_inject_unapproved_model(self):
        detail = self.request(dispatcher.GATEWAY, "hhs_" + "P" * 40, "get_job", {"job_id": JOB_ID})
        detail["job"]["agent_id"] = "AGT-01"
        self.assertEqual(dispatcher.model_route_for(detail)["reason"], "HELENA_SOL61_MAX")
        self.assertEqual(dispatcher.model_route_for(detail)["model"], "gpt-6.1-sol")
        with self.assertRaises(ValueError):
            dispatcher.run_profile("hermes", PROFILE, JOB_ID, 180, "hhs_" + "P" * 40, self.root / PROFILE, "untrusted-model")

    def test_correction_requires_scoped_latest_rejection(self):
        detail = self.request(dispatcher.GATEWAY, "hhs_" + "P" * 40, "get_job", {"job_id": JOB_ID})
        detail['job']['result_payload'] = {'review_reason': 'Corrigir CTA'}
        detail['events'] = []
        self.assertNotEqual(dispatcher.model_route_for(detail).get('model'), 'gpt-6.1-sol')
        rejected = {'event_type':'WORKFLOW_review_delivery', 'job_id':JOB_ID, 'business_id':'BIZ-OTHER',
                    'created_at':'2026-10-01T01:00:00Z', 'payload':{'request':{'payload':{'decision':'REQUEST_CHANGES'}}}}
        detail['events'].append(rejected)
        self.assertNotEqual(dispatcher.model_route_for(detail).get('model'), 'gpt-6.1-sol')
        rejected['business_id'] = 'BIZ-003'
        self.assertEqual(dispatcher.model_route_for(detail).get('model'), 'gpt-6.1-sol')
        detail['events'].append({**rejected, 'created_at':'2026-10-01T02:00:00Z',
                                 'payload':{'request':{'payload':{'decision':'APPROVE'}}}})
        self.assertNotEqual(dispatcher.model_route_for(detail).get('model'), 'gpt-6.1-sol')


class ManagerReleaseTests(unittest.TestCase):
    def detail(self):
        return {'job': {'job_id':JOB_ID, 'business_id':'BIZ-003', 'status':'READY',
                       'approval_status':'APPROVED', 'available_at':'2026-09-30T17:20:00.611184+00:00'},
                'task': {'row_version':3043}, 'events': [{'event_type':'WORKFLOW_release_job',
                  'job_id':JOB_ID, 'business_id':'BIZ-003', 'agent_id':'AGT-01',
                  'created_at':'2026-09-30T17:20:00.596213+00:00',
                  'payload': {'profile_slug':'helena--grupo', 'request': {'profile':'helena--grupo',
                      'action':'release_job', 'payload': {'job_id':JOB_ID,'expected_task_version':3040}},
                      'response': {'job_id':JOB_ID, 'success':True, 'status':'READY'}}}]}

    def test_helena_release_bootstraps_marina_without_self_dispatch(self):
        self.assertTrue(dispatcher.has_current_release(self.detail()))

    def test_stale_or_cross_business_or_failed_release_cannot_authorize(self):
        for mutation in ('old', 'business', 'actor', 'response', 'version', 'draft'):
            with self.subTest(mutation=mutation):
                d=self.detail(); event=d['events'][0]
                if mutation=='old': event['created_at']='2026-09-29T17:20:00+00:00'
                if mutation=='business': event['business_id']='BIZ-002'
                if mutation=='actor': event['agent_id']='AGT-12'
                if mutation=='response': event['payload']['response']['success']=False
                if mutation=='version': d['task']['row_version']=3039
                if mutation=='draft': d['job']['status']='DRAFT'
                self.assertFalse(dispatcher.has_current_release(d))

if __name__ == "__main__":
    unittest.main()
