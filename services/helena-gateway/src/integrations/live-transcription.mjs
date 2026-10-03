import WebSocket from 'ws';

/** Transcrição incremental de PCM16 16 kHz recebido do Meowcaller. */
export function pcm16To24k(bytes) {
  if (bytes.length % 2) throw new Error('PCM16 incompleto');
  const samples = bytes.length / 2;
  if (samples % 2) throw new Error('Bloco PCM16 deve conter número par de amostras');
  const output = Buffer.alloc(samples * 3);
  for (let j = 0; j < samples * 3 / 2; j++) {
    const position = j * 2 / 3;
    const index = Math.floor(position);
    const fraction = position - index;
    const a = bytes.readInt16LE(index * 2);
    const b = bytes.readInt16LE(Math.min(index + 1, samples - 1) * 2);
    output.writeInt16LE(Math.round(a + (b - a) * fraction), j * 2);
  }
  return output;
}

export async function transcribeLivePCM(chunks, { apiKey, WebSocketImpl = WebSocket, timeoutMs = 40000,
  readyTimeoutMs = 5000, finalTimeoutMs = 8000, signal, onInputEnd = () => {}, onTranscript = () => {} } = {}) {
  if (!apiKey) throw new Error('OPENAI_API_KEY ausente');
  signal?.throwIfAborted();
  const started = Date.now();
  const metrics = { stt_session_ready_ms: null, stt_input_stream_ms: null,
    stt_first_delta_ms: null, stt_final_ms: null, audio_bytes: 0 };
  const ws = new WebSocketImpl('wss://api.openai.com/v1/realtime?intent=transcription', {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  let committedAt = null;
  let readyResolve, readyReject, finalResolve, finalReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const final = new Promise((resolve, reject) => { finalResolve = resolve; finalReject = reject; });
  // Both promises may reject before their respective await points.
  ready.catch(() => {});
  final.catch(() => {});
  let failureReject;
  const failure = new Promise((_, reject) => { failureReject = reject; });
  failure.catch(() => {});
  let stopped = false;
  const fail = error => {
    if (stopped) return;
    stopped = true;
    error.transcriptionMetrics = { ...metrics, stt_failure_after_ms: Date.now() - started };
    readyReject(error); finalReject(error); failureReject(error);
  };
  const abort = () => fail(signal.reason || new Error('Transcrição cancelada'));
  signal?.addEventListener('abort', abort, { once: true });
  const deadlineError = (code, message) => Object.assign(new Error(message), { code });
  const timeout = setTimeout(() => fail(deadlineError('stt_total_timeout', 'Timeout de transcrição em tempo real')), timeoutMs);
  const readyTimeout = setTimeout(() => fail(deadlineError('stt_connect_timeout', 'Timeout ao abrir a transcrição')), readyTimeoutMs);
  let finalTimeout;
  let readyAt;
  ws.addEventListener('open', () => { if (stopped) return; ws.send(JSON.stringify({
    type: 'session.update',
    session: { type: 'transcription', audio: { input: {
      format: { type: 'audio/pcm', rate: 24000 },
      transcription: { model: 'gpt-live-transcribe', languages: ['pt'], delay: 'low' },
      turn_detection: null
    } } }
  })); });
  ws.addEventListener('message', event => {
    if (stopped) return;
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    if (data.type === 'session.updated' && readyAt === undefined) {
      clearTimeout(readyTimeout);
      readyAt = Date.now();
      metrics.stt_session_ready_ms = readyAt - started;
      readyResolve();
    }
    if (data.type === 'conversation.item.input_audio_transcription.delta') {
      if (metrics.stt_first_delta_ms === null) metrics.stt_first_delta_ms = Date.now() - started;
      onTranscript(data.delta);
    }
    if (data.type === 'conversation.item.input_audio_transcription.completed' && committedAt !== null) {
      metrics.stt_final_ms = Date.now() - started;
      metrics.stt_after_commit_ms = committedAt === null ? null : Date.now() - committedAt;
      finalResolve({ text: typeof data.transcript === 'string' ? data.transcript.trim() : '', metrics });
    }
    if (data.type === 'conversation.item.input_audio_transcription.failed') fail(new Error('Falha na transcrição do turno'));
    if (data.type === 'error') fail(new Error(`OpenAI realtime STT: ${data.error?.code || data.error?.type || 'erro'}`));
  });
  ws.addEventListener('error', () => fail(new Error('Falha no WebSocket de transcrição')));
  ws.addEventListener('close', () => fail(new Error('WebSocket de transcrição encerrado antes do resultado')));
  const iterator = chunks[Symbol.asyncIterator]();
  try {
    await ready;
    let pending = Buffer.alloc(0);
    while (true) {
      // A disconnected or stalled microphone must not defeat the deadline.
      const next = await Promise.race([iterator.next(), failure]);
      if (next.done) break;
      const chunk = next.value;
      metrics.audio_bytes += chunk.length;
      if (metrics.audio_bytes > 16000 * 2 * 15) throw new Error('Turno de áudio excedeu 15 segundos');
      const joined = pending.length ? Buffer.concat([pending, chunk]) : chunk;
      const aligned = Math.floor(joined.length / 4) * 4;
      pending = joined.subarray(aligned);
      const pcm24 = pcm16To24k(joined.subarray(0, aligned));
      if (pcm24.length) ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: pcm24.toString('base64') }));
    }
    if (pending.length) throw new Error('PCM16 final incompleto');
    if (metrics.audio_bytes < 3200) throw new Error('Áudio insuficiente para transcrição');
    committedAt = Date.now();
    metrics.input_ended_at = committedAt;
    metrics.stt_input_stream_ms = committedAt - readyAt;
    onInputEnd();
    // This budget starts only after speech ends; it must not cut a normal utterance.
    finalTimeout = setTimeout(() => fail(deadlineError('stt_final_timeout', 'Timeout aguardando a transcrição final')), finalTimeoutMs);
    ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    return await final;
  } finally {
    stopped = true;
    clearTimeout(timeout);
    clearTimeout(readyTimeout);
    clearTimeout(finalTimeout);
    signal?.removeEventListener('abort', abort);
    // A stalled generator may never settle return(); do not block cleanup on it.
    void Promise.resolve(iterator.return?.()).catch(() => {});
    if (typeof ws.terminate === 'function') ws.terminate();
    else ws.close();
  }
}
