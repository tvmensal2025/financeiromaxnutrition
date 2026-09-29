import { supabase } from "@/lib/supabase";
import type { TarefaRow } from "@/lib/agenda-unificada";

export async function sincronizarTarefaNoCalendario(t: TarefaRow) {
  if (!t.row_version) return "Recarregue a tarefa antes de sincronizar a agenda.";
  const { error } = await supabase.rpc("helena_sync_calendar", {
    p_source: "tarefas", p_id: t.task_id, p_expected_version: t.row_version,
  });
  return error?.code === "40001" ? "A tarefa mudou; releia antes de sincronizar." : error?.message || "";
}

export async function sincronizarTodasTarefasNoCalendario(selecionadas: string[], todasLigadas: boolean) {
  let q = supabase.from("tarefas").select("task_id,business_id,row_version");
  if (!todasLigadas && selecionadas.length) q = q.in("business_id", selecionadas);
  const { data, error } = await q;
  if (error) return error.message;
  for (const row of (data || []) as TarefaRow[]) {
    const falha = await sincronizarTarefaNoCalendario(row);
    if (falha) return falha;
  }
  return "";
}
