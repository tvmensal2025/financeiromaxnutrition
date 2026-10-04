import copy
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'services/helena-gateway/scripts'))
import hermes_fleet_program as fleet


class FleetTests(unittest.TestCase):
    def setUp(self):
        self.plan = json.loads((ROOT / 'docs/helena/programa-humano-digital-20261003.json').read_text(encoding='utf-8-sig'))
        self.details = {}
        for n, step in enumerate(self.plan['steps']):
            jid = 'JOB-HR-' + f'{n:032x}'
            step['job_id'] = jid
            self.details[jid] = {'job': {'job_id': jid, 'agent_id': step['agent_id'],
                'business_id': 'BIZ-003', 'status': 'READY', 'result_payload': {}}, 'events': []}

    def complete(self, jid):
        d = self.details[jid]
        d['job'].update(status='COMPLETED', result_payload={'review_pending': False,
            'reviewed_by': 'AGT-03', 'review_reason': 'checked', 'delivery': {'content': 'Actual result'}})
        d['evidence_records'] = [{'id': 'evidence'}]
        d['events'] = [{'event_type': 'WORKFLOW_review_delivery', 'agent_id': 'AGT-03',
            'payload': {'request': {'payload': {'reason': 'checked'}}}}]

    def test_offline_never_runs(self):
        def forbidden(*args):
            self.fail('Unexpected model invocation')
        r = fleet.advance(self.plan, self.details.__getitem__, forbidden)
        self.assertEqual(r['actions'], [])

    def test_dependency_and_single_action(self):
        first = self.plan['steps'][0]['job_id']
        def run(component, jid):
            self.assertEqual(jid, first)
            self.complete(jid)
            return {'status': 'COMPLETED'}
        r = fleet.advance(self.plan, self.details.__getitem__, run, execute=True)
        self.assertEqual(len(r['actions']), 1)
        self.assertEqual(r['job_id'], self.plan['steps'][1]['job_id'])

    def test_failure_stops_entire_batch(self):
        self.details[self.plan['steps'][-1]['job_id']]['job']['status'] = 'FAILED'
        r = fleet.advance(self.plan, self.details.__getitem__, execute=True)
        self.assertEqual(r['status'], 'NEEDS_ATTENTION')
        self.assertFalse(r['actions'])

    def test_foreign_company_rejected(self):
        self.details[self.plan['steps'][0]['job_id']]['job']['business_id'] = 'BIZ-002'
        with self.assertRaises(ValueError):
            fleet.inspect(self.plan, self.details.__getitem__)

    def test_no_false_completion_or_self_review(self):
        jid = self.plan['steps'][0]['job_id']
        self.complete(jid)
        self.details[jid]['job']['result_payload']['reviewed_by'] = 'AGT-01'
        self.assertEqual(fleet.inspect(self.plan, self.details.__getitem__)['status'], 'NEEDS_ATTENTION')

    def test_unknown_execution_never_retries(self):
        calls = []
        def run(*args):
            calls.append(args)
            return {'status': 'OUTCOME_UNKNOWN'}
        r = fleet.advance(self.plan, self.details.__getitem__, run, True, 6)
        self.assertEqual(len(calls), 1)
        self.assertEqual(r['status'], 'NEEDS_RECONCILIATION')

    def test_running_worker_blocks_new_execution(self):
        self.details[self.plan['steps'][0]['job_id']]['job']['status'] = 'RUNNING'
        self.assertEqual(fleet.inspect(self.plan, self.details.__getitem__)['status'], 'WAITING_EXECUTOR')

    def test_dependency_cycle_and_duplicate_binding_rejected(self):
        self.plan['steps'][0]['depends_on'] = [self.plan['steps'][-1]['agent_id']]
        with self.assertRaises(ValueError):
            fleet.validate(self.plan)

    def test_missing_binding_requests_helena(self):
        self.plan['steps'][0]['job_id'] = None
        r = fleet.inspect(self.plan, self.details.__getitem__)
        self.assertEqual(r['status'], 'NEEDS_HELENA_BINDING')


if __name__ == '__main__':
    unittest.main()
