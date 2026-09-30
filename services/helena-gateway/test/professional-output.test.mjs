import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { agentQualityContract, validateProfessionalDelivery, validateQualityReview } from '../src/professional-output.mjs';
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
test('Pedido de apenas um story nao exige post; faltas, extras ou duas versoes sao recusados',()=>{
  const context=creativeContext(['story-1']);
  context.job={instruction:context.instruction,business_id:context.business_id};
  const story={slot:'story-1',reference:'ref-story-v1',width:1080,height:1920};
  context.artifact_records=[story]; assert.equal(validateRequestedArtifacts(context).length,1);
  for(const artifacts of [[],[story,{...story,reference:'ref-story-v2'}],[story,{slot:'post',reference:'ref-post',width:1080,height:1350}],[{...story,height:1350}]])
    assert.throws(()=>validateRequestedArtifacts({...context,artifact_records:artifacts}));
});
