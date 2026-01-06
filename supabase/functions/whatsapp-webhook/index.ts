import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text: string;
      };
      imageMessage?: {
        url?: string;
        mimetype?: string;
        caption?: string;
      };
      documentMessage?: {
        url?: string;
        mimetype?: string;
        fileName?: string;
      };
      audioMessage?: {
        url?: string;
        mimetype?: string;
      };
      videoMessage?: {
        url?: string;
        mimetype?: string;
        caption?: string;
      };
    };
    messageTimestamp?: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: EvolutionWebhookPayload = await req.json();
    console.log('Received webhook payload:', JSON.stringify(payload, null, 2));

    // Only process incoming messages
    if (payload.event !== 'messages.upsert' || payload.data?.key?.fromMe) {
      console.log('Ignoring event:', payload.event, 'fromMe:', payload.data?.key?.fromMe);
      return new Response(JSON.stringify({ success: true, message: 'Event ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract phone number (remove @s.whatsapp.net suffix)
    const rawPhone = payload.data.key.remoteJid;
    const phone = rawPhone.replace('@s.whatsapp.net', '').replace('@g.us', '');
    const senderName = payload.data.pushName || 'Desconhecido';
    const externalId = payload.data.key.id;

    // Extract message content
    let messageContent = '';
    let mediaUrl: string | null = null;
    let mediaType: string | null = null;

    const msg = payload.data.message;
    if (msg?.conversation) {
      messageContent = msg.conversation;
    } else if (msg?.extendedTextMessage?.text) {
      messageContent = msg.extendedTextMessage.text;
    } else if (msg?.imageMessage) {
      messageContent = msg.imageMessage.caption || '[Imagem]';
      mediaUrl = msg.imageMessage.url || null;
      mediaType = 'image';
    } else if (msg?.documentMessage) {
      messageContent = msg.documentMessage.fileName || '[Documento]';
      mediaUrl = msg.documentMessage.url || null;
      mediaType = 'document';
    } else if (msg?.audioMessage) {
      messageContent = '[Áudio]';
      mediaUrl = msg.audioMessage.url || null;
      mediaType = 'audio';
    } else if (msg?.videoMessage) {
      messageContent = msg.videoMessage.caption || '[Vídeo]';
      mediaUrl = msg.videoMessage.url || null;
      mediaType = 'video';
    }

    if (!messageContent) {
      console.log('No message content found');
      return new Response(JSON.stringify({ success: true, message: 'No content' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get business by instance name or use first business (you can customize this logic)
    const { data: businesses, error: bizError } = await supabase
      .from('businesses')
      .select('id')
      .limit(1);

    if (bizError || !businesses?.length) {
      console.error('No business found:', bizError);
      return new Response(JSON.stringify({ error: 'No business found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const businessId = businesses[0].id;

    // Check if lead already exists by phone
    let leadId: string | null = null;
    let customerId: string | null = null;

    // First check customers
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('business_id', businessId)
      .or(`whatsapp.eq.${phone},phone.eq.${phone}`)
      .limit(1)
      .single();

    if (existingCustomer) {
      customerId = existingCustomer.id;
      console.log('Found existing customer:', customerId);
    } else {
      // Check leads
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id')
        .eq('business_id', businessId)
        .or(`whatsapp.eq.${phone},phone.eq.${phone}`)
        .limit(1)
        .single();

      if (existingLead) {
        leadId = existingLead.id;
        console.log('Found existing lead:', leadId);
      } else {
        // Create new lead automatically
        const { data: newLead, error: leadError } = await supabase
          .from('leads')
          .insert({
            business_id: businessId,
            name: senderName,
            whatsapp: phone,
            phone: phone,
            source: 'whatsapp',
            status: 'new',
            temperature: 'hot',
            notes: `Lead captado automaticamente via WhatsApp em ${new Date().toLocaleString('pt-BR')}`
          })
          .select('id')
          .single();

        if (leadError) {
          console.error('Error creating lead:', leadError);
        } else {
          leadId = newLead.id;
          console.log('Created new lead:', leadId);
        }
      }
    }

    // Save the message
    const { data: savedMessage, error: msgError } = await supabase
      .from('whatsapp_messages')
      .insert({
        business_id: businessId,
        lead_id: leadId,
        customer_id: customerId,
        phone: phone,
        sender_name: senderName,
        message: messageContent,
        direction: 'inbound',
        media_url: mediaUrl,
        media_type: mediaType,
        status: 'delivered',
        external_id: externalId,
      })
      .select()
      .single();

    if (msgError) {
      console.error('Error saving message:', msgError);
      return new Response(JSON.stringify({ error: 'Failed to save message' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Message saved successfully:', savedMessage.id);

    return new Response(JSON.stringify({ 
      success: true, 
      message_id: savedMessage.id,
      lead_id: leadId,
      customer_id: customerId,
      is_new_lead: leadId && !existingCustomer
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
