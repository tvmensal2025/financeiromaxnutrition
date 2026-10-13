import { requireEnv } from './require-env.mjs';
// scripts/test-remote-meowcaller.mjs

const GATEWAY_URL = 'https://helena-automation-helena-gateway.d9v63q.easypanel.host';
const MCP_TOKEN = requireEnv('MCP_BEARER_TOKEN');

async function testRemoteMeowcaller() {
  console.log('Testando Meowcaller no Gateway remoto...');
  try {
    const res = await fetch(`${GATEWAY_URL}/api/integrations/meowcaller/status`, {
      headers: {
        'Authorization': `Bearer ${MCP_TOKEN}`,
        'Accept': 'application/json'
      }
    });
    const data = await res.json();
    console.log('Status Meowcaller no Gateway remoto:', JSON.stringify(data, null, 2));

    const resConn = await fetch(`${GATEWAY_URL}/api/integrations/meowcaller/connect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MCP_TOKEN}`,
        'Accept': 'application/json'
      }
    });
    const dataConn = await resConn.json();
    console.log('Connect Meowcaller no Gateway remoto:', JSON.stringify(dataConn, null, 2));
  } catch (err) {
    console.error('Erro:', err.message);
  }
}

testRemoteMeowcaller();
