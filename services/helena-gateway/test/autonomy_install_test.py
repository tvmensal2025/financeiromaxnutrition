import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
import yaml
SCRIPTS = Path(__file__).resolve().parents[1] / 'scripts'
sys.path.insert(0, str(SCRIPTS))
from install_autonomy import install
from configurar_perfis import PROFILES


class AutonomyInstallTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        runtime = self.home / 'helena-runtime'
        runtime.mkdir()
        for name in ('hermes_dispatch_once.py', 'hermes_workflow_tick.py'):
            shutil.copy2(SCRIPTS / name, runtime / name)
        self.original = {'model': {'name': 'unchanged-model'}, 'private_setting': 'sentinel',
                         'mcp_servers': {'helena_operacao': {'tools': {'include': ['get_job']}, 'env': {'EXISTING': 'sentinel'}}}}
        for profile in PROFILES:
            root = self.home / 'profiles' / profile
            root.mkdir(parents=True)
            (root / 'config.yaml').write_text(yaml.safe_dump(self.original))
            (root / 'SOUL.md').write_text('Existing role and scope.\n')

    def test_inventory_matches_canonical_roster(self):
        self.assertEqual(json.loads((SCRIPTS / 'autonomy-profiles.json').read_text()), PROFILES)

    def test_idempotent_and_preserves_roles_models_and_gateway_acl(self):
        result = install(self.home, SCRIPTS)
        self.assertEqual(result['profiles_checked'], 21)
        self.assertEqual(result['model_calls'], 0)
        for profile in PROFILES:
            config = yaml.safe_load((self.home / 'profiles' / profile / 'config.yaml').read_text())
            del config['mcp_servers']['helena_contracts']
            self.assertEqual(config, self.original)
            self.assertTrue((self.home / 'profiles' / profile / 'SOUL.md').read_text().startswith('Existing role and scope.'))
        self.assertEqual(install(self.home, SCRIPTS)['changed_files'], 0)

    def test_existing_connector_conflict_aborts_before_writes(self):
        path = self.home / 'profiles' / PROFILES[-1] / 'config.yaml'
        config = yaml.safe_load(path.read_text())
        config['mcp_servers']['helena_contracts'] = {'command': 'different'}
        path.write_text(yaml.safe_dump(config))
        with self.assertRaises(ValueError):
            install(self.home, SCRIPTS)
        self.assertFalse((self.home / 'helena-runtime' / 'brief_preflight.py').exists())
        self.assertEqual(yaml.safe_load((self.home / 'profiles' / PROFILES[0] / 'config.yaml').read_text()), self.original)


if __name__ == '__main__':
    unittest.main()
