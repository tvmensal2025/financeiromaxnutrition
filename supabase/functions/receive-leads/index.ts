import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validar método
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Método não permitido" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar secret (opcional mas recomendado)
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET_KEY");
    
    if (expectedSecret && webhookSecret !== expectedSecret) {
      console.error("Secret inválido recebido");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse do payload
    const payload = await req.json();
    console.log("Lead recebido:", JSON.stringify(payload, null, 2));

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extrair dados do payload
    const lead = payload.lead || {};
    const healthProfile = payload.health_profile || {};
    const engagement = payload.engagement || {};

    // Inserir na tabela
    const { data, error } = await supabase.from("leads_externos").insert({
      source: payload.source || "mission-health-nexus",
      external_user_id: lead.user_id,
      event_type: payload.event,
      full_name: lead.full_name,
      email: lead.email,
      phone: lead.phone,
      city: lead.city,
      state: lead.state,
      birth_date: lead.birth_date,
      gender: lead.gender,
      height_cm: healthProfile.height_cm,
      current_weight_kg: healthProfile.current_weight_kg,
      target_weight_kg: healthProfile.target_weight_kg,
      activity_level: healthProfile.activity_level,
      fitness_level: healthProfile.fitness_level,
      points: engagement.points,
      signup_date: engagement.signup_date,
      raw_payload: payload,
    }).select().single();

    if (error) {
      console.error("Erro ao salvar lead:", error);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar lead", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Lead salvo com sucesso:", data.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Lead recebido com sucesso",
        lead_id: data.id 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro no webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: "Erro interno", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
