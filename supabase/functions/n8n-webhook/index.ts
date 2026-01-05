import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Este endpoint é chamado PELO n8n quando uma mensagem é enviada com sucesso
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { message_id, status, error_message } = await req.json()

    console.log('Recebendo callback do n8n:', { message_id, status, error_message })

    if (!message_id) {
      return new Response(
        JSON.stringify({ error: 'message_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Atualizar status da mensagem
    const updateData: Record<string, unknown> = {
      status: status || 'sent',
    }

    if (status === 'sent') {
      updateData.sent_at = new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', message_id)

    if (updateError) {
      console.error('Erro ao atualizar mensagem:', updateError)
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar mensagem' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Mensagem atualizada com sucesso:', message_id)

    return new Response(
      JSON.stringify({ success: true, message_id }),
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
