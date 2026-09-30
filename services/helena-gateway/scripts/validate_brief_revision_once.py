"""Supervised one-off recovery after the missing coordinator tool was restored.

Does not release jobs, change attempt limits or reset automatic receipts.
"""
from pathlib import Path
import json
import sys
import os
sys.path.insert(0, '/data/helena-runtime')
import hermes_workflow_tick as w

JOB = 'JOB-HR-6e9e2c7f008a9993f7689e5e0defb53f'
KEY = 'wf-coordinate-brief-6e9e2c7f-20260930'
directory = Path('/data/helena-runtime')
with (directory / 'dispatcher.lock').open('a+') as lock:
    w.dispatch.fcntl.flock(lock, w.dispatch.fcntl.LOCK_EX | w.dispatch.fcntl.LOCK_NB)
    runtime = w.Workflow(directory, Path('/data/profiles'))
    before = runtime.call('get_job', {'job_id': JOB})
    assert before['job']['status'] == 'DRAFT'
    assert before['job']['result_payload'].get('review_pending') is False
    if any(e.get('idempotency_key') == KEY or KEY in json.dumps(e.get('payload', {})) for e in before.get('events', [])):
        raise SystemExit('Already revised; no inference')
    receipt = directory / 'brief-recovery-once.json'
    if receipt.exists():
        raise SystemExit('Receipt exists; inspect before another paid call')
    profile, token = runtime.profile('AGT-01', 'BIZ-003')
    binary = w.dispatch.resolve_hermes_binary()
    for check in (w.dispatch.usage_preflight(binary, profile), w.dispatch.mcp_preflight(Path('/data/profiles') / profile, token)):
        assert check['status'] == 'READY', check['status']
    prompt = (
        'Correcao pontual autorizada apos habilitar revise_task_brief no seu perfil. '
        'Dados canonicos lidos pelo Gateway abaixo. Corrija o MESMO briefing da Marina conforme REQUEST_CHANGES. '
        'Nao audite toda campanha nem releia eventos. Leia o schema de revise_task_brief e confirme manifest atual. '
        'Use as versoes atuais e idempotency_key ' + KEY + '. '
        'Preserve oito secoes profissionais completas. Entrega da Marina nesta etapa: plano PMO executavel '
        'com executor/revisor por etapa, IDs e fontes existentes, dependencias, criterios verificaveis, '
        'proximas acoes e bloqueios explicitos. Use somente IDs comprovados abaixo; faltante deve ser '
        'pendencia a verificar, nunca inventado. Post, tres stories, legenda, WhatsApp, estrategia e '
        'inspecao visual continuam obrigatorios como entregaveis FINAIS da campanha, nas dependencias. '
        'Copy e geracao/inspecao visual ainda pendentes; nao produzir, nao criar jobs, nao liberar. '
        'Grave revise_task_brief e confira get_job manifest; encerre. No maximo seis ferramentas. '
        'Contexto canônico: ' + json.dumps({'job': before['job'], 'task': before['task'],
            'evidence_records': before.get('evidence_records', []),
            'known_jobs': [{'job_id': JOB, 'agent_id': 'AGT-04', 'reviewer': 'AGT-01'},
                {'job_id': 'JOB-HR-7a09bb163135240c4b8c1ec90c5efbeb', 'agent_id': 'AGT-15', 'status': 'WAITING_HELENA'},
                {'job_id': 'JOB-HR-d4b5b488e4716e749cb7b1392e308424', 'agent_id': 'AGT-12', 'reviewer': 'AGT-10', 'status': 'WAITING_HELENA'}]}, ensure_ascii=False))
    w.atomic_json(receipt, {'status': 'STARTED', 'job_id': JOB, 'reason': 'Missing coordinator MCP tool restored; supervised recovery', 'model_calls': 1})
    code = w.run_query(binary, profile, Path('/data/profiles') / profile, token, prompt, timeout=180)
    after = runtime.call('get_job', {'job_id': JOB})
    events = [e for e in after.get('events', []) if e.get('event_type') == 'WORKFLOW_revise_task_brief']
    result = {'status': 'BRIEF_REVISED_DRAFT' if events and after['job']['status'] == 'DRAFT' else 'NEEDS_ATTENTION',
        'job_id': JOB, 'exit_code': code, 'task_version': after['task']['row_version'],
        'job_status': after['job']['status'], 'revision_events': len(events), 'released': False}
    w.atomic_json(receipt, result)
    print(json.dumps(result))
