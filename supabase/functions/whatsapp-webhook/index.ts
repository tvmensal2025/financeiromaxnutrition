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
): Promise<{ url: string | null; metadata: any; base64?: string; mimeType?: string }> {
  try {
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    
    if (!evolutionApiUrl || !evolutionApiKey) {
      console.log('Evolution API credentials not configured for media download');
      return { url: null, metadata: null };
    }

    console.log('Downloading media with key:', messageKey.id);

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
        // Only convert video to MP4, keep audio in original format (OGG/Opus) for transcription
        convertToMp4: mediaType === 'video'
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

    const timestamp = Date.now();
    const fileName = data.fileName || `media_${timestamp}.${extension}`;
    const cleanPhone = phone.replace('group:', '');
    const filePath = `${businessId}/${cleanPhone}/${timestamp}_${fileName}`;

    const base64Data = data.base64.replace(/^data:[^;]+;base64,/, '');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log('Uploading to storage:', filePath, 'size:', bytes.length);

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

    const { data: publicUrlData } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(filePath);

    console.log('Media uploaded successfully:', publicUrlData.publicUrl);

    const metadata: any = {
      originalMimetype: mimetype,
      fileName: fileName,
      fileSize: bytes.length,
    };

    if (data.duration) {
      metadata.duration = data.duration;
    }

    return { 
      url: publicUrlData.publicUrl, 
      metadata,
      base64: data.base64,
      mimeType: mimetype
    };
  } catch (error) {
    console.error('Error downloading/storing media:', error);
    return { url: null, metadata: null };
  }
}

// Send message via Evolution API
async function sendEvolutionMessage(instance: string, phone: string, message: string): Promise<boolean> {
  try {
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    
    if (!evolutionApiUrl || !evolutionApiKey) {
      console.log('Evolution API credentials not configured for sending message');
      return false;
    }

    const response = await fetch(`${evolutionApiUrl}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify({
        number: phone,
        text: message
      })
    });

    if (!response.ok) {
      console.error('Failed to send message:', response.status, await response.text());
      return false;
    }

    console.log('Message sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending message:', error);
    return false;
  }
}

// Send message with interactive buttons via Evolution API
async function sendEvolutionMessageWithButtons(
  instance: string,
  phone: string,
  title: string,
  description: string,
  footer: string,
  buttons: Array<{ id: string; displayText: string }>
): Promise<boolean> {
  try {
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    
    if (!evolutionApiUrl || !evolutionApiKey) {
      console.log('Evolution API credentials not configured for sending buttons');
      return false;
    }

    console.log('Sending message with buttons:', { phone, title, buttons });

    const response = await fetch(`${evolutionApiUrl}/message/sendButtons/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify({
        number: phone,
        title: title,
        description: description,
        footer: footer,
        buttons: buttons
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send buttons message:', response.status, errorText);
      // Fallback to simple text message if buttons fail
      console.log('Falling back to simple text message');
      return await sendEvolutionMessage(instance, phone, `${title}\n\n${description}\n\n${footer}`);
    }

    console.log('Buttons message sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending buttons message:', error);
    // Fallback to simple text message
    return await sendEvolutionMessage(instance, phone, `${title}\n\n${description}\n\n${footer}`);
  }
}

// Format AI response message with buttons data (Meu Assessor style)
interface TransactionMessageData {
  title: string;
  description: string;
  footer: string;
  buttons: Array<{ id: string; displayText: string }>;
}

function formatTransactionMessage(
  businessName: string,
  data: any,
  greetingStyle: string,
  transactionId?: string
): TransactionMessageData {
  const statusEmoji = data.status === 'received' || data.status === 'paid' ? '🟢' : '🟡';
  const statusText = data.status === 'received' ? 'Recebido' : data.status === 'paid' ? 'Pago' : 'A receber';
  
  const friendlyIntros = [
    '🎉 Ótima notícia! Transação registrada com sucesso! 📈',
    '✨ Perfeito! Anotei aqui pra você! 📝',
    '🚀 Pronto! Mais uma transação na conta! 💰',
    '👍 Feito! Registrei tudo direitinho! ✅',
  ];
  
  const title = greetingStyle === 'friendly' 
    ? friendlyIntros[Math.floor(Math.random() * friendlyIntros.length)]
    : greetingStyle === 'formal'
    ? 'Transação registrada com sucesso.'
    : 'Pronto! Registrado.';

  const amount = Number(data.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const date = data.date || new Date().toLocaleDateString('pt-BR');

  let description = `📜 Resumo da Transação:\n\n`;
  description += `💬 Descrição: ${data.description || data.customerName || 'Transação'}\n`;
  if (data.customerName) {
    description += `👤 Cliente: ${data.customerName}\n`;
  }
  description += `💰 Valor: R$ ${amount}\n`;
  description += `📂 Categoria: ${data.category || 'Recebimentos'}\n`;
  description += `📅 Data: ${date}\n`;
  description += `${statusEmoji} Status: ${statusText}`;

  const footer = greetingStyle === 'friendly' 
    ? '📊 Clique para editar ou excluir'
    : 'Selecione uma opção';

  // Build buttons with transaction ID for identification
  const buttons: Array<{ id: string; displayText: string }> = [];
  if (transactionId) {
    buttons.push(
      { id: `edit_tx_${transactionId}`, displayText: '✏️ Editar transação' },
      { id: `delete_tx_${transactionId}`, displayText: '🗑️ Excluir transação' }
    );
  }

  return { title, description, footer, buttons };
}

// Process message with AI assistant and create transaction
async function processWithAI(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  textToProcess: string,
  businessId: string,
  phone: string,
  customerId: string | null,
  instance: string,
  aiSettings: any,
  businessName: string
): Promise<void> {
  console.log('Processing with AI assistant:', textToProcess.substring(0, 100));
  
  try {
    const aiResponse = await fetch(`${supabaseUrl}/functions/v1/ai-assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        message: textToProcess,
        businessId,
        phone,
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI assistant failed:', await aiResponse.text());
      return;
    }

    const aiResult = await aiResponse.json();
    console.log('AI assistant result:', JSON.stringify(aiResult, null, 2));

    if (aiResult.action === 'needs_more_info' && aiResult.question) {
      // Send question to user
      await sendEvolutionMessage(instance, phone, aiResult.question);
    } else if (aiResult.action === 'complete' && aiResult.data) {
      // Create transaction
      const data = aiResult.data;
      
      // Find or create customer if we have a name
      let txCustomerId: string | null = customerId;
      if (data.customerName && !txCustomerId) {
        const { data: existingCust } = await supabase
          .from('customers')
          .select('id')
          .eq('business_id', businessId)
          .ilike('name', `%${data.customerName}%`)
          .limit(1)
          .single();

        if (existingCust) {
          txCustomerId = existingCust.id;
        } else {
          // Create new customer
          const { data: newCust } = await supabase
            .from('customers')
            .insert({
              business_id: businessId,
              name: data.customerName,
              email: data.email,
              phone: data.phone,
            })
            .select('id')
            .single();
          
          if (newCust) {
            txCustomerId = newCust.id;
            console.log('Created new customer:', txCustomerId);
          }
        }
      }

      // Validate amount before creating transaction
      if (!data.amount || isNaN(Number(data.amount))) {
        console.log('Invalid amount, asking user for clarification');
        await sendEvolutionMessage(instance, phone, 
          '❓ Não consegui identificar o valor da transação. Por favor, envie novamente incluindo o valor (ex: "João pagou R$ 100").');
        return;
      }

      // Create transaction
      const { data: newTransaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          business_id: businessId,
          customer_id: txCustomerId,
          type: data.type || 'income',
          description: data.description || data.customerName || 'Transação',
          amount: Number(data.amount),
          category: data.category || 'Recebimentos',
          status: data.status || 'pending',
          transaction_date: data.date || new Date().toISOString().split('T')[0],
        })
        .select()
        .single();

      if (txError) {
        console.error('Error creating transaction:', txError);
        await sendEvolutionMessage(instance, phone, 
          '❌ Erro ao registrar transação. Por favor, tente novamente.');
      } else {
        console.log('Transaction created:', newTransaction.id);

        // Send confirmation message with interactive buttons
        const confirmMessage = formatTransactionMessage(
          businessName,
          { ...data, date: data.date || new Date().toLocaleDateString('pt-BR') },
          aiSettings.greeting_style || 'friendly',
          newTransaction.id
        );
        
        // Try to send with buttons, fallback is handled inside the function
        await sendEvolutionMessageWithButtons(
          instance,
          phone,
          confirmMessage.title,
          confirmMessage.description,
          confirmMessage.footer,
          confirmMessage.buttons
        );
      }

      // Clear conversation context after completion
      await supabase
        .from('ai_conversations')
        .delete()
        .eq('business_id', businessId)
        .eq('phone', phone);
    }
  } catch (e) {
    console.error('Error calling AI assistant:', e);
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log('Received webhook payload:', JSON.stringify(payload, null, 2));

    // Handle CONNECTION_UPDATE event
    if (payload.event === 'CONNECTION_UPDATE' || payload.event === 'connection.update') {
      console.log('Processing connection update:', payload);
      
      const instanceName = payload.instance;
      const state = payload.data?.state || payload.state;
      
      if (instanceName && state) {
        let whatsappStatus = 'disconnected';
        if (state === 'open' || state === 'connected') {
          whatsappStatus = 'connected';
        } else if (state === 'connecting' || state === 'qr') {
          whatsappStatus = 'waiting_qr';
        }
        
        // Update whatsapp_instances table by instance_name
        const updateData: any = { status: whatsappStatus };
        if (whatsappStatus === 'connected') {
          updateData.connected_at = new Date().toISOString();
        }
        
        const { error } = await supabase
          .from('whatsapp_instances')
          .update(updateData)
          .eq('instance_name', instanceName);
          
        if (error) {
          console.error('Error updating instance status:', error);
        } else {
          console.log('Instance status updated:', whatsappStatus);
        }
      }
      
      return new Response(JSON.stringify({ success: true, message: 'Connection update processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Accept both messages.upsert (received) and send.message (sent from phone)
    const validEvents = ['messages.upsert', 'send.message', 'MESSAGES_UPSERT', 'SEND_MESSAGE'];
    if (!validEvents.includes(payload.event)) {
      console.log('Ignoring event:', payload.event);
      return new Response(JSON.stringify({ success: true, message: 'Event ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('Processing event:', payload.event);

    const isOutbound = payload.data?.key?.fromMe === true;
    const rawRemoteJid: string = payload.data.key.remoteJid;
    const key = payload.data.key as any;
    const senderName = payload.data.pushName || 'Desconhecido';
    const externalId = payload.data.key.id;

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
      if (participant) {
          // Extract phone even from LID format if possible
          const cleanParticipant = participant
            .replace('@s.whatsapp.net', '')
            .replace('@lid', '')
            .replace(/\D/g, '');
          if (cleanParticipant && cleanParticipant.length >= 10) {
            participantPhone = cleanParticipant;
            console.log('Group: Using participant from key:', participantPhone);
          } else {
            console.log('Group: Participant extracted but invalid:', cleanParticipant);
          }
        } else {
          console.log('Group: No participant found in key');
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
          // For outbound LID messages, try to extract from remoteJid directly
          const lidNumber = rawRemoteJid.replace('@lid', '').replace(/\D/g, '');
          if (lidNumber && lidNumber.length >= 10) {
            console.log('Using LID number directly:', lidNumber);
            jidForContact = rawRemoteJid;
          } else {
            console.log('LID message without real number - saving anyway:', rawRemoteJid);
            // Don't return early - save with LID format for reference
          }
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
    let audioBase64: string | null = null;
    let audioMimeType: string | null = null;

    const msg = payload.data.message;
    
    if (msg?.conversation) {
      messageContent = msg.conversation;
    } else if (msg?.extendedTextMessage?.text) {
      messageContent = msg.extendedTextMessage.text;
    }
    else if (msg?.imageMessage) {
      messageContent = msg.imageMessage.caption || '[Imagem]';
      mediaType = 'image';
      hasMedia = true;
      mediaMetadata = {
        width: msg.imageMessage.width,
        height: msg.imageMessage.height,
      };
    }
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
    else if (msg?.audioMessage) {
      messageContent = msg.audioMessage.ptt ? '[Áudio]' : '[Áudio]';
      mediaType = 'audio';
      hasMedia = true;
      mediaMetadata = {
        duration: msg.audioMessage.seconds,
        isVoiceNote: msg.audioMessage.ptt || false,
      };
    }
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
      if (lat && lng) {
        mediaUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      }
    }
    else if (msg?.contactMessage) {
      const displayName = msg.contactMessage.displayName || 'Contato';
      messageContent = `[Contato: ${displayName}]`;
      mediaType = 'contact';
      mediaMetadata = {
        displayName: displayName,
        vcard: msg.contactMessage.vcard,
      };
    }
    else if (msg?.contactsArrayMessage?.contacts) {
      const contacts = msg.contactsArrayMessage.contacts;
      const names = contacts.map((c: any) => c.displayName || 'Contato').join(', ');
      messageContent = `[Contatos: ${names}]`;
      mediaType = 'contacts';
      mediaMetadata = {
        contacts: contacts.map((c: any) => ({
          displayName: c.displayName,
          vcard: c.vcard,
        })),
      };
    }

    // If no content and no media, still save as system message
    if (!messageContent && !hasMedia) {
      messageContent = '[Mensagem do sistema]';
      console.log('No message content - saving as system message');
    }

    // Get business and user from instance
    const instanceName = payload.instance;
    
    const { data: instance, error: instError } = await supabase
      .from('whatsapp_instances')
      .select('user_id, business_id, businesses(name)')
      .eq('instance_name', instanceName)
      .single();

    if (instError || !instance) {
      console.error('No instance found for:', instanceName, instError);
      return new Response(JSON.stringify({ error: 'Instance not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const businessId = instance.business_id;
    const userId = instance.user_id;
    const businessName = (instance as any).businesses?.name || 'Negócio';

    // Download and store media if present
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
        
        // Keep audio base64 for transcription
        if (mediaType === 'audio' && mediaResult.base64) {
          audioBase64 = mediaResult.base64;
          audioMimeType = mediaResult.mimeType || 'audio/ogg';
        }
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

    // For individual chats, link to lead/customer
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

    // Check AI settings for this business
    const { data: aiSettings } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('business_id', businessId)
      .single();

    let transcribedText: string | null = null;
    let transcriptionError: string | null = null;
    let aiProcessed = false;

    // Process with AI if enabled and message is from admin phone
    if (aiSettings?.enabled && !isOutbound && !isGroup) {
      const adminPhones = aiSettings.admin_phones || (aiSettings.admin_phone ? [aiSettings.admin_phone] : []);
      const cleanPhone = phone.replace(/\D/g, '');
      const isFromAdmin = adminPhones.some((adminPhone: string) => 
        cleanPhone === adminPhone.replace(/\D/g, '')
      );
      console.log('AI check:', { enabled: aiSettings.enabled, isFromAdmin, adminPhones, phone: cleanPhone });

      if (isFromAdmin) {
        console.log('Processing message from admin phone with AI');
        
        // Transcribe audio if present using Lovable AI (Gemini)
        if (mediaType === 'audio' && audioBase64 && aiSettings.auto_transcribe) {
          console.log('Transcribing audio with Lovable AI (Gemini)...');
          
          // Extract duration from metadata for plausibility check
          const audioDuration = mediaMetadata?.duration || null;
          console.log('Audio duration for transcription:', audioDuration);
          
          try {
            const transcribeResponse = await fetch(`${supabaseUrl}/functions/v1/ai-transcribe-audio`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                audioBase64,
                mimeType: audioMimeType,
                durationSec: audioDuration, // Pass duration for plausibility check
              }),
            });

            if (transcribeResponse.ok) {
              const transcribeResult = await transcribeResponse.json();
              transcribedText = transcribeResult.transcription;
              console.log('Lovable AI transcription successful:', transcribedText?.substring(0, 100));
            } else {
              const errorBody = await transcribeResponse.text();
              console.log('Lovable AI transcription failed, status:', transcribeResponse.status);
              
              try {
                const errorJson = JSON.parse(errorBody);
                if (errorJson.error === 'no_speech_detected') {
                  transcriptionError = 'Sem fala detectada no áudio';
                } else if (errorJson.error === 'low_confidence') {
                  transcriptionError = 'Baixa confiança na transcrição';
                  // For low confidence, ask user to type manually
                  await sendEvolutionMessage(payload.instance, phone, 
                    '⚠️ Não consegui transcrever o áudio com confiança.\n\nPor favor, *digite o texto* que você falou ou *grave novamente* de forma mais clara.');
                } else if (errorJson.error === 'rate_limit') {
                  transcriptionError = 'Limite de requisições excedido';
                } else if (errorJson.error === 'payment_required') {
                  transcriptionError = 'Créditos insuficientes';
                } else {
                  transcriptionError = errorJson.details || errorJson.error || `Erro ${transcribeResponse.status}`;
                }
              } catch {
                transcriptionError = `Erro ${transcribeResponse.status}: ${errorBody.substring(0, 200)}`;
              }
            }
          } catch (e) {
            console.error('Error calling transcribe function:', e);
            transcriptionError = e instanceof Error ? e.message : 'Erro desconhecido na transcrição';
          }
          
          // Ensure empty string is saved as null
          if (transcribedText === '') {
            transcribedText = null;
          }
        }

        // Check if we have a pending confirmation
        const { data: existingConversation } = await supabase
          .from('ai_conversations')
          .select('*')
          .eq('business_id', businessId)
          .eq('phone', phone)
          .single();

        const textToProcess = transcribedText || messageContent;
        const upperText = textToProcess.toUpperCase().trim();

        // Handle confirmation responses
        if (existingConversation?.stage === 'awaiting_confirmation') {
          const pendingData = existingConversation.pending_data as any;
          
          if (upperText === 'SIM' || upperText === 'S' || upperText === 'YES' || upperText === 'CONFIRMAR') {
            // User confirmed - process with original transcription
            console.log('User confirmed transcription, processing...');
            const confirmedText = pendingData?.transcription || textToProcess;
            
            await processWithAI(
              supabase, supabaseUrl, supabaseServiceKey,
              confirmedText, businessId, phone, customerId,
              payload.instance, aiSettings, businessName
            );
            aiProcessed = true;
            
          } else if (upperText === 'NAO' || upperText === 'NÃO' || upperText === 'N' || upperText === 'NO' || upperText === 'CANCELAR') {
            // User cancelled
            console.log('User cancelled, clearing conversation');
            await supabase
              .from('ai_conversations')
              .delete()
              .eq('business_id', businessId)
              .eq('phone', phone);
            
            await sendEvolutionMessage(payload.instance, phone, '❌ Operação cancelada. Envie um novo áudio quando quiser registrar algo.');
            aiProcessed = true;
            
          } else {
            // User sent corrected text - use this instead
            console.log('User sent correction, processing with corrected text:', textToProcess.substring(0, 50));
            
            await processWithAI(
              supabase, supabaseUrl, supabaseServiceKey,
              textToProcess, businessId, phone, customerId,
              payload.instance, aiSettings, businessName
            );
            aiProcessed = true;
          }
        } else if (textToProcess && textToProcess !== '[Áudio]' && aiSettings.auto_respond) {
          // New message - check if it's audio that needs confirmation
          if (mediaType === 'audio' && transcribedText) {
            console.log('Audio transcribed, asking for confirmation');
            
            // Save pending transcription
            await supabase
              .from('ai_conversations')
              .upsert({
                business_id: businessId,
                phone: phone,
                stage: 'awaiting_confirmation',
                pending_data: { transcription: transcribedText },
                last_intent: 'transcription',
                expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min expiry
                updated_at: new Date().toISOString(),
              }, { onConflict: 'business_id,phone' });
            
            // Send confirmation request
            const confirmationMessage = 
              `📝 *Entendi o seguinte:*\n\n` +
              `"${transcribedText}"\n\n` +
              `✅ Digite *SIM* para confirmar\n` +
              `✏️ Ou envie o *texto corrigido*\n` +
              `❌ Digite *NAO* para cancelar`;
            
            await sendEvolutionMessage(payload.instance, phone, confirmationMessage);
            aiProcessed = true;
            
          } else if (messageContent !== '[Áudio]') {
            // Text message - process directly (no confirmation needed for text)
            console.log('Text message, processing directly with AI');
            
            await processWithAI(
              supabase, supabaseUrl, supabaseServiceKey,
              textToProcess, businessId, phone, customerId,
              payload.instance, aiSettings, businessName
            );
            aiProcessed = true;
          }
        }
      }
    }

    // Save the message with user_id for individual ownership
    const { data: savedMessage, error: msgError } = await supabase
      .from('whatsapp_messages')
      .insert({
        business_id: businessId,
        user_id: userId,
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
        transcribed_text: transcribedText,
        transcription_error: transcriptionError,
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

    console.log('Message saved successfully:', savedMessage.id, isGroup ? '(group)' : '(individual)', 'direction:', isOutbound ? 'outbound' : 'inbound', 'mediaType:', mediaType, 'aiProcessed:', aiProcessed);

    return new Response(JSON.stringify({ 
      success: true, 
      message_id: savedMessage.id,
      lead_id: leadId,
      customer_id: customerId,
      is_group: isGroup,
      media_stored: !!mediaUrl,
      transcribed: !!transcribedText,
      ai_processed: aiProcessed,
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
