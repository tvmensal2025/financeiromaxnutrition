// Estado operacional da voz Max Nutrition. Nunca persiste credenciais no perfil.
// Voz ElevenLabs padrão = voz da Sirlene na configuração única do eLiving (nunca ID solto ou legado).
import { ELEVENLABS_CHARACTER_VOICES, DEFAULT_VOICE_CHARACTER } from './elevenlabs.mjs';

const BUSINESS_ID = 'BIZ-002';
const PROFILE_ID = 'VP-VOICE-AGENT-BIZ-002';
const ALLOWED_FIELDS = [
  'agent_name', 'persona', 'knowledge_base', 'inbound_greeting',
  'outbound_greeting', 'voice_provider', 'call_voice', 'voice_profile_id', 'kokoro_voice', 'elevenlabs_voice',
  'ai_provider', 'ai_model', 'is_active', 'updated_at'
];

export function publicVoiceConfig(config = {}) {
  return Object.fromEntries(ALLOWED_FIELDS
    .filter(field => Object.hasOwn(config, field))
    .map(field => [field, config[field]]));
}

export function createVoiceAgentStore(supabaseFetch) {
  if (typeof supabaseFetch !== 'function') throw new Error('Supabase não conectado ao gateway de voz.');
  return {
    async load() {
      const url = `/rest/v1/voice_profiles?select=profile_id,business_id,settings&profile_id=eq.${encodeURIComponent(PROFILE_ID)}&limit=1`;
      const profiles = await supabaseFetch(url);
      if (profiles?.length) {
        const profile = profiles[0];
        if (profile.profile_id !== PROFILE_ID || profile.business_id !== BUSINESS_ID) {
          throw new Error('Perfil de voz retornado fora da empresa esperada.');
        }
        return publicVoiceConfig(profile.settings?.voice_agent || {});
      }
      // Os registros legados do "Comando Gigante" usam chave sem índice único.
      // A leitura da última versão preserva os ajustes anteriores à migração.
      const legacy = {};
      const fields = [
        ['VOICE_AGENT_KNOWLEDGE_BASE', 'knowledge_base'],
        ['VOICE_AGENT_PERSONA', 'persona'],
        ['VOICE_AGENT_AI_PROVIDER', 'ai_provider'],
        ['VOICE_AGENT_AI_MODEL', 'ai_model']
      ];
      // These reads have no ordering dependency. Keep fresh configuration and
      // fail on any read error, without adding four sequential round trips.
      const values = await Promise.all(fields.map(async ([key, field]) => {
        const rows = await supabaseFetch(
          `/rest/v1/configuracao?select=valor&chave=eq.${key}&order=registro_id.desc&limit=1`
        );
        return [field, rows?.[0]?.valor];
      }));
      for (const [field, value] of values) {
        if (value) legacy[field] = value;
      }
      return legacy;
    },
    async save(config) {
      const safe = publicVoiceConfig(config);
      const provider = safe.voice_provider || 'GOOGLE_CHIRP3_HD';
      if (!['GOOGLE_CHIRP3_HD', 'KOKORO', 'ELEVENLABS'].includes(provider)) {
        throw new Error('Provedor de voz não suportado.');
      }
      const result = await supabaseFetch('/rest/v1/voice_profiles?on_conflict=profile_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify([{
          profile_id: PROFILE_ID,
          business_id: BUSINESS_ID,
          nome: 'Atendente de voz Max Nutrition',
          provider,
          voice_id: provider === 'GOOGLE_CHIRP3_HD'
            ? (safe.call_voice || 'pt-BR-Chirp3-HD-Achird')
            : provider === 'ELEVENLABS'
              ? (safe.elevenlabs_voice || ELEVENLABS_CHARACTER_VOICES[DEFAULT_VOICE_CHARACTER])
              : (safe.kokoro_voice || 'pm_alex*0.7+am_liam*0.3'),
          enabled: safe.is_active !== false,
          is_default: false,
          settings: { voice_agent: safe },
          updated_at: new Date().toISOString()
        }])
      });
      if (result?.[0]?.profile_id !== PROFILE_ID || result[0].business_id !== BUSINESS_ID) {
        throw new Error('Supabase não confirmou a configuração de voz.');
      }
      return safe;
    }
  };
}
