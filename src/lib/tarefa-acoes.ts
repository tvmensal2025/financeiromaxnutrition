import { supabase } from "@/lib/supabase";
import type { TarefaRow } from "@/lib/agenda-unificada";
import { escreverRegistro } from "@/lib/escrita-protegida";

export function proximoTaskId(ids: string[]): string {
  let max = 0;
  for (const id of ids) {
    const m = id.match(/TSK-(\d+)/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `TSK-${String(max + 1).padStart(4, "0")}`;
}

export function tarefaConcluida(status?: string | null) {
  return (status || "").toUpperCase().includes("CONCLU");
}

export async function atualizarTarefa(
  taskId: string,
  patch: Record<string, unknown>,
  base?: TarefaRow,
): Promise<{ erro?: string; tarefa?: TarefaRow }> {
  const { data, error } = await escreverRegistro('tarefas', taskId, base?.row_version, patch);
  if (error) return { erro: error.message };
  return { tarefa: data as TarefaRow };
}

export async function concluirTarefa(t: TarefaRow) {
  return atualizarTarefa(t.task_id, { status: "CONCLUÍDA" }, t);
}

export async function concluirTarefaPorId(taskId: string) {
  const { data, error } = await supabase.from("tarefas").select("*").eq("task_id", taskId).maybeSingle();
  if (error) return { erro: error.message };
  if (!data) return { erro: "Tarefa não encontrada." };
  return concluirTarefa(data as TarefaRow);
}

export async function delegarTarefa(t: TarefaRow, responsavel: string) {
  const nome = responsavel.trim();
  if (!nome) return { erro: "Informe quem vai executar." };
  const status =
    tarefaConcluida(t.status) ? t.status : (t.status || "").toUpperCase().includes("ANDAMENTO") ? t.status : "EM ANDAMENTO";
  return atualizarTarefa(t.task_id, { responsavel: nome, status }, t);
}

export async function criarTarefaNova(opts: {
  task_id: string;
  business_id: string;
  tarefa: string;
  prazo?: string | null;
  responsavel?: string | null;
  prioridade?: string | null;
}) {
  const titulo = opts.tarefa.trim();
  if (!titulo) return { erro: "Descreva a tarefa." };
  const row = {
    task_id: opts.task_id,
    business_id: opts.business_id,
    tarefa: titulo,
    status: "NÃO INICIADA",
    prazo: opts.prazo || null,
    responsavel: opts.responsavel || null,
    prioridade: opts.prioridade || "MÉDIA",
    source_system: "HELENA",
  };
  const { data, error } = await supabase.from("tarefas").insert(row).select('*').single();
  if (error) return { erro: error.message };
  return { tarefa: data as TarefaRow };
}
