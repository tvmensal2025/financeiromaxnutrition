import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessageRequest {
  phone: string;
  message: string;
  business_id: string;
  lead_id?: string;
  customer_id?: string;
  instance?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error('Evolution API credentials not configured');
      return new Response(JSON.stringify({ error: 'Evolution API not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SendMessageRequest = await req.json();
    const { phone, message, business_id, lead_id, customer_id, instance } = body;

    if (!phone || !message || !business_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: phone, message, business_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean phone number (keep only digits)
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Determine instance name - use configured evolution_instance or fallback to provided instance or 'default'
    let instanceName = instance;
    if (!instanceName) {
      const { data: businessData } = await supabase
        .from('businesses')
        .select('evolution_instance, slug')
        .eq('id', business_id)
        .single();
      instanceName = businessData?.evolution_instance || 'default';
    }

    // Save outbound message first
    const { data: savedMessage, error: saveError } = await supabase
      .from('whatsapp_messages')
      .insert({
        business_id,
        lead_id,
        customer_id,
        phone: cleanPhone,
        message,
        direction: 'outbound',
        status: 'pending',
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving message:', saveError);
      return new Response(JSON.stringify({ error: 'Failed to save message' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send message via Evolution API
    const evolutionUrl = `${evolutionApiUrl}/message/sendText/${instanceName}`;
    console.log('Sending to Evolution API:', evolutionUrl);

    const evolutionResponse = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: message,
      }),
    });

    const evolutionResult = await evolutionResponse.json();
    console.log('Evolution API response:', evolutionResult);

    if (!evolutionResponse.ok) {
      // Update message status to failed
      await supabase
        .from('whatsapp_messages')
        .update({ status: 'failed' })
        .eq('id', savedMessage.id);

      return new Response(JSON.stringify({ 
        error: 'Failed to send message via Evolution API',
        details: evolutionResult
      }), {
        status: evolutionResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update message status to sent
    await supabase
      .from('whatsapp_messages')
      .update({ 
        status: 'sent',
        external_id: evolutionResult.key?.id || null
      })
      .eq('id', savedMessage.id);

    return new Response(JSON.stringify({ 
      success: true, 
      message_id: savedMessage.id,
      external_id: evolutionResult.key?.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error sending message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
