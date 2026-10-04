"""Theo's bounded recovery controller: canonical facts, no speculative retries.

Runs before the existing pipeline, never starts a model itself. Only explicitly
adopted text jobs can use the first recipe. Other incidents remain with their
owner until a tested recipe exists. No changes to model/account permissions.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import hermes_dispatch_once as dispatch
from hermes_workflow_tick import atomic_json

RECIPE = 'text-timeout-sol61-v1'
TIMEOUT = 'Execucao pontual terminou sem entrega confirmada. Diagnostico local: TIMEOUT. Verificar eventos antes de qualquer repeticao.'


def eligible(detail, business):
    job = detail.get('job') or {}
    result = job.get('result_payload') or {}
    return (job.get('business_id') == business and job.get('agent_id') == 'AGT-17'
            and job.get('status') == 'FAILED' and job.get('attempt_count') == 1
            and min(job.get('max_attempts') or 2, 2) > 1
            and job.get('error_code') == 'HERMES_PROCESS_FAILED'
            and job.get('error_message') == TIMEOUT
            and not job.get('evidence_refs') and 'delivery' not in result
            and not result.get('review_pending')
            and not any(detail.get(k) for k in ('evidence_records', 'artifact_records', 'evidence_missing'))
            and not any(e.get('event_type') == 'WORKFLOW_resolve_job_block'
                        and (e.get('payload') or {}).get('previous_status') == 'FAILED'
                        for e in detail.get('events') or []))


def advance(config, read, call, execute=False):
    if config.get('enabled') is not True:
        return {'status': 'DISABLED', 'model_started': False}
    ids = config.get('adopt_job_ids', [])
    if len(ids) > 10 or len(ids) != len(set(ids)) or any(not dispatch.JOB_PATTERN.fullmatch(j) for j in ids):
        raise ValueError('Invalid bounded adoption list')
    for jid in ids:
        detail = read(jid)
        if detail.get('job', {}).get('job_id') != jid:
            raise ValueError('Wrong job')
        if not eligible(detail, config.get('business_id')):
            continue
        if not execute:
            return {'status': 'RECOVERY_ELIGIBLE', 'job_id': jid, 'recipe': RECIPE, 'model_started': False}
        # Persisted idempotency key is tied to the exact failed version. A lost
        # response is reconciled by the next canonical read, never a new job.
        key = hashlib.sha256((jid + ':' + str(detail['job']['updated_at'])).encode()).hexdigest()
        response = call('resolve_job_block', {
            'job_id': jid, 'expected_task_version': detail['task']['row_version'],
            'idempotency_key': 'autocorrection:' + key,
            'reason': 'Theo: receita text-timeout-sol61-v1. Processo encerrado pelo despachante; sem entrega/evidencias/artefatos canonicos. Retomar o mesmo pedido textual na tentativa restante com Sol 6.1 max e revisao independente. Causa da demora nao comprovada; nao declarar falha universalmente corrigida.'})
        after = read(jid)
        if (response.get('success') is True and after['job']['status'] == 'DRAFT'
                and after['job']['attempt_count'] == 1
                and (after['job'].get('result_payload') or {}).get('recovery_recipe') == RECIPE):
            return {'status': 'RECOVERED_TO_COORDINATION', 'job_id': jid, 'recipe': RECIPE,
                    'technical_owner': 'AGT-09', 'model_started': False, 'attempts_preserved': True}
        return {'status': 'RECONCILE', 'job_id': jid, 'model_started': False}
    return {'status': 'NO_ELIGIBLE_RECOVERY', 'model_started': False}


def discover(config, call):
    """Adopt future occurrences of the same recipe, never the historical backlog."""
    config = dict(config)
    ids = list(config.get('adopt_job_ids', []))
    if config.get('enabled') is True and config.get('new_jobs_after'):
        report = call('queue_attention', {'created_after': config['new_jobs_after'], 'limit': 25,
                     **({'after_job_id': config['discovery_cursor']} if config.get('discovery_cursor') else {})})
        if report.get('success') is not True or not isinstance(report.get('candidates'), list):
            raise ValueError('Unconfirmed recovery queue')
        config['discovery_cursor'] = report.get('next_cursor')
        for job in report['candidates']:
            if (job.get('business_id') == config.get('business_id') and job.get('agent_id') == 'AGT-17'
                    and job.get('status') == 'FAILED' and job.get('attempt_count') == 1
                    and job.get('job_id') not in ids and len(ids) < 10):
                ids.append(job['job_id'])
    config['adopt_job_ids'] = ids
    return config


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    if args.execute and os.environ.get('HELENA_DISPATCH_ENABLED') != '1':
        parser.error('Execution not enabled')
    directory = Path('/data/helena-runtime')
    config_path = directory / 'autocorrection-config.json'
    if not config_path.exists():
        print(json.dumps({'status': 'NOT_CONFIGURED', 'model_started': False}))
        return
    import fcntl
    with (directory / 'dispatcher.lock').open('a+') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print(json.dumps({'status': 'EXECUTOR_BUSY', 'model_started': False}))
            return
        try:
            config = json.loads(config_path.read_text())
            cursor_path = directory / 'autocorrection-cursor.json'
            if cursor_path.exists():
                config['discovery_cursor'] = json.loads(cursor_path.read_text()).get('cursor')
            token = dispatch.token_for(Path('/data/profiles'), 'helena--grupo')
            def call(name, payload):
                return dispatch.call_tool(dispatch.GATEWAY, token, name, payload)
            config = discover(config, call)
            if args.execute:
                atomic_json(cursor_path, {'cursor': config.get('discovery_cursor')})
            result = advance(config, lambda jid: call('get_job', {'job_id': jid}), call, args.execute)
        except (OSError, ValueError, RuntimeError) as error:
            result = {'status': 'RECONCILE', 'error_type': type(error).__name__, 'model_started': False}
        atomic_json(directory / 'autocorrection-last-result.json', result)
        print(json.dumps(result))


if __name__ == '__main__':
    main()
