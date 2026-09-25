/**
 * Routes / Integrations
 * Endpoints REST administrativos e webhooks para Central de Canais, Voz e Roteamento
 */

import express from 'express';
import { getLayaHealth, classifyMessage, scoreMessage, routeMessage } from '../integrations/laya.mjs';
import {
  getEvolutionStatus,
  connectEvolution,
  pairEvolution,
  disconnectEvolution,
  sendEvolutionText,
  normalizeEvolutionWebhookEvent,
  isEvolutionConfigured
} from '../integrations/evolution.mjs';
import {
  getMeowcallerHealth,
  getMeowcallerSession,
  startMeowcallerSession,
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

export function createIntegrationsRouter({ supabaseFetch, authenticateUser }) {
  const router = express.Router();
  const bridge = new MeowcallerElevenBridge(supabaseFetch);

  // ======================================================================
  // 1. HEALTH E STATUS AGREGADO (Diretiva 28)
  // ======================================================================

  router.get('/api/integrations/status', async (req, res) => {
    try {
      const [laya, evolution, meowcaller, elevenlabs] = await Promise.all([
        getLayaHealth().catch((err) => ({ healthy: false, error: err.message })),
        getEvolutionStatus().catch((err) => ({ configured: false, error: err.message })),
        getMeowcallerHealth().catch((err) => ({ healthy: false, error: err.message })),
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

  router.get('/api/integrations/evolution/status', authenticateUser, async (req, res) => {
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

  // Webhook público da Evolution API
  router.post('/webhooks/evolution', async (req, res) => {
    try {
      const event = normalizeEvolutionWebhookEvent(req.body);
      if (!event) {
        return res.status(200).json({ ok: true, ignored: true });
      }

      console.log(`[EVOLUTION_WEBHOOK] Evento recebido: ${event.eventType} (${event.direction || 'status'})`);

      // Se for mensagem inbound de cliente, registra em comunicacoes e aciona Laya
      if (event.isMessage && event.direction === 'ENTRADA' && event.text) {
        let classification = null;
        try {
          classification = await classifyMessage({
            message: event.text,
            business_id: 'BIZ-001',
            channel: 'whatsapp'
          });
        } catch (layaErr) {
          console.warn(`[EVOLUTION_WEBHOOK] Laya indisponível para classificação: ${layaErr.message}`);
        }

        // Grava na tabela public.comunicacoes com idempotência
        if (supabaseFetch) {
          const commId = `COMM-${Date.now().toString(36).toUpperCase()}`;
          await supabaseFetch('/rest/v1/comunicacoes', {
            method: 'POST',
            body: JSON.stringify({
              communication_id: commId,
              data_hora: new Date().toISOString(),
              business_id: classification?.business_id || 'BIZ-001',
              canal: 'WHATSAPP',
              direction: 'ENTRADA',
              pessoa_empresa: event.pessoa_empresa,
              remetente: event.remote_number,
              destinatario: 'Helena WhatsApp',
              assunto: classification?.intent || 'Mensagem WhatsApp',
              resumo: event.text.slice(0, 500),
              responsavel: classification?.suggested_agent_name || 'Joana',
              source_system: 'Evolution API',
              external_id: event.external_message_id,
              idempotency_key: event.external_message_id || `evo-${Date.now()}`,
              status: 'RECEBIDA'
            })
          }).catch((err) => console.warn(`[EVOLUTION_WEBHOOK] Erro ao gravar comunicacao: ${err.message}`));
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

  router.get('/api/integrations/meowcaller/status', authenticateUser, async (req, res) => {
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

  router.get('/api/integrations/elevenlabs/voices', authenticateUser, async (req, res) => {
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

  router.get('/api/integrations/events', authenticateUser, async (req, res) => {
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
