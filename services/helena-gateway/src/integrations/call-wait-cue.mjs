import { openChirp3CallStream, resolveChirp3Voice } from './google-chirp3-hd.mjs';

const clips = new Map();
const active = new Map();
const lastCueAt = new Map();

// Only Google CALL audio. Cache by resolved voice so a profile change never
// borrows another character's acknowledgement. A miss never delays the reply.
export function warmCallWaitClip(voice, { openTTS = openChirp3CallStream } = {}) {
  if (process.env.CALL_BACKCHANNEL_ENABLED === 'false') return Promise.resolve(null);
  const key = resolveChirp3Voice(voice);
  const cached = clips.get(key);
  if (cached && Date.now() - cached.at < 86400000) return cached.promise;
  const entry = { at: Date.now(), pcm: null };
  entry.promise = (async () => {
    try {
      const stream = openTTS({ voice: key, context: 'CALL', signal: AbortSignal.timeout(5000) });
      stream.end({ input: { text: 'Hum.' } });
      const chunks = [];
      let size = 0;
      for await (const item of stream) {
        const pcm = Buffer.from(item.audioContent || '', typeof item.audioContent === 'string' ? 'base64' : undefined);
        size += pcm.length;
        if (size > 48000) { stream.destroy(); return null; } // At most 1.5s; never truncate speech.
        chunks.push(pcm);
      }
      if (size) entry.pcm = Buffer.concat(chunks);
      return entry.pcm;
    } catch { return null; }
  })();
  clips.set(key, entry);
  if (clips.size > 64) clips.delete(clips.keys().next().value);
  return entry.promise;
}

export function cancelCallWaitCue(callId) {
  active.get(callId)?.cancel();
  active.delete(callId);
}

export function createCallWaitCue({ callId, speechEpoch, voice, baseUrl, token, isCurrent = () => true,
  fetchImpl = fetch, delayMs = 300, cooldownMs = 10000, getClip = () => clips.get(resolveChirp3Voice(voice))?.pcm }) {
  cancelCallWaitCue(callId);
  const controller = new AbortController();
  let timer, playback, endedAt, heardSpeech = false, closed = false;
  const metrics = { wait_cue_ms: null, wait_cue_played: false };
  const schedule = () => {
    if (!endedAt || !heardSpeech || timer || playback || closed || process.env.CALL_BACKCHANNEL_ENABLED === 'false') return;
    timer = setTimeout(() => {
      timer = null;
      if (closed || !isCurrent() || Date.now() - (lastCueAt.get(callId) || 0) < cooldownMs) return;
      const pcm = getClip();
      if (!pcm?.length) return;
      lastCueAt.set(callId, Date.now());
      if (lastCueAt.size > 1000) lastCueAt.delete(lastCueAt.keys().next().value);
      metrics.wait_cue_ms = Date.now() - endedAt;
      playback = (async () => {
        try {
          const response = await fetchImpl(`${baseUrl}/v1/calls/${encodeURIComponent(callId)}/play/stream`, {
            method: 'POST', body: pcm, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(3500)]),
            headers: { 'Content-Type': 'audio/pcm', 'X-Audio-Sample-Rate': '16000',
              'X-Speech-Epoch': String(speechEpoch), 'X-API-Key': token }
          });
          await response.arrayBuffer(); // Response arrives after playback ends; no competing streams.
          metrics.wait_cue_played = response.ok;
        } catch { /* A cue is optional; a transport failure must not suppress the answer. */ }
      })();
    }, Math.max(0, delayMs - (Date.now() - endedAt)));
  };
  const cue = {
    metrics,
    heard(text) { if (/[\p{L}\p{N}]/u.test(String(text || '').replace(/\[[^\]]*\]/g, ''))) heardSpeech = true; schedule(); },
    inputEnded() { endedAt ??= Date.now(); schedule(); },
    async beforeReply() { closed = true; clearTimeout(timer); await playback; },
    cancel() { closed = true; clearTimeout(timer); controller.abort(); },
    finish() { cue.cancel(); if (active.get(callId) === cue) active.delete(callId); }
  };
  active.set(callId, cue);
  return cue;
}
