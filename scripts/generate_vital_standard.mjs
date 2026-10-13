import { requireEnv } from './require-env.mjs';
import fs from 'fs';
import path from 'path';

const API_KEY = requireEnv('KW_SECRET_API_KEY');
const API_URL = 'https://helena-automation-kokoro.d9v63q.easypanel.host/api/v1/audio/speech';

const newGenerations = [
  {
    id: 'alex_padrao_vital_santa',
    persona: 'Alex (Padrão Dr. Vital - Voz Santa)',
    voice: 'pm_santa',
    text: 'Olá a todos! Eu sou Alex. Passando para confirmar que a infraestrutura de comunicação e o nosso motor de inteligência artificial estão totalmente operacionais. Estamos monitorando cada integração em tempo real, com máxima estabilidade, segurança e agilidade para toda a nossa operação.'
  },
  {
    id: 'alex_padrao_vital_blend',
    persona: 'Alex (Padrão Dr. Vital - Blend Alex + Santa)',
    voice: 'pm_santa*0.7+pm_alex*0.3',
    text: 'Olá a todos! Eu sou Alex. Passando para confirmar que a infraestrutura de comunicação e o nosso motor de inteligência artificial estão totalmente operacionais. Estamos monitorando cada integração em tempo real, com máxima estabilidade, segurança e agilidade para toda a nossa operação.'
  },
  {
    id: 'sirlene_padrao_vital_blend_heart',
    persona: 'Sirlene (Padrão Dr. Vital - Blend Dora + Heart)',
    voice: 'pf_dora*0.7+af_heart*0.3',
    text: 'Olá a todos! Eu sou Sirlene. É um prazer falar com você através do nosso motor de inteligência artificial. Estamos prontos para oferecer um atendimento acolhedor, humanizado e extremamente eficiente, acompanhando cada cliente com toda a atenção que você merece.'
  },
  {
    id: 'sirlene_padrao_vital_blend_bella',
    persona: 'Sirlene (Padrão Dr. Vital - Blend Dora + Bella)',
    voice: 'pf_dora*0.7+af_bella*0.3',
    text: 'Olá a todos! Eu sou Sirlene. É um prazer falar com você através do nosso motor de inteligência artificial. Estamos prontos para oferecer um atendimento acolhedor, humanizado e extremamente eficiente, acompanhando cada cliente com toda a atenção que você merece.'
  }

];

async function generate(item) {
  const t0 = performance.now();
  console.log(`Gerando: ${item.persona} (Voz: ${item.voice})...`);

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + API_KEY
    },
    body: JSON.stringify({
      model: 'model',
      input: item.text,
      voice: item.voice
    })
  });

  const durationMs = Math.round(performance.now() - t0);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Falha ${res.status}: ${err}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  console.log(`OK: ${item.persona} em ${durationMs}ms (${buffer.length} bytes)`);

  return {
    ...item,
    durationMs,
    sizeBytes: buffer.length,
    buffer
  };
}

async function main() {
  const dirs = [
    'c:\\Users\\plata\\financeiromaxnutrition\\public\\audios',
    'c:\\Users\\plata\\financeiromaxnutrition\\audios',
    'C:\\Users\\plata\\.gemini\\antigravity-ide\\brain\\465f0faa-70a8-4e81-bcf6-8de0dfe5acc5'
  ];

  for (const d of dirs) {
    fs.mkdirSync(d, { recursive: true });
  }

  const results = [];
  for (const item of newGenerations) {
    const res = await generate(item);
    for (const d of dirs) {
      fs.writeFileSync(path.join(d, `${item.id}.mp3`), res.buffer);
    }
    results.push({
      persona: res.persona,
      voice: res.voice,
      durationMs: res.durationMs,
      sizeBytes: res.sizeBytes,
      text: res.text
    });
  }

  console.log('=== RESULTADO NOVO PADRÃO VITAL ===');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error('Erro na geração:', err);
  process.exit(1);
});
