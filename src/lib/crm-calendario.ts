import { supabase } from "@/lib/supabase";

type CrmCal = {
  opportunity_id: string;
  business_id: string;
  empresa_lead: string;
  proxima_acao?: string | null;
  data_proxima_acao?: string | null;
  fechamento_previsto?: string | null;
};

function dia(iso?: string | null) {
  if (!iso) return null;
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

export async function sincronizarEventosCrm(op: CrmCal) {
  const eventIdBase = `EVT-CRM-${op.opportunity_id}`;
  const prox = dia(op.data_proxima_acao);
  const fecha = dia(op.fechamento_previsto);

  if (prox) {
    await supabase.from("calendario").upsert({
      event_id: `${eventIdBase}-PROX`,
      business_id: op.business_id,
      tipo: "CRM",
      titulo: `Follow-up: ${op.empresa_lead}`,
      descricao: op.proxima_acao || "Próxima ação do pipeline",
      inicio: `${prox}T09:00:00`,
      fim: `${prox}T10:00:00`,
      related_object_type: "crm",
      related_object_id: op.opportunity_id,
      source_system: "HELENA",
      status: "ABERTO",
    });
  }

  if (fecha) {
    await supabase.from("calendario").upsert({
      event_id: `${eventIdBase}-FECH`,
      business_id: op.business_id,
      tipo: "CRM",
      titulo: `Previsão fechamento: ${op.empresa_lead}`,
      descricao: op.proxima_acao || "Data prevista de fechamento",
      inicio: `${fecha}T14:00:00`,
      fim: `${fecha}T15:00:00`,
      related_object_type: "crm",
      related_object_id: op.opportunity_id,
      source_system: "HELENA",
      status: "ABERTO",
    });
  }
}
