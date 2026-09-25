import { supabase } from "@/lib/supabase";

export type EventoAgenda = {
  event_id: string;
  business_id: string;
  tipo?: string | null;
  titulo: string;
  descricao?: string | null;
  inicio?: string | null;
  fim?: string | null;
  status?: string | null;
  related_object_type?: string | null;
  related_object_id?: string | null;
  origem: "calendario" | "tarefa";
};

export type TarefaRow = {
  task_id: string;
  business_id: string;
  tarefa: string;
  status?: string | null;
  prazo?: string | null;
  occurrence_date?: string | null;
  bloqueio?: string | null;
  prioridade?: string | null;
  created_at?: string | null;
};

export function parseDataAgenda(valor?: string | null) {
  if (!valor) return null;
  const texto = valor.trim();
  if (!texto) return null;
  const iso = texto.length <= 10 ? `${texto}T09:00:00` : texto;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function diaIso(valor?: string | null) {
  if (!valor) return null;
  const texto = valor.trim();
  const iso = texto.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

export function dataEfetivaTarefa(t: TarefaRow) {
  return diaIso(t.prazo) || diaIso(t.occurrence_date) || diaIso(t.created_at);
}

export function tarefaParaEvento(t: TarefaRow): EventoAgenda | null {
  const dia = dataEfetivaTarefa(t);
  if (!dia) return null;
  const semPrazo = !diaIso(t.prazo) && !diaIso(t.occurrence_date);
  return {
    event_id: `EVT-TSK-${t.task_id}`,
    business_id: t.business_id,
    tipo: "TAREFA",
    titulo: t.tarefa,
    descricao: [t.status, t.bloqueio, semPrazo ? "Sem prazo — usando data de referência" : null]
      .filter(Boolean)
      .join(" · "),
    inicio: `${dia}T09:00:00`,
    fim: `${dia}T10:00:00`,
    status: t.status,
    related_object_type: "tarefas",
    related_object_id: t.task_id,
    origem: "tarefa",
  };
}

export async function carregarAgenda(selecionadas: string[], todasLigadas: boolean) {
  let qCal = supabase.from("calendario").select("*").order("inicio");
  let qTsk = supabase.from("tarefas").select(
    "task_id,business_id,tarefa,status,prazo,occurrence_date,bloqueio,prioridade,created_at",
  );
  if (!todasLigadas && selecionadas.length) {
    qCal = qCal.in("business_id", selecionadas);
    qTsk = qTsk.in("business_id", selecionadas);
  }
  const [cal, tsk] = await Promise.all([qCal, qTsk]);
  const erro = cal.error || tsk.error;

  const doCalendario = ((cal.data || []) as EventoAgenda[]).map((e) => ({
    ...e,
    origem: "calendario" as const,
  }));

  const idsCalendarioTarefa = new Set(
    doCalendario.filter((e) => e.related_object_type === "tarefas" && e.related_object_id).map((e) => e.related_object_id),
  );

  const tarefas = (tsk.data || []) as TarefaRow[];
  const semData: TarefaRow[] = [];
  const doTarefas: EventoAgenda[] = [];

  for (const t of tarefas) {
    if (idsCalendarioTarefa.has(t.task_id)) continue;
    const ev = tarefaParaEvento(t);
    if (ev) doTarefas.push(ev);
    else semData.push(t);
  }

  const eventos = [...doCalendario, ...doTarefas];
  const ehPermissao = erro && /permission denied|jwt|unauthorized|not allowed/i.test(erro.message);
  return { eventos, semData, erro: ehPermissao ? "" : erro?.message || "" };
}
