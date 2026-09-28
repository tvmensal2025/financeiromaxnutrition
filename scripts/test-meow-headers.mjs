// scripts/test-meow-headers.mjs
const MEOWCALLER_URL = 'https://helena-automation-meowcaller-service.d9v63q.easypanel.host';
const KEY = 'helena_meow_sec_8a3c1f9d2e';

const headerVariants = [
  { 'x-api-key': KEY },
  { 'X-API-Key': KEY },
  { 'Authorization': `Bearer ${KEY}` },
  { 'authorization': `Bearer ${KEY}` },
  { 'x-internal-api-key': KEY },
  { 'X-Internal-API-Key': KEY },
  { 'api-key': KEY },
  { 'apikey': KEY }
];

async function run() {
  for (const h of headerVariants) {
    try {
      const res = await fetch(`${MEOWCALLER_URL}/v1/session`, {
        headers: { 'Accept': 'application/json', ...h }
      });
      const data = await res.json().catch(() => null);
      console.log('Header:', Object.keys(h)[0], '-> Status:', res.status, data);
    } catch (e) {
      console.log('Header:', Object.keys(h)[0], '-> Error:', e.message);
    }
  }
}

run();
