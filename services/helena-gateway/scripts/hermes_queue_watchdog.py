"""Find forgotten work without inference, retries, or changing business state.

An old timestamp is a reason to inspect the process, never proof it died.
Only internal attention events can be written; no outbox or job mutation.
"""
import argparse
import hashlib
import json
from pathlib import Path

import hermes_dispatch_once as dispatch
from hermes_workflow_tick import atomic_json, permitted


def scan(directory, root, execute=False, request=dispatch.call_tool, max_pages=4):
    config = json.loads((directory / 'workflow-config.json').read_text())
    token = dispatch.token_for(root, 'helena--grupo')
    path = directory / 'queue-watchdog-state.json'
    state = json.loads(path.read_text()) if path.exists() else {'cursor': None}
    cursor = state.get('cursor')
    findings, recorded, pages = [], 0, 0
    seen = set()
    while pages < max_pages:
        report = request(dispatch.GATEWAY, token, 'queue_attention', {
            'limit': 25, **({'after_job_id': cursor} if cursor else {})})
        if report.get('success') is not True or not isinstance(report.get('candidates'), list):
            raise ValueError('Attention queue not confirmed')
        pages += 1
        for job in report['candidates']:
            if not permitted({'job': job}, config):
                continue
            kind = job.get('attention_kind')
            exhausted = int(job.get('attempt_count') or 0) >= min(int(job.get('max_attempts') or 2), 2)
            if kind not in ('FAILURE', 'STALE_EXECUTION') and not (kind == 'MANAGER_DECISION' and exhausted):
                continue
            jid = job['job_id']
            if jid in seen:
                continue
            seen.add(jid)
            findings.append({'job_id': jid, 'kind': kind, 'responsible_agent_id': 'AGT-01',
                             'technical_agent_id': 'AGT-09', 'automatic_retry': False})
            if execute:
                data = json.dumps([jid, job['status'], job['updated_at']], separators=(',', ':'))
                result = request(dispatch.GATEWAY, token, 'record_queue_attention', {
                    'job_id': jid, 'expected_status': job['status'],
                    'expected_updated_at': job['updated_at'],
                    'idempotency_key': 'watchdog:' + hashlib.sha256(data.encode()).hexdigest()})
                if result.get('success') is not True or result.get('jobs_changed') is not False:
                    raise ValueError('Attention event not confirmed')
                recorded += 1
        cursor = report.get('next_cursor')
        if cursor is None:
            break
    if execute:
        atomic_json(path, {'cursor': cursor})
    return {'status': 'QUEUE_ATTENTION' if findings else 'QUEUE_CHECKED',
            'findings': findings, 'recorded': recorded, 'pages': pages,
            'has_more': cursor is not None, 'model_started': False,
            'jobs_changed': False, 'automatic_retry': False}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    directory = Path('/data/helena-runtime')
    try:
        result = scan(directory, Path('/data/profiles'), args.execute)
    except (OSError, ValueError, RuntimeError) as error:
        result = {'status': 'WATCHDOG_UNAVAILABLE', 'error_type': type(error).__name__,
                  'model_started': False, 'jobs_changed': False, 'automatic_retry': False}
    atomic_json(directory / 'queue-watchdog-last-result.json', result)
    print(json.dumps(result))


if __name__ == '__main__':
    main()
