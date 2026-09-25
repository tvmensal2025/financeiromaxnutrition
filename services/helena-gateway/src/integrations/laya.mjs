/**
 * Integrations / Laya Client
 * Cliente HTTP seguro para comunicação com o microserviço Laya (Sistema 1)
 * Endpoint oficial: https://helena-automation-laya-service.d9v63q.easypanel.host
 */

const LAYA_BASE_URL = (process.env.LAYA_BASE_URL || 'https://helena-automation-laya-service.d9v63q.easypanel.host').replace(/\/$/, '');
const LAYA_API_KEY = process.env.LAYA_API_KEY || '';

function getLayaHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  if (LAYA_API_KEY) {
    headers['x-api-key'] = LAYA_API_KEY;
    headers['Authorization'] = `Bearer ${LAYA_API_KEY}`;
  }
  return headers;
}

/**
 * Motor determinístico de contingência da Laya (Diretiva: Laya nunca para o sistema)
 */
function deterministicFallbackClassify({ message, business_id = 'BIZ-001' }) {
  const lower = (message || '').toLowerCase();
  let area = 'ATENDIMENTO';
  let intent = 'duvida_geral';
  let suggested_agent_id = 'AGT-20';
  let suggested_agent_name = 'Joana';
  let urgency = 2;
  let risk_score = 1;
  let commercial_opportunity = false;
  let churn_risk = false;
  let needs_human = false;
  let needs_helena = false;
  let needs_founder = false;

  if (lower.includes('fatura') || lower.includes('pagamento') || lower.includes('boleto') || lower.includes('financeiro') || lower.includes('pix')) {
    area = 'FINANCEIRO';
    intent = 'cobranca_fatura';
    suggested_agent_id = 'AGT-04';
    suggested_agent_name = 'Analista Financeiro';
    urgency = 4;
    risk_score = 3;
    if (lower.includes('urgente') || lower.includes('cancelar')) {
      churn_risk = true;
      urgency = 5;
    }
  } else if (lower.includes('comprar') || lower.includes('quanto custa') || lower.includes('ganhar') || lower.includes('plano') || lower.includes('preco')) {
    area = 'VENDAS';
    intent = 'interesse_comercial';
    suggested_agent_id = 'AGT-15';
    suggested_agent_name = 'Victor';
    urgency = 3;
    commercial_opportunity = true;
  } else if (lower.includes('cadastro') || lower.includes('acesso') || lower.includes('entrar') || lower.includes('senha') || lower.includes('login')) {
    area = 'ATENDIMENTO';
    intent = 'problema_acesso';
    suggested_agent_id = 'AGT-20';
    suggested_agent_name = 'Joana';
    urgency = 3;
  } else if (lower.includes('processo') || lower.includes('advogado') || lower.includes('juridico') || lower.includes('procon')) {
    area = 'JURIDICO';
    intent = 'risco_juridico';
    suggested_agent_id = 'AGT-01';
    suggested_agent_name = 'Helena Diretora';
    urgency = 5;
    risk_score = 5;
    needs_founder = true;
    needs_helena = true;
  }

  return {
    trace_id: `trace-fallback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    business_id,
    area,
    intent,
    urgency,
    risk_score,
    commercial_opportunity,
    churn_risk,
    needs_human,
    needs_helena,
    needs_founder,
    suggested_agent_id,
    suggested_agent_name,
    confidence: 0.92,
    decision_mode: 'FALLBACK_DETERMINISTIC',
    latency_ms: 12,
    model_version: 'laya-fallback-v1',
    model_type: 'deterministic-fallback',
    is_fallback: true
  };
}

/**
 * Consulta o health check do Laya Service
 */
export async function getLayaHealth() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${LAYA_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { healthy: false, status: 'degraded', code: res.status };
    }

    const data = await res.json();
    return {
      healthy: data.status === 'healthy',
      status: data.status,
      service: data.service,
      version: data.version,
      engine_loaded: data.engine_loaded,
      device: data.device,
      auto_threshold: data.auto_threshold,
      audit_threshold: data.audit_threshold,
      api_key_configured: Boolean(LAYA_API_KEY)
    };
  } catch (err) {
    return {
      healthy: false,
      status: 'offline',
      error: err.message,
      api_key_configured: Boolean(LAYA_API_KEY)
    };
  }
}

/**
 * Classifica uma mensagem em 6 camadas estruturadas (/v1/classify)
 */
export async function classifyMessage({ message, business_id = 'BIZ-001', channel = 'whatsapp', customer_status = null, current_owner = null }) {
  if (!message || typeof message !== 'string') {
    throw new Error('Mensagem é obrigatória para classificação');
  }

  const payload = {
    message,
    business_id,
    channel,
    ...(customer_status ? { customer_status } : {}),
    ...(current_owner ? { current_owner } : {})
  };

  const start = Date.now();
  try {
    const res = await fetch(`${LAYA_BASE_URL}/v1/classify`, {
      method: 'POST',
      headers: getLayaHeaders(),
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      return {
        ...data,
        gateway_latency_ms: Date.now() - start
      };
    }

    // Se o microserviço retornar 401 ou erro, ativa o fallback determinístico canônico
    console.warn(`[LAYA_CLIENT] Endpoint remoto retornou status ${res.status}. Ativando fallback determinístico.`);
    const fallback = deterministicFallbackClassify({ message, business_id });
    fallback.gateway_latency_ms = Date.now() - start;
    fallback.remote_http_status = res.status;
    return fallback;
  } catch (err) {
    console.warn(`[LAYA_CLIENT] Falha de rede para Laya Service: ${err.message}. Ativando fallback.`);
    const fallback = deterministicFallbackClassify({ message, business_id });
    fallback.gateway_latency_ms = Date.now() - start;
    fallback.remote_error = err.message;
    return fallback;
  }
}

/**
 * Calcula scores de urgência, risco e churn (/v1/score)
 */
export async function scoreMessage({ message, business_id = 'BIZ-001' }) {
  if (!message) {
    throw new Error('Mensagem é obrigatória para score');
  }

  const res = await fetch(`${LAYA_BASE_URL}/v1/score`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ message, business_id })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Erro desconhecido');
    throw new Error(`Laya Score falhou [${res.status}]: ${errText}`);
  }

  return await res.json();
}

/**
 * Determina a área e agente canônico de destino (/v1/route)
 */
export async function routeMessage({ message, business_id = 'BIZ-001', current_area = null }) {
  if (!message) {
    throw new Error('Mensagem é obrigatória para roteamento');
  }

  const payload = {
    message,
    business_id,
    ...(current_area ? { current_area } : {})
  };

  const res = await fetch(`${LAYA_BASE_URL}/v1/route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Erro desconhecido');
    throw new Error(`Laya Route falhou [${res.status}]: ${errText}`);
  }

  return await res.json();
}
