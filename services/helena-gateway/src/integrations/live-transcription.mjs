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

export async function transcribeLivePCM(chunks, { apiKey, WebSocketImpl = WebSocket, timeoutMs = 40000 } = {}) {
  if (!apiKey) throw new Error('OPENAI_API_KEY ausente');
  const started = Date.now();
  const metrics = { stt_first_delta_ms: null, stt_final_ms: null, audio_bytes: 0 };
  const ws = new WebSocketImpl('wss://api.openai.com/v1/realtime?intent=transcription', {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  let readyResolve, readyReject, finalResolve, finalReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const final = new Promise((resolve, reject) => { finalResolve = resolve; finalReject = reject; });
  // Both promises may reject before their respective await points.
  ready.catch(() => {});
  final.catch(() => {});
  const fail = error => { readyReject(error); finalReject(error); };
  const timeout = setTimeout(() => fail(new Error('Timeout de transcrição em tempo real')), timeoutMs);
  ws.addEventListener('open', () => ws.send(JSON.stringify({
    type: 'session.update',
    session: { type: 'transcription', audio: { input: {
      format: { type: 'audio/pcm', rate: 24000 },
      transcription: { model: 'gpt-live-transcribe', languages: ['pt'], delay: 'low' },
      turn_detection: null
    } } }
  })));
  ws.addEventListener('message', event => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    if (data.type === 'session.updated') readyResolve();
    if (data.type === 'conversation.item.input_audio_transcription.delta' && metrics.stt_first_delta_ms === null)
      metrics.stt_first_delta_ms = Date.now() - started;
    if (data.type === 'conversation.item.input_audio_transcription.completed') {
      metrics.stt_final_ms = Date.now() - started;
      finalResolve({ text: data.transcript?.trim() || '', metrics });
    }
    if (data.type === 'error') fail(new Error(`OpenAI realtime STT: ${data.error?.code || data.error?.type || 'erro'}`));
  });
  ws.addEventListener('error', () => fail(new Error('Falha no WebSocket de transcrição')));
  ws.addEventListener('close', () => fail(new Error('WebSocket de transcrição encerrado antes do resultado')));
  try {
    await ready;
    let pending = Buffer.alloc(0);
    for await (const chunk of chunks) {
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
    ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    return await final;
  } finally {
    clearTimeout(timeout);
    ws.close();
  }
}
