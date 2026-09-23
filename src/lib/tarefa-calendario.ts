import { supabase } from "@/lib/supabase";
import { dataEfetivaTarefa, type TarefaRow } from "@/lib/agenda-unificada";

export async function sincronizarTarefaNoCalendario(t: TarefaRow) {
  const dia = dataEfetivaTarefa(t);
  const eventId = `EVT-TSK-${t.task_id}`;
  if (!dia) {
    await supabase.from("calendario").delete().eq("event_id", eventId);
    return;
  }
  await supabase.from("calendario").upsert({
    event_id: eventId,
    business_id: t.business_id,
    tipo: "TAREFA",
    titulo: t.tarefa,
    descricao: [t.status, t.prioridade, t.bloqueio].filter(Boolean).join(" · "),
    inicio: `${dia}T09:00:00`,
    fim: `${dia}T10:00:00`,
    status: t.status || "ABERTO",
    related_object_type: "tarefas",
    related_object_id: t.task_id,
    source_system: "HELENA",
  });
}

export async function sincronizarTodasTarefasNoCalendario(selecionadas: string[], todasLigadas: boolean) {
  let q = supabase.from("tarefas").select(
    "task_id,business_id,tarefa,status,prazo,occurrence_date,bloqueio,prioridade,created_at",
  );
  if (!todasLigadas && selecionadas.length) q = q.in("business_id", selecionadas);
  const { data, error } = await q;
  if (error) return error.message;
  for (const row of (data || []) as TarefaRow[]) {
    await sincronizarTarefaNoCalendario(row);
  }
  return "";
}
