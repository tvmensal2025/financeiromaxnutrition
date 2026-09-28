import fs from 'fs';
import path from 'path';

const API_KEY = 'qjuo4ld0exr5bkexo3cczbbcoanvrzu4';
const API_URL = 'https://helena-automation-kokoro.d9v63q.easypanel.host/api/v1/audio/speech';

const pedroVariants = [
  {
    id: 'pedro_jovem_alex_liam',
    persona: 'Pedro (Jovem - Blend Alex + Liam)',
    voice: 'pm_alex*0.7+am_liam*0.3',
    gender: 'Homem Jovem',
    text: 'Olá a todos! Eu sou o Pedro. Estou aqui para trazer uma comunicação muito mais ágil, dinâmica e conectada para o seu dia a dia. Este é o meu teste de voz no sistema Kokoro, mostrando que você pode contar comigo para tirar dúvidas, acompanhar novidades e ter um atendimento super rápido e direto ao ponto!'
  },
  {
    id: 'pedro_jovem_alex_adam',
    persona: 'Pedro (Jovem - Blend Alex + Adam)',
    voice: 'pm_alex*0.7+am_adam*0.3',
    gender: 'Homem Jovem',
    text: 'Olá a todos! Eu sou o Pedro. Estou aqui para trazer uma comunicação muito mais ágil, dinâmica e conectada para o seu dia a dia. Este é o meu teste de voz no sistema Kokoro, mostrando que você pode contar comigo para tirar dúvidas, acompanhar novidades e ter um atendimento super rápido e direto ao ponto!'
  },
  {
    id: 'pedro_jovem_alex_puro',
    persona: 'Pedro (Jovem - Alex Nativo PT)',
    voice: 'pm_alex',
    gender: 'Homem Jovem',
    text: 'Olá a todos! Eu sou o Pedro. Estou aqui para trazer uma comunicação muito mais ágil, dinâmica e conectada para o seu dia a dia. Este é o meu teste de voz no sistema Kokoro, mostrando que você pode contar comigo para tirar dúvidas, acompanhar novidades e ter um atendimento super rápido e direto ao ponto!'
  },
  {
    id: 'pedro_jovem_alex_santa_suave',
    persona: 'Pedro (Jovem - Blend 70% Alex + 30% Santa)',
    voice: 'pm_alex*0.7+pm_santa*0.3',
    gender: 'Homem Jovem',
    text: 'Olá a todos! Eu sou o Pedro. Estou aqui para trazer uma comunicação muito mais ágil, dinâmica e conectada para o seu dia a dia. Este é o meu teste de voz no sistema Kokoro, mostrando que você pode contar comigo para tirar dúvidas, acompanhar novidades e ter um atendimento super rápido e direto ao ponto!'
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
  for (const item of pedroVariants) {
    const res = await generate(item);
    for (const d of dirs) {
      fs.writeFileSync(path.join(d, `${item.id}.mp3`), res.buffer);
    }
    results.push({
      id: res.id,
      persona: res.persona,
      voice: res.voice,
      durationMs: res.durationMs,
      sizeBytes: res.sizeBytes,
      text: res.text
    });
  }

  console.log('=== RESULTADO OFICIAL PEDRO (VOZ MAIS JOVEM) ===');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error('Erro na geração:', err);
  process.exit(1);
});
