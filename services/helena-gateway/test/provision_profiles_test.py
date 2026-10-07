import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('provision', Path(__file__).parents[1] / 'scripts' / 'configurar_perfis.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ProvisionTest(unittest.TestCase):
    def make_profiles(self, home):
        for profile in module.PROFILES:
            folder = home / 'profiles' / profile
            folder.mkdir(parents=True)
            (folder / 'config.yaml').write_text('model:\n  default: fixture-model\nkanban:\n  dispatch_in_gateway: false\n', encoding='utf-8')
            (folder / '.env').write_text('EXISTING_SETTING=fixture-preserve\n', encoding='utf-8')
            (folder / 'SOUL.md').write_text('Existing mission\n', encoding='utf-8')

    def test_dry_run_and_idempotent_apply_preserve_existing_settings(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()) as log:
            home = Path(directory)
            self.make_profiles(home)
            module.run(home)
            self.assertFalse((home / 'helena-runtime').exists())
            module.run(home, True)
            before = (home / 'helena-runtime' / 'manifest-publico.json').read_text()
            module.run(home, True)
            self.assertEqual(before, (home / 'helena-runtime' / 'manifest-publico.json').read_text())
            self.assertEqual(len({row['token_sha256'] for row in json.loads(before)}), 21)
            for profile in module.PROFILES:
                folder = home / 'profiles' / profile
                config = module.yaml.safe_load((folder / 'config.yaml').read_text())
                self.assertEqual(config['model']['default'], 'fixture-model')
                self.assertFalse(config['kanban']['dispatch_in_gateway'])
                self.assertIs(config['parallel'], False)
                self.assertIn('EXISTING_SETTING=fixture-preserve', (folder / '.env').read_text())
                self.assertEqual((folder / 'SOUL.md').read_text(encoding='utf-8').count(module.MARKER), 1)
                included = config['mcp_servers']['helena_operacao']['tools']['include']
                if profile in ('helena--grupo', 'marina--biz003'):
                    self.assertIn('adopt_existing_task', included)
                else:
                    self.assertNotIn('adopt_existing_task', included)
                self.assertEqual('record_dispatch' in included, profile == 'marina--biz003')
                self.assertEqual('revise_task_brief' in included, profile in ('helena--grupo', 'marina--biz003'))
                self.assertEqual('create_artifact_upload' in included, profile == 'maya--biz003')
                self.assertEqual('verify_artifact_upload' in included, profile == 'maya--biz003')
                if profile == 'laura--pessoal':
                    self.assertEqual(included, ['get_work_context'])
            self.assertNotIn('hhs_', log.getvalue())

    def test_old_filter_upgrade_preserves_key_and_rejects_other_changes(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            home = Path(directory)
            self.make_profiles(home)
            module.run(home, True)
            manifest = (home / 'helena-runtime' / 'manifest-publico.json').read_text()
            config_path = home / 'profiles' / 'pedro--biz003' / 'config.yaml'
            config = module.yaml.safe_load(config_path.read_text())
            config['mcp_servers']['helena_operacao']['tools']['include'] = module.TOOLS[:-2]
            config_path.write_text(module.yaml.safe_dump(config))
            module.run(home, True)
            self.assertEqual(manifest, (home / 'helena-runtime' / 'manifest-publico.json').read_text())
            upgraded = module.yaml.safe_load(config_path.read_text())
            self.assertEqual(upgraded['mcp_servers']['helena_operacao']['tools']['include'], module.EXECUTOR_TOOLS)
            upgraded['mcp_servers']['helena_operacao']['url'] = 'https://unexpected.invalid/mcp'
            config_path.write_text(module.yaml.safe_dump(upgraded))
            with self.assertRaises(ValueError):
                module.run(home, True)
            self.assertEqual(manifest, (home / 'helena-runtime' / 'manifest-publico.json').read_text())

    def test_coordinator_filter_upgrade_keeps_other_profiles_intact(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            home = Path(directory)
            self.make_profiles(home)
            module.run(home, True)
            manifest = (home / 'helena-runtime' / 'manifest-publico.json').read_text()
            for profile in ('helena--grupo', 'marina--biz003'):
                config_path = home / 'profiles' / profile / 'config.yaml'
                config = module.yaml.safe_load(config_path.read_text())
                config['mcp_servers']['helena_operacao']['tools']['include'] = [name for name in module.profile_tools(profile) if name not in ('revise_task_brief', 'replan_job')]
                config_path.write_text(module.yaml.safe_dump(config))
            module.run(home, True)
            self.assertEqual(manifest, (home / 'helena-runtime' / 'manifest-publico.json').read_text())
            for profile in ('helena--grupo', 'marina--biz003'):
                config = module.yaml.safe_load((home / 'profiles' / profile / 'config.yaml').read_text())
                self.assertEqual(config['mcp_servers']['helena_operacao']['tools']['include'], module.profile_tools(profile))

    def test_missing_profile_fails_before_any_change(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            self.make_profiles(home)
            last = home / 'profiles' / module.PROFILES[-1]
            last.rename(last.with_name('not-a-profile'))
            with self.assertRaises(ValueError):
                module.run(home, True)
            self.assertNotIn(module.KEY, (home / 'profiles' / module.PROFILES[0] / '.env').read_text())
            self.assertFalse((home / 'helena-runtime').exists())

if __name__ == '__main__':
    unittest.main()
