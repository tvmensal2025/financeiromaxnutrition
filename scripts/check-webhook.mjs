// scripts/check-webhook.mjs
const EVOLUTION_URL = 'https://helena-automation-evolution-api.d9v63q.easypanel.host';
const INSTANCE = 'helena_mensagens';
const API_KEY = 'helena_evo_master_secret_2026_98a7f';
const GATEWAY_WEBHOOK = 'https://helena-automation-helena-gateway.d9v63q.easypanel.host/webhooks/evolution';

async function checkAndSetWebhook() {
  console.log('1. Consultando webhook atual na Evolution API...');
  try {
    const findRes = await fetch(`${EVOLUTION_URL}/webhook/find/${INSTANCE}`, {
      headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' }
    });
    const findData = await findRes.json().catch(() => null);
    console.log('Webhook atual:', findRes.status, findData);

    console.log('\n2. Configurando webhook para apontar para o Helena Gateway...');
    const setRes = await fetch(`${EVOLUTION_URL}/webhook/set/${INSTANCE}`, {
      method: 'POST',
      headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: GATEWAY_WEBHOOK,
          byEvents: false,
          base64: false,
          events: [
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'CONNECTION_UPDATE'
          ]
        }
      })
    });
    const setData = await setRes.json().catch(() => null);
    console.log('Resultado configuração webhook:', setRes.status, setData);
  } catch (err) {
    console.error('Erro:', err.message);
  }
}

checkAndSetWebhook();
