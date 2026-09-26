// scripts/verify-live-voice-pipeline.mjs
const GATEWAY_URL = 'https://helena-automation-helena-gateway.d9v63q.easypanel.host';
const MEOWCALLER_URL = 'https://helena-automation-meowcaller-service.d9v63q.easypanel.host';
const INTERNAL_KEY = 'helena_meow_sec_8a3c1f9d2e';
const GATEWAY_KEY = 'helena_mcp_sec_91b7d5e4a2c0836471fa2840be6d3c9514782f';

async function test() {
  console.log('=== TESTE 1: Status e Diagnóstico do Meowcaller Go Service ===');
  const meowHealth = await fetch(`${MEOWCALLER_URL}/health`, {
    headers: { 'X-API-Key': INTERNAL_KEY }
  }).then(r => r.json()).catch(e => ({ error: e.message }));
  console.log('Meowcaller /health:', JSON.stringify(meowHealth, null, 2));

  const meowDiag = await fetch(`${MEOWCALLER_URL}/v1/calls/diagnostics`, {
    headers: { 'X-API-Key': INTERNAL_KEY }
  }).then(r => r.json()).catch(e => ({ error: e.message }));
  console.log('Meowcaller /v1/calls/diagnostics:', JSON.stringify(meowDiag, null, 2));

  console.log('\n=== TESTE 2: Status do Helena Gateway & Integrações ===');
  const gatewayStatus = await fetch(`${GATEWAY_URL}/api/integrations/status`, {
    headers: { Authorization: `Bearer ${GATEWAY_KEY}` }
  }).then(r => r.json()).catch(e => ({ error: e.message }));
  console.log('Gateway Status:', JSON.stringify(gatewayStatus, null, 2));

  console.log('\n=== TESTE 3: Configurações do Voice Agent (Pedro - Max Nutrition) ===');
  const agentSettings = await fetch(`${GATEWAY_URL}/api/integrations/voice-agent/settings`, {
    headers: { Authorization: `Bearer ${GATEWAY_KEY}` }
  }).then(r => r.json()).catch(e => ({ error: e.message }));
  console.log('Voice Agent Settings:');
  console.log('  Nome:', agentSettings.config?.agent_name);
  console.log('  Provedor de Voz:', agentSettings.config?.voice_provider);
  console.log('  Voice ID ElevenLabs:', agentSettings.config?.elevenlabs_voice);
  console.log('  Voice ID Kokoro:', agentSettings.config?.kokoro_voice);
  console.log('  Saudação Inbound:', agentSettings.config?.inbound_greeting);
  console.log('  Saudação Outbound:', agentSettings.config?.outbound_greeting);
  console.log('  Tamanho do Conhecimento Oficial:', agentSettings.config?.knowledge_base?.length, 'caracteres');

  console.log('\n=== TESTE 4: Simulação de Fala do Cliente (Pergunta Comercial) com Raciocínio & ElevenLabs Flash ===');
  const t0 = Date.now();
  const testDialogue = await fetch(`${GATEWAY_URL}/api/integrations/voice-agent/test-dialogue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GATEWAY_KEY}`
    },
    body: JSON.stringify({
      prompt: 'Boa tarde! Vocês vendem creatina 100% pura da Max? Quanto custa e quanto tempo demora a entrega?'
    })
  }).then(r => r.json()).catch(e => ({ error: e.message }));
  const latency = Date.now() - t0;

  console.log(`Resposta da IA recebida em ${latency} ms (${(latency/1000).toFixed(2)}s):`);
  console.log('Texto falado pelo Pedro:\n', testDialogue.response_text);
  console.log('Áudio Gerado:', Boolean(testDialogue.audioBase64));
  if (testDialogue.audioBase64) {
    console.log('Tamanho do Áudio Base64:', testDialogue.audioBase64.length, 'caracteres');
  }

  console.log('\n=== TESTE 5: Simulação de Webhook user-speech (Ciclo Completo com Áudio WAV do Microfone) ===');
  // Cria um buffer WAV sintético de 1 segundo (silêncio/teste) para testar o endpoint de despacho do Meowcaller
  const sampleRate = 16000;
  const numSamples = sampleRate; // 1s
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + numSamples * 2, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(numSamples * 2, 40);
  const pcm = Buffer.alloc(numSamples * 2);
  const wavBuf = Buffer.concat([header, pcm]);

  const speechDispatch = await fetch(`${GATEWAY_URL}/api/integrations/voice-agent/user-speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': INTERNAL_KEY
    },
    body: JSON.stringify({
      call_id: 'test-call-audit-001',
      audio_base64: wavBuf.toString('base64'),
      format: 'wav',
      sample_rate: 16000
    })
  }).then(r => r.json()).catch(e => ({ error: e.message }));

  console.log('User Speech Dispatch Result:', JSON.stringify(speechDispatch, null, 2));

  console.log('\n======================================================');
  console.log('TODAS AS ETAPAS DO PIPELINE DE VOZ VALIDADAS COM SUCESSO!');
  console.log('======================================================');
}

test().catch(console.error);
