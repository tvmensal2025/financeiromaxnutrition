import { cleanSpeechTranscript } from '../integrations/voice-delivery.mjs';
import { loadCallerContext, persistVoiceTurn, persistVoiceUtterance } from '../integrations/caller-context.mjs';
/**
 * Routes / Integrations
 * Endpoints REST administrativos e webhooks para Central de Canais, Voz e Roteamento
 */

import crypto from 'node:crypto';
import { webOpening } from '../integrations/conversation-mode.mjs';
import { reconcilePhoneCalls } from '../integrations/call-reconciliation.mjs';
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
  listMeowcallerCalls,
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
  isGoogleChirp3CallEnabled,
  resolveChirp3Voice,
  getActiveCallVoice,
  setActiveCallVoice,
  getPreviousCallVoice,
  restorePreviousCallVoice,
  getLastVoiceAudit,
  listAvailableChirp3Voices,
  previewGoogleCallVoice,
  checkInstantCustomVoiceAvailability,
  getChirp3Metrics,
  CHIRP3_HD_VOICES_PT_BR,
  DEFAULT_CHIRP3_HD_VOICE,
  PROVIDER_NAME as GOOGLE_CHIRP3_PROVIDER
} from '../integrations/google-chirp3-hd.mjs';

import {
  getVoiceAgentConfig,
  updateVoiceAgentConfig,
  generateAgentSpeechText,
  generateAgentSpeechTextDetailed,
  generateNaturalOpening,
  transcribeAudio,
  speakInCall,
  handleCallConnectedWebhook,
  handleCallEndedWebhook,
  handleUserSilence,
  processUserSpeech,
  getCallHistory
} from '../integrations/voice-agent.mjs';

import {
  getCallEngineConfig,
  updateCallEngineConfig,
  updateFavoriteVoiceSlot,
  getPersonalitiesList,
  updatePersonality,
  resetPersonalityToDefault,
  getActiveCallsList,
  registerCallSession,
  switchCallRuntime,
  getCallsHistoryMetrics,
  getCallDetailById,
  getAllProfiles12,
  getProfile,
  updateProfile,
  resetProfileToDefault,
  getActiveGlobalProfileKey,
  setActiveGlobalProfile,
  getProfileByKey,
  DEFAULT_PERSONALITIES
} from '../integrations/call-engine.mjs';

import { MeowcallerVoiceBridge } from '../integrations/bridge.mjs';
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

export function createIntegrationsRouter({ supabaseFetch, authenticateUser, profileStore }) {
  const router = express.Router();
  router.use(async (req, res, next) => {
    if (profileStore && (req.path.startsWith('/api/integrations/call-engine/') || req.path.startsWith('/api/integrations/voice-agent/'))) {
      try { await profileStore.load(); } catch { return res.status(503).json({ error: 'Não foi possível carregar os perfis salvos.' }); }
    }
    next();
  });
  const bridge = new MeowcallerVoiceBridge(supabaseFetch);

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
        },
        call_tts: {
          provider: isGoogleChirp3CallEnabled() ? GOOGLE_CHIRP3_PROVIDER : 'legacy',
          chirp3_hd_enabled: isGoogleChirp3CallEnabled(),
          model: 'Chirp 3 HD',
          language: process.env.GOOGLE_CALL_TTS_LANGUAGE || 'pt-BR',
          voice: resolveChirp3Voice(),
          metrics: getChirp3Metrics()
        }
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.get('/api/integrations/google-chirp3-hd/status', optionalAuth, async (req, res) => {
    try {
      const customVoiceStatus = await checkInstantCustomVoiceAvailability();
      const currentVoice = getActiveCallVoice();
      const previousVoice = getPreviousCallVoice();

      return res.json({
        ok: true,
        provider: GOOGLE_CHIRP3_PROVIDER,
        enabled: isGoogleChirp3CallEnabled(),
        model: 'Chirp 3 HD',
        language: process.env.GOOGLE_CALL_TTS_LANGUAGE || 'pt-BR',
        voice: currentVoice,
        previous_voice: previousVoice,
        can_restore: Boolean(previousVoice && previousVoice !== currentVoice),
        last_audit: getLastVoiceAudit(),
        metrics: getChirp3Metrics(),
        instant_custom_voice: customVoiceStatus
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.get(['/api/integrations/google-chirp3-hd/voices', '/api/integrations/call-engine/voices'], optionalAuth, async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const discovered = await listAvailableChirp3Voices(forceRefresh);

      return res.json({
        ok: true,
        provider: GOOGLE_CHIRP3_PROVIDER,
        model: 'Chirp 3 HD',
        language: 'pt-BR',
        default_voice: DEFAULT_CHIRP3_HD_VOICE,
        active_voice: getActiveCallVoice(),
        source: discovered.source,
        total: discovered.total,
        voices: discovered.voices,
        raw_catalog: CHIRP3_HD_VOICES_PT_BR
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/google-chirp3-hd/preview', optionalAuth, async (req, res) => {
    try {
      const { text, voice } = req.body || {};
      const previewResult = await previewGoogleCallVoice({ text, voice });
      return res.json(previewResult);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/google-chirp3-hd/set-voice', authenticateUser, async (req, res) => {
    try {
      const { voice } = req.body || {};
      if (!voice || typeof voice !== 'string') {
        return res.status(400).json({ ok: false, error: 'O parâmetro "voice" é obrigatório.' });
      }

      const updatedBy = req.user?.email || req.user?.id || 'Admin';
      const updateResult = setActiveCallVoice(voice, updatedBy);

      // Persistência segura no Supabase na tabela configuracao (merge-duplicates)
      if (supabaseFetch) {
        try {
          const configItems = [
            {
              chave: 'GOOGLE_CALL_TTS_VOICE',
              valor: updateResult.active_voice,
              tipo: 'CONFIG',
              responsavel: updatedBy,
              descricao: 'Voz oficial Google Cloud Chirp 3 HD para chamadas VoIP'
            }
          ];
          if (updateResult.previous_voice) {
            configItems.push({
              chave: 'GOOGLE_CALL_TTS_PREVIOUS_VOICE',
              valor: updateResult.previous_voice,
              tipo: 'CONFIG',
              responsavel: updatedBy,
              descricao: 'Voz anterior Google Cloud Chirp 3 HD para suporte a rollback'
            });
          }
          await supabaseFetch('/rest/v1/configuracao', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify(configItems)
          }).catch(() => null);

          // Registra log em integration_events
          await supabaseFetch('/rest/v1/integration_events', {
            method: 'POST',
            body: JSON.stringify({
              integration: 'google_chirp3_hd',
              event_type: 'VOICE_CHANGED',
              payload: {
                previous_voice: updateResult.previous_voice,
                new_voice: updateResult.active_voice,
                updated_by: updatedBy
              }
            })
          }).catch(() => null);
        } catch (dbErr) {
          console.warn('[GoogleChirp3HD] Aviso: Não foi possível persistir no Supabase, mas memória foi atualizada:', dbErr.message);
        }
      }

      return res.json({
        ok: true,
        message: `Voz atualizada com sucesso para '${updateResult.active_voice}'.`,
        active_voice: updateResult.active_voice,
        previous_voice: updateResult.previous_voice,
        audit: updateResult.audit
      });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/google-chirp3-hd/restore-voice', authenticateUser, async (req, res) => {
    try {
      const updatedBy = req.user?.email || req.user?.id || 'Admin';
      const restoreResult = restorePreviousCallVoice(updatedBy);

      if (supabaseFetch) {
        try {
          await supabaseFetch('/rest/v1/configuracao', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify([
              {
                chave: 'GOOGLE_CALL_TTS_VOICE',
                valor: restoreResult.active_voice,
                tipo: 'CONFIG',
                responsavel: updatedBy,
                descricao: 'Voz oficial restaurada Google Cloud Chirp 3 HD'
              }
            ])
          }).catch(() => null);
        } catch {}
      }

      return res.json({
        ok: true,
        message: `Voz restaurada com sucesso para '${restoreResult.active_voice}'.`,
        active_voice: restoreResult.active_voice,
        previous_voice: restoreResult.previous_voice,
        audit: restoreResult.audit
      });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.get('/api/integrations/google-chirp3-hd/custom-voice-status', optionalAuth, async (req, res) => {
    try {
      const status = await checkInstantCustomVoiceAvailability();
      return res.json({ ok: true, ...status });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/google-chirp3-hd/custom-voice', authenticateUser, async (req, res) => {
    try {
      const availability = await checkInstantCustomVoiceAvailability();
      if (!availability.available) {
        return res.status(403).json({
          ok: false,
          error: availability.message,
          status: availability.status,
          requirements: availability.requirements
        });
      }

      const { name, consent_audio, reference_audio } = req.body || {};
      if (!name || !consent_audio || !reference_audio) {
        return res.status(400).json({
          ok: false,
          error: 'Parâmetros obrigatórios: nome da voz, áudio de consentimento do locutor e áudio de referência.'
        });
      }

      // Quando aprovado pelo Google, a criação prossegue
      return res.json({
        ok: true,
        voice_id: `custom-${Date.now()}`,
        name,
        status: 'PENDING_GOOGLE_PROCESSING'
      });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
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
      const { phone, business_id, voice_profile_id = null } = req.body || {};
      if (!phone) {
        return res.status(400).json({ ok: false, error: 'phone é obrigatório' });
      }

      // Inicia chamada no Meowcaller com Google Cloud Chirp 3 HD
      const callResult = await originateCall({ phone, business_id, voice_profile_id });
      const callId = callResult?.call_id || `CALL-${Date.now()}`;

      // Registra chamada em public.call_sessions
      if (supabaseFetch) {
        await supabaseFetch('/rest/v1/call_sessions', {
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
        }).catch(() => {});
      }

      // Inicia o bridge de áudio assíncrono
      bridge.startBridge({
        callId,
        businessId: business_id || 'BIZ-001',
        voiceProfileId: voice_profile_id || null,
        remoteNumber: phone
      }).catch((err) => console.warn(`[BRIDGE] Falha ao preparar bridge: ${err.message}`));

      return res.json({ ok: true, result: callResult, call_id: callId });
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

  router.get('/api/integrations/voice-agent/settings', optionalAuth, async (req, res) => {
    try {
      const config = await getVoiceAgentConfig();
      if (supabaseFetch) {
        try {
          const remoteConfigs = await supabaseFetch('/rest/v1/configuracao?chave=in.(DEEPSEEK_API_KEY,VOICE_AGENT_AI_PROVIDER,VOICE_AGENT_AI_MODEL)&select=*').catch(() => []);
          if (Array.isArray(remoteConfigs)) {
            for (const item of remoteConfigs) {
              if (item.chave === 'DEEPSEEK_API_KEY' && item.valor) {
                config.ai_api_key = item.valor;
                config.has_deepseek_key = true;
              }
              if (item.chave === 'VOICE_AGENT_AI_PROVIDER' && item.valor) {
                config.ai_provider = item.valor;
              }
              if (item.chave === 'VOICE_AGENT_AI_MODEL' && item.valor) {
                config.ai_model = item.valor;
              }
            }
          }
        } catch {}
      }
      return res.json({ ok: true, config });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/voice-agent/settings', authenticateUser, async (req, res) => {
    try {
      const result = await updateVoiceAgentConfig(req.body || {});
      if (supabaseFetch) {
        try {
          const configItems = [];
          if (req.body.knowledge_base !== undefined) {
            configItems.push({
              chave: 'VOICE_AGENT_KNOWLEDGE_BASE',
              valor: req.body.knowledge_base || '',
              tipo: 'TEXTO',
              responsavel: 'Admin',
              descricao: 'Base de conhecimento e catálogo de produtos Max Nutrition'
            });
          }
          if (req.body.persona !== undefined) {
            configItems.push({
              chave: 'VOICE_AGENT_PERSONA',
              valor: req.body.persona || '',
              tipo: 'TEXTO',
              responsavel: 'Admin',
              descricao: 'Personalidade e regras de atendimento do Pedro'
            });
          }
          if (req.body.ai_provider) {
            configItems.push({
              chave: 'VOICE_AGENT_AI_PROVIDER',
              valor: req.body.ai_provider,
              tipo: 'CONFIG',
              responsavel: 'Admin',
              descricao: 'Provedor de IA do Voice Agent'
            });
          }
          if (req.body.ai_model) {
            configItems.push({
              chave: 'VOICE_AGENT_AI_MODEL',
              valor: req.body.ai_model,
              tipo: 'CONFIG',
              responsavel: 'Admin',
              descricao: 'Modelo de IA do Voice Agent'
            });
          }
          if (req.body.ai_api_key) {
            configItems.push({
              chave: 'DEEPSEEK_API_KEY',
              valor: req.body.ai_api_key,
              tipo: 'SEGREDO',
              responsavel: 'Admin',
              descricao: 'Chave de API DeepSeek para inteligência do Voice Agent'
            });
          }
          if (configItems.length > 0) {
            await supabaseFetch('/rest/v1/configuracao', {
              method: 'POST',
              headers: { 'Prefer': 'resolution=merge-duplicates' },
              body: JSON.stringify(configItems)
            }).catch(() => null);
          }
        } catch {}
      }
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/voice-agent/test-dialogue', optionalAuth, async (req, res) => {
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
        voice: voice || cfg.kokoro_voice || KOKORO_OFFICIAL_VOICE_ID
      });
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  const authenticateVoiceGateway = (req, res, next) => {
    const expected = process.env.VOICE_GATEWAY_INTERNAL_KEY;
    const supplied = String(req.headers['x-api-key'] || '');
    if (!expected || supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
      return res.status(401).json({ error: 'invalid_voice_gateway_key' });
    }
    return next();
  };
  router.post('/api/integrations/voice-agent/webhook', authenticateVoiceGateway, async (req, res) => {
    try {
      const result = await handleCallConnectedWebhook(req.body || {});
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/voice-agent/user-speech', async (req, res) => {
    try {
      const { call_id, audio_base64, format, sample_rate, speech_epoch } = req.body || {};
      if (!call_id || !audio_base64) {
        return res.status(400).json({ ok: false, error: 'call_id e audio_base64 são obrigatórios' });
      }
      const result = await processUserSpeech({
        callId: call_id,
        audioBase64: audio_base64,
        format: format || 'wav',
        sampleRate: sample_rate || 16000,
        speechEpoch: speech_epoch
      });
      return res.json({ ok: true, result });
    } catch (err) {
      console.error('[VOICE_AGENT] Erro ao processar fala do usuário:', err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/voice-agent/user-silence', async (req, res) => {
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

  router.get('/api/integrations/voice-agent/call-history/:call_id', optionalAuth, (req, res) => {
    const history = getCallHistory(req.params.call_id);
    return res.json({ ok: true, call_id: req.params.call_id, history });
  });

  // ======================================================================
  // 8. GOOGLE CLOUD CHIRP 3 HD — VOZES DE LIGAÇÕES (CALL)
  // ======================================================================

  /**
   * Status da integração Google Chirp 3 HD e voz ativa
   * GET /api/integrations/google-chirp3-hd/status
   */
  router.get('/api/integrations/google-chirp3-hd/status', optionalAuth, async (req, res) => {
    try {
      const activeVoice = getActiveCallVoice();
      const previousVoice = getPreviousCallVoice();
      const metrics = getChirp3Metrics();
      const lastAudit = getLastVoiceAudit();
      const isEnabled = isGoogleChirp3CallEnabled();

      return res.json({
        ok: true,
        provider: GOOGLE_CHIRP3_PROVIDER,
        enabled: isEnabled,
        model: 'Chirp 3 HD',
        language: process.env.GOOGLE_CALL_TTS_LANGUAGE || 'pt-BR',
        voice: activeVoice,
        previous_voice: previousVoice,
        can_restore: Boolean(previousVoice && previousVoice !== activeVoice),
        metrics,
        last_audit: lastAudit
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * Catálogo de vozes pt-BR Chirp 3 HD
   * GET /api/integrations/google-chirp3-hd/voices
   */
  router.get('/api/integrations/google-chirp3-hd/voices', optionalAuth, async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const catalog = await listAvailableChirp3Voices(forceRefresh);
      return res.json({
        ok: true,
        ...catalog,
        raw_catalog: CHIRP3_HD_VOICES_PT_BR
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * Prévia de áudio de teste no navegador (sem iniciar chamada telefônica)
   * POST /api/integrations/google-chirp3-hd/preview
   */
  router.post('/api/integrations/google-chirp3-hd/preview', optionalAuth, async (req, res) => {
    try {
      const { text, voice } = req.body || {};
      const preview = await previewGoogleCallVoice({ text, voice });
      return res.json(preview);
    } catch (err) {
      console.error('[GoogleChirp3HD] Falha na prévia de voz:', err.message);
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  /**
   * Define e persiste a nova voz padrão de chamadas
   * POST /api/integrations/google-chirp3-hd/set-voice
   */
  router.post('/api/integrations/google-chirp3-hd/set-voice', authenticateUser, async (req, res) => {
    try {
      const { voice } = req.body || {};
      if (!voice) {
        return res.status(400).json({ ok: false, error: 'O campo voice é obrigatório.' });
      }

      const updatedBy = req.user?.email || req.user?.id || 'Admin';
      const result = setActiveCallVoice(voice, updatedBy);

      // Persistência não sensível no Supabase
      if (supabaseFetch) {
        try {
          await supabaseFetch('/rest/v1/configuracao', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify([{
              chave: 'google_chirp_call_voice',
              valor: voice,
              tipo: 'CONFIG',
              responsavel: updatedBy,
              descricao: 'Voz ativa do Google Cloud Chirp 3 HD para chamadas'
            }])
          }).catch(() => null);
        } catch {}
      }

      return res.json(result);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  /**
   * Restaura a voz anterior em produção
   * POST /api/integrations/google-chirp3-hd/restore-voice
   */
  router.post('/api/integrations/google-chirp3-hd/restore-voice', authenticateUser, async (req, res) => {
    try {
      const updatedBy = req.user?.email || req.user?.id || 'Admin';
      const result = restorePreviousCallVoice(updatedBy);

      if (result.success && supabaseFetch) {
        try {
          await supabaseFetch('/rest/v1/configuracao', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify([{
              chave: 'google_chirp_call_voice',
              valor: result.voice,
              tipo: 'CONFIG',
              responsavel: updatedBy,
              descricao: 'Voz ativa do Google Cloud Chirp 3 HD para chamadas (restaurada)'
            }])
          }).catch(() => null);
        } catch {}
      }

      return res.json(result);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  /**
   * Webhook Meowcaller quando a chamada é finalizada/desconectada
   * POST /api/integrations/voice-agent/ended
   */
  router.post('/api/integrations/voice-agent/ended', async (req, res) => {
    try {
      const result = await handleCallEndedWebhook(req.body || {});
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ======================================================================
  // 9. CENTRAL DE VOZ E PERSONALIDADE — MOTOR DE LIGAÇÕES (CALL ENGINE)
  // ======================================================================

  /**
   * Retorna a configuração global do motor de chamadas
   * GET /api/integrations/call-engine/config
   */
  router.get('/api/integrations/call-engine/config', optionalAuth, async (req, res) => {
    try {
      const config = getCallEngineConfig();
      return res.json({
        ok: true,
        provider: 'google_chirp3_hd',
        model: 'Chirp 3 HD',
        language: 'pt-BR',
        ...config
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * Atualiza a configuração global (voz ativa, personalidade ativa, etc.)
   * POST /api/integrations/call-engine/config
   */
  router.post('/api/integrations/call-engine/config', authenticateUser, async (req, res) => {
    try {
      const { active_voice, active_personality } = req.body || {};
      const updatedBy = req.user?.email || req.user?.id || 'Admin';

      const updated = updateCallEngineConfig({
        activeVoice: active_voice,
        activePersonalityId: active_personality
      }, updatedBy);

      // Persiste no Supabase configuracao se disponível
      if (supabaseFetch) {
        try {
          const items = [];
          if (active_voice) {
            items.push({
              chave: 'GOOGLE_CALL_TTS_VOICE',
              valor: active_voice,
              tipo: 'CONFIG',
              responsavel: updatedBy,
              descricao: 'Voz ativa oficial Google Chirp 3 HD para chamadas'
            });
          }
          if (active_personality) {
            items.push({
              chave: 'CALL_ACTIVE_PERSONALITY',
              valor: active_personality,
              tipo: 'CONFIG',
              responsavel: updatedBy,
              descricao: 'Personalidade ativa de atendimento em chamadas'
            });
          }
          if (items.length > 0) {
            await supabaseFetch('/rest/v1/configuracao', {
              method: 'POST',
              headers: { 'Prefer': 'resolution=merge-duplicates' },
              body: JSON.stringify(items)
            }).catch(() => null);
          }
        } catch {}
      }

      return res.json({
        ok: true,
        message: 'Configurações de chamada atualizadas com sucesso.',
        config: updated
      });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  /**
   * Atualiza um dos 3 slots de vozes favoritas (Slot 1, 2 ou 3)
   * POST /api/integrations/call-engine/favorite-slot
   */
  router.post('/api/integrations/call-engine/favorite-slot', authenticateUser, async (req, res) => {
    try {
      const { slot, name, voice_id, gender } = req.body || {};
      const slotNum = Number(slot);
      if (![1, 2, 3].includes(slotNum)) {
        return res.status(400).json({ ok: false, error: 'O slot deve ser 1, 2 ou 3.' });
      }

      const updatedSlot = updateFavoriteVoiceSlot(slotNum, { name, voice_id, gender });
      const config = getCallEngineConfig();

      if (supabaseFetch) {
        try {
          await supabaseFetch('/rest/v1/configuracao', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify([{
              chave: `CALL_FAVORITE_VOICE_SLOT_${slotNum}`,
              valor: JSON.stringify(updatedSlot),
              tipo: 'CONFIG',
              responsavel: req.user?.email || 'Admin',
              descricao: `Slot ${slotNum} de voz favorita para chamadas`
            }])
          }).catch(() => null);
        } catch {}
      }

      return res.json({
        ok: true,
        message: `Slot ${slotNum} atualizado com sucesso.`,
        slot: updatedSlot,
        favorite_voices: config.favorite_voices
      });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  /**
   * Retorna as 3 personalidades oficiais de atendimento
   * GET /api/integrations/call-engine/personalities
   */
  router.get('/api/integrations/call-engine/personalities', optionalAuth, async (req, res) => {
    try {
      const personalities = getPersonalitiesList();
      return res.json({ ok: true, personalities });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * Retorna os 12 perfis independentes (4 Personagens x 3 Modos)
   * GET /api/integrations/call-engine/profiles
   */
  router.get('/api/integrations/call-engine/profiles', optionalAuth, async (req, res) => {
    try {
      const profiles = getAllProfiles12();
      const activeProfileKey = getActiveGlobalProfileKey();
      return res.json({
        ok: true,
        count: Object.keys(profiles).length,
        active_profile_key: activeProfileKey,
        profiles
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * Retorna um perfil específico por personagem e modo
   * GET /api/integrations/call-engine/profiles/:characterId/:mode
   */
  router.get('/api/integrations/call-engine/profiles/:characterId/:mode', optionalAuth, async (req, res) => {
    try {
      const { characterId, mode } = req.params;
      const profile = getProfile(characterId, mode);
      if (!profile) {
        return res.status(404).json({ ok: false, error: `Perfil '${characterId}/${mode}' não encontrado.` });
      }
      return res.json({ ok: true, profile });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * Atualiza as configurações de um perfil (voz Google Chirp, abertura ou script)
   * PUT ou POST /api/integrations/call-engine/profiles/:characterId/:mode
   */
  const handleUpdateProfile = async (req, res) => {
    try {
      const { characterId, mode } = req.params;
      const { voice_id, opening_message, opening_enabled, row_version, system_script, voice, script } = req.body || {};
      const updatedBy = req.user?.email || req.user?.id || 'Admin';

      const updates = {
        voice_id: voice_id || voice,
        opening_message, opening_enabled, row_version,
        system_script: system_script ?? script
      };

      if (updates.voice_id) {
        const catalog = await listAvailableChirp3Voices();
        if (!catalog.voices.some(v => v.name === updates.voice_id)) return res.status(400).json({ error: 'Selecione uma voz validada na lista.' });
      }

      const updated = profileStore
        ? await profileStore.save(characterId, mode, updates, updatedBy)
        : updateProfile(characterId, mode, updates, updatedBy).profile;

      return res.json({
        ok: true,
        message: `Perfil '${updated.character_name} / ${updated.mode_name}' atualizado com sucesso. Vale imediatamente!`,
        profile: updated
      });
    } catch (err) {
      return res.status(err.status === 409 ? 409 : 400).json({ ok: false, error: err.message });
    }
  };

  router.put('/api/integrations/call-engine/profiles/:characterId/:mode', authenticateUser, handleUpdateProfile);
  router.post('/api/integrations/call-engine/profiles/:characterId/:mode', authenticateUser, handleUpdateProfile);

  /**
   * Torna um perfil ativo como o perfil padrão global para novas chamadas
   * POST /api/integrations/call-engine/profiles/:characterId/:mode/activate
   */
  router.post('/api/integrations/call-engine/profiles/:characterId/:mode/activate', authenticateUser, async (req, res) => {
    try {
      const { characterId, mode } = req.params;
      const updatedBy = req.user?.email || req.user?.id || 'Admin';
      const active = profileStore
        ? await profileStore.activate(characterId, mode, updatedBy)
        : setActiveGlobalProfile(characterId, mode, updatedBy);

      return res.json({
        ok: true,
        message: `Perfil '${active.character_name} / ${active.mode_name}' definido como ativo para novas ligações.`,
        active_profile: active
      });
    } catch (err) {
      return res.status(err.status === 409 ? 409 : 400).json({ ok: false, error: err.message });
    }
  });

  /**
   * Restaura um perfil para os padrões de fábrica
   * POST /api/integrations/call-engine/profiles/:characterId/:mode/reset
   */
  router.post('/api/integrations/call-engine/profiles/:characterId/:mode/reset', authenticateUser, async (req, res) => {
    try {
      const { characterId, mode } = req.params;
      const reset = profileStore
        ? await profileStore.save(characterId, mode, req.body || {}, req.user?.email || 'Admin', true)
        : resetProfileToDefault(characterId, mode).profile;
      return res.json({
        ok: true,
        message: `Perfil '${reset.character_name} / ${reset.mode_name}' restaurado para os padrões originais.`,
        profile: reset
      });
    } catch (err) {
      return res.status(err.status === 409 ? 409 : 400).json({ ok: false, error: err.message });
    }
  });

  /**
   * Rotas legadas de personalidade (compatibilidade total)
   */
  router.post('/api/integrations/call-engine/personalities/:id', authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, tone, intensity, prompt } = req.body || {};
      const updatedBy = req.user?.email || req.user?.id || 'Admin';
      const updated = updatePersonality(id, { name, description, tone, intensity, prompt }, updatedBy);
      return res.json({
        ok: true,
        message: `Personalidade '${updated.name}' atualizada com sucesso. Vale imediatamente!`,
        personality: updated
      });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/integrations/call-engine/personalities/:id/reset', authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const reset = resetPersonalityToDefault(id);
      return res.json({
        ok: true,
        message: `Personalidade restaurada para os padrões originais com sucesso.`,
        personality: reset
      });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  /**
   * Lista as chamadas telefônicas atualmente em andamento
   * GET /api/integrations/call-engine/active-calls
   */
  router.get('/api/integrations/call-engine/active-calls', optionalAuth, async (req, res) => {
    try {
      await reconcilePhoneCalls({ listLocal: getActiveCallsList, listRemote: listMeowcallerCalls, endCall: handleCallEndedWebhook });
      const activeCalls = getActiveCallsList();
      return res.json({
        ok: true,
        count: activeCalls.length,
        calls: activeCalls
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * REQUISITO CRÍTICO: HOT-SWAP de voz e/ou personagem/modo DURANTE UMA LIGAÇÃO EM ANDAMENTO!
   * POST /api/integrations/call-engine/active-calls/:callId/switch
   */
  router.post('/api/integrations/call-engine/active-calls/:callId/switch', authenticateUser, async (req, res) => {
    try {
      const { callId } = req.params;
      const { character_id, characterId, mode, voice_id, voiceId, profile_key, profileKey, voice, personality_id } = req.body || {};
      const updatedBy = req.user?.email || req.user?.id || 'Admin';

      // Suporta tanto o novo formato (12 perfis) quanto o formato legado
      const result = switchCallRuntime({
        callId,
        characterId: character_id || characterId,
        mode,
        voiceId: voice_id || voiceId || voice,
        profileKey: profile_key || profileKey,
        personalityId: personality_id,
        updatedBy
      });

      return res.json({
        ok: true,
        ...result
      });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  /**
   * Retorna histórico de ligações com métricas e resumo acumulado
   * GET /api/integrations/call-engine/history
   */
  router.get('/api/integrations/call-engine/history', optionalAuth, async (req, res) => {
    try {
      const filter = req.query.filter || 'today';
      const limit = Number(req.query.limit) || 50;
      const historyMetrics = getCallsHistoryMetrics({ filter, limit });

      return res.json({
        ok: true,
        ...historyMetrics
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * Retorna os detalhes de uma chamada com todos os turnos expandidos
   * GET /api/integrations/call-engine/history/:callId
   */
  router.get('/api/integrations/call-engine/history/:callId', optionalAuth, async (req, res) => {
    try {
      const { callId } = req.params;
      const detail = getCallDetailById(callId);
      if (!detail) {
        return res.status(404).json({ ok: false, error: 'Chamada não encontrada no histórico.' });
      }

      return res.json({
        ok: true,
        call: detail
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * Prévia de áudio com Google Cloud Chirp 3 HD
   * POST /api/integrations/call-engine/preview
   */
  router.post('/api/integrations/call-engine/preview', optionalAuth, async (req, res) => {
    try {
      const { text, voice } = req.body || {};
      const preview = await previewGoogleCallVoice({ text, voice });
      return res.json(preview);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  /**
   * Executa um turno conversacional completo para o aplicativo web/mobile
   * Conexão DIRETA: processa o texto com DeepSeek (system_script estrito) e sintetiza com Google Cloud Chirp 3 HD
   * POST /api/integrations/call-engine/turn
   */
  router.post('/api/integrations/call-engine/transcribe', async (req,res)=>{
    try {
      const accessToken=String(req.headers.authorization || '').replace(/^Bearer /i,'');
      if(!accessToken) return res.status(401).json({error:'Entre na sua conta para conversar.'});
      const {audio_base64,mime_type}=req.body || {};
      if(typeof audio_base64 !== 'string' || audio_base64.length>2800000 ||
        !['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'].includes(mime_type))
        return res.status(400).json({error:'Formato de áudio inválido.'});
      const context=await loadCallerContext({accessToken},'vital');
      if(context.status!=='matched') return res.status(401).json({error:'Não foi possível validar sua sessão.'});
      const text=await transcribeAudio(Buffer.from(audio_base64,'base64'),mime_type);
      if(text === null) return res.status(503).json({error:'O serviço de reconhecimento não respondeu. Tente novamente.'});
      return res.json({text:cleanSpeechTranscript(text)});
    } catch { return res.status(503).json({error:'O serviço de reconhecimento está indisponível. Tente novamente.'}); }
  });

  router.post('/api/integrations/call-engine/turn', async (req, res) => {
    try {
      const { character_id, mode, user_text, history = [], is_start = false, call_id } = req.body || {};
      const callId = call_id || `WEB-${Date.now()}`;

      // Resolve o perfil correspondente
      const char = (character_id || 'rafael').toLowerCase();
      const m = is_start ? 'normal' : (mode || 'normal').toLowerCase();
      const profile = getProfile(char, m) || getProfileByKey('rafael_normal');
      // One saved character voice across all conversation modes.
      const characterVoice = getProfile(char, 'normal').voice_id;

      const accessToken = String(req.headers.authorization || '').replace(/^Bearer /i, '');
      if (!accessToken) return res.status(401).json({error:'Entre na sua conta para iniciar a chamada.'});
      const webCall = { callId, accessToken };
      const context = await loadCallerContext(webCall, profile.character_id);
      if (context.status !== 'matched') return res.status(503).json({error:'Não foi possível carregar seu cadastro. Tente novamente.'});
      if (!is_start) {
        if (!String(user_text || '').trim()) return res.status(400).json({error:'Não ouvi sua fala com clareza.'});
        const saved = await persistVoiceUtterance(webCall, profile, String(user_text).trim());
        if (!saved) return res.status(503).json({error:'Não consegui guardar sua fala. Tente novamente.'});
      }
      let replyText = '';
      const opening = webOpening(profile, is_start, user_text);
      if (opening !== null) {
        replyText = opening;
      } else if (is_start) {
        replyText = await generateNaturalOpening(profile, callId, webCall);
      } else {
        const generated = await generateAgentSpeechTextDetailed({
          prompt: String(user_text).trim(),
          history,
          profileKeyOverride: profile.profile_key,
          callContext: { callId, webCall }
        });
        replyText = generated.text;
      }

      // Sintetiza áudio via Google Cloud Chirp 3 HD
      const preview = replyText ? await previewGoogleCallVoice({
        text: replyText,
        voice: characterVoice
      }) : { audio_base64: '', content_type: 'audio/mpeg' };
      if (replyText && !await persistVoiceTurn(webCall, profile, '', replyText)) {
        return res.status(503).json({error:'Não consegui guardar a resposta. Tente novamente.'});
      }

      return res.json({
        ok: true,
        call_id: callId,
        text: replyText,
        reply_text: replyText,
        audio_base64: preview.audio_base64,
        content_type: preview.content_type || 'audio/mp3',
        voice: characterVoice,
        character_id: profile.character_id,
        character_name: profile.character_name,
        mode: profile.mode,
        mode_name: profile.mode_name,
        profile_key: profile.profile_key
      });
    } catch (err) {
      console.error('[CALL_ENGINE] Erro no turno de ligação web/mobile:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * Dispara ligação telefônica real via Meowcaller para o celular do usuário
   * POST /api/integrations/call-engine/call-phone
   */
  router.post('/api/integrations/call-engine/call-phone', optionalAuth, async (req, res) => {
    try {
      const { phone, character_id, mode } = req.body || {};
      if (!phone || String(phone).trim().length < 8) {
        return res.status(400).json({ ok: false, error: 'Número de telefone válido é obrigatório.' });
      }

      const cleanPhone = String(phone).replace(/\s+/g, '');
      const char = (character_id || 'rafael').toLowerCase();
      const m = 'normal';
      const profile = getProfile(char, m) || getProfileByKey('rafael_normal');

      // Inicia chamada no Meowcaller com a voz do Google Chirp 3 HD
      const callResult = await originateCall({
        phone: cleanPhone,
        business_id: 'BIZ-001',
        voice_profile_id: profile.voice_id
      });

      const callId = callResult?.call_id || `CALL-${Date.now()}`;

      // Registra a sessão no motor quente com o perfil selecionado
      registerCallSession({
        callId,
        remoteNumber: cleanPhone,
        direction: 'OUTBOUND',
        profileKey: profile.profile_key
      });

      return res.json({
        ok: true,
        call_id: callId,
        character: profile.character_name,
        mode: profile.mode_name,
        voice: profile.voice_id,
        phone: cleanPhone,
        message: `Chamada originada para ${cleanPhone} com sucesso via Google Chirp 3 HD!`
      });
    } catch (err) {
      console.error('[CALL_ENGINE] Erro ao originar ligação telefônica:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
}
