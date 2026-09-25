/**
 * Integrations / ElevenLabs Client
 * Cliente seguro para listagem de vozes, agentes, signed URLs e teste de TTS
 * REGRA ABSOLUTA: A chave ELEVENLABS_API_KEY NUNCA é enviada ao navegador.
 */

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY || '';
const ELEVENLABS_DEFAULT_AGENT_ID = process.env.ELEVENLABS_DEFAULT_AGENT_ID || process.env.ELEVENLABS_AGENT_ID || '';
const ELEVENLABS_DEFAULT_VOICE_ID = process.env.ELEVENLABS_DEFAULT_VOICE_ID || process.env.ELEVENLABS_VOICE_ID || '';

/**
 * Retorna true se a API key estiver configurada no servidor
 */
export function isElevenLabsConfigured() {
  return Boolean(ELEVENLABS_API_KEY);
}

function getHeaders() {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY não configurada no servidor');
  }
  return {
    'xi-api-key': ELEVENLABS_API_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
}

/**
 * Consulta a lista de vozes disponíveis na conta ElevenLabs
 * Retorna exclusivamente dados sanitizados e seguros.
 */
export async function getElevenLabsVoices() {
  if (!isElevenLabsConfigured()) {
    return {
      configured: false,
      voices: [],
      message: 'ELEVENLABS_API_KEY não configurada no ambiente'
    };
  }

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Erro ao listar vozes');
      return {
        configured: true,
        reachable: false,
        error: `Erro ElevenLabs [${res.status}]: ${errText}`,
        voices: []
      };
    }

    const data = await res.json();
    const rawVoices = data.voices || [];

    // Sanitiza para garantir que NENHUM dado confidencial vaze
    const voices = rawVoices.map((v) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category || 'generated',
      description: v.description || '',
      preview_url: v.preview_url || null,
      labels: v.labels || {},
      verified_languages: v.verified_languages || [],
      high_quality_base_model_ids: v.high_quality_base_model_ids || []
    }));

    return {
      configured: true,
      reachable: true,
      voices_count: voices.length,
      default_agent_id: ELEVENLABS_DEFAULT_AGENT_ID || null,
      default_voice_id: ELEVENLABS_DEFAULT_VOICE_ID || null,
      voices
    };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      error: err.message,
      voices: []
    };
  }
}

/**
 * Consulta os agentes de conversação (Conversational AI Agents) configurados na conta
 */
export async function getElevenLabsAgents() {
  if (!isElevenLabsConfigured()) {
    return [];
  }

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const agents = data.agents || [];

    return agents.map((a) => ({
      agent_id: a.agent_id,
      name: a.name,
      conversation_config: a.conversation_config || {}
    }));
  } catch {
    return [];
  }
}

/**
 * Gera uma Signed URL temporária oficial da ElevenLabs para abrir WebSocket
 * seguro de conversação em tempo real (Conversational AI).
 * Não expõe a chave nem credenciais de longa duração.
 */
export async function getSignedConversationUrl(agentId = null) {
  if (!isElevenLabsConfigured()) {
    throw new Error('ELEVENLABS_API_KEY não configurada no servidor');
  }

  const targetAgentId = agentId || ELEVENLABS_DEFAULT_AGENT_ID;
  if (!targetAgentId) {
    throw new Error('Agent ID é obrigatório para gerar Signed URL (defina ELEVENLABS_DEFAULT_AGENT_ID ou envie no parâmetro)');
  }

  const url = `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(targetAgentId)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: getHeaders()
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Erro ao obter signed url');
    throw new Error(`Falha ao gerar Signed URL ElevenLabs [${res.status}]: ${errText}`);
  }

  const data = await res.json();
  return {
    signed_url: data.signed_url,
    agent_id: targetAgentId,
    expires_in_seconds: 300
  };
}

/**
 * Gera áudio de teste (Text-to-Speech) para uma voz selecionada
 * Retorna base64 de áudio para ser tocado com segurança no navegador do Fundador.
 */
export async function generateVoiceSample(voiceId, text = 'Olá! Esta é uma demonstração de voz do Sistema Helena.') {
  if (!isElevenLabsConfigured()) {
    throw new Error('ELEVENLABS_API_KEY não configurada no servidor');
  }

  if (!voiceId) {
    throw new Error('voice_id é obrigatório para testar voz');
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;

  const payload = {
    text: text.slice(0, 300), // Limite seguro para teste
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Erro TTS');
    throw new Error(`Falha ao gerar amostra de voz [${res.status}]: ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const base64Audio = Buffer.from(arrayBuffer).toString('base64');

  return {
    voice_id: voiceId,
    mime_type: 'audio/mpeg',
    audio_base64: `data:audio/mpeg;base64,${base64Audio}`
  };
}
