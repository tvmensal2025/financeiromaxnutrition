"""Project the authoritative Helena queue into Hermes Kanban, without dispatching AI.

Run on the Hermes host. The board is a disposable projection; Supabase remains
the only source of truth. This process never claims, executes, approves or
completes an agent job. Native Kanban dispatch must remain disabled for every
profile before any card is written.
"""

import argparse
import json
from pathlib import Path
import re
import sys

ROOT = Path('/data/helena-runtime')
PROFILES = Path('/data/profiles')
VALID_JOB = re.compile(r'JOB-[A-Za-z0-9-]{4,80}\Z')
VALID_BUSINESS = re.compile(r'[A-Za-z0-9_-]{2,80}\Z')
LANES = {
    'DRAFT': 'blocked', 'SCHEDULED': 'scheduled', 'READY': 'ready',
    'CLAIMED': 'running', 'RUNNING': 'running',
    'WAITING_APPROVAL': 'blocked', 'WAITING_HELENA': 'review',
    'COMPLETED': 'done', 'FAILED': 'blocked', 'CANCELLED': 'blocked',
}
PRIORITIES = {'CRITICA': 3, 'ALTA': 2, 'MEDIA': 1, 'BAIXA': 0}


def board_slug(business_id):
    if not isinstance(business_id, str) or not VALID_BUSINESS.fullmatch(business_id):
        raise ValueError('Empresa fora do formato permitido')
    return 'helena-' + business_id.lower().replace('_', '-')


def card(job):
    if not isinstance(job, dict) or not VALID_JOB.fullmatch(job.get('job_id', '')):
        raise ValueError('Job fora do formato permitido')
    business_id = job.get('business_id')
    board = board_slug(business_id)
    status = job.get('status')
    if status not in LANES:
        raise ValueError('Status oficial desconhecido')
    agent_id = job.get('agent_id')
    if not isinstance(agent_id, str) or not re.fullmatch(r'AGT-\d{2}', agent_id):
        raise ValueError('Agente invalido')
    active = job.get('binding_status') == 'ACTIVE'
    profile = job.get('profile_slug') if active else None
    if active and (not isinstance(profile, str) or not re.fullmatch(r'[a-z][a-z0-9-]+', profile)):
        raise ValueError('Perfil Hermes invalido')
    objective = ' '.join(str(job.get('objective') or '').split())
    if not objective:
        raise ValueError('Objetivo ausente')
    title = f'{agent_id} · {objective[:130]}'
    body = (f"Espelho da fila oficial; não execute este cartão.\n"
            f"Empresa: {business_id}\nAgente: {agent_id} ({profile or 'perfil indisponível'})\n"
            f"Job: {job['job_id']}\nTarefa: {job.get('task_id') or 'sem ID'}\n"
            f"Situação oficial: {status}\nAprovação: {job.get('approval_status') or 'não informada'}\n"
            f"Atualizado na origem: {job.get('updated_at') or 'não informado'}")
    return {
        'board': board, 'tenant': business_id, 'assignee': profile,
        'idempotency_key': 'helena-mirror:' + job['job_id'],
        'title': title, 'body': body, 'status': LANES[status] if active else 'blocked',
        'priority': PRIORITIES.get(job.get('priority'), 1),
    }


def assert_dispatch_disabled(profiles=PROFILES, system_config=Path('/data/config.yaml')):
    import yaml
    configs = [system_config]
    configs += [p / 'config.yaml' for p in profiles.iterdir() if p.is_dir()]
    if len(configs) < 22:  # base + 21 known agents; never run on a partial fleet
        raise RuntimeError('Inventario de perfis incompleto')
    for path in configs:
        if not path.is_file():
            raise RuntimeError(f'Configuração ausente: {path}')
        setting = (yaml.safe_load(path.read_text(encoding='utf-8')) or {}).get('kanban', {})
        if setting.get('dispatch_in_gateway') is not False:
            raise RuntimeError(f'Despachante Kanban não está desligado: {path}')
        if setting.get('dispatch_profiles') != []:
            raise RuntimeError(f'Lista de despacho Kanban não está vazia: {path}')
    return len(configs) - 1


def load_jobs():
    sys.path.insert(0, str(ROOT))
    from hermes_dispatch_once import GATEWAY, call_tool, token_for
    token = token_for(PROFILES, 'helena--grupo')
    jobs, offset = [], 0
    while offset <= 10000:
        page = call_tool(GATEWAY, token, 'kanban_snapshot', {'offset': offset, 'limit': 100})
        if page.get('source') != 'supabase.agent_jobs' or page.get('execution_owner') != 'helena-gateway':
            raise RuntimeError('Resposta não é da fila oficial')
        batch = page.get('jobs')
        if not isinstance(batch, list) or len(batch) > 100:
            raise RuntimeError('Página inválida')
        jobs.extend(batch)
        next_offset = page.get('next_offset')
        if next_offset is None:
            return jobs
        if next_offset != offset + len(batch) or next_offset <= offset:
            raise RuntimeError('Paginação inconsistente')
        offset = next_offset
    raise RuntimeError('Fila maior que o limite do espelho; não sincronizada')


def sync(jobs):
    # Validate the entire snapshot and fleet *before* writing the first card.
    assert_dispatch_disabled()
    cards = [card(job) for job in jobs]
    if len({c['idempotency_key'] for c in cards}) != len(cards):
        raise RuntimeError('Job duplicado na leitura')
    from hermes_cli import kanban_db
    from hermes_cli.kanban_db_connect import connect
    boards = {b['slug'] for b in kanban_db.list_boards()}
    counts = {}
    for item in cards:
        slug = item['board']
        if slug not in boards:
            kanban_db.create_board(slug, name=f"Helena · {item['tenant']}",
                                   description='Espelho da fila Supabase. Execução e aprovação apenas no Gateway.')
            boards.add(slug)
        with connect(board=slug) as conn:
            task_id = kanban_db.create_task(
                conn, title=item['title'], body=item['body'], assignee=item['assignee'],
                tenant=item['tenant'], priority=item['priority'], created_by='helena-mirror',
                idempotency_key=item['idempotency_key'], initial_status='blocked', board=slug)
            task = kanban_db.get_task(conn, task_id)
            if not task or task.idempotency_key != item['idempotency_key']:
                raise RuntimeError('Cartão retornado sem identidade esperada')
            changed = (task.status != item['status'] or task.title != item['title']
                       or task.body != item['body'] or task.assignee != item['assignee']
                       or task.priority != item['priority'])
            # This is a display-only projection. Native transitions would create
            # fake worker runs / reviews and could consume execution capacity.
            if changed:
                conn.execute('UPDATE tasks SET status = ?, assignee = ?, priority = ? '
                             'WHERE id = ? AND idempotency_key = ?',
                             (item['status'], item['assignee'], item['priority'], task_id,
                              item['idempotency_key']))
                conn.commit()  # edit_task opens its own transaction
                # The native edit emits a task event/board notification after
                # the display state changes. No worker run is synthesized.
                kanban_db.edit_task(conn, task_id, title=item['title'], body=item['body'],
                                    priority=item['priority'], board=slug)
            if kanban_db.get_task(conn, task_id).status != item['status']:
                raise RuntimeError('Cartão não refletiu a situação oficial')
        counts[slug] = counts.get(slug, 0) + 1
    return counts


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true', help='Lê e valida sem escrever no quadro')
    args = parser.parse_args()
    assert_dispatch_disabled()
    jobs = load_jobs()
    cards = [card(j) for j in jobs]
    result = {'source': 'supabase.agent_jobs', 'cards': len(cards),
              'boards': sorted({c['board'] for c in cards}), 'mode': 'dry-run' if args.dry_run else 'sync'}
    if not args.dry_run:
        result['counts'] = sync(jobs)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
