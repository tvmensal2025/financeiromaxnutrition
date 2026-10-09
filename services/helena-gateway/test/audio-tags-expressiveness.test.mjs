/**
 * audio-tags-expressiveness.test.mjs
 * Tags de áudio do eLiving (regra do dono, eliving-voice-config.mjs): lista fechada de 27 tags,
 * proibidas com o aluno, [shouts]/[yelling] só comemorando, 1 a 3 por fala, colchetes e nunca chaves.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  RECOMMENDED_AUDIO_TAGS,
  AUDIO_TAGS_GUIDE,
  CHARACTER_STYLES,
  stripAudioTags,
  formatSpeechForElevenLabs,
  isAudioTagAllowed,
  MAX_AUDIO_TAGS_PER_FALA,
  buildNaturalnessInstruction
} from '../src/integrations/conversation-naturalness.mjs';
import ELIVING_VOICE_CONFIG from '../src/integrations/eliving-voice-config.mjs';

import { sanitizeCallText } from '../src/integrations/google-chirp3-hd.mjs';

const INVENTED_TAGS = ['warmly', 'cheerfully', 'amazed', 'surprised', 'groaning', 'hesitant', 'comforting', 'quizzically', 'sigh'];

describe('Guia de Modulação Vocal e Expressividade (Audio Tags) — regra do dono', () => {

  it('1. O catálogo é exatamente a lista do dono (27 tags), sem tags inventadas', () => {
    assert.equal(RECOMMENDED_AUDIO_TAGS.length, 27);
    assert.deepEqual([...RECOMMENDED_AUDIO_TAGS], [...ELIVING_VOICE_CONFIG.audioTagsDono]);
    for (const tag of INVENTED_TAGS) {
      assert.equal(RECOMMENDED_AUDIO_TAGS.includes(tag), false, `[${tag}] não é tag do dono`);
    }
  });

  it('2. formatSpeechForElevenLabs preserva as tags do dono permitidas com o aluno', () => {
    assert.equal(formatSpeechForElevenLabs('[curious] Me conta, como foi o seu dia?'), '[curious] Me conta, como foi o seu dia?');
    assert.equal(formatSpeechForElevenLabs('Entendi. [short pause] Vamos juntos.'), 'Entendi. [short pause] Vamos juntos.');
    assert.equal(
      formatSpeechForElevenLabs('[laughs] Essa foi muito boa! [excited] Vamos comemorar essa meta batida!'),
      '[laughs] Essa foi muito boa! [excited] Vamos comemorar essa meta batida!'
    );
    assert.equal(formatSpeechForElevenLabs('[Clears  Throat] Vamos ao exame.'), '[clears throat] Vamos ao exame.');
  });

  it('3. formatSpeechForElevenLabs remove tags inventadas, rubricas, emojis e chaves', () => {
    const input = '[pensando] [curious] Olá! *respira fundo* [warmly] Vamos analisar seu exame. 😊';
    assert.equal(formatSpeechForElevenLabs(input), '[curious] Olá! Vamos analisar seu exame.');
    for (const tag of INVENTED_TAGS) {
      assert.equal(formatSpeechForElevenLabs(`[${tag}] Bom dia.`), 'Bom dia.', `[${tag}] precisa sair`);
    }
    assert.equal(formatSpeechForElevenLabs('Oi {nome}, tudo bem?'), 'Oi, tudo bem?');
  });

  it('4. Decisão do dono (09/10/2026): bronca, deboche e as demais tags do dono chegam à voz; [shouts] vale sozinho', () => {
    for (const tag of ['angry', 'frustrated', 'sarcastic', 'deadpan', 'groans', 'snickers', 'stifling laughter', 'crying', 'tearfully']) {
      assert.equal(formatSpeechForElevenLabs(`[${tag}] Vamos lá.`), `[${tag}] Vamos lá.`, `[${tag}] está liberada`);
    }
    assert.equal(formatSpeechForElevenLabs('[shouts] Conseguimos!'), '[shouts] Conseguimos!');
    assert.equal(formatSpeechForElevenLabs('[yelling] Bateu a meta!'), '[yelling] Bateu a meta!');
    assert.equal(formatSpeechForElevenLabs('[tom animado] Oi.'), 'Oi.', 'tag fora da lista do dono continua saindo');
    assert.equal(isAudioTagAllowed('shouts', []), true);
    assert.equal(isAudioTagAllowed('angry', []), true);
  });

  it('5. No máximo o limite da configuração única (5) por fala', () => {
    assert.equal(MAX_AUDIO_TAGS_PER_FALA, 5);
    const out = formatSpeechForElevenLabs('[curious] 1. [pause] 2. [laughs] 3. [thoughtful] 4. [gasps] 5. [sighs] 6.');
    assert.equal(out, '[curious] 1. [pause] 2. [laughs] 3. [thoughtful] 4. [gasps] 5. 6.');
    assert.equal(formatSpeechForElevenLabs('[laughs] Já usei as tags.', { maxTags: 0 }), 'Já usei as tags.');
  });

  it('6. stripAudioTags remove QUALQUER [..] para o Google Chirp 3 HD não verbalizar', () => {
    const input = '[curious] Não acredito! [short pause] Foi um dia puxado... [tom animado] Mas vamos em frente.';
    const output = stripAudioTags(input);
    assert.equal(output, 'Não acredito! Foi um dia puxado... Mas vamos em frente.');
    assert.doesNotMatch(output, /\[|\]/);
    assert.equal(stripAudioTags('Olá [laughs]!'), 'Olá!');
  });

  it('7. sanitizeCallText do Google Chirp 3 HD remove qualquer [..], inclusive tags com acento ou número', () => {
    const input = '[laughs] Que notícia excelente! [clears throat] Vamos ao próximo passo. [pausa 2s] Certo?';
    const clean = sanitizeCallText(input);
    assert.equal(clean, 'Que notícia excelente! Vamos ao próximo passo. Certo?');
    assert.doesNotMatch(clean, /\[|\]/);
  });

  it('8. O guia entregue à LLM traz as regras do dono e nenhuma tag inventada', () => {
    const instruction = buildNaturalnessInstruction({ profile: { character_id: 'sirlene' } });
    assert.ok(instruction.includes('GUIA DE MODULAÇÃO VOCAL E EXPRESSIVIDADE (AUDIO TAGS)'));
    assert.ok(instruction.includes(AUDIO_TAGS_GUIDE));
    assert.match(AUDIO_TAGS_GUIDE, /de 1 a 5 tags de áudio por fala/);
    assert.match(AUDIO_TAGS_GUIDE, /SEJA VIVA/);
    assert.doesNotMatch(AUDIO_TAGS_GUIDE, /PROIBIDAS/);
    assert.match(AUDIO_TAGS_GUIDE, /\[angry\]/);
    assert.match(AUDIO_TAGS_GUIDE, /nunca use chaves/);
    assert.ok(instruction.includes('Não verbalize a tag'));
    assert.ok(instruction.includes('reticências (...) para pausas reflexivas'));
    for (const tag of INVENTED_TAGS) {
      assert.equal(instruction.includes(`[${tag}]`), false, `guia não pode sugerir [${tag}]`);
    }
    // Paleta preferida por personagem vem da configuração única
    for (const id of ['sirlene', 'alex', 'vital', 'rafael']) {
      for (const tag of ELIVING_VOICE_CONFIG.speakerTagPalette[id]) assert.ok(CHARACTER_STYLES[id].includes(`[${tag}]`));
    }
  });

});
