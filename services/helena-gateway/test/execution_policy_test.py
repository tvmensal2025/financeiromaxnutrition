import copy
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from execution_policy import execution_timeout, coordination_blocker, toolsets_for, _ROLE_TOOLSETS


class ExecutionPolicyTests(unittest.TestCase):
    def test_budgets_are_bounded_and_correction_does_not_use_fast_tier(self):
        self.assertEqual(execution_timeout('isabela--biz003', 'correction', 'correction'), 600)
        self.assertEqual(execution_timeout('caio--biz003', 'fast', 'correction'), 600)
        self.assertEqual(execution_timeout('maya--biz003', 'correction', 'correction'), 900)
        self.assertEqual(execution_timeout('isabela--biz003', None, 'correction'), 600)

    def test_same_missing_source_after_correction_stops_without_state_change(self):
        d = {'job': {'status':'DRAFT', 'attempt_count':1, 'result_payload': {
            'reviewed_by':'AGT-16', 'review_reason':'Add alternatives',
            'brief_revision_history':[{'reviewed_by':'AGT-16','review_reason':'Add alternatives'}]}},
            'input_evidence_missing':['MEM-X']}
        before = copy.deepcopy(d)
        self.assertEqual(coordination_blocker(d), 'CORRECTED_BRIEF_INPUTS_UNAVAILABLE')
        self.assertEqual(d, before)
        d['input_evidence_missing'] = []
        self.assertIsNone(coordination_blocker(d))
        d['input_evidence_missing'] = ['MEM-X']
        d['job']['result_payload']['review_reason'] = 'New independent review'
        self.assertIsNone(coordination_blocker(d))
