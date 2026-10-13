import { requireEnv } from './require-env.mjs';
// scripts/test-poll-deploy.mjs
// Lido aqui no topo (fora do try do laço): sem a variável, o script falha na hora e não tenta 20 vezes.
const MCP_BEARER_TOKEN = requireEnv('MCP_BEARER_TOKEN');

async function poll() {
  console.log('Aguardando build dos containers no EasyPanel...');
  for (let i = 1; i <= 20; i++) {
    await new Promise((r) => setTimeout(r, 6000));
    try {
      const res = await fetch('https://helena-automation-helena-gateway.d9v63q.easypanel.host/api/integrations/meowcaller/status', {
        headers: { Authorization: `Bearer ${MCP_BEARER_TOKEN}` }
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`[Tentativa ${i}] Gateway Status:`, data.session?.status, 'QR presente:', Boolean(data.session?.qrcode));

        // Testa pair-phone
        const pairRes = await fetch('https://helena-automation-helena-gateway.d9v63q.easypanel.host/api/integrations/meowcaller/pair-phone', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${MCP_BEARER_TOKEN}`
          },
          body: JSON.stringify({ phone: '11971254913' })
        });
        const pairData = await pairRes.json();
        console.log(`[Tentativa ${i}] Pair-Phone Resposta:`, JSON.stringify(pairData));
        if (pairData.ok && pairData.result?.pairing_code) {
          console.log('\n=============================================');
          console.log('>>> SUCESSO TOTAL! CÓDIGO DE 8 DÍGITOS GERADO:', pairData.result.pairing_code);
          console.log('=============================================\n');
          process.exit(0);
        }
      } else {
        console.log(`[Tentativa ${i}] HTTP ${res.status}`);
      }
    } catch (err) {
      console.log(`[Tentativa ${i}] Falha de rede:`, err.message);
    }
  }
}
poll();
