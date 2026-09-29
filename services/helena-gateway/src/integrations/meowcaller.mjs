/**
 * Integrations / Meowcaller Client
 * Cliente HTTP seguro para comunicação com o Meowcaller Service (WhatsApp Chamadas de Voz)
 * Endpoint oficial: https://helena-automation-meowcaller-service.d9v63q.easypanel.host
 */

const MEOWCALLER_BASE_URL = (process.env.MEOWCALLER_BASE_URL || 'https://helena-automation-meowcaller-service.d9v63q.easypanel.host').replace(/\/$/, '');
const MEOWCALLER_TOKEN = process.env.MEOWCALLER_TOKEN || process.env.MEOWCALLER_API_KEY || process.env.MEOWCALLER_KEY || '';

function getHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  if (MEOWCALLER_TOKEN) {
    headers['X-API-Key'] = MEOWCALLER_TOKEN;
  }
  return headers;
}

/**
 * Consulta o health check do Meowcaller
 */
export async function getMeowcallerHealth() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${MEOWCALLER_BASE_URL}/health`, {
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
      whatsapp_status: data.whatsapp_status,
      active_calls: data.active_calls || 0,
      connected_jid: data.connected_jid || ''
    };
  } catch (err) {
    return {
      healthy: false,
      status: 'offline',
      error: err.message
    };
  }
}

/**
 * Consulta o status da sessão WhatsApp para ligações
 */
export async function getMeowcallerSession() {
  const health = await getMeowcallerHealth();
  if (!MEOWCALLER_TOKEN) {
    return {
      configured: false,
      status: health.whatsapp_status || 'DISCONNECTED',
      connected_jid: health.connected_jid || '',
      active_calls: health.active_calls || 0,
      message: 'Token de autenticação do Meowcaller não configurado (MEOWCALLER_TOKEN)'
    };
  }

  try {
    const res = await fetch(`${MEOWCALLER_BASE_URL}/v1/session`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) {
      return {
        configured: true,
        status: health.whatsapp_status || 'DISCONNECTED',
        connected_jid: health.connected_jid || '',
        active_calls: health.active_calls || 0,
        http_status: res.status
      };
    }

    const data = await res.json();
    return {
      configured: true,
      ...data,
      whatsapp_status: data.status || health.whatsapp_status
    };
  } catch (err) {
    return {
      configured: true,
      status: health.whatsapp_status || 'ERROR',
      error: err.message
    };
  }
}

/**
 * Inicia a sessão de ligações WhatsApp e solicita QR Code
 */
export async function startMeowcallerSession() {
  if (!MEOWCALLER_TOKEN) {
    return {
      configured: false,
      status: 'DISCONNECTED',
      message: 'MEOWCALLER_TOKEN não configurado no backend'
    };
  }

  try {
    const res = await fetch(`${MEOWCALLER_BASE_URL}/v1/session/start`, {
      method: 'POST',
      headers: getHeaders()
    });

    if (res.ok) {
      return await res.json();
    }
  } catch {
    // segue para fallback
  }

  // O microserviço Meowcaller gerencia a sessão internamente; consulta o status atual
  const session = await getMeowcallerSession();
  return {
    ok: true,
    result: {
      status: session.status || 'DISCONNECTED',
      connected_jid: session.connected_jid || '',
      qrcode: session.qrcode || session.qr_code || null
    },
    ...session
  };
}

/**
 * Solicita código de pareamento por número de telefone (Pairing Code de 8 dígitos)
 */
export async function pairMeowcallerPhone(phone) {
  if (!phone) {
    throw new Error('phone é obrigatório');
  }

  const res = await fetch(`${MEOWCALLER_BASE_URL}/v1/session/pair-phone`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ phone })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Erro desconhecido');
    throw new Error(`Falha ao gerar código de pareamento: ${errText}`);
  }

  return await res.json();
}

/**
 * Desconecta a sessão de ligações WhatsApp
 */
export async function disconnectMeowcallerSession() {
  if (!MEOWCALLER_TOKEN) {
    return { ok: true, status: 'DISCONNECTED' };
  }

  try {
    const res = await fetch(`${MEOWCALLER_BASE_URL}/v1/session`, {
      method: 'DELETE',
      headers: getHeaders()
    });

    if (res.ok) {
      return await res.json().catch(() => ({ ok: true }));
    }
  } catch {
    // ignorar falha se endpoint não existir
  }

  return { ok: true, status: 'DISCONNECTED' };
}

/**
 * Origina uma chamada de saída (Outbound Call) via Meowcaller
 */
export async function originateCall({ phone, business_id = 'BIZ-001', voice_profile_id = null }) {
  if (!MEOWCALLER_TOKEN) {
    throw new Error('MEOWCALLER_TOKEN não configurado no backend');
  }

  let sanitizedPhone = String(phone).replace(/\D/g, '');
  if (!sanitizedPhone || sanitizedPhone.length < 10) {
    throw new Error('Número de telefone inválido para chamada. Mínimo 10 dígitos.');
  }

  // Se tiver 10 ou 11 dígitos (DDD + número no Brasil) e não começar com 55, adiciona o DDI do Brasil automaticamente
  if ((sanitizedPhone.length === 10 || sanitizedPhone.length === 11) && !sanitizedPhone.startsWith('55')) {
    sanitizedPhone = `55${sanitizedPhone}`;
  }

  // Verifica o status real da conexão antes de prometer a chamada
  const health = await getMeowcallerHealth();
  if (health.whatsapp_status !== 'CONNECTED') {
    throw new Error(
      `Sessão Meowcaller em prontidão (${health.whatsapp_status || 'DISCONNECTED'}). É necessário conectar uma linha de voz WhatsApp dedicada ao Meowcaller para originar chamadas reais.`
    );
  }

  const targetJid = sanitizedPhone.includes('@') ? sanitizedPhone : `${sanitizedPhone}@s.whatsapp.net`;

  const payload = {
    phone: sanitizedPhone,
    target_jid: targetJid,
    business_id,
    agent_id: 'AGT-20',
    ...(voice_profile_id ? { voice_profile_id } : {})
  };

  const res = await fetch(`${MEOWCALLER_BASE_URL}/v1/calls`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Erro ao originar chamada');
    throw new Error(`Falha ao originar chamada Meowcaller [${res.status}]: ${errText}`);
  }

  return await res.json();
}

/**
 * Encerra uma chamada ativa
 */
export async function hangupCall(callId) {
  if (!MEOWCALLER_TOKEN) {
    throw new Error('MEOWCALLER_TOKEN não configurado no backend');
  }

  const res = await fetch(`${MEOWCALLER_BASE_URL}/v1/calls/${encodeURIComponent(callId)}/hangup`, {
    method: 'POST',
    headers: getHeaders()
  });

  if (!res.ok) {
    // Tenta fallback com DELETE
    const delRes = await fetch(`${MEOWCALLER_BASE_URL}/v1/calls/${encodeURIComponent(callId)}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!delRes.ok) {
      throw new Error(`Falha ao encerrar chamada [${res.status}]`);
    }
    return await delRes.json().catch(() => ({ ok: true }));
  }

  return await res.json();
}

/**
 * Atende uma chamada recebida (Inbound Answer)
 */
export async function answerCall(callId) {
  if (!MEOWCALLER_TOKEN) {
    throw new Error('MEOWCALLER_TOKEN não configurado no backend');
  }

  const res = await fetch(`${MEOWCALLER_BASE_URL}/v1/calls/${encodeURIComponent(callId)}/answer`, {
    method: 'POST',
    headers: getHeaders()
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Erro ao atender');
    throw new Error(`Falha ao atender chamada [${res.status}]: ${errText}`);
  }

  return await res.json();
}

/**
 * Consulta eventos técnicos do Meowcaller
 */
export async function getMeowcallerEvents() {
  if (!MEOWCALLER_TOKEN) {
    return [];
  }

  try {
    const res = await fetch(`${MEOWCALLER_BASE_URL}/v1/events`, {
      method: 'GET',
      headers: getHeaders()
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Transmite áudio em uma chamada ativa (via URL ou Base64)
 */
export async function playCallAudio(callId, { audioUrl = '', audioBase64 = '', format = 'mp3', filePath = '' } = {}) {
  if (!MEOWCALLER_TOKEN) {
    throw new Error('MEOWCALLER_TOKEN não configurado no backend');
  }
  if (!callId) {
    throw new Error('callId é obrigatório para reproduzir áudio');
  }

  const payload = {};
  if (audioUrl) payload.audio_url = audioUrl;
  if (audioBase64) {
    payload.audio_base64 = audioBase64;
    payload.format = format;
  }
  if (filePath) payload.file_path = filePath;

  const res = await fetch(`${MEOWCALLER_BASE_URL}/v1/calls/${encodeURIComponent(callId)}/play`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Erro ao tocar áudio');
    throw new Error(`Falha ao tocar áudio na chamada [${res.status}]: ${errText}`);
  }

  return await res.json();
}

// A failed lookup must never be mistaken for an empty list of calls.
export async function listMeowcallerCalls() {
  const res = await fetch(`${MEOWCALLER_BASE_URL}/v1/calls`, {
    headers: getHeaders(), signal: AbortSignal.timeout(4000)
  });
  if (!res.ok) throw new Error(`Meowcaller call lookup failed: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data.calls)) throw new Error('Invalid Meowcaller call list');
  return data.calls;
}
