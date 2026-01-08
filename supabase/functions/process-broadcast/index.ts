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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { campaignId } = await req.json();

    if (!campaignId) {
      throw new Error('Campaign ID required');
    }

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabaseClient
      .from('broadcast_campaigns')
      .select('*, business:businesses(*)')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'sending' && campaign.status !== 'scheduled') {
      throw new Error('Campaign is not ready for sending');
    }

    // Update status to sending
    await supabaseClient
      .from('broadcast_campaigns')
      .update({ status: 'sending' })
      .eq('id', campaignId);

    // Get pending recipients
    const { data: recipients, error: recipientsError } = await supabaseClient
      .from('broadcast_recipients')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    if (recipientsError) {
      throw new Error('Failed to get recipients');
    }

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const evolutionInstance = campaign.business?.evolution_instance;

    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
      throw new Error('Evolution API not configured');
    }

    let sentCount = campaign.sent_count || 0;
    let failedCount = campaign.failed_count || 0;

    // Process recipients with delay to avoid rate limiting
    for (const recipient of recipients || []) {
      try {
        // Personalize message
        let personalizedMessage = campaign.message;
        if (recipient.name) {
          personalizedMessage = personalizedMessage.replace(/{nome}/gi, recipient.name);
        }

        // Send message via Evolution API
        const response = await fetch(
          `${evolutionApiUrl}/message/sendText/${evolutionInstance}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evolutionApiKey,
            },
            body: JSON.stringify({
              number: recipient.phone,
              text: personalizedMessage,
            }),
          }
        );

        if (response.ok) {
          await supabaseClient
            .from('broadcast_recipients')
            .update({ 
              status: 'sent', 
              sent_at: new Date().toISOString() 
            })
            .eq('id', recipient.id);
          sentCount++;
        } else {
          const errorData = await response.text();
          await supabaseClient
            .from('broadcast_recipients')
            .update({ 
              status: 'failed', 
              error_message: errorData 
            })
            .eq('id', recipient.id);
          failedCount++;
        }

        // Update campaign counts
        await supabaseClient
          .from('broadcast_campaigns')
          .update({ sent_count: sentCount, failed_count: failedCount })
          .eq('id', campaignId);

        // Add delay between messages (2 seconds)
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error sending to ${recipient.phone}:`, error);
        await supabaseClient
          .from('broadcast_recipients')
          .update({ 
            status: 'failed', 
            error_message: errorMessage 
          })
          .eq('id', recipient.id);
        failedCount++;
      }
    }

    // Mark campaign as completed
    await supabaseClient
      .from('broadcast_campaigns')
      .update({ 
        status: 'completed',
        sent_count: sentCount,
        failed_count: failedCount,
      })
      .eq('id', campaignId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount, 
        failedCount,
        totalRecipients: recipients?.length || 0,
      }),
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
