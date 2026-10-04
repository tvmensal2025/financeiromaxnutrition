import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wxkgrykduqtsgmjkzlou.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4a2dyeWtkdXF0c2dtamt6bG91Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDEyOTQyOSwiZXhwIjoyMTA1NzA1NDI5fQ.1tf7YBL8ib52pAbVQHVg7Pwwr3iIBAYPOaKg_3dQWek';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDetails() {
  console.log('=== DETALHES DA TAREFA TSK-ELIVING-20261004-001 ===');
  const { data: task } = await supabase
    .from('tarefas')
    .select('*')
    .eq('task_id', 'TSK-ELIVING-20261004-001')
    .single();
  console.log(JSON.stringify(task, null, 2));

  console.log('\n=== JOBS RELACIONADOS ===');
  const { data: jobs } = await supabase
    .from('agent_jobs')
    .select('*')
    .or('task_id.eq.TSK-ELIVING-20261004-001,result_summary.ilike.%living%');
  console.log(JSON.stringify(jobs, null, 2));

  console.log('\n=== HANDOFFS RELACIONADOS ===');
  const { data: handoffs } = await supabase
    .from('handoffs')
    .select('*')
    .or('assunto.ilike.%living%,detalhes.ilike.%living%');
  console.log(JSON.stringify(handoffs, null, 2));
}

checkDetails().catch(console.error);
