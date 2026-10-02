"""One authorized, bounded schema repair of Helena's recorded failed handoff.

Dry run by default. Never creates a new copy job, changes attempts, or approves work.
The supplied target, operation key, copy and two visual directions are preserved.
"""
import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, '/data/helena-runtime')
import hermes_dispatch_once as dispatch
from brief_preflight import check_task_brief

ROOT = Path('/data/helena-runtime')
JOB = 'JOB-HR-f4968945ad0ab31bfccc6b611b86b0a8'


def prepare():
    candidates = json.loads((ROOT / 'copy-visual-handoff-candidate.json').read_text())
    assert len(candidates) == 1, 'Expected exactly one rejected handoff'
    payload = dict(candidates[0])
    assert payload['job_id'] == JOB and payload['target_agent_id'] == 'AGT-12'
    assert payload['idempotency_key'] == 'wf:5d72eac5a94407e5eb0f22225e55f510:handoff'
    token = dispatch.token_for(Path('/data/profiles'), 'helena--grupo')
    detail = dispatch.call_tool(dispatch.GATEWAY, token, 'get_job', {'job_id': JOB})
    assert detail['job']['status'] == 'COMPLETED'
    assert detail['task']['row_version'] == payload['expected_task_version'] == 3772
    assert not any(e['event_type'] == 'WORKFLOW_handoff' for e in detail['events'])
    assert detail['job']['evidence_refs'] == ['MEM-HR-661cdb23eb360b55f48737ebb923e8de']
    fence = chr(96) * 3
    before, old = payload['instruction'].split(fence + 'direcao-arte', 1)
    old, after = old.split(fence, 1)
    original = json.loads(old)
    brand = detail['company_identity']['brand_identity']
    assert brand['status'] == 'APPROVED' and brand['logo_approved']
    assert original['brand_version'] == detail['company_identity']['row_version']
    assert original['logo']['asset'] == brand['logo_url']
    pieces = original['pieces']
    assert [p['slot'] for p in pieces] == ['post', 'story']
    assert [p['format'] for p in pieces] == ['1080x1350', '1080x1920']
    protected = [text for p in pieces for text in p['copy'].values()]
    approved = detail['job']['result_payload']['delivery']['content']
    assert all(text in approved for text in protected), 'Copy must match independently approved delivery'
    slots = [('post', pieces[0]), ('story-1', pieces[1])]
    join = lambda key: ' | '.join(slot + ': ' + p[key] for slot, p in slots)
    creative = {
        'business_id': 'BIZ-003', 'brand': brand['name'],
        'brand_version': original['brand_version'], 'logo_asset': original['logo']['asset'],
        'audience': 'Adultos interessados em entender projetos de dados para Inteligencia Artificial.',
        'objective': payload['objective'],
        'verified_facts': ['A Humano Digital orienta e conecta pessoas a projetos compativeis.'],
        'sources': ['MEM-HR-661cdb23eb360b55f48737ebb923e8de'],
        'subject': join('character'), 'scene': join('scene'),
        'composition': join('framing') + ' | ' + join('composition') + ' | Margens: ' +
                       json.dumps(original['margins'], ensure_ascii=False),
        'typography': '; '.join(k + ': ' + v for k, v in original['typography'].items()),
        'palette': ', '.join(original['colors']), 'imagery_method': 'GENERATED_IMAGE',
        'formats': ['post', 'story-1'],
        'exact_copy': '\n\n'.join(slot + ':\n' + '\n'.join(p['copy'].values()) for slot, p in slots),
        'cta': original['cta'],
        'constraints': original['image_style'] + ' ' + ' '.join(original['logo'][k] for k in ['usage', 'placement', 'clearspace']),
        'review': 'Nina/AGT-10 inspeciona os pixels de ambas as imagens e o conjunto, confere copy literal, logo unico e legenda; sem publicacao.'
    }
    payload['instruction'] = before + fence + 'direcao-arte\n' + json.dumps(creative, ensure_ascii=False, separators=(',', ':')) + '\n' + fence + after
    checked = check_task_brief(payload['instruction'], payload['objective'], payload['definition_of_done'],
                               for_design=True, protected_texts=protected)
    assert checked['status'] == 'TECHNICAL_CHECK_PASSED', checked
    receipt = {'job_id': JOB, 'task_version': 3772, 'source_session': '20261002_203918_706531',
               'repair': 'Normalize rejected creative JSON to canonical schema; approved copy unchanged',
               'copy_segments_preserved': len(protected), 'preflight': checked, 'payload': payload}
    (ROOT / 'copy-visual-handoff-normalized.json').write_text(json.dumps(receipt, ensure_ascii=False))
    return payload, token, receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    payload, token, receipt = prepare()
    print(json.dumps({k: receipt[k] for k in ['job_id', 'task_version', 'copy_segments_preserved', 'preflight']}, ensure_ascii=False))
    if args.apply:
        result = dispatch.call_tool(dispatch.GATEWAY, token, 'handoff_task', payload)
        (ROOT / 'copy-visual-handoff-recovery-result.json').write_text(json.dumps(result, ensure_ascii=False))
        print('HANDOFF_RESULT', json.dumps(result, ensure_ascii=False))
