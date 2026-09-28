import fs from 'fs';
import path from 'path';

const API_KEY = 'qjuo4ld0exr5bkexo3cczbbcoanvrzu4';
const API_URL = 'https://helena-automation-kokoro.d9v63q.easypanel.host/api/v1/audio/speech';

const scripts = [
  {
    id: 'alex_homem_1',
    persona: 'Alex (Homem 1)',
    voice: 'pm_alex',
    gender: 'Homem',
    text: 'Olá! Eu sou Alex. Estou realizando este teste de síntese de voz neural diretamente do Kokoro conectado na nossa VPS. Este é um teste com uma frase mais longa para avaliarmos a fluidez, a cadência, a clareza e a entonação da fala em português do Brasil. O sistema está respondendo com excelente naturalidade e estabilidade.'
  },
  {
    id: 'sirlene_mulher',
    persona: 'Sirlene (Mulher)',
    voice: 'pf_dora',
    gender: 'Mulher',
    text: 'Olá! Eu sou Sirlene. É um prazer falar com você através do nosso motor de inteligência artificial. Este é o meu áudio de teste com uma mensagem mais longa para você ouvir a qualidade e a suavidade da minha voz em português brasileiro. Estamos prontos para oferecer um atendimento humanizado e ágil em todos os nossos canais.'
  },
  {
    id: 'dr_vital_homem_2',
    persona: 'Dr. Vital (Homem 2)',
    voice: 'pm_santa',
    gender: 'Homem',
    text: 'Olá a todos! Eu sou o Dr. Vital. Como especialista em saúde, bem-estar e performance nutricional, estou aqui para acompanhar a sua jornada com as orientações mais seguras e personalizadas. Esta é a minha fala de demonstração estendida no sistema Kokoro, garantindo autoridade, acolhimento e clareza para todos os nossos pacientes e clientes.'
  }
];

async function generateAndBenchmark(item) {
  const startTime = performance.now();
  console.log(`Iniciando geração: ${item.persona} (Voz: ${item.voice})...`);
  
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

  const durationMs = Math.round(performance.now() - startTime);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro [${res.status}]: ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  console.log(`Concluído: ${item.persona} em ${durationMs}ms | Tamanho: ${buffer.length} bytes`);
  return {
    ...item,
    durationMs,
    sizeBytes: buffer.length,
    buffer
  };
}

async function run() {
  const outputDirs = [
    'c:\\Users\\plata\\financeiromaxnutrition\\public\\audios',
    'c:\\Users\\plata\\financeiromaxnutrition\\audios',
    'C:\\Users\\plata\\.gemini\\antigravity-ide\\brain\\465f0faa-70a8-4e81-bcf6-8de0dfe5acc5'
  ];

  for (const dir of outputDirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const results = [];
  for (const item of scripts) {
    const res = await generateAndBenchmark(item);
    for (const dir of outputDirs) {
      const filePath = path.join(dir, `${item.id}.mp3`);
      fs.writeFileSync(filePath, res.buffer);
    }
    results.push({
      persona: res.persona,
      gender: res.gender,
      voice: res.voice,
      durationMs: res.durationMs,
      sizeBytes: res.sizeBytes,
      wordsCount: res.text.split(/\s+/).length,
      charactersCount: res.text.length,
      text: res.text
    });
  }

  console.log('=== RELATÓRIO OFICIAL DE BENCHMARK ===');
  console.log(JSON.stringify(results, null, 2));
}

run().catch(err => {
  console.error('Falha geral:', err);
  process.exit(1);
});
