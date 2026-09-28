// scripts/inspect-meowcaller-api.mjs
const MEOWCALLER_URL = 'https://helena-automation-meowcaller-service.d9v63q.easypanel.host';
const MEOWCALLER_TOKEN = 'helena_mcp_sec_91b7d5e4a2c0836471fa2840be6d3c9514782f';

async function testMeowcaller() {
  console.log('--- 1. GET /health ---');
  const hRes = await fetch(`${MEOWCALLER_URL}/health`);
  console.log('/health:', hRes.status, await hRes.json().catch(() => null));

  console.log('\n--- 2. GET /v1/session ---');
  const sRes = await fetch(`${MEOWCALLER_URL}/v1/session`, {
    headers: { 'Authorization': `Bearer ${MEOWCALLER_TOKEN}` }
  });
  console.log('/v1/session:', sRes.status, await sRes.json().catch(() => null));

  console.log('\n--- 3. POST /v1/session (Start Session / Request QR) ---');
  const postSRes = await fetch(`${MEOWCALLER_URL}/v1/session`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MEOWCALLER_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });
  console.log('POST /v1/session:', postSRes.status, await postSRes.json().catch(() => null));

  console.log('\n--- 4. GET /v1/session/qr or /qr ---');
  const qrRes = await fetch(`${MEOWCALLER_URL}/v1/session/qr`, {
    headers: { 'Authorization': `Bearer ${MEOWCALLER_TOKEN}` }
  });
  console.log('GET /v1/session/qr:', qrRes.status, await qrRes.text().catch(() => null));

  console.log('\n--- 5. GET /v1/calls ---');
  const callsRes = await fetch(`${MEOWCALLER_URL}/v1/calls`, {
    headers: { 'Authorization': `Bearer ${MEOWCALLER_TOKEN}` }
  });
  console.log('GET /v1/calls:', callsRes.status, await callsRes.json().catch(() => null));
}

testMeowcaller();
