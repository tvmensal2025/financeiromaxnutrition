import contextlib
import io
from pathlib import Path
import sys
import tempfile
import unittest
import yaml
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import install_visual_runtime_fix as installer


class VisualRuntimeInstallerTests(unittest.TestCase):
    def fixture(self, home):
        runtime = home / 'helena-runtime'; runtime.mkdir()
        for name in ('creative_quality.py', 'hermes_visual.py', 'hermes_mcp_preflight.py', 'hermes_dispatch_once.py'):
            (runtime / name).write_text('# Previous runtime\n')
        profile = home / 'profiles/maya--biz003'; profile.mkdir(parents=True)
        (profile / '.env').write_text('HELENA_GATEWAY_PROFILE_TOKEN=hhs_' + 'P' * 40 + '\n')
        (profile / 'config.yaml').write_text(yaml.safe_dump({'model': 'preserved', 'mcp_servers': {
            'helena_operacao': {'url': 'preserved'}, 'helena_visual': {
                'command': '/opt/hermes/.venv/bin/python',
                'args': ['/data/helena-runtime/hermes_visual.py'], 'enabled': True,
                'timeout': 300, 'connect_timeout': 20,
                'tools': {'include': ['generate_design'], 'prompts': False}}}}))
        return profile

    def test_scoped_upgrade_is_backed_up_and_replay_does_not_write(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            home = Path(directory); profile = self.fixture(home)
            original = (profile / 'config.yaml').read_bytes()
            credentials = (profile / '.env').read_bytes()
            result = installer.install(home)
            self.assertEqual(result['changed_files'], 5)
            backup = Path(result['backup']) / 'profiles/maya--biz003/config.yaml'
            self.assertEqual(backup.read_bytes(), original)
            updated = yaml.safe_load((profile / 'config.yaml').read_text())
            self.assertEqual(updated['model'], 'preserved')
            self.assertEqual(updated['mcp_servers']['helena_operacao'], {'url': 'preserved'})
            self.assertEqual((profile / '.env').read_bytes(), credentials)
            self.assertEqual(installer.install(home)['changed_files'], 0)

    def test_divergent_connector_blocks_before_runtime_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory); profile = self.fixture(home)
            path = profile / 'config.yaml'; config = yaml.safe_load(path.read_text())
            config['mcp_servers']['helena_visual']['command'] = '/different/command'
            path.write_text(yaml.safe_dump(config))
            before = {p: p.read_bytes() for p in home.rglob('*') if p.is_file()}
            with self.assertRaises(ValueError): installer.install(home)
            self.assertEqual(before, {p: p.read_bytes() for p in before})


if __name__ == '__main__': unittest.main()
