// scripts/test-gateway-integrations.mjs
const BASE_URL = 'http://localhost:3999';

async function test(name, path, options = {}) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    });
    const data = await res.json().catch(() => null);
    console.log(`[${res.status}] ${name}:`, JSON.stringify(data, null, 2));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    return { ok: false, error: err.message };
  }
}

async function run() {
  console.log('=== TESTE DE ROTAS DO HELENA GATEWAY LOCAL (PORTA 3999) ===\n');

  // 1. Status Geral
  await test('Status Geral', '/api/integrations/status');

  // 2. Classificação Laya
  await test('Laya Classify', '/api/integrations/laya/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Preciso da segunda via do boleto urgente', business_id: 'BIZ-001' })
  });

  // 3. Meowcaller Status
  await test('Meowcaller Status', '/api/integrations/meowcaller/status');

  // 4. Evolution Status
  await test('Evolution Status', '/api/integrations/evolution/status');

  // 5. ElevenLabs Voices
  await test('ElevenLabs Voices', '/api/integrations/elevenlabs/voices');
}

run();
