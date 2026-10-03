import { once } from 'node:events';
import { streamReplyToCall } from './call-streaming.mjs';

/** Auth and caller persistence are performed by the existing turn route first. */
export async function streamBrowserTurn(res, options, saveReply, generate = streamReplyToCall, timeoutMs = 40000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Browser turn timed out')), timeoutMs);
  const disconnect = () => controller.abort(new Error('Browser disconnected'));
  res.once('close', disconnect);
  res.once('error', disconnect);
  const write = async (event, signal = controller.signal) => {
    signal.throwIfAborted();
    if (!res.write(JSON.stringify(event) + '\n')) {
      await once(res, 'drain', { signal });
    }
  };
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-store, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  try {
    const result = await generate({
      ...options, signal: controller.signal,
      consumeAudio: async (audio, signal) => {
        for await (const bytes of audio) {
          signal.throwIfAborted();
          // Bounded records make mobile parsing and cancellation predictable.
          for (let offset = 0; offset < bytes.length; offset += 8192) {
            await write({ type: 'audio', pcm: bytes.subarray(offset, offset + 8192).toString('base64'), sampleRate: 16000 }, signal);
          }
        }
        return { ok: true };
      },
    });
    controller.signal.throwIfAborted();
    let abortSave;
    const saveCancelled = new Promise((_, reject) => {
      abortSave = () => reject(controller.signal.reason);
      controller.signal.addEventListener('abort', abortSave, { once: true });
    });
    try {
      if (!await Promise.race([saveReply(result.text), saveCancelled])) throw new Error('Reply persistence failed');
    } finally {
      controller.signal.removeEventListener('abort', abortSave);
    }
    // Text is conversation history, not a request to display captions.
    await write({ type: 'done', text: result.text, metrics: result.metrics });
  } catch {
    if (!controller.signal.aborted && !res.destroyed) {
      await write({ type: 'error', error: 'A resposta foi interrompida. Tente falar novamente.' }).catch(() => {});
    }
  } finally {
    clearTimeout(timeout);
    res.removeListener('close', disconnect);
    res.removeListener('error', disconnect);
    if (!res.destroyed) res.end();
  }
}
