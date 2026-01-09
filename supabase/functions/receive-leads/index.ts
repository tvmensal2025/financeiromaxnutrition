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

    // Helper para limpar strings vazias
    const cleanString = (val: any): string | null => {
      if (val === null || val === undefined) return null;
      const str = String(val).trim();
      return str.length > 0 ? str : null;
    };

    // Detectar formato do payload
    const hasContactNested = !!payload.contact;
    const hasOldNested = !!payload.lead;
    const isFlat = !hasContactNested && !hasOldNested;

    console.log("Formato detectado:", hasContactNested ? "CONTACT_NESTED" : hasOldNested ? "OLD_NESTED" : "FLAT");

    // Extrair dados de forma normalizada (tentando múltiplos caminhos)
    const contact = payload.contact || {};
    const lead = payload.lead || {};
    const profile = payload.profile || {};
    const location = payload.location || {};
    const healthData = payload.health_data || {};
    const healthProfile = payload.health_profile || {};
    const engagement = payload.engagement || {};

    // Full name: tentar múltiplos caminhos
    let fullName = cleanString(
      payload.full_name || 
      contact.full_name || 
      lead.full_name ||
      (contact.first_name && contact.last_name ? `${contact.first_name} ${contact.last_name}` : null) ||
      (payload.first_name && payload.last_name ? `${payload.first_name} ${payload.last_name}` : null)
    );

    // First/Last name
    let firstName = cleanString(
      payload.first_name || 
      contact.first_name || 
      lead.first_name ||
      fullName?.split(' ')[0]
    );
    
    let lastName = cleanString(
      payload.last_name || 
      contact.last_name || 
      lead.last_name ||
      fullName?.split(' ').slice(1).join(' ')
    );

    // Se não temos full_name mas temos first/last, montar
    if (!fullName && (firstName || lastName)) {
      fullName = [firstName, lastName].filter(Boolean).join(' ') || null;
    }

    // Email
    const email = cleanString(
      payload.email || 
      contact.email || 
      lead.email
    );

    // Phone
    const phone = cleanString(
      payload.phone || 
      contact.phone || 
      lead.phone
    );

    // Location
    const city = cleanString(
      payload.city || 
      location.city || 
      lead.city
    );
    
    const state = cleanString(
      payload.state || 
      location.state || 
      lead.state
    );

    // Profile data
    const gender = cleanString(
      payload.gender || 
      profile.gender || 
      lead.gender
    );
    
    const birthDate = cleanString(
      payload.birth_date || 
      profile.birth_date || 
      lead.birth_date
    );

    // Health data
    const heightCm = payload.height || payload.height_cm || 
      healthData.height_cm || healthProfile.height_cm || null;
    
    const currentWeightKg = payload.current_weight || payload.current_weight_kg || 
      healthData.current_weight_kg || healthProfile.current_weight_kg || null;
    
    const targetWeightKg = payload.target_weight || payload.target_weight_kg || 
      healthData.target_weight_kg || healthProfile.target_weight_kg || null;
    
    const activityLevel = cleanString(
      payload.activity_level || 
      healthData.activity_level || 
      healthProfile.activity_level
    );
    
    const fitnessLevel = cleanString(
      payload.fitness_level || 
      healthData.fitness_level || 
      healthProfile.fitness_level
    );

    // Engagement
    const points = payload.points || engagement.points || 0;
    
    const signupDate = cleanString(
      payload.created_at || 
      payload.signup_date || 
      engagement.registered_at || 
      engagement.signup_date ||
      payload.timestamp
    );

    // External user ID
    const externalUserId = cleanString(
      payload.id || 
      payload.user_id || 
      contact.id ||
      contact.user_id ||
      lead.user_id
    );

    // Source
    const source = cleanString(payload.source) || 'external';

    // Event type
    const eventType = cleanString(
      payload.event || 
      payload.event_type
    ) || 'lead.created';

    const leadData = {
      source,
      external_user_id: externalUserId,
      event_type: eventType,
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      city,
      state,
      birth_date: birthDate,
      gender,
      height_cm: heightCm,
      current_weight_kg: currentWeightKg,
      target_weight_kg: targetWeightKg,
      activity_level: activityLevel,
      fitness_level: fitnessLevel,
      points,
      signup_date: signupDate,
      stage: 'new',
      raw_payload: payload,
    };

    console.log("Lead normalizado:", JSON.stringify(leadData, null, 2));

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
