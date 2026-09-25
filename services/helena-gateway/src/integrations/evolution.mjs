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
 * Inicia conexão e solicita QR Code da instância
 */
export async function connectEvolution() {
  if (!isEvolutionConfigured()) {
    throw new Error('Evolution API não configurada');
  }

  const res = await fetch(`${EVOLUTION_BASE_URL}/instance/connect/${encodeURIComponent(EVOLUTION_INSTANCE)}`, {
    method: 'GET',
    headers: getHeaders()
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Erro ao conectar');
    throw new Error(`Falha ao iniciar conexão Evolution [${res.status}]: ${errText}`);
  }

  const data = await res.json();
  return {
    qrcode: data?.qrcode || data?.base64 || data?.code || null,
    pairingCode: data?.pairingCode || null,
    status: data?.status || 'CONNECTING'
  };
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

  const res = await fetch(`${EVOLUTION_BASE_URL}/instance/connect/${encodeURIComponent(EVOLUTION_INSTANCE)}?number=${sanitizedPhone}`, {
    method: 'GET',
    headers: getHeaders()
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Erro ao solicitar pairing code');
    throw new Error(`Falha no pareamento Evolution [${res.status}]: ${errText}`);
  }

  return await res.json();
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
