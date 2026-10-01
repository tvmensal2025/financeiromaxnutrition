import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from hermes_execution_context import execution_packet


class ContextTests(unittest.TestCase):
    def detail(self):
        record={'id':'MEM-X','business_id_area':'BIZ-003','registro':'Fonte completa '+('x'*9000)}
        return {'job':{'job_id':'JOB-X','task_id':'TSK-X','business_id':'BIZ-003','instruction':'Brief completo',
                       'result_payload':{'delivery':{'content':'Entrega inspecionavel'},'review_reason':'Corrigir o CTA'}},
                'task':{'task_id':'TSK-X','business_id':'BIZ-003','row_version':12},
                'events':[{'irrelevant_history':'x'*200000}],
                'evidence_records':[record],'input_evidence_records':[record]}

    def test_preserves_complete_sources_once_without_duplicate_history(self):
        d=self.detail()
        packet=json.loads(execution_packet(d,'REVIEW'))
        self.assertEqual(packet['evidence_records'],d['evidence_records'])
        self.assertEqual(packet['submitted_delivery']['delivery'],d['job']['result_payload']['delivery'])
        self.assertEqual(packet['review']['review_reason'],'Corrigir o CTA')
        self.assertNotIn('events',packet)
        self.assertEqual(packet['packet_version'], 'authorized-work-packet-v1')
        self.assertIs(packet['truncated'], False)

    def test_does_not_smuggle_previous_submission_into_new_execution(self):
        packet=json.loads(execution_packet(self.detail()))
        self.assertNotIn('submitted_delivery',packet)

    def test_cross_company_input_or_task_is_refused(self):
        for key in ('task','evidence'):
            d=self.detail()
            if key=='task':d['task']['business_id']='BIZ-OTHER'
            else:d['evidence_records'][0]['business_id_area']='BIZ-OTHER'
            with self.assertRaises(ValueError):execution_packet(d)

    def test_large_packet_is_refused_instead_of_silently_truncated(self):
        d=self.detail();d['job']['instruction']='x'*66000
        with self.assertRaises(ValueError):execution_packet(d)

if __name__=='__main__':unittest.main()
