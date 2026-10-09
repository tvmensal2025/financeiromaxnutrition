import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import WebSocket, { WebSocketServer } from 'ws';
import { ElevenLabsDialogueSession } from '../src/integrations/elevenlabs-dialogue.mjs';
import { elevenLabsSpecForCharacter } from '../src/integrations/elevenlabs.mjs';

const spec = elevenLabsSpecForCharacter('rafael', 'tempoReal');
function socketFixture(onFrame = () => {}) {
  let socket;
  class Socket extends EventEmitter {
    constructor(url, options) {
      super(); socket = this; this.url = new URL(url); this.options = options; this.frames = [];
      queueMicrotask(() => this.emit('open'));
    }
    send(raw, callback) { const frame = JSON.parse(raw); this.frames.push(frame); onFrame(this, frame); callback?.(); }
    terminate() { this.terminated = true; this.emit('close'); }
    reply(frame) { this.emit('message', Buffer.from(JSON.stringify(frame))); }
  }
  return { Socket, get socket() { return socket; } };
}

test('protocolo real ws: autentica no servidor, registra uma voz e reutiliza conexão em duas falas', async () => {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await once(server, 'listening');
  const frames = [];
  let connections = 0;
  server.on('connection', (socket, req) => {
    connections++;
    assert.equal(req.headers['xi-api-key'], 'fake-key');
    socket.on('message', raw => {
      const frame = JSON.parse(raw.toString()); frames.push(frame);
      if (frame.inputs) {
        socket.send(JSON.stringify({ audio: Buffer.from([0, 1, 2, 3]).toString('base64') }));
        socket.send('{"is_final_audio_for_turn":true}');
      }
    });
  });
  let requested;
  class LocalSocket extends WebSocket {
    constructor(url, options) { requested = new URL(url); super(`ws://127.0.0.1:${server.address().port}`, options); }
  }
  const session = new ElevenLabsDialogueSession({ spec, apiKey: 'fake-key', WebSocketImpl: LocalSocket });
  try {
    const audio = [];
    await session.synthesize('Primeira fala.', bytes => audio.push(bytes));
    await session.synthesize('Segunda fala.', bytes => audio.push(bytes));
    assert.equal(requested.pathname, '/v1/text-to-dialogue/stream-input');
    assert.equal(requested.searchParams.get('model_id'), spec.modelId);
    assert.equal(requested.searchParams.get('output_format'), 'pcm_16000');
    assert.equal(requested.searchParams.get('language_code'), 'pt');
    assert.equal(connections, 1);
    assert.deepEqual(frames[0], { voices: [spec.voiceId], voice_settings: spec.voiceSettings });
    assert.deepEqual(frames.slice(1).map(frame => frame.inputs[0].voice_id), [spec.voiceId, spec.voiceId]);
    assert.ok(frames.slice(1).every(frame => frame.flush && frame.inputs[0].new_turn));
    assert.equal(Buffer.concat(audio).length, 8);
  } finally { session.close(); await new Promise(resolve => server.close(resolve)); }
});

test('entrega primeiro chunk antes de receber o final da fala', async () => {
  const fake = socketFixture();
  const session = new ElevenLabsDialogueSession({ spec, apiKey: 'fake', WebSocketImpl: fake.Socket });
  const chunks = [];
  let finished = false;
  const pending = session.synthesize('Olá.', bytes => chunks.push(bytes)).then(() => { finished = true; });
  await session.ready;
  fake.socket.reply({ audio: Buffer.from([1, 0]).toString('base64') });
  assert.equal(chunks.length, 1);
  assert.equal(finished, false);
  fake.socket.reply({ is_final_audio_for_turn: true });
  await pending; session.close();
});

test('cota via frame mantém código do provedor para reserva', async () => {
  const fake = socketFixture((socket, frame) => { if (frame.inputs) queueMicrotask(() => socket.reply({ error: 'insufficient_credits', code: 401 })); });
  const session = new ElevenLabsDialogueSession({ spec, apiKey: 'fake', WebSocketImpl: fake.Socket });
  await assert.rejects(session.synthesize('Olá.', () => {}), error => error.status === 401 && error.providerError.error === 'insufficient_credits');
  assert.equal(fake.socket.terminated, true);
});

test('tempo esgotado encerra síntese pendente e socket', async () => {
  const fake = socketFixture();
  const session = new ElevenLabsDialogueSession({ spec, apiKey: 'fake', WebSocketImpl: fake.Socket, timeoutMs: 15 });
  await assert.rejects(session.synthesize('Olá.', () => {}), /parou de enviar/);
  assert.equal(fake.socket.terminated, true);
});

test('desligar cancela socket e fala pendente', async () => {
  const fake = socketFixture(); const controller = new AbortController();
  const session = new ElevenLabsDialogueSession({ spec, apiKey: 'fake', WebSocketImpl: fake.Socket, signal: controller.signal });
  const pending = session.synthesize('Olá.', () => {});
  await session.ready; controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(fake.socket.terminated, true);
});

test('fim sem áudio é falha e não conta como fala concluída', async () => {
  const fake = socketFixture((socket, frame) => { if (frame.inputs) queueMicrotask(() => socket.reply({ is_final_audio_for_turn: true })); });
  const session = new ElevenLabsDialogueSession({ spec, apiKey: 'fake', WebSocketImpl: fake.Socket });
  await assert.rejects(session.synthesize('Olá.', () => {}), /sem áudio/);
});

test('MP3 aguarda encoder terminar para não cortar os últimos bytes', async () => {
  const fake = socketFixture();
  const session = new ElevenLabsDialogueSession({ spec, apiKey: 'fake', WebSocketImpl: fake.Socket, outputFormat: 'mp3_44100_128' });
  let finished = false; const chunks = [];
  const pending = session.synthesize('Olá.', bytes => chunks.push(bytes)).then(() => { finished = true; });
  await session.ready;
  fake.socket.reply({ audio: Buffer.from('início').toString('base64') });
  fake.socket.reply({ is_final_audio_for_turn: true });
  await Promise.resolve();
  assert.equal(finished, false);
  assert.deepEqual(fake.socket.frames.at(-1), { close_socket: true });
  fake.socket.reply({ audio: Buffer.from('final').toString('base64') });
  fake.socket.reply({ is_final: true });
  await pending;
  assert.equal(Buffer.concat(chunks).toString(), 'iníciofinal');
  session.close();
});

test('recusa no handshake preserva cota HTTP para o roteador de reserva', async () => {
  const { Readable } = await import('node:stream');
  class RejectedSocket extends EventEmitter {
    constructor() {
      super(); queueMicrotask(() => {
        const response = Readable.from(['{"detail":{"status":"insufficient_credits"}}']);
        response.statusCode = 401;
        this.emit('unexpected-response', {}, response);
      });
    }
    terminate() { this.emit('close'); }
  }
  const session = new ElevenLabsDialogueSession({ spec, apiKey: 'fake', WebSocketImpl: RejectedSocket });
  await assert.rejects(session.synthesize('Olá.', () => {}), error => error.status === 401 && /insufficient_credits/.test(error.providerError));
});
