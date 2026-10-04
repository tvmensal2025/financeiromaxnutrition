import copy
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).parent))
import hermes_workflow_tick_test as fixtures
wf = fixtures.wf


class BoundedRecoveryTests(fixtures.CanonicalContinuityTests):
    def request(self, gateway, token, name, args):
        if name == 'workflow_checkpoint' and args['action'] == 'recover':
            run = self.remote_runs[args['fingerprint']]
            self.assertEqual(run.get('diagnostic'), 'REVIEW_CONTRACT_REJECTED')
            self.assertEqual(run.get('recovery_count', 0), 0)
            self.assertEqual(args['repair_version'], 'review-contract-v2')
            run.update(status='STARTED', recovery_count=1)
            return {'success': True, 'reserved': True, 'run': copy.deepcopy(run)}
        result = super().request(gateway, token, name, args)
        if name == 'workflow_checkpoint' and args['action'] == 'finish':
            for run in self.remote_runs.values():
                if run['run_id'] == args['run_id']:
                    run['diagnostic'] = args['diagnostic']
        return result

    def fail_known(self):
        self.d['review_contract'] = {'version': 'review-contract-v2', 'approval_fields_seed': {'verified_check_ids': ['C-123']}}
        original = self.runner
        def refused(*args):
            self.calls += 1
            return wf.RunResult(0, 'REVIEW_CONTRACT_REJECTED', 'fixture-session')
        self.runner = refused
        self.assertEqual(self.run_tick()['status'], 'NEEDS_ATTENTION')
        return original

    def test_known_rejection_recovers_once_and_records_actual_actor(self):
        self.runner = self.fail_known()
        report = self.run_tick()
        self.assertEqual(report['status'], 'CONFIRMED')
        self.assertEqual(report['recovery_count'], 1)
        self.assertEqual(self.calls, 2)

    def test_failed_repair_stops_and_exposes_actionable_problem(self):
        self.fail_known()
        self.assertEqual(self.run_tick()['status'], 'NEEDS_ATTENTION')
        report = self.run_tick()
        self.assertEqual(report['status'], 'WORKFLOW_NEEDS_ATTENTION')
        self.assertEqual(report['items'][0]['job_id'], fixtures.JOB)
        self.assertEqual(report['items'][0]['recovery_count'], 1)
        self.assertEqual(self.calls, 2)

    def test_gateway_without_new_contract_does_not_retry(self):
        self.fail_known()
        del self.d['review_contract']
        self.assertEqual(self.run_tick()['status'], 'WORKFLOW_NEEDS_ATTENTION')
        self.assertEqual(self.calls, 1)

    def test_receipt_refresh_preserves_session_exit_and_actor(self):
        self.fail_known()
        worker = self.worker()
        key = next(iter(self.remote_runs))
        worker.state['receipts'][key]['profile'] = 'augusto--biz003'
        worker.refresh_journal()
        receipt = worker.state['receipts'][key]
        self.assertEqual(receipt['profile'], 'augusto--biz003')
        self.assertEqual(receipt['coordinator_profile'], 'helena--grupo')
        self.assertEqual(receipt['exit_code'], 0)
        self.assertEqual(receipt['session_id'], 'fixture-session')

    def test_timeout_unknown_outcome_and_other_phase_never_recover(self):
        self.fail_known()
        worker = self.worker()
        receipt = next(iter(worker.state['receipts'].values()))
        for code in ('EXECUTION_TIMEOUT', 'UNCONFIRMED_EFFECT', 'DIAGNOSTIC_UNAVAILABLE'):
            self.assertFalse(worker.recoverable({**receipt, 'diagnostic': code}, self.d, 'REVIEW'))
        self.assertFalse(worker.recoverable(receipt, self.d, 'HANDOFF'))


class ScopedDiagnosticTests(unittest.TestCase):
    def test_only_current_session_final_tool_refusal_counts(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            with closing(sqlite3.connect(root / 'state.db')) as db:
                db.execute('create table messages(id integer primary key,session_id text,role text,content text,tool_name text,timestamp real)')
                db.executemany('insert into messages(session_id,role,content,tool_name,timestamp) values(?,?,?,?,?)', [
                    ('old', 'user', 'wf:abc', None, 1),
                    ('old', 'tool', '{"error":"REVIEW_CONTRACT_MISMATCH"}', 'review_delivery', 2),
                    ('new', 'user', 'wf:abc', None, 10),
                    ('new', 'tool', '{"error":"REVIEW_CONTRACT_MISMATCH"}', 'mcp__helena_operacao__review_delivery', 11)])
                db.commit()
            self.assertEqual(wf.review_diagnostic(root, 'wf:abc', 9), ('REVIEW_CONTRACT_REJECTED', 'new'))
            with closing(sqlite3.connect(root / 'state.db')) as db:
                db.execute('insert into messages(session_id,role,content,tool_name,timestamp) values(?,?,?,?,?)',
                           ('new','tool','{"success":true}','mcp__helena_operacao__review_delivery',12))
                db.commit()
            self.assertEqual(wf.review_diagnostic(root, 'wf:abc', 9), ('UNCONFIRMED_EFFECT','new'))
            self.assertEqual(wf.review_diagnostic(root, 'different', 9), ('UNCONFIRMED_EFFECT',None))


if __name__ == '__main__': unittest.main()
