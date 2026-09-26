// scripts/test-live-speech-speed.mjs
const GATEWAY_URL = 'https://helena-automation-helena-gateway.d9v63q.easypanel.host';
const INTERNAL_KEY = 'helena_meow_sec_8a3c1f9d2e';

async function main() {
  console.log('=== TESTANDO VELOCIDADE E QUALIDADE DO ELEVENLABS SCRIBE + FLASH V2.5 ===');
  
  // Cria um buffer WAV sintético de 1.5s
  const sampleRate = 16000;
  const numSamples = sampleRate * 1.5;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + numSamples * 2, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(numSamples * 2, 40);
  const pcm = Buffer.alloc(numSamples * 2);
  const wavBuf = Buffer.concat([header, pcm]);

  const t0 = Date.now();
  const res = await fetch(`${GATEWAY_URL}/api/integrations/voice-agent/user-speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': INTERNAL_KEY
    },
    body: JSON.stringify({
      call_id: 'benchmark-call-humanized-001',
      audio_base64: wavBuf.toString('base64'),
      format: 'wav',
      sample_rate: 16000
    })
  });
  const totalMs = Date.now() - t0;
  const data = await res.json();
  
  console.log(`Tempo total de processamento de fala: ${totalMs} ms (${(totalMs/1000).toFixed(2)}s)`);
  console.log('Resposta completa:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
