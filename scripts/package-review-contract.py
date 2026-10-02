import json
from pathlib import Path
import zipfile

repo = Path(__file__).resolve().parents[1]
source = repo / 'services/helena-gateway/scripts'
target = repo / 'artifacts/review-contract-20261002'
(target / 'scripts').mkdir(parents=True, exist_ok=True)
(target / 'test').mkdir(exist_ok=True)
hashes = {'hermes_workflow_tick.py': 'eafd46a40ac12ce7b24c44aa07dbd702812c9576e08108d457d655db45d7582c',
          'hermes_execution_context.py': 'a6c39cc647bc42ee1d8cd9ace5a51b43f23ab29756bdaf0356722c1d86c72836'}
package = {'profiles': json.loads((source / 'autonomy-profiles.json').read_text()),
           'probe_job': 'JOB-HR-20b2a6f253ee5c5377e994e8da2b8595',
           'runtime': {name: {'old_sha256': value} for name, value in hashes.items()}}
(target / 'review-package.json').write_text(json.dumps(package))
(target / 'install_review_contract.py').write_bytes((source / 'install_review_contract.py').read_bytes())
for name in (*hashes, 'hermes_dispatch_once.py', 'creative_quality.py', 'autonomy_protocol.py'):
    (target / 'scripts' / name).write_bytes((source / name).read_bytes())
for name in ('hermes_workflow_tick_test.py', 'workflow_recovery_test.py'):
    (target / 'test' / name).write_bytes((repo / 'services/helena-gateway/test' / name).read_bytes())
with zipfile.ZipFile(target.with_suffix('.zip'), 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in target.rglob('*'):
        if file.is_file(): archive.write(file, file.relative_to(target).as_posix())
print(target.with_suffix('.zip'))
