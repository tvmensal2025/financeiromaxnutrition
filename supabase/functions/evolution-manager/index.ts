import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  action: 'create' | 'connect' | 'status' | 'logout' | 'delete';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user's business
    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .single();

    if (!profile?.business_id) {
      return new Response(JSON.stringify({ error: 'Negócio não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const businessId = profile.business_id;
    const userId = user.id;

    // Get user's WhatsApp instance
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('user_id', userId)
      .single();

    const body: RequestBody = await req.json();
    const { action } = body;

    // Generate instance name based on user ID (unique per user)
    const instanceName = instance?.instance_name || `user-${userId.substring(0, 8)}`;

    console.log(`Action: ${action}, Instance: ${instanceName}, User: ${userId}`);

    switch (action) {
      case 'create': {
        // Check if instance already exists in Evolution API
        try {
          const checkResponse = await fetch(`${evolutionApiUrl}/instance/connectionState/${instanceName}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evolutionApiKey
            }
          });

          if (checkResponse.ok) {
            const state = await checkResponse.json();
            console.log('Existing instance state:', state);
            
            // Instance exists, check if connected
            if (state?.instance?.state === 'open') {
              // Already connected - upsert instance record
              await supabase
                .from('whatsapp_instances')
                .upsert({
                  user_id: userId,
                  business_id: businessId,
                  instance_name: instanceName,
                  status: 'connected',
                  connected_at: new Date().toISOString()
                }, { onConflict: 'user_id' });

              return new Response(JSON.stringify({
                success: true,
                status: 'connected',
                message: 'WhatsApp já está conectado'
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          }
        } catch (e) {
          console.log('Instance does not exist, will create new one');
        }

        // Create new instance with webhook configured
        const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
        
        const createBody = {
          instanceName: instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          webhook: {
            url: webhookUrl,
            byEvents: false,
            base64: true,
            events: [
              "MESSAGES_UPSERT",
              "SEND_MESSAGE",
              "CONNECTION_UPDATE",
              "QRCODE_UPDATED"
            ]
          }
        };

        console.log('Creating instance with body:', JSON.stringify(createBody));

        const createResponse = await fetch(`${evolutionApiUrl}/instance/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey
          },
          body: JSON.stringify(createBody)
        });

        const createResult = await createResponse.json();
        console.log('Create response:', JSON.stringify(createResult));

        if (!createResponse.ok) {
          // If instance exists error, try to get QR code
          if (createResult?.response?.message?.includes('already') || createResult?.message?.includes('already')) {
            // Instance exists, get QR code
            const qrResponse = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionApiKey
              }
            });

            const qrResult = await qrResponse.json();
            console.log('QR response:', JSON.stringify(qrResult));

            // Upsert instance
            await supabase
              .from('whatsapp_instances')
              .upsert({
                user_id: userId,
                business_id: businessId,
                instance_name: instanceName,
                status: 'waiting_qr'
              }, { onConflict: 'user_id' });

            return new Response(JSON.stringify({
              success: true,
              status: 'waiting_qr',
              qrcode: qrResult?.base64 || qrResult?.qrcode?.base64 || null,
              pairingCode: qrResult?.pairingCode || null,
              instanceName: instanceName
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          return new Response(JSON.stringify({
            error: 'Erro ao criar instância',
            details: createResult
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Upsert instance with instance name
        await supabase
          .from('whatsapp_instances')
          .upsert({
            user_id: userId,
            business_id: businessId,
            instance_name: instanceName,
            status: 'waiting_qr'
          }, { onConflict: 'user_id' });

        return new Response(JSON.stringify({
          success: true,
          status: 'waiting_qr',
          qrcode: createResult?.qrcode?.base64 || createResult?.base64 || null,
          pairingCode: createResult?.pairingCode || null,
          instanceName: instanceName
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'connect': {
        if (!instance?.instance_name) {
          return new Response(JSON.stringify({ error: 'Instância não encontrada' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get QR code for existing instance
        const qrResponse = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey
          }
        });

        const qrResult = await qrResponse.json();
        console.log('Connect QR response:', JSON.stringify(qrResult));

        // Update status
        await supabase
          .from('whatsapp_instances')
          .update({ status: 'waiting_qr' })
          .eq('user_id', userId);

        return new Response(JSON.stringify({
          success: true,
          status: 'waiting_qr',
          qrcode: qrResult?.base64 || qrResult?.qrcode?.base64 || null,
          pairingCode: qrResult?.pairingCode || null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'status': {
        if (!instance?.instance_name) {
          return new Response(JSON.stringify({
            success: true,
            status: 'disconnected',
            message: 'Nenhuma instância configurada'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check connection status
        const stateResponse = await fetch(`${evolutionApiUrl}/instance/connectionState/${instanceName}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey
          }
        });

        if (!stateResponse.ok) {
          return new Response(JSON.stringify({
            success: true,
            status: 'disconnected',
            message: 'Instância não encontrada'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const stateResult = await stateResponse.json();
        console.log('State response:', JSON.stringify(stateResult));

        const state = stateResult?.instance?.state || stateResult?.state || 'close';
        
        let whatsappStatus = 'disconnected';
        if (state === 'open' || state === 'connected') {
          whatsappStatus = 'connected';
        } else if (state === 'connecting') {
          whatsappStatus = 'waiting_qr';
        }

        // Update instance status
        const updateData: any = { status: whatsappStatus };
        if (whatsappStatus === 'connected') {
          updateData.connected_at = new Date().toISOString();
        }
        
        await supabase
          .from('whatsapp_instances')
          .update(updateData)
          .eq('user_id', userId);

        // Try to get phone number if connected
        let phoneNumber = instance.phone;
        if (whatsappStatus === 'connected' && !phoneNumber) {
          try {
            const infoResponse = await fetch(`${evolutionApiUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionApiKey
              }
            });
            
            if (infoResponse.ok) {
              const instances = await infoResponse.json();
              const inst = instances?.[0] || instances;
              phoneNumber = inst?.owner?.split('@')?.[0] || inst?.profilePicUrl?.split('/')?.[4]?.split('-')?.[0] || null;
              
              if (phoneNumber) {
                await supabase
                  .from('whatsapp_instances')
                  .update({ phone: phoneNumber })
                  .eq('user_id', userId);
              }
            }
          } catch (e) {
            console.log('Could not get phone number:', e);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          status: whatsappStatus,
          phone: phoneNumber,
          instanceName: instanceName
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'logout': {
        if (!instance?.instance_name) {
          return new Response(JSON.stringify({ error: 'Instância não encontrada' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Logout/disconnect instance
        const logoutResponse = await fetch(`${evolutionApiUrl}/instance/logout/${instanceName}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey
          }
        });

        console.log('Logout response status:', logoutResponse.status);

        // Update instance status
        await supabase
          .from('whatsapp_instances')
          .update({
            status: 'disconnected',
            phone: null
          })
          .eq('user_id', userId);

        return new Response(JSON.stringify({
          success: true,
          status: 'disconnected',
          message: 'WhatsApp desconectado'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'delete': {
        if (!instance?.instance_name) {
          return new Response(JSON.stringify({ 
            success: true,
            status: 'disconnected',
            message: 'Nenhuma instância para remover' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Delete instance from Evolution API
        const deleteResponse = await fetch(`${evolutionApiUrl}/instance/delete/${instanceName}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey
          }
        });

        console.log('Delete response status:', deleteResponse.status);

        // Delete instance record
        await supabase
          .from('whatsapp_instances')
          .delete()
          .eq('user_id', userId);

        return new Response(JSON.stringify({
          success: true,
          status: 'disconnected',
          message: 'Instância removida'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Ação inválida' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
