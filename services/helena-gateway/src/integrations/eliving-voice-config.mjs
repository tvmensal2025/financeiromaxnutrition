// ARQUIVO GERADO a partir de ids-max/supabase/functions/_shared/voice/elevenlabsConfig.ts — não editar à mão; regenere com node --experimental-strip-types scripts/sync-voice-config-gateway.mjs
//
// Voz do eLiving no Helena Gateway (regras: ids-max/docs/voz/REGRAS_VOZ_ELEVENLABS.md):
// - ElevenLabs V4: models.tempoReal na ligação/ao vivo, models.gravado em áudio gravado.
// - Uma voz e um padrão (voiceSettings) por personagem; a voz Google (googleFallbackVoice) é só reserva,
//   uma por personagem, usada quando acabam os créditos/minutos da ElevenLabs (429/cota) ou ela falha.
// - Tags de áudio do dono entre colchetes; proibidas com o aluno em forbiddenWithStudent.
// - legacyVoiceIds/legacyModels existem só para barrar uso (o sistema nunca fala com eles).

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

export const ELIVING_VOICE_CONFIG = deepFreeze({
  "source": "ids-max/supabase/functions/_shared/voice/elevenlabsConfig.ts",
  "models": {
    "gravado": "eleven_v4",
    "tempoReal": "eleven_v4_turbo"
  },
  "characters": {
    "sirlene": {
      "voiceId": "eabgQyq9no9rW5ZiGiaZ",
      "nomeNaConta": "Sirlene Correa",
      "voiceSettings": {
        "stability": 0.49,
        "similarity_boost": 0.19,
        "style": 0.11,
        "use_speaker_boost": true,
        "speed": 1.16
      },
      "googleFallbackVoice": "pt-BR-Chirp3-HD-Achernar"
    },
    "alex": {
      "voiceId": "TX3LPaxmHKxFdv7VOQHJ",
      "nomeNaConta": "Liam",
      "voiceSettings": {
        "stability": 0.5,
        "similarity_boost": 0.75,
        "style": 0,
        "use_speaker_boost": true,
        "speed": 1
      },
      "googleFallbackVoice": "pt-BR-Chirp3-HD-Alkaid"
    },
    "vital": {
      "voiceId": "IKpiSijWzlhOL6uX83EH",
      "nomeNaConta": "Will - institutional",
      "voiceSettings": {
        "stability": 0.35,
        "similarity_boost": 0.3,
        "style": 0,
        "use_speaker_boost": true,
        "speed": 1.08
      },
      "googleFallbackVoice": "pt-BR-Chirp3-HD-Charon"
    },
    "rafael": {
      "voiceId": "B4raRyOeSoCr40rqvhFE",
      "nomeNaConta": "Rafael Ferreira Das",
      "voiceSettings": {
        "stability": 0.75,
        "similarity_boost": 0.9,
        "style": 0,
        "use_speaker_boost": true,
        "speed": 0.92
      },
      "googleFallbackVoice": "pt-BR-Chirp3-HD-Achird"
    }
  },
  "audioTagsDono": [
    "whispers",
    "shouts",
    "yelling",
    "laughing",
    "laughs",
    "sighs",
    "sighing",
    "crying",
    "tearfully",
    "excited",
    "enthusiastic",
    "nervously",
    "cautiously",
    "angry",
    "frustrated",
    "sarcastic",
    "deadpan",
    "curious",
    "thoughtful",
    "clears throat",
    "gasps",
    "giggles",
    "groans",
    "snickers",
    "stifling laughter",
    "pause",
    "short pause"
  ],
  "forbiddenWithStudent": [
    {
      "tag": "angry",
      "motivo": "soa como bronca",
      "exceto": []
    },
    {
      "tag": "frustrated",
      "motivo": "soa como impaciência ou decepção com o aluno",
      "exceto": []
    },
    {
      "tag": "sarcastic",
      "motivo": "soa como deboche",
      "exceto": []
    },
    {
      "tag": "deadpan",
      "motivo": "soa como deboche",
      "exceto": []
    },
    {
      "tag": "groans",
      "motivo": "soa como impaciência",
      "exceto": []
    },
    {
      "tag": "snickers",
      "motivo": "soa como deboche",
      "exceto": []
    },
    {
      "tag": "stifling laughter",
      "motivo": "soa como deboche",
      "exceto": []
    },
    {
      "tag": "crying",
      "motivo": "choro gera desconforto",
      "exceto": []
    },
    {
      "tag": "tearfully",
      "motivo": "choro gera desconforto",
      "exceto": []
    },
    {
      "tag": "shouts",
      "motivo": "grito só vale para comemorar (junto de [excited] ou [enthusiastic])",
      "exceto": [
        "excited",
        "enthusiastic"
      ]
    },
    {
      "tag": "yelling",
      "motivo": "grito só vale para comemorar (junto de [excited] ou [enthusiastic])",
      "exceto": [
        "excited",
        "enthusiastic"
      ]
    }
  ],
  "speakerTagPalette": {
    "sirlene": [
      "laughs",
      "giggles",
      "curious",
      "thoughtful",
      "whispers",
      "short pause"
    ],
    "alex": [
      "excited",
      "enthusiastic",
      "laughs",
      "shouts",
      "short pause"
    ],
    "vital": [
      "clears throat",
      "thoughtful",
      "cautiously",
      "curious",
      "pause"
    ],
    "rafael": [
      "thoughtful",
      "pause",
      "whispers",
      "sighs",
      "laughs"
    ]
  },
  "legacyVoiceIds": {
    "EJV7H2baGt5ab95tOoSG": "Uneskee — áudios antigos da Sirlene (saudações com nome e dicas), até serem regravados",
    "onwK4e9ZLuTAKqWW03F9": "Daniel (biblioteca) — voz provisória antiga do Rafael, substituída pelo clone do Rafael",
    "pNInz6obpgDQGcFmaJgB": "Adam (biblioteca) — teste antigo de voz do Dr. Vital",
    "21m00Tcm4TlvDq8ikWAM": "Janet (biblioteca; antes chamada \"Rachel\") — teste antigo de voz",
    "EXAVITQu4vr4xnSDxMaL": "Sarah (biblioteca) — teste antigo de voz",
    "ErXwobaYiN019PkySvjV": "Adam (biblioteca, ID antigo; antes chamada \"Antoni\") — teste antigo de voz",
    "IKne3meq5aSn9XLyUdCD": "Charlie (biblioteca) — teste antigo de voz",
    "TnTLMCssIRFcYx8EjsS3": "voz de teste antiga do gerador de coach (não existe mais na biblioteca)",
    "bIHbv24MWmeRgasZH58o": "Will - Relaxed Optimist (biblioteca) — teste antigo de boas-vindas; NÃO é a voz do Dr. Vital",
    "YKrm0N1EAM9Bw27j8kuD": "Leónidas (biblioteca) — candidata antiga do Alex",
    "gzwoRNUxuPTaJkY1fixX": "Felipe Machado Justo (biblioteca) — candidata antiga do Alex",
    "lUaTJLTsNnLQQ5G5LJen": "Clone Tomaz (biblioteca) — candidata antiga do Alex"
  },
  "legacyVoiceCharacters": {
    "EJV7H2baGt5ab95tOoSG": "sirlene",
    "onwK4e9ZLuTAKqWW03F9": "rafael"
  },
  "legacyModels": [
    "eleven_multilingual_v2",
    "eleven_multilingual_v1",
    "eleven_monolingual_v1",
    "eleven_v3",
    "eleven_v3_conversational",
    "eleven_flash_v2",
    "eleven_flash_v2_5",
    "eleven_turbo_v2",
    "eleven_turbo_v2_5"
  ],
  "legacyModelPrefixes": [
    "eleven_flash_",
    "eleven_turbo_"
  ],
  "sourceHash": "cf95f7b5bf61b42bd18124e6296885125aca9aca7f6c13568a0076e77c91e521"
});

export default ELIVING_VOICE_CONFIG;
