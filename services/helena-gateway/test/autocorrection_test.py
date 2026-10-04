import copy
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
import hermes_autocorrection as repair
import hermes_dispatch_once as dispatch

JID = 'JOB-HR-' + 'a' * 32


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.config = {'enabled': True, 'business_id': 'BIZ-003', 'adopt_job_ids': [JID]}
        self.detail = {'job': {'job_id': JID, 'business_id': 'BIZ-003', 'agent_id': 'AGT-17',
            'status': 'FAILED', 'attempt_count': 1, 'max_attempts': 2, 'error_code': 'HERMES_PROCESS_FAILED',
            'error_message': repair.TIMEOUT, 'updated_at': '2026-10-03', 'result_payload': {}, 'evidence_refs': []},
            'task': {'row_version': 1}, 'events': [], 'evidence_records': [], 'artifact_records': []}

    def test_dry_run_does_not_mutate(self):
        result = repair.advance(self.config, lambda _: self.detail, lambda *_: self.fail('write'))
        self.assertEqual(result['status'], 'RECOVERY_ELIGIBLE')

    def test_recovery_preserves_job_attempt_and_stops_before_model(self):
        calls = []
        def call(name, payload):
            calls.append((name, payload))
            self.detail['job']['status'] = 'DRAFT'
            self.detail['job']['result_payload']['recovery_recipe'] = repair.RECIPE
            return {'success': True}
        result = repair.advance(self.config, lambda _: self.detail, call, True)
        self.assertEqual(result['status'], 'RECOVERED_TO_COORDINATION')
        self.assertFalse(result['model_started'])
        self.assertEqual(calls[0][0], 'resolve_job_block')
        self.assertEqual(calls[0][1]['job_id'], JID)
        repair.advance(self.config, lambda _: self.detail, call, True)
        self.assertEqual(len(calls), 1)

    def test_wrong_company_exhausted_visual_running_and_unknown_are_never_retried(self):
        for field, value in [('business_id','BIZ-002'), ('attempt_count',2), ('agent_id','AGT-12'),
                             ('status','RUNNING'), ('error_message','UNKNOWN'), ('max_attempts',1)]:
            with self.subTest(field=field):
                d = copy.deepcopy(self.detail); d['job'][field] = value
                self.assertFalse(repair.eligible(d, 'BIZ-003'))

    def test_delivery_evidence_artifacts_and_prior_recovery_stop_retry(self):
        for field in ('artifact_records', 'evidence_records', 'evidence_missing'):
            d = copy.deepcopy(self.detail); d[field] = ['existing']
            self.assertFalse(repair.eligible(d, 'BIZ-003'))
        self.detail['job']['result_payload']['delivery'] = {}
        self.assertFalse(repair.eligible(self.detail, 'BIZ-003'))
        self.detail['job']['result_payload'] = {}
        self.detail['events'] = [{'event_type': 'WORKFLOW_resolve_job_block', 'payload': {'previous_status':'FAILED'}}]
        self.assertFalse(repair.eligible(self.detail, 'BIZ-003'))

    def test_lost_response_is_not_retried_in_same_tick(self):
        calls = []
        def call(*args):
            calls.append(args); raise TimeoutError()
        with self.assertRaises(TimeoutError):
            repair.advance(self.config, lambda _: self.detail, call, True)
        self.assertEqual(len(calls), 1)

    def test_model_escalation_requires_scoped_audit_event(self):
        self.detail['job']['result_payload'] = {'recovery_recipe': repair.RECIPE}
        self.assertEqual(dispatch.model_route_for(self.detail)['status'], 'PROFILE_DEFAULT')
        event = {'event_type':'WORKFLOW_resolve_job_block', 'job_id':JID, 'business_id':'BIZ-003',
                 'agent_id':'AGT-01', 'payload':{'previous_status':'FAILED', 'recipe':repair.RECIPE}}
        self.detail['events'] = [event]
        self.assertEqual(dispatch.model_route_for(self.detail)['model'], 'gpt-6.1-sol')
        event['business_id'] = 'BIZ-002'
        self.assertEqual(dispatch.model_route_for(self.detail)['status'], 'PROFILE_DEFAULT')

    def test_future_discovery_is_scoped_and_bounded(self):
        config = {**self.config, 'new_jobs_after': '2026-10-03T08:56:01Z'}
        def call(name, payload):
            self.assertEqual(name, 'queue_attention')
            self.assertEqual(payload['created_after'], config['new_jobs_after'])
            return {'success': True, 'candidates': [
                {**self.detail['job'], 'job_id': 'JOB-HR-' + 'b' * 32},
                {**self.detail['job'], 'business_id': 'BIZ-002', 'job_id': 'JOB-HR-' + 'c' * 32}]}
        result = repair.discover(config, call)
        self.assertEqual(result['adopt_job_ids'], [JID, 'JOB-HR-' + 'b' * 32])

    def test_discovery_continues_after_full_page_without_replaying_old_backlog(self):
        config = {**self.config, 'new_jobs_after': '2026-10-03T08:56:01Z', 'discovery_cursor': 'cursor-1'}
        def call(name, payload):
            self.assertEqual(payload['after_job_id'], 'cursor-1')
            return {'success': True, 'candidates': [], 'next_cursor': 'cursor-2'}
        result = repair.discover(config, call)
        self.assertEqual(result['discovery_cursor'], 'cursor-2')

    def test_disabled_discovery_does_not_read_or_write_queue(self):
        result = repair.discover({**self.config, 'enabled': False, 'new_jobs_after': 'now'},
                                 lambda *_: self.fail('Queue should not be called'))
        self.assertFalse(result['enabled'])


if __name__ == '__main__':
    unittest.main()
