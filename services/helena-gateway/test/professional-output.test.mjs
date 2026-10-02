import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { agentQualityContract, buildReviewContract, qualityCheckId, qualityReviewSchema, validateProfessionalDelivery, validateQualityReview } from '../src/professional-output.mjs';
import { validateRequestedArtifacts } from '../src/creative-brief.mjs';
import { sampleDelivery, sampleQuality, creativeContext } from './quality-fixtures.mjs';

const roster = JSON.parse(readFileSync(new URL('../../../src/lib/agentes.json',import.meta.url),'utf8'));
for (const agent of roster) test(`Contrato especifico de ${agent.agent_id}: ${agent.agente}`,()=>{
  const contract = agentQualityContract(agent.agent_id);
  assert.equal(contract.name,agent.agente); assert.equal(contract.role,agent.cargo_funcao);
  for (const key of ['required_inputs','deliverables','quality_checks','boundaries']) {
    assert.ok(contract[key].length >= 2); assert.equal(new Set(contract[key]).size,contract[key].length);
    assert.ok(contract[key].every(item=>typeof item==='string' && item.length >= 20));
  }
  assert.equal(contract.scope,agent.agent_id==='AGT-01'?'GROUP':agent.agent_id==='AGT-02'?'PERSONAL':'BUSINESS');
});

test('Resultado sem conteudo utilizavel ou com evidencia emprestada e recusado',()=>{
  const delivery = sampleDelivery();
  assert.equal(validateProfessionalDelivery(delivery,['MEM-HR-1']).schema_version,1);
  assert.throws(()=>validateProfessionalDelivery(undefined,['MEM-HR-1']),/exige delivery/);
  assert.throws(()=>validateProfessionalDelivery({...delivery,content:'verified=true, SHA256 da arte conferido.'},['MEM-HR-1']),/dados internos/);
  assert.throws(()=>validateProfessionalDelivery(delivery,['ref-alheia']),/EVIDENCE_REFERENCE_MISMATCH/);
});
test('etapa final explicita preserva evidencias e exige revisao independente',()=>{
  const final = {...sampleDelivery(), stage:'FINAL'};
  assert.equal(validateProfessionalDelivery(final,['MEM-HR-1']).stage,'FINAL');
  assert.throws(()=>validateProfessionalDelivery({...final,stage:'APPROVED'},['MEM-HR-1']));
  assert.throws(()=>validateQualityReview(undefined,final,['MEM-HR-1']),/quality_review/);
  assert.ok(buildReviewContract({job:{evidence_refs:['MEM-HR-1'],result_payload:{delivery:final}},task:{row_version:1}}));
});
test('referencia incorreta explica como corrigir sem inventar ou aprovar evidencia',()=>{
  const delivery=sampleDelivery();
  delivery.acceptance_checks[0].evidence_ref='delivery:plano:secao-1';
  assert.throws(()=>validateProfessionalDelivery(delivery,['MEM-HR-1']), error=>
    error.message.includes('EVIDENCE_REFERENCE_MISMATCH') && error.message.includes('MEM-HR-1')
    && error.message.includes('delivery:plano:secao-1') && error.message.includes('finding'));
  delivery.acceptance_checks[0].evidence_ref='MEM-HR-1';
  assert.equal(validateProfessionalDelivery(delivery,['MEM-HR-1']).schema_version,1);
  delivery.acceptance_checks.push({...delivery.acceptance_checks[0]});
  assert.throws(()=>validateProfessionalDelivery(delivery,['MEM-HR-1']),/ACCEPTANCE_CRITERIA_DUPLICATED/);
});
test('Parecer generico ou sobre versao diferente nao aprova a entrega',()=>{
  const delivery = sampleDelivery(); const review = sampleQuality(delivery);
  assert.equal(validateQualityReview(review,delivery,['MEM-HR-1']).requirements_met,true);
  assert.throws(()=>validateQualityReview(undefined,delivery,['MEM-HR-1']),/quality_review/);
  assert.throws(()=>validateQualityReview({...review,verified_criteria:['Outro requisito qualquer']},delivery,['MEM-HR-1']),/exatamente/);
  assert.throws(()=>validateQualityReview({...review,inspected_evidence_refs:['ref-v2']},delivery,['MEM-HR-1']),/exatamente/);
});

function idReview(delivery, refs = ['MEM-HR-1']) {
  const { verified_criteria, ...review } = sampleQuality(delivery, refs);
  return { ...review, verified_check_ids: delivery.acceptance_checks.map(check => qualityCheckId(check.criterion)) };
}

test('criterion de 300 caracteres pode ser revisado por ID e vira texto canonico sem corte', () => {
  const delivery = sampleDelivery();
  delivery.acceptance_checks[0].criterion = 'Conferir texto, escopo e evidencias da entrega. '.padEnd(300, 'x');
  const canonical = validateProfessionalDelivery(delivery, ['MEM-HR-1']);
  const review = idReview(canonical);
  const normalized = validateQualityReview(review, canonical, ['MEM-HR-1']);
  assert.equal(normalized.verified_criteria[0], canonical.acceptance_checks[0].criterion);
  assert.equal(normalized.verified_criteria[0].length, 300);
  assert.equal(Object.hasOwn(normalized, 'verified_check_ids'), false);
  assert.equal(normalized.findings, review.findings);
  assert.equal(normalized.requirements_met, true);
  assert.deepEqual(validateQualityReview(sampleQuality(canonical), canonical, ['MEM-HR-1']), normalized);
  assert.throws(() => validateQualityReview({ ...sampleQuality(canonical), verified_criteria: [canonical.acceptance_checks[0].criterion + '.'] }, canonical, ['MEM-HR-1']), error =>
    error.message.includes('300') && error.message.includes('verified_check_ids') && error.message.includes('REVIEW_CONTRACT_MISMATCH'));
});

test('parafrase legada e recusada com diff e orientacao para copiar contrato exato', () => {
  const delivery = sampleDelivery();
  const paraphrase = 'Mensagem compreensivel, sem prometer ganhos';
  assert.throws(() => validateQualityReview({ ...sampleQuality(delivery), verified_criteria: [paraphrase] }, delivery, ['MEM-HR-1']), error =>
    error.message.includes('REVIEW_CONTRACT_MISMATCH') && error.message.includes('verified_criteria') && error.message.includes('missing')
    && error.message.includes(delivery.acceptance_checks[0].criterion) && error.message.includes(paraphrase)
    && error.message.includes('unexpected') && error.message.includes('approval_fields_seed'));
});

test('IDs usam hash UTF-8 do criterion e permanecem estaveis em outra ordem ou versao', () => {
  const delivery = sampleDelivery();
  const first = delivery.acceptance_checks[0];
  const other = { ...first, criterion: 'Conferir a proxima etapa e seu responsavel' };
  const detail = { job: { evidence_refs: ['MEM-HR-1'], result_payload: { delivery } }, task: { row_version: 10 } };
  const contract = buildReviewContract(detail);
  assert.equal(contract.version, 'review-contract-v2');
  assert.equal(contract.criteria[0].check_id, 'C-' + createHash('sha256').update(first.criterion, 'utf8').digest('hex').slice(0, 16));
  const changed = structuredClone(detail);
  changed.task.row_version++;
  changed.job.result_payload.delivery.acceptance_checks = [structuredClone(other), structuredClone(first)];
  const newContract = buildReviewContract(changed);
  assert.equal(newContract.expected_task_version, 11);
  assert.equal(newContract.criteria[1].check_id, contract.criteria[0].check_id);
  changed.job.result_payload.delivery.acceptance_checks[1].criterion += ' e fonte';
  assert.notEqual(buildReviewContract(changed).criteria[1].check_id, contract.criteria[0].check_id);
  assert.throws(() => validateQualityReview(idReview(delivery), changed.job.result_payload.delivery, ['MEM-HR-1']), /QUALITY_REVIEW_MISMATCH.*verified_check_ids/);
  assert.equal(buildReviewContract(detail).criteria[0].check_id, contract.criteria[0].check_id);
});

test('seed contem somente versao, IDs e refs; nao constitui aprovacao nem altera dados originais', () => {
  const delivery = sampleDelivery();
  const detail = { job: { evidence_refs: ['MEM-HR-1'], result_payload: { delivery } }, task: { row_version: 37 } };
  const original = structuredClone(detail);
  const contract = buildReviewContract(detail);
  assert.deepEqual(Object.keys(contract.approval_fields_seed).sort(), ['expected_task_version', 'quality_review']);
  assert.deepEqual(Object.keys(contract.approval_fields_seed.quality_review).sort(), ['inspected_evidence_refs', 'verified_check_ids']);
  assert.equal(qualityReviewSchema.safeParse(contract.approval_fields_seed.quality_review).success, false);
  for (const key of ['findings', 'requirements_met', 'decision']) {
    assert.equal(Object.hasOwn(contract.approval_fields_seed, key), false);
    assert.equal(Object.hasOwn(contract.approval_fields_seed.quality_review, key), false);
  }
  contract.evidence_refs.push('ref-adulterada');
  contract.approval_fields_seed.quality_review.inspected_evidence_refs[0] = 'ref-adulterada';
  contract.criteria[0].criterion = 'Texto adulterado';
  assert.deepEqual(detail, original);
  for (const invalid of [{ ...detail, task: { row_version: 0 } }, { ...detail, task: undefined },
    { ...detail, job: { ...detail.job, evidence_refs: ['ref-alheia'] } },
    { ...detail, job: { ...detail.job, result_payload: {} } }]) assert.equal(buildReviewContract(invalid), null);
});

test('IDs exigem conjunto completo, unico e conhecido; formato abreviado e recusado', () => {
  const delivery = sampleDelivery();
  delivery.acceptance_checks.push({ ...delivery.acceptance_checks[0], criterion: 'Proxima etapa com dono e criterio observavel' });
  const review = idReview(delivery);
  for (const verified_check_ids of [[review.verified_check_ids[0]], [review.verified_check_ids[0], review.verified_check_ids[0]],
    [review.verified_check_ids[0], 'C-0000000000000000']]) {
    assert.throws(() => validateQualityReview({ ...review, verified_check_ids }, delivery, ['MEM-HR-1']), error =>
      error.message.includes('verified_check_ids') && error.message.includes('missing') && error.message.includes('approval_fields_seed'));
  }
  assert.throws(() => validateQualityReview({ ...review, verified_check_ids: [review.verified_check_ids[0], review.verified_check_ids[0]] }, delivery, ['MEM-HR-1']), /duplicates/);
  for (const value of ['C-1234', review.verified_check_ids[0] + '0', review.verified_check_ids[0].toUpperCase()])
    assert.throws(() => validateQualityReview({ ...review, verified_check_ids: [value] }, delivery, ['MEM-HR-1']), /QUALITY_REVIEW_SHAPE/);
  assert.deepEqual(validateQualityReview({ ...review, verified_check_ids: [...review.verified_check_ids].reverse() }, delivery, ['MEM-HR-1']).verified_criteria,
    delivery.acceptance_checks.map(check => check.criterion));
});

test('refs erradas, ausentes ou duplicadas continuam impedindo aprovacao por IDs', () => {
  const delivery = sampleDelivery();
  const review = idReview(delivery, ['MEM-HR-1', 'MEM-HR-2']);
  for (const inspected_evidence_refs of [['MEM-HR-1'], ['MEM-HR-1', 'OUTRA-REF'], ['MEM-HR-1', 'MEM-HR-1', 'MEM-HR-2']])
    assert.throws(() => validateQualityReview({ ...review, inspected_evidence_refs }, delivery, ['MEM-HR-1', 'MEM-HR-2']), error =>
      error.message.includes('inspected_evidence_refs') && error.message.includes('missing')
      && error.message.includes('unexpected') && error.message.includes('duplicates') && error.message.includes('copie'));
  assert.throws(() => validateQualityReview(idReview(delivery), delivery, ['MEM-HR-1', 'MEM-HR-1']), /QUALITY_REVIEW_MISMATCH.*expected_count.*2/);
  assert.throws(() => validateQualityReview({ ...sampleQuality(delivery), verified_criteria: [
    delivery.acceptance_checks[0].criterion, delivery.acceptance_checks[0].criterion
  ] }, delivery, ['MEM-HR-1']), /QUALITY_REVIEW_MISMATCH.*duplicates/);
});

test('exatamente um modo e obrigatorio e IDs nao dispensam findings nem requirements_met', () => {
  const delivery = sampleDelivery();
  const review = idReview(delivery);
  const mixed = { ...review, verified_criteria: sampleQuality(delivery).verified_criteria };
  const { verified_check_ids, ...missingMode } = review;
  for (const invalid of [mixed, missingMode]) {
    assert.equal(qualityReviewSchema.safeParse(invalid).success, false);
    assert.match(qualityReviewSchema.safeParse(invalid).error.message, /REVIEW_CONTRACT_MISMATCH/);
    assert.throws(() => validateQualityReview(invalid, delivery, ['MEM-HR-1']), /QUALITY_REVIEW_MODE.*exatamente um modo/);
  }
  for (const change of [{ findings: 'Conferido.' }, { findings: undefined }, { requirements_met: false },
    { requirements_met: undefined }, { verified_check_ids: [] }, { verified_check_ids: Array(9).fill(verified_check_ids[0]) }])
    assert.throws(() => validateQualityReview({ ...review, ...change }, delivery, ['MEM-HR-1']), /QUALITY_REVIEW_SHAPE/);
});
test('Pedido de apenas um story nao exige post; faltas, extras ou duas versoes sao recusados',()=>{
  const context=creativeContext(['story-1']);
  context.job={instruction:context.instruction,business_id:context.business_id};
  const story={slot:'story-1',reference:'ref-story-v1',width:1080,height:1920};
  context.artifact_records=[story]; assert.equal(validateRequestedArtifacts(context).length,1);
  for(const artifacts of [[],[story,{...story,reference:'ref-story-v2'}],[story,{slot:'post',reference:'ref-post',width:1080,height:1350}],[{...story,height:1350}]])
    assert.throws(()=>validateRequestedArtifacts({...context,artifact_records:artifacts}));
});
