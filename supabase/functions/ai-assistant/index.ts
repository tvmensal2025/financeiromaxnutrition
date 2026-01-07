import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIResponse {
  action: 'needs_more_info' | 'complete' | 'error';
  question?: string;
  stage?: string;
  data?: {
    intent: string;
    customerName?: string;
    amount?: number;
    category?: string;
    status?: string;
    date?: string;
    type?: 'income' | 'expense';
    description?: string;
    appointmentDate?: string;
    appointmentTime?: string;
    email?: string;
    phone?: string;
  };
  message?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'AI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { message, businessId, phone, conversationContext } = await req.json();

    if (!message || !businessId || !phone) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing AI request:', { message: message.substring(0, 50), businessId, phone });

    // Fetch business info
    const { data: business } = await supabase
      .from('businesses')
      .select('name')
      .eq('id', businessId)
      .single();

    // Fetch AI settings
    const { data: aiSettings } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('business_id', businessId)
      .single();

    const defaultCategories = aiSettings?.default_categories || ['Recebimentos', 'Vendas', 'Serviços', 'Pagamentos', 'Outros'];
    const greetingStyle = aiSettings?.greeting_style || 'friendly';

    // Get or create conversation context
    let conversation = conversationContext;
    if (!conversation) {
      const { data: existingConversation } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('business_id', businessId)
        .eq('phone', phone)
        .gte('expires_at', new Date().toISOString())
        .single();

      conversation = existingConversation || { stage: 'idle', pending_data: {} };
    }

    const systemPrompt = `Você é um assistente financeiro inteligente para o negócio "${business?.name || 'Empresa'}".
Seu papel é interpretar mensagens do dono do negócio (áudios transcritos ou textos) e extrair informações sobre transações financeiras, clientes e agendamentos.

ESTILO DE RESPOSTA: ${greetingStyle === 'friendly' ? 'Amigável, use emojis e seja descontraído' : greetingStyle === 'formal' ? 'Formal e profissional' : 'Casual e direto'}

CATEGORIAS DISPONÍVEIS: ${defaultCategories.join(', ')}

CONTEXTO ATUAL DA CONVERSA:
- Estágio: ${conversation.stage}
- Dados pendentes: ${JSON.stringify(conversation.pending_data)}

INSTRUÇÕES:
1. Analise a mensagem e identifique a intenção do usuário:
   - Registrar recebimento/pagamento
   - Registrar despesa
   - Cadastrar novo cliente
   - Agendar compromisso
   - Atualizar status de transação existente
   
2. Para registrar uma transação, você PRECISA de:
   - Nome do cliente ou descrição (OBRIGATÓRIO)
   - Valor (OBRIGATÓRIO)
   - Tipo: income (recebimento) ou expense (pagamento)
   - Status: received (já recebeu), pending (a receber), paid (pago)
   - Categoria (opcional, usa padrão)
   - Data (opcional, usa hoje)

3. Se faltar alguma informação OBRIGATÓRIA, faça UMA pergunta clara para obtê-la.

4. Use os dados pendentes do contexto para completar informações de mensagens anteriores.

5. Quando tiver todos os dados necessários, confirme a transação.

EXEMPLOS DE INTERPRETAÇÃO:
- "Recebimento do José, 595 reais" → income, customer: José, amount: 595, status: pending
- "José pagou os 595" → Atualizar transação do José para status: received
- "Venda pro João, 1200 do plano mensal" → income, customer: João, amount: 1200, category: Vendas
- "Pagar fornecedor, 800 reais" → expense, description: Fornecedor, amount: 800
- "Agendar José para sexta as 14h" → appointment, customer: José, date/time parsing

Responda SEMPRE usando a função extract_transaction_data.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "extract_transaction_data",
          description: "Extrai dados da mensagem e determina próxima ação",
          parameters: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["needs_more_info", "complete", "error"],
                description: "needs_more_info se precisar de mais dados, complete se tiver tudo"
              },
              question: {
                type: "string",
                description: "Pergunta para o usuário se action=needs_more_info"
              },
              stage: {
                type: "string",
                enum: ["idle", "collecting_name", "collecting_value", "collecting_category", "collecting_date", "collecting_status", "confirming"],
                description: "Próximo estágio da conversa"
              },
              data: {
                type: "object",
                properties: {
                  intent: {
                    type: "string",
                    enum: ["register_income", "register_expense", "update_status", "create_customer", "create_appointment", "unknown"]
                  },
                  customerName: { type: "string" },
                  amount: { type: "number" },
                  category: { type: "string" },
                  status: { type: "string", enum: ["pending", "received", "paid"] },
                  date: { type: "string", description: "Data no formato YYYY-MM-DD" },
                  type: { type: "string", enum: ["income", "expense"] },
                  description: { type: "string" },
                  appointmentDate: { type: "string" },
                  appointmentTime: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" }
                },
                additionalProperties: false
              },
              message: {
                type: "string",
                description: "Mensagem de confirmação se action=complete"
              }
            },
            required: ["action"],
            additionalProperties: false
          }
        }
      }
    ];

    console.log('Calling Lovable AI...');

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        tools,
        tool_choice: { type: "function", function: { name: "extract_transaction_data" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required for AI services' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: 'AI processing failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResult = await response.json();
    console.log('AI response:', JSON.stringify(aiResult, null, 2));

    // Parse tool call response
    let aiResponse: AIResponse = { action: 'error', message: 'Failed to parse AI response' };
    
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        aiResponse = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error('Failed to parse tool call arguments:', e);
      }
    }

    // Merge pending data with new data
    const mergedData = {
      ...conversation.pending_data,
      ...aiResponse.data
    };

    // Update conversation context
    await supabase
      .from('ai_conversations')
      .upsert({
        business_id: businessId,
        phone,
        stage: aiResponse.stage || 'idle',
        pending_data: mergedData,
        last_intent: aiResponse.data?.intent,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'business_id,phone',
        ignoreDuplicates: false
      });

    console.log('AI assistant response:', aiResponse);

    return new Response(JSON.stringify({
      ...aiResponse,
      data: mergedData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-assistant:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
