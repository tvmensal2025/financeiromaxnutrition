import crypto from 'node:crypto';

export function hermesApiConfigured(baseUrl, keysJson) {
  if (!baseUrl || !keysJson) return false;
  try {
    const keys = JSON.parse(keysJson);
    const url = new URL(baseUrl);
    return (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
      && keys && typeof keys === 'object' && !Array.isArray(keys);
  } catch { return false; }
}

export async function startHermesRun({ job, task, binding, baseUrl, keysJson, fetchImpl = fetch }) {
  if (!hermesApiConfigured(baseUrl, keysJson)) throw new Error('API do Hermes nao configurada');
  if (!job?.job_id || !job?.task_id || !job?.business_id || !job?.agent_id || job.status !== 'READY') {
    throw new Error('Job nao esta pronto e vinculado a tarefa, empresa e agente');
  }
  if (task?.task_id !== job.task_id || task.business_id !== job.business_id) {
    throw new Error('Tarefa e empresa divergentes');
  }
  if (binding?.agent_id !== job.agent_id || binding?.status !== 'ACTIVE' || binding?.provider !== 'HERMES'
      || !binding.profile_slug || (binding.business_id !== job.business_id && !(job.agent_id === 'AGT-01' && binding.scope_type === 'GROUP'))) {
    throw new Error('Perfil Hermes nao corresponde ao job ativo');
  }
  if (!job.instruction?.trim() || !task.definicao_de_pronto?.trim()) {
    throw new Error('Briefing incompleto: instrucao e definicao de pronto obrigatorias antes de gastar credito');
  }
  const keys = JSON.parse(keysJson);
  const apiKey = keys[binding.profile_slug];
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('Chave da API ausente para este perfil Hermes');

  const url = new URL(baseUrl);
  url.pathname = `/p/${encodeURIComponent(binding.profile_slug)}/v1/runs`;
  url.search = '';
  const idempotencyKey = `helena-${crypto.createHash('sha256').update(job.job_id).digest('hex')}`;
  const input = [
    `SISTEMA HELENA — JOB ${job.job_id}`,
    `Perfil: ${binding.profile_slug}. Empresa: ${job.business_id}. Tarefa: ${job.task_id}.`,
    `Objetivo: ${job.objective}`,
    `Instrucoes da tarefa: ${job.instruction}`,
    `Definicao de pronto: ${task.definicao_de_pronto}`,
    'Antes de agir, use helena_operacao.get_work_context e get_job. Confirme empresa, responsavel e versao.',
    'Depois use claim_job e start_job. Registre marcos com record_progress e fontes com record_memory.',
    ...(binding.profile_slug === 'maya--biz003' ? ['Para cada PNG, chame create_artifact_upload com job_id, slot, version e svg vetorial original (ate 35 KB), em 1080x1350 para post ou 1080x1920 para story; sem URLs, imagens externas ou scripts. O Gateway renderiza, envia e verifica o PNG privado; registre cada referencia retornada como evidencia.'] : []),
    'Entregue com submit_delivery, evidencias e versao atual. Aguarde review_delivery; nao use complete_job.',
    'Em bloqueio, registre fail_job ou waiting_helena. Nunca anuncie conclusao sem leitura confirmada do Supabase.'
  ].join('\n');

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify({ input, session_id: `helena-${job.job_id}` }),
    redirect: 'error',
    signal: AbortSignal.timeout(20000)
  });
  if (response.status !== 202) throw new Error(`Hermes nao aceitou a execucao (HTTP ${response.status})`);
  const data = await response.json().catch(() => null);
  if (!data || typeof data.run_id !== 'string' || !/^run_[A-Za-z0-9_-]{1,120}$/.test(data.run_id)) {
    throw new Error('Hermes respondeu sem run_id valido');
  }
  return { run_id: data.run_id, status: data.status || 'started', profile_slug: binding.profile_slug };
}
