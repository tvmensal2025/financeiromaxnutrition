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
        self.assertEqual(self.worker().state['pending'][JOB]['agent_id'],'AGT-04')
        self.assertEqual(self.calls,1)

    def test_changes_return_to_coordinator(self):
        self.runner_mode='REQUEST_CHANGES'
        self.assertEqual(self.run_tick()['next_phase'],'COORDINATE')

    def test_no_effect_not_paid_again(self):
        self.runner_mode='NO_EFFECT'
        self.assertEqual(self.run_tick()['status'],'NEEDS_ATTENTION')
        self.assertEqual(self.run_tick()['status'],'NO_NEW_REVIEW')
        self.assertEqual(self.calls,1)

    def test_crash_reconciles_without_second_review(self):
        worker=self.worker()
        key=wf.fingerprint(self.d,'REVIEW')
        worker.state['receipts'][key]={'status':'STARTED','phase':'REVIEW','job_id':JOB}
        worker.persist()
        approve(self.d)
        # Dry-run cannot mutate jobs, but reconciles the durable local receipt.
        with self.assertRaises(RuntimeError): worker.tick(False)
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

    def test_exhausted_attempts_do_not_spend_on_coordination(self):
        self.d['job'].update(attempt_count=2,max_attempts=2,result_payload={})
        result=self.run_tick()
        self.assertEqual(result['status'],'ATTEMPT_LIMIT')
        self.assertFalse(result['model_started'])
        self.assertEqual(self.calls,0)

    def test_exhausted_job_does_not_starve_independent_review(self):
        blocked = copy.deepcopy(self.d)
        blocked['job'].update(job_id=CHILD, attempt_count=2, max_attempts=2, result_payload={})
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
        self.assertEqual(worker.tick()['status'],'NO_NEW_REVIEW')
        self.assertFalse(worker.state['pending'])

    def test_adopted_job_outside_compact_context_is_not_starved(self):
        self.context['pending_reviews_detail']=[]
        self.config['adopt_job_ids']=[JOB]
        (self.path/'workflow-config.json').write_text(json.dumps(self.config))
        self.assertEqual(self.run_tick()['next_phase'],'HANDOFF')

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
                self.assertEqual(profile,'marina--biz003')
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

if __name__ == '__main__': unittest.main()
