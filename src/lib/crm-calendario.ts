import { supabase } from "@/lib/supabase";

// Toda projeção lê a fonte atual sob lock. Nunca publica um payload antigo do navegador.
export async function sincronizarEventosCrm(op: {
  opportunity_id: string; row_version?: number | string;
}) {
  if (!op.row_version) return "Recarregue a oportunidade antes de sincronizar a agenda.";
  const { error } = await supabase.rpc("helena_sync_calendar", {
    p_source: "crm", p_id: op.opportunity_id, p_expected_version: op.row_version,
  });
  return error?.code === "40001" ? "A oportunidade mudou; releia antes de sincronizar." : error?.message || "";
}
