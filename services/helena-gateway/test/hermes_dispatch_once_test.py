"""No network or model invocation: contract tests for the opt-in dispatcher."""

import importlib.util
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
            "external_agent_id": PROFILE,
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
                "runtime_binding": {"profile_slug": PROFILE, "status": self.binding_status},
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

    def run_agent(self, binary, profile, job_id, timeout):
        self.model_calls.append((binary, profile, job_id, timeout))
        self.job_status = "WAITING_HELENA"
        return 0

    def dispatch(self, job_id=JOB_ID, execute=False, run_agent=None):
        return dispatcher.dispatch_once(
            self.root, dispatcher.GATEWAY, job_id, execute,
            run_agent=run_agent or self.run_agent, request=self.request,
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


if __name__ == "__main__":
    unittest.main()
