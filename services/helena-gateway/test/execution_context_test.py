import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from hermes_execution_context import execution_packet, compact_exact_values


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
        self.assertEqual(packet['creative_quality']['version'], 'creative-quality-v3')
        self.assertIn('review', packet['creative_quality']['rules'])

    def test_does_not_smuggle_previous_submission_into_new_execution(self):
        packet=json.loads(execution_packet(self.detail()))
        self.assertNotIn('submitted_delivery',packet)

    def test_same_evidence_with_approved_output_enrichment_is_merged_losslessly(self):
        d = self.detail()
        enriched = {**d['evidence_records'][0], 'approved_output': {'copy':'Copy literal aprovada'}}
        d['input_evidence_records'] = [enriched]
        d['source_evidence_records'] = [dict(d['evidence_records'][0])]
        self.assertEqual(json.loads(execution_packet(d))['evidence_records'], [enriched])

    def test_shared_evidence_content_or_version_conflict_is_still_rejected(self):
        for field, value in [('registro','Different content'), ('row_version',2)]:
            d = self.detail()
            d['evidence_records'][0]['row_version'] = 1
            d['input_evidence_records'] = [{**d['evidence_records'][0], field:value}]
            with self.assertRaisesRegex(ValueError, 'Conflicting evidence versions'):
                execution_packet(d)

    def test_coordinator_receives_actual_block_without_reusing_delivery(self):
        d = self.detail()
        d['job']['result_payload'].update(decisao_necessaria='Confirmar acesso de Nina aos pixels',
            contexto='Arquivos existentes, ainda nao submetidos', impacto='Revisao impedida')
        d['runtime_binding'] = {'agent_id':'AGT-04','business_id':'BIZ-003','status':'ACTIVE'}
        for phase in ('COORDINATE','RESOLVE'):
            packet = json.loads(execution_packet(d, phase))
            self.assertEqual(packet['blocking_decision']['decisao_necessaria'], 'Confirmar acesso de Nina aos pixels')
            self.assertEqual(packet['runtime_binding'], d['runtime_binding'])
            self.assertNotIn('submitted_delivery', packet)
        self.assertNotIn('blocking_decision', json.loads(execution_packet(d)))

    def test_cross_company_input_or_task_is_refused(self):
        for key in ('task','evidence'):
            d=self.detail()
            if key=='task':d['task']['business_id']='BIZ-OTHER'
            else:d['evidence_records'][0]['business_id_area']='BIZ-OTHER'
            with self.assertRaises(ValueError):execution_packet(d)

    def test_revision_is_distinct_scoped_and_existing_correction_is_explicit(self):
        d = self.detail()
        record = {'id':'MEM-OLD', 'related_object_id':'JOB-X', 'business_id_area':'BIZ-003',
                  'use':'REVISION_ONLY', 'approved_output':None, 'registro':'Texto a corrigir'}
        d['revision_evidence_records'] = [record]
        d['job']['result_payload'].update(reviewed_by='AGT-16', brief_revision_history=[
            {'reviewed_by':'AGT-16', 'review_reason':'Corrigir o CTA', 'revision_summary':'CTA corrigido'}])
        packet = json.loads(execution_packet(d, 'COORDINATE'))
        self.assertEqual(packet['revision_evidence_records'], [record])
        self.assertTrue(packet['brief_correction']['already_revised_for_current_review'])
        self.assertNotIn(record, packet['evidence_records'])
        for changes in ({'related_object_id':'OTHER'}, {'business_id_area':'BIZ-002'}, {'use':'APPROVED'}):
            d['revision_evidence_records'] = [{**record, **changes}]
            with self.assertRaisesRegex(ValueError, 'Revision evidence packet scope mismatch'):
                execution_packet(d)

    def test_replan_packet_carries_lineage_and_review(self):
        d = self.detail()
        d['job']['result_payload'].update(reviewed_by='AGT-01', replan_count=1, replan_root='JOB-ROOT')
        packet = json.loads(execution_packet(d, 'REPLAN'))
        self.assertEqual(packet['replan'], {'replan_count': 1, 'replan_root': 'JOB-ROOT'})
        self.assertEqual(packet['review']['review_reason'], 'Corrigir o CTA')
        self.assertIn('brief_correction', packet)
        self.assertEqual(json.loads(execution_packet(self.detail(), 'REPLAN'))['replan'], {'replan_count': 0})

    def test_large_packet_is_refused_instead_of_silently_truncated(self):
        d=self.detail();d['job']['instruction']='x'*201000
        with self.assertRaises(ValueError):execution_packet(d)

    def test_large_repeated_context_is_compacted_losslessly(self):
        d = self.detail()
        repeated = 'Copy literal com acentos e condições. ' * 3000
        d['job']['instruction'] = repeated
        d['company_identity'] = {'approved_copy': repeated}
        packet = json.loads(execution_packet(d, 'HANDOFF'))
        self.assertEqual(packet['job']['instruction'], repeated)
        self.assertEqual(packet['company_identity']['approved_copy'], {'$ref':'#/job/instruction'})
        self.assertEqual(packet['exact_references']['/company_identity/approved_copy'], '/job/instruction')
        self.assertFalse(len(json.dumps(packet, ensure_ascii=False)) > 200000)
        self.assertIs(packet['truncated'], False)

    def test_exact_reference_roundtrip_nested_values_and_pointer_escaping(self):
        from copy import deepcopy
        text = 'Texto integral, sem resumo. ' * 50
        original = {'a/b~c':{'items':[text, {'$ref':'original business data', 'value':text}]},
                    'copy':{'items':[text, {'$ref':'original business data', 'value':text}]},
                    'different':text+'X'}
        packet = compact_exact_values(original)
        references = packet.pop('exact_references')
        packet.pop('packet_encoding')
        def locate(path):
            keys = [part.replace('~1','/').replace('~0','~') for part in path.split('/')[1:]]
            current = packet
            for key in keys[:-1]: current = current[int(key)] if isinstance(current,list) else current[key]
            return current, int(keys[-1]) if isinstance(current,list) else keys[-1]
        for target, source in references.items():
            source_parent, source_key = locate(source)
            target_parent, target_key = locate(target)
            target_parent[target_key] = deepcopy(source_parent[source_key])
        self.assertEqual(packet, original)

if __name__=='__main__':unittest.main()
