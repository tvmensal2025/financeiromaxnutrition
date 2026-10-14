import copy
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[1] / 'scripts'
sys.path.insert(0, str(SCRIPTS))
import hermes_workflow_tick as wf

JOB = 'JOB-HR-' + 'a'*32
CHILD = 'JOB-HR-' + 'b'*32

def detail():
    return {'job': {'job_id':JOB, 'task_id':'TASK-TEST', 'business_id':'BIZ-003', 'agent_id':'AGT-04',
        'created_at':'2026-09-30T10:00:00Z', 'updated_at':'2026-09-30T12:00:00Z',
        'status':'WAITING_HELENA', 'result_payload':{'review_pending':True,'reviewer_agent_id':'AGT-01'}},
        'task':{'task_id':'TASK-TEST','business_id':'BIZ-003','row_version':30}, 'events':[]}

def approve(d, decision='APPROVE'):
    d['job']['status'] = 'COMPLETED' if decision == 'APPROVE' else 'DRAFT'
    d['job']['result_payload'].update(review_pending=False, reviewed_by='AGT-01', review_reason='Compared complete evidence')
    d['events'].insert(0, {'event_type':'WORKFLOW_review_delivery', 'agent_id':'AGT-01',
        'payload':{'request':{'payload':{'decision':decision,'reason':'Compared complete evidence'}}}})

class ReviewStateTests(unittest.TestCase):
    def setUp(self):
        launcher = patch.object(wf.dispatch, 'launcher_preflight', return_value={'status': 'READY'})
        self.launcher_probe = launcher.start()
        self.addCleanup(launcher.stop)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name)
        home = self.path/'profiles'/'helena--grupo'
        home.mkdir(parents=True)
        (home/'.env').write_text('HELENA_GATEWAY_PROFILE_TOKEN=hhs_'+'a'*40)
        self.config = {'new_jobs_after':'2026-09-30T09:00:00Z','adopt_job_ids':[],
                       'profiles':{'AGT-01':['helena--grupo']}}
        (self.path/'workflow-config.json').write_text(json.dumps(self.config))
        self.d = detail()
        self.calls = 0
        self.busy = False
        self.context = {'context_version':'hermes-context-v2','truncated':False,
            'profile':{'agent_id':'AGT-01','scope_type':'GROUP','status':'ACTIVE'},
            'pending_reviews_detail':[{'job_id':JOB}]}
        self.runner_mode = 'APPROVE'

    def request(self, gateway, token, name, args):
        if name == 'queue_summary': return {'by_status':{'RUNNING':int(self.busy)}}
        if name == 'get_work_context': return self.context
        if name == 'get_job': return copy.deepcopy(self.d)
        raise AssertionError(name)

    def runner(self, *args):
        self.calls += 1
        state = json.loads((self.path/'workflow-state.json').read_text())
        self.assertTrue(any(r['status']=='STARTED' for r in state['receipts'].values()))
        if self.runner_mode in ('APPROVE','REQUEST_CHANGES'):
            approve(self.d, self.runner_mode)
        if self.runner_mode == 'REPLACE':
            self.d['job'].update(status='CANCELLED', result_payload={'replaced_by': CHILD})
        if self.runner_mode == 'ESCALATE':
            self.d['job'].update(status='WAITING_APPROVAL', result_payload={'founder_decision_required': True})
        return 0

    def worker(self):
        return wf.Workflow(self.path, self.path/'profiles', self.request, self.runner)

    def run_tick(self):
        with patch.dict(os.environ, {'HELENA_DISPATCH_ENABLED':'1'}), \
             patch.object(wf.dispatch, 'resolve_hermes_binary', return_value='hermes'), \
             patch.object(wf.dispatch, 'usage_preflight', return_value={'status':'READY'}), \
             patch.object(wf.dispatch, 'mcp_preflight', return_value={'status':'READY'}):
            return self.worker().tick(True)

    def test_review_then_durable_handoff(self):
        r = self.run_tick()
        self.assertEqual(r['next_phase'],'HANDOFF')
        self.assertEqual(self.worker().state['pending'][JOB]['agent_id'],'AGT-01')
        self.assertEqual(self.calls,1)

    def test_corrected_brief_with_missing_inputs_does_not_start_another_model(self):
        approve(self.d, 'REQUEST_CHANGES')
        review = self.d['job']['result_payload']
        review['brief_revision_history'] = [{'reviewed_by':review['reviewed_by'],
                                             'review_reason':review['review_reason']}]
        self.d['input_evidence_missing'] = ['MEM-MISSING']
        before = copy.deepcopy(self.d)
        report = self.run_tick()
        self.assertEqual(report['status'], 'CORRECTED_BRIEF_INPUTS_UNAVAILABLE')
        self.assertFalse(report['model_started'])
        self.assertEqual(self.calls, 0)
        self.assertEqual(self.d, before)

    def test_stale_pending_handoff_uses_existing_child_without_inference(self):
        approve(self.d)
        self.d['events'].append({'event_type':'WORKFLOW_handoff',
            'payload':{'response':{'job_id':CHILD}}})
        child = detail()
        child['job'].update(job_id=CHILD, status='DRAFT')
        worker = self.worker()
        worker.state['pending'][JOB] = {'phase':'HANDOFF','agent_id':'AGT-04'}
        original = worker.request
        def request(gateway, token, name, args):
            if name == 'get_job' and args['job_id'] == CHILD:
                return copy.deepcopy(child)
            return original(gateway, token, name, args)
        worker.request = request
        self.assertIsNone(worker.select())
        self.assertNotIn(JOB, worker.state['pending'])
        self.assertEqual(worker.state['pending'][CHILD]['phase'], 'COORDINATE')
        self.assertEqual(worker.select()[0]['job']['job_id'], CHILD)
        self.assertEqual(self.calls, 0)

    def test_stale_pending_final_delivery_is_not_handed_off(self):
        approve(self.d)
        self.d['job']['result_payload']['delivery'] = {'stage':'FINAL'}
        worker = self.worker()
        worker.state['pending'][JOB] = {'phase':'HANDOFF','agent_id':'AGT-04'}
        self.assertIsNone(worker.select())
        self.assertNotIn(JOB, worker.state['pending'])
        self.assertEqual(self.calls, 0)

    def test_actual_final_review_confirms_and_never_enqueues_handoff(self):
        self.d['job']['result_payload']['delivery'] = {'stage':'FINAL'}
        report = self.run_tick()
        self.assertEqual(report['status'], 'CONFIRMED')
        self.assertEqual(report['next_phase'], 'DELIVERED')
        state = json.loads((self.path/'workflow-state.json').read_text())
        self.assertNotIn(JOB, state['pending'])
        self.assertEqual(self.calls, 1)

    def test_rejected_final_package_returns_to_coordination(self):
        self.d['job']['result_payload']['delivery'] = {'stage':'FINAL'}
        self.runner_mode = 'REQUEST_CHANGES'
        report = self.run_tick()
        self.assertEqual(report['next_phase'], 'COORDINATE')

    def test_executor_probe_requires_exact_business_and_identity(self):
        self.d['runtime_binding'] = {'profile_slug':'maya--biz003', 'status':'ACTIVE',
                                    'agent_id':'AGT-04', 'business_id':'BIZ-003'}
        worker = self.worker()
        with patch.object(wf.dispatch, 'token_for', return_value='fixture'), \
             patch.object(wf.dispatch, 'mcp_preflight', return_value={'status':'READY'}) as probe:
            self.assertEqual(worker.executor_readiness(self.d)['reason'], 'EXECUTOR_SCOPE')
            probe.assert_not_called()
            self.context['profile'].update(scope_type='BUSINESS', agent_id='AGT-04', business_id='BIZ-003')
            report = worker.executor_readiness(self.d)
            self.assertEqual(report['status'], 'READY')
            self.assertEqual(report['model_calls'], 0)
            self.assertEqual(report['job_id'], JOB)

    def test_changes_return_to_coordinator(self):
        self.runner_mode='REQUEST_CHANGES'
        self.assertEqual(self.run_tick()['next_phase'],'COORDINATE')

    def test_no_effect_not_paid_again(self):
        self.runner_mode='NO_EFFECT'
        self.assertEqual(self.run_tick()['status'],'NEEDS_ATTENTION')
        self.assertEqual(self.run_tick()['status'],'WORKFLOW_NEEDS_ATTENTION')
        self.assertEqual(self.calls,1)

    def test_crash_reconciles_without_second_review(self):
        worker=self.worker()
        key=wf.fingerprint(self.d,'REVIEW')
        worker.state['receipts'][key]={'status':'STARTED','phase':'REVIEW','job_id':JOB}
        worker.persist()
        approve(self.d)
        # Dry-run cannot mutate jobs, but reconciles the durable local receipt.
        report = worker.tick(False)
        self.assertEqual(report['status'], 'WORKFLOW_DRY_RUN')
        self.assertEqual(report['profile'], 'helena--grupo')
        self.assertEqual(worker.state['receipts'][key]['status'],'RECONCILED')
        self.assertEqual(self.calls,0)

    def test_founder_review_never_automated(self):
        self.d['job']['agent_id']='AGT-01'
        self.d['job']['result_payload']['reviewer_agent_id']='FOUNDER'
        self.assertEqual(self.run_tick()['status'],'NO_NEW_REVIEW')
        self.assertEqual(self.calls,0)

    def test_old_queue_not_mass_activated(self):
        self.d['job']['created_at']='2020-01-01T00:00:00Z'
        self.assertEqual(self.run_tick()['status'],'NO_NEW_REVIEW')

    def test_explicit_adoption_of_old_job(self):
        self.d['job']['created_at']='2020-01-01T00:00:00Z'
        self.config['adopt_job_ids']=[JOB]
        self.assertTrue(wf.permitted(self.d,self.config))

    def test_dry_run_no_model(self):
        self.assertEqual(self.worker().tick()['phase'],'REVIEW')
        self.assertEqual(self.calls,0)

    def test_running_executor_blocks_model(self):
        self.busy=True
        self.assertEqual(self.run_tick()['status'],'EXECUTOR_BUSY')

    def test_wrong_business_or_identity_refused(self):
        self.context['profile']={'agent_id':'AGT-01','scope_type':'BUSINESS','status':'ACTIVE','business_id':'BIZ-OTHER'}
        with self.assertRaises(RuntimeError): self.run_tick()
        self.assertEqual(self.calls,0)

    def test_quota_block_no_receipt_or_inference(self):
        with patch.dict(os.environ, {'HELENA_DISPATCH_ENABLED':'1'}), \
             patch.object(wf.dispatch, 'resolve_hermes_binary', return_value='hermes'), \
             patch.object(wf.dispatch, 'usage_preflight', return_value={'status':'PROVIDER_LIMIT'}), \
             patch.object(wf.dispatch, 'mcp_preflight', return_value={'status':'READY'}):
            self.assertEqual(self.worker().tick(True)['status'],'PROVIDER_LIMIT')
        self.assertEqual(self.calls,0)
        self.assertFalse(self.worker().state['receipts'])

    def test_launcher_failure_does_not_start_review_or_write_receipt(self):
        self.launcher_probe.return_value = {'status': 'LAUNCHER_UNAVAILABLE', 'diagnostic': 'RUNTIME_IMPORT'}
        self.assertEqual(self.run_tick()['status'], 'LAUNCHER_UNAVAILABLE')
        self.assertEqual(self.calls, 0)
        self.assertFalse(self.worker().state['receipts'])

    def test_block_is_not_mistaken_for_delivery(self):
        self.d['job']['result_payload']={}
        self.assertEqual(wf.phase_for(self.d),('RESOLVE','AGT-01'))

    def test_exhausted_attempts_go_to_replan_once(self):
        # EM_RESOLUCAO: missao esgotada nao morre em silencio; uma chamada da coordenacao replaneja.
        self.d['job'].update(attempt_count=2,max_attempts=2,result_payload={})
        self.assertEqual(wf.phase_for(self.d), ('REPLAN', 'AGT-01'))
        self.runner_mode = 'REPLACE'
        result=self.run_tick()
        self.assertEqual(self.calls,1)
        self.assertEqual(result['next_phase'],'RELEASE:'+CHILD)
        self.assertEqual(self.run_tick()['status'] in ('NO_NEW_REVIEW','UNCHANGED_NO_RETRY'), True)
        self.assertEqual(self.calls,1)

    def test_replan_escalation_leaves_automatic_cycle(self):
        self.d['job'].update(status='DRAFT',attempt_count=2,max_attempts=2,result_payload={})
        self.assertEqual(wf.phase_for(self.d), ('REPLAN', 'AGT-01'))
        self.runner_mode = 'ESCALATE'
        self.assertEqual(self.run_tick()['next_phase'],'DELIVERED')
        self.assertIsNone(wf.phase_for(self.d))
        self.assertEqual(self.calls,1)

    def test_exhausted_job_does_not_starve_independent_review(self):
        blocked = copy.deepcopy(self.d)
        # Escalated to the Founder: no automatic phase, so it never starves the review queue.
        blocked['job'].update(job_id=CHILD, status='WAITING_APPROVAL', attempt_count=2, max_attempts=2, result_payload={'founder_decision_required': True})
        self.context['pending_reviews_detail'] = [{'job_id': CHILD}, {'job_id': JOB}]
        original = self.request
        def request(gateway, token, name, args):
            if name == 'get_job' and args['job_id'] == CHILD:
                return copy.deepcopy(blocked)
            return original(gateway, token, name, args)
        self.request = request
        self.assertEqual(self.run_tick()['next_phase'], 'HANDOFF')
        self.assertEqual(self.calls, 1)
        self.assertEqual(blocked['job']['attempt_count'], 2)

    def test_handoff_verification_uses_persisted_child(self):
        self.d['events']=[{'event_type':'WORKFLOW_handoff','payload':{'response':{'job_id':CHILD}}}]
        self.assertEqual(wf.next_phase('HANDOFF',{},self.d),'RELEASE:'+CHILD)

    def test_stale_pending_handoff_not_executed(self):
        self.d['job']['status']='DRAFT'
        worker=self.worker()
        worker.state['pending'][JOB]={'phase':'HANDOFF','agent_id':'AGT-04'}
        worker.persist()
        self.assertEqual(worker.tick()['phase'],'COORDINATE')
        self.assertFalse(worker.state['pending'])
        self.assertEqual(self.calls, 0)

    def test_adopted_job_outside_compact_context_is_not_starved(self):
        self.context['pending_reviews_detail']=[]
        self.config['adopt_job_ids']=[JOB]
        (self.path/'workflow-config.json').write_text(json.dumps(self.config))
        self.assertEqual(self.run_tick()['next_phase'],'HANDOFF')

    def test_legacy_whatsapp_job_does_not_abort_valid_review(self):
        self.context['pending_reviews_detail'] = [{'job_id':'JOB-WPP-MUHP2BE0'}, {'job_id':JOB}]
        original = self.request
        def request(gateway, token, name, args):
            if name == 'get_job' and args['job_id'].startswith('JOB-WPP-'):
                self.fail('Legacy ID must be filtered before the Gateway call')
            return original(gateway, token, name, args)
        self.request = request
        self.assertEqual(self.run_tick()['next_phase'], 'HANDOFF')
        self.assertEqual(self.calls, 1)

    def test_legacy_pending_and_receipt_do_not_abort_selection(self):
        worker = self.worker()
        worker.state['pending']['JOB-WPP-MUHP2BE0'] = {'phase':'HANDOFF','agent_id':'AGT-04'}
        worker.state['receipts']['legacy'] = {'status':'STARTED','phase':'REVIEW','job_id':'JOB-WPP-MUHP2BE0'}
        worker.persist()
        self.assertEqual(self.run_tick()['next_phase'], 'HANDOFF')

    def test_full_review_handoff_and_release_across_restarts(self):
        child=detail()
        child['job'].update(job_id=CHILD,status='DRAFT',agent_id='AGT-12')
        self.config['profiles']['AGT-04']=['marina--biz003']
        (self.path/'workflow-config.json').write_text(json.dumps(self.config))
        home=self.path/'profiles'/'marina--biz003'
        home.mkdir()
        (home/'.env').write_text('HELENA_GATEWAY_PROFILE_TOKEN=hhs_'+'b'*40)
        original_request=self.request
        def request(gateway, token, name, args):
            if name=='get_job' and args['job_id']==CHILD: return copy.deepcopy(child)
            if name=='get_work_context' and token.endswith('b'*40):
                return {**self.context,'profile':{'agent_id':'AGT-04','business_id':'BIZ-003','scope_type':'BUSINESS','status':'ACTIVE'}}
            return original_request(gateway,token,name,args)
        self.request=request
        def runner(binary, profile, home, token, prompt):
            self.calls+=1
            if 'fase REVIEW,' in prompt: approve(self.d)
            elif 'fase HANDOFF,' in prompt:
                self.assertEqual(profile,'helena--grupo')
                self.d['events'].insert(0,{'event_type':'WORKFLOW_handoff','payload':{'response':{'job_id':CHILD}}})
            elif 'fase COORDINATE,' in prompt:
                self.assertEqual(profile,'helena--grupo')
                child['job']['status']='READY'
            else: self.fail('Unexpected phase')
            return 0
        self.runner=runner
        self.assertEqual(self.run_tick()['next_phase'],'HANDOFF')
        self.assertEqual(self.run_tick()['next_phase'],'RELEASE:'+CHILD)
        self.assertEqual(self.run_tick()['observed_status'],'READY')
        self.assertEqual(self.calls,3)
        self.assertFalse(self.worker().state['pending'])

class FleetActionOwnershipTests(ReviewStateTests):
    def test_all_21_producers_handoff_via_coordinator(self):
        for number in range(1, 22):
            with self.subTest(agent=number):
                d = detail()
                d['job']['agent_id'] = f'AGT-{number:02}'
                approve(d)
                self.assertEqual(wf.phase_for(d), ('HANDOFF', 'AGT-01'))
                worker = self.worker()
                worker.enqueue_follow(d, 'HANDOFF')
                self.assertEqual(worker.state['pending'][JOB]['agent_id'], 'AGT-01')

    def test_stale_finance_legal_marketing_pending_reselects_coordinator(self):
        approve(self.d)
        for agent in ('AGT-05', 'AGT-06', 'AGT-16'):
            self.d['job']['agent_id'] = agent
            worker = self.worker()
            worker.state['pending'][JOB] = {'phase':'HANDOFF','agent_id':agent}
            self.assertEqual(worker.select(JOB)[2], 'AGT-01')

    def test_wrong_actor_blocked_before_model_or_profile_lookup(self):
        approve(self.d)
        worker = self.worker()
        with patch.object(worker, 'select', return_value=(self.d, 'HANDOFF', 'AGT-05')), \
             patch.object(worker, 'profile') as lookup:
            self.assertEqual(worker.tick(True)['status'], 'ACTION_ACTOR_MISMATCH')
            lookup.assert_not_called()
        self.assertEqual(self.calls, 0)

    def test_personal_scope_not_adopted_even_explicitly(self):
        self.d['job']['scope_type'] = 'PERSONAL'
        self.config['adopt_job_ids'] = [JOB]
        self.assertFalse(wf.permitted(self.d, self.config))

    def test_specialists_cannot_review_their_own_delivery(self):
        for number in range(1, 22):
            d = detail()
            d['job']['agent_id'] = f'AGT-{number:02}'
            d['job']['result_payload']['reviewer_agent_id'] = d['job']['agent_id']
            self.assertIsNone(wf.phase_for(d))

    def test_handoff_prompt_matches_coordinator_authorization(self):
        approve(self.d)
        prompt = wf.make_prompt('HANDOFF', self.d, 'a'*64)
        self.assertIn('Somente a coordenacao pode chamar handoff_task', prompt)
        self.assertNotIn('Voce continua como executor para encaminhar', prompt)


class CanonicalContinuityTests(ReviewStateTests):
    def setUp(self):
        super().setUp()
        self.config['durable_continuity'] = True
        (self.path/'workflow-config.json').write_text(json.dumps(self.config))
        self.remote_runs = {}

    def request(self, gateway, token, name, args):
        if name == 'workflow_candidates':
            key = wf.fingerprint(self.d, (wf.phase_for(self.d) or ('NONE',))[0])
            candidates = [] if key in self.remote_runs or not wf.phase_for(self.d) else [{'job_id': self.d['job']['job_id']}]
            return {'success': True, 'candidates': candidates, 'next_cursor': None}
        if name == 'workflow_checkpoint':
            action = args['action']
            if action == 'list':
                return {'success': True, 'runs': [copy.deepcopy(r) for r in self.remote_runs.values() if r['status'] in ('STARTED','NEEDS_ATTENTION')]}
            if action == 'reserve':
                if args['fingerprint'] in self.remote_runs:
                    return {'success': True, 'reserved': False, 'status': 'UNCHANGED_NO_RETRY'}
                run = {'fingerprint': args['fingerprint'], 'job_id': args['job_id'], 'phase': args['phase'],
                       'profile_slug': 'helena--grupo', 'status': 'STARTED', 'started_at': '2026-10-01T00:00:00Z',
                       'run_id': '11111111-1111-4111-8111-111111111111', 'run_token': '22222222-2222-4222-8222-222222222222'}
                self.remote_runs[args['fingerprint']] = run
                return {'success': True, 'reserved': True, 'status': 'RESERVED', 'run': copy.deepcopy(run)}
            if action == 'finish':
                run = next(r for r in self.remote_runs.values() if r['run_id'] == args['run_id'])
                run['status'] = args['status']
                return {'success': True, 'status': run['status']}
        return super().request(gateway, token, name, args)

    def test_external_draft_discovered_without_adoption_or_local_pending(self):
        self.d['job'].update(status='DRAFT', result_payload={})
        self.context['pending_reviews_detail'] = []
        report = self.worker().tick(False)
        self.assertEqual(report['phase'], 'COORDINATE')
        self.assertEqual(self.calls, 0)
        self.assertFalse(self.remote_runs)

    def test_loss_of_local_cache_never_repeats_uncertain_inference(self):
        self.runner_mode = 'NO_EFFECT'
        self.assertEqual(self.run_tick()['status'], 'NEEDS_ATTENTION')
        (self.path/'workflow-state.json').unlink()
        self.assertEqual(self.run_tick()['status'], 'WORKFLOW_NEEDS_ATTENTION')
        self.assertEqual(self.calls, 1)

    def test_reservation_in_bank_precedes_inference_and_token_never_printed(self):
        original = self.runner
        def runner(*args):
            self.assertTrue(any(r['status'] == 'STARTED' for r in self.remote_runs.values()))
            return original(*args)
        self.runner = runner
        report = self.run_tick()
        self.assertNotIn('run_token', json.dumps(report))
        self.assertEqual(next(iter(self.remote_runs.values()))['status'], 'CONFIRMED')

    def test_canonical_unavailable_does_not_fall_back_to_paid_execution(self):
        original = self.request
        def request(gateway, token, name, args):
            if name == 'workflow_checkpoint': raise RuntimeError('Unavailable')
            return original(gateway, token, name, args)
        self.request = request
        with self.assertRaises(RuntimeError): self.run_tick()
        self.assertEqual(self.calls, 0)

    def test_final_package_does_not_generate_unnecessary_handoff(self):
        approve(self.d)
        self.d['job']['result_payload']['delivery'] = {'stage': 'FINAL', 'audience': 'FOUNDER'}
        self.assertIsNone(wf.phase_for(self.d))

    def test_personal_scope_not_adopted_into_business_continuity(self):
        self.d['job']['scope_type'] = 'PERSONAL'
        self.config['adopt_job_ids'] = [JOB]
        self.assertFalse(wf.permitted(self.d, self.config))


class WorkflowDeadlineTests(unittest.TestCase):
    def test_reasoning_budget_is_bounded_below_canonical_lease(self):
        with patch.object(wf.dispatch, 'native_cli_command', return_value=['hermes']), \
             patch.object(wf.subprocess, 'Popen') as spawn:
            spawn.return_value.wait.return_value = 0
            self.assertEqual(wf.run_query('hermes', 'helena--grupo', Path('.'), 'test', 'test'), 0)
            spawn.return_value.wait.assert_called_once_with(timeout=570)
            self.assertLess(wf.WORKFLOW_TIMEOUT_SECONDS, 600)

    def test_deadline_stops_process_and_reports_uncertain_result(self):
        with patch.object(wf.dispatch, 'native_cli_command', return_value=['hermes']), \
             patch.object(wf.subprocess, 'Popen') as spawn, \
             patch.object(wf.os, 'killpg', create=True) as kill, \
             patch.object(wf.signal, 'SIGKILL', 9, create=True):
            spawn.return_value.pid = 123
            spawn.return_value.wait.side_effect = [wf.subprocess.TimeoutExpired('hermes', 480), 0]
            self.assertEqual(wf.run_query('hermes', 'helena--grupo', Path('.'), 'test', 'test'), 124)
            kill.assert_called_once_with(123, 9)


if __name__ == '__main__': unittest.main()


class MultiBusinessScopeTests(unittest.TestCase):
    def test_profile_serves_home_and_confirmed_companies_only(self):
        ravi = {'business_id': 'BIZ-003', 'served_business_ids': ['BIZ-001', 'BIZ-003', 'BIZ-004']}
        self.assertTrue(wf.serves(ravi, 'BIZ-003'))
        self.assertTrue(wf.serves(ravi, 'BIZ-001'))
        self.assertFalse(wf.serves(ravi, 'BIZ-002'))
        self.assertFalse(wf.serves(ravi, None))
        self.assertTrue(wf.serves({'business_id': 'BIZ-003'}, 'BIZ-003'))  # contexto antigo sem a lista
        self.assertFalse(wf.serves({'business_id': 'BIZ-003'}, 'BIZ-001'))




class HandoffClosedTests(unittest.TestCase):
    def test_closed_handoff_keeps_approval_without_successor(self):
        d = detail()
        approve(d)
        self.assertEqual(wf.phase_for(d), ('HANDOFF', 'AGT-01'))
        d['events'].insert(0, {'event_type': 'HANDOFF_CLOSED'})
        self.assertIsNone(wf.phase_for(d))
        self.assertEqual(d['job']['status'], 'COMPLETED')




class HandoffPromptTests(unittest.TestCase):
    def test_handoff_prompt_selects_planned_step_and_forbids_foreign_progress(self):
        d = detail()
        approve(d)
        prompt = wf.make_prompt('HANDOFF', d, 'a' * 64)
        self.assertIn('nao impedem criar a etapa em DRAFT', prompt)
        self.assertIn('Nao use record_progress neste job', prompt)
        self.assertIn('close_handoff=true', prompt)
        self.assertIn('NAO precisam de autorizacao do Fundador', prompt)

    def test_handoff_closed_leaves_cycle_and_rule_version_changes_fingerprint(self):
        d = detail()
        approve(d)
        before = wf.fingerprint(d, 'HANDOFF')
        self.assertNotEqual(before, wf.fingerprint(d, 'REVIEW'))
        d['events'].insert(0, {'event_type': 'HANDOFF_CLOSED'})
        self.assertEqual(wf.next_phase('HANDOFF', {}, d), 'DELIVERED')
        self.assertIsNone(wf.phase_for(d))



class FailedReplanTests(unittest.TestCase):
    def test_recent_failure_goes_to_replan_once_and_old_failure_stays_history(self):
        d = detail()
        d['job'].update(status='FAILED', attempt_count=2, max_attempts=2, completed_at='2026-10-07T14:16:00+00:00', result_payload={})
        self.assertEqual(wf.phase_for(d), ('REPLAN', 'AGT-01'))
        d['events'].insert(0, {'event_type': 'WORKFLOW_replan_job'})
        self.assertIsNone(wf.phase_for(d))
        old = detail()
        old['job'].update(status='FAILED', attempt_count=2, max_attempts=2, completed_at='2026-10-03T10:00:00+00:00', result_payload={})
        self.assertIsNone(wf.phase_for(old))



class ReplacementCoordinationTests(unittest.TestCase):
    def test_coordinate_prompt_releases_replacement_without_extra_technical_proof(self):
        prompt = wf.make_prompt('COORDINATE', detail(), 'a' * 64)
        self.assertIn('Missao substituta (result_payload.replan_of) e execucao nova', prompt)
        self.assertIn('Nao exija prova tecnica adicional nem acione Theo', prompt)


if __name__ == '__main__':
    unittest.main()
