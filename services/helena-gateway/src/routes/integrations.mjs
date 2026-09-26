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
import { MeowcallerElevenBridge } from '../integrations/bridge.mjs';
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

export function createIntegrationsRouter({ supabaseFetch, authenticateUser }) {
  const router = express.Router();
  const bridge = new MeowcallerElevenBridge(supabaseFetch);

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
      const [laya, evolution, meowcaller, elevenlabs] = await Promise.all([
        getLayaHealth().catch((err) => ({ healthy: false, error: err.message })),
        getEvolutionStatus().catch((err) => ({ configured: false, error: err.message })),
        getMeowcallerSession().catch((err) => ({ healthy: false, error: err.message })),
        getElevenLabsVoices().catch((err) => ({ configured: false, error: err.message }))
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
        elevenlabs: {
          configured: elevenlabs.configured,
          reachable: elevenlabs.reachable ?? false,
          voices_count: elevenlabs.voices_count || 0
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
      const { phone, business_id, voice_profile_id } = req.body || {};
      if (!phone) {
        return res.status(400).json({ ok: false, error: 'phone é obrigatório' });
      }

      // Inicia chamada no Meowcaller
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
  // 5. LAYA SERVICE (Classificação, Score & Roteamento)
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

  return router;
}
