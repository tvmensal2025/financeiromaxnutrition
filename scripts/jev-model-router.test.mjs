import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advise, makeRequest, parseAdvice } from './jev-model-router.mjs';

const response = choice => ({ model: 'jev-1.13.0', answers: { complexity: {
  type: 'choice', choice, confidence: 0.95,
  probabilities: Object.fromEntries(['LUNA','SOL','ASTRA','UNCLEAR'].map(x => [x, x === choice ? 0.95 : 0.05 / 3]))
} } });
const summary = { task: 'Corrigir um rótulo na página de entregas.', context: 'Alteração isolada em um componente; conferir a tela.' };

test('Jev selects the requested tier only from validated typed answers', () => {
  for (const tier of ['LUNA','SOL','ASTRA']) {
    const result = parseAdvice(response(tier));
    assert.equal(result.suggested_subagent_model, `gpt-6-${tier.toLowerCase()}`);
    assert.equal(result.status, 'ADVICE');
  }
  assert.equal(parseAdvice(response('UNCLEAR')).suggested_subagent_model, null);
  const uncertain = response('ASTRA'); uncertain.answers.complexity.confidence = 0.5;
  assert.equal(parseAdvice(uncertain).status, 'REVIEW_REQUIRED');
});

test('missing local key consumes no TypeSafe call and is reported plainly', async () => {
  let called = false;
  const result = await advise(summary, { apiKey: '', fetchImpl: async () => { called = true; } });
  assert.equal(result.status, 'MISSING_LOCAL_TYPESAFE_KEY');
  assert.equal(called, false);
});

test('input is bounded and never contains credential-shaped text', () => {
  assert.equal(JSON.parse(makeRequest(summary)).questions.complexity.type, 'choice');
  assert.throws(() => makeRequest({ task: 'Bearer hhs_' + 'a'.repeat(45) }), /SENSITIVE_INPUT/);
  assert.throws(() => makeRequest({ task: 'x'.repeat(1201) }), /INVALID_SUMMARY/);
});

test('provider errors and invalid replies cannot silently choose a model', async () => {
  const broken = await advise(summary, { apiKey: 'test-key', fetchImpl: async () => new Response('{}') });
  assert.equal(broken.suggested_subagent_model, null);
  const ok = await advise(summary, { apiKey: 'test-key', fetchImpl: async () => new Response(JSON.stringify(response('SOL'))) });
  assert.equal(ok.suggested_subagent_model, 'gpt-6-sol');
  assert.equal(JSON.stringify(ok).includes('test-key'), false);
});
