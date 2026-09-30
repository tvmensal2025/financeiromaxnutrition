import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('probe', Path(__file__).parents[1] / 'scripts' / 'hermes_mcp_preflight.py')
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)

def discovered(names):
    return {'mcp__helena_operacao__' + name: {} for name in names}

class PreflightTest(unittest.TestCase):
    def test_coordinators_require_brief_revision_before_inference(self):
        for profile in ('helena--grupo', 'marina--biz003'):
            names = probe.required_tools(profile) - {'revise_task_brief'}
            report = probe.inspect_tools(profile, discovered(names))
            self.assertFalse(report['ready'])
            self.assertEqual(report['missing_tools'], ['revise_task_brief'])

    def test_count_cannot_hide_missing_dispatch(self):
        names = probe.required_tools('marina--biz003') - {'record_dispatch'}
        report = probe.inspect_tools('marina--biz003', discovered(names | {'irrelevant'}))
        self.assertGreater(report['tool_count'], 10)
        self.assertFalse(report['ready'])
        self.assertEqual(report['missing_tools'], ['record_dispatch'])

    def test_personal_profile_is_valid_with_context_only(self):
        self.assertTrue(probe.inspect_tools('laura--pessoal', discovered({'get_work_context'}))['ready'])

    def test_visual_agent_needs_both_artifact_tools(self):
        names = probe.required_tools('maya--biz003')
        self.assertFalse(probe.inspect_tools('maya--biz003', discovered(names - {'verify_artifact_upload'}))['ready'])
        self.assertTrue(probe.inspect_tools('maya--biz003', discovered(names))['ready'])

    def test_other_server_does_not_satisfy_contract(self):
        names = {'mcp__another__' + n: {} for n in probe.required_tools('pedro--biz003')}
        self.assertFalse(probe.inspect_tools('pedro--biz003', names)['ready'])

if __name__ == '__main__':
    unittest.main()
