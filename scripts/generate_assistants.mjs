import fs from 'fs';
import path from 'path';

const API_KEY = 'qjuo4ld0exr5bkexo3cczbbcoanvrzu4';
const API_URL = 'https://helena-automation-kokoro.d9v63q.easypanel.host/api/v1/audio/speech';

const assistants = [
  {
    id: 'assistente_sirlene',
    persona: 'Assistente da Sirlene (Mulher)',
    voice: 'pf_dora*0.7+af_heart*0.3',
    gender: 'Mulher',
    text: 'Olá! Eu sou a assistente da Sirlene. Estou entrando em contato para te dar as boas-vindas e prestar todo o suporte necessário no seu atendimento. A nossa equipe está totalmente à disposição para tirar suas dúvidas, acompanhar suas solicitações e garantir uma experiência ágil, acolhedora e personalizada.'
  },
  {
    id: 'assistente_dr_vital',
    persona: 'Assistente do Dr. Vital (Homem)',
    voice: 'pm_santa',
    gender: 'Homem',
    text: 'Olá a todos! Eu sou o assistente do Dr. Vital. Estou entrando em contato em nome da nossa equipe de saúde e nutrição para acompanhar de perto o seu plano e o seu bem-estar. O nosso compromisso é garantir que todas as orientações do Dr. Vital sejam seguidas com total segurança, clareza e máxima atenção à sua evolução.'
  },
  {
    id: 'alex_assistente_dr_vital',
    persona: 'Alex, Assistente do Dr. Vital (Homem)',
    voice: 'pm_santa',
    gender: 'Homem',
    text: 'Olá a todos! Eu sou o Alex, assistente do Dr. Vital. Passando aqui para confirmar o seu atendimento e reforçar que a nossa equipe de suporte e acompanhamento de saúde está totalmente conectada e à sua disposição para o que você precisar.'
  },
  {
    id: 'alex_assistente_geral',
    persona: 'Alex (Assistente Executivo)',
    voice: 'pm_santa*0.7+pm_alex*0.3',
    gender: 'Homem',
    text: 'Olá! Eu sou o Alex, assistente da nossa central de atendimento e suporte. Passando para confirmar que todo o nosso canal de comunicação inteligente está ativo, monitorado em tempo real e preparado para oferecer respostas rápidas e eficientes para você.'
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
  for (const item of assistants) {
    const res = await generate(item);
    for (const d of dirs) {
      fs.writeFileSync(path.join(d, `${item.id}.mp3`), res.buffer);
    }
    results.push({
      id: res.id,
      persona: res.persona,
      gender: res.gender,
      voice: res.voice,
      durationMs: res.durationMs,
      sizeBytes: res.sizeBytes,
      text: res.text
    });
  }

  console.log('=== RESULTADO OFICIAL ASSISTENTES ===');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error('Erro na geração dos assistentes:', err);
  process.exit(1);
});
