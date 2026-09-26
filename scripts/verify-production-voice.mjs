// scripts/verify-production-voice.mjs
const GATEWAY_URL = 'https://helena-automation-helena-gateway.d9v63q.easypanel.host';
const GATEWAY_KEY = 'helena_mcp_sec_91b7d5e4a2c0836471fa2840be6d3c9514782f';

async function main() {
  console.log('=== 1. Testando Status Geral do Helena Gateway ===');
  const statusRes = await fetch(`${GATEWAY_URL}/api/integrations/status`, {
    headers: { Authorization: `Bearer ${GATEWAY_KEY}` }
  });
  const statusData = await statusRes.json();
  console.log('Status HTTP:', statusRes.status);
  console.log('Status geral:', JSON.stringify(statusData, null, 2));

  console.log('\n=== 2. Testando Voice Agent Settings (Cérebro & Memória de Produtos) ===');
  const agentRes = await fetch(`${GATEWAY_URL}/api/integrations/voice-agent/settings`, {
    headers: { Authorization: `Bearer ${GATEWAY_KEY}` }
  });
  const agentData = await agentRes.json();
  console.log('Voice Agent Settings HTTP:', agentRes.status);
  console.log('Agent Name:', agentData.settings?.agent_name);
  console.log('Voice ID:', agentData.settings?.voice_id);
  console.log('Speech Active:', agentData.settings?.speech_active);
  console.log('Inbound Greeting:', agentData.settings?.inbound_greeting);
  console.log('Outbound Greeting:', agentData.settings?.outbound_greeting);
  console.log('Knowledge Base Length (chars):', agentData.settings?.knowledge_base?.length);

  console.log('\n=== 3. Testando Diálogo Inteligente do Pedro com Síntese Kokoro ===');
  const dialogueRes = await fetch(`${GATEWAY_URL}/api/integrations/voice-agent/test-dialogue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GATEWAY_KEY}`
    },
    body: JSON.stringify({
      prompt: 'Olá, vocês têm creatina monohidratada e qual é o frete para São Paulo?'
    })
  });
  const dialogueData = await dialogueRes.json();
  console.log('Dialogue HTTP:', dialogueRes.status);
  console.log('Resposta Gerada pelo Pedro:\n', dialogueData.speechText);
  console.log('Áudio Synthesized:', Boolean(dialogueData.audioBase64));
  if (dialogueData.audioBase64) {
    console.log('Tamanho do Áudio Base64 (chars):', dialogueData.audioBase64.length);
  }

  console.log('\n=== 4. Testando Status do Meowcaller VoIP ===');
  const meowRes = await fetch(`${GATEWAY_URL}/api/integrations/meowcaller/status`, {
    headers: { Authorization: `Bearer ${GATEWAY_KEY}` }
  });
  const meowData = await meowRes.json();
  console.log('Meowcaller Status HTTP:', meowRes.status);
  console.log('Meowcaller State:', meowData.session?.status, '| Phone:', meowData.session?.phone || 'Conectado');

  console.log('\n========================================');
  console.log('TODOS OS TESTES DE PRODUÇÃO EXECUTADOS!');
  console.log('========================================');
}

main().catch((err) => {
  console.error('Erro na verificação de produção:', err);
  process.exit(1);
});
