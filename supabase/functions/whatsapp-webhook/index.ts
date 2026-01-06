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
  sender?: string; // Campo sender contém o número real do remetente
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
      participant?: string;
      remoteJidAlt?: string;
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

    const rawRemoteJid: string = payload.data.key.remoteJid;
    const key = payload.data.key as any;
    const senderName = payload.data.pushName || 'Desconhecido';
    const externalId = payload.data.key.id;

    // Detect if this is a group message
    const isGroup = rawRemoteJid.endsWith('@g.us');
    let phone: string;
    let groupName: string | null = null;
    let participantPhone: string | null = null;

    if (isGroup) {
      // For groups: save group ID as phone, extract participant
      phone = 'group:' + rawRemoteJid.replace('@g.us', '');
      groupName = senderName; // In groups, pushName is the sender's name, we'll use group subject if available
      
      // Get participant who sent the message
      const participant = key.participant || key.participantAlt || '';
      participantPhone = participant
        .replace('@s.whatsapp.net', '')
        .replace('@lid', '')
        .replace(/\D/g, '');
      
      console.log('Group message detected:', { phone, participantPhone, senderName });
    } else {
      // For individual chats: extract real phone number
      let jidForContact = rawRemoteJid;
      
      // Check if this is a LID (internal WhatsApp ID, not a real phone number)
      const isLid = rawRemoteJid.includes('@lid') || (typeof key.addressingMode === 'string' && key.addressingMode.toLowerCase() === 'lid');
      
      if (isLid) {
        // Priority 1: Use remoteJidAlt if available
        if (typeof key.remoteJidAlt === 'string' && key.remoteJidAlt.length > 0) {
          jidForContact = key.remoteJidAlt;
          console.log('Using remoteJidAlt for real number:', jidForContact);
        } 
        // Priority 2: Use sender from root payload (Evolution API sends real number here)
        else if (payload.sender && payload.sender.includes('@s.whatsapp.net')) {
          jidForContact = payload.sender;
          console.log('Using sender from payload for real number:', jidForContact);
        }
        // Priority 3: Reject LID-only messages as we can't identify the contact
        else {
          console.log('LID message without real number - cannot process:', rawRemoteJid);
          return new Response(JSON.stringify({ success: true, message: 'LID without real number' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Clean the phone number
      phone = jidForContact
        .replace('@s.whatsapp.net', '')
        .replace('@lid', '')
        .replace(/\D/g, '');

      // Validate phone has reasonable length and starts with valid country code
      if (!phone || phone.length < 10 || phone.length > 15) {
        console.log('Invalid phone number extracted:', phone, 'from:', jidForContact);
        return new Response(JSON.stringify({ success: true, message: 'Invalid phone' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Additional validation: must start with a valid country code (1-3 digits)
      // Brazilian numbers start with 55, US with 1, etc.
      const validCountryCodes = ['55', '1', '44', '351', '34', '33', '49', '39', '81', '86'];
      const startsWithValidCode = validCountryCodes.some(code => phone.startsWith(code));
      if (!startsWithValidCode && phone.length > 11) {
        console.log('Phone does not start with valid country code:', phone);
        // Try to use sender as fallback
        if (payload.sender && payload.sender.includes('@s.whatsapp.net')) {
          const senderPhone = payload.sender.replace('@s.whatsapp.net', '').replace(/\D/g, '');
          if (senderPhone && senderPhone.length >= 10 && senderPhone.length <= 15) {
            phone = senderPhone;
            console.log('Fallback to sender phone:', phone);
          }
        }
      }
    }

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

    // Get business
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

    let leadId: string | null = null;
    let customerId: string | null = null;

    // For individual chats, link to lead/customer
    if (!isGroup) {
      // Check customers first
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
        is_group: isGroup,
        group_name: groupName,
        participant_phone: participantPhone,
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

    console.log('Message saved successfully:', savedMessage.id, isGroup ? '(group)' : '(individual)');

    return new Response(JSON.stringify({ 
      success: true, 
      message_id: savedMessage.id,
      lead_id: leadId,
      customer_id: customerId,
      is_group: isGroup,
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
