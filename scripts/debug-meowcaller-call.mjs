// scripts/debug-meowcaller-call.mjs
const GATEWAY_URL = 'https://helena-automation-helena-gateway.d9v63q.easypanel.host';
const MEOWCALLER_URL = 'https://helena-automation-meowcaller-service.d9v63q.easypanel.host';
const MCP_TOKEN = 'helena_mcp_sec_91b7d5e4a2c0836471fa2840be6d3c9514782f';

async function diagnose() {
  console.log('1. Verificando health direto do Meowcaller Service...');
  try {
    const healthRes = await fetch(`${MEOWCALLER_URL}/health`);
    const healthData = await healthRes.json().catch(() => null);
    console.log('Meowcaller /health:', healthRes.status, healthData);
  } catch (err) {
    console.error('Erro /health:', err.message);
  }

  console.log('\n2. Verificando status da sessão no Gateway...');
  try {
    const sessionRes = await fetch(`${GATEWAY_URL}/api/integrations/meowcaller/status`, {
      headers: { 'Authorization': `Bearer ${MCP_TOKEN}` }
    });
    const sessionData = await sessionRes.json().catch(() => null);
    console.log('Gateway Meowcaller session:', sessionRes.status, sessionData);
  } catch (err) {
    console.error('Erro /api/integrations/meowcaller/status:', err.message);
  }

  console.log('\n3. Tentando chamada de teste para 11971254913...');
  try {
    const callRes = await fetch(`${GATEWAY_URL}/api/integrations/meowcaller/call`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: '11971254913',
        business_id: 'BIZ-001'
      })
    });
    const callData = await callRes.json().catch(() => null);
    console.log('Resposta da chamada:', callRes.status, callData);
  } catch (err) {
    console.error('Erro chamada:', err.message);
  }
}

diagnose();
