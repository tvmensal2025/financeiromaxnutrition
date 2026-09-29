import { supabase } from "@/lib/supabase";

export type UraConfig = {
  auto_answer: boolean;
  greeting: string;
  filter: "all" | "registered" | "leads";
  schedule: "24h" | "commercial";
  transfer_phone: string;
};
export type UraCarregada = UraConfig & { voice?: { id: string; provider: string } };
export const URA_PADRAO: UraConfig = {
  auto_answer: false,
  greeting: "Olá! Eu sou a Helena, sua assistente. Como posso ajudar?",
  filter: "all", schedule: "commercial", transfer_phone: "",
};
function profileId(businessId: string) {
  if (!/^BIZ-[A-Za-z0-9-]+$/.test(businessId)) throw new Error("Selecione uma empresa para configurar a URA.");
  return `VP-URA-${businessId}`;
}
export async function carregarUra(businessId: string): Promise<UraCarregada | null> {
  const { data, error } = await supabase.from("voice_profiles")
    .select("settings,first_message,provider,voice_id").eq("profile_id", profileId(businessId)).eq("business_id", businessId).maybeSingle();
  if (error) throw new Error("Não foi possível ler a configuração da URA no Supabase.");
  if (!data) return null;
  return {
    ...URA_PADRAO, ...data.settings?.ura,
    greeting: data.first_message ?? URA_PADRAO.greeting,
    voice: data.voice_id ? { id: data.voice_id, provider: data.provider } : undefined,
  };
}
export async function salvarUra(businessId: string, config: UraConfig, voz: { id: string; provider: "KOKORO" | "ELEVENLABS" }) {
  const id = profileId(businessId);
  if (!voz.id) throw new Error("Selecione a voz antes de salvar.");
  const { data: anterior, error: leituraErro } = await supabase.from("voice_profiles")
    .select("settings").eq("profile_id", id).eq("business_id", businessId).maybeSingle();
  if (leituraErro) throw new Error("Não foi possível verificar a configuração anterior.");
  const { data, error } = await supabase.from("voice_profiles").upsert({
    profile_id: id, nome: `Configuração URA · ${businessId}`, business_id: businessId,
    provider: voz.provider, voice_id: voz.id, first_message: config.greeting,
    is_default: false, enabled: true,
    settings: { ...(anterior?.settings ?? {}), ura: config }, updated_at: new Date().toISOString(),
  }, { onConflict: "profile_id" }).select("profile_id,business_id").single();
  if (error || data?.profile_id !== id || data?.business_id !== businessId) throw new Error("O Supabase não confirmou a gravação da URA.");
  return data;
}
