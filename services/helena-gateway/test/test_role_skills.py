import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('installer',ROOT/'scripts/apply_role_skills.py')
installer=importlib.util.module_from_spec(spec); spec.loader.exec_module(installer)
PACKAGE=ROOT/'role-skills/package.json'
AGENTS=json.loads(PACKAGE.read_text(encoding='utf-8'))['agents']

class RoleSkillsTest(unittest.TestCase):
    def fixture(self,home):
        hashes={}
        for a in AGENTS:
            profile=home/'profiles'/a['profile_slug']; profile.mkdir(parents=True)
            (profile/'SOUL.md').write_text('Original mission '+a['agent_id']+'\n')
            (profile/'config.yaml').write_text('model: existing-model\nmcp_servers: {}\n')
            (profile/'.env').write_text('KEEP_EXISTING=true\n')
            base=profile/'skills'/'original'; base.mkdir(parents=True)
            (base/'SKILL.md').write_text('---\nname: original\ndescription: Keep this skill\n---\nExisting procedure\n')
            hashes[a['profile_slug']]=hashlib.sha256((profile/'SOUL.md').read_bytes()).hexdigest()
        runtime=home/'helena-runtime'; runtime.mkdir()
        (runtime/'quality-manifest.json').write_text(json.dumps({'soul_hashes':hashes}))

    def run_install(self,home):
        with contextlib.redirect_stdout(io.StringIO()): installer.run(home,PACKAGE,True)

    def test_preserves_config_env_original_skills_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as temp:
            home=Path(temp); self.fixture(home)
            preserve={p:p.read_bytes() for p in home.rglob('*') if p.is_file() and p.name!='SOUL.md' and p.name!='quality-manifest.json'}
            self.run_install(home)
            souls={p:p.read_bytes() for p in (home/'profiles').glob('*/SOUL.md')}
            receipt_path=home/'helena-runtime/role-skills-manifest.json'
            first_receipt=receipt_path.read_bytes()
            self.run_install(home)
            self.assertTrue(all(p.read_bytes()==b for p,b in preserve.items()))
            self.assertTrue(all(p.read_bytes()==b for p,b in souls.items()))
            receipt=json.loads((home/'helena-runtime/role-skills-manifest.json').read_text())
            self.assertEqual(receipt['role_skills_verified'],21)
            self.assertEqual(receipt_path.read_bytes(),first_receipt)
            self.assertEqual(receipt['changed_files'],42)
            self.assertTrue(Path(receipt['backup']).is_dir())
            self.assertEqual(receipt['skill_files_total'],42)
            self.assertFalse(receipt['real_business_tasks_tested'])

    def test_changed_last_profile_prevents_all_writes(self):
        with tempfile.TemporaryDirectory() as temp:
            home=Path(temp); self.fixture(home)
            last=home/'profiles'/AGENTS[-1]['profile_slug']/'SOUL.md'; last.write_text('External change')
            before={p:p.read_bytes() for p in home.rglob('*') if p.is_file()}
            with self.assertRaisesRegex(ValueError,'SOUL_CHANGED'):
                self.run_install(home)
            self.assertTrue(all(p.read_bytes()==b for p,b in before.items()))
            self.assertEqual(len(list((home/'profiles').rglob('SKILL.md'))),21)

    def test_post_install_failure_restores_souls_manifest_and_skills(self):
        with tempfile.TemporaryDirectory() as temp:
            home=Path(temp); self.fixture(home)
            before={p:p.read_bytes() for p in home.rglob('*') if p.is_file()}
            original=installer.inventory; calls=0
            def failing(profile):
                nonlocal calls
                calls+=1
                if calls==22: raise RuntimeError('simulated verification failure')
                return original(profile)
            with patch.object(installer,'inventory',side_effect=failing):
                with self.assertRaisesRegex(RuntimeError,'simulated'):
                    self.run_install(home)
            self.assertTrue(all(p.read_bytes()==b for p,b in before.items()))
            self.assertEqual(len(list((home/'profiles').rglob('SKILL.md'))),21)

if __name__=='__main__': unittest.main()
