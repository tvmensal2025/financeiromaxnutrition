import { buildNaturalnessInstruction, cleanVoiceText, isStandaloneMarker, RECOMMENDED_AUDIO_TAGS } from './conversation-naturalness.mjs';
import { Readable } from 'node:stream';
import { once } from 'node:events';
import { openChirp3CallStream } from './google-chirp3-hd.mjs';
import { openCallTTSStream } from './call-tts-stream.mjs';
import { VOICE_DELIVERY_INSTRUCTION, prepareVoiceHistory } from './voice-delivery.mjs';

/** SSE framing is independent of TCP chunk boundaries, including split UTF-8. */
export async function* readSSE(body) {
  const decoder = new TextDecoder();
  let pending = '';
  for await (const bytes of body) {
    pending += decoder.decode(bytes, { stream: true });
    let boundary;
    while ((boundary = /\r?\n\r?\n/.exec(pending))) {
      if (boundary.index > 131072) throw new Error('Oversized SSE event');
      const event = pending.slice(0, boundary.index);
      pending = pending.slice(boundary.index + boundary[0].length);
      const data = event.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
      if (data === '[DONE]') return;
      if (data) yield JSON.parse(data);
    }
    if (pending.length > 131072) throw new Error('Oversized SSE event');
  }
  if (pending.trim()) throw new Error('Incomplete SSE event');
}

/** Keep prosody context: emit complete sentences, never chunks of individual tokens. */
export function extractSentences(text, final = false) {
  const sentences = [];
  let start = 0;
  const boundaries = /[.!?]+["”']?(?=\s|$)/g;
  for (const match of text.matchAll(boundaries)) {
    const end = match.index + match[0].length;
    if (end === text.length && !final) continue;
    const candidate = text.slice(start, end).trim();
    if (/(?:\b(?:sr|sra|dr|dra|prof|av|etc)|\b[A-Z])\.$/iu.test(candidate)) continue;
    if (/\.{2,}$/.test(match[0]) || isStandaloneMarker(candidate)) continue;
    if (candidate) sentences.push(candidate);
    start = end;
  }
  let rest = text.slice(start);
  if (final && rest.trim()) { sentences.push(rest.trim()); rest = ''; }
  return { sentences, rest };
}

// Send a meaningful clause early, never split a decimal or an unfinished word.
export function extractSpeechChunks(text, final = false) {
  const full = extractSentences(text, final);
  const chunks = [];
  for (const sentence of full.sentences) chunks.push(sentence);
  let rest = full.rest;
  const boundary = /[,;:](?=\s)/g;
  for (const match of rest.matchAll(boundary)) {
    const clause = rest.slice(0, match.index + 1).trim();
    if (clause.length >= 24 && clause.split(/\s+/).length >= 4) {
      chunks.push(clause);
      rest = rest.slice(match.index + 1);
      break;
    }
  }
  return { sentences: chunks, rest };
}

export async function streamReplyToCall({ callId, speechEpoch, apiKey, model, systemInstruction, userPrompt, history, voice,
  baseUrl, token, signal, fetchImpl = fetch, openTTS = openCallTTSStream, profile = {}, consumeAudio }) {
  const controller = new AbortController();
  const combined = AbortSignal.any([controller.signal, AbortSignal.timeout(35000), ...(signal ? [signal] : [])]);
  combined.throwIfAborted();
  const started = performance.now();
  const metrics = { llm_first_token_ms: null, llm_total_ms: null, tts_first_audio_ms: null, first_audio_to_transport_ms: null,
    context_wait_ms: null, llm_provider_first_token_ms: null, text_chunk_wait_ms: null, backchannel_ms: null };
  let usage = null;
  let spokenText = '';
  let firstTextAt = null;
  let firstTokenAt = null;
  let audioBytes = 0;
  let writtenChars = 0; // caracteres mandados à voz (custo, quando o stream não mede por provedor)
  // A voz (ElevenLabs e reserva Google) vem do PERSONAGEM do perfil ativo da ligação.
  const tts = openTTS({ voice, characterId: profile?.character_id || null, context: 'CALL', signal: combined, fetchImpl });
  tts.on('error', () => {}); // Cancellation may arrive before the HTTP consumer attaches.
  const cancelTTS = () => tts.destroy(combined.reason);
  combined.addEventListener('abort', cancelTTS, { once: true });
  const writeSentence = async sentence => {
    combined.throwIfAborted();
    const preserveTags = Boolean(tts?.supportsAudioTags);
    const clean = cleanVoiceText(sentence, { preserveAudioTags: preserveTags });
    if (!clean || /^(?:hum+|hmm+|uhum)[.!?…\s]*$/iu.test(clean)) return;
    if (firstTextAt === null) {
      firstTextAt = performance.now();
      metrics.text_chunk_wait_ms = firstTokenAt === null ? null : Math.round(firstTextAt - firstTokenAt);
    }
    const cleanSpoken = cleanVoiceText(sentence, { preserveAudioTags: false });
    spokenText += `${spokenText ? ' ' : ''}${cleanSpoken}`;
    writtenChars += clean.length;
    if (!tts.write({ input: { text: `${clean} ` } })) await once(tts, 'drain', { signal: combined });
  };
  const llmTask = (async () => {
    const contextStarted = performance.now();
    const resolvedInstruction = await systemInstruction;
    metrics.context_wait_ms = Math.round(performance.now() - contextStarted);
    combined.throwIfAborted();
    const apiModel = model || 'gpt-6-luna';
    const llmRequestedAt = performance.now();
    const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: AbortSignal.any([combined, AbortSignal.timeout(8000)]),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: apiModel, stream: true, stream_options: { include_usage: true }, reasoning_effort: 'none',
        max_completion_tokens: 200, temperature: 0.3,
        messages: [{ role: 'system', content: `${resolvedInstruction}\n\n${VOICE_DELIVERY_INSTRUCTION}\n\n${buildNaturalnessInstruction({ profile, history })}` },
          ...prepareVoiceHistory(history, userPrompt), { role: 'user', content: userPrompt }] })
    });
    if (!res.ok || !res.body) throw new Error(`OpenAI streaming HTTP ${res.status}`);
    let pending = '';
    let finish = null;
    let totalCharacters = 0;
    for await (const event of readSSE(res.body)) {
      combined.throwIfAborted();
      if (event.error) throw new Error('OpenAI streaming provider error');
      if (event.usage) usage = event.usage;
      const choice = event.choices?.[0];
      const delta = choice?.delta?.content;
      if (delta) {
        if (firstTokenAt === null) {
          firstTokenAt = performance.now();
          metrics.llm_first_token_ms = Math.round(firstTokenAt - started);
          metrics.llm_provider_first_token_ms = Math.round(firstTokenAt - llmRequestedAt);
        }
        totalCharacters += delta.length;
        if (totalCharacters > 2400) throw new Error('Voice response exceeds conversational limit');
        pending += delta;
        if (pending.lastIndexOf('[') > pending.lastIndexOf(']') || pending.lastIndexOf('<') > pending.lastIndexOf('>')) continue;
        pending = pending.replace(/\[([^\]]*)\]/g, (match, tag) => {
          const norm = tag.toLowerCase().trim();
          return RECOMMENDED_AUDIO_TAGS.includes(norm) ? `[${norm}]` : ' ';
        }).replace(/<[^>]*>/g, '');
        const split = extractSpeechChunks(pending);
        pending = split.rest;
        for (const sentence of split.sentences) await writeSentence(sentence);
      }
      if (choice?.finish_reason) finish = choice.finish_reason;
    }
    if (finish !== 'stop') throw new Error(`Incomplete streamed response (${finish || 'connection closed'})`);
    for (const sentence of extractSentences(pending, true).sentences) await writeSentence(sentence);
    if (!spokenText) throw new Error('Empty streamed response');
    metrics.llm_total_ms = Math.round(performance.now() - started);
    tts.end();
  })();
  const audio = Readable.from((async function* () {
    for await (const response of tts) {
      combined.throwIfAborted();
      if (!response.audioContent?.length) continue;
      const bytes = typeof response.audioContent === 'string' ? Buffer.from(response.audioContent, 'base64') : Buffer.from(response.audioContent);
      if (metrics.first_audio_to_transport_ms === null) {
        metrics.first_audio_to_transport_ms = Math.round(performance.now() - started);
        metrics.tts_first_audio_ms = firstTextAt === null ? null : Math.round(performance.now() - firstTextAt);
      }
      audioBytes += bytes.length;
      if (metrics.first_audio_sent_at == null) metrics.first_audio_sent_at = Date.now();
      yield bytes;
    }
    if (!audioBytes) throw new Error('TTS returned no streaming audio');
  })(), { highWaterMark: 4096, objectMode: false });
  audio.on('error', () => {});
  const playbackTask = (async () => {
    if (consumeAudio) return await consumeAudio(audio, combined);
    const res = await fetchImpl(`${baseUrl}/v1/calls/${encodeURIComponent(callId)}/play/stream`, {
      method: 'POST', signal: combined, duplex: 'half', body: audio,
      headers: { 'Content-Type': 'audio/pcm', 'X-Audio-Sample-Rate': '16000', 'X-Speech-Epoch': String(speechEpoch), 'X-API-Key': token }
    });
    if (!res.ok) {
      const err = new Error(`Meowcaller streaming HTTP ${res.status}`);
      err.interrupted = res.status === 409 || res.status === 404;
      err.interruptionReason = res.status === 409 ? 'playback_superseded' :
        res.status === 404 ? 'playback_call_not_found' : 'playback_http_error';
      err.playbackHttpStatus = res.status;
      throw err;
    }
    return await res.json();
  })();
  // Telemetria: quem realmente falou o turno (ElevenLabs, reserva Google ou os dois).
  const spokenBy = () => tts?.ttsProvider ?? null;
  // Caracteres por provedor: o stream híbrido mede; o stream só do Google recebe tudo o que foi mandado falar.
  const charsBy = () => {
    if (tts?.ttsCharsByProvider) return { ...tts.ttsCharsByProvider };
    const provider = spokenBy();
    return provider && writtenChars ? { [provider]: writtenChars } : null;
  };
  try {
    const [, playback] = await Promise.all([llmTask, playbackTask]);
    metrics.tts_provider = spokenBy();
    metrics.tts_chars_by_provider = charsBy();
    return { text: spokenText, usage, metrics, playback, audioBytes, ttsProvider: metrics.tts_provider,
      ttsCharsByProvider: metrics.tts_chars_by_provider };
  } catch (err) {
    controller.abort(err);
    audio.destroy();
    tts.destroy();
    await Promise.allSettled([llmTask, playbackTask]);
    err.interrupted = Boolean(err.interrupted || signal?.aborted);
    err.interruptionReason ||= signal?.reason?.interruptionReason || null;
    err.streamMetrics = { ...metrics, tts_provider: spokenBy(), tts_chars_by_provider: charsBy(),
      interruption_reason: err.interrupted ? err.interruptionReason : null,
      failure_reason: err.interrupted ? null : err.name === 'TimeoutError' ? 'stream_timeout' : 'stream_error',
      playback_http_status: err.playbackHttpStatus ?? null };
    err.partialText = spokenText;
    throw err;
  } finally {
    combined.removeEventListener('abort', cancelTTS);
  }
}
