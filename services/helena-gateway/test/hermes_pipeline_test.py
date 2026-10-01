import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from hermes_pipeline import advance


class PipelineTests(unittest.TestCase):
    def run_sequence(self, reports, **kwargs):
        calls = []
        def runner(component, execute):
            calls.append((component, execute))
            return reports[len(calls) - 1]
        return advance(runner=runner, **kwargs), calls

    def test_execute_review_handoff_release_and_next_executor_without_hourly_gaps(self):
        reports = [
            {'status': 'WAITING_HELENA'},
            {'status': 'CONFIRMED', 'next_phase': 'HANDOFF'},
            {'status': 'CONFIRMED', 'next_phase': 'RELEASE:child'},
            {'status': 'CONFIRMED', 'observed_status': 'READY'},
            {'status': 'WAITING_HELENA'},
            {'status': 'CONFIRMED', 'next_phase': 'HANDOFF'},
        ]
        result, calls = self.run_sequence(reports, execute=True)
        self.assertEqual([c[0] for c in calls], [
            'hermes_dispatch_once', 'hermes_workflow_tick', 'hermes_workflow_tick',
            'hermes_workflow_tick', 'hermes_dispatch_once', 'hermes_workflow_tick'])
        self.assertEqual(result['status'], 'PIPELINE_BOUNDED')

    def test_failures_limits_and_uncertain_results_never_retry(self):
        for status in ('FAILED', 'ALREADY_RUNNING', 'MCP_UNAVAILABLE', 'PROVIDER_LIMIT',
                       'ERROR', 'RECONCILE_REQUIRED', 'COMPONENT_ERROR'):
            with self.subTest(status=status):
                result, calls = self.run_sequence([{'status': status}], execute=True)
                self.assertEqual(len(calls), 1)
                self.assertFalse(result['automatic_retry'])

    def test_unchanged_review_stops_and_empty_queue_never_starts_models(self):
        result, calls = self.run_sequence([
            {'status': 'NO_APPROVED_READY_JOB'}, {'status': 'NO_NEW_REVIEW'}], execute=True)
        self.assertEqual(len(calls), 2)
        self.assertEqual(result['status'], 'PIPELINE_STOPPED')

    def test_review_rejection_continues_only_confirmed_coordinate_phase(self):
        result, calls = self.run_sequence([
            {'status': 'NO_DISPATCH_REQUEST'},
            {'status': 'CONFIRMED', 'next_phase': 'COORDINATE'},
            {'status': 'ATTEMPT_LIMIT'}], execute=True)
        self.assertEqual(len(calls), 3)
        self.assertEqual(result['steps'][-1]['status'], 'ATTEMPT_LIMIT')

    def test_dry_run_never_executes_followup(self):
        result, calls = self.run_sequence([{'status': 'DRY_RUN'}])
        self.assertEqual(calls, [('hermes_dispatch_once', False)])

    def test_action_budget_is_strict(self):
        for budget in (0, 7, True, -1):
            with self.assertRaises(ValueError): advance(max_actions=budget)


if __name__ == '__main__': unittest.main()
