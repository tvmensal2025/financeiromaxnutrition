/**
 * call-engine.test.mjs — Testes Unitários do Motor Central de Chamadas Telefônicas (CALL)
 * Valida:
 * 1. Google Chirp 3 HD como único TTS de chamadas (sem Kokoro, sem Chatterbox em CALL)
 * 2. 3 Vozes Favoritas configuráveis
 * 3. 3 Personalidades Dinâmicas (Equilíbrio, Firme, Intenso)
 * 4. HOT-SWAP de voz e personalidade durante ligação ativa aplicado no próximo turno
 * 5. Telemetria fiel por turno: tokens DeepSeek, caracteres Chirp, latências e custos
 * 6. Histórico e Métricas
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  getCallEngineConfig,
  updateCallEngineConfig,
  updateFavoriteVoiceSlot,
  getPersonalitiesList,
  updatePersonality,
  resetPersonalityToDefault,
  registerCallSession,
  getCallSession,
  switchCallRuntime,
  recordTurnTelemetry,
  endCallSession,
  getCallsHistoryMetrics,
  getCallDetailById,
  DEFAULT_PERSONALITIES
} from '../src/integrations/call-engine.mjs';

import { routeCallAudio } from '../src/integrations/audio-router.mjs';
import { setGoogleTTSClientForTesting } from '../src/integrations/google-chirp3-hd.mjs';

describe('Motor de Ligações (Call Engine) — Testes Completos', () => {

  beforeEach(() => {
    // Restaura configurações padrão para os testes
    resetPersonalityToDefault('equilibrio');
    resetPersonalityToDefault('firme');
    resetPersonalityToDefault('intenso');
    updateCallEngineConfig({
      activeVoice: 'pt-BR-Chirp3-HD-Achernar',
      activePersonalityId: 'equilibrio'
    });
  });

  it('1. Configuração inicial adota Google Chirp 3 HD e 3 slots de vozes favoritas', () => {
    const config = getCallEngineConfig();
    assert.strictEqual(config.active_voice, 'pt-BR-Chirp3-HD-Achernar');
    assert.strictEqual(config.active_personality, 'equilibrio');
    assert.strictEqual(config.favorite_voices.length, 3);
    assert.strictEqual(config.personalities.length, 3);
  });

  it('2. 3 Personalidades estão presentes e com diretrizes profissionais (sem agressão/humilhação)', () => {
    const personalities = getPersonalitiesList();
    const ids = personalities.map(p => p.id);
    assert.ok(ids.includes('equilibrio'), 'Deve conter equilíbrio');
    assert.ok(ids.includes('firme'), 'Deve conter firme');
    assert.ok(ids.includes('intenso'), 'Deve conter intenso');

    const intenso = personalities.find(p => p.id === 'intenso');
    assert.ok(intenso.prompt.includes('SEM insultos') && intenso.prompt.includes('SEM humilhação'), 'Modo intenso proíbe insultos e humilhação');
    assert.ok(intenso.prompt.toUpperCase().includes('EMERGÊNCIA'), 'Modo intenso prioriza segurança em caso de dor ou emergência');
  });

  it('3. Editor de scripts permite atualizar e restaurar o prompt da personalidade', () => {
    const novoPrompt = 'Você é o consultor de teste com postura extremamente acolhedora e focada em resultados reais da Max Nutrition.';
    const updated = updatePersonality('equilibrio', { prompt: novoPrompt }, 'AdminTest');
    assert.strictEqual(updated.prompt, novoPrompt);

    const reset = resetPersonalityToDefault('equilibrio');
    assert.strictEqual(reset.prompt, DEFAULT_PERSONALITIES.equilibrio.prompt);
  });

  it('4. Permite configurar individualmente os 3 slots de vozes favoritas', () => {
    const updatedSlot = updateFavoriteVoiceSlot(2, {
      name: 'Voz Feminina Alternativa',
      voice_id: 'pt-BR-Chirp3-HD-Aoede',
      gender: 'FEMALE'
    });

    assert.strictEqual(updatedSlot.slot, 2);
    assert.strictEqual(updatedSlot.voice_id, 'pt-BR-Chirp3-HD-Aoede');
    assert.strictEqual(updatedSlot.name, 'Voz Feminina Alternativa');

    const config = getCallEngineConfig();
    const slot2 = config.favorite_voices.find(v => v.slot === 2);
    assert.strictEqual(slot2.voice_id, 'pt-BR-Chirp3-HD-Aoede');
  });

  it('5. HOT-SWAP: Troca de voz e personalidade durante ligação ativa é aplicada no próximo turno sem derrubar a chamada', () => {
    const callId = 'test-call-live-101';
    const session = registerCallSession({
      callId,
      remoteNumber: '+5511999998888',
      direction: 'INBOUND'
    });

    assert.ok(session);
    assert.strictEqual(session.activeVoice, 'pt-BR-Chirp3-HD-Achernar');
    assert.strictEqual(session.activePersonalityId, 'equilibrio');

    // Troca de Voz e Personalidade em tempo real durante a chamada
    const switchResult = switchCallRuntime({
      callId,
      voice: 'pt-BR-Chirp3-HD-Aoede',
      personalityId: 'firme',
      updatedBy: 'OperadorAdmin'
    });

    assert.strictEqual(switchResult.success, true);
    assert.strictEqual(switchResult.next_turn_ready, true);
    assert.strictEqual(switchResult.active_voice, 'pt-BR-Chirp3-HD-Aoede');
    assert.strictEqual(switchResult.active_personality, 'firme');

    // Verifica que a chamada CONTINUA ativa na memória (não caiu!)
    const liveSession = getCallSession(callId);
    assert.ok(liveSession, 'Chamada continua ativa');
    assert.strictEqual(liveSession.activeVoice, 'pt-BR-Chirp3-HD-Aoede');
    assert.strictEqual(liveSession.activePersonalityId, 'firme');
    assert.strictEqual(liveSession.timeline.length, 3, 'Três eventos registrados na timeline (CONNECTED, VOICE_SWITCH, PERSONALITY_SWITCH)');
  });

  it('6. Telemetria fiel por turno acumula tokens, caracteres Chirp e latências', () => {
    const callId = 'test-call-telemetry-202';
    registerCallSession({ callId, remoteNumber: '+5511988887777' });

    // Turno 1 com métricas reais
    recordTurnTelemetry({
      callId,
      userText: 'Quanto custa a creatina?',
      replyText: 'Nossa creatina cem por cento pura custa oitenta e nove reais.',
      sttMs: 380,
      llmFirstTokenMs: 220,
      llmTotalMs: 450,
      ttsMs: 310,
      turnLatencyMs: 1140,
      usage: {
        prompt_tokens: 150,
        completion_tokens: 35,
        total_tokens: 185
      },
      voice: 'pt-BR-Chirp3-HD-Achernar',
      personality: 'equilibrio'
    });

    // Turno 2 após hot-swap
    switchCallRuntime({ callId, personalityId: 'intenso', voice: 'pt-BR-Chirp3-HD-Aoede' });
    recordTurnTelemetry({
      callId,
      userText: 'E se eu comprar duas?',
      replyText: 'Duas unidades saem com frete grátis e dez por cento no Pix!',
      sttMs: 350,
      llmFirstTokenMs: 210,
      llmTotalMs: 410,
      ttsMs: 290,
      turnLatencyMs: 1050,
      usage: {
        prompt_tokens: 210,
        completion_tokens: 40,
        total_tokens: 250
      },
      voice: 'pt-BR-Chirp3-HD-Aoede',
      personality: 'intenso'
    });

    // Finaliza chamada e inspeciona métricas consolidadas
    const summary = endCallSession({ callId, reason: 'NORMAL_HANGUP' });
    assert.ok(summary);
    assert.strictEqual(summary.turn_count, 2);
    assert.strictEqual(summary.tokens.input, 360);
    assert.strictEqual(summary.tokens.output, 75);
    assert.strictEqual(summary.tokens.total, 435);
    assert.strictEqual(summary.turns.length, 2);
    assert.strictEqual(summary.turns[0].personality, 'equilibrio');
    assert.strictEqual(summary.turns[1].personality, 'intenso');
    assert.strictEqual(summary.turns[1].voice, 'pt-BR-Chirp3-HD-Aoede');
    assert.ok(summary.latency.average_ms > 0);
    assert.ok(summary.costs.cost_total_brl >= 0);

    // Consulta detalhes da chamada pelo endpoint/função de detalhe
    const detail = getCallDetailById(callId);
    assert.ok(detail);
    assert.strictEqual(detail.tokens.total, 435);
  });

  it('7. routeCallAudio utiliza estritamente Google Chirp 3 HD no fluxo de ligação', async () => {
    let googleCalled = false;
    let receivedVoice = '';

    setGoogleTTSClientForTesting({
      synthesizeSpeech: async (request) => {
        googleCalled = true;
        receivedVoice = request.voice?.name;
        return [{ audioContent: Buffer.from('FAKE_AUDIO_GOOGLE_CHIRP') }];
      }
    });

    const res = await routeCallAudio({
      text: 'Olá, sou o consultor de voz da Max Nutrition!',
      callId: 'call-tts-verify-99',
      voice: 'pt-BR-Chirp3-HD-Achernar'
    });

    assert.strictEqual(googleCalled, true, 'Google Chirp 3 HD deve ser invocado');
    assert.strictEqual(res.provider, 'google_chirp3_hd');
    assert.strictEqual(receivedVoice, 'pt-BR-Chirp3-HD-Achernar');
  });

  it('8. getCallsHistoryMetrics agrega estatísticas de hoje e períodos', () => {
    const metrics = getCallsHistoryMetrics({ filter: 'today' });
    assert.ok(metrics);
    assert.strictEqual(typeof metrics.total_calls, 'number');
    assert.strictEqual(typeof metrics.total_tokens.total, 'number');
    assert.strictEqual(typeof metrics.total_tts_chars, 'number');
  });
});
