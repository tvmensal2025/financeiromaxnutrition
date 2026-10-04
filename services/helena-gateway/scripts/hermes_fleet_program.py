"""Company-scoped, bounded batch driver. Planning is offline; live jobs stay canonical.

No job creation, status reset, credential expansion or unbounded paid retry.
The Helena workflow owns coordination/review; this driver only selects a named job.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys

JOB = re.compile(r'JOB-HR-[a-f0-9]{32}\Z')


def validate(plan):
    steps = plan['steps']
    ids = [s['agent_id'] for s in steps]
    if len(ids) != 21 or set(ids) != {f'AGT-{n:02}' for n in range(1, 22)}:
        raise ValueError('Expected exactly the 21 unique agents')
    if plan.get('business_id') != 'BIZ-003' or plan.get('coordinator') != 'AGT-01':
        raise ValueError('Wrong company or coordinator')
    if plan.get('external_actions_allowed') is not False:
        raise ValueError('This pilot does not authorize external actions')
    seen, jobs = set(), set()
    for step in steps:
        if not set(step['depends_on']) <= seen:
            raise ValueError('Dependencies must exist earlier in the program')
        if not step.get('task') or not step.get('acceptance'):
            raise ValueError('Task and acceptance required')
        if step.get('job_id'):
            if not JOB.fullmatch(step['job_id']) or step['job_id'] in jobs:
                raise ValueError('Invalid or duplicate job binding')
            jobs.add(step['job_id'])
        seen.add(step['agent_id'])


def accepted(detail):
    job = detail['job']
    result = job.get('result_payload') or {}
    reviewer = result.get('reviewed_by')
    delivery = result.get('delivery') or {}
    # Release approval is not delivery approval. Require the independent review receipt.
    return (job['status'] == 'COMPLETED' and result.get('review_pending') is False
            and bool(reviewer) and reviewer != job['agent_id']
            and bool(str(delivery.get('content', '')).strip())
            and bool(detail.get('evidence_records'))
            and any(e.get('event_type') == 'WORKFLOW_review_delivery'
                    and e.get('agent_id') == reviewer
                    and (e.get('payload') or {}).get('request', {}).get('payload', {}).get('reason')
                    == result.get('review_reason')
                    for e in detail.get('events', [])))


def inspect(plan, reader):
    validate(plan)
    rows, completed = [], set()
    for step in plan['steps']:
        row = {'agent_id': step['agent_id'], 'name': step['name'], 'job_id': step.get('job_id')}
        if not step.get('job_id'):
            row['status'] = 'NEEDS_HELENA_BINDING'
        else:
            detail = reader(step['job_id'])
            job = detail['job']
            if (job.get('job_id') != step['job_id'] or job.get('business_id') != plan['business_id']
                    or job.get('agent_id') != step['agent_id']):
                raise ValueError('Canonical job binding mismatch')
            row['status'] = 'VERIFIED_COMPLETE' if accepted(detail) else job['status']
            if row['status'] == 'COMPLETED':
                row['status'] = 'UNVERIFIED_COMPLETION'
            if row['status'] == 'VERIFIED_COMPLETE':
                completed.add(step['agent_id'])
        rows.append(row)
    blockers = [r for r in rows if r['status'] in {'FAILED', 'UNVERIFIED_COMPLETION'}]
    if blockers:
        return {'status': 'NEEDS_ATTENTION', 'blockers': blockers, 'rows': rows}
    if len(completed) == len(rows):
        return {'status': 'BATCH_COMPLETE', 'rows': rows}
    if any(r['status'] in {'RUNNING', 'CLAIMED'} for r in rows):
        return {'status': 'WAITING_EXECUTOR', 'rows': rows}
    for step, row in zip(plan['steps'], rows):
        if row['status'] == 'VERIFIED_COMPLETE' or not set(step['depends_on']) <= completed:
            continue
        if row['status'] == 'NEEDS_HELENA_BINDING':
            return {'status': 'NEEDS_HELENA_BINDING', 'next_agent': step['agent_id'], 'rows': rows}
        if row['status'] in {'READY', 'DRAFT', 'WAITING_HELENA'}:
            return {'status': 'ACTION_AVAILABLE', 'job_id': row['job_id'],
                    'component': 'hermes_dispatch_once' if row['status'] == 'READY' else 'hermes_workflow_tick',
                    'rows': rows}
        return {'status': 'NEEDS_ATTENTION', 'blockers': [row], 'rows': rows}
    return {'status': 'DEPENDENCIES_PENDING', 'rows': rows}


def run_named(component, job_id):
    path = Path(__file__).with_name(component + '.py')
    # Existing components retain their shared dispatcher lock and canonical permissions.
    command = [sys.executable, str(path), '--job-id', job_id, '--execute']
    try:
        child = subprocess.run(command, stdin=subprocess.DEVNULL, capture_output=True,
                               text=True, timeout=1100)
        report = json.loads(child.stdout)
        if not isinstance(report, dict) or not isinstance(report.get('status'), str):
            raise ValueError('Invalid receipt')
        return {'status': report['status'], 'exit_code': child.returncode}
    except (subprocess.TimeoutExpired, ValueError):
        return {'status': 'OUTCOME_UNKNOWN', 'automatic_retry': False}


def advance(plan, reader, runner=run_named, execute=False, max_actions=1):
    if isinstance(max_actions, bool) or not 1 <= max_actions <= 6:
        raise ValueError('max_actions must be 1..6')
    actions = []
    report = inspect(plan, reader)
    for _ in range(max_actions):
        if not execute or report['status'] != 'ACTION_AVAILABLE':
            break
        before = [(r['job_id'], r['status']) for r in report['rows']]
        result = runner(report['component'], report['job_id'])
        actions.append({'job_id': report['job_id'], **result})
        report = inspect(plan, reader)  # Canonical read after every mutation.
        if result['status'] not in {'CONFIRMED', 'RECONCILED', 'COMPLETED', 'WAITING_HELENA'}:
            report['status'] = 'NEEDS_RECONCILIATION'
            break
        if before == [(r['job_id'], r['status']) for r in report['rows']]:
            report['status'] = 'NO_PROGRESS'
            break
    return {**report, 'actions': actions, 'automatic_retry': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', type=Path, required=True)
    parser.add_argument('--live', action='store_true', help='Read canonical state on Hermes host')
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--max-actions', type=int, default=1)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    plan = json.loads(args.plan.read_text(encoding='utf-8-sig'))
    validate(plan)
    if args.execute and (not args.live or os.environ.get('HELENA_DISPATCH_ENABLED') != '1'):
        parser.error('Execution requires --live and HELENA_DISPATCH_ENABLED=1')
    if not args.live:
        report = {'status': 'PLAN_VALIDATED_ONLY', 'agents': len(plan['steps']),
                  'model_calls': 0, 'production_verified': False,
                  'missing_bindings': [s['agent_id'] for s in plan['steps'] if not s.get('job_id')]}
    else:
        import hermes_dispatch_once as dispatch
        token = dispatch.token_for(Path('/data/profiles'), 'helena--grupo')
        reader = lambda jid: dispatch.call_tool(dispatch.GATEWAY, token, 'get_job', {'job_id': jid})
        # Serialize batch runners. Child components still use their own shared lock.
        import fcntl
        attention = Path('/data/helena-runtime/fleet-program-attention.json')
        with Path('/data/helena-runtime/fleet-program.lock').open('a+') as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                report = {'status': 'ALREADY_RUNNING', 'model_started': False}
            else:
                if args.execute and attention.exists():
                    report = {'status': 'RECONCILIATION_REQUIRED', 'model_started': False}
                else:
                    report = advance(plan, reader, execute=args.execute, max_actions=args.max_actions)
                    if args.execute and report['status'] in {'NEEDS_RECONCILIATION', 'NO_PROGRESS'}:
                        from hermes_workflow_tick import atomic_json
                        atomic_json(attention, report)
        if args.report is None:
            args.report = Path('/data/helena-runtime/fleet-program-last-result.json')
    text = json.dumps(report, ensure_ascii=False, indent=2)
    if args.report:
        from tempfile import NamedTemporaryFile
        with NamedTemporaryFile(mode='w', encoding='utf-8', dir=args.report.parent, delete=False) as f:
            f.write(text)
            temp = f.name
        os.replace(temp, args.report)
    print(text)


if __name__ == '__main__':
    main()
