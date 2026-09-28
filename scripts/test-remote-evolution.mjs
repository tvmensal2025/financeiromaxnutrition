// scripts/test-remote-evolution.mjs
const GATEWAY_URL = 'https://helena-automation-helena-gateway.d9v63q.easypanel.host';
const MCP_TOKEN = 'helena_mcp_sec_91b7d5e4a2c0836471fa2840be6d3c9514782f';

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
