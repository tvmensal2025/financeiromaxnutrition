/**
 * eliving-voice-rules.test.mjs — GUARDIÃO da voz do eLiving no Helena Gateway.
 *
 * Regra do dono (06/10/2026), dados em src/integrations/eliving-voice-config.mjs (gerado da fonte única
 * do app ids-max): ElevenLabs V4 Turbo primeiro, com a voz e o padrão do PERSONAGEM; Google Chirp 3 HD
 * só como reserva (cota/falha), com a voz fixa do personagem e texto sem tags. Uma voz por personagem nos
 * dois provedores. Nenhuma voz legada nem modelo antigo no código. Tom "emocionar sem envergonhar".
 * Toda rede aqui é simulada (fetch e cliente Google falsos).
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable, Transform } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import express from 'express';

import ELIVING_VOICE_CONFIG from '../src/integrations/eliving-voice-config.mjs';
import { NATURAL_OPENING_PROMPT } from '../src/integrations/conversation-mode.mjs';
import {
  ELEVENLABS_CHARACTER_VOICES,
  resetElevenLabsQuotaStatus
} from '../src/integrations/elevenlabs.mjs';
import { openCallTTSStream } from '../src/integrations/call-tts-stream.mjs';
import { streamReplyToCall } from '../src/integrations/call-streaming.mjs';
import { setGoogleTTSClientForTesting, setActiveCallVoice } from '../src/integrations/google-chirp3-hd.mjs';
import { isAudioTagAllowed, stripAudioTags } from '../src/integrations/conversation-naturalness.mjs';
import {
  CHARACTERS_MAP,
  DEFAULT_PROFILES_12,
  DEFAULT_PERSONALITIES,
  MODES_MAP,
  getAllProfiles12,
  getProfileByKey,
  registerCallSession,
  switchCallRuntime,
  updateFavoriteVoiceSlot,
  updateCallEngineConfig,
  updateProfile,
  resetProfileToDefault,
  endCallSession
} from '../src/integrations/call-engine.mjs';

const VOICES = ELIVING_VOICE_CONFIG.characters;
const CHARACTER_IDS = ['sirlene', 'alex', 'vital', 'rafael'];
const SRC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const CONFIG_FILE = path.join(SRC_DIR, 'integrations', 'eliving-voice-config.mjs');

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(mjs|js|cjs|json)$/.test(name) && full !== CONFIG_FILE) out.push(full);
  }
  return out;
}

function isDeepFrozen(value) {
  if (!value || typeof value !== 'object') return true;
  return Object.isFrozen(value) && Object.values(value).every(isDeepFrozen);
}

function fakeChirp() {
  const state = { config: null, text: '' };
  const stream = new Transform({
    objectMode: true,
    transform(msg, _enc, cb) {
      if (msg.streamingConfig) state.config = msg.streamingConfig;
      if (msg.input?.text) { state.text += msg.input.text; this.push({ audioContent: Buffer.alloc(640, 1) }); }
      cb();
    }
  });
  return { stream, state };
}

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
  resetElevenLabsQuotaStatus();
  setGoogleTTSClientForTesting(null);
});

describe('Guardião da voz do eLiving (gateway)', () => {
  it('a configuração gerada está íntegra (hash da fonte única) e congelada', () => {
    const { sourceHash, ...rest } = ELIVING_VOICE_CONFIG;
    assert.equal(sourceHash, createHash('sha256').update(JSON.stringify(rest)).digest('hex'),
      'eliving-voice-config.mjs foi editado à mão: regenere no ids-max com scripts/sync-voice-config-gateway.mjs');
    assert.ok(isDeepFrozen(ELIVING_VOICE_CONFIG));
    assert.deepEqual(ELIVING_VOICE_CONFIG.models, { gravado: 'eleven_v4', tempoReal: 'eleven_v4_turbo' });
    assert.equal(ELIVING_VOICE_CONFIG.audioTagsDono.length, 27);
  });

  it('nenhuma voz legada, modelo antigo, voz por ambiente ou tag inventada em src/ fora da configuração', () => {
    const legacyIds = Object.keys(ELIVING_VOICE_CONFIG.legacyVoiceIds);
    const legacyModels = ELIVING_VOICE_CONFIG.legacyModels;
    const legacyPrefixes = ELIVING_VOICE_CONFIG.legacyModelPrefixes;
    const invented = /\[(warmly|cheerfully|amazed|surprised|groaning|hesitant|comforting|quizzically|sigh|annoyed|shocked|giggling|whispering|indecisive)\]/i;
    const problems = [];
    for (const file of sourceFiles(SRC_DIR)) {
      const text = readFileSync(file, 'utf8');
      const rel = path.relative(SRC_DIR, file);
      for (const id of legacyIds) if (text.includes(id)) problems.push(`${rel}: voz legada ${id}`);
      for (const model of legacyModels) if (text.includes(model)) problems.push(`${rel}: modelo antigo ${model}`);
      for (const prefix of legacyPrefixes) if (text.includes(prefix)) problems.push(`${rel}: modelo antigo ${prefix}*`);
      if (/env(\.|\[['"`])(ELEVENLABS_VOICE_|ELEVENLABS_DEFAULT_VOICE_ID|ELEVENLABS_VOICE_ID)/.test(text)) problems.push(`${rel}: voz de personagem por variável de ambiente`);
      const tag = text.match(invented);
      if (tag) problems.push(`${rel}: tag inventada ${tag[0]}`);
    }
    assert.deepEqual(problems, []);
  });

  it('uma voz ElevenLabs por personagem, da configuração única; Rafael ≠ Alex', () => {
    for (const id of CHARACTER_IDS) assert.equal(ELEVENLABS_CHARACTER_VOICES[id], VOICES[id].voiceId);
    assert.notEqual(ELEVENLABS_CHARACTER_VOICES.rafael, ELEVENLABS_CHARACTER_VOICES.alex);
    assert.equal(new Set(CHARACTER_IDS.map(id => ELEVENLABS_CHARACTER_VOICES[id])).size, 4);
  });

  it('voz Google única por personagem nos 12 perfis e no CHARACTERS_MAP', () => {
    const google = CHARACTER_IDS.map(id => VOICES[id].googleFallbackVoice);
    assert.equal(new Set(google).size, 4, 'nenhuma voz Google repetida entre personagens');
    for (const id of CHARACTER_IDS) assert.equal(CHARACTERS_MAP[id].defaultVoice, VOICES[id].googleFallbackVoice);
    const defaults = Object.values(DEFAULT_PROFILES_12);
    assert.equal(defaults.length, 12);
    for (const profile of [...defaults, ...getAllProfiles12()]) {
      assert.equal(profile.voice_id, VOICES[profile.character_id].googleFallbackVoice, `${profile.profile_key} usa voz de outro personagem`);
    }
  });

  it('stream da ligação usa eleven_v4_turbo e o voice_settings do personagem (fetch simulado)', async () => {
    process.env.ELEVENLABS_API_KEY = 'chave-de-teste-simulada';
    delete process.env.ELEVENLABS_CALL_ENABLED;
    for (const id of CHARACTER_IDS) {
      const calls = [];
      const fetchImpl = async (url, opts) => {
        calls.push({ url, body: JSON.parse(opts.body) });
        return { ok: true, status: 200, body: Readable.from([Buffer.alloc(320, 1)]) };
      };
      const stream = openCallTTSStream({ characterId: id, fetchImpl });
      stream.resume();
      stream.write({ input: { text: 'Bom dia, tudo certo por aí?' } });
      stream.end();
      await new Promise(resolve => stream.once('finish', resolve));
      assert.equal(calls.length, 1);
      assert.ok(calls[0].url.includes(`/v1/text-to-speech/${VOICES[id].voiceId}/stream`), `${id}: voz errada`);
      assert.equal(calls[0].body.model_id, 'eleven_v4_turbo');
      assert.deepEqual(calls[0].body.voice_settings, { ...VOICES[id].voiceSettings });
    }
  });

  it('429 → Chirp na hora, com a voz Google do personagem e texto sem tags, sem derrubar a ligação', async () => {
    process.env.ELEVENLABS_API_KEY = 'chave-de-teste-simulada';
    const chirp = fakeChirp();
    setGoogleTTSClientForTesting({ streamingSynthesize: () => chirp.stream });
    const fetchImpl = async () => ({ ok: false, status: 429, text: async () => '{"detail":{"status":"quota_exceeded"}}' });
    const stream = openCallTTSStream({ characterId: 'sirlene', voice: 'pt-BR-Chirp3-HD-Charon', fetchImpl });
    let failure = null;
    stream.on('error', err => { failure = err; });
    stream.resume();
    stream.write({ input: { text: '[laughs] Que bom te ouvir! [short pause] Como foi o almoço?' } });
    stream.end();
    await new Promise(resolve => stream.once('finish', resolve));
    assert.equal(failure, null);
    assert.equal(chirp.state.config.voice.name, VOICES.sirlene.googleFallbackVoice);
    assert.doesNotMatch(chirp.state.text, /\[|\]/);
    assert.ok(chirp.state.text.includes('Que bom te ouvir!'));
  });

  it('trocar voz no painel não muda a voz da ElevenLabs nem faz um personagem falar com a voz de outro', async () => {
    process.env.ELEVENLABS_API_KEY = 'chave-de-teste-simulada';
    const callId = `guardiao-painel-${Date.now()}`;
    try {
      // Trocas de voz pelo painel: voz ativa global, slot favorito, config, perfil salvo e troca ao vivo.
      setActiveCallVoice(VOICES.sirlene.googleFallbackVoice, 'Guardião');
      updateFavoriteVoiceSlot(1, { voice_id: VOICES.alex.googleFallbackVoice });
      updateCallEngineConfig({ activeVoice: VOICES.vital.googleFallbackVoice });
      const saved = updateProfile('rafael', 'normal', { voice_id: VOICES.alex.googleFallbackVoice }, 'Guardião');
      assert.equal(saved.voice_id, VOICES.rafael.googleFallbackVoice);

      registerCallSession({ callId, direction: 'OUTBOUND', profileKey: 'rafael_normal' });
      const swap = switchCallRuntime({ callId, voice: VOICES.alex.googleFallbackVoice, personalityId: 'firme' });
      assert.equal(swap.active_character_id, 'rafael');
      assert.equal(swap.active_voice, VOICES.rafael.googleFallbackVoice);

      // Turno real da ligação (OpenAI e ElevenLabs simulados): a voz vem do personagem do perfil.
      const profile = getProfileByKey(swap.active_profile_key);
      const elevenUrls = [];
      const event = data => Buffer.from(`data: ${JSON.stringify(data)}\n\n`);
      const fetchImpl = async (url, opts) => {
        if (String(url).includes('api.openai.com')) {
          return { ok: true, body: Readable.from([
            event({ choices: [{ delta: { content: '[curious] Qual hábito você quer firmar hoje?' } }] }),
            event({ choices: [{ delta: {}, finish_reason: 'stop' }] })
          ]) };
        }
        if (String(url).includes('api.elevenlabs.io')) {
          elevenUrls.push({ url: String(url), body: JSON.parse(opts.body) });
          return { ok: true, status: 200, body: Readable.from([Buffer.alloc(320, 1)]) };
        }
        throw new Error(`rede real bloqueada no teste: ${url}`);
      };
      const result = await streamReplyToCall({
        callId, speechEpoch: 1, apiKey: 'chave-simulada', systemInstruction: profile.system_script,
        userPrompt: 'Oi', history: [], voice: VOICES.alex.googleFallbackVoice, profile, fetchImpl,
        consumeAudio: async audio => { for await (const _ of audio) { /* consome */ } return { ok: true }; }
      });
      assert.equal(result.text, 'Qual hábito você quer firmar hoje?');
      assert.equal(elevenUrls.length, 1);
      assert.ok(elevenUrls[0].url.includes(`/text-to-speech/${VOICES.rafael.voiceId}/stream`), 'ElevenLabs com a voz do Rafael');
      assert.ok(!elevenUrls[0].url.includes(VOICES.alex.voiceId));
      assert.equal(elevenUrls[0].body.model_id, 'eleven_v4_turbo');
      assert.equal(elevenUrls[0].body.text, '[curious] Qual hábito você quer firmar hoje?');
    } finally {
      endCallSession({ callId, reason: 'TEST_CLEANUP' });
      resetProfileToDefault('rafael', 'normal');
    }
  });

  it('textos dos perfis: eLiving, mentor, pilar certo, sem "Max", "coach", culpa ou pressão comercial', () => {
    const banned = /\bMax\b|MaxNutrition|coach|sem desculpas|historinha|furou a dieta|mimimi|pregui[cç]a|postergando|neglig[eê]ncia|suplementa[cç][aã]o|fechar compra|zona de conforto|cobran[cç]a/i;
    for (const profile of Object.values(DEFAULT_PROFILES_12)) {
      const texts = `${profile.opening_message}\n${profile.system_script}`;
      assert.doesNotMatch(texts, banned, `${profile.profile_key} tem expressão proibida`);
      assert.match(profile.opening_message, /do eLiving/);
      assert.match(profile.system_script, /do time eLiving, numa ligação de voz\./);
      assert.match(profile.system_script, /mentor[a]? de /);
      assert.match(profile.system_script, new RegExp(`MODO ATIVO: ${profile.character_id.toUpperCase()} / ${profile.mode_name.toUpperCase()}`));
      // Tags da abertura: só do dono, permitidas com o aluno, de 1 a 3
      const tags = [...profile.opening_message.matchAll(/\[([^\]]+)\]/g)].map(m => m[1]);
      assert.ok(tags.length >= 1 && tags.length <= 3, `${profile.profile_key}: 1 a 3 tags`);
      for (const tag of tags) assert.ok(isAudioTagAllowed(tag, tags), `${profile.profile_key}: [${tag}] fora da regra`);
    }
    const pillars = { rafael: /Hábitos, constância/, sirlene: /Alimentação, refeições/, vital: /Prevenção, exames de rotina/, alex: /Treino, caminhada/ };
    for (const profile of Object.values(DEFAULT_PROFILES_12)) assert.match(profile.system_script, pillars[profile.character_id]);
    for (const p of Object.values(DEFAULT_PROFILES_12).filter(p => p.character_id === 'vital')) {
      assert.match(p.system_script, /não prescreve/);
    }
    for (const character of Object.values(CHARACTERS_MAP)) assert.doesNotMatch(character.role, banned);
    for (const mode of Object.values(MODES_MAP)) assert.doesNotMatch(mode.intensity, banned);
    for (const personality of Object.values(DEFAULT_PERSONALITIES)) assert.doesNotMatch(personality.description, banned);
  });
});

// ----------------------------------------------------------------------------------------------
// Caminhos SEM streaming (abertura de toda ligação e turnos em lote): as [tags] geradas pela IA
// chegam à ElevenLabs; o Google (reserva), a tela, o histórico e o banco recebem o texto sem tags.
// GPT, ElevenLabs, Google, Meowcaller e o contexto do app são simulados; nenhuma rede real.
// ----------------------------------------------------------------------------------------------
const OPENING = '[curious] Oi, aqui é o Rafael, do eLiving. [pause] Como está o seu dia hoje?';
const OPENING_TELA = 'Oi, aqui é o Rafael, do eLiving. Como está o seu dia hoje?';
const REPLY = '[thoughtful] Entendi. [short pause] Qual passo pequeno cabe no seu dia?';
const REPLY_TELA = 'Entendi. Qual passo pequeno cabe no seu dia?';
const CONTEXT_URL = 'https://contexto.simulado.test/voz';

function simulateLiveCallNetwork({ elevenStatus = 200 } = {}) {
  const originalFetch = globalThis.fetch;
  const seen = { eleven: [], google: [], persisted: [], played: 0 };
  // Libera o GPT (simulado) no voice-agent, que fica desligado sob o executor de testes.
  delete process.env.NODE_ENV;
  delete process.env.NODE_TEST_CONTEXT;
  process.env.OPENAI_API_KEY = 'chave-openai-simulada';
  process.env.ELEVENLABS_API_KEY = 'chave-de-teste-simulada';
  delete process.env.ELEVENLABS_CALL_ENABLED;
  process.env.MAX_VOICE_CONTEXT_URL = CONTEXT_URL;
  process.env.MAX_VOICE_CONTEXT_TOKEN = 'token-contexto-simulado';
  process.env.GOOGLE_CALL_TTS_TIMEOUT_MS = '1000';
  setGoogleTTSClientForTesting({
    synthesizeSpeech: async request => { seen.google.push(request); return [{ audioContent: Buffer.alloc(64, 1) }]; }
  });
  const json = data => ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) });
  globalThis.fetch = async (url, opts = {}) => {
    const target = String(url);
    if (target.startsWith('http://127.0.0.1:')) return originalFetch(url, opts);
    if (target === 'https://api.openai.com/v1/chat/completions') {
      const body = JSON.parse(opts.body);
      if (body.response_format) return json({ choices: [{ message: { content: '{"categories":[]}' }, finish_reason: 'stop' }] });
      const content = body.messages.at(-1)?.content === NATURAL_OPENING_PROMPT ? OPENING : REPLY;
      return json({ choices: [{ message: { content }, finish_reason: 'stop' }] });
    }
    if (target.startsWith('https://api.elevenlabs.io/')) {
      seen.eleven.push({ url: target, body: JSON.parse(opts.body) });
      if (elevenStatus === 429) return { ok: false, status: 429, text: async () => '{"detail":{"status":"quota_exceeded"}}' };
      return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array(64).buffer };
    }
    if (target === CONTEXT_URL) {
      const body = JSON.parse(opts.body);
      if (body.action === 'append_turn' && body.assistant_text) seen.persisted.push(body.assistant_text);
      if (body.action) return json({ ok: true });
      return json({ status: 'matched', context: {}, fetched_at: '2026-10-06T12:00:00.000Z' });
    }
    if (/\/v1\/calls\/[^/]+\/play$/.test(target)) { seen.played += 1; return json({ ok: true }); }
    throw new Error(`rede real bloqueada no teste: ${target}`);
  };
  return { seen, restore: () => { globalThis.fetch = originalFetch; } };
}

async function waitFor(check) {
  for (let i = 0; i < 100 && !check(); i++) await delay(10);
  assert.ok(check(), 'tempo esgotado esperando a gravação simulada');
}

describe('Tags de áudio nos caminhos sem streaming (abertura e turnos em lote)', () => {
  it('o texto de tela é a fala sem as tags', () => {
    assert.equal(stripAudioTags(OPENING), OPENING_TELA);
    assert.equal(stripAudioTags(REPLY), REPLY_TELA);
  });

  it('Meowcaller: abertura gerada com [curious] e turno em lote chegam à ElevenLabs com as tags; histórico, banco e resposta sem tags', async () => {
    const net = simulateLiveCallNetwork({ elevenStatus: 200 });
    const { handleCallConnectedWebhook, processUserSpeech, getCallHistory } = await import('../src/integrations/voice-agent.mjs');
    const callId = `guardiao-tags-meow-${Date.now()}`;
    try {
      registerCallSession({ callId, remoteNumber: '5511988887777', direction: 'OUTBOUND', profileKey: 'rafael_normal' });
      const opening = await handleCallConnectedWebhook({ call_id: callId, direction: 'OUTBOUND' });
      assert.equal(opening.ok, true);
      assert.equal(opening.provider, 'ELEVENLABS');
      assert.equal(net.seen.eleven.length, 1);
      assert.ok(net.seen.eleven[0].url.includes(`/text-to-speech/${VOICES.rafael.voiceId}`), 'voz do Rafael');
      assert.equal(net.seen.eleven[0].body.model_id, 'eleven_v4_turbo');
      assert.equal(net.seen.eleven[0].body.text, OPENING, 'a abertura chega à ElevenLabs com as tags');
      assert.equal(opening.greeting, OPENING_TELA);
      assert.equal(opening.text, OPENING_TELA);

      const turn = await processUserSpeech({ callId, userText: 'Estou bem, obrigado.' });
      assert.equal(turn.ok, true);
      assert.equal(turn.streaming, undefined, 'turno em lote, sem streaming');
      assert.equal(net.seen.eleven.length, 2);
      assert.equal(net.seen.eleven[1].body.text, REPLY, 'o turno em lote chega à ElevenLabs com as tags');
      assert.equal(turn.reply_text, REPLY_TELA);
      assert.equal(turn.play_result.text, REPLY_TELA);
      assert.equal(net.seen.played, 2);

      const history = getCallHistory(callId).filter(item => item.role === 'assistant').map(item => item.text);
      assert.deepEqual(history, [OPENING_TELA, REPLY_TELA]);
      await waitFor(() => net.seen.persisted.length >= 2);
      assert.deepEqual(net.seen.persisted, [OPENING_TELA, REPLY_TELA]);
      assert.equal(net.seen.google.length, 0, 'com cota, o Google não entra');
    } finally {
      net.restore();
      endCallSession({ callId, reason: 'TEST_CLEANUP' });
    }
  });

  it('Meowcaller: ElevenLabs sem cota (429) na abertura → Chirp com a voz do personagem e o texto sem tags', async () => {
    const net = simulateLiveCallNetwork({ elevenStatus: 429 });
    const { handleCallConnectedWebhook, getCallHistory } = await import('../src/integrations/voice-agent.mjs');
    const callId = `guardiao-tags-meow429-${Date.now()}`;
    try {
      registerCallSession({ callId, remoteNumber: '5511977776666', direction: 'OUTBOUND', profileKey: 'rafael_normal' });
      const opening = await handleCallConnectedWebhook({ call_id: callId, direction: 'OUTBOUND' });
      assert.equal(opening.ok, true);
      assert.equal(net.seen.eleven.length, 1);
      assert.equal(net.seen.eleven[0].body.text, OPENING, 'tentou primeiro a ElevenLabs, com as tags');
      assert.equal(net.seen.google.length, 1);
      assert.equal(net.seen.google[0].voice.name, VOICES.rafael.googleFallbackVoice);
      assert.equal(net.seen.google[0].input.text, OPENING_TELA, 'o Google recebe o texto sem tags');
      assert.notEqual(opening.provider, 'ELEVENLABS');
      assert.equal(opening.greeting, OPENING_TELA);
      assert.equal(opening.text, OPENING_TELA);
      assert.deepEqual(getCallHistory(callId).map(item => item.text), [OPENING_TELA]);
      assert.deepEqual(net.seen.persisted, [OPENING_TELA]);
    } finally {
      net.restore();
      endCallSession({ callId, reason: 'TEST_CLEANUP' });
    }
  });

  for (const elevenStatus of [200, 429]) {
    it(`app (/call-engine/turn), ElevenLabs ${elevenStatus}: abertura e turno em lote com tags na ElevenLabs; Google, banco e resposta sem tags`, async () => {
      const net = simulateLiveCallNetwork({ elevenStatus });
      const { createIntegrationsRouter } = await import('../src/routes/integrations.mjs');
      const app = express();
      app.use(express.json());
      app.use(createIntegrationsRouter({ supabaseFetch: async () => [], authenticateUser: (_req, _res, next) => next() }));
      const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
      try {
        const route = `http://127.0.0.1:${server.address().port}/api/integrations/call-engine/turn`;
        const headers = { Authorization: 'Bearer token-app-simulado', 'Content-Type': 'application/json' };
        const callId = `WEB-guardiao-tags-${elevenStatus}-${Date.now()}`;
        const post = async body => {
          const res = await fetch(route, { method: 'POST', headers, body: JSON.stringify({ character_id: 'rafael', call_id: callId, ...body }) });
          assert.equal(res.status, 200);
          return res.json();
        };

        const start = await post({ is_start: true });
        assert.equal(start.text, OPENING_TELA);
        assert.equal(start.reply_text, OPENING_TELA);
        assert.ok(start.audio_base64.length > 0);
        assert.equal(net.seen.eleven.length, 1);
        assert.ok(net.seen.eleven[0].url.includes(`/text-to-speech/${VOICES.rafael.voiceId}`), 'voz do Rafael');
        assert.equal(net.seen.eleven[0].body.model_id, 'eleven_v4_turbo');
        assert.equal(net.seen.eleven[0].body.text, OPENING, 'a abertura do app chega à ElevenLabs com as tags');

        const turn = await post({ mode: 'normal', user_text: 'Estou bem, obrigado.', history: [] });
        assert.equal(turn.text, REPLY_TELA);
        assert.equal(turn.reply_text, REPLY_TELA);
        assert.deepEqual(net.seen.persisted, [OPENING_TELA, REPLY_TELA]);

        if (elevenStatus === 200) {
          assert.equal(net.seen.eleven.length, 2);
          assert.equal(net.seen.eleven[1].body.text, REPLY, 'o turno em lote do app chega à ElevenLabs com as tags');
          assert.equal(net.seen.google.length, 0, 'com cota, o Google não entra');
        } else {
          // Depois do 429 a ElevenLabs fica em pausa (cota) e o turno seguinte já sai pelo Google.
          assert.equal(net.seen.eleven.length, 1);
          assert.equal(net.seen.google.length, 2);
          assert.deepEqual(net.seen.google.map(request => request.input.text), [OPENING_TELA, REPLY_TELA]);
          for (const request of net.seen.google) assert.equal(request.voice.name, VOICES.rafael.googleFallbackVoice);
        }
      } finally {
        net.restore();
        await new Promise(resolve => server.close(resolve));
      }
    });
  }
});
