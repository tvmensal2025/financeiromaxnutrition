import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('editorial', ROOT/'scripts/install_editorial_policy.py')
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)
SKILL = ROOT/'editorial-skills/helena-editorial-quality/SKILL.md'

class EditorialPolicyTest(unittest.TestCase):
    def fixture(self, home):
        hashes = {}
        for slug in (*policy.PROFILES, 'laura--pessoal'):
            root = home/'profiles'/slug
            root.mkdir(parents=True)
            (root/'SOUL.md').write_text('Original role; preserve permissions.\n', encoding='utf-8')
            (root/'config.yaml').write_text('model: unchanged\n', encoding='utf-8')
            hashes[slug] = policy.digest((root/'SOUL.md').read_bytes())
        (home/'helena-runtime').mkdir()
        (home/'helena-runtime/quality-manifest.json').write_text(json.dumps({'soul_hashes':hashes,'other':'preserve'}))

    def test_scoped_install_preserves_other_roles_and_repeat_receipt(self):
        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp); self.fixture(home)
            before = {p:p.read_bytes() for p in home.rglob('*') if p.is_file()}
            self.assertEqual(policy.install(home, SKILL)['status'], 'PREFLIGHT')
            self.assertTrue(all(p.read_bytes()==data for p,data in before.items()))
            result = policy.install(home, SKILL, True)
            self.assertEqual(result['changed_files'], 12)
            self.assertFalse(result['real_campaign_tested'])
            for slug in policy.PROFILES:
                soul = home/'profiles'/slug/'SOUL.md'
                self.assertTrue(soul.read_bytes().startswith(before[soul].rstrip()))
                self.assertEqual(policy.digest(soul.read_bytes()),result['soul_hashes'][slug])
            preserved = [p for p in before if p.name=='config.yaml' or 'laura--pessoal' in str(p)]
            self.assertTrue(all(p.read_bytes()==before[p] for p in preserved))
            receipt = home/'helena-runtime/editorial-policy-receipt.json'
            original = receipt.read_bytes()
            self.assertEqual(policy.install(home, SKILL, True)['status'], 'UNCHANGED')
            self.assertEqual(receipt.read_bytes(), original)

    def test_manifest_drift_stops_before_any_write(self):
        with tempfile.TemporaryDirectory() as temp:
            home=Path(temp); self.fixture(home)
            (home/'profiles'/policy.PROFILES[-1]/'SOUL.md').write_text('Concurrent change')
            before={p:p.read_bytes() for p in home.rglob('*') if p.is_file()}
            with self.assertRaisesRegex(ValueError,'SOUL_CHANGED'):
                policy.install(home, SKILL, True)
            self.assertEqual(before,{p:p.read_bytes() for p in home.rglob('*') if p.is_file()})

    def test_receipt_failure_rolls_back_profiles_and_manifest(self):
        with tempfile.TemporaryDirectory() as temp:
            home=Path(temp); self.fixture(home)
            before={p:p.read_bytes() for p in home.rglob('*') if p.is_file()}
            write=Path.write_text
            def fail_receipt(path,*args,**kwargs):
                if path.name=='editorial-policy-receipt.json': raise OSError('receipt failure')
                return write(path,*args,**kwargs)
            with patch.object(Path,'write_text',fail_receipt):
                with self.assertRaisesRegex(OSError,'receipt failure'):
                    policy.install(home, SKILL, True)
            self.assertTrue(all(p.read_bytes()==data for p,data in before.items()))
            self.assertEqual(list((home/'profiles').rglob('SKILL.md')),[])

    def test_explicit_baseline_preserves_newer_instructions_and_rejects_stale_snapshot(self):
        with tempfile.TemporaryDirectory() as temp:
            home=Path(temp); self.fixture(home)
            soul=home/'profiles'/policy.PROFILES[0]/'SOUL.md'
            soul.write_text('Newer approved operational rules.\n')
            baseline={s:policy.digest((home/'profiles'/s/'SOUL.md').read_bytes()) for s in policy.PROFILES}
            result=policy.install(home, SKILL, True, baseline)
            self.assertEqual(result['preserved_manifest_drift'],[policy.PROFILES[0]])
            self.assertTrue(soul.read_text().startswith('Newer approved operational rules.'))
            with self.assertRaisesRegex(ValueError,'SOUL_CHANGED'):
                policy.install(home, SKILL, True, baseline)

if __name__=='__main__':
    unittest.main()
