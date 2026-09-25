/**
 * Integrations / MeowcallerElevenBridge
 * Adaptador de sinalização e ponte de áudio entre Meowcaller (WhatsApp VoIP) e ElevenLabs (Conversational AI)
 */

import { getSignedConversationUrl } from './elevenlabs.mjs';
import { classifyMessage } from './laya.mjs';

/**
 * Orquestrador de sessões de chamadas com IA
 */
export class MeowcallerElevenBridge {
  constructor(supabaseFetch) {
    this.supabaseFetch = supabaseFetch;
    this.activeBridges = new Map();
  }

  /**
   * Inicia o bridge para uma chamada ativa
   */
  async startBridge({ callId, businessId = 'BIZ-001', voiceProfileId = null, remoteNumber = '' }) {
    const startedAt = Date.now();
    console.log(`[VOICE_BRIDGE] Iniciando bridge para call_id=${callId} (${remoteNumber})`);

    // 1. Obtém a Signed URL da ElevenLabs para o agente conversacional
    let signedUrlData = null;
    try {
      signedUrlData = await getSignedConversationUrl();
    } catch (err) {
      console.warn(`[VOICE_BRIDGE] Não foi possível obter Signed URL ElevenLabs: ${err.message}`);
    }

    const bridgeSession = {
      callId,
      businessId,
      voiceProfileId,
      remoteNumber,
      startedAt,
      signedUrl: signedUrlData?.signed_url || null,
      elevenConversationId: null,
      status: 'BRIDGE_ACTIVE',
      transcripts: [],
      latencies: {
        bridge_start_ms: Date.now() - startedAt
      }
    };

    this.activeBridges.set(callId, bridgeSession);

    // Registra evento de início no Supabase se cliente disponível
    if (this.supabaseFetch) {
      try {
        await this.supabaseFetch('/rest/v1/integration_events', {
          method: 'POST',
          body: JSON.stringify({
            provider: 'MEOWCALLER_ELEVENLABS_BRIDGE',
            business_id: businessId,
            event_type: 'BRIDGE_STARTED',
            external_id: callId,
            correlation_id: callId,
            status: 'INFO',
            payload: {
              call_id: callId,
              remote_number: remoteNumber,
              voice_profile_id: voiceProfileId,
              has_signed_url: Boolean(signedUrlData?.signed_url)
            }
          })
        });
      } catch (err) {
        console.warn(`[VOICE_BRIDGE] Falha ao registrar evento no Supabase: ${err.message}`);
      }
    }

    return bridgeSession;
  }

  /**
   * Processa transcrição gerada pelo STT da ElevenLabs durante a conversa
   * Invoca a Laya de forma assíncrona para enriquecer a inteligência sem interromper a chamada
   */
  async handleTranscript(callId, speaker, text) {
    const bridge = this.activeBridges.get(callId);
    if (!bridge || !text) return null;

    bridge.transcripts.push({ speaker, text, timestamp: new Date().toISOString() });

    // Somente o que o usuário fala é enviado para classificação na Laya
    if (speaker === 'user' && text.length > 5) {
      try {
        const layaResult = await classifyMessage({
          message: text,
          business_id: bridge.businessId,
          channel: 'voip'
        });

        bridge.lastClassification = layaResult;

        // Se Laya detectar risco crítico ou necessidade de founder, atualiza a sessão
        if (layaResult.needs_founder || layaResult.risk_score >= 4) {
          console.warn(`[VOICE_BRIDGE] ALERTA LAYA em chamada ${callId}: Risco ${layaResult.risk_score}, Urgência ${layaResult.urgency}`);
          if (this.supabaseFetch) {
            await this.supabaseFetch(`/rest/v1/call_sessions?call_id=eq.${encodeURIComponent(callId)}`, {
              method: 'PATCH',
              body: JSON.stringify({
                laya_trace_id: layaResult.trace_id,
                routed_agent_id: layaResult.suggested_agent_id,
                metadata: {
                  ...bridge,
                  urgent_escalation: true,
                  laya_summary: layaResult
                }
              })
            }).catch(() => {});
          }
        }

        return layaResult;
      } catch (err) {
        console.warn(`[VOICE_BRIDGE] Erro na inferência Laya durante chamada: ${err.message}`);
      }
    }

    return null;
  }

  /**
   * Encerra o bridge e consolida o resumo da chamada
   */
  async endBridge(callId, reason = 'NORMAL_HANGUP') {
    const bridge = this.activeBridges.get(callId);
    if (!bridge) return null;

    const durationSeconds = Math.round((Date.now() - bridge.startedAt) / 1000);
    bridge.status = 'ENDED';
    bridge.durationSeconds = durationSeconds;
    bridge.endReason = reason;

    this.activeBridges.delete(callId);

    console.log(`[VOICE_BRIDGE] Bridge encerrado para call_id=${callId}. Duração: ${durationSeconds}s`);

    // Atualiza registro no Supabase
    if (this.supabaseFetch) {
      try {
        await this.supabaseFetch(`/rest/v1/call_sessions?call_id=eq.${encodeURIComponent(callId)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'ENDED',
            ended_at: new Date().toISOString(),
            duration_seconds: durationSeconds,
            summary: bridge.transcripts.map((t) => `${t.speaker}: ${t.text}`).join('\n') || 'Chamada sem transcrição registrada.',
            metadata: {
              ...bridge,
              transcripts_count: bridge.transcripts.length
            }
          })
        });
      } catch (err) {
        console.warn(`[VOICE_BRIDGE] Falha ao atualizar call_session final: ${err.message}`);
      }
    }

    return bridge;
  }
}
