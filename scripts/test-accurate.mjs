import { requireEnv } from './require-env.mjs';
// scripts/test-accurate.mjs
const GATEWAY_URL = 'https://helena-automation-helena-gateway.d9v63q.easypanel.host';
const GATEWAY_KEY = requireEnv('MCP_BEARER_TOKEN');

async function main() {
  console.log('=== TESTE 1: Configurações do Voice Agent ===');
  const agentRes = await fetch(`${GATEWAY_URL}/api/integrations/voice-agent/settings`, {
    headers: { Authorization: `Bearer ${GATEWAY_KEY}` }
  });
  const agentData = await agentRes.json();
  const c = agentData.config || {};
  console.log('Ativo:', c.is_active);
  console.log('Provedor de Voz:', c.voice_provider);
  console.log('Voz ElevenLabs:', c.elevenlabs_voice);
  console.log('Voz Kokoro:', c.kokoro_voice);
  console.log('Saudação Entrada:', c.inbound_greeting);
  console.log('Saudação Saída:', c.outbound_greeting);
  console.log('Tamanho da Base de Conhecimento Oficial:', c.knowledge_base?.length, 'caracteres');

  console.log('\n=== TESTE 2: Diálogo Rápido do Pedro (Max Nutrition) ===');
  const t0 = Date.now();
  const dialogueRes = await fetch(`${GATEWAY_URL}/api/integrations/voice-agent/test-dialogue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GATEWAY_KEY}`
    },
    body: JSON.stringify({
      prompt: 'Olá Pedro, vocês têm creatina monohidratada e qual é o frete para São Paulo?'
    })
  });
  const dur = Date.now() - t0;
  const d = await dialogueRes.json();
  console.log(`Resposta recebida em ${dur}ms:`);
  console.log('Texto falado pelo Pedro:\n', d.response_text);
  console.log('Áudio Base64 presente:', Boolean(d.audio_base64));
  if (d.audio_base64) {
    console.log('Tamanho do Áudio Base64:', d.audio_base64.length);
  }
}

main().catch(console.error);
