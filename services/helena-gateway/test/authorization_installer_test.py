import contextlib
import io
from pathlib import Path
import sys
import tempfile
import unittest
import yaml
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import install_authorization_fix as install


class InstallerTests(unittest.TestCase):
    def setup_home(self,home):
        (home/'helena-runtime').mkdir()
        for profile in install.PROFILES:
            path=home/'profiles'/profile;path.mkdir(parents=True)
            include=install.profile_tools(profile)
            if profile not in ('helena--grupo','marina--biz003','laura--pessoal'):
                include+=['create_task_job','release_job']
            (path/'config.yaml').write_text(yaml.safe_dump({'model':'preserved-model','mcp_servers':{'helena_operacao':{
                'url':install.URL,'enabled':True,'headers':{'Authorization':'reference-unchanged'},'tools':{'include':include}}}}))
            (path/'.env').write_text('credential unchanged')

    def test_narrows_18_profiles_preserves_keys_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory,contextlib.redirect_stdout(io.StringIO()):
            home=Path(directory);self.setup_home(home);install.install(home)
            before={p:p.read_bytes() for p in (home/'profiles').rglob('*') if p.is_file()}
            install.install(home)
            self.assertEqual(before,{p:p.read_bytes() for p in before})
            for profile in install.PROFILES:
                config=yaml.safe_load((home/'profiles'/profile/'config.yaml').read_text())
                self.assertEqual(config['model'],'preserved-model')
                self.assertEqual(config['mcp_servers']['helena_operacao']['tools']['include'],install.profile_tools(profile))
                self.assertEqual((home/'profiles'/profile/'.env').read_text(),'credential unchanged')

    def test_mismatch_last_profile_prevents_all_writes(self):
        with tempfile.TemporaryDirectory() as directory:
            home=Path(directory);self.setup_home(home)
            path=home/'profiles'/install.PROFILES[-1]/'config.yaml'
            config=yaml.safe_load(path.read_text());config['mcp_servers']['helena_operacao']['url']='https://wrong.invalid'
            path.write_text(yaml.safe_dump(config))
            before={p:p.read_bytes() for p in home.rglob('*') if p.is_file()}
            with self.assertRaises(ValueError):install.install(home)
            self.assertEqual(before,{p:p.read_bytes() for p in before})
            self.assertEqual(list((home/'helena-runtime').iterdir()),[])

if __name__=='__main__':unittest.main()
