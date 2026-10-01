import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from hermes_queue_watchdog import scan

JOB = 'JOB-HR-' + 'a' * 32


class WatchdogTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        home = self.root / 'profiles' / 'helena--grupo'
        home.mkdir(parents=True)
        (home / '.env').write_text('HELENA_GATEWAY_PROFILE_TOKEN=hhs_' + 'a' * 40)
        self.config = {'new_jobs_after': '2026-09-30T00:00:00Z', 'adopt_job_ids': []}
        (self.root / 'workflow-config.json').write_text(json.dumps(self.config))
        self.job = {'job_id': JOB, 'task_id': 'TSK', 'business_id': 'BIZ-003', 'agent_id': 'AGT-04',
                    'created_at': '2026-10-01T00:00:00Z', 'updated_at': '2026-10-01T01:00:00Z',
                    'status': 'FAILED', 'attention_kind': 'FAILURE', 'attempt_count': 1, 'max_attempts': 2}
        self.calls = []

    def request(self, gateway, token, name, args):
        self.calls.append((name, args))
        if name == 'queue_attention':
            return {'success': True, 'candidates': [copy.deepcopy(self.job)], 'next_cursor': None}
        if name == 'record_queue_attention':
            return {'success': True, 'jobs_changed': False}
        self.fail('Unexpected paid call or job mutation: ' + name)

    def test_failed_job_is_found_without_any_retry(self):
        original = copy.deepcopy(self.job)
        result = scan(self.root, self.root / 'profiles', True, self.request)
        self.assertEqual(result['recorded'], 1)
        self.assertEqual(result['findings'][0]['technical_agent_id'], 'AGT-09')
        self.assertFalse(result['automatic_retry'])
        self.assertEqual(self.job, original)

    def test_same_snapshot_uses_same_key_after_restart(self):
        for _ in range(2):
            scan(self.root, self.root / 'profiles', True, self.request)
        writes = [args for name, args in self.calls if name == 'record_queue_attention']
        self.assertEqual(writes[0], writes[1])

    def test_dry_run_has_no_writes_or_cursor_change(self):
        result = scan(self.root, self.root / 'profiles', False, self.request)
        self.assertEqual(result['recorded'], 0)
        self.assertEqual([name for name, _ in self.calls], ['queue_attention'])
        self.assertFalse((self.root / 'queue-watchdog-state.json').exists())

    def test_legacy_job_is_not_implicitly_adopted(self):
        self.job['created_at'] = '2020-01-01T00:00:00Z'
        self.assertFalse(scan(self.root, self.root / 'profiles', True, self.request)['findings'])

    def test_review_even_at_attempt_limit_still_belongs_to_reviewer(self):
        self.job.update(status='WAITING_HELENA', attention_kind='PENDING_REVIEW', attempt_count=2)
        self.assertFalse(scan(self.root, self.root / 'profiles', True, self.request)['findings'])

    def test_unknown_result_does_not_advance_cursor(self):
        def lost(gateway, token, name, args):
            if name == 'record_queue_attention':
                raise OSError('Response lost')
            return self.request(gateway, token, name, args)
        with self.assertRaises(OSError):
            scan(self.root, self.root / 'profiles', True, lost)
        self.assertFalse((self.root / 'queue-watchdog-state.json').exists())

    def test_pagination_is_bounded_and_next_poll_resumes(self):
        def many(gateway, token, name, args):
            if name == 'queue_attention':
                cursor = args.get('after_job_id', '0')
                return {'success': True, 'candidates': [], 'next_cursor': str(int(cursor) + 1)}
            return self.request(gateway, token, name, args)
        result = scan(self.root, self.root / 'profiles', True, many, max_pages=2)
        self.assertTrue(result['has_more'])
        self.assertEqual(json.loads((self.root / 'queue-watchdog-state.json').read_text())['cursor'], '2')


if __name__ == '__main__':
    unittest.main()
