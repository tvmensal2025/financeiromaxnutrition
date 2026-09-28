import { Readable } from 'node:stream';
import { once } from 'node:events';
import { openChirp3CallStream } from './google-chirp3-hd.mjs';
import { VOICE_DELIVERY_INSTRUCTION, prepareVoiceHistory } from './voice-delivery.mjs';

/** SSE framing is independent of TCP chunk boundaries, including split UTF-8. */
export async function* readSSE(body) {
  const decoder = new TextDecoder();
  let pending = '';
  for await (const bytes of body) {
    pending += decoder.decode(bytes, { stream: true });
    if (pending.length > 131072) throw new Error('Oversized SSE event');
    let boundary;
    while ((boundary = /\r?\n\r?\n/.exec(pending))) {
      const event = pending.slice(0, boundary.index);
      pending = pending.slice(boundary.index + boundary[0].length);
      const data = event.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
      if (data === '[DONE]') return;
      if (data) yield JSON.parse(data);
    }
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
    if (candidate) sentences.push(candidate);
    start = end;
  }
  let rest = text.slice(start);
  if (final && rest.trim()) { sentences.push(rest.trim()); rest = ''; }
  return { sentences, rest };
}

export async function streamReplyToCall({ callId, speechEpoch, apiKey, model, systemInstruction, userPrompt, history, voice,
  baseUrl, token, signal, fetchImpl = fetch, openTTS = openChirp3CallStream, backchannelDelayMs = 1100 }) {
  const controller = new AbortController();
  const combined = AbortSignal.any([controller.signal, AbortSignal.timeout(35000), ...(signal ? [signal] : [])]);
  combined.throwIfAborted();
  const started = performance.now();
  const metrics = { llm_first_token_ms: null, llm_total_ms: null, tts_first_audio_ms: null, first_audio_to_transport_ms: null,
    backchannel_ms: null };
  let usage = null;
  let spokenText = '';
  let firstTextAt = null;
  let audioBytes = 0;
  let backchannelTimer;
  const tts = openTTS({ voice, context: 'CALL', signal: combined });
  tts.on('error', () => {}); // Cancellation may arrive before the HTTP consumer attaches.
  const cancelTTS = () => tts.destroy(combined.reason);
  combined.addEventListener('abort', cancelTTS, { once: true });
  // The short acknowledgement enters the same Google TTS stream as the answer.
  // This keeps playback ordered and lets the existing speech epoch cancel both.
  if (process.env.CALL_BACKCHANNEL_ENABLED !== 'false') {
    backchannelTimer = setTimeout(() => {
      if (firstTextAt !== null || combined.aborted || tts.destroyed) return;
      try {
        metrics.backchannel_ms = Math.round(performance.now() - started);
        tts.write({ input: { text: 'Hum, só um instante. ' } });
      } catch (err) { controller.abort(err); }
    }, Math.max(0, backchannelDelayMs));
  }
  const writeSentence = async sentence => {
    combined.throwIfAborted();
    const clean = sentence.replace(/<[^>]*>|\[(?:happy|sad|laughs?|feliz|triste|rindo|sorrindo)\]/gi, '').replace(/[*#_~`]/g, '').trim();
    if (!clean) return;
    if (firstTextAt === null) {
      firstTextAt = performance.now();
      clearTimeout(backchannelTimer);
    }
    spokenText += `${spokenText ? ' ' : ''}${clean}`;
    if (!tts.write({ input: { text: `${clean} ` } })) await once(tts, 'drain', { signal: combined });
  };
  const llmTask = (async () => {
    const apiModel = model || 'gpt-6-luna';
    const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: AbortSignal.any([combined, AbortSignal.timeout(8000)]),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: apiModel, stream: true, stream_options: { include_usage: true }, reasoning_effort: 'none',
        max_completion_tokens: 200, temperature: 0.3,
        messages: [{ role: 'system', content: `${systemInstruction}\n\n${VOICE_DELIVERY_INSTRUCTION}` },
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
        if (metrics.llm_first_token_ms === null) metrics.llm_first_token_ms = Math.round(performance.now() - started);
        totalCharacters += delta.length;
        if (totalCharacters > 2400) throw new Error('Voice response exceeds conversational limit');
        pending += delta;
        const split = extractSentences(pending);
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
      yield bytes;
    }
    if (!audioBytes) throw new Error('Google returned no streaming audio');
  })(), { highWaterMark: 4096, objectMode: false });
  audio.on('error', () => {});
  const playbackTask = (async () => {
    const res = await fetchImpl(`${baseUrl}/v1/calls/${encodeURIComponent(callId)}/play/stream`, {
      method: 'POST', signal: combined, duplex: 'half', body: audio,
      headers: { 'Content-Type': 'audio/pcm', 'X-Audio-Sample-Rate': '16000', 'X-Speech-Epoch': String(speechEpoch), 'X-API-Key': token }
    });
    if (!res.ok) {
      const err = new Error(`Meowcaller streaming HTTP ${res.status}`);
      err.interrupted = res.status === 409 || res.status === 404;
      throw err;
    }
    return await res.json();
  })();
  try {
    const [, playback] = await Promise.all([llmTask, playbackTask]);
    return { text: spokenText, usage, metrics, playback, audioBytes };
  } catch (err) {
    controller.abort(err);
    audio.destroy();
    tts.destroy();
    await Promise.allSettled([llmTask, playbackTask]);
    err.interrupted = Boolean(err.interrupted || signal?.aborted);
    err.streamMetrics = metrics;
    err.partialText = spokenText;
    throw err;
  } finally {
    clearTimeout(backchannelTimer);
    combined.removeEventListener('abort', cancelTTS);
  }
}
