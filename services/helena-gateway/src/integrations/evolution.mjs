/**
 * Integrations / Evolution API Client
 * Cliente seguro para comunicação com a Evolution API (WhatsApp Mensagens)
 */

const EVOLUTION_BASE_URL = (
  process.env.EVOLUTION_BASE_URL ||
  process.env.EVOLUTION_URL ||
  'https://helena-automation-evolution-api.d9v63q.easypanel.host'
).replace(/\/$/, '');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || process.env.AUTHENTICATION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || process.env.EVOLUTION_INSTANCE_NAME || 'helena_messages';

/**
 * Retorna true se as credenciais mínimas da Evolution estiverem preenchidas
 */
export function isEvolutionConfigured() {
  return Boolean(EVOLUTION_BASE_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE);
}

function getHeaders() {
  return {
    'apikey': EVOLUTION_API_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
}

/**
 * Consulta o status da conexão da instância Evolution
 */
export async function getEvolutionStatus() {
  if (!isEvolutionConfigured()) {
    return {
      configured: false,
      status: 'NOT_CONFIGURED',
      instance: EVOLUTION_INSTANCE || null,
      message: 'Evolution API não configurada no ambiente (EVOLUTION_BASE_URL/API_KEY)'
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${EVOLUTION_BASE_URL}/instance/connectionState/${encodeURIComponent(EVOLUTION_INSTANCE)}`, {
      method: 'GET',
      headers: getHeaders(),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      // Tenta fallback para /instance/fetchInstances
      return {
        configured: true,
        status: 'DISCONNECTED',
        instance: EVOLUTION_INSTANCE,
        http_status: res.status
      };
    }

    const data = await res.json();
    const state = data?.instance?.state || data?.state || 'DISCONNECTED';

    return {
      configured: true,
      status: state.toUpperCase(), // 'OPEN', 'CONNECTING', 'CLOSE', 'DISCONNECTED'
      connected: state.toUpperCase() === 'OPEN',
      instance: EVOLUTION_INSTANCE,
      raw: data
    };
  } catch (err) {
    return {
      configured: true,
      status: 'ERROR',
      connected: false,
      instance: EVOLUTION_INSTANCE,
      error: err.message
    };
  }
}

/**
 * Garante que a instância existe na Evolution API v2, criando-a automaticamente se necessário
 */
export async function ensureEvolutionInstance() {
  if (!isEvolutionConfigured()) {
    throw new Error('Evolution API não configurada');
  }

  try {
    const createRes = await fetch(`${EVOLUTION_BASE_URL}/instance/create`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        instanceName: EVOLUTION_INSTANCE,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true
      })
    });

    if (createRes.ok) {
      const data = await createRes.json();
      const qr = data?.qrcode?.base64 || data?.qrcode?.code || data?.base64 || data?.code || null;
      const pairing = data?.qrcode?.pairingCode || data?.pairingCode || null;
      return {
        created: true,
        qrcode: qr,
        pairingCode: pairing,
        status: data?.instance?.status || 'CONNECTING',
        data
      };
    }
  } catch (err) {
    console.warn(`[EVOLUTION_CLIENT] Tentativa de criação retornou erro: ${err.message}`);
  }

  return { created: false };
}

/**
 * Inicia conexão e solicita QR Code da instância (com auto-provisionamento)
 */
export async function connectEvolution() {
  if (!isEvolutionConfigured()) {
    throw new Error('Evolution API não configurada');
  }

  // 1. Tenta obter conexão da instância existente
  const res = await fetch(`${EVOLUTION_BASE_URL}/instance/connect/${encodeURIComponent(EVOLUTION_INSTANCE)}`, {
    method: 'GET',
    headers: getHeaders()
  });

  if (res.ok) {
    const data = await res.json();
    // Garante que o webhook está configurado em background
    setEvolutionWebhook().catch(() => {});
    return {
      qrcode: data?.base64 || data?.qrcode?.base64 || data?.code || data?.qrcode || null,
      pairingCode: data?.pairingCode || data?.qrcode?.pairingCode || null,
      status: data?.status || 'CONNECTING'
    };
  }

  // 2. Se a instância não existe (404), cria a instância automaticamente!
  if (res.status === 404) {
    console.log(`[EVOLUTION_CLIENT] Instância "${EVOLUTION_INSTANCE}" não encontrada (404). Provisionando automaticamente...`);
    const provision = await ensureEvolutionInstance();
    if (provision.qrcode || provision.pairingCode) {
      return {
        qrcode: provision.qrcode,
        pairingCode: provision.pairingCode,
        status: provision.status || 'CONNECTING'
      };
    }

    // Tenta conectar novamente após criar a instância
    const retryRes = await fetch(`${EVOLUTION_BASE_URL}/instance/connect/${encodeURIComponent(EVOLUTION_INSTANCE)}`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (retryRes.ok) {
      const data = await retryRes.json();
      return {
        qrcode: data?.base64 || data?.qrcode?.base64 || data?.code || data?.qrcode || null,
        pairingCode: data?.pairingCode || data?.qrcode?.pairingCode || null,
        status: data?.status || 'CONNECTING'
      };
    }
  }

  const errText = await res.text().catch(() => 'Erro ao conectar');
  throw new Error(`Falha ao iniciar conexão Evolution [${res.status}]: ${errText}`);
}

/**
 * Solicita código de pareamento por número de telefone (Pairing Code)
 */
export async function pairEvolution(phoneNumber) {
  if (!isEvolutionConfigured()) {
    throw new Error('Evolution API não configurada');
  }

  const sanitizedPhone = String(phoneNumber).replace(/\D/g, '');
  if (!sanitizedPhone || sanitizedPhone.length < 10) {
    throw new Error('Número de telefone inválido para pareamento');
  }

  // Garante que a instância existe
  await ensureEvolutionInstance();

  let res = await fetch(`${EVOLUTION_BASE_URL}/instance/connect/${encodeURIComponent(EVOLUTION_INSTANCE)}?number=${sanitizedPhone}`, {
    method: 'GET',
    headers: getHeaders()
  });

  if (!res.ok) {
    // Tenta rota alternativa /instance/pairCode/{instance}
    res = await fetch(`${EVOLUTION_BASE_URL}/instance/pairCode/${encodeURIComponent(EVOLUTION_INSTANCE)}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ number: sanitizedPhone })
    });
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Erro ao solicitar pairing code');
    throw new Error(`Falha no pareamento Evolution [${res.status}]: ${errText}`);
  }

  const data = await res.json();
  return {
    pairingCode: data?.pairingCode || data?.code || null,
    status: data?.status || 'CONNECTING',
    raw: data
  };
}

/**
 * Desconecta a sessão ativa da Evolution
 */
export async function disconnectEvolution() {
  if (!isEvolutionConfigured()) {
    throw new Error('Evolution API não configurada');
  }

  const res = await fetch(`${EVOLUTION_BASE_URL}/instance/logout/${encodeURIComponent(EVOLUTION_INSTANCE)}`, {
    method: 'DELETE',
    headers: getHeaders()
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Erro ao desconectar');
    throw new Error(`Falha ao desconectar Evolution [${res.status}]: ${errText}`);
  }

  return await res.json().catch(() => ({ ok: true }));
}

/**
 * Envia mensagem de texto via Evolution API
 */
export async function sendEvolutionText(recipientNumber, textMessage) {
  if (!isEvolutionConfigured()) {
    throw new Error('Evolution API não configurada');
  }

  const sanitizedNumber = String(recipientNumber).replace(/\D/g, '');
  if (!sanitizedNumber || !textMessage) {
    throw new Error('Destinatário e mensagem são obrigatórios');
  }

  const payload = {
    number: sanitizedNumber,
    text: textMessage,
    textMessage: { text: textMessage },
    options: {
      delay: 1200,
      presence: 'composing',
      linkPreview: false
    }
  };

  const res = await fetch(`${EVOLUTION_BASE_URL}/message/sendText/${encodeURIComponent(EVOLUTION_INSTANCE)}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Erro no envio');
    throw new Error(`Falha ao enviar mensagem Evolution [${res.status}]: ${errText}`);
  }

  const data = await res.json();
  return {
    success: true,
    messageId: data?.key?.id || data?.id || null,
    raw: data
  };
}

/**
 * Normaliza o payload de evento de webhook recebido da Evolution
 * para os campos canônicos da tabela public.comunicacoes
 */
export function normalizeEvolutionWebhookEvent(body) {
  if (!body) return null;

  const eventType = body.event || body.type || 'messages.upsert';
  const data = body.data || body;

  // Se não for mensagem, retorna evento estruturado de conexão
  if (!data?.key && !data?.message) {
    return {
      isMessage: false,
      eventType,
      state: data?.state || data?.status || null,
      instance: body.instance || EVOLUTION_INSTANCE
    };
  }

  const messageKey = data.key || {};
  const isFromMe = Boolean(messageKey.fromMe);
  const remoteJid = messageKey.remoteJid || '';
  const remoteNumber = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
  const externalMessageId = messageKey.id || null;

  // Extrai o texto da mensagem
  const messageContent = data.message || {};
  const text = messageContent.conversation ||
    messageContent.extendedTextMessage?.text ||
    messageContent.imageMessage?.caption ||
    messageContent.videoMessage?.caption ||
    messageContent.documentMessage?.caption ||
    '';

  const pushName = data.pushName || remoteNumber;

  return {
    isMessage: true,
    eventType,
    external_message_id: externalMessageId,
    direction: isFromMe ? 'SAÍDA' : 'ENTRADA',
    remote_number: remoteNumber,
    pessoa_empresa: pushName,
    text: text.trim(),
    canal: 'WHATSAPP',
    status: isFromMe ? 'ENVIADA' : 'RECEBIDA',
    raw_event: body
  };
}

/**
 * Configura o webhook na Evolution API v2 para a instância ativa
 */
export async function setEvolutionWebhook(customWebhookUrl) {
  if (!isEvolutionConfigured()) {
    throw new Error('Evolution API não configurada');
  }

  const host = process.env.PUBLIC_HOST || 'helena-automation-helena-gateway.d9v63q.easypanel.host';
  const targetUrl = customWebhookUrl || `https://${host}/webhooks/evolution`;

  const payload = {
    webhook: {
      enabled: true,
      url: targetUrl,
      byEvents: false,
      base64: false,
      events: [
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'CONNECTION_UPDATE'
      ]
    }
  };

  try {
    const res = await fetch(`${EVOLUTION_BASE_URL}/webhook/set/${encodeURIComponent(EVOLUTION_INSTANCE)}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Erro ao configurar webhook');
      return { success: false, status: res.status, error: errText };
    }

    const data = await res.json().catch(() => ({ ok: true }));
    return { success: true, url: targetUrl, instance: EVOLUTION_INSTANCE, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Consulta a configuração atual de webhook na Evolution API
 */
export async function getEvolutionWebhook() {
  if (!isEvolutionConfigured()) {
    return { configured: false, error: 'Evolution API não configurada' };
  }

  try {
    const res = await fetch(`${EVOLUTION_BASE_URL}/webhook/find/${encodeURIComponent(EVOLUTION_INSTANCE)}`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) {
      return { configured: false, status: res.status };
    }

    const data = await res.json().catch(() => null);
    return { configured: true, instance: EVOLUTION_INSTANCE, data };
  } catch (err) {
    return { configured: false, error: err.message };
  }
}
