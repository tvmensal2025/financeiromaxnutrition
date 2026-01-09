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

    // Detectar formato: plano (maxnutrition) ou aninhado (antigo)
    const isFlat = !!(payload.full_name || payload.email || payload.id) && !payload.lead;

    let leadData;

    if (isFlat) {
      // Formato plano (maxnutrition-app e similares)
      console.log("Formato detectado: PLANO");
      
      const firstName = payload.first_name || payload.full_name?.split(' ')[0] || null;
      const lastName = payload.last_name || payload.full_name?.split(' ').slice(1).join(' ') || null;

      leadData = {
        source: payload.source || 'external',
        external_user_id: payload.id || payload.user_id || null,
        event_type: payload.event || payload.event_type || 'lead.created',
        full_name: payload.full_name || null,
        first_name: firstName,
        last_name: lastName,
        email: payload.email || null,
        phone: payload.phone || null,
        city: payload.city || null,
        state: payload.state || null,
        birth_date: payload.birth_date || null,
        gender: payload.gender || null,
        height_cm: payload.height || payload.height_cm || null,
        current_weight_kg: payload.current_weight || payload.current_weight_kg || null,
        target_weight_kg: payload.target_weight || payload.target_weight_kg || null,
        activity_level: payload.activity_level || null,
        fitness_level: payload.fitness_level || null,
        points: payload.points || 0,
        signup_date: payload.created_at || payload.signup_date || null,
        stage: 'new',
        raw_payload: payload,
      };
    } else {
      // Formato aninhado (antigo)
      console.log("Formato detectado: ANINHADO");
      
      const lead = payload.lead || {};
      const healthProfile = payload.health_profile || {};
      const engagement = payload.engagement || {};

      const firstName = lead.full_name?.split(' ')[0] || null;
      const lastName = lead.full_name?.split(' ').slice(1).join(' ') || null;

      leadData = {
        source: payload.source || "webhook",
        external_user_id: lead.user_id || null,
        event_type: payload.event || null,
        full_name: lead.full_name || null,
        first_name: firstName,
        last_name: lastName,
        email: lead.email || null,
        phone: lead.phone || null,
        city: lead.city || null,
        state: lead.state || null,
        birth_date: lead.birth_date || null,
        gender: lead.gender || null,
        height_cm: healthProfile.height_cm || null,
        current_weight_kg: healthProfile.current_weight_kg || null,
        target_weight_kg: healthProfile.target_weight_kg || null,
        activity_level: healthProfile.activity_level || null,
        fitness_level: healthProfile.fitness_level || null,
        points: engagement.points || 0,
        signup_date: engagement.signup_date || null,
        stage: 'new',
        raw_payload: payload,
      };
    }

    // Inserir na tabela
    const { data, error } = await supabase
      .from("leads_externos")
      .insert(leadData)
      .select()
      .single();

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
        lead_id: data.id,
        stage: data.stage
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
