import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wxkgrykduqtsgmjkzlou.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4a2dyeWtkdXF0c2dtamt6bG91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMjk0MjksImV4cCI6MjEwNTcwNTQyOX0.PwIew3FpmSvvt1pnxcqfoyRNleBK8xTwh0K-e6UkO_8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('--- TESTANDO LEITURA DAS TABELAS DA PÁGINA DA HELENA ---');

  const tabelas = [
    'agentes',
    'tarefas',
    'foco_executivo',
    'agent_connections',
    'handoffs',
    'projetos',
    'recorrencias',
    'agent_jobs',
    'agent_job_events',
    'decisoes',
    'auditoria',
    'checkpoint_mestre_atual'
  ];

  for (const tab of tabelas) {
    const { data, count, error } = await supabase.from(tab).select('*', { count: 'exact', head: false }).limit(3);
    if (error) {
      console.log(`❌ ${tab}: ERRO ->`, error.message, error.code);
    } else {
      console.log(`✅ ${tab}: OK (Total registros: ${count}, Amostra: ${data?.length})`);
    }
  }

  // Verificar especificamente as últimas tarefas e jobs
  console.log('\n--- ÚLTIMOS JOBS NO SUPABASE ---');
  const { data: recentJobs, error: errJobs } = await supabase
    .from('agent_jobs')
    .select('job_id, task_id, agent_id, business_id, status, approval_status, result_summary, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (errJobs) {
    console.error('Erro ao ler agent_jobs:', errJobs);
  } else {
    console.table(recentJobs);
  }

  console.log('\n--- ÚLTIMAS TAREFAS NO SUPABASE ---');
  const { data: recentTasks, error: errTasks } = await supabase
    .from('tarefas')
    .select('task_id, tarefa, responsavel, status, prioridade, atualizado_em')
    .order('atualizado_em', { ascending: false })
    .limit(5);

  if (errTasks) {
    console.error('Erro ao ler tarefas:', errTasks);
  } else {
    console.table(recentTasks);
  }
}

main().catch(console.error);
