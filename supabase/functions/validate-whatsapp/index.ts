import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get business info for Evolution API
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .single();

    if (!profile?.business_id) {
      throw new Error('Business not found');
    }

    const { data: business } = await supabaseClient
      .from('businesses')
      .select('evolution_instance')
      .eq('id', profile.business_id)
      .single();

    if (!business?.evolution_instance) {
      throw new Error('WhatsApp instance not configured');
    }

    const { phones } = await req.json();

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      throw new Error('Invalid phones array');
    }

    if (phones.length > 100) {
      throw new Error('Maximum 100 phones per request');
    }

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Evolution API not configured');
    }

    // Validate numbers using Evolution API
    const results = await Promise.all(
      phones.map(async (phone: string) => {
        try {
          const response = await fetch(
            `${evolutionApiUrl}/chat/whatsappNumbers/${business.evolution_instance}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionApiKey,
              },
              body: JSON.stringify({
                numbers: [phone],
              }),
            }
          );

          if (!response.ok) {
            return { phone, isValid: false, exists: false };
          }

          const data = await response.json();
          const result = data[0];

          return {
            phone,
            isValid: true,
            exists: result?.exists || false,
            jid: result?.jid || null,
          };
        } catch (error) {
          console.error(`Error validating ${phone}:`, error);
          return { phone, isValid: false, exists: false };
        }
      })
    );

    return new Response(
      JSON.stringify({ results }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
