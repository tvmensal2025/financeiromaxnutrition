import ast
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

repo = Path(__file__).resolve().parents[1]
source = repo / 'services/helena-gateway/scripts'
target = repo / 'artifacts/action-ownership-20261002-v2'
target.mkdir(parents=True, exist_ok=True)
names = ('hermes_workflow_tick.py', 'hermes_dispatch_once.py', 'autonomy_protocol.py', 'hermes_mcp_preflight.py')
package = {'profiles':json.loads((source/'autonomy-profiles.json').read_text()), 'runtime':{}}
old_module = {}
exec(subprocess.check_output(['git','show','HEAD:services/helena-gateway/scripts/autonomy_protocol.py'], cwd=repo).decode(), old_module)
new_module = {}
exec((source/'autonomy_protocol.py').read_text(), new_module)
package.update(old_rule=old_module['RULE'], new_rule=new_module['RULE'],
    old_instruction='9. Apos aprovacao, handoff_task cria a tarefa do proximo responsavel e o vinculo da evidencia, em DRAFT. Marina/Helena libera com release_job. Isso ainda nao inicia o modelo.',
    new_instruction='9. Apos aprovacao, somente Helena/Marina chama handoff_task para criar a tarefa do proximo responsavel e o vinculo da evidencia, em DRAFT. Especialistas fornecem os insumos; nao chamam handoff_task. Marina/Helena libera com release_job. Isso ainda nao inicia o modelo.')
for name in names:
    old = subprocess.check_output(['git','show','HEAD:services/helena-gateway/scripts/'+name], cwd=repo).replace(b'\r\n', b'\n')
    new = (source/name).read_bytes().replace(b'\r\n', b'\n')
    ast.parse(new.decode())
    package['runtime'][name] = {'old_sha256':hashlib.sha256(old).hexdigest()}
    (target/name).write_bytes(new)
(target/'install_action_ownership.py').write_bytes((source/'install_action_ownership.py').read_bytes())
(target/'ownership-package.json').write_text(json.dumps(package, ensure_ascii=False), encoding='utf-8')
testroot = target/'test'
testroot.mkdir(exist_ok=True)
(testroot/'hermes_workflow_tick_test.py').write_bytes((repo/'services/helena-gateway/test/hermes_workflow_tick_test.py').read_bytes())
(testroot/'mcp_preflight_test.py').write_bytes((repo/'services/helena-gateway/test/mcp_preflight_test.py').read_bytes())
(target/'scripts').mkdir(exist_ok=True)
for name in ('hermes_mcp_preflight.py', 'autonomy-profiles.json'):
    (target/'scripts'/name).write_bytes((source/name).read_bytes())
archive = target.with_suffix('.zip')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for path in target.rglob('*'):
        if path.is_file(): z.write(path, str(path.relative_to(target)))
print(json.dumps({'archive':str(archive), 'bytes':archive.stat().st_size}))
