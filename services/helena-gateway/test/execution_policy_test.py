import copy
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from execution_policy import execution_timeout, coordination_blocker, toolsets_for, native_tools_note, _ROLE_TOOLSETS, complexity_tier, SELF_REVIEW_CHECKLIST


class ExecutionPolicyTests(unittest.TestCase):
    def test_budgets_are_bounded_and_correction_does_not_use_fast_tier(self):
        self.assertEqual(execution_timeout('isabela--biz003', 'correction', 'correction'), 900)
        self.assertEqual(execution_timeout('caio--biz003', 'fast', 'correction'), 900)
        self.assertEqual(execution_timeout('maya--biz003', 'correction', 'correction'), 900)
        self.assertEqual(execution_timeout('isabela--biz003', None, 'correction'), 900)

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


class ToolsetTests(unittest.TestCase):
    def test_role_toolsets_are_bounded_and_ordered(self):
        self.assertEqual(toolsets_for('pedro--biz003'), 'helena_operacao,skills,todo,web')
        self.assertEqual(toolsets_for('pedro--biz003', coordination=True), 'helena_operacao,helena_contracts,skills,todo,web')
        self.assertEqual(toolsets_for('maya--biz003'), 'helena_operacao,helena_visual,skills,todo,vision')
        self.assertEqual(toolsets_for('caio--biz003'), 'helena_operacao,skills,todo')
        self.assertEqual(toolsets_for('bruno--biz003'), 'helena_operacao,skills,todo,web,vision')

    def test_no_profile_receives_execution_or_file_tools(self):
        self.assertEqual(len(_ROLE_TOOLSETS), 21)
        for agent in _ROLE_TOOLSETS:
            names = set(toolsets_for(agent + '--biz003').split(','))
            self.assertFalse(names & {'terminal', 'file', 'code_execution', 'browser', 'delegation', 'memory'}, agent)


class NativeToolNoteTests(unittest.TestCase):
    def test_note_names_real_native_tools_per_role(self):
        ravi = native_tools_note('ravi--biz003')
        self.assertIn('web_search', ravi)
        self.assertNotIn('vision_analyze', ravi)
        self.assertIn('NAO aparecem no tool_search', ravi)
        bruno = native_tools_note('bruno--biz003')
        self.assertIn('vision_analyze', bruno)
        caio = native_tools_note('caio--biz003')
        self.assertNotIn('web_search', caio)
        self.assertIn('skills_list', caio)



class ComplexityAndSelfReviewTests(unittest.TestCase):
    def test_analytic_roles_and_long_briefs_start_on_moderate(self):
        self.assertEqual(complexity_tier('AGT-04', 'x', 'y'), 'MODERATE')
        self.assertEqual(complexity_tier('AGT-18', 'x' * 100, 'y' * 1300), 'MODERATE')
        self.assertEqual(complexity_tier('AGT-18', 'x' * 5200, 'y'), 'MODERATE')
        self.assertEqual(complexity_tier('AGT-17', 'x' * 3000, 'y' * 600), 'SIMPLE')

    def test_checklist_covers_real_rejection_causes_and_forbids_loops(self):
        for needle in ('definicao de pronto', 'HIPOTESE', 'summary', 'JOB-HR', 'a definir', 'plano no lugar', 'get_visual_asset', 'nao reescreva em laco'):
            self.assertIn(needle, SELF_REVIEW_CHECKLIST)


if __name__ == '__main__':
    unittest.main()
