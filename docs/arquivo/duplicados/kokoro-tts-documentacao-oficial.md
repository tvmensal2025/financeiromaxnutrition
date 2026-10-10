# 🎙️ Guia Oficial de Conexão e Vozes: Kokoro Neural TTS (Instância Canônica)

Este documento contém a especificação oficial para conectar **qualquer nova ferramenta, serviço ou automação** à mesma instância e domínio do **Kokoro Neural TTS** que já está ativo e operando em produção no EasyPanel.

> **Diretiva de Infraestrutura:**  
> Usamos **o mesmo domínio, a mesma instância e a mesma chave de API** já homologados. Não é necessário criar um novo container nem duplicar recursos. Ambas as ferramentas consomem diretamente o mesmo motor de voz, garantindo **identidade vocal 100% idêntica, latência mínima e cache compartilhado**.

---

## 1. 🔑 Dados de Conexão Oficiais (Copie e Cole na Nova Ferramenta)

| Parâmetro | Valor Exato para Configurar |
| :--- | :--- |
| **Domínio / Base URL** | `https://helena-automation-kokoro.d9v63q.easypanel.host` |
| **Endpoint REST Direto** | `https://helena-automation-kokoro.d9v63q.easypanel.host/api/v1/audio/speech` |
| **API Key (`KW_SECRET_API_KEY`)** | `qjuo4ld0exr5bkexo3cczbbcoanvrzu4` |
| **Modelo (`model`)** | `model` |
| **Voz Padrão Oficial (Pedro)** | `pm_alex*0.7+am_liam*0.3` |
| **Header de Autenticação** | `Authorization: Bearer qjuo4ld0exr5bkexo3cczbbcoanvrzu4` |
| **Formato de Retorno** | `audio/mpeg` (MP3 streaming de alta qualidade) |

### Variáveis de Ambiente Prontas para o seu arquivo `.env`:
```env
# Configurações Oficiais Kokoro TTS
KOKORO_BASE_URL=https://helena-automation-kokoro.d9v63q.easypanel.host
KOKORO_API_KEY=qjuo4ld0exr5bkexo3cczbbcoanvrzu4
KOKORO_MODEL=model
KOKORO_DEFAULT_VOICE=pm_alex*0.7+am_liam*0.3
```

---

## 2. ⚡ Compatibilidade com Padrão OpenAI TTS (n8n, Dify, Flowise, Typebot, etc.)

Se a sua nova ferramenta possui integração nativa com o **OpenAI Audio / TTS**, basta preencher os campos de conexão apontando para a instância do Kokoro:

* **OpenAI Base URL:** `https://helena-automation-kokoro.d9v63q.easypanel.host/api/v1`  
  *(alguns clientes exigem sem o `/api`: `https://helena-automation-kokoro.d9v63q.easypanel.host/v1`)*
* **OpenAI API Key:** `qjuo4ld0exr5bkexo3cczbbcoanvrzu4`
* **Model Name:** `model`
* **Voice:** `pm_alex*0.7+am_liam*0.3` *(ou qualquer voz do catálogo abaixo)*

---

## 3. 👥 Catálogo Oficial das Mesmas Vozes Homologadas

Todas as vozes abaixo estão carregadas e ativas na instância do Kokoro:

### 🏆 Vozes Oficiais e Blends Ponderados do Projeto:

| Personagem / Assistente | ID da Voz Exato (`voice`) | Perfil Tonal | Composição da Voz |
| :--- | :--- | :--- | :--- |
| **🥇 Pedro (Oficial Max Nutrition)** | `pm_alex*0.7+am_liam*0.3` | Homem jovem, atlético, prestativo, comercial e dinâmico | 70% Alex (`pt-BR`) + 30% Liam (`en-US`) |
| **🥈 Assistente da Sirlene** | `pf_dora*0.7+af_heart*0.3` | Mulher acolhedora, empática, calorosa e calma | 70% Dora (`pt-BR`) + 30% Heart (`en-US`) |
| **🥉 Dr. Vital** | `pm_santa` | Homem maduro, seguro, autoridade médica/nutricional | 100% Santa (`pt-BR`) |
| **🏅 Alex (Assistente Executivo)** | `pm_santa*0.7+pm_alex*0.3` | Homem corporativo, objetivo, claro e resolutivo | 70% Santa + 30% Alex (`pt-BR`) |

---

### 📚 Tabela de Vozes Base Individuais Disponíveis:

| ID da Voz | Idioma | Gênero | Característica |
| :--- | :---: | :---: | :--- |
| `pm_alex` | `pt-BR` | Masculino | Jovem, claro, português brasileiro natural |
| `pm_santa` | `pt-BR` | Masculino | Maduro, grave, firme e acolhedor |
| `pf_dora` | `pt-BR` | Feminino | Clara, simpática, dicção impecável em pt-BR |
| `af_heart` | `en-US` | Feminino | Suave, doce, acrescenta empatia aos blends |
| `af_bella` | `en-US` | Feminino | Firme, refinada, postura profissional |
| `am_liam` | `en-US` | Masculino | Jovem, ágil, tom comercial moderno |
| `am_adam` | `en-US` | Masculino | Corporativo, institucional e seguro |

---

## 4. 📐 Regras de Ouro para Vozes e Blends (Voice Blending)

1. **Soma Obrigatória = 1.0:**
   * A sintaxe de mistura é `<voz1>*<peso1>+<voz2>*<peso2>`.
   * A soma dos pesos deve ser sempre igual a `1.0`. Exemplo: `0.7 + 0.3 = 1.0`.
2. **Dominância da Fonética Brasileira (>= 0.7):**
   * A voz principal deve ser obrigatoriamente `pm_alex`, `pm_santa` ou `pf_dora` com peso mínimo de `0.70` para garantir português do Brasil perfeito e sem sotaque estrangeiro.
   * A voz secundária (`0.15` a `0.30`) serve exclusivamente para adicionar textura, brilho, velocidade e afinação ao timbre.

---

## 5. 🧹 Regras de Sanitização de Texto para a Nova Ferramenta

Para que a nova ferramenta gere áudios com a mesma qualidade de estúdio, aplique a seguinte limpeza no texto antes de enviar para o Kokoro:

1. **Remova Markdown e Tags:**
   * Elimine `*`, `**`, `#`, `` ` ``, `_`, `~` e travessões soltos.
2. **Remova Emojis:**
   * Nunca envie emojis ao sintetizador neural.
3. **Números por Extenso:**
   * Para fala natural, converta números e moedas: *"R$ 199,00"* ➔ *"cento e noventa e nove reais"*, *"5%"* ➔ *"cinco por cento"*.
4. **Pontuação Expressiva:**
   * Ponto final (`.`) = pausa completa e tom conclusivo.
   * Vírgula (`,`) = micropausa natural de respiração.
   * Ponto de interrogação (`?`) = entonação interrogativa ascendente.
   * Ponto de exclamação (`!`) = ênfase calorosa.

---

## 6. 💻 Snippets Prontos para Conectar sua Nova Ferramenta

### Exemplo A: cURL (Terminal / Script Shell)
```bash
curl -X POST "https://helena-automation-kokoro.d9v63q.easypanel.host/api/v1/audio/speech" \
  -H "Authorization: Bearer qjuo4ld0exr5bkexo3cczbbcoanvrzu4" \
  -H "Content-Type: application/json" \
  -H "Accept: audio/mpeg" \
  -d '{
    "model": "model",
    "voice": "pm_alex*0.7+am_liam*0.3",
    "input": "Olá! Este é um teste da mesma voz e mesmo domínio na nova ferramenta!",
    "speed": 1.0
  }' \
  --output audio_teste.mp3
```

---

### Exemplo B: Node.js / JavaScript (Fetch Nativo)
```javascript
import fs from 'node:fs/promises';

async function falarComKokoro(texto, voice = 'pm_alex*0.7+am_liam*0.3', arquivoSaida = 'saida.mp3') {
  const url = 'https://helena-automation-kokoro.d9v63q.easypanel.host/api/v1/audio/speech';
  const apiKey = 'qjuo4ld0exr5bkexo3cczbbcoanvrzu4';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify({
      model: 'model',
      voice: voice,
      input: texto.replace(/[*#_~`]/g, '').trim(),
      speed: 1.0
    })
  });

  if (!res.ok) {
    throw new Error(`Erro Kokoro [${res.status}]: ${await res.text()}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(arquivoSaida, buffer);
  return arquivoSaida;
}

// Executar:
await falarComKokoro('Olá! Comunicação 100% conectada na mesma instância do Kokoro!');
```

---

### Exemplo C: Python (`requests`)
```python
import requests

def gerar_audio_kokoro(texto: str, voice: str = "pm_alex*0.7+am_liam*0.3", output_path: str = "audio.mp3"):
    url = "https://helena-automation-kokoro.d9v63q.easypanel.host/api/v1/audio/speech"
    headers = {
        "Authorization": "Bearer qjuo4ld0exr5bkexo3cczbbcoanvrzu4",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "model",
        "voice": voice,
        "input": texto,
        "speed": 1.0
    }

    res = requests.post(url, json=payload, headers=headers, timeout=30)
    res.raise_for_status()

    with open(output_path, "wb") as f:
        f.write(res.content)
    return output_path

# Executar:
gerar_audio_kokoro("Olá a todos! Integrando com o mesmo Kokoro oficial.")
```

---

## 7. 🚀 Vantagens de Manter a Mesma Instância Ativa

1. **Latência de ~500ms Instantânea:** O modelo fonético de 82M de parâmetros já está aquecido na memória RAM da VPS.
2. **Volume Persistente Compartilhado:** O cache em `/kokoro/cache` já contém todos os pesos fonéticos.
3. **Consistência de Marca:** O Pedro e a Sirlene soarão rigorosamente com a mesma identidade sonora em todas as suas plataformas.
