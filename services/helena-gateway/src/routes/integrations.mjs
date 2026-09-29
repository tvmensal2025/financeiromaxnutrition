/**
 * Routes / Integrations
 * Endpoints REST administrativos e webhooks para Central de Canais, Voz e Roteamento
 */

import crypto from 'node:crypto';
import express from 'express';
import { getLayaHealth, classifyMessage, scoreMessage, routeMessage } from '../integrations/laya.mjs';
import {
  getEvolutionStatus,
  connectEvolution,
  pairEvolution,
  disconnectEvolution,
  sendEvolutionText,
  normalizeEvolutionWebhookEvent,
  isEvolutionConfigured,
  setEvolutionWebhook,
  getEvolutionWebhook,
  getEvolutionWebhookSecret
} from '../integrations/evolution.mjs';
import {
  getMeowcallerHealth,
  getMeowcallerSession,
  startMeowcallerSession,
  pairMeowcallerPhone,
  disconnectMeowcallerSession,
  originateCall,
  hangupCall,
  getMeowcallerEvents
} from '../integrations/meowcaller.mjs';
import {
  getElevenLabsVoices,
  getSignedConversationUrl,
  generateVoiceSample,
  isElevenLabsConfigured
} from '../integrations/elevenlabs.mjs';
import {
  getKokoroVoices,
  generateKokoroSample,
  generateKokoroSpeech,
  isKokoroConfigured,
  KOKORO_OFFICIAL_VOICE_ID,
  KOKORO_DEFAULT_PROFILE_ID
} from '../integrations/kokoro.mjs';

import {
  getVoiceAgentConfig,
  configureVoiceAgentStore,
  updateVoiceAgentConfig,
  generateAgentSpeechText,
  speakInCall,
  handleCallConnectedWebhook,
  handleUserSilence,
  processUserSpeech,
  getCallHistory
} from '../integrations/voice-agent.mjs';
import { createVoiceAgentStore } from '../integrations/voice-agent-store.mjs';

import { MeowcallerElevenBridge, MeowcallerKokoroBridge } from '../integrations/bridge.mjs';
import {
  buildAutoReplyMessage,
  getWhatsappChannelIdentity,
  isUraGreeting,
  rememberAutoReplySent,
  resolveUraRoute,
  shouldSkipDuplicateAutoReply,
  URA_DEFAULT_ROUTE
} from '../whatsapp-ura.mjs';

export {
  buildAutoReplyMessage,
  getWhatsappChannelIdentity,
  resolveUraRoute,
  shouldSkipDuplicateAutoReply,
  rememberAutoReplySent,
  URA_DEFAULT_ROUTE
};

/**
 * Comparação em tempo constante (com padding) para evitar timing attacks.
 * Nunca logar os valores comparados.
 */
export function safeCompareSecrets(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') {
    return false;
  }
  if (!provided || !expected) {
    return false;
  }
  const bufA = Buffer.from(provided);
  const bufB = Buffer.from(expected);
  const maxLen = Math.max(bufA.length, bufB.length, 1);
  const paddedA = Buffer.alloc(maxLen);
  const paddedB = Buffer.alloc(maxLen);
  bufA.copy(paddedA);
  bufB.copy(paddedB);
  const sameContent = crypto.timingSafeEqual(paddedA, paddedB);
  return sameContent && bufA.length === bufB.length;
}

function firstHeaderOrQueryValue(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

/**
 * Autentica POST /webhooks/evolution com EVOLUTION_WEBHOOK_SECRET.
 * Aceita header `x-evolution-webhook-secret` (ou aliases) e/ou query `secret`.
 * Fail-closed: sem variável definida, ou sem/segredo errado → 401, sem processar.
 */
export function authenticateEvolutionWebhook(req, res, next) {
  const expected = getEvolutionWebhookSecret();
  if (!expected) {
    console.error('[EVOLUTION_WEBHOOK] EVOLUTION_WEBHOOK_SECRET não configurado (fail-closed)');
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const headerVal = firstHeaderOrQueryValue(
    req.headers['x-evolution-webhook-secret'] ||
    req.headers['x-webhook-secret'] ||
    req.headers['x-helena-webhook-secret']
  );
  const queryVal = firstHeaderOrQueryValue(req.query?.secret);

  const headerOk = safeCompareSecrets(headerVal, expected);
  const queryOk = safeCompareSecrets(queryVal, expected);

  if (!headerOk && !queryOk) {
    console.warn('[EVOLUTION_WEBHOOK] Rejeitado: segredo ausente ou inválido');
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  return next();
}

// O serviço Meowcaller envia a mesma chave interna usada pelo gateway para chamá-lo.
// Sem credencial configurada, callbacks que poderiam consumir voz/IA falham fechados.
export function authenticateMeowcallerCallback(req, res, next) {
  const expected = process.env.MEOWCALLER_TOKEN || process.env.MEOWCALLER_API_KEY || process.env.MEOWCALLER_KEY || '';
  const provided = firstHeaderOrQueryValue(req.headers['x-api-key']);
  if (expected.startsWith('CONFIGURAR_') || !safeCompareSecrets(provided, expected)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  return next();
}

export function createIntegrationsRouter({ supabaseFetch, authenticateUser }) {
  const router = express.Router();
  const bridge = new MeowcallerElevenBridge(supabaseFetch);
  configureVoiceAgentStore(supabaseFetch ? createVoiceAgentStore(supabaseFetch) : null);

  const requireFounder = async (req, res, next) => {
    const userId = req.identity?.userId;
    if (!supabaseFetch || typeof userId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(userId)) {
      return res.status(403).json({ ok: false, error: 'Acesso restrito ao fundador.' });
    }
    try {
      const access = await supabaseFetch(
        `/rest/v1/app_access?select=role,active&user_id=eq.${encodeURIComponent(userId)}&limit=1`
      );
      if (access?.[0]?.role !== 'founder' || access[0].active !== true) {
        return res.status(403).json({ ok: false, error: 'Acesso restrito ao fundador.' });
      }
      return next();
    } catch {
      return res.status(503).json({ ok: false, error: 'Não foi possível confirmar o acesso no Supabase.' });
    }
  };

  // Middleware opcional para rotas de telemetria e status visual que não devem bloquear o dashboard
  const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'] || '';
    if (!authHeader) {
      return next();
    }
    if (authenticateUser) {
      return authenticateUser(req, res, () => next());
    }
    next();
  };

  // ======================================================================
  // 1. HEALTH E STATUS AGREGADO (Diretiva 28)
  // ======================================================================

  router.get('/api/integrations/status', async (req, res) => {
    try {
      const [laya, evolution, meowcaller, elevenlabs, kokoro] = await Promise.all([
        getLayaHealth().catch((err) => ({ healthy: false, error: err.message })),
        getEvolutionStatus().catch((err) => ({ configured: false, error: err.message })),
        getMeowcallerSession().catch((err) => ({ healthy: false, error: err.message })),
        getElevenLabsVoices().catch((err) => ({ configured: false, error: err.message })),
        getKokoroVoices().catch((err) => ({ configured: false, error: err.message }))
      ]);

      return res.json({
        ok: true,
        timestamp: new Date().toISOString(),
        gateway: {
          healthy: true,
          service: 'helena-gateway',
          version: '0.1.0'
        },
        laya,
        evolution,
        meowcaller,
        kokoro: {
          configured: kokoro.configured ?? false,
          is_official: true,
          provider: 'KOKORO',
          default_voice: kokoro.default_voice_id || KOKORO_OFFICIAL_VOICE_ID,
          default_profile_id: kokoro.default_profile_id || KOKORO_DEFAULT_PROFILE_ID,
          official_agent: 'Pedro (AGT-18)',
          voices_count: kokoro.voices_pt_br?.length || 0,
          status: 'OFICIAL'
        },
        elevenlabs: {
          configured: elevenlabs.configured ?? false,
          reachable: elevenlabs.reachable ?? false,
          voices_count: elevenlabs.voices_count || 0,
          is_official: false,
          status: 'STANDBY'
        }
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ======================================================================
  // 2. EVOLUTION API (WhatsApp Mensagens)
  // ======================================================================

  router.get('/api/integrations/evolution/status', optionalAuth, async (req, res) => {
    try {
      const status = await getEvolutionStatus();
      return res.json({ ok: true, status });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/evolution/connect', authenticateUser, async (req, res) => {
    try {
      const result = await connectEvolution();
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/evolution/pair', authenticateUser, async (req, res) => {
    try {
      const { phone } = req.body || {};
      if (!phone) {
        return res.status(400).json({ ok: false, error: 'Telefone é obrigatório para pairing code' });
      }
      const result = await pairEvolution(phone);
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/evolution/disconnect', authenticateUser, async (req, res) => {
    try {
      const result = await disconnectEvolution();
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/evolution/send-test', authenticateUser, async (req, res) => {
    try {
      const { phone, message } = req.body || {};
      if (!phone || !message) {
        return res.status(400).json({ ok: false, error: 'phone e message são obrigatórios' });
      }
      const result = await sendEvolutionText(phone, message);
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/evolution/webhook/setup', authenticateUser, async (req, res) => {
    try {
      const { url } = req.body || {};
      const result = await setEvolutionWebhook(url);
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.get('/api/integrations/evolution/webhook', authenticateUser, async (req, res) => {
    try {
      const result = await getEvolutionWebhook();
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Webhook da Evolution API — público na rede, autenticado por segredo compartilhado
  router.post('/webhooks/evolution', authenticateEvolutionWebhook, async (req, res) => {
    try {
      const event = normalizeEvolutionWebhookEvent(req.body);
      if (!event) {
        return res.status(200).json({ ok: true, ignored: true });
      }

      console.log(`[EVOLUTION_WEBHOOK] Evento recebido: ${event.eventType} (${event.direction || 'status'})`);

      // Se for mensagem inbound de cliente, registra em comunicacoes, classifica com Laya e auto-responde
      if (event.isMessage && event.direction === 'ENTRADA' && event.text && event.remote_number) {
        const identity = getWhatsappChannelIdentity();
        let classification = null;
        try {
          classification = await classifyMessage({
            message: event.text,
            business_id: identity.businessId,
            channel: 'whatsapp'
          });
        } catch (layaErr) {
          console.warn(`[EVOLUTION_WEBHOOK] Laya indisponível para classificação: ${layaErr.message}`);
        }

        const greeting = isUraGreeting(event.text);
        const route = greeting
          ? URA_DEFAULT_ROUTE
          : resolveUraRoute({ text: event.text, classification });

        // 1. Grava mensagem de entrada na tabela public.comunicacoes com idempotência
        if (supabaseFetch) {
          const commId = `COMM-${Date.now().toString(36).toUpperCase()}`;
          await supabaseFetch('/rest/v1/comunicacoes', {
            method: 'POST',
            body: JSON.stringify({
              communication_id: commId,
              data_hora: new Date().toISOString(),
              business_id: identity.businessId,
              canal: 'WHATSAPP',
              direction: 'ENTRADA',
              pessoa_empresa: event.pessoa_empresa,
              remetente: event.remote_number,
              destinatario: 'Helena WhatsApp',
              assunto: classification?.intent || 'Mensagem WhatsApp',
              resumo: event.text.slice(0, 500),
              responsavel: route.agent_name,
              source_system: 'Evolution API',
              external_id: event.external_message_id,
              idempotency_key: event.external_message_id || `evo-${Date.now()}`,
              status: 'RECEBIDA'
            })
          }).catch((err) => console.warn(`[EVOLUTION_WEBHOOK] Erro ao gravar comunicacao de entrada: ${err.message}`));

          // 2. Cria agent_job na esteira com o MESMO agente citado no texto da URA
          const jobId = `JOB-WPP-${Date.now().toString(36).toUpperCase()}`;
          await supabaseFetch('/rest/v1/agent_jobs', {
            method: 'POST',
            body: JSON.stringify({
              job_id: jobId,
              agent_id: route.agent_id,
              business_id: identity.businessId,
              objective: `Atendimento WhatsApp: ${event.text.slice(0, 100)}`,
              instruction: `Cliente: ${event.pessoa_empresa} (${event.remote_number})\nMensagem: ${event.text}\nIntenção: ${classification?.intent || 'atendimento'}\nÁrea: ${route.area}\nAgente: ${route.agent_name} (${route.agent_id})`,
              priority: classification?.urgency >= 4 ? 'ALTA' : 'MEDIA',
              status: 'READY',
              idempotency_key: `job-${event.external_message_id || Date.now()}`
            })
          }).catch((err) => console.warn(`[EVOLUTION_WEBHOOK] Erro ao criar agent_job: ${err.message}`));
        }

        // 3. Constrói auto-resposta a partir da mesma rota/identidade (texto e job coerentes)
        const replyText = buildAutoReplyMessage({
          text: event.text,
          classification,
          pushName: event.pessoa_empresa,
          identity,
          route: greeting ? null : route
        });

        // 4. Envia mensagem de volta ao cliente via Evolution API se configurada
        if (isEvolutionConfigured() && replyText) {
          if (shouldSkipDuplicateAutoReply(event.remote_number, replyText)) {
            console.log(`[EVOLUTION_WEBHOOK] Auto-resposta omitida (debounce) para ${event.remote_number}`);
          } else {
            try {
              const sendResult = await sendEvolutionText(event.remote_number, replyText);
              rememberAutoReplySent(event.remote_number, replyText);
              console.log(`[EVOLUTION_WEBHOOK] Auto-resposta enviada para ${event.remote_number} (msgId: ${sendResult?.messageId})`);

              // 5. Registra a resposta enviada em public.comunicacoes
              if (supabaseFetch) {
                const replyCommId = `COMM-OUT-${Date.now().toString(36).toUpperCase()}`;
                await supabaseFetch('/rest/v1/comunicacoes', {
                  method: 'POST',
                  body: JSON.stringify({
                    communication_id: replyCommId,
                    data_hora: new Date().toISOString(),
                    business_id: identity.businessId,
                    canal: 'WHATSAPP',
                    direction: 'SAÍDA',
                    pessoa_empresa: event.pessoa_empresa,
                    remetente: 'Helena WhatsApp',
                    destinatario: event.remote_number,
                    assunto: `Auto-resposta: ${classification?.intent || 'Menu'}`,
                    resumo: replyText.slice(0, 500),
                    responsavel: route.agent_name,
                    source_system: 'Evolution API',
                    external_id: sendResult?.messageId || null,
                    idempotency_key: `evo-out-${sendResult?.messageId || Date.now()}`,
                    status: 'ENVIADA'
                  })
                }).catch((err) => console.warn(`[EVOLUTION_WEBHOOK] Erro ao gravar comunicacao de saida: ${err.message}`));
              }
            } catch (sendErr) {
              console.warn(`[EVOLUTION_WEBHOOK] Falha ao enviar auto-resposta no WhatsApp: ${sendErr.message}`);
            }
          }
        }
      }

      return res.status(200).json({ ok: true, processed: true });
    } catch (err) {
      console.error(`[EVOLUTION_WEBHOOK] Erro no processamento: ${err.message}`);
      return res.status(200).json({ ok: false, error: err.message });
    }
  });

  // ======================================================================
  // 3. MEOWCALLER (WhatsApp Chamadas de Voz)
  // ======================================================================

  router.get('/api/integrations/meowcaller/status', optionalAuth, async (req, res) => {
    try {
      const session = await getMeowcallerSession();
      return res.json({ ok: true, session });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/meowcaller/connect', authenticateUser, async (req, res) => {
    try {
      const result = await startMeowcallerSession();
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/meowcaller/pair-phone', authenticateUser, async (req, res) => {
    try {
      const { phone } = req.body || {};
      if (!phone) {
        return res.status(400).json({ ok: false, error: 'phone é obrigatório' });
      }
      const result = await pairMeowcallerPhone(phone);
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/meowcaller/disconnect', authenticateUser, async (req, res) => {
    try {
      const result = await disconnectMeowcallerSession();
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/meowcaller/call', authenticateUser, async (req, res) => {
    try {
      const { phone, business_id, voice_profile_id = KOKORO_DEFAULT_PROFILE_ID } = req.body || {};
      if (!phone) {
        return res.status(400).json({ ok: false, error: 'phone é obrigatório' });
      }

      // Inicia chamada no Meowcaller com voz oficial do Kokoro
      const callResult = await originateCall({ phone, business_id, voice_profile_id });
      const callId = callResult?.call_id || null;
      if (!callId) {
        return res.json({
          ok: true, result: callResult, call_id: null, tracking_status: 'ID_AUSENTE',
          warning: 'O provedor não retornou o identificador da chamada. Verifique a ligação antes de tentar novamente.'
        });
      }

      // Registra chamada em public.call_sessions
      let trackingStatus = 'SUPABASE_INDISPONIVEL';
      if (supabaseFetch) {
        try {
          const saved = await supabaseFetch('/rest/v1/call_sessions', {
            method: 'POST',
            body: JSON.stringify({
              call_id: callId,
              business_id: business_id || 'BIZ-001',
              provider: 'MEOWCALLER',
              direction: 'OUTBOUND',
              remote_number: phone,
              status: 'DIALING',
              voice_profile_id: voice_profile_id || null,
              started_at: new Date().toISOString()
            })
          });
          trackingStatus = Array.isArray(saved) && saved.some(row => row.call_id === callId)
            ? 'CONFIRMADO' : 'NAO_CONFIRMADO';
        } catch {
          trackingStatus = 'FALHA';
        }
      }

      // Inicia o bridge de áudio assíncrono
      bridge.startBridge({
        callId,
        businessId: business_id || 'BIZ-001',
        voiceProfileId: voice_profile_id || null,
        remoteNumber: phone
      }).catch((err) => console.warn(`[BRIDGE] Falha ao preparar bridge: ${err.message}`));

      return res.json({
        ok: true, result: callResult, call_id: callId, tracking_status: trackingStatus,
        ...(trackingStatus === 'CONFIRMADO' ? {} : { warning: 'Chamada iniciada, mas o registro no Supabase não foi confirmado.' })
      });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/meowcaller/hangup', authenticateUser, async (req, res) => {
    try {
      const { call_id } = req.body || {};
      if (!call_id) {
        return res.status(400).json({ ok: false, error: 'call_id é obrigatório' });
      }
      const result = await hangupCall(call_id);
      await bridge.endBridge(call_id, 'USER_HANGUP');
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  // ======================================================================
  // 4. ELEVENLABS (Vozes & Conversational AI)
  // ======================================================================

  router.get('/api/integrations/elevenlabs/voices', optionalAuth, async (req, res) => {
    try {
      const data = await getElevenLabsVoices();
      return res.json({ ok: true, data });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/elevenlabs/test-voice', authenticateUser, async (req, res) => {
    try {
      const { voice_id, text } = req.body || {};
      if (!voice_id) {
        return res.status(400).json({ ok: false, error: 'voice_id é obrigatório' });
      }
      const sample = await generateVoiceSample(voice_id, text);
      return res.json({ ok: true, sample });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.get('/api/integrations/elevenlabs/signed-url', authenticateUser, async (req, res) => {
    try {
      const { agent_id } = req.query;
      const signedData = await getSignedConversationUrl(agent_id);
      return res.json({ ok: true, data: signedData });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  // ======================================================================
  // 5. KOKORO TTS (Vozes Neurais Open-Source na VPS)
  // ======================================================================

  router.get('/api/integrations/kokoro/voices', optionalAuth, async (req, res) => {
    try {
      const data = await getKokoroVoices();
      return res.json({ ok: true, data });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/kokoro/test-voice', authenticateUser, async (req, res) => {
    try {
      const { voice_id, text } = req.body || {};
      if (!voice_id) {
        return res.status(400).json({ ok: false, error: 'voice_id é obrigatório' });
      }
      const sample = await generateKokoroSample(voice_id, text);
      return res.json({ ok: true, sample });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/kokoro/speech', authenticateUser, async (req, res) => {
    try {
      const { input, voice, model } = req.body || {};
      if (!input) {
        return res.status(400).json({ ok: false, error: 'input é obrigatório' });
      }
      const speech = await generateKokoroSpeech({ input, voice, model });
      res.setHeader('Content-Type', speech.mimeType);
      res.setHeader('Content-Length', speech.sizeBytes);
      res.setHeader('X-Kokoro-Duration-Ms', speech.durationMs);
      return res.send(speech.buffer);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  /**
   * Endpoint Oficial de Voz do Sistema Helena (Kokoro Neural TTS)
   * Sintetiza áudio para Meowcaller (ligações), WhatsApp (áudios) ou download
   */
  router.post('/api/integrations/voice/speak', authenticateUser, async (req, res) => {
    try {
      const { text, voice_id = KOKORO_OFFICIAL_VOICE_ID, format = 'json' } = req.body || {};
      if (!text || !text.trim()) {
        return res.status(400).json({ ok: false, error: 'text é obrigatório' });
      }

      const speech = await generateKokoroSpeech({
        input: text.trim(),
        voice: voice_id
      });

      if (format === 'audio') {
        res.setHeader('Content-Type', speech.mimeType);
        res.setHeader('Content-Length', speech.sizeBytes);
        res.setHeader('X-Kokoro-Duration-Ms', speech.durationMs);
        return res.send(speech.buffer);
      }

      const base64 = speech.buffer.toString('base64');
      return res.json({
        ok: true,
        engine: 'KOKORO_NEURAL_TTS',
        official: true,
        voice_id,
        duration_ms: speech.durationMs,
        size_bytes: speech.sizeBytes,
        mime_type: 'audio/mpeg',
        audio_base64: `data:audio/mpeg;base64,${base64}`
      });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  // ======================================================================
  // 6. LAYA SERVICE (Classificação, Score & Roteamento)

  // ======================================================================

  router.post('/api/integrations/laya/classify', authenticateUser, async (req, res) => {
    try {
      const result = await classifyMessage(req.body || {});
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/laya/score', authenticateUser, async (req, res) => {
    try {
      const result = await scoreMessage(req.body || {});
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/laya/route', authenticateUser, async (req, res) => {
    try {
      const result = await routeMessage(req.body || {});
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  // ======================================================================
  // 6. EVENTOS TÉCNICOS
  // ======================================================================

  router.get('/api/integrations/events', optionalAuth, async (req, res) => {
    try {
      if (!supabaseFetch) {
        return res.json({ ok: true, events: [] });
      }
      const events = await supabaseFetch('/rest/v1/integration_events?select=*&order=created_at.desc&limit=50');
      return res.json({ ok: true, events: Array.isArray(events) ? events : [] });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ======================================================================
  // 7. CÉREBRO DO ATENDENTE & MEMÓRIA DE PRODUTOS ("COMANDO GIGANTE")
  // ======================================================================

  router.get('/api/integrations/voice-agent/settings', authenticateUser, requireFounder, async (req, res) => {
    try {
      const config = await getVoiceAgentConfig();
      return res.json({ ok: true, config });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/voice-agent/settings', authenticateUser, requireFounder, async (req, res) => {
    try {
      await getVoiceAgentConfig();
      const result = await updateVoiceAgentConfig(req.body || {});
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/voice-agent/test-dialogue', authenticateUser, requireFounder, async (req, res) => {
    try {
      const { prompt = 'Qual a diferença entre a creatina monohidratada e a creapure?', voice = KOKORO_OFFICIAL_VOICE_ID } = req.body || {};
      const responseText = await generateAgentSpeechText({ prompt });
      const sample = await generateKokoroSample(voice || KOKORO_OFFICIAL_VOICE_ID, responseText);
      return res.json({
        ok: true,
        prompt,
        response_text: responseText,
        audio_url: sample.audio_url || sample.audio_base64,
        audio_base64: sample.audio_base64,
        voice_id: voice || KOKORO_OFFICIAL_VOICE_ID
      });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/voice-agent/play-greeting', authenticateUser, async (req, res) => {
    try {
      const { call_id, text, voice } = req.body || {};
      if (!call_id) {
        return res.status(400).json({ ok: false, error: 'call_id é obrigatório' });
      }
      const cfg = await getVoiceAgentConfig();
      const messageToSpeak = text || cfg.inbound_greeting;
      const result = await speakInCall({
        callId: call_id,
        text: messageToSpeak,
        voice: voice || (cfg.voice_provider === 'ELEVENLABS' ? cfg.elevenlabs_voice : cfg.kokoro_voice)
      });
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/voice-agent/webhook', authenticateMeowcallerCallback, async (req, res) => {
    try {
      const result = await handleCallConnectedWebhook(req.body || {});
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/voice-agent/user-speech', authenticateMeowcallerCallback, async (req, res) => {
    try {
      const { call_id, audio_base64, format, sample_rate } = req.body || {};
      if (!call_id || !audio_base64) {
        return res.status(400).json({ ok: false, error: 'call_id e audio_base64 são obrigatórios' });
      }
      const result = await processUserSpeech({
        callId: call_id,
        audioBase64: audio_base64,
        format: format || 'wav',
        sampleRate: sample_rate || 16000
      });
      return res.json({ ok: true, result });
    } catch (err) {
      console.error('[VOICE_AGENT] Erro ao processar fala do usuário:', err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/voice-agent/user-silence', authenticateMeowcallerCallback, async (req, res) => {
    try {
      const { call_id } = req.body || {};
      if (!call_id) {
        return res.status(400).json({ ok: false, error: 'call_id é obrigatório' });
      }
      const result = await handleUserSilence({ callId: call_id });
      return res.json({ ok: true, result });
    } catch (err) {
      console.error('[VOICE_AGENT] Erro ao tratar silêncio do usuário:', err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.get('/api/integrations/voice-agent/call-history/:call_id', authenticateUser, requireFounder, (req, res) => {
    const history = getCallHistory(req.params.call_id);
    return res.json({ ok: true, call_id: req.params.call_id, history });
  });

  return router;
}
