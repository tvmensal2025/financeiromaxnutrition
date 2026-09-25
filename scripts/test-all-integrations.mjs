// scripts/test-all-integrations.mjs
// Teste diagnóstico completo de todos os serviços de integração Helena no EasyPanel

const SERVICES = {
  evolution: 'https://helena-automation-evolution-api.d9v63q.easypanel.host',
  meowcaller: 'https://helena-automation-meowcaller-service.d9v63q.easypanel.host',
  laya: 'https://helena-automation-laya-service.d9v63q.easypanel.host',
  gateway: 'https://helena-automation-helena-gateway.d9v63q.easypanel.host',
  localGateway: 'http://localhost:3999'
};

async function testEndpoint(name, url, options = {}) {
  try {
    const start = Date.now();
    const res = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    });
    const duration = Date.now() - start;
    let data;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text.substring(0, 300);
    }
    return { name, url, status: res.status, ok: res.ok, duration: `${duration}ms`, data };
  } catch (err) {
    return { name, url, error: err.message };
  }
}

async function run() {
  console.log('='.repeat(70));
  console.log('DIAGNÓSTICO COMPLETO DE INTEGRAÇÕES — SISTEMA HELENA (EASYPANEL)');
  console.log('='.repeat(70));

  const results = [];

  // 1. Evolution API base
  console.log('\n[1/7] Testando Evolution API...');
  results.push(await testEndpoint('Evolution API Root', SERVICES.evolution));

  // 2. Meowcaller Health
  console.log('[2/7] Testando Meowcaller Service Health...');
  results.push(await testEndpoint('Meowcaller Health', `${SERVICES.meowcaller}/health`));

  // 3. Laya Service Health
  console.log('[3/7] Testando Laya Service Health...');
  results.push(await testEndpoint('Laya Health', `${SERVICES.laya}/health`));

  // 4. Laya Service Classify
  console.log('[4/7] Testando Laya Service Classify (direto)...');
  results.push(await testEndpoint('Laya Classify', `${SERVICES.laya}/v1/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Quero saber meu plano de suplementação' })
  }));

  // 5. Helena Gateway Remoto (EasyPanel) Health
  console.log('[5/7] Testando Helena Gateway EasyPanel /health...');
  results.push(await testEndpoint('Gateway Remote Health', `${SERVICES.gateway}/health`));

  // 6. Helena Gateway Remoto /api/integrations/status
  console.log('[6/7] Testando Helena Gateway EasyPanel /api/integrations/status...');
  results.push(await testEndpoint('Gateway Remote Integrations Status', `${SERVICES.gateway}/api/integrations/status`));

  // 7. Helena Gateway Remoto /api/integrations/elevenlabs/voices
  console.log('[7/7] Testando Helena Gateway EasyPanel /api/integrations/elevenlabs/voices...');
  results.push(await testEndpoint('Gateway Remote ElevenLabs Voices', `${SERVICES.gateway}/api/integrations/elevenlabs/voices`));

  console.log('\n' + '='.repeat(70));
  console.log('RESULTADOS DOS TESTES');
  console.log('='.repeat(70));
  for (const r of results) {
    console.log(`\n▶ ${r.name}`);
    console.log(`  URL: ${r.url}`);
    if (r.error) {
      console.log(`  ERRO: ${r.error}`);
    } else {
      console.log(`  HTTP: ${r.status} (${r.duration})`);
      console.log(`  BODY: ${JSON.stringify(r.data, null, 2)}`);
    }
  }
}

run();
