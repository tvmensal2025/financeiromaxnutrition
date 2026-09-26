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
  updateVoiceAgentConfig,
  generateAgentSpeechText,
  speakInCall,
  handleCallConnectedWebhook
} from '../integrations/voice-agent.mjs';

import { MeowcallerElevenBridge, MeowcallerKokoroBridge } from '../integrations/bridge.mjs';

// ======================================================================
// Helper para construção de auto-resposta inteligente / Menu URA (1, 2, 3...)
// ======================================================================
export function buildAutoReplyMessage({ text = '', classification = null, pushName = '' }) {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const saudacaoNome = pushName ? `, *${pushName}*` : '';

  // 1. Mensagens de saudação inicial ou pedido de menu
  const isGreeting =
    /^(oi|ol[aá]|bom dia|boa tarde|boa noite|menu|ajuda|in[ií]cio|come[cç]ar|op[cç][oõ]es|\?)$/i.test(trimmed) ||
    lower === 'alo' ||
    lower === 'alô' ||
    lower === 'ola helena' ||
    lower === 'oi helena';

  if (isGreeting) {
    return (
      `👋 Olá${saudacaoNome}! Seja bem-vindo(a) à *Max Nutrition*.\n\n` +
      `Eu sou a *Helena*, assistente virtual executiva. Como posso te ajudar hoje?\n\n` +
      `Digite o *número* da opção desejada:\n` +
      `1️⃣ *Comercial & Vendas* (Planos, produtos e novas assinaturas)\n` +
      `2️⃣ *Suporte ao Cliente* (Dúvidas, acessos e ajuda com pedidos)\n` +
      `3️⃣ *Financeiro & Boletos* (2ª via, faturas e pagamentos)\n` +
      `4️⃣ *Atendimento Executivo & Outros assuntos*\n\n` +
      `_Você pode digitar o número (1, 2, 3 ou 4) ou simplesmente escrever sua dúvida!_`
    );
  }

  // 2. Opção 1: Vendas / Comercial
  if (
    trimmed === '1' ||
    lower.startsWith('1 ') ||
    lower.includes('opcao 1') ||
    lower.includes('opção 1')
  ) {
    return (
      `🛒 *Opção 1 selecionada — Comercial & Vendas*\n\n` +
      `Seu atendimento foi direcionado para nossa equipe comercial com o especialista *Victor (AGT-15)*.\n\n` +
      `Qual produto ou plano você gostaria de conhecer ou adquirir?`
    );
  }

  // 3. Opção 2: Suporte / Acessos
  if (
    trimmed === '2' ||
    lower.startsWith('2 ') ||
    lower.includes('opcao 2') ||
    lower.includes('opção 2')
  ) {
    return (
      `🛠️ *Opção 2 selecionada — Suporte & Atendimento*\n\n` +
      `Seu chamado foi aberto e atribuído à especialista *Joana (AGT-20)* do nosso Atendimento.\n\n` +
      `Por favor, detalhe sua dúvida ou o que está acontecendo com seu acesso/pedido para agilizarmos a solução.`
    );
  }

  // 4. Opção 3: Financeiro / Faturas
  if (
    trimmed === '3' ||
    lower.startsWith('3 ') ||
    lower.includes('opcao 3') ||
    lower.includes('opção 3')
  ) {
    return (
      `💳 *Opção 3 selecionada — Setor Financeiro*\n\n` +
      `Seu atendimento foi encaminhado para o *Analista Financeiro (AGT-04)*.\n\n` +
      `Por favor, informe seu CPF/CNPJ ou o número da fatura para localizarmos seus lançamentos.`
    );
  }

  // 5. Opção 4: Executivo / Jurídico / Outros
  if (
    trimmed === '4' ||
    lower.startsWith('4 ') ||
    lower.includes('opcao 4') ||
    lower.includes('opção 4')
  ) {
    return (
      `⚖️ *Opção 4 selecionada — Atendimento Executivo*\n\n` +
      `Sua mensagem foi encaminhada diretamente para a mesa da *Helena (Diretoria Executiva)*.\n\n` +
      `Um responsável entrará em contato em breve para atendê-lo(a).`
    );
  }

  // 6. Resposta contextual baseada na classificação inteligente da Laya
  if (classification) {
    if (classification.area === 'VENDAS') {
      return (
        `👋 Olá${saudacaoNome}! Recebemos sua mensagem comercial.\n\n` +
        `Seu pedido foi registrado e direcionado para *Victor (Comercial)*. Em instantes um especialista dará sequência ao seu atendimento!`
      );
    }
    if (classification.area === 'FINANCEIRO') {
      return (
        `💳 Olá${saudacaoNome}! Identificamos sua solicitação sobre faturas e pagamentos.\n\n` +
        `Seu chamado já está com o *Analista Financeiro*. Se desejar, envie seu CPF/CNPJ para agilizarmos a consulta!`
      );
    }
    if (classification.area === 'JURIDICO' || classification.urgency >= 5) {
      return (
        `⚠️ Olá${saudacaoNome}! Sua mensagem foi registrada com prioridade executiva e encaminhada para a mesa da *Helena (Diretoria Executiva)* para acompanhamento imediato.`
      );
    }
  }

  // Fallback padrão amigável
  return (
    `👋 Olá${saudacaoNome}! Sua mensagem foi recebida com sucesso pela *Max Nutrition*.\n\n` +
    `Encaminhamos sua solicitação para nossa equipe de atendimento (*Joana*). Em instantes você receberá retorno.\n\n` +
    `_Se precisar voltar ao menu principal a qualquer momento, basta digitar *menu*._`
  );
}

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

        // 1. Grava mensagem de entrada na tabela public.comunicacoes com idempotência
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
          }).catch((err) => console.warn(`[EVOLUTION_WEBHOOK] Erro ao gravar comunicacao de entrada: ${err.message}`));

          // 2. Se houver agente sugerido, cria agent_job na esteira de atendimento
          const targetAgentId = classification?.suggested_agent_id || 'AGT-20';
          const jobId = `JOB-WPP-${Date.now().toString(36).toUpperCase()}`;
          await supabaseFetch('/rest/v1/agent_jobs', {
            method: 'POST',
            body: JSON.stringify({
              job_id: jobId,
              agent_id: targetAgentId,
              business_id: classification?.business_id || 'BIZ-001',
              objective: `Atendimento WhatsApp: ${event.text.slice(0, 100)}`,
              instruction: `Cliente: ${event.pessoa_empresa} (${event.remote_number})\nMensagem: ${event.text}\nIntenção: ${classification?.intent || 'atendimento'}\nÁrea: ${classification?.area || 'ATENDIMENTO'}`,
              priority: classification?.urgency >= 4 ? 'ALTA' : 'MEDIA',
              status: 'READY',
              idempotency_key: `job-${event.external_message_id || Date.now()}`
            })
          }).catch((err) => console.warn(`[EVOLUTION_WEBHOOK] Erro ao criar agent_job: ${err.message}`));
        }

        // 3. Constrói auto-resposta inteligente com Menu URA
        const replyText = buildAutoReplyMessage({
          text: event.text,
          classification,
          pushName: event.pessoa_empresa
        });

        // 4. Envia mensagem de volta ao cliente via Evolution API se configurada
        if (isEvolutionConfigured() && replyText) {
          try {
            const sendResult = await sendEvolutionText(event.remote_number, replyText);
            console.log(`[EVOLUTION_WEBHOOK] Auto-resposta enviada para ${event.remote_number} (msgId: ${sendResult?.messageId})`);

            // 5. Registra a resposta enviada em public.comunicacoes
            if (supabaseFetch) {
              const replyCommId = `COMM-OUT-${Date.now().toString(36).toUpperCase()}`;
              await supabaseFetch('/rest/v1/comunicacoes', {
                method: 'POST',
                body: JSON.stringify({
                  communication_id: replyCommId,
                  data_hora: new Date().toISOString(),
                  business_id: classification?.business_id || 'BIZ-001',
                  canal: 'WHATSAPP',
                  direction: 'SAÍDA',
                  pessoa_empresa: event.pessoa_empresa,
                  remetente: 'Helena WhatsApp',
                  destinatario: event.remote_number,
                  assunto: `Auto-resposta: ${classification?.intent || 'Menu'}`,
                  resumo: replyText.slice(0, 500),
                  responsavel: 'Helena',
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
          await supabaseFetch('/rest/v1/configuracao', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify([
              {
                chave: 'VOICE_AGENT_KNOWLEDGE_BASE',
                valor: req.body.knowledge_base || '',
                tipo: 'TEXTO',
                responsavel: 'Admin',
                descricao: 'Base de conhecimento e catálogo de produtos Max Nutrition'
              },
              {
                chave: 'VOICE_AGENT_PERSONA',
                valor: req.body.persona || '',
                tipo: 'TEXTO',
                responsavel: 'Admin',
                descricao: 'Personalidade e regras de atendimento do Pedro'
              }
            ])
          }).catch(() => null);
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
      const sample = await generateKokoroSample({
        text: responseText,
        voice: voice || KOKORO_OFFICIAL_VOICE_ID
      });
      return res.json({
        ok: true,
        prompt,
        response_text: responseText,
        audio_url: sample.audio_url,
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

  router.post('/api/integrations/voice-agent/webhook', async (req, res) => {
    try {
      const result = await handleCallConnectedWebhook(req.body || {});
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
}
