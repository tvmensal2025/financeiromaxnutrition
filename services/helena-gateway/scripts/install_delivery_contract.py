"""Install the equivalent submission adapter, preserving roles, secrets and jobs."""
import ast
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import yaml
from configurar_perfis import PROFILES, profile_tools, URL

MARKER = '## Entrega estruturada pelo Gateway v1'
RULE = '''
## Entrega estruturada pelo Gateway v1
Para concluir uma etapa, prefira submit_work ao par record_memory/submit_delivery.
Envie source, summary, job_id, idempotency_key, expected_task_version e delivery completo.
Em delivery.acceptance_checks envie somente criterion e finding; o Gateway registra a memoria
e cria evidence_ref. Nao invente identificadores. Para imagens inclua artifact_refs verificados
e publication com legenda, estrategia e instrucoes. A entrega aguarda revisor independente.
Para inspecao visual use get_visual_asset com job_id e reference; o MCP entrega os pixels reais.
Se a resposta se perder, reenvie argumentos identicos e a mesma chave; nunca duplique a tarefa.
Isso nao libera publicacao, mensagens, gastos, conclusao direta nem excede tentativas.
'''

def install(home):
    home = home.resolve(strict=True)
    source = Path(__file__).resolve().parent
    runtime = home / 'helena-runtime'
    plans = []
    for name in ('creative_quality.py', 'hermes_dispatch_once.py', 'hermes_workflow_tick.py',
                 'hermes_mcp_preflight.py', 'hermes_execution_context.py', 'hermes_visual.py',
                 'install_native_mcp_pixels.py'):
        content = (source / name).read_text(encoding='utf-8'); ast.parse(content)
        plans.append((runtime / name, content.encode('utf-8')))
    for profile in PROFILES:
        root = home / 'profiles' / profile
        config_path, soul_path = root / 'config.yaml', root / 'SOUL.md'
        for path in (config_path, soul_path):
            if path.is_symlink() or not path.resolve().is_relative_to(home) or not path.is_file():
                raise ValueError('Unexpected profile file: ' + profile)
        config = yaml.safe_load(config_path.read_text(encoding='utf-8'))
        server = config['mcp_servers']['helena_operacao']
        expected = profile_tools(profile)
        actual = server['tools']['include']
        if (server.get('url') != URL or server.get('enabled') is not True
            or set(actual) - set(expected) or set(expected) - set(actual) - {'submit_work', 'get_visual_asset'}):
            raise ValueError('Profile diverged; no writes: ' + profile)
        changed = set(actual) != set(expected)
        if changed:
            server['tools']['include'] = expected
        if profile == 'maya--biz003':
            # Stdio MCP does not guarantee inheritance of the profile-specific
            # environment. Bind the same existing scoped identity explicitly.
            from hermes_dispatch_once import token_for
            visual_token = token_for(config_path.parent.parent, profile)
            visual = {'command': '/opt/hermes/.venv/bin/python',
                      'args': ['/data/helena-runtime/hermes_visual.py'], 'enabled': True,
                      'timeout': 300, 'connect_timeout': 20,
                      'tools': {'include': ['generate_design', 'check_visual_runtime'], 'prompts': False},
                      'env': {'HERMES_HOME': str(config_path.parent),
                              'HELENA_GATEWAY_PROFILE_TOKEN': visual_token}}
            current = config['mcp_servers'].get('helena_visual')
            legacy_visual = {key: value for key, value in visual.items() if key != 'env'}
            legacy_visual['tools'] = {'include': ['generate_design'], 'prompts': False}
            bound_legacy = {**legacy_visual, 'env': visual['env']}
            if current is not None and current not in (visual, legacy_visual, bound_legacy): raise ValueError('Visual connector diverged')
            image = config.get('image_gen') or {}
            if image.get('provider') not in (None, '', 'openai-codex'): raise ValueError('Image provider diverged')
            config['mcp_servers']['helena_visual'] = visual
            config['image_gen'] = {**image, 'provider': 'openai-codex'}
            changed = changed or current != visual or image.get('provider') != 'openai-codex'
        if changed:
            plans.append((config_path, yaml.safe_dump(config, allow_unicode=True, sort_keys=False).encode('utf-8')))
        if profile != 'laura--pessoal':
            soul = soul_path.read_text(encoding='utf-8')
            if MARKER not in soul:
                plans.append((soul_path, (soul.rstrip() + '\n' + RULE).encode('utf-8')))
    # Resolve every destination before any write, including runtime symlinks.
    for path, _ in plans:
        if path.is_symlink() or not path.resolve().is_relative_to(home):
            raise ValueError('Unexpected destination')
    backup = runtime / ('delivery-backup-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    backup.mkdir(mode=0o700)
    saved = []
    try:
        for path, content in plans:
            old = path.read_bytes() if path.exists() else None
            if old == content: continue
            if old is not None:
                copy = backup / path.relative_to(home); copy.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(path, copy); os.chmod(copy, 0o600)
            saved.append((path, old))
            temporary = path.with_suffix('.delivery-tmp')
            try:
                with temporary.open('xb') as stream:
                    os.chmod(temporary, 0o600); stream.write(content)
                temporary.replace(path)
                if path.read_bytes() != content: raise RuntimeError('Write verification failed')
            finally:
                temporary.unlink(missing_ok=True)
    except Exception:
        for path, old in reversed(saved):
            if old is None: path.unlink(missing_ok=True)
            else: path.write_bytes(old)
        raise
    result = {'status': 'INSTALLED', 'profiles_checked': len(PROFILES), 'business_profiles': 20,
              'changed_files': len(saved), 'backup': str(backup), 'model_calls': 0,
              'credential_files_changed': False, 'schedule_changed': False, 'jobs_changed': False,
              'files': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p, _ in plans if p.parent == runtime}}
    (runtime / 'delivery-install-receipt.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result))
    return result

if __name__ == '__main__':
    import fcntl
    with Path('/data/helena-runtime/dispatcher.lock').open('a+') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        install(Path('/data'))
