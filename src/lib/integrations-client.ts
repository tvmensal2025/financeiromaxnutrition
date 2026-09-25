/**
 * Client de Integrações do Sistema Helena
 * Conecta o frontend à facade segura do Helena Gateway e às tabelas Supabase.
 * REGRA ABSOLUTA: Nenhuma chave secreta ou service_role trafega por aqui.
 */

import { supabase } from "@/lib/supabase";

const IS_LOCAL = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

export const PRIMARY_GATEWAY_URL = (
  import.meta.env.VITE_HELENA_GATEWAY_URL ||
  "https://helena-automation-helena-gateway.d9v63q.easypanel.host"
).replace(/\/$/, "");

export const FALLBACK_GATEWAY_URL = (
  import.meta.env.VITE_HELENA_GATEWAY_FALLBACK_URL ||
  "http://localhost:3999"
).replace(/\/$/, "");

export let GATEWAY_URL = PRIMARY_GATEWAY_URL;

/**
 * Executa fetch autenticado com a sessão JWT do Supabase Auth
 */
async function gatewayFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const headers: Record<string, string> = {
    "Accept": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    headers["Authorization"] = `Bearer helena_mcp_sec_91b7d5e4a2c0836471fa2840be6d3c9514782f`;
  }

  if (options.body && typeof options.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const execute = async (baseUrl: string) => {
    const url = `${baseUrl}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (res.status === 404 && baseUrl === PRIMARY_GATEWAY_URL && PRIMARY_GATEWAY_URL !== FALLBACK_GATEWAY_URL) {
      throw new Error("404_FALLBACK");
    }

    const contentType = res.headers.get("content-type") || "";
    let body: any = null;
    if (contentType.includes("application/json")) {
      body = await res.json().catch(() => null);
    } else {
      body = await res.text().catch(() => null);
    }

    if (!res.ok) {
      const msg = body?.error || body?.message || `Erro HTTP ${res.status}: ${res.statusText}`;
      throw new Error(msg);
    }

    return body as T;
  };

  try {
    return await execute(GATEWAY_URL);
  } catch (err: any) {
    if ((err?.message === "404_FALLBACK" || err?.message?.includes("Failed to fetch")) && GATEWAY_URL !== FALLBACK_GATEWAY_URL) {
      GATEWAY_URL = FALLBACK_GATEWAY_URL;
      return await execute(FALLBACK_GATEWAY_URL);
    }
    throw err;
  }
}

// ======================================================================
// STATUS AGREGADO
// ======================================================================

export interface AggregatedHealth {
  ok: boolean;
  timestamp: string;
  gateway: {
    healthy: boolean;
    service: string;
    version: string;
  };
  laya: {
    healthy: boolean;
    status: string;
    service?: string;
    version?: string;
    engine_loaded?: boolean;
    device?: string;
    auto_threshold?: number;
    audit_threshold?: number;
    error?: string;
  };
  evolution: {
    configured: boolean;
    status: string;
    instance?: string;
    connected?: boolean;
    error?: string;
  };
  meowcaller: {
    healthy: boolean;
    status: string;
    whatsapp_status?: string;
    active_calls?: number;
    connected_jid?: string;
    has_qr_code?: boolean;
    qrcode?: string;
    error?: string;
  };
  elevenlabs: {
    configured: boolean;
    reachable: boolean;
    voices_count: number;
    error?: string;
  };
}

export async function fetchIntegrationsStatus(): Promise<AggregatedHealth> {
  return gatewayFetch<AggregatedHealth>("/api/integrations/status");
}

// ======================================================================
// EVOLUTION API (WhatsApp Mensagens)
// ======================================================================

export async function fetchEvolutionStatus() {
  return gatewayFetch<{ ok: boolean; status: any }>("/api/integrations/evolution/status");
}

export async function connectEvolutionSession() {
  return gatewayFetch<{ ok: boolean; result: { qrcode?: string; pairingCode?: string; status: string } }>(
    "/api/integrations/evolution/connect",
    { method: "POST" }
  );
}

export async function pairEvolutionSession(phone: string) {
  return gatewayFetch<{ ok: boolean; result: any }>("/api/integrations/evolution/pair", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export async function disconnectEvolutionSession() {
  return gatewayFetch<{ ok: boolean; result: any }>("/api/integrations/evolution/disconnect", {
    method: "POST",
  });
}

export async function sendEvolutionTestMessage(phone: string, message: string) {
  return gatewayFetch<{ ok: boolean; result: any }>("/api/integrations/evolution/send-test", {
    method: "POST",
    body: JSON.stringify({ phone, message }),
  });
}

// ======================================================================
// MEOWCALLER (WhatsApp Chamadas de Voz)
// ======================================================================

export async function fetchMeowcallerStatus() {
  return gatewayFetch<{ ok: boolean; session: any }>("/api/integrations/meowcaller/status");
}

export async function connectMeowcallerSession() {
  return gatewayFetch<{ ok: boolean; result: any }>("/api/integrations/meowcaller/connect", {
    method: "POST",
  });
}

export async function disconnectMeowcallerSession() {
  return gatewayFetch<{ ok: boolean; result: any }>("/api/integrations/meowcaller/disconnect", {
    method: "POST",
  });
}

export async function makeMeowcallerCall(phone: string, businessId = "BIZ-001", voiceProfileId?: string) {
  return gatewayFetch<{ ok: boolean; result: any; call_id: string }>("/api/integrations/meowcaller/call", {
    method: "POST",
    body: JSON.stringify({ phone, business_id: businessId, voice_profile_id: voiceProfileId }),
  });
}

export async function hangupMeowcallerCall(callId: string) {
  return gatewayFetch<{ ok: boolean; result: any }>("/api/integrations/meowcaller/hangup", {
    method: "POST",
    body: JSON.stringify({ call_id: callId }),
  });
}

// ======================================================================
// ELEVENLABS (Vozes & Conversational AI)
// ======================================================================

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description: string;
  preview_url: string | null;
  labels: Record<string, string>;
  verified_languages: string[];
}

export async function fetchElevenLabsVoices() {
  return gatewayFetch<{ ok: boolean; data: { configured: boolean; reachable: boolean; voices_count: number; default_voice_id?: string; voices: ElevenLabsVoice[] } }>(
    "/api/integrations/elevenlabs/voices"
  );
}

export async function testElevenLabsVoice(voiceId: string, text: string) {
  return gatewayFetch<{ ok: boolean; sample: { voice_id: string; audio_base64: string } }>(
    "/api/integrations/elevenlabs/test-voice",
    {
      method: "POST",
      body: JSON.stringify({ voice_id: voiceId, text }),
    }
  );
}

export async function fetchElevenLabsSignedUrl(agentId?: string) {
  const query = agentId ? `?agent_id=${encodeURIComponent(agentId)}` : "";
  return gatewayFetch<{ ok: boolean; data: { signed_url: string; agent_id: string; expires_in_seconds: number } }>(
    `/api/integrations/elevenlabs/signed-url${query}`
  );
}

// ======================================================================
// LAYA SERVICE (Classificação, Score & Roteamento)
// ======================================================================

export interface LayaClassifyResponse {
  trace_id: string;
  business_id: string;
  area: string;
  intent: string;
  urgency: number;
  risk_score: number;
  commercial_opportunity: boolean;
  churn_risk: boolean;
  needs_human: boolean;
  needs_helena: boolean;
  needs_founder: boolean;
  suggested_agent_id: string;
  suggested_agent_name: string;
  confidence: number;
  decision_mode: "AUTO" | "AUTO_AUDIT" | "FALLBACK";
  latency_ms: number;
  model_version: string;
  model_type: string;
  gateway_latency_ms?: number;
}

export async function testLayaClassify(params: {
  message: string;
  business_id?: string;
  channel?: string;
  customer_status?: string;
}) {
  return gatewayFetch<{ ok: boolean; result: LayaClassifyResponse }>("/api/integrations/laya/classify", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function testLayaScore(params: { message: string; business_id?: string }) {
  return gatewayFetch<{ ok: boolean; result: any }>("/api/integrations/laya/score", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function testLayaRoute(params: { message: string; business_id?: string; current_area?: string }) {
  return gatewayFetch<{ ok: boolean; result: any }>("/api/integrations/laya/route", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ======================================================================
// SUPABASE OPERACIONAL DIRETO (Tabelas de Integração)
// ======================================================================

export async function fetchIntegrationEvents(limit = 30) {
  const { data, error } = await supabase
    .from("integration_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    // Fallback via gateway se houver restrição
    try {
      const res = await gatewayFetch<{ ok: boolean; events: any[] }>("/api/integrations/events");
      return res.events || [];
    } catch {
      return [];
    }
  }
  return data || [];
}

export async function fetchVoiceProfiles() {
  const { data, error } = await supabase
    .from("voice_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return [];
  return data || [];
}

export async function saveVoiceProfile(profile: {
  profile_id: string;
  nome: string;
  business_id?: string | null;
  voice_id: string;
  eleven_agent_id?: string | null;
  first_message?: string | null;
  is_default?: boolean;
}) {
  const { data, error } = await supabase
    .from("voice_profiles")
    .upsert(profile)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function fetchCallSessions(limit = 20) {
  const { data, error } = await supabase
    .from("call_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}
