import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location('quality_protocol', ROOT / 'scripts' / 'apply_quality_protocol.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
registry = ROOT / 'src' / 'agent-quality-contracts.json'
PROFILES = ['helena--grupo','laura--pessoal','augusto--biz003','marina--biz003','caio--biz003','clara--biz003','bianca--biz003','daniel--biz003','theo--biz003','nina--biz003','ravi--biz003','maya--biz003','bruno--biz003','olivia--biz003','victor--biz003','camila--biz003','isabela--biz003','pedro--biz003','renata--biz003','joana--biz003','felipe--biz003']

class QualityProtocolTest(unittest.TestCase):
    def profiles(self, home):
        for profile in PROFILES:
            folder=home/'profiles'/profile
            folder.mkdir(parents=True)
            (folder/'SOUL.md').write_text('Missao original preservada\n',encoding='utf-8')
            (folder/'config.yaml').write_text('model: fixture\n',encoding='utf-8')
            (folder/'.env').write_text('FIXTURE_SETTING=not-a-secret\n',encoding='utf-8')

    def test_backup_idempotence_and_no_configuration_or_credential_changes(self):
        with tempfile.TemporaryDirectory() as folder,contextlib.redirect_stdout(io.StringIO()) as log:
            home=Path(folder);self.profiles(home)
            module.run(home,registry)
            self.assertFalse((home/'helena-runtime').exists())
            module.run(home,registry,True)
            before={p:(home/'profiles'/p/'SOUL.md').read_bytes() for p in PROFILES}
            module.run(home,registry,True)
            for p in PROFILES:
                path=home/'profiles'/p
                self.assertEqual(before[p],(path/'SOUL.md').read_bytes())
                self.assertEqual((path/'SOUL.md').read_text(encoding='utf-8').count(module.START),1)
                self.assertIn('Missao original preservada',(path/'SOUL.md').read_text(encoding='utf-8'))
                self.assertEqual((path/'config.yaml').read_text(),'model: fixture\n')
                self.assertEqual((path/'.env').read_text(),'FIXTURE_SETTING=not-a-secret\n')
            manifest=json.loads((home/'helena-runtime'/'quality-manifest.json').read_text())
            self.assertEqual(manifest['profiles'],21);self.assertEqual(manifest['ai_calls'],0)
            self.assertEqual(manifest['updated'],0)
            self.assertNotIn('FIXTURE_SETTING',log.getvalue())

    def test_all_profiles_preflight_before_first_write(self):
        with tempfile.TemporaryDirectory() as folder:
            home=Path(folder);self.profiles(home)
            (home/'profiles'/PROFILES[-1]/'SOUL.md').rename(home/'profiles'/PROFILES[-1]/'SOUL.original')
            with self.assertRaises(ValueError):module.run(home,registry,True)
            self.assertEqual((home/'profiles'/PROFILES[0]/'SOUL.md').read_text(encoding='utf-8'),'Missao original preservada\n')
            self.assertFalse((home/'helena-runtime').exists())

if __name__=='__main__':unittest.main()
