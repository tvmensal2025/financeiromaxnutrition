import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendMessageRequest {
  customer_id: string
  content: string
  business_id: string
  webhook_url?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { customer_id, content, business_id, webhook_url } = await req.json() as SendMessageRequest

    console.log('Recebendo requisição de envio de mensagem:', { customer_id, content, business_id })

    // Buscar dados do cliente
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, whatsapp, email')
      .eq('id', customer_id)
      .single()

    if (customerError || !customer) {
      console.error('Erro ao buscar cliente:', customerError)
      return new Response(
        JSON.stringify({ error: 'Cliente não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!customer.whatsapp) {
      return new Response(
        JSON.stringify({ error: 'Cliente não possui WhatsApp cadastrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Criar registro da mensagem
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        customer_id,
        content,
        business_id,
        message_type: 'whatsapp',
        status: 'pending',
      })
      .select()
      .single()

    if (messageError) {
      console.error('Erro ao criar mensagem:', messageError)
      return new Response(
        JSON.stringify({ error: 'Erro ao registrar mensagem' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Se tiver webhook_url do n8n configurado, enviar para lá
    if (webhook_url) {
      console.log('Enviando para webhook n8n:', webhook_url)
      
      try {
        const webhookResponse = await fetch(webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message_id: message.id,
            customer_name: customer.name,
            customer_whatsapp: customer.whatsapp,
            customer_email: customer.email,
            content,
            created_at: message.created_at,
          }),
        })

        if (webhookResponse.ok) {
          // Atualizar status da mensagem para 'sent'
          await supabase
            .from('messages')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', message.id)

          console.log('Mensagem enviada com sucesso via n8n')
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Mensagem enviada via n8n',
              message_id: message.id 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } else {
          console.error('Erro ao enviar para n8n:', await webhookResponse.text())
        }
      } catch (webhookError) {
        console.error('Erro ao chamar webhook:', webhookError)
      }
    }

    // Retornar sucesso com link do WhatsApp para envio manual
    const phone = customer.whatsapp.replace(/\D/g, '')
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(content)}`

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mensagem registrada',
        message_id: message.id,
        whatsapp_url: whatsappUrl,
        customer: {
          name: customer.name,
          whatsapp: customer.whatsapp,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro geral:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
