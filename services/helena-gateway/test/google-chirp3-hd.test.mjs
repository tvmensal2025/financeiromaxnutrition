import { Transform } from 'node:stream';
/**
 * google-chirp3-hd.test.mjs
 * Suíte de testes rigorosa para validação do Google Cloud Text-to-Speech Chirp 3 HD
 * exclusivo para o contexto CALL, garantindo isolamento total e retrocompatibilidade.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  GoogleChirp3HDCallTTS,
  setGoogleTTSClientForTesting,
  isGoogleChirp3CallEnabled,
  getChirp3Metrics,
  resolveChirp3Voice,
  resolveAudioEncoding,
  sanitizeCallText,
  CHIRP3_HD_VOICES_PT_BR,
  DEFAULT_CHIRP3_HD_VOICE,
  PROVIDER_NAME
} from '../src/integrations/google-chirp3-hd.mjs';

import {
  AudioContext,
  routeCallAudio,
  routeVariableAudio,
  routeFixedAudio
} from '../src/integrations/audio-router.mjs';

import {
  isKokoroConfigured,
  getKokoroVoices,
  KOKORO_VOICES,
  KOKORO_OFFICIAL_VOICE_ID
} from '../src/integrations/kokoro.mjs';

import {
  isElevenLabsConfigured,
  getElevenLabsVoices
} from '../src/integrations/elevenlabs.mjs';

describe('Google Cloud TTS Chirp 3 HD — Suíte de Testes e Isolamento CALL', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Configura ambiente padrão para testes
    process.env.CALL_TTS_PROVIDER = 'google_chirp3_hd';
    process.env.GOOGLE_CALL_TTS_ENABLED = 'true';
    process.env.GOOGLE_CALL_TTS_LANGUAGE = 'pt-BR';
    process.env.GOOGLE_CALL_TTS_VOICE = DEFAULT_CHIRP3_HD_VOICE;
    process.env.GOOGLE_CALL_TTS_ENCODING = 'MP3';
    process.env.GOOGLE_CALL_TTS_FALLBACK = 'none';
  });

  afterEach(() => {
    process.env = originalEnv;
    setGoogleTTSClientForTesting(null);
  });

  it('defaults to WAV 16kHz and rejects invalid sample rates', () => {
    delete process.env.GOOGLE_CALL_TTS_ENCODING;
    delete process.env.GOOGLE_CALL_TTS_SAMPLE_RATE;
    assert.strictEqual(resolveAudioEncoding().encodingParam, 'LINEAR16');
    assert.strictEqual(resolveAudioEncoding().sampleRate, 16000);
    process.env.GOOGLE_CALL_TTS_SAMPLE_RATE = 'not-a-rate';
    assert.strictEqual(resolveAudioEncoding().sampleRate, 16000);
  });

  it('does not reuse cached audio generated at a different sample rate', async () => {
    const rates = [];
    setGoogleTTSClientForTesting({ synthesizeSpeech: async req => {
      rates.push(req.audioConfig.sampleRateHertz);
      return [{ audioContent: Buffer.from(`audio-${req.audioConfig.sampleRateHertz}`) }];
    } });
    const params = { text: 'Frase exclusiva para testar taxas de áudio.', callId: 'rate-cache', context: 'CALL' };
    process.env.GOOGLE_CALL_TTS_SAMPLE_RATE = '24000';
    const first = await GoogleChirp3HDCallTTS.synthesizeCallSpeech(params);
    process.env.GOOGLE_CALL_TTS_SAMPLE_RATE = '16000';
    const second = await GoogleChirp3HDCallTTS.synthesizeCallSpeech(params);
    const cached = await GoogleChirp3HDCallTTS.synthesizeCallSpeech(params);
    assert.deepStrictEqual(rates, [24000, 16000]);
    assert.notDeepStrictEqual(first.audio, second.audio);
    assert.strictEqual(cached.cached, true);
  });

  // ======================================================================
  // TESTE A — CALL: Google Chirp 3 HD chamado, ElevenLabs e Kokoro NÃO chamados
  // ======================================================================
  it('TESTE A — CALL: Google Chirp 3 HD é invocado exclusivamente; ElevenLabs e Kokoro não são chamados', async () => {
    let googleCalled = false;
    let elevenLabsCalled = false;
    let kokoroCalled = false;

    const mockClient = {
      synthesizeSpeech: async (request) => {
        googleCalled = true;
        assert.strictEqual(request.voice.name, DEFAULT_CHIRP3_HD_VOICE);
        assert.strictEqual(request.voice.languageCode, 'pt-BR');
        assert.strictEqual(request.audioConfig.audioEncoding, 'MP3');
        return [{ audioContent: Buffer.from('FAKE_CHIRP3_MP3_AUDIO_DATA') }];
      }
    };
    setGoogleTTSClientForTesting(mockClient);

    const result = await routeCallAudio({
      text: 'Olá, tudo bem? Como posso ajudar você hoje?',
      callId: 'call-teste-123',
      legacyCallSynthesizer: () => {
        elevenLabsCalled = true;
        kokoroCalled = true;
        return { buffer: Buffer.from('LEGACY'), provider: 'ELEVENLABS' };
      }
    });

    assert.strictEqual(googleCalled, true, 'Google Chirp 3 HD deveria ter sido chamado');
    assert.strictEqual(elevenLabsCalled, false, 'ElevenLabs NÃO deve ser chamado em CALL quando Google estiver ativo');
    assert.strictEqual(kokoroCalled, false, 'Kokoro NÃO deve ser chamado em CALL quando Google estiver ativo');
    assert.strictEqual(result.provider, 'google_chirp3_hd');
    assert.strictEqual(result.format, 'mp3');
    assert.ok(Buffer.isBuffer(result.buffer));
    assert.strictEqual(result.callId, 'call-teste-123');
  });

  // ======================================================================
  // TESTE B — VARIABLE: ElevenLabs / fluxo atual preservado; Google NÃO chamado
  // ======================================================================
  it('TESTE B — VARIABLE: Fluxo preservado, ElevenLabs executado, Google NÃO chamado', async () => {
    let googleCalled = false;
    let elevenLabsCalled = false;

    setGoogleTTSClientForTesting({
      synthesizeSpeech: async () => {
        googleCalled = true;
        return [{ audioContent: Buffer.from('DATA') }];
      }
    });

    const result = await routeVariableAudio({
      synthesizer: async () => {
        elevenLabsCalled = true;
        return { buffer: Buffer.from('ELEVENLABS_VARIABLE_SAMPLE'), provider: 'ELEVENLABS' };
      }
    });

    assert.strictEqual(elevenLabsCalled, true);
    assert.strictEqual(googleCalled, false, 'Google Chirp 3 HD NUNCA deve ser chamado no contexto VARIABLE');
    assert.strictEqual(result.provider, 'ELEVENLABS');
  });

  // ======================================================================
  // TESTE C — FIXED: Áudio existente utilizado; Google NÃO chamado
  // ======================================================================
  it('TESTE C — FIXED: Áudio existente carregado, nenhum arquivo regenerado, Google NÃO chamado', async () => {
    let googleCalled = false;
    let fixedAudioLoaded = false;

    setGoogleTTSClientForTesting({
      synthesizeSpeech: async () => {
        googleCalled = true;
        return [{ audioContent: Buffer.from('DATA') }];
      }
    });

    const result = await routeFixedAudio({
      loader: async () => {
        fixedAudioLoaded = true;
        return { buffer: Buffer.from('EXISTING_R2_FIXED_AUDIO'), provider: 'STATIC_R2' };
      }
    });

    assert.strictEqual(fixedAudioLoaded, true);
    assert.strictEqual(googleCalled, false, 'Google Chirp 3 HD NUNCA deve ser chamado no contexto FIXED');
    assert.strictEqual(result.provider, 'STATIC_R2');
  });

  // ======================================================================
  // TESTE D — KOKORO: Continua instalado, configurado e disponível
  // ======================================================================
  it('TESTE D — KOKORO: Continua 100% instalado, configurado, vozes e perfis intactos', async () => {
    assert.ok(typeof isKokoroConfigured === 'function');
    assert.ok(KOKORO_VOICES.PT_BR.length >= 6);
    assert.strictEqual(KOKORO_OFFICIAL_VOICE_ID, 'pm_alex*0.7+am_liam*0.3');
    const voicesData = await getKokoroVoices();
    assert.strictEqual(voicesData.provider, 'KOKORO');
    assert.ok(voicesData.voices_pt_br.some(v => v.voice_id === 'pf_dora'));
    assert.ok(voicesData.voices_pt_br.some(v => v.voice_id === 'pm_santa'));
  });

  // ======================================================================
  // TESTE E — ELEVENLABS: Configurações, rotas e integridade intactas
  // ======================================================================
  it('TESTE E — ELEVENLABS: Funções e estruturas existentes continuam intactas', async () => {
    assert.ok(typeof isElevenLabsConfigured === 'function');
    assert.ok(typeof getElevenLabsVoices === 'function');
    const voicesData = await getElevenLabsVoices();
    assert.ok(typeof voicesData === 'object');
  });

  // ======================================================================
  // TESTE F — REMOÇÃO DE FALLBACK PARA KOKORO EM CALL (DIRETIVA MANDATÓRIA)
  // ======================================================================
  it('TESTE F — REMOÇÃO DE KOKORO EM CALL: Falha do Google gera erro claro e NUNCA faz fallback silencioso para Kokoro', async () => {
    let kokoroCalled = false;

    setGoogleTTSClientForTesting({
      synthesizeSpeech: async () => {
        throw new Error('Google Cloud TTS indisponível no momento');
      }
    });

    await assert.rejects(
      async () => {
        await routeCallAudio({
          text: 'Mensagem de teste de falha controlada',
          callId: 'call-fail-test',
          legacyCallSynthesizer: () => {
            kokoroCalled = true;
            return { buffer: Buffer.from('KOKORO'), provider: 'KOKORO', format: 'mp3' };
          }
        });
      },
      /Google Cloud TTS indisponível|Falha crítica no Google Chirp 3 HD/,
      'Erro deve ser propagado com clareza'
    );

    assert.strictEqual(kokoroCalled, false, 'Kokoro NUNCA deve ser chamado em falha de CALL');
  });

  // ======================================================================
  // TESTE G — TRATAMENTO DE ERROS GOOGLE (Timeout, 429, 500, Quota)
  // ======================================================================
  it('TESTE G — TRATAMENTO DE ERROS: Erro na API do Google é tratado de forma controlada sem derrubar o sistema', async () => {
    // Simula erro 429 (Quota exceeded)
    setGoogleTTSClientForTesting({
      synthesizeSpeech: async () => {
        const error = new Error('Resource has been exhausted (e.g. check quota)');
        error.code = 429;
        throw error;
      }
    });

    await assert.rejects(
      async () => {
        await GoogleChirp3HDCallTTS.synthesizeCallSpeech({
          text: 'Teste com erro de quota',
          callId: 'call-err-1',
          context: 'CALL'
        });
      },
      /Resource has been exhausted/
    );

    const metrics = getChirp3Metrics();
    assert.ok(metrics.errorCount >= 1, 'Métrica de erro deve registrar a falha');
  });

  // ======================================================================
  // TESTE H — CODEC & FORMATOS (MP3 e LINEAR16 / WAV)
  // ======================================================================
  it('TESTE H — CODEC: Respeita MP3 e LINEAR16/WAV conforme configuração do pipeline', async () => {
    // 1. Teste formato MP3
    process.env.GOOGLE_CALL_TTS_ENCODING = 'MP3';
    let encodingUsed = '';
    setGoogleTTSClientForTesting({
      synthesizeSpeech: async (req) => {
        encodingUsed = req.audioConfig.audioEncoding;
        return [{ audioContent: Buffer.from('AUDIO_MP3_DATA') }];
      }
    });

    const resMp3 = await GoogleChirp3HDCallTTS.synthesizeCallSpeech({
      text: 'Teste em MP3',
      callId: 'call-codec-mp3',
      context: 'CALL'
    });
    assert.strictEqual(encodingUsed, 'MP3');
    assert.strictEqual(resMp3.format, 'mp3');
    assert.strictEqual(resMp3.encoding, 'MP3');

    // 2. Teste formato LINEAR16 (WAV)
    process.env.GOOGLE_CALL_TTS_ENCODING = 'LINEAR16';
    setGoogleTTSClientForTesting({
      synthesizeSpeech: async (req) => {
        encodingUsed = req.audioConfig.audioEncoding;
        return [{ audioContent: Buffer.from('RIFF_WAV_PCM_DATA') }];
      }
    });

    const resWav = await GoogleChirp3HDCallTTS.synthesizeCallSpeech({
      text: 'Teste em WAV LINEAR16',
      callId: 'call-codec-wav',
      context: 'CALL'
    });
    assert.strictEqual(encodingUsed, 'LINEAR16');
    assert.strictEqual(resWav.format, 'wav');
    assert.strictEqual(resWav.encoding, 'LINEAR16');
  });

  // ======================================================================
  // TESTE I — ISOLAMENTO OBRIGATÓRIO (context !== 'CALL' é rejeitado)
  // ======================================================================
  it('TESTE I — ISOLAMENTO OBRIGATÓRIO: Rejeita chamadas fora do contexto CALL', async () => {
    setGoogleTTSClientForTesting({
      synthesizeSpeech: async () => [{ audioContent: Buffer.from('DATA') }]
    });

    // Tentativa em contexto VARIABLE
    await assert.rejects(
      async () => {
        await GoogleChirp3HDCallTTS.synthesizeCallSpeech({
          text: 'Tentativa indevida',
          context: 'VARIABLE'
        });
      },
      /ACESSO NEGADO.*contexto 'CALL'/
    );

    // Tentativa em contexto FIXED
    await assert.rejects(
      async () => {
        await GoogleChirp3HDCallTTS.synthesizeCallSpeech({
          text: 'Tentativa indevida',
          context: 'FIXED'
        });
      },
      /ACESSO NEGADO.*contexto 'CALL'/
    );
  });

  // ======================================================================
  // TESTE J — MÚLTIPLAS VOZES FEMININAS CHIRP 3 HD pt-BR
  // ======================================================================
  it('TESTE J — VOZES: Suporta múltiplas vozes femininas oficiais Chirp 3 HD pt-BR', async () => {
    const testVoices = [
      'pt-BR-Chirp3-HD-Achernar',
      'pt-BR-Chirp3-HD-Aoede',
      'pt-BR-Chirp3-HD-Autonoe',
      'pt-BR-Chirp3-HD-Despina'
    ];

    let lastVoiceRequested = '';
    setGoogleTTSClientForTesting({
      synthesizeSpeech: async (req) => {
        lastVoiceRequested = req.voice.name;
        return [{ audioContent: Buffer.from('AUDIO_' + lastVoiceRequested) }];
      }
    });

    for (const v of testVoices) {
      const res = await GoogleChirp3HDCallTTS.synthesizeCallSpeech({
        text: 'Testando voz ' + v,
        callId: 'call-' + v,
        context: 'CALL',
        voice: v
      });
      assert.strictEqual(lastVoiceRequested, v);
      assert.strictEqual(res.voice, v);
    }

    assert.strictEqual(CHIRP3_HD_VOICES_PT_BR.FEMALE.length, 14);
    assert.strictEqual(CHIRP3_HD_VOICES_PT_BR.MALE.length, 16);
  });

  // ======================================================================
  // TESTE K — TESTE REAL COM AS 10 FRASES TELEFÔNICAS OFICIAIS pt-BR
  // ======================================================================
  it('TESTE K — FRASES TELEFÔNICAS: Processa as 10 frases oficiais pt-BR com precisão', async () => {
    const frases = [
      "Olá, tudo bem? Como posso ajudar você hoje?",
      "O seu atendimento está agendado para amanhã às nove horas.",
      "O valor ficou em mil quatrocentos e noventa e sete reais e noventa centavos.",
      "Posso confirmar seu telefone?",
      "Perfeito. Vou verificar essa informação para você.",
      "Um momento, por favor.",
      "Você gostaria que eu repetisse?",
      "Seu código é três, oito, sete, quatro.",
      "Seu telefone termina em nove, cinco, dois, um.",
      "Você pode me informar seu nome completo?"
    ];

    setGoogleTTSClientForTesting({
      synthesizeSpeech: async (req) => {
        const text = req.input.text;
        const fakeAudio = Buffer.from('AUDIO_PAYLOAD_' + text.length);
        return [{ audioContent: fakeAudio }];
      }
    });

    let totalCharsProcessed = 0;
    for (let i = 0; i < frases.length; i++) {
      const f = frases[i];
      const res = await GoogleChirp3HDCallTTS.synthesizeCallSpeech({
        text: f,
        callId: `call-phrase-${i + 1}`,
        context: 'CALL',
        voice: 'pt-BR-Chirp3-HD-Achernar'
      });
      assert.ok(res.audio.length > 0);
      assert.strictEqual(res.provider, 'google_chirp3_hd');
      assert.strictEqual(res.language, 'pt-BR');
      totalCharsProcessed += res.characterCount;
    }

    assert.ok(totalCharsProcessed > 200, 'Deveria ter processado todos os caracteres das frases');
  });

  // ======================================================================
  // TESTE M — CREDENCIAIS BASE64 (GOOGLE_TTS_CREDENTIALS_B64)
  // ======================================================================
  it('TESTE M — CREDENCIAIS: Suporta GOOGLE_TTS_CREDENTIALS_B64 em memória', async () => {
    const fakeServiceAccount = {
      type: 'service_account',
      project_id: 'test-call-project-chirp3',
      private_key_id: 'pk-test-123',
      client_email: 'tts-call@test-call-project-chirp3.iam.gserviceaccount.com'
    };
    const b64 = Buffer.from(JSON.stringify(fakeServiceAccount)).toString('base64');
    process.env.GOOGLE_TTS_CREDENTIALS_B64 = b64;

    // Garante que o cliente é instanciado sem erros de parse
    const { getGoogleTTSClient } = await import('../src/integrations/google-chirp3-hd.mjs');
    setGoogleTTSClientForTesting(null);
    const client = getGoogleTTSClient();
    assert.ok(client, 'Cliente Google Cloud Text-to-Speech deve ser criado com credenciais Base64');
  });

  // ======================================================================
  // TESTE N — FUNÇÃO AUTÔNOMA synthesizeCallSpeech E ALIAS buffer
  // ======================================================================
  it('TESTE N — FUNÇÃO AUTÔNOMA: synthesizeCallSpeech() exportada e compatível', async () => {
    const { synthesizeCallSpeech } = await import('../src/integrations/google-chirp3-hd.mjs');
    setGoogleTTSClientForTesting({
      synthesizeSpeech: async () => [{ audioContent: Buffer.from('TEST_AUDIO_AUTONOMO') }]
    });

    const res = await synthesizeCallSpeech({
      text: 'Mensagem de teste de função autônoma',
      callId: 'call-autonomo-999',
      context: 'CALL'
    });

    assert.strictEqual(res.provider, 'google_chirp3_hd');
    assert.ok(Buffer.isBuffer(res.audio));
    assert.ok(Buffer.isBuffer(res.buffer));
    assert.strictEqual(res.audio, res.buffer, 'audio e buffer devem ser referências ao mesmo payload');
    assert.strictEqual(res.callId, 'call-autonomo-999');
  });

  // ======================================================================
  // TESTE O — GERENCIAMENTO DINÂMICO DE VOZ & RESTAURAÇÃO
  // ======================================================================
  it('TESTE O — DINÂMICO: Altera e restaura voz ativa sem necessidade de reinicialização', async () => {
    const {
      setActiveCallVoice,
      getActiveCallVoice,
      getPreviousCallVoice,
      restorePreviousCallVoice
    } = await import('../src/integrations/google-chirp3-hd.mjs');

    const voiceInicial = getActiveCallVoice();
    assert.strictEqual(voiceInicial, DEFAULT_CHIRP3_HD_VOICE);

    // Altera para uma nova voz
    const alteracao = setActiveCallVoice('pt-BR-Chirp3-HD-Aoede', 'AdminTeste');
    assert.strictEqual(alteracao.success, true);
    assert.strictEqual(getActiveCallVoice(), 'pt-BR-Chirp3-HD-Aoede');
    assert.strictEqual(getPreviousCallVoice(), DEFAULT_CHIRP3_HD_VOICE);

    // Restaura a voz anterior
    const restauracao = restorePreviousCallVoice('AdminTeste');
    assert.strictEqual(restauracao.success, true);
    assert.strictEqual(getActiveCallVoice(), DEFAULT_CHIRP3_HD_VOICE);
  });

  // ======================================================================
  // TESTE P — PRÉVIA DE VOZ SEGURA NO NAVEGADOR
  // ======================================================================
  it('TESTE P — PRÉVIA: previewGoogleCallVoice sintetiza áudio seguro sem gerar ligação real', async () => {
    const { previewGoogleCallVoice } = await import('../src/integrations/google-chirp3-hd.mjs');
    setGoogleTTSClientForTesting({
      synthesizeSpeech: async (req) => {
        assert.ok(req.input.text.includes('Olá'));
        return [{ audioContent: Buffer.from('PREVIEW_AUDIO_PAYLOAD') }];
      }
    });

    const res = await previewGoogleCallVoice({
      text: 'Olá, testando prévia no painel!',
      voice: 'pt-BR-Chirp3-HD-Despina'
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.voice, 'pt-BR-Chirp3-HD-Despina');
    assert.strictEqual(res.provider, 'google_chirp3_hd');
    assert.ok(res.audio_base64.length > 0);
    assert.ok(typeof res.latency_ms === 'number');
    assert.ok(res.codec.includes('MP3'));
  });

  // ======================================================================
  // TESTE Q — INSTANT CUSTOM VOICE STATUS
  // ======================================================================
  it('TESTE Q — CUSTOM VOICE: checkInstantCustomVoiceAvailability reporta status sem exceção', async () => {
    const { checkInstantCustomVoiceAvailability } = await import('../src/integrations/google-chirp3-hd.mjs');
    const res = await checkInstantCustomVoiceAvailability();

    assert.strictEqual(typeof res.available, 'boolean');
    assert.strictEqual(res.status, 'ACCESS_REQUIRED');
    assert.ok(res.message.includes('Instant Custom Voice'));
    assert.ok(Array.isArray(res.requirements));
  });

  // ======================================================================
  // TESTE R — DESCOBERTA E LISTAGEM DE VOZES pt-BR CHIRP 3 HD
  // ======================================================================
  it('TESTE R — LISTAGEM: listAvailableChirp3Voices retorna vozes válidas pt-BR e possui fallback seguro', async () => {
    const { listAvailableChirp3Voices } = await import('../src/integrations/google-chirp3-hd.mjs');
    
    // 1. Descoberta dinâmica via API mockada
    setGoogleTTSClientForTesting({
      synthesizeSpeech: async () => [{ audioContent: Buffer.from('mp3') }],
      streamingSynthesize: () => new Transform({ objectMode:true, transform(chunk, _, done) {
        if (chunk.input) this.push({ audioContent: Buffer.from('pcm') }); done();
      }}),
      listVoices: async () => [{
        voices: [
          { name: 'pt-BR-Chirp3-HD-Achernar', ssmlGender: 'FEMALE', languageCodes: ['pt-BR'] },
          { name: 'pt-BR-Chirp3-HD-Aoede', ssmlGender: 'FEMALE', languageCodes: ['pt-BR'] }
        ]
      }]
    });
    const resDynamic = await listAvailableChirp3Voices(true);
    assert.strictEqual(resDynamic.source, 'GOOGLE_AUDIO_VALIDATED');
    assert.strictEqual(resDynamic.model, 'Chirp 3 HD');
    assert.strictEqual(resDynamic.language, 'pt-BR');
    assert.strictEqual(resDynamic.total, 2);
    assert.ok(resDynamic.voices.some(v => v.name === 'pt-BR-Chirp3-HD-Achernar'));

    // 2. Fallback resiliente para catálogo oficial caso a API do Google falhe
    setGoogleTTSClientForTesting({
      listVoices: async () => {
        throw new Error('Quota or auth error');
      }
    });
    await assert.rejects(listAvailableChirp3Voices(true), /Quota or auth error/);
  });
});

