import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TemplateButton {
  text: string;
  type: 'reply' | 'link';
  url?: string;
}

interface SendMessageRequest {
  phone: string;
  message: string;
  business_id: string;
  lead_id?: string;
  customer_id?: string;
  instance?: string;
  media_url?: string;
  media_type?: string;
  media_base64?: string;
  media_filename?: string;
  buttons?: TemplateButton[];
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
    const { phone, message, business_id, lead_id, customer_id, instance, media_url, media_type, media_base64, media_filename, buttons } = body;

    if (!phone || !business_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: phone, business_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize phone number
    const isLidContact = phone.includes('@lid');
    const cleanPhone = phone
      .replace('@s.whatsapp.net', '')
      .replace('@lid', '')
      .replace(/\D/g, '');

    if (isLidContact) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'lid_contact',
          user_message:
            'Este contato veio como @lid no WhatsApp. Para responder, precisamos do número real (ex: 5511999999999).',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!cleanPhone || cleanPhone.length < 10 || cleanPhone.length > 15) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'invalid_phone',
          user_message: 'Número de WhatsApp inválido. Verifique o DDI/DDD e tente novamente.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine instance name
    let instanceName = instance;
    if (!instanceName) {
      const { data: businessData } = await supabase
        .from('businesses')
        .select('evolution_instance, slug')
        .eq('id', business_id)
        .single();
      instanceName = businessData?.evolution_instance || 'default';
    }

    // Determine if we're sending media or text
    const hasMedia = media_base64 || media_url;
    let messageType = 'text';
    let savedMediaUrl: string | null = null;
    let savedMediaType: string | null = null;

    if (hasMedia && media_type) {
      if (media_type.includes('image') || media_type === 'image') {
        messageType = 'image';
      } else if (media_type.includes('audio') || media_type === 'audio') {
        messageType = 'audio';
      } else if (media_type.includes('video') || media_type === 'video') {
        messageType = 'video';
      } else {
        messageType = 'document';
      }
      savedMediaType = media_type;
    }

    // Save outbound message first
    const { data: savedMessage, error: saveError } = await supabase
      .from('whatsapp_messages')
      .insert({
        business_id,
        lead_id,
        customer_id,
        phone: cleanPhone,
        message: message || `[${messageType === 'image' ? 'Imagem' : messageType === 'audio' ? 'Áudio' : messageType === 'video' ? 'Vídeo' : 'Documento'}]`,
        direction: 'outbound',
        status: 'pending',
        media_url: media_url || null,
        media_type: savedMediaType,
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

    let evolutionUrl: string;
    let evolutionBody: Record<string, unknown>;

    // Check if we have interactive buttons
    const hasButtons = buttons && buttons.length > 0;
    const replyButtons = hasButtons ? buttons.filter(b => b.type === 'reply').slice(0, 3) : [];
    const linkButton = hasButtons ? buttons.find(b => b.type === 'link' && b.url) : null;

    if (messageType === 'text' && replyButtons.length > 0) {
      // Send message with reply buttons (max 3)
      evolutionUrl = `${evolutionApiUrl}/message/sendButtons/${instanceName}`;
      evolutionBody = {
        number: cleanPhone,
        title: '',
        description: message,
        buttons: replyButtons.map((btn, idx) => ({
          type: 'reply',
          buttonId: `btn_${idx + 1}`,
          buttonText: { displayText: btn.text.slice(0, 20) }
        })),
        footer: ''
      };
      console.log('Sending buttons message:', evolutionBody);
    } else if (messageType === 'text' && linkButton) {
      // Send message with link button using sections/list
      evolutionUrl = `${evolutionApiUrl}/message/sendText/${instanceName}`;
      // For link buttons, append as formatted text since WhatsApp API has restrictions
      evolutionBody = {
        number: cleanPhone,
        text: `${message}\n\n🔗 ${linkButton.text}: ${linkButton.url}`,
      };
    } else if (messageType === 'text') {
      // Send text message
      evolutionUrl = `${evolutionApiUrl}/message/sendText/${instanceName}`;
      evolutionBody = {
        number: cleanPhone,
        text: message,
      };
    } else if (messageType === 'image') {
      // Send image
      evolutionUrl = `${evolutionApiUrl}/message/sendMedia/${instanceName}`;
      evolutionBody = {
        number: cleanPhone,
        mediatype: 'image',
        caption: message || '',
        ...(media_base64 ? { media: media_base64 } : { mediaUrl: media_url }),
      };
    } else if (messageType === 'audio') {
      // Send audio (PTT style)
      evolutionUrl = `${evolutionApiUrl}/message/sendWhatsAppAudio/${instanceName}`;
      evolutionBody = {
        number: cleanPhone,
        ...(media_base64 ? { audio: media_base64 } : { audioUrl: media_url }),
      };
    } else if (messageType === 'video') {
      // Send video
      evolutionUrl = `${evolutionApiUrl}/message/sendMedia/${instanceName}`;
      evolutionBody = {
        number: cleanPhone,
        mediatype: 'video',
        caption: message || '',
        ...(media_base64 ? { media: media_base64 } : { mediaUrl: media_url }),
      };
    } else {
      // Send document
      evolutionUrl = `${evolutionApiUrl}/message/sendMedia/${instanceName}`;
      evolutionBody = {
        number: cleanPhone,
        mediatype: 'document',
        caption: message || '',
        fileName: media_filename || 'document',
        ...(media_base64 ? { media: media_base64 } : { mediaUrl: media_url }),
      };
    }

    console.log('Sending to Evolution API:', evolutionUrl, 'type:', messageType);

    const evolutionResponse = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify(evolutionBody),
    });

    const evolutionResult = await evolutionResponse.json();
    console.log('Evolution API response:', evolutionResult);

    if (!evolutionResponse.ok) {
      // Update message status to failed
      await supabase
        .from('whatsapp_messages')
        .update({ status: 'failed' })
        .eq('id', savedMessage.id);

      const existsFalse =
        evolutionResponse.status === 400 &&
        Array.isArray((evolutionResult as any)?.response?.message) &&
        (evolutionResult as any).response.message?.[0]?.exists === false;

      if (existsFalse) {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'number_not_on_whatsapp',
            user_message:
              'Este número não está disponível no WhatsApp (ou foi recebido de forma incorreta). Confirme o número do contato.',
            details: evolutionResult,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          error: 'Failed to send message via Evolution API',
          details: evolutionResult,
        }),
        {
          status: evolutionResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
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
