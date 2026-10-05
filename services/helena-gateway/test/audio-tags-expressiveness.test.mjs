/**
 * audio-tags-expressiveness.test.mjs
 * Testes Unitários de Modulação Vocal e Expressividade Humana com Audio Tags
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  RECOMMENDED_AUDIO_TAGS,
  AUDIO_TAGS_GUIDE,
  cleanVoiceText,
  stripAudioTags,
  formatSpeechForElevenLabs,
  buildNaturalnessInstruction
} from '../src/integrations/conversation-naturalness.mjs';

import { sanitizeCallText } from '../src/integrations/google-chirp3-hd.mjs';

describe('Guia de Modulação Vocal e Expressividade (Audio Tags)', () => {

  it('1. Catálogo oficial de Audio Tags recomendadas está completo', () => {
    const requiredTags = [
      'surprised', 'shocked', 'amazed', 'excited',
      'angry', 'annoyed', 'frustrated',
      'laughing', 'laughs', 'giggling', 'cheerfully',
      'sighs', 'sigh', 'clears throat', 'groaning',
      'whispers', 'whispering', 'shouts', 'quizzically', 'hesitant', 'indecisive', 'comforting', 'warmly'
    ];

    for (const tag of requiredTags) {
      assert.ok(
        RECOMMENDED_AUDIO_TAGS.includes(tag),
        `Tag obrigatória '${tag}' deve constar no catálogo RECOMMENDED_AUDIO_TAGS`
      );
    }
  });

  it('2. formatSpeechForElevenLabs preserva as audio tags oficiais do catálogo', () => {
    const input1 = '[surprised] Não acredito! Você conseguiu resolver isso tão rápido?';
    const output1 = formatSpeechForElevenLabs(input1);
    assert.equal(output1, '[surprised] Não acredito! Você conseguiu resolver isso tão rápido?');

    const input2 = '[sighs] Infelizmente esse problema ainda não foi resolvido. [warmly] Mas vou te ajudar agora mesmo.';
    const output2 = formatSpeechForElevenLabs(input2);
    assert.equal(output2, '[sighs] Infelizmente esse problema ainda não foi resolvido. [warmly] Mas vou te ajudar agora mesmo.');

    const input3 = '[annoyed] Isso realmente não deveria estar acontecendo.';
    const output3 = formatSpeechForElevenLabs(input3);
    assert.equal(output3, '[annoyed] Isso realmente não deveria estar acontecendo.');

    const input4 = '[laughs] Essa foi muito boa! [excited] Vamos comemorar essa meta batida!';
    const output4 = formatSpeechForElevenLabs(input4);
    assert.equal(output4, '[laughs] Essa foi muito boa! [excited] Vamos comemorar essa meta batida!');
  });

  it('3. formatSpeechForElevenLabs remove rubricas inválidas e emojis, mantendo tags válidas', () => {
    const input = '[pensando] [warmly] Olá! *respira fundo* [pause] Vamos analisar seu exame. 😊';
    const output = formatSpeechForElevenLabs(input);
    // [warmly] é válida; [pensando], [pause], *respira fundo* e emoji são removidos
    assert.equal(output, '[warmly] Olá! Vamos analisar seu exame.');
  });

  it('4. stripAudioTags remove todas as tags para o Google Cloud Chirp 3 HD não verbalizar em inglês', () => {
    const input = '[surprised] Não acredito! [sighs] Foi um dia puxado... [warmly] Mas vamos em frente.';
    const output = stripAudioTags(input);
    assert.equal(output, 'Não acredito! Foi um dia puxado... Mas vamos em frente.');
    assert.ok(!output.includes('['), 'Não deve conter colchetes abertos');
    assert.ok(!output.includes(']'), 'Não deve conter colchetes fechados');
    assert.ok(!output.includes('surprised'));
    assert.ok(!output.includes('warmly'));
  });

  it('5. sanitizeCallText do Google Chirp 3 HD remove audio tags em colchetes por segurança', () => {
    const input = '[laughs] Que notícia excelente! [clears throat] Vamos ao próximo passo.';
    const clean = sanitizeCallText(input);
    assert.equal(clean, 'Que notícia excelente! Vamos ao próximo passo.');
    assert.doesNotMatch(clean, /\[|\]/);
  });

  it('6. buildNaturalnessInstruction contém o Guia de Modulação Vocal e Audio Tags para a LLM GPT Luna', () => {
    const instruction = buildNaturalnessInstruction({ profile: { character_id: 'sirlene' } });
    assert.ok(instruction.includes('GUIA DE MODULAÇÃO VOCAL E EXPRESSIVIDADE (AUDIO TAGS)'));
    assert.ok(instruction.includes('[surprised]'));
    assert.ok(instruction.includes('[warmly]'));
    assert.ok(instruction.includes('[laughs]'));
    assert.ok(instruction.includes('[sighs]'));
    assert.ok(instruction.includes('Não verbalize a tag'));
    assert.ok(instruction.includes('reticências (...) para pausas reflexivas'));
  });

});
