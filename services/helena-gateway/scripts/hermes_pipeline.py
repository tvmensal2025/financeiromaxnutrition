"""Advance confirmed agent transitions within one bounded poll, without paid retries.

The executor and workflow consumer retain their locks, authorization checks,
attempt limits and durable receipts. This driver never changes business state.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

DISPATCH_IDLE = {'NO_DISPATCH_REQUEST', 'NO_APPROVED_READY_JOB'}
DISPATCH_PROGRESS = {'WAITING_HELENA', 'COMPLETED'}


def run_component(name, execute):
    path = Path(__file__).resolve().with_name(name + '.py')
    command = [sys.executable, str(path)]
    if name == 'hermes_dispatch_once':
        command.append('--auto')
    if execute:
        command.append('--execute')
    result = subprocess.run(command, capture_output=True, text=True, timeout=1000,
                            stdin=subprocess.DEVNULL)
    # CLI errors may include private data; never relay raw stderr/stdout.
    try:
        report = json.loads(result.stdout)
    except (ValueError, TypeError):
        return {'status': 'COMPONENT_ERROR', 'component': name,
                'exit_code': result.returncode,
                'execution_outcome_unknown': True}
    if not isinstance(report, dict) or not isinstance(report.get('status'), str):
        return {'status': 'COMPONENT_ERROR', 'component': name,
                'exit_code': result.returncode, 'execution_outcome_unknown': True}
    return report


def advance(execute=False, max_actions=6, runner=run_component):
    if not isinstance(max_actions, int) or isinstance(max_actions, bool) or not 1 <= max_actions <= 6:
        raise ValueError('Bounded pipeline requires 1..6 actions')
    steps = []
    component = 'hermes_dispatch_once'
    for _ in range(max_actions):
        report = runner(component, execute)
        steps.append({'component': component, **report})
        status = report.get('status')
        if not execute:
            break
        if component == 'hermes_dispatch_once':
            if status in DISPATCH_IDLE | DISPATCH_PROGRESS:
                component = 'hermes_workflow_tick'
                continue
        elif status in {'CONFIRMED', 'RECONCILED'} and report.get('next_phase') == 'DELIVERED':
            break  # Final independent approval is terminal, not another handoff.
        elif status in {'CONFIRMED', 'RECONCILED'} and report.get('next_phase'):
            # Review -> handoff -> child release stays with the workflow consumer.
            component = 'hermes_workflow_tick'
            continue
        elif status in {'CONFIRMED', 'RECONCILED'} and report.get('observed_status') == 'READY':
            component = 'hermes_dispatch_once'
            continue
        # A failure, quota limit, busy executor, unchanged state or uncertain result
        # stops this poll. In particular FAILED never leads to another execution.
        break
    return {'status': 'PIPELINE_BOUNDED' if len(steps) == max_actions else 'PIPELINE_STOPPED',
            'execute': execute, 'max_actions': max_actions, 'steps': steps,
            'automatic_retry': False}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--max-actions', type=int, default=6)
    args = parser.parse_args()
    if args.execute and os.environ.get('HELENA_DISPATCH_ENABLED') != '1':
        parser.error('HELENA_DISPATCH_ENABLED=1 is required')
    import fcntl
    directory = Path('/data/helena-runtime')
    with (directory / 'pipeline.lock').open('a+') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print(json.dumps({'status': 'ALREADY_RUNNING', 'model_started': False}))
            return
        try:
            # Same existing poll, before regular coordination. Recovery is bounded
            # and does not start a model; canonical DRAFT still requires release.
            recovery = run_component('hermes_autocorrection', args.execute)
            if recovery.get('status') in {'RECONCILE', 'COMPONENT_ERROR', 'EXECUTOR_BUSY'}:
                from hermes_workflow_tick import atomic_json
                result = {'status': 'PIPELINE_BUSY' if recovery.get('status') == 'EXECUTOR_BUSY' else 'RECOVERY_NEEDS_ATTENTION', 'recovery': recovery,
                          'model_started': False, 'automatic_retry': False}
                atomic_json(directory / 'pipeline-last-result.json', result)
                print(json.dumps(result))
                return
            result = advance(args.execute, args.max_actions)
            result['recovery'] = recovery
        except subprocess.TimeoutExpired:
            result = {'status': 'COMPONENT_TIMEOUT', 'automatic_retry': False,
                      'execution_outcome_unknown': True}
        from hermes_workflow_tick import atomic_json
        atomic_json(directory / 'pipeline-last-result.json', result)
        print(json.dumps(result))


if __name__ == '__main__':
    main()
