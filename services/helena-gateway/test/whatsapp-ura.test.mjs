import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  NEUTRAL_BUSINESS_ID,
  NEUTRAL_BRAND_NAME,
  URA_MENU_OPTIONS,
  URA_DEFAULT_ROUTE,
  getWhatsappChannelIdentity,
  matchUraMenuOption,
  resolveUraRoute,
  buildAutoReplyMessage,
  shouldSkipDuplicateAutoReply,
  rememberAutoReplySent,
  resetWhatsappAutoReplyDebounce
} from '../src/whatsapp-ura.mjs';

const originalEnv = { ...process.env };

function restoreIdentityEnv() {
  for (const key of ['WHATSAPP_BUSINESS_ID', 'WHATSAPP_BRAND_NAME', 'WHATSAPP_AUTOREPLY_DEBOUNCE_MS']) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}

beforeEach(() => {
  delete process.env.WHATSAPP_BUSINESS_ID;
  delete process.env.WHATSAPP_BRAND_NAME;
  delete process.env.WHATSAPP_AUTOREPLY_DEBOUNCE_MS;
  resetWhatsappAutoReplyDebounce();
});

afterEach(() => {
  restoreIdentityEnv();
  resetWhatsappAutoReplyDebounce();
});

test('(a) identidade padrão é neutra e não afirma Max Nutrition', () => {
  const identity = getWhatsappChannelIdentity();
  assert.equal(identity.businessId, NEUTRAL_BUSINESS_ID);
  assert.equal(identity.brandName, NEUTRAL_BRAND_NAME);
  assert.equal(identity.configured, false);
  const greeting = buildAutoReplyMessage({ text: 'Olá', pushName: 'Ana' });
  assert.equal(greeting.includes('Max Nutrition'), false);
  assert.equal(greeting.includes('iGreen'), false);
  assert.match(greeting, /nosso canal de atendimento/);
});

test('(a) placeholder CONFIGURAR_SOMENTE_NO_EASYPANEL conta como não configurado', () => {
  process.env.WHATSAPP_BUSINESS_ID = 'CONFIGURAR_SOMENTE_NO_EASYPANEL';
  process.env.WHATSAPP_BRAND_NAME = 'CONFIGURAR_SOMENTE_NO_EASYPANEL';
  const identity = getWhatsappChannelIdentity();
  assert.equal(identity.configured, false);
  assert.equal(identity.businessId, NEUTRAL_BUSINESS_ID);
  assert.equal(buildAutoReplyMessage({ text: 'menu' }).includes('Max Nutrition'), false);
});

test('(a) só marca sem id: texto continua neutro (não afirma marca sem business_id)', () => {
  process.env.WHATSAPP_BRAND_NAME = 'Max Nutrition';
  const identity = getWhatsappChannelIdentity();
  assert.equal(identity.configured, false);
  assert.equal(identity.businessId, NEUTRAL_BUSINESS_ID);
  assert.equal(identity.brandName, NEUTRAL_BRAND_NAME);
  assert.equal(buildAutoReplyMessage({ text: 'Olá' }).includes('Max Nutrition'), false);
});

test('(a) só business_id sem marca: grava o id e não inventa nome de marca', () => {
  process.env.WHATSAPP_BUSINESS_ID = 'BIZ-002';
  const identity = getWhatsappChannelIdentity();
  assert.equal(identity.configured, false);
  assert.equal(identity.businessId, 'BIZ-002');
  assert.equal(identity.brandName, NEUTRAL_BRAND_NAME);
  const greeting = buildAutoReplyMessage({ text: 'Olá', identity });
  assert.equal(greeting.includes('Max Nutrition'), false);
});

test('(a) par completo: texto e id coerentes', () => {
  process.env.WHATSAPP_BUSINESS_ID = 'BIZ-002';
  process.env.WHATSAPP_BRAND_NAME = 'Max Nutrition';
  const identity = getWhatsappChannelIdentity();
  assert.equal(identity.configured, true);
  assert.equal(identity.businessId, 'BIZ-002');
  assert.equal(identity.brandName, 'Max Nutrition');
  const greeting = buildAutoReplyMessage({ text: 'Olá', identity });
  assert.match(greeting, /Max Nutrition/);
});

test('(b) tabela única: opção 1 = Victor AGT-15', () => {
  const route = resolveUraRoute({ text: '1' });
  const reply = buildAutoReplyMessage({ text: '1', route });
  assert.equal(route.agent_id, 'AGT-15');
  assert.equal(route.agent_name, 'Victor');
  assert.match(reply, /Victor/);
  assert.match(reply, /AGT-15/);
  assert.equal(matchUraMenuOption('opção 1').agent_id, route.agent_id);
});

test('(b) tabela única: opção 2 = Joana AGT-20', () => {
  const route = resolveUraRoute({ text: '2' });
  const reply = buildAutoReplyMessage({ text: '2', route });
  assert.equal(route.agent_id, 'AGT-20');
  assert.equal(route.agent_name, 'Joana');
  assert.match(reply, /Joana/);
  assert.match(reply, /AGT-20/);
});

test('(b) tabela única: opção 3 = Caio AGT-05 (não AGT-04 / Marina)', () => {
  const route = resolveUraRoute({ text: '3' });
  const reply = buildAutoReplyMessage({ text: '3', route });
  assert.equal(route.agent_id, 'AGT-05');
  assert.equal(route.agent_name, 'Caio');
  assert.match(reply, /Caio/);
  assert.match(reply, /AGT-05/);
  assert.equal(reply.includes('AGT-04'), false);
  assert.equal(reply.includes('Analista Financeiro (AGT-04)'), false);
});

test('(b) tabela única: opção 4 = Marina AGT-04 (não Helena AGT-01)', () => {
  const route = resolveUraRoute({ text: '4' });
  const reply = buildAutoReplyMessage({ text: '4', route });
  assert.equal(route.agent_id, 'AGT-04');
  assert.equal(route.agent_name, 'Marina');
  assert.match(reply, /Marina/);
  assert.match(reply, /AGT-04/);
  assert.equal(reply.includes('AGT-01'), false);
  assert.equal(/mesa da \*?Helena/i.test(reply), false);
});

test('(b) classificação Laya VENDAS (sem dígito) usa a mesma tabela (Victor)', () => {
  const route = resolveUraRoute({
    text: 'quero um plano',
    classification: { area: 'VENDAS', suggested_agent_id: 'AGT-20' }
  });
  assert.equal(route.agent_id, 'AGT-15');
  const reply = buildAutoReplyMessage({
    text: 'quero um plano',
    classification: { area: 'VENDAS', suggested_agent_id: 'AGT-20' },
    route
  });
  assert.match(reply, /Victor/);
  assert.match(reply, /AGT-15/);
});

test('(b) cada opção da tabela tem agent_id e agent_name alinhados ao diretório', () => {
  const expected = {
    1: { agent_id: 'AGT-15', agent_name: 'Victor' },
    2: { agent_id: 'AGT-20', agent_name: 'Joana' },
    3: { agent_id: 'AGT-05', agent_name: 'Caio' },
    4: { agent_id: 'AGT-04', agent_name: 'Marina' }
  };
  for (const option of URA_MENU_OPTIONS) {
    assert.equal(option.agent_id, expected[option.option].agent_id);
    assert.equal(option.agent_name, expected[option.option].agent_name);
  }
  assert.equal(URA_DEFAULT_ROUTE.agent_id, 'AGT-20');
});

test('(c) textos não prometem retorno em instantes nem prazo automático', () => {
  const samples = [
    buildAutoReplyMessage({ text: 'Olá' }),
    buildAutoReplyMessage({ text: '1' }),
    buildAutoReplyMessage({ text: '2' }),
    buildAutoReplyMessage({ text: '3' }),
    buildAutoReplyMessage({ text: '4' }),
    buildAutoReplyMessage({ text: 'preciso de ajuda com o pedido' })
  ];
  for (const sample of samples) {
    assert.equal(/em instantes/i.test(sample), false, sample);
    assert.equal(/em breve/i.test(sample), false, sample);
    assert.match(sample, /quando o atendimento for assumido|Digite o \*número\*/);
  }
});

test('(c) debounce: mesma resposta ao mesmo número na janela é ignorada', () => {
  process.env.WHATSAPP_AUTOREPLY_DEBOUNCE_MS = '60000';
  const now = 1_000_000;
  const text = buildAutoReplyMessage({ text: 'oi' });
  assert.equal(shouldSkipDuplicateAutoReply('5511999999999', text, now), false);
  rememberAutoReplySent('5511999999999', text, now);
  assert.equal(shouldSkipDuplicateAutoReply('5511999999999', text, now + 32_000), true);
  assert.equal(shouldSkipDuplicateAutoReply('5511999999999', buildAutoReplyMessage({ text: '1' }), now + 32_000), false);
  assert.equal(shouldSkipDuplicateAutoReply('5511888888888', text, now + 32_000), false);
  assert.equal(shouldSkipDuplicateAutoReply('5511999999999', text, now + 60_000), false);
});
