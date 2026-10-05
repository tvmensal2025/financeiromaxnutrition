/** Confere o recibo da entrada. Nao autentica, nao cria jobs e nao inicia modelos. */
export function confirmIntakeReceipt(result, request) {
  if (!result || typeof result !== 'object' || Array.isArray(result)
    || result.success !== true || result.task_id !== request.task_id
    || !/^JOB-HR-[a-f0-9]{32}$/.test(result.job_id || '')
    || typeof result.business_id !== 'string' || !result.business_id.trim()
    || result.status !== 'DRAFT' || result.started !== false
    || (result.released !== undefined && result.released !== false)) {
    throw new Error('Entrada na fila nao confirmada; consultar tarefa antes de repetir');
  }
  if (result.reused === true && typeof result.current_job_status !== 'string') {
    throw new Error('Recibo reutilizado exige estado atual separado');
  }
  return result;
}
