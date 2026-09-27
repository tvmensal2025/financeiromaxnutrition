"""Operator-run provisioning. Dry-run by default; never prints raw credentials.

Run inside the existing Hermes host, not the Gateway container.
The public manifest contains SHA256 hashes only and does not activate any agent.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
from datetime import datetime, timezone
import yaml

PROFILES = ['helena--grupo', 'laura--pessoal', 'augusto--biz003', 'marina--biz003',
            'caio--biz003', 'clara--biz003', 'bianca--biz003', 'daniel--biz003',
            'theo--biz003', 'nina--biz003', 'ravi--biz003', 'maya--biz003',
            'bruno--biz003', 'olivia--biz003', 'victor--biz003', 'camila--biz003',
            'isabela--biz003', 'pedro--biz003', 'renata--biz003', 'joana--biz003', 'felipe--biz003']
URL = 'https://helena-automation-helena-gateway.d9v63q.easypanel.host/mcp'
KEY = 'HELENA_GATEWAY_PROFILE_TOKEN'
TOOLS = ['get_work_context', 'list_ready_jobs', 'queue_summary', 'get_job', 'claim_job',
         'start_job', 'record_progress', 'record_memory', 'submit_delivery', 'review_delivery',
         'handoff_task', 'create_task_job', 'release_job', 'fail_job', 'waiting_helena']
MARKER = '## Protocolo Hermes-Supabase v2'
RULES = '''
## Protocolo Hermes-Supabase v2
Este bloco substitui instrucao antiga conflitante de Grok ou conclusao direta.
1. Use helena_operacao.get_work_context ao iniciar; consulte o checkpoint atual. Nao fixe uma versao.
2. O Supabase e a fila e memoria canonicas. Chat local, Kanban e memoria local nao comprovam gravacao.
3. Atue somente no papel e empresa retornados pelo Gateway. Nunca use token de outro perfil, SQL administrativo ou service_role.
4. Antes de executar: get_job, claim_job e start_job. Sem aceite confirmado, nao execute.
5. Registre somente marcos relevantes com record_progress: acao, motivo de negocio, fonte e proximo passo. Sem raciocinio privado, polling por IA ou relatos vazios.
6. Use record_memory para um registro duravel com fonte. Dados ainda nao conferidos permanecem relatos, sem virar fatos validados.
7. Entregue com submit_delivery, evidence_refs e expected_task_version obtida em get_job. Nao use complete_job para se autoaprovar.
8. O revisor consulta pending_reviews em get_work_context, abre get_job e decide com review_delivery. Helena supervisiona todas as empresas. Autoaprovacao proibida.
9. Apos aprovacao, handoff_task cria a tarefa do proximo responsavel e o vinculo da evidencia, em DRAFT. Marina/Helena libera com release_job. Isso ainda nao inicia o modelo.
10. Conflito de versao: releia e compare; nao troque a versao cegamente. Reenvio identico usa a mesma idempotency_key; conteudo diferente exige nova decisao.
11. Limites: WIP global 1; no maximo 2 tentativas por job e 10 etapas por cadeia. Falha ou bloqueio deve ser registrado e comunicado. Nada de repeticao infinita.
12. Nao crie cron, campanha, envio externo, gasto ou novo worker automaticamente. O acionador real ainda precisa ser homologado.
13. As tabelas de cada funcao continuam as do cadastro. Este conector grava tarefas, jobs, marcos, memorias e handoffs; nao invente que gravou CRM/financeiro/produto sem ferramenta e confirmacao.
14. Laura permanece no escopo pessoal, fora da fila empresarial. Decisoes reservadas ao fundador continuam reservadas.
15. So anuncie concluido quando a gravacao, a revisao e a leitura do resultado estiverem confirmadas. Se uma ferramenta estiver indisponivel, informe a pendencia exata.
'''

def write_private(path, content):
    tmp = path.with_name(path.name + '.helena-tmp')
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as stream:
            stream.write(content)
        os.replace(tmp, path)
        os.chmod(path, 0o600)
    finally:
        if tmp.exists():
            tmp.unlink()

def prepare(home):
    plans = []
    for profile in PROFILES:
        directory = home / 'profiles' / profile
        if directory.is_symlink() or not directory.is_dir() or not directory.resolve().is_relative_to(home):
            raise ValueError('Perfil ausente ou caminho inesperado: ' + profile)
        config_path, env_path, soul_path = [directory / name for name in ('config.yaml', '.env', 'SOUL.md')]
        if any(p.is_symlink() for p in (config_path, env_path, soul_path)):
            raise ValueError('Arquivo de perfil nao pode ser link: ' + profile)
        config = yaml.safe_load(config_path.read_text(encoding='utf-8'))
        if not isinstance(config, dict):
            raise ValueError('Configuracao invalida: ' + profile)
        env = env_path.read_text(encoding='utf-8') if env_path.exists() else ''
        soul = soul_path.read_text(encoding='utf-8')
        matches = re.findall(r'^' + KEY + r'=(.*)$', env, re.M)
        if len(matches) > 1:
            raise ValueError('Chave duplicada: ' + profile)
        token = matches[0].strip().strip('\"\'') if matches else 'hhs_' + secrets.token_urlsafe(48)
        if not re.fullmatch(r'hhs_[A-Za-z0-9_-]{40,}', token):
            raise ValueError('Credencial existente fora do padrao; nao sera substituida: ' + profile)
        server = {'url': URL, 'headers': {'Authorization': 'Bearer ${' + KEY + '}'},
                  'timeout': 30, 'connect_timeout': 15, 'enabled': True,
                  'tools': {'include': ['get_work_context'] if profile == 'laura--pessoal' else TOOLS, 'prompts': False}}
        servers = config.setdefault('mcp_servers', {})
        if 'helena_operacao' in servers and servers['helena_operacao'] != server:
            # Accept only the exact earlier filter; never replace unrelated settings.
            previous = {**server, 'tools': {**server['tools'], 'include': TOOLS[:-2]}}
            if profile == 'laura--pessoal' or servers['helena_operacao'] != previous:
                raise ValueError('Conector existente diferente; comparar antes de gravar: ' + profile)
        servers['helena_operacao'] = server
        if not matches:
            env = env.rstrip('\n') + '\n' + KEY + '=' + token + '\n'
        if MARKER not in soul:
            soul = soul.rstrip() + '\n' + RULES
        plans.append((profile, [(config_path, yaml.safe_dump(config, allow_unicode=True, sort_keys=False)),
                                (env_path, env), (soul_path, soul)], hashlib.sha256(token.encode()).hexdigest()))
    return plans

def run(home, apply=False):
    home = home.resolve(strict=True)
    plans = prepare(home)  # Preflight every profile before changing any file.
    if not apply:
        print(json.dumps({'mode': 'SIMULACAO', 'profiles': len(plans), 'writes': 0, 'secrets_printed': False}))
        return
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    output = home / 'helena-runtime'
    output.mkdir(mode=0o700, exist_ok=True)
    backup = output / ('backup-' + stamp)
    backup.mkdir(mode=0o700)
    originals = []
    try:
        for profile, files, _ in plans:
            folder = backup / profile
            folder.mkdir(mode=0o700)
            for path, content in files:
                saved = folder / path.name
                exists = path.exists()
                if exists:
                    shutil.copy2(path, saved)
                    os.chmod(saved, 0o600)
                originals.append((path, saved if exists else None))
                write_private(path, content)
                if path.read_text(encoding='utf-8') != content:
                    raise RuntimeError('Falha na conferencia do arquivo')
        manifest = [{'profile_slug': p, 'token_sha256': digest} for p, _, digest in plans]
        write_private(output / 'manifest-publico.json', json.dumps(manifest, indent=2) + '\n')
    except Exception:
        for path, saved in reversed(originals):
            if saved is None:
                path.unlink(missing_ok=True)
            else:
                shutil.copy2(saved, path)
        raise
    print(json.dumps({'mode': 'CONFIGURADO', 'profiles': len(plans), 'manifest': str(output / 'manifest-publico.json'),
                      'backup': str(backup), 'agents_activated': 0, 'jobs_started': 0, 'secrets_printed': False}))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--home', type=Path, default=Path('/data'))
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    run(args.home, args.apply)
