import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wxkgrykduqtsgmjkzlou.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4a2dyeWtkdXF0c2dtamt6bG91Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDEyOTQyOSwiZXhwIjoyMTA1NzA1NDI5fQ.1tf7YBL8ib52pAbVQHVg7Pwwr3iIBAYPOaKg_3dQWek';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function diagnosticar() {
  console.log('=== 1. CONTEÚDO ATUAL DA TABELA PORTFOLIO ===');
  const { data: portfolio, error: errPort } = await supabase.from('portfolio').select('*');
  if (errPort) console.error('Erro portfolio:', errPort);
  else console.table(portfolio);

  console.log('\n=== 2. ÚLTIMAS MENSAGENS / MEMÓRIA MESTRE ===');
  const { data: mem, error: errMem } = await supabase
    .from('memoria_mestre')
    .select('id, data_hora, assunto, registro, proxima_acao, business_id_area, agente_origem')
    .order('data_hora', { ascending: false })
    .limit(10);
  if (errMem) console.error('Erro memoria:', errMem);
  else {
    for (const m of mem || []) {
      console.log(`[${m.data_hora}] Assunto: ${m.assunto} | Agente: ${m.agente_origem} | Area: ${m.business_id_area}`);
      console.log(`  Registro: ${m.registro}`);
      console.log(`  Prox: ${m.proxima_acao}\n`);
    }
  }

  console.log('\n=== 3. BUSCA POR ILIVING / LIVING / E-LIVING EM TODAS AS TABELAS ===');
  const tabelasParaBuscar = [
    'memoria_mestre',
    'portfolio',
    'tarefas',
    'handoffs',
    'ideias',
    'agent_jobs',
    'projetos',
    'decisoes',
    'auditoria',
    'checkpoint_mestre_atual'
  ];

  for (const tab of tabelasParaBuscar) {
    try {
      const { data, error } = await supabase.from(tab).select('*').limit(100);
      if (!error && data) {
        const matches = data.filter(row => {
          const str = JSON.stringify(row).toLowerCase();
          return str.includes('living') || str.includes('iliving') || str.includes('e-living');
        });
        if (matches.length > 0) {
          console.log(`🎯 Encontrado(s) ${matches.length} registro(s) em '${tab}':`);
          console.log(JSON.stringify(matches, null, 2));
        }
      }
    } catch (e) {
      // Ignorar tabelas que não existem
    }
  }

  console.log('\n=== 4. ÚLTIMOS JOBS DISPARADOS (agent_jobs) ===');
  const { data: jobs } = await supabase
    .from('agent_jobs')
    .select('job_id, task_id, agent_id, business_id, status, approval_status, result_summary, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  console.table(jobs);

  console.log('\n=== 5. ÚLTIMAS TAREFAS (tarefas) ===');
  const { data: tasks } = await supabase
    .from('tarefas')
    .select('task_id, tarefa, responsavel, status, business_id, criado_em, atualizado_em')
    .order('criado_em', { ascending: false })
    .limit(10);
  console.table(tasks);
}

diagnosticar().catch(console.error);
