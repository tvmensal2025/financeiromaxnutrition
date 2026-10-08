import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDelivery } from '../src/delivery-check.mjs';

const ok = {
  schema_version: 1, stage: 'INTERMEDIATE', title: 'Comparação das estratégias',
  content: 'Eixo público: dono Marina/AGT-04, revisor Helena/AGT-01; estratégia anterior seção Público × D2 seção Público, delta: foco em adultos com renda extra.',
  next_steps: 'Helena revisa e decide a etapa da Camila com base nesta comparação.',
  limitations: 'Sem pesquisa nova; usa apenas as fontes aprovadas indicadas no resumo.',
  acceptance_checks: [
    { criterion: 'Cada eixo com seção das duas estratégias', finding: 'Os sete eixos citam seção da anterior e da D2 por linha.' },
    { criterion: 'Responsáveis com nome e AGT', finding: 'Dono e revisor aparecem com nome e código AGT em cada linha.' },
    { criterion: 'Material sem códigos internos', finding: 'O conteúdo não traz JOB, MEM nem versões internas.' },
    { criterion: 'Mapa de rastreabilidade no resumo', finding: 'O resumo mapeia cada chave à fonte e versão conhecida.' }
  ]
};
const dod = 'Cada linha com seção/trecho das fontes e chave individual. Dono e revisor com nome/AGT. Material sem IDs internos. Summary com mapa de rastreabilidade completo. Entregar a comparação dos sete eixos.';

test('entrega completa passa e nada é gravado', () => {
  const r = checkDelivery({ delivery: ok, summary: 'x'.repeat(1600), definitionOfDone: dod });
  assert.equal(r.status, 'READY_TO_SUBMIT');
  assert.equal(r.writes, 0);
  assert.deepEqual(r.errors, []);
});

test('barra os erros mecânicos das devoluções reais', () => {
  const bad = { ...ok, content: ok.content + ' Fonte JOB-HR-abc. Prazo a definir. Responsável: Marina.' };
  const codes = checkDelivery({ delivery: bad, summary: 'curto', definitionOfDone: dod }).errors.map(e => e.code);
  for (const code of ['INTERNAL_IDS', 'VAGUE', 'TRACE_IN_SUMMARY', 'OWNER_WITHOUT_AGT']) assert.ok(codes.includes(code), code);
});

test('resumo acima de 8000 é barrado antes do envio', () => {
  const r = checkDelivery({ delivery: ok, summary: 'x'.repeat(8200), definitionOfDone: dod });
  assert.ok(r.errors.some(e => e.code === 'SUMMARY_TOO_LONG'));
});

test('usa o mesmo limite do submit_work: conteúdo acima de 8000 é barrado', () => {
  const r = checkDelivery({ delivery: { ...ok, content: 'Eixo detalhado. '.repeat(600) }, summary: 'x'.repeat(1600), definitionOfDone: dod });
  assert.equal(r.status, 'CORRECT_BEFORE_SUBMIT');
  assert.ok(r.errors.some(e => e.code === 'SCHEMA' && e.field === 'content'));
});

test('esquema inválido volta com campo e mensagem', () => {
  const r = checkDelivery({ delivery: { ...ok, acceptance_checks: [] }, definitionOfDone: dod });
  assert.equal(r.status, 'CORRECT_BEFORE_SUBMIT');
  assert.equal(r.errors[0].code, 'SCHEMA');
});

test('poucas checagens para uma definição longa vira aviso, não bloqueio', () => {
  const r = checkDelivery({ delivery: { ...ok, acceptance_checks: ok.acceptance_checks.slice(0, 1) }, summary: 'x'.repeat(1600), definitionOfDone: dod });
  assert.equal(r.status, 'READY_TO_SUBMIT');
  assert.ok(r.warnings.some(w => w.code === 'FEW_CHECKS'));
});
