import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCreativeBrief } from '../src/creative-brief.mjs';

// Same candidates are consumed by the installed Python preflight tests.
const cases = JSON.parse(readFileSync(new URL('./fixtures/creative-contract.json', import.meta.url), 'utf8'));
const wrap = value => '```direcao-arte\n' + JSON.stringify(value) + '\n```';
test('gateway agrees with Python preflight fixtures, including incomplete visual handoffs', () => {
  assert.equal(validateCreativeBrief(wrap(cases.valid), 'BIZ-003').brand_version, 3038);
  for (const patch of cases.invalid_patches) {
    assert.throws(() => validateCreativeBrief(wrap({ ...cases.valid, ...patch }), 'BIZ-003'));
  }
  for (const field of Object.keys(cases.valid)) {
    const candidate = { ...cases.valid };
    delete candidate[field];
    assert.throws(() => validateCreativeBrief(wrap(candidate), 'BIZ-003'));
  }
});
