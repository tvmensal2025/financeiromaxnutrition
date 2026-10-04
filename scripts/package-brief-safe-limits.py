import ast
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

repo=Path(__file__).resolve().parents[1]
src=repo/'services/helena-gateway/scripts'
old=repo/'artifacts/action-ownership-20261002-v2'
target=repo/'artifacts/brief-safe-limits-20261002'
target.mkdir(parents=True,exist_ok=True)
def module(path):
    scope={}
    exec(path.read_text(encoding='utf-8'),scope)
    return scope
package={'profiles':json.loads((src/'autonomy-profiles.json').read_text()),'runtime':{},
         'old_rule':module(old/'autonomy_protocol.py')['RULE'],
         'new_rule':module(src/'autonomy_protocol.py')['RULE'],
         'limits':module(src/'brief_preflight.py')['BRIEF_LIMITS']}
for name in ['brief_preflight.py','autonomy_protocol.py','hermes_workflow_tick.py']:
    before=(old/name).read_bytes() if (old/name).exists() else subprocess.check_output(['git','show','HEAD:services/helena-gateway/scripts/'+name],cwd=repo)
    before=before.replace(b'\r\n',b'\n')
    after=(src/name).read_bytes().replace(b'\r\n',b'\n')
    ast.parse(after.decode())
    package['runtime'][name]={'old_sha256':hashlib.sha256(before).hexdigest()}
    (target/name).write_bytes(after)
(target/'brief-safe-package.json').write_text(json.dumps(package,ensure_ascii=False),encoding='utf-8')
(target/'install_brief_safe_limits.py').write_bytes((src/'install_brief_safe_limits.py').read_bytes())
testdir=target/'test'
testdir.mkdir(exist_ok=True)
(testdir/'brief_preflight_test.py').write_bytes((repo/'services/helena-gateway/test/brief_preflight_test.py').read_bytes())
(target/'scripts').mkdir(exist_ok=True)
(target/'scripts/brief_preflight.py').write_bytes((src/'brief_preflight.py').read_bytes())
archive=target.with_suffix('.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as output:
    for p in target.rglob('*'):
        if p.is_file(): output.write(p,str(p.relative_to(target)))
print(json.dumps({'archive':str(archive),'bytes':archive.stat().st_size}))
