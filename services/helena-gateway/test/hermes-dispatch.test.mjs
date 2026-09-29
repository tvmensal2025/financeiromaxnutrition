import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hermesApiConfigured, startHermesRun } from '../src/hermes-dispatch.mjs';

const job = { job_id: 'JOB-1', task_id: 'TSK-1', business_id: 'BIZ-003', agent_id: 'AGT-18',
  status: 'READY', objective: 'Preparar roteiro', instruction: 'Usar as fontes aprovadas para preparar o roteiro.' };
const task = { task_id: 'TSK-1', business_id: 'BIZ-003', definicao_de_pronto: 'Roteiro documentado e revisavel.' };
const binding = { agent_id: 'AGT-18', business_id: 'BIZ-003', provider: 'HERMES', status: 'ACTIVE', profile_slug: 'pedro--biz003' };
const baseUrl = 'https://hermes.example.invalid';
const keysJson = JSON.stringify({ 'pedro--biz003': 'test-api-key' });

test('API Hermes so aceita HTTPS ou loopback e chaves por perfil', () => {
  assert.equal(hermesApiConfigured('', keysJson), false);
  assert.equal(hermesApiConfigured('http://hermes.example.invalid', keysJson), false);
  assert.equal(hermesApiConfigured(baseUrl, keysJson), true);
});

test('despacho usa perfil certo, chave de repeticao estavel e exige run_id real', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response(JSON.stringify({ run_id: 'run_123', status: 'started' }), { status: 202 });
  };
  const args = { job, task, binding, baseUrl, keysJson, fetchImpl };
  const first = await startHermesRun(args);
  const second = await startHermesRun(args);
  assert.deepEqual(first, { run_id: 'run_123', status: 'started', profile_slug: 'pedro--biz003' });
  assert.equal(requests[0].url, 'https://hermes.example.invalid/p/pedro--biz003/v1/runs');
  assert.equal(requests[0].options.headers['Idempotency-Key'], requests[1].options.headers['Idempotency-Key']);
  assert.match(JSON.parse(requests[0].options.body).input, /submit_delivery/);
  assert.equal(second.run_id, first.run_id);
});

test('briefing incompleto, empresa errada ou resposta sem run_id nao contam como aceite', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return new Response('{}', { status: 202 }); };
  const args = { job, task, binding, baseUrl, keysJson, fetchImpl };
  await assert.rejects(startHermesRun({ ...args, job: { ...job, instruction: '' } }), /Briefing incompleto/);
  await assert.rejects(startHermesRun({ ...args, task: { ...task, business_id: 'BIZ-001' } }), /divergentes/);
  assert.equal(calls, 0);
  await assert.rejects(startHermesRun(args), /sem run_id valido/);
  assert.equal(calls, 1);
});
