import { supabase } from "@/lib/supabase";
import { ehConflitoDeVersao } from "@/lib/escrita-protegida";
import type { TarefaRow } from "@/lib/agenda-unificada";

export async function sincronizarTarefaNoCalendario(t: TarefaRow) {
  if (!t.row_version) return "Recarregue a tarefa antes de sincronizar a agenda.";
  const { error } = await supabase.rpc("helena_sync_calendar", {
    p_source: "tarefas", p_id: t.task_id, p_expected_version: t.row_version,
  });
  return ehConflitoDeVersao(error?.code) ? "A tarefa mudou; releia antes de sincronizar." : error?.message || "";
}

