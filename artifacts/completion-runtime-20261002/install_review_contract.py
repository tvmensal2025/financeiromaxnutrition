"""Install the shared review repair atomically, preserving jobs, receipts and permissions."""
import ast
from contextlib import ExitStack
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys

VERSION = 'review-contract-v2'
RULE = '''\n\n## Contrato de revisao v2
Para revisar, confirme a versao atual e leia review_contract do get_job. Cada criterio possui check_id curto: use approval_fields_seed como base mecanica, mantendo expected_task_version e quality_review.inspected_evidence_refs/verified_check_ids. Acrescente findings independente e requirements_met=true somente apos conferir o pedido, todas as fontes e cada arquivo. O seed nao e aprovacao e nao substitui inspecao. Nunca reescreva os criterios nem envie verified_check_ids e verified_criteria juntos. Se o contrato recusar os campos, leia o erro e corrija uma vez; nao repita argumentos identicos. Se a entrega estiver errada, registre REQUEST_CHANGES com apontamentos objetivos. A coordenacao retoma a etapa seguinte pelo registro persistente. Falha de transporte ou resultado incerto exige consultar o estado antes de tentar outra escrita. Nenhum agente pode autoaprovar, aumentar limites ou trocar a empresa para destravar.\n'''


def sha(data):
    return hashlib.sha256(data.replace(b'\r\n', b'\n')).hexdigest()


def install(home=Path('/data'), source=None):
    import fcntl
    source = source or Path(__file__).resolve().parent
    runtime = home / 'helena-runtime'
    package = json.loads((source / 'review-package.json').read_text())
    profiles = package['profiles']
    if len(profiles) != len(set(profiles)) or len(profiles) != 21:
        raise ValueError('PROFILE_COUNT')
    with ExitStack() as stack:
        for name in ('pipeline.lock', 'dispatcher.lock'):
            lock = stack.enter_context((runtime / name).open('a+'))
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        sys.path.insert(0, str(runtime))
        import hermes_dispatch_once as dispatch
        token = dispatch.token_for(home / 'profiles', 'helena--grupo')
        report = dispatch.call_tool(dispatch.GATEWAY, token, 'workflow_checkpoint', {'action': 'list'})
        if report.get('success') is not True or any('recovery_count' not in row for row in report['runs']):
            raise ValueError('MIGRATION_NOT_READY')
        detail = dispatch.call_tool(dispatch.GATEWAY, token, 'get_job', {'job_id': package['probe_job'], 'view': 'manifest'})
        if (detail.get('review_contract') or {}).get('version') != VERSION:
            raise ValueError('GATEWAY_NOT_READY')
        plans = []
        for name, item in package['runtime'].items():
            if Path(name).name != name:
                raise ValueError('UNSAFE_FILENAME')
            target = runtime / name
            old, new = target.read_bytes(), (source / 'scripts' / name).read_bytes()
            ast.parse(new.decode())
            if sha(old) not in (item['old_sha256'], sha(new)):
                raise ValueError('RUNTIME_DRIFT:' + name)
            plans.append((target, old, new))
        manifest_path = runtime / 'quality-manifest.json'
        manifest_old = manifest_path.read_bytes()
        manifest = json.loads(manifest_old)
        for slug in profiles:
            if Path(slug).name != slug:
                raise ValueError('UNSAFE_PROFILE')
            target = home / 'profiles' / slug / 'SOUL.md'
            old = target.read_bytes()
            text = old.decode().replace('\r\n', '\n')
            new = (text if RULE.strip() in text else text + RULE).encode()
            plans.append((target, old, new))
            manifest.setdefault('soul_hashes', {})[slug] = hashlib.sha256(new).hexdigest()
        manifest['review_contract_version'] = VERSION
        plans.append((manifest_path, manifest_old, json.dumps(manifest, ensure_ascii=False, indent=2).encode()))
        for target, old, new in plans:
            if target.is_symlink() or not target.resolve().is_relative_to(home.resolve()) or target.read_bytes() != old:
                raise ValueError('UNSAFE_OR_CHANGED_PATH')
        backup = runtime / ('review-contract-backup-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
        backup.mkdir(mode=0o700)
        written = []
        try:
            for target, old, new in plans:
                if old == new: continue
                if target.read_bytes() != old: raise ValueError('CONCURRENT_CHANGE')
                saved = backup / target.relative_to(home)
                saved.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(target, saved)
                temp = target.with_suffix(target.suffix + '.review-tmp')
                with temp.open('xb') as stream:
                    os.chmod(temp, target.stat().st_mode & 0o777)
                    stream.write(new)
                    stream.flush()
                    os.fsync(stream.fileno())
                temp.replace(target)
                written.append((target, saved))
                if target.read_bytes() != new: raise ValueError('VERIFY_FAILED')
        except Exception:
            for target, saved in reversed(written): shutil.copy2(saved, target)
            raise
        receipt = {'status': 'INSTALLED', 'version': VERSION, 'profiles': profiles,
                   'backup': str(backup), 'changed_files': len(written), 'model_calls': 0,
                   'jobs_changed': False, 'permissions_changed': False,
                   'runtime_hashes': {name: sha((runtime / name).read_bytes()) for name in package['runtime']}}
        (runtime / 'completion-install.json').write_text(json.dumps(receipt, indent=2))
        print(json.dumps(receipt))


if __name__ == '__main__': install()
