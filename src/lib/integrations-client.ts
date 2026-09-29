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

  if (!token) throw new Error("Sessão autenticada necessária para consultar as integrações.");
  headers["Authorization"] = `Bearer ${token}`;

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
    is_official?: boolean;
    status?: string;
    error?: string;
  };
  kokoro?: {
    configured: boolean;
    is_official: boolean;
    provider: string;
    default_voice: string;
    default_profile_id: string;
    official_agent: string;
    voices_count: number;
    status: string;
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
  return gatewayFetch<{ ok: boolean; result: any; session?: any }>("/api/integrations/meowcaller/connect", {
    method: "POST",
  });
}

export async function pairMeowcallerPhone(phone: string) {
  return gatewayFetch<{ ok: boolean; result: { pairing_code: string; phone: string; message: string } }>(
    "/api/integrations/meowcaller/pair-phone",
    {
      method: "POST",
      body: JSON.stringify({ phone }),
    }
  );
}

export async function disconnectMeowcallerSession() {
  return gatewayFetch<{ ok: boolean; result: any }>("/api/integrations/meowcaller/disconnect", {
    method: "POST",
  });
}

export async function makeMeowcallerCall(phone: string, businessId = "BIZ-001", voiceProfileId?: string) {
  return gatewayFetch<{ ok: boolean; result: any; call_id: string | null; tracking_status: string; warning?: string }>("/api/integrations/meowcaller/call", {
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
// KOKORO NEURAL TTS (Motor Oficial de Voz do Sistema Helena)
// ======================================================================

export interface KokoroVoice {
  voice_id: string;
  profile_id?: string;
  name: string;
  gender: "male" | "female";
  lang: string;
  is_official?: boolean;
  is_default?: boolean;
  agent_id?: string;
}

export interface KokoroVoicesResponse {
  configured: boolean;
  is_official_engine: boolean;
  provider: string;
  baseUrl: string;
  default_model: string;
  default_voice_id: string;
  default_profile_id: string;
  official_voice: KokoroVoice;
  voices_pt_br: KokoroVoice[];
  voices_en: KokoroVoice[];
}

export async function fetchKokoroVoices() {
  return gatewayFetch<{ ok: boolean; data: KokoroVoicesResponse }>("/api/integrations/kokoro/voices");
}

export async function testKokoroVoice(voiceId: string, text?: string) {
  return gatewayFetch<{
    ok: boolean;
    sample: {
      voice_id: string;
      mime_type: string;
      audio_base64: string;
      duration_ms: number;
      size_bytes: number;
    };
  }>("/api/integrations/kokoro/test-voice", {
    method: "POST",
    body: JSON.stringify({ voice_id: voiceId, text }),
  });
}

export async function synthesizeVoiceSpeech(text: string, voiceId?: string) {
  return gatewayFetch<{
    ok: boolean;
    engine: string;
    official: boolean;
    voice_id: string;
    duration_ms: number;
    size_bytes: number;
    mime_type: string;
    audio_base64: string;
  }>("/api/integrations/voice/speak", {
    method: "POST",
    body: JSON.stringify({ text, voice_id: voiceId }),
  });
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

export interface VoiceAgentConfig {
  agent_name: string;
  persona: string;
  knowledge_base: string;
  inbound_greeting: string;
  outbound_greeting: string;
  voice_profile_id?: string;
  kokoro_voice?: string;
  ai_provider?: string;
  ai_model?: string;
  ai_api_key?: string;
  has_deepseek_key?: boolean;
  is_active: boolean;
  updated_at?: string;
}

export async function fetchVoiceAgentSettings(): Promise<VoiceAgentConfig> {
  const res = await gatewayFetch<{ ok: boolean; config: VoiceAgentConfig }>("/api/integrations/voice-agent/settings");
  return res.config;
}

export async function updateVoiceAgentSettings(settings: Partial<VoiceAgentConfig>): Promise<VoiceAgentConfig> {
  const res = await gatewayFetch<{ ok: boolean; result: { ok: boolean; config: VoiceAgentConfig } }>(
    "/api/integrations/voice-agent/settings",
    {
      method: "POST",
      body: JSON.stringify(settings),
    }
  );
  return res.result.config;
}

export async function testVoiceAgentDialogue(prompt: string, voice?: string): Promise<{
  ok: boolean;
  prompt: string;
  response_text: string;
  audio_url: string;
  voice_id: string;
}> {
  return await gatewayFetch("/api/integrations/voice-agent/test-dialogue", {
    method: "POST",
    body: JSON.stringify({ prompt, voice }),
  });
}

export async function playVoiceAgentGreeting(callId: string, text?: string, voice?: string) {
  return await gatewayFetch("/api/integrations/voice-agent/play-greeting", {
    method: "POST",
    body: JSON.stringify({ call_id: callId, text, voice }),
  });
}

export const DEFAULT_MAX_KNOWLEDGE_BASE = `===============================================================================
CATÁLOGO OFICIAL DE PRODUTOS, SERVIÇOS & REGRAS COMERCIAIS — MAX NUTRITION
===============================================================================

1. PROTEÍNAS E CONSTRUÇÃO MUSCULAR:
- 100% Whey Protein Concentrado (900g e 1.8kg):
  * 24g de proteína de alto valor biológico e 5.4g de BCAAs por dose.
  * Sabores: Chocolate Belga, Baunilha Bourbon, Morango Silvestre, Cookies & Cream, Banana Flambada e Doce de Leite.
  * Indicação: Ganho de massa muscular magra, recuperação pós-treino e suporte proteico diário.
- Iso Whey 100% Isolado (900g):
  * Microfiltrado por fluxo cruzado (CFM), zero lactose, zero açúcar, zero gordura e zero glúten.
  * 27g de proteína pura por dose.
  * Sabores: Chocolate Puro, Baunilha Suave e Morango.
  * Indicação: Definição muscular, perda de gordura e intolerância severa à lactose.
- 3W Whey Protein Blend (900g):
  * Mistura sinérgica de Concentrado, Isolado e Hidrolisado para absorção gradual.

2. FORÇA, POTÊNCIA & PERFORMANCE MÁXIMA:
- Creatina Monohidratada 100% Pura Micronizada (300g e 500g):
  * 100% pura, grau farmacêutico, sem sabor, dissolução instantânea.
  * Benefícios: Aumento de força explosiva, resistência em treinos intensos, volume muscular e melhora cognitiva.
  * Como tomar: 3g a 5g ao dia, todos os dias, de preferência com uma fonte de carboidrato.
- Creatina Creapure (300g):
  * Matéria-prima com selo Creapure importada da Alemanha, máxima pureza e rastreabilidade mundial.
- Pré-Treino Hórus (300g):
  * Fórmula completa: 2000mg Beta-Alanina, 200mg Cafeína, 1000mg Arginina e 1000mg Taurina.
  * Efeito: Foco mental afiado, vasodilatação e redução de fadiga. Sabores: Frutas Vermelhas, Citrus Ice, Algodão Doce.
- Pré-Treino Panic Extreme (300g):
  * Alta dosagem para atletas avançados (400mg cafeína por dose).

3. RECUPERAÇÃO, IMUNIDADE & SAÚDE INTEGRAL:
- Glutamina Pura 100% (300g): Imunidade e recuperação da mucosa intestinal.
- BCAA 2:1:1 e 8:1:1 (Pó 300g e cápsulas): Recuperação muscular anti-catabólica.
- Multivitamínico Mega Vita A-Z (90 cápsulas): 23 vitaminas e minerais essenciais.
- Ômega 3 Ultra Concentrado (120 cápsulas): Rico em EPA e DHA, ação anti-inflamatória e saúde cardiovascular.

4. SNACKS, PASTAS & ALIMENTAÇÃO SAUDÁVEL:
- Pasta de Amendoim Integral 1kg (Tradicional, Chocowhey, Cookies & Cream, Crocante): Zero adição de açúcar.
- Protein Crisp Bar (Caixa com 12 barras): 15g de proteína por barra, deliciosa e prática.

5. POLÍTICAS COMERCIAIS, PAGAMENTO & FRETE:
- Formas de Pagamento:
  * Pix com 5% de desconto imediato à vista.
  * Cartão de Crédito em até 12x sem juros.
  * Boleto Bancário à vista.
- Frete e Prazos de Entrega:
  * FRETE GRÁTIS para todo o Brasil em compras acima de R$ 199,00.
  * Despacho em até 24 horas úteis com código de rastreamento enviado via WhatsApp.
- Garantia & Políticas de Troca:
  * 7 dias corridos para devolução ou troca por arrependimento incondicional.
  * 30 dias para qualquer defeito de fabricação ou avaria de transporte.
- Programa de Assinatura (Clube Max):
  * 15% de desconto perpétuo em todos os suplementos da assinatura mensal com entrega programada.`;

export const DEFAULT_AGENT_PERSONA = `Você é o Pedro, o consultor e atendente oficial de voz e vendas da Max Nutrition pelo WhatsApp VoIP.
Você está conversando por TELEFONE/VOZ em tempo real com o cliente.

DIRETRIZES DE PERSONALIDADE & VOZ:
1. Tom de Voz: Jovem, dinâmico, enérgico, seguro, prestativo e cordial. Fale com naturalidade brasileira ("Olá!", "Com certeza!", "Perfeito!", "Excelente escolha!").
2. Objetividade Telefônica: NUNCA faça respostas longas. Fale no MÁXIMO 2 ou 3 frases por intervenção (entre 15 e 40 palavras). Em ligações, o cliente quer respostas rápidas e diretas ao ponto.
3. Formato Limpo para Fala (TTS): NUNCA utilize asteriscos (* ou **), hashtags (#), travessões, listas pontuadas ou emojis no texto, pois o texto será falado pelo sintetizador neural de voz.
4. Condução da Conversa: Sempre responda à dúvida do cliente usando a Base de Conhecimento e termine convidando o cliente a avançar (ex: "Quer que eu separe o seu pedido agora?", "Qual sabor você prefere no Whey?").
5. Confiança e Precisão: Forneça informações exatas de preços, frete grátis acima de R$ 199 e pagamento via Pix com 5% de desconto.`;


