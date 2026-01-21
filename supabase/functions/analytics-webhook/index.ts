import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  signature: string;
  timestamp: number;
  event_type: string;
  user_id?: string;
  properties: Record<string, any>;
}

interface WebhookResponse {
  success: boolean;
  message: string;
  event_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate request method
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, message: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Parse payload
    const payload: WebhookPayload = await req.json();
    console.log('Received webhook payload:', JSON.stringify(payload, null, 2));

    // Get webhook secret from environment
    const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');
    if (!WEBHOOK_SECRET) {
      console.error('WEBHOOK_SECRET not configured');
      return new Response(
        JSON.stringify({ success: false, message: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate signature
    const expectedSignature = await generateSignature(payload, WEBHOOK_SECRET);
    if (payload.signature !== expectedSignature) {
      console.error('Invalid signature received');
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid signature' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate timestamp (prevent replay attacks - 5 minute window)
    const now = Date.now();
    if (Math.abs(now - payload.timestamp) > 300000) {
      console.error('Timestamp too old or in future:', payload.timestamp);
      return new Response(
        JSON.stringify({ success: false, message: 'Timestamp too old' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase credentials not configured');
      return new Response(
        JSON.stringify({ success: false, message: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Route event to appropriate table
    const eventId = await processEvent(supabase, payload);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Event processed', 
        event_id: eventId 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

/**
 * Generate HMAC-SHA256 signature for webhook payload validation
 */
async function generateSignature(payload: WebhookPayload, secret: string): Promise<string> {
  // Create a copy of payload without signature for validation
  const data = JSON.stringify({ 
    timestamp: payload.timestamp,
    event_type: payload.event_type,
    user_id: payload.user_id,
    properties: payload.properties
  });
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Process webhook event and route to appropriate database table
 */
async function processEvent(supabase: any, payload: WebhookPayload): Promise<string> {
  console.log('Processing event type:', payload.event_type);
  
  // Route based on event_type
  switch (payload.event_type) {
    case 'app_event':
      return await insertAppEvent(supabase, payload);
    case 'ai_usage':
      return await insertAIUsage(supabase, payload);
    case 'transaction':
      return await insertTransaction(supabase, payload);
    default:
      throw new Error(`Unknown event type: ${payload.event_type}`);
  }
}

/**
 * Insert app event into app_events table
 */
async function insertAppEvent(supabase: any, payload: WebhookPayload): Promise<string> {
  const props = payload.properties;
  
  const { data, error } = await supabase
    .from('app_events')
    .insert({
      session_id: props.session_id,
      user_id: payload.user_id,
      event_type: props.event_type || 'custom',
      event_name: props.event_name,
      screen_name: props.screen_name,
      previous_screen: props.previous_screen,
      properties: props.additional_properties || {},
      occurred_at: new Date(payload.timestamp).toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error inserting app event:', error);
    throw error;
  }

  console.log('App event inserted:', data.id);
  return data.id;
}

/**
 * Insert AI usage record into ai_usage table
 */
async function insertAIUsage(supabase: any, payload: WebhookPayload): Promise<string> {
  const props = payload.properties;
  
  const { data, error } = await supabase
    .from('ai_usage')
    .insert({
      user_id: payload.user_id,
      provider: props.provider,
      model_name: props.model_name,
      feature_name: props.feature_name,
      token_count: props.token_count,
      cost_usd: props.cost_usd,
      response_time_ms: props.response_time_ms,
      success: props.success !== false,
      error_message: props.error_message,
      used_at: new Date(payload.timestamp).toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error inserting AI usage:', error);
    throw error;
  }

  console.log('AI usage inserted:', data.id);
  return data.id;
}

/**
 * Insert transaction into transactions table
 */
async function insertTransaction(supabase: any, payload: WebhookPayload): Promise<string> {
  const props = payload.properties;
  
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: payload.user_id,
      transaction_type: props.transaction_type || 'purchase',
      amount_usd: props.amount_usd,
      currency: props.currency || 'USD',
      payment_method: props.payment_method,
      status: props.status || 'completed',
      transaction_date: new Date(payload.timestamp).toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error inserting transaction:', error);
    throw error;
  }

  console.log('Transaction inserted:', data.id);
  return data.id;
}
