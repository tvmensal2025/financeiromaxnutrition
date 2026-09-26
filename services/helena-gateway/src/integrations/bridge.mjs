/**
 * Integrations / MeowcallerKokoroBridge (Voice Bridge Oficial)
 * Adaptador de sinalização e ponte de áudio entre Meowcaller (WhatsApp VoIP) e Kokoro Neural TTS VPS
 * Provedor oficial do Sistema Helena para sintetização de fala e áudios
 */

import { generateKokoroSpeech, isKokoroConfigured, KOKORO_OFFICIAL_VOICE_ID, KOKORO_DEFAULT_PROFILE_ID } from './kokoro.mjs';
import { getSignedConversationUrl } from './elevenlabs.mjs';
import { classifyMessage } from './laya.mjs';

/**
 * Orquestrador de sessões de chamadas e áudio com IA usando Kokoro Neural TTS
 */
export class MeowcallerVoiceBridge {
  constructor(supabaseFetch) {
    this.supabaseFetch = supabaseFetch;
    this.activeBridges = new Map();
  }

  /**
   * Inicia o bridge para uma chamada ativa com Kokoro como motor oficial
   */
  async startBridge({ callId, businessId = 'BIZ-001', voiceProfileId = KOKORO_DEFAULT_PROFILE_ID, remoteNumber = '' }) {
    const startedAt = Date.now();
    const effectiveProfileId = voiceProfileId || KOKORO_DEFAULT_PROFILE_ID;
    console.log(`[VOICE_BRIDGE] Iniciando bridge Kokoro Oficial para call_id=${callId} (${remoteNumber}) - Perfil: ${effectiveProfileId}`);

    // Verifica se Kokoro TTS está pronto na VPS
    const kokoroReady = isKokoroConfigured();

    // Fallback de contingência para ElevenLabs se necessário
    let signedUrlData = null;
    if (!kokoroReady) {
      try {
        signedUrlData = await getSignedConversationUrl();
      } catch (err) {
        console.warn(`[VOICE_BRIDGE] Contingência ElevenLabs indisponível: ${err.message}`);
      }
    }

    const bridgeSession = {
      callId,
      businessId,
      voiceProfileId: effectiveProfileId,
      remoteNumber,
      startedAt,
      engine: kokoroReady ? 'KOKORO_NEURAL_TTS' : 'ELEVENLABS_FALLBACK',
      voiceId: KOKORO_OFFICIAL_VOICE_ID,
      signedUrl: signedUrlData?.signed_url || null,
      status: 'BRIDGE_ACTIVE',
      transcripts: [],
      audioOutputs: [],
      latencies: {
        bridge_start_ms: Date.now() - startedAt
      }
    };

    this.activeBridges.set(callId, bridgeSession);

    // Registra evento de início no Supabase
    if (this.supabaseFetch) {
      try {
        await this.supabaseFetch('/rest/v1/integration_events', {
          method: 'POST',
          body: JSON.stringify({
            provider: 'MEOWCALLER_KOKORO_BRIDGE',
            business_id: businessId,
            event_type: 'BRIDGE_STARTED',
            external_id: callId,
            correlation_id: callId,
            status: 'INFO',
            payload: {
              call_id: callId,
              remote_number: remoteNumber,
              voice_profile_id: effectiveProfileId,
              engine: bridgeSession.engine,
              official_voice: KOKORO_OFFICIAL_VOICE_ID
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
   * Sintetiza resposta de voz em tempo real para a chamada usando Kokoro TTS
   * @param {string} callId
   * @param {string} text Texto que o agente irá falar na chamada
   * @param {string} [voiceId] Voz opcional (default: Pedro Oficial)
   */
  async speak(callId, text, voiceId = KOKORO_OFFICIAL_VOICE_ID) {
    const bridge = this.activeBridges.get(callId);
    if (!bridge || !text) return null;

    try {
      const speech = await generateKokoroSpeech({
        input: text,
        voice: voiceId
      });

      bridge.audioOutputs.push({
        text,
        voice: voiceId,
        durationMs: speech.durationMs,
        sizeBytes: speech.sizeBytes,
        timestamp: new Date().toISOString()
      });

      bridge.transcripts.push({
        speaker: 'agent_pedro',
        text,
        timestamp: new Date().toISOString()
      });

      return speech;
    } catch (err) {
      console.error(`[VOICE_BRIDGE] Erro ao sintetizar áudio na chamada ${callId}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Processa transcrição durante a conversa e enriquece com a Laya
   */
  async handleTranscript(callId, speaker, text) {
    const bridge = this.activeBridges.get(callId);
    if (!bridge || !text) return null;

    bridge.transcripts.push({ speaker, text, timestamp: new Date().toISOString() });

    // Somente o que o interlocutor fala é enviado para classificação na Laya
    if (speaker === 'user' && text.length > 5) {
      try {
        const layaResult = await classifyMessage({
          message: text,
          business_id: bridge.businessId,
          channel: 'voip'
        });

        bridge.lastClassification = layaResult;

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

    console.log(`[VOICE_BRIDGE] Bridge Kokoro encerrado para call_id=${callId}. Duração: ${durationSeconds}s`);

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
              transcripts_count: bridge.transcripts.length,
              audio_outputs_count: bridge.audioOutputs.length
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

// Exportações retrocompatíveis para o Helena Gateway
export const MeowcallerElevenBridge = MeowcallerVoiceBridge;
export const MeowcallerKokoroBridge = MeowcallerVoiceBridge;
