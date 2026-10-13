import { requireEnv } from './require-env.mjs';
// scripts/set-evolution-webhook.mjs
const EVOLUTION_BASE_URL = 'https://helena-automation-evolution-api.d9v63q.easypanel.host';
const GATEWAY_URL = 'https://helena-automation-helena-gateway.d9v63q.easypanel.host';
const INSTANCE = 'helena_mensagens';

// Como o Helena Gateway já tem a chave, podemos fazer através dele ou direto com a chave se disponível
// Vamos chamar através de uma rota no gateway ou testar diretamente
async function setWebhook() {
  console.log('Configurando Webhook da Evolution API para apontar para o Helena Gateway...');
  
  // Vamos buscar status primeiro
  const statusRes = await fetch(`${GATEWAY_URL}/api/integrations/status`);
  const statusData = await statusRes.json();
  console.log('Evolution status no Gateway:', statusData?.evolution);

  // Chamamos o endpoint do Helena Gateway que configura o webhook da Evolution
  const res = await fetch(`${GATEWAY_URL}/api/integrations/evolution/set-webhook`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${requireEnv('MCP_BEARER_TOKEN')}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await res.json().catch(() => null);
  console.log('Resultado set-webhook:', res.status, data);
}

setWebhook();
