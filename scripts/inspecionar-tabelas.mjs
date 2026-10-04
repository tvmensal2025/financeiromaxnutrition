import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://wxkgrykduqtsgmjkzlou.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4a2dyeWtkdXF0c2dtamt6bG91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMjk0MjksImV4cCI6MjEwNTcwNTQyOX0.PwIew3FpmSvvt1pnxcqfoyRNleBK8xTwh0K-e6UkO_8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const tabelas = [
    'portfolio', 'foco_executivo', 'estado_mestre', 'decisoes', 'ideias', 'metas_kpis',
    'crm', 'marketing', 'clientes', 'atendimento', 'comunicacoes',
    'projetos', 'marcos', 'tarefas', 'calendario', 'produto',
    'financeiro', 'contas_financeiras', 'orcamento', 'recorrencias', 'plano_contas',
    'processos', 'obrigacoes', 'fornecedores', 'ativos', 'documentos',
    'riscos', 'governanca', 'incidentes', 'contratos', 'consentimentos', 'societario',
    'agentes', 'handoffs', 'memoria_mestre', 'pessoas', 'fundador',
    'integracoes', 'agent_jobs', 'agent_connections', 'auditoria'
  ];

  console.log("=== CONTAGEM DE TABELAS SUPABASE ===");
  for (const t of tabelas) {
    try {
      const { data, count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`${t.padEnd(22)}: ERRO ${error.code} - ${error.message}`);
      } else {
        console.log(`${t.padEnd(22)}: ${count} registros`);
      }
    } catch (e) {
      console.log(`${t.padEnd(22)}: EXCEÇÃO ${e.message}`);
    }
  }

  // Verificar portfólios / empresas
  const { data: portfolios } = await supabase.from('portfolio').select('business_id, nome, ativo, codigo');
  console.log("\n=== PORTFOLIO / EMPRESAS ===");
  console.log(portfolios);

  // Verificar jobs com entregas de materiais
  const { data: jobs } = await supabase.from('agent_jobs')
    .select('job_id, task_id, agent_id, business_id, status, approval_status, result_summary')
    .limit(10);
  console.log("\n=== AGENT JOBS (amostra) ===");
  console.log(jobs);
}

main();
