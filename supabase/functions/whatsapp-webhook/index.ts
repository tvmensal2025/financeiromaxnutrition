import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Buscar foto de perfil do contato na Evolution API
async function getProfilePicture(phone: string, instance: string): Promise<string | null> {
  try {
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    
    if (!evolutionApiUrl || !evolutionApiKey) {
      console.log('Evolution API credentials not configured');
      return null;
    }

    const response = await fetch(`${evolutionApiUrl}/chat/fetchProfilePictureUrl/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify({ number: phone })
    });
    
    if (!response.ok) {
      console.log('Failed to fetch profile picture:', response.status);
      return null;
    }
    
    const data = await response.json();
    console.log('Profile picture response:', data);
    return data?.profilePictureUrl || data?.picture || null;
  } catch (error) {
    console.log('Error fetching profile picture:', error);
    return null;
  }
}

// Buscar informações do grupo na Evolution API
async function getGroupInfo(groupJid: string, instance: string): Promise<{ name: string | null; size: number }> {
  try {
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    
    if (!evolutionApiUrl || !evolutionApiKey) {
      console.log('Evolution API credentials not configured for group info');
      return { name: null, size: 0 };
    }

    const response = await fetch(`${evolutionApiUrl}/group/fetchAllGroups/${instance}?getParticipants=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      }
    });
    
    if (!response.ok) {
      console.log('Failed to fetch groups:', response.status);
      return { name: null, size: 0 };
    }
    
    const groups = await response.json();
    console.log('Groups response count:', groups?.length || 0);
    
    // Find the specific group by JID
    const targetJid = groupJid.includes('@g.us') ? groupJid : `${groupJid}@g.us`;
    const group = groups?.find((g: any) => g.id === targetJid || g.jid === targetJid);
    
    if (group) {
      console.log('Found group:', { name: group.subject || group.name, size: group.size || group.participants?.length });
      return {
        name: group.subject || group.name || null,
        size: group.size || group.participants?.length || 0
      };
    }
    
    return { name: null, size: 0 };
  } catch (error) {
    console.log('Error fetching group info:', error);
    return { name: null, size: 0 };
  }
}

// Baixar mídia da Evolution API e salvar no Storage
async function downloadAndStoreMedia(
  messageKey: { id: string; remoteJid: string; fromMe: boolean },
  instance: string,
  businessId: string,
  phone: string,
  mediaType: string,
  supabase: any
): Promise<{ url: string | null; metadata: any }> {
  try {
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    
    if (!evolutionApiUrl || !evolutionApiKey) {
      console.log('Evolution API credentials not configured for media download');
      return { url: null, metadata: null };
    }

    console.log('Downloading media with key:', messageKey.id);

    // Call Evolution API to get base64 media
    const response = await fetch(`${evolutionApiUrl}/chat/getBase64FromMediaMessage/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify({
        message: {
          key: {
            id: messageKey.id,
            remoteJid: messageKey.remoteJid,
            fromMe: messageKey.fromMe
          }
        },
        convertToMp4: true // Convert audio/video to mp4 when possible
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('Failed to download media:', response.status, errorText);
      return { url: null, metadata: null };
    }
    
    const data = await response.json();
    console.log('Media download response keys:', Object.keys(data));
    
    if (!data.base64) {
      console.log('No base64 data in response');
      return { url: null, metadata: null };
    }

    // Determine file extension based on mimetype
    const mimetype = data.mimetype || '';
    let extension = 'bin';
    if (mimetype.includes('image/jpeg') || mimetype.includes('image/jpg')) extension = 'jpg';
    else if (mimetype.includes('image/png')) extension = 'png';
    else if (mimetype.includes('image/gif')) extension = 'gif';
    else if (mimetype.includes('image/webp')) extension = 'webp';
    else if (mimetype.includes('video/mp4')) extension = 'mp4';
    else if (mimetype.includes('video/')) extension = 'mp4';
    else if (mimetype.includes('audio/ogg')) extension = 'ogg';
    else if (mimetype.includes('audio/mp4')) extension = 'm4a';
    else if (mimetype.includes('audio/mpeg')) extension = 'mp3';
    else if (mimetype.includes('audio/')) extension = 'ogg';
    else if (mimetype.includes('application/pdf')) extension = 'pdf';
    else if (mimetype.includes('application/')) extension = 'bin';

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = data.fileName || `media_${timestamp}.${extension}`;
    const cleanPhone = phone.replace('group:', '');
    const filePath = `${businessId}/${cleanPhone}/${timestamp}_${fileName}`;

    // Convert base64 to Uint8Array
    const base64Data = data.base64.replace(/^data:[^;]+;base64,/, '');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log('Uploading to storage:', filePath, 'size:', bytes.length);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(filePath, bytes, {
        contentType: mimetype || 'application/octet-stream',
        upsert: true
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { url: null, metadata: null };
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(filePath);

    console.log('Media uploaded successfully:', publicUrlData.publicUrl);

    // Build metadata
    const metadata: any = {
      originalMimetype: mimetype,
      fileName: fileName,
      fileSize: bytes.length,
    };

    // Add duration for audio/video if available
    if (data.duration) {
      metadata.duration = data.duration;
    }

    return { 
      url: publicUrlData.publicUrl, 
      metadata 
    };
  } catch (error) {
    console.error('Error downloading/storing media:', error);
    return { url: null, metadata: null };
  }
}

interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  sender?: string;
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
        height?: number;
        width?: number;
      };
      documentMessage?: {
        url?: string;
        mimetype?: string;
        fileName?: string;
        pageCount?: number;
      };
      audioMessage?: {
        url?: string;
        mimetype?: string;
        seconds?: number;
        ptt?: boolean;
      };
      videoMessage?: {
        url?: string;
        mimetype?: string;
        caption?: string;
        seconds?: number;
        height?: number;
        width?: number;
      };
      stickerMessage?: {
        url?: string;
        mimetype?: string;
        height?: number;
        width?: number;
        isAnimated?: boolean;
      };
      locationMessage?: {
        degreesLatitude?: number;
        degreesLongitude?: number;
        name?: string;
        address?: string;
      };
      contactMessage?: {
        displayName?: string;
        vcard?: string;
      };
      contactsArrayMessage?: {
        contacts?: Array<{
          displayName?: string;
          vcard?: string;
        }>;
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

    // Only process message events
    if (payload.event !== 'messages.upsert') {
      console.log('Ignoring event:', payload.event);
      return new Response(JSON.stringify({ success: true, message: 'Event ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine if this is an outbound message (sent from phone)
    const isOutbound = payload.data?.key?.fromMe === true;

    const rawRemoteJid: string = payload.data.key.remoteJid;
    const key = payload.data.key as any;
    const senderName = payload.data.pushName || 'Desconhecido';
    const externalId = payload.data.key.id;

    // Detect if this is a group message
    const isGroup = rawRemoteJid.endsWith('@g.us');
    let phone: string;
    let groupName: string | null = null;
    let participantPhone: string | null = null;
    let participantCount: number = 0;

    if (isGroup) {
      const rawGroupId = rawRemoteJid.replace('@g.us', '');
      phone = 'group:' + rawGroupId;
      
      const groupInfo = await getGroupInfo(rawRemoteJid, payload.instance);
      groupName = groupInfo.name || `Grupo ${rawGroupId.slice(-6)}`;
      participantCount = groupInfo.size;
      console.log('Group info fetched:', { groupName, participantCount });
      
      if (payload.sender && payload.sender.includes('@s.whatsapp.net')) {
        participantPhone = payload.sender
          .replace('@s.whatsapp.net', '')
          .replace(/\D/g, '');
        console.log('Group: Using sender for participant:', participantPhone);
      } else {
        const participant = key.participant || key.participantAlt || '';
        if (participant && !participant.includes('@lid')) {
          participantPhone = participant
            .replace('@s.whatsapp.net', '')
            .replace(/\D/g, '');
          console.log('Group: Using participant from key:', participantPhone);
        } else {
          console.log('Group: No valid participant phone found, participant:', participant);
        }
      }
      
      console.log('Group message detected:', { phone, participantPhone, senderName, rawSender: payload.sender });
    } else {
      let jidForContact = rawRemoteJid;
      
      const isLid = rawRemoteJid.includes('@lid') || (typeof key.addressingMode === 'string' && key.addressingMode.toLowerCase() === 'lid');
      
      if (isLid) {
        if (typeof key.remoteJidAlt === 'string' && key.remoteJidAlt.length > 0) {
          jidForContact = key.remoteJidAlt;
          console.log('Using remoteJidAlt for real number:', jidForContact);
        } else if (payload.sender && payload.sender.includes('@s.whatsapp.net')) {
          jidForContact = payload.sender;
          console.log('Using sender from payload for real number:', jidForContact);
        } else {
          console.log('LID message without real number - cannot process:', rawRemoteJid);
          return new Response(JSON.stringify({ success: true, message: 'LID without real number' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      phone = jidForContact
        .replace('@s.whatsapp.net', '')
        .replace('@lid', '')
        .replace(/\D/g, '');

      if (!phone || phone.length < 10 || phone.length > 15) {
        console.log('Invalid phone number extracted:', phone, 'from:', jidForContact);
        return new Response(JSON.stringify({ success: true, message: 'Invalid phone' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const validCountryCodes = ['55', '1', '44', '351', '34', '33', '49', '39', '81', '86'];
      const startsWithValidCode = validCountryCodes.some(code => phone.startsWith(code));
      if (!startsWithValidCode && phone.length > 11) {
        console.log('Phone does not start with valid country code:', phone);
        if (payload.sender && payload.sender.includes('@s.whatsapp.net')) {
          const senderPhone = payload.sender.replace('@s.whatsapp.net', '').replace(/\D/g, '');
          if (senderPhone && senderPhone.length >= 10 && senderPhone.length <= 15) {
            phone = senderPhone;
            console.log('Fallback to sender phone:', phone);
          }
        }
      }
    }

    // Extract message content and media
    let messageContent = '';
    let mediaUrl: string | null = null;
    let mediaType: string | null = null;
    let mediaMetadata: any = null;
    let hasMedia = false;

    const msg = payload.data.message;
    
    // Text messages
    if (msg?.conversation) {
      messageContent = msg.conversation;
    } else if (msg?.extendedTextMessage?.text) {
      messageContent = msg.extendedTextMessage.text;
    }
    
    // Image message
    else if (msg?.imageMessage) {
      messageContent = msg.imageMessage.caption || '[Imagem]';
      mediaType = 'image';
      hasMedia = true;
      mediaMetadata = {
        width: msg.imageMessage.width,
        height: msg.imageMessage.height,
      };
    }
    
    // Video message
    else if (msg?.videoMessage) {
      messageContent = msg.videoMessage.caption || '[Vídeo]';
      mediaType = 'video';
      hasMedia = true;
      mediaMetadata = {
        duration: msg.videoMessage.seconds,
        width: msg.videoMessage.width,
        height: msg.videoMessage.height,
      };
    }
    
    // Audio message
    else if (msg?.audioMessage) {
      messageContent = msg.audioMessage.ptt ? '[Áudio]' : '[Áudio]';
      mediaType = 'audio';
      hasMedia = true;
      mediaMetadata = {
        duration: msg.audioMessage.seconds,
        isVoiceNote: msg.audioMessage.ptt || false,
      };
    }
    
    // Document message
    else if (msg?.documentMessage) {
      messageContent = msg.documentMessage.fileName || '[Documento]';
      mediaType = msg.documentMessage.mimetype?.includes('pdf') ? 'pdf' : 'document';
      hasMedia = true;
      mediaMetadata = {
        fileName: msg.documentMessage.fileName,
        pageCount: msg.documentMessage.pageCount,
        mimetype: msg.documentMessage.mimetype,
      };
    }
    
    // Sticker message
    else if (msg?.stickerMessage) {
      messageContent = '[Sticker]';
      mediaType = 'sticker';
      hasMedia = true;
      mediaMetadata = {
        isAnimated: msg.stickerMessage.isAnimated,
        width: msg.stickerMessage.width,
        height: msg.stickerMessage.height,
      };
    }
    
    // Location message
    else if (msg?.locationMessage) {
      const lat = msg.locationMessage.degreesLatitude;
      const lng = msg.locationMessage.degreesLongitude;
      const name = msg.locationMessage.name;
      const address = msg.locationMessage.address;
      
      messageContent = name || address || '[Localização]';
      mediaType = 'location';
      mediaMetadata = {
        latitude: lat,
        longitude: lng,
        name: name,
        address: address,
      };
      // For location, we store the maps URL directly
      if (lat && lng) {
        mediaUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      }
    }
    
    // Contact message
    else if (msg?.contactMessage) {
      const displayName = msg.contactMessage.displayName || 'Contato';
      messageContent = `[Contato: ${displayName}]`;
      mediaType = 'contact';
      mediaMetadata = {
        displayName: displayName,
        vcard: msg.contactMessage.vcard,
      };
    }
    
    // Contacts array message
    else if (msg?.contactsArrayMessage?.contacts) {
      const contacts = msg.contactsArrayMessage.contacts;
      const names = contacts.map(c => c.displayName || 'Contato').join(', ');
      messageContent = `[Contatos: ${names}]`;
      mediaType = 'contacts';
      mediaMetadata = {
        contacts: contacts.map(c => ({
          displayName: c.displayName,
          vcard: c.vcard,
        })),
      };
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

    // Download and store media if present (for types that have downloadable media)
    if (hasMedia && ['image', 'video', 'audio', 'document', 'pdf', 'sticker'].includes(mediaType!)) {
      console.log('Attempting to download media:', mediaType);
      const mediaResult = await downloadAndStoreMedia(
        {
          id: payload.data.key.id,
          remoteJid: payload.data.key.remoteJid,
          fromMe: payload.data.key.fromMe,
        },
        payload.instance,
        businessId,
        phone,
        mediaType!,
        supabase
      );
      
      if (mediaResult.url) {
        mediaUrl = mediaResult.url;
        mediaMetadata = { ...mediaMetadata, ...mediaResult.metadata };
        console.log('Media stored successfully:', mediaUrl);
      } else {
        console.log('Media download failed, message will be saved without permanent media URL');
      }
    }

    let leadId: string | null = null;
    let customerId: string | null = null;
    let senderAvatarUrl: string | null = null;

    // Fetch profile picture from Evolution API (only for inbound messages)
    const phoneForPicture = isGroup && participantPhone ? participantPhone : phone;
    if (!isOutbound && (!isGroup || participantPhone)) {
      senderAvatarUrl = await getProfilePicture(phoneForPicture, payload.instance);
      console.log('Fetched avatar URL:', senderAvatarUrl);
    }

    // For individual chats, link to lead/customer (only for inbound, or find existing for outbound)
    if (!isGroup) {
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id, avatar_url')
        .eq('business_id', businessId)
        .or(`whatsapp.eq.${phone},phone.eq.${phone}`)
        .limit(1)
        .single();

      if (existingCustomer) {
        customerId = existingCustomer.id;
        console.log('Found existing customer:', customerId);
        
        if (!isOutbound && senderAvatarUrl && !existingCustomer.avatar_url) {
          await supabase
            .from('customers')
            .update({ avatar_url: senderAvatarUrl })
            .eq('id', customerId);
          console.log('Updated customer avatar');
        }
      } else {
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id, avatar_url')
          .eq('business_id', businessId)
          .or(`whatsapp.eq.${phone},phone.eq.${phone}`)
          .limit(1)
          .single();

        if (existingLead) {
          leadId = existingLead.id;
          console.log('Found existing lead:', leadId);
          
          if (!isOutbound && senderAvatarUrl && !existingLead.avatar_url) {
            await supabase
              .from('leads')
              .update({ avatar_url: senderAvatarUrl })
              .eq('id', leadId);
            console.log('Updated lead avatar');
          }
        } else if (!isOutbound) {
          // Only create new lead for inbound messages
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
              notes: `Lead captado automaticamente via WhatsApp em ${new Date().toLocaleString('pt-BR')}`,
              avatar_url: senderAvatarUrl,
            })
            .select('id')
            .single();

          if (leadError) {
            console.error('Error creating lead:', leadError);
          } else {
            leadId = newLead.id;
            console.log('Created new lead:', leadId, 'with avatar:', !!senderAvatarUrl);
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
        sender_name: isOutbound ? 'Você' : senderName,
        message: messageContent,
        direction: isOutbound ? 'outbound' : 'inbound',
        media_url: mediaUrl,
        media_type: mediaType,
        media_metadata: mediaMetadata,
        status: isOutbound ? 'sent' : 'delivered',
        external_id: externalId,
        is_group: isGroup,
        group_name: groupName,
        participant_phone: participantPhone,
        sender_avatar_url: senderAvatarUrl,
        participant_count: participantCount,
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

    console.log('Message saved successfully:', savedMessage.id, isGroup ? '(group)' : '(individual)', 'direction:', isOutbound ? 'outbound' : 'inbound', 'mediaType:', mediaType);

    return new Response(JSON.stringify({ 
      success: true, 
      message_id: savedMessage.id,
      lead_id: leadId,
      customer_id: customerId,
      is_group: isGroup,
      media_stored: !!mediaUrl,
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
