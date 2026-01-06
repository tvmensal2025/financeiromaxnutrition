import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing scheduled messages...');

    // Get all pending messages that are due
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('Error fetching scheduled messages:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingMessages?.length || 0} pending messages`);

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      recurring_created: 0,
    };

    for (const msg of pendingMessages || []) {
      try {
        console.log(`Processing message ${msg.id} for phone ${msg.phone}`);

        // Call send-evolution-message function
        const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-evolution-message', {
          body: {
            phone: msg.phone,
            message: msg.message,
            business_id: msg.business_id,
            lead_id: msg.lead_id,
            customer_id: msg.customer_id,
          },
        });

        if (sendError) {
          console.error(`Failed to send message ${msg.id}:`, sendError);
          
          // Update status to failed
          await supabase
            .from('scheduled_messages')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', msg.id);
          
          results.failed++;
        } else {
          console.log(`Message ${msg.id} sent successfully`);
          
          // Update status to sent
          await supabase
            .from('scheduled_messages')
            .update({ 
              status: 'sent', 
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', msg.id);
          
          results.sent++;

          // If recurring, create next scheduled message
          if (msg.is_recurring && msg.recurrence_pattern) {
            const nextDate = calculateNextDate(msg.scheduled_at, msg.recurrence_pattern);
            
            // Check if we're past the end date
            if (!msg.recurrence_end_date || new Date(nextDate) <= new Date(msg.recurrence_end_date)) {
              const { error: createError } = await supabase
                .from('scheduled_messages')
                .insert({
                  business_id: msg.business_id,
                  phone: msg.phone,
                  message: msg.message,
                  lead_id: msg.lead_id,
                  customer_id: msg.customer_id,
                  scheduled_at: nextDate,
                  is_recurring: true,
                  recurrence_pattern: msg.recurrence_pattern,
                  recurrence_end_date: msg.recurrence_end_date,
                  status: 'pending',
                });

              if (!createError) {
                results.recurring_created++;
                console.log(`Created next recurring message for ${msg.phone}`);
              } else {
                console.error('Error creating recurring message:', createError);
              }
            }
          }
        }

        results.processed++;
      } catch (msgError) {
        console.error(`Error processing message ${msg.id}:`, msgError);
        results.failed++;
      }
    }

    console.log('Processing complete:', results);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error processing scheduled messages:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateNextDate(currentDate: string, pattern: string): string {
  const date = new Date(currentDate);
  
  switch (pattern) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    default:
      date.setDate(date.getDate() + 1);
  }
  
  return date.toISOString();
}
