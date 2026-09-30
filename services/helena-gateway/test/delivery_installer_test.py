import contextlib
import io
from pathlib import Path
import sys
import tempfile
import unittest
import yaml
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import install_delivery_contract as installer

class InstallerTests(unittest.TestCase):
    def setup_home(self, home):
        (home / 'helena-runtime').mkdir()
        for profile in installer.PROFILES:
            root = home / 'profiles' / profile; root.mkdir(parents=True)
            tools = [n for n in installer.profile_tools(profile) if n != 'submit_work']
            (root / 'config.yaml').write_text(yaml.safe_dump({'model': 'unchanged', 'mcp_servers': {
                'helena_operacao': {'url': installer.URL, 'enabled': True, 'headers': {'Authorization': 'unchanged'},
                                   'tools': {'include': tools}}}}))
            (root / 'SOUL.md').write_text('Existing professional role.\n')
            (root / '.env').write_text('unchanged credentials')

    def test_all_profiles_equivalent_adapter_only_and_replay(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            home = Path(directory); self.setup_home(home)
            result = installer.install(home); self.assertEqual(result['profiles_checked'], 21)
            before = {p: p.read_bytes() for p in (home / 'profiles').rglob('*') if p.is_file()}
            self.assertEqual(installer.install(home)['changed_files'], 0)
            self.assertEqual(before, {p: p.read_bytes() for p in before})
            for profile in installer.PROFILES:
                root = home / 'profiles' / profile; config = yaml.safe_load((root / 'config.yaml').read_text())
                self.assertEqual(config['mcp_servers']['helena_operacao']['tools']['include'], installer.profile_tools(profile))
                self.assertEqual(config['model'], 'unchanged')
                self.assertEqual((root / '.env').read_text(), 'unchanged credentials')
            self.assertEqual((home / 'profiles/laura--pessoal/SOUL.md').read_text(), 'Existing professional role.\n')

    def test_divergent_final_profile_prevents_every_write(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory); self.setup_home(home)
            path = home / 'profiles' / installer.PROFILES[-1] / 'config.yaml'
            config = yaml.safe_load(path.read_text()); config['mcp_servers']['helena_operacao']['tools']['include'].append('admin_sql')
            path.write_text(yaml.safe_dump(config))
            before = {p: p.read_bytes() for p in home.rglob('*') if p.is_file()}
            with self.assertRaises(ValueError): installer.install(home)
            self.assertEqual(before, {p: p.read_bytes() for p in before})
            self.assertEqual(list((home / 'helena-runtime').iterdir()), [])

if __name__ == '__main__': unittest.main()
