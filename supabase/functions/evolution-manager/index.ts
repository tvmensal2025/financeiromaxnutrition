import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  action: 'create' | 'connect' | 'status' | 'logout' | 'delete';
  business_id?: string;
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

    // Get business data
    const { data: business } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (!business) {
      return new Response(JSON.stringify({ error: 'Negócio não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body: RequestBody = await req.json();
    const { action } = body;

    // Generate instance name based on business ID
    const instanceName = business.evolution_instance || `biz-${businessId.substring(0, 8)}`;

    console.log(`Action: ${action}, Instance: ${instanceName}`);

    switch (action) {
      case 'create': {
        // Check if instance already exists
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
              // Already connected
              await supabase
                .from('businesses')
                .update({
                  evolution_instance: instanceName,
                  whatsapp_status: 'connected',
                  whatsapp_connected_at: new Date().toISOString()
                })
                .eq('id', businessId);

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

            // Update business
            await supabase
              .from('businesses')
              .update({
                evolution_instance: instanceName,
                whatsapp_status: 'waiting_qr'
              })
              .eq('id', businessId);

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

        // Update business with instance name
        await supabase
          .from('businesses')
          .update({
            evolution_instance: instanceName,
            whatsapp_status: 'waiting_qr'
          })
          .eq('id', businessId);

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
          .from('businesses')
          .update({ whatsapp_status: 'waiting_qr' })
          .eq('id', businessId);

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

        // Update business status
        const updateData: any = { whatsapp_status: whatsappStatus };
        if (whatsappStatus === 'connected') {
          updateData.whatsapp_connected_at = new Date().toISOString();
        }
        
        await supabase
          .from('businesses')
          .update(updateData)
          .eq('id', businessId);

        // Try to get phone number if connected
        let phoneNumber = business.whatsapp_phone;
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
              const instance = instances?.[0] || instances;
              phoneNumber = instance?.owner?.split('@')?.[0] || instance?.profilePicUrl?.split('/')?.[4]?.split('-')?.[0] || null;
              
              if (phoneNumber) {
                await supabase
                  .from('businesses')
                  .update({ whatsapp_phone: phoneNumber })
                  .eq('id', businessId);
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
        // Logout/disconnect instance
        const logoutResponse = await fetch(`${evolutionApiUrl}/instance/logout/${instanceName}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey
          }
        });

        console.log('Logout response status:', logoutResponse.status);

        // Update business status
        await supabase
          .from('businesses')
          .update({
            whatsapp_status: 'disconnected',
            whatsapp_phone: null
          })
          .eq('id', businessId);

        return new Response(JSON.stringify({
          success: true,
          status: 'disconnected',
          message: 'WhatsApp desconectado'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'delete': {
        // Delete instance completely
        const deleteResponse = await fetch(`${evolutionApiUrl}/instance/delete/${instanceName}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey
          }
        });

        console.log('Delete response status:', deleteResponse.status);

        // Update business
        await supabase
          .from('businesses')
          .update({
            evolution_instance: null,
            whatsapp_status: 'disconnected',
            whatsapp_phone: null,
            whatsapp_connected_at: null
          })
          .eq('id', businessId);

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
