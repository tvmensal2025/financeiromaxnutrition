import { requireEnv } from './require-env.mjs';
// scripts/test-remote-evolution.mjs
const GATEWAY_URL = 'https://helena-automation-helena-gateway.d9v63q.easypanel.host';
const MCP_TOKEN = requireEnv('MCP_BEARER_TOKEN');

async function testRemoteEvolution() {
  console.log('Testando conexão Evolution no Gateway remoto...');
  try {
    const res = await fetch(`${GATEWAY_URL}/api/integrations/evolution/connect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCP_TOKEN}`,
        'Accept': 'application/json'
      }
    });
    const data = await res.json();
    console.log('Connect Evolution resultado:', {
      ok: data.ok,
      has_qrcode: Boolean(data.result?.qrcode),
      pairingCode: data.result?.pairingCode,
      status: data.result?.status,
      error: data.error
    });
  } catch (err) {
    console.error('Erro na chamada:', err.message);
  }
}

testRemoteEvolution();
