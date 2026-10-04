import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

function readEnvFile(path) {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(fs.readFileSync(path, 'utf8').split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
    return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, '')]] : [];
  }));
}

const env = { ...readEnvFile('.env'), ...readEnvFile('.env.local'), ...process.env };
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error(JSON.stringify({ status: 'CONFIG_MISSING', required: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'] }));
  process.exit(2);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const tables = ['agentes', 'tarefas', 'agent_jobs', 'agent_job_events', 'handoffs', 'checkpoint_mestre_atual'];
const results = [];
for (const table of tables) {
  const { data, error } = await supabase.from(table).select('*').limit(1);
  results.push({
    table,
    status: error ? (error.code === '42501' || !error.code ? 'AUTH_REQUIRED' : 'ERROR') : 'READABLE',
    code: error?.code ?? null,
    message: error?.message ?? null,
    sample_rows: data?.length ?? 0,
  });
}

const hasAuthGate = results.every((item) => item.status === 'AUTH_REQUIRED');
const hasSchemaError = results.some((item) => item.status === 'ERROR');
const report = {
  status: hasSchemaError ? 'SCHEMA_OR_NETWORK_ERROR' : hasAuthGate ? 'SUPABASE_REACHABLE_AUTH_REQUIRED' : 'SUPABASE_REACHABLE',
  supabase_url: url,
  role_tested: 'publishable/anonymous',
  writes_performed: false,
  note: hasAuthGate
    ? 'As tabelas canônicas estão protegidas. Valide a leitura com uma sessão autenticada; não conceda SELECT ao anon para mascarar este resultado.'
    : 'A leitura foi avaliada com a credencial configurada; confirme RLS com a sessão real do usuário antes de declarar o fluxo operacional.',
  tables: results,
};
console.log(JSON.stringify(report, null, 2));
process.exit(hasSchemaError ? 1 : 0);
