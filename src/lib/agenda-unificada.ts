import { lerPaginas } from "@/lib/leitura-paginada";
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
  row_version?: number | string;
  task_id: string;
  business_id: string;
  tarefa: string;
  responsavel?: string | null;
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
  return diaIso(t.prazo) || diaIso(t.occurrence_date);
}

export function tarefaParaEvento(t: TarefaRow): EventoAgenda | null {
  const dia = dataEfetivaTarefa(t);
  if (!dia) return null;
  return {
    event_id: `EVT-TSK-${t.task_id}`,
    business_id: t.business_id,
    tipo: "TAREFA",
    titulo: t.tarefa,
    descricao: [t.status, t.bloqueio]
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

export async function carregarAgenda(selecionadas: string[], _todasLigadas: boolean, signal?: AbortSignal) {
  if (!selecionadas.length) return { eventos: [], semData: [], erro: "" };
  const [cal, tsk] = await Promise.all([
    lerPaginas<Omit<EventoAgenda, 'origem'>>((inicio, fim) => {
      const query = supabase.from("calendario")
        .select("event_id,business_id,tipo,titulo,descricao,inicio,fim,status,related_object_type,related_object_id", { count: "exact" })
        .in("business_id", selecionadas);
      const page = query.order("event_id").range(inicio, fim);
      return signal ? page.abortSignal(signal) : page;
    }, signal),
    lerPaginas<TarefaRow>((inicio, fim) => {
      const query = supabase.from("tarefas")
        .select("task_id,business_id,tarefa,responsavel,status,prazo,occurrence_date,bloqueio,prioridade,row_version", { count: "exact" })
        .in("business_id", selecionadas);
      const page = query.order("task_id").range(inicio, fim);
      return signal ? page.abortSignal(signal) : page;
    }, signal),
  ]);
  if (cal.error || tsk.error) return { eventos: [], semData: [], erro: "Não foi possível consultar a agenda completa. Atualize para tentar novamente." };

  const doCalendario = (cal.data || []).map((e) => ({
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
  return { eventos, semData, erro: "" };
}
