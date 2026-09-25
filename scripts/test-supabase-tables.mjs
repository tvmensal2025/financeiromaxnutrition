// scripts/test-supabase-tables.mjs
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wxkgrykduqtsgmjkzlou.supabase.co';
const SUPABASE_KEY = 'sb_publishable_luxpvy-rsEFpxANjNiU07g_V5xg6FDF';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testSupabase() {
  console.log('=== TESTANDO TABELAS DO SUPABASE ===\n');

  // 1. integration_events
  const { data: events, error: errEvents } = await supabase
    .from('integration_events')
    .select('count', { count: 'exact', head: true });
  console.log('integration_events:', errEvents ? `Erro: ${errEvents.message}` : `OK (${events ?? 'tabela existe'})`);

  // 2. voice_profiles
  const { data: voices, error: errVoices } = await supabase
    .from('voice_profiles')
    .select('count', { count: 'exact', head: true });
  console.log('voice_profiles:', errVoices ? `Erro: ${errVoices.message}` : `OK (${voices ?? 'tabela existe'})`);

  // 3. call_sessions
  const { data: calls, error: errCalls } = await supabase
    .from('call_sessions')
    .select('count', { count: 'exact', head: true });
  console.log('call_sessions:', errCalls ? `Erro: ${errCalls.message}` : `OK (${calls ?? 'tabela existe'})`);

  // 4. agent_connections
  const { data: agents, error: errAgents } = await supabase
    .from('agent_connections')
    .select('agent_id, provider, status')
    .limit(5);
  console.log('agent_connections:', errAgents ? `Erro: ${errAgents.message}` : `OK (${agents?.length} agentes listados)`);
}

testSupabase();
