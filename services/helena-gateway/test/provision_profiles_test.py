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
                self.assertIn('EXISTING_SETTING=fixture-preserve', (folder / '.env').read_text())
                self.assertEqual((folder / 'SOUL.md').read_text(encoding='utf-8').count(module.MARKER), 1)
            self.assertNotIn('hhs_', log.getvalue())

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
