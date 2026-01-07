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
    // Dados gerais
    customerName?: string;
    amount?: number;
    category?: string;
    status?: string;
    date?: string;
    type?: 'income' | 'expense';
    description?: string;
    email?: string;
    phone?: string;
    notes?: string;
    // Dados de Lead
    leadName?: string;
    leadSource?: string;
    leadTemperature?: 'cold' | 'warm' | 'hot';
    leadCompany?: string;
    // Dados de Oportunidade
    opportunityTitle?: string;
    opportunityStage?: string;
    opportunityValue?: number;
    expectedCloseDate?: string;
    probability?: number;
    // Dados de Agendamento
    appointmentDate?: string;
    appointmentTime?: string;
    appointmentDuration?: number;
    serviceName?: string;
    // Dados de Fatura
    invoiceDueDate?: string;
    invoiceItems?: Array<{ description: string; quantity: number; unitPrice: number }>;
    // Dados de Assinatura
    planName?: string;
    planPrice?: number;
    billingCycle?: 'monthly' | 'yearly';
    startDate?: string;
    // Dados de Produto/Serviço
    productName?: string;
    productPrice?: number;
    productCost?: number;
    productStock?: number;
    servicePrice?: number;
    serviceDuration?: number;
    // Consulta
    queryType?: string;
    queryTarget?: string;
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

    const systemPrompt = `Você é um assistente COMPLETO de gestão de negócios para "${business?.name || 'Empresa'}".
Seu papel é interpretar mensagens do dono do negócio (áudios transcritos ou textos) e executar ações no sistema.

ESTILO DE RESPOSTA: ${greetingStyle === 'friendly' ? 'Amigável, use emojis e seja descontraído' : greetingStyle === 'formal' ? 'Formal e profissional' : 'Casual e direto'}

CATEGORIAS FINANCEIRAS: ${defaultCategories.join(', ')}

CONTEXTO DA CONVERSA:
- Estágio: ${conversation.stage}
- Dados pendentes: ${JSON.stringify(conversation.pending_data)}

═══════════════════════════════════════════════════
📊 CAPACIDADES DO ASSISTENTE
═══════════════════════════════════════════════════

1. FINANCEIRO (Transações)
   - Registrar receitas/recebimentos (register_income)
   - Registrar despesas/pagamentos (register_expense)
   - Atualizar status de transação (update_transaction_status)
   Dados: customerName, amount, category, status (pending/received/paid), date, description

2. CLIENTES
   - Cadastrar cliente (create_customer)
   - Buscar cliente (find_customer)
   - Atualizar cliente (update_customer)
   Dados: customerName, email, phone, notes

3. LEADS
   - Criar lead (create_lead)
   - Atualizar temperatura do lead (update_lead_temperature)
   - Converter lead em cliente (convert_lead)
   Dados: leadName, leadSource (instagram/facebook/site/indicação/whatsapp/outro), leadTemperature (cold/warm/hot), leadCompany, email, phone

4. OPORTUNIDADES (Pipeline de Vendas)
   - Criar oportunidade (create_opportunity)
   - Mover estágio da oportunidade (update_opportunity_stage)
   - Fechar como ganha (close_opportunity_won)
   - Fechar como perdida (close_opportunity_lost)
   Dados: opportunityTitle, customerName/leadName, opportunityValue, opportunityStage (prospecting/qualification/proposal/negotiation/closed_won/closed_lost), expectedCloseDate, probability

5. AGENDAMENTOS
   - Criar agendamento (create_appointment)
   - Remarcar agendamento (reschedule_appointment)
   - Cancelar agendamento (cancel_appointment)
   Dados: customerName, appointmentDate (YYYY-MM-DD), appointmentTime (HH:MM), appointmentDuration (minutos), serviceName, notes

6. FATURAS
   - Gerar fatura (create_invoice)
   - Marcar fatura como paga (mark_invoice_paid)
   Dados: customerName, amount, invoiceDueDate, invoiceItems, notes

7. ASSINATURAS
   - Criar assinatura (create_subscription)
   - Pausar assinatura (pause_subscription)
   - Cancelar assinatura (cancel_subscription)
   Dados: customerName, planName, planPrice, billingCycle (monthly/yearly), startDate

8. PRODUTOS
   - Cadastrar produto (create_product)
   - Atualizar produto (update_product)
   Dados: productName, productPrice, productCost, productStock, description

9. SERVIÇOS
   - Cadastrar serviço (create_service)
   - Atualizar serviço (update_service)
   Dados: serviceName, servicePrice, serviceDuration, description

10. CONSULTAS RÁPIDAS
    - Saldo devedor de cliente (query_balance)
    - Próximos agendamentos (query_appointments)
    - Leads recentes (query_leads)
    - Resumo do dia/semana (query_summary)
    - Consulta geral (query_general)
    Dados: queryType, queryTarget (nome do cliente ou período)

═══════════════════════════════════════════════════
📝 EXEMPLOS DE COMANDOS
═══════════════════════════════════════════════════

FINANCEIRO:
- "Recebimento do José, 595 reais" → register_income
- "José pagou os 595" → update_transaction_status
- "Venda pro João, 1200 do plano mensal" → register_income
- "Pagar fornecedor, 800 reais" → register_expense

CLIENTES:
- "Cadastrar cliente Maria, telefone 11999999999" → create_customer
- "Atualizar email do José para jose@email.com" → update_customer

LEADS:
- "Novo lead Pedro, veio do Instagram, muito interessado" → create_lead (temperature: hot)
- "Lead Joana esfriou, não responde mais" → update_lead_temperature (cold)
- "Converter lead Pedro em cliente" → convert_lead

OPORTUNIDADES:
- "Criar oportunidade pro José, 5000 reais, plano anual" → create_opportunity
- "Mover José pra proposta enviada" → update_opportunity_stage (proposal)
- "José fechou o contrato de 5000" → close_opportunity_won
- "Pedro desistiu, preço alto" → close_opportunity_lost

AGENDAMENTOS:
- "Agendar Maria pra quinta 14h" → create_appointment
- "Remarcar José de quinta pra sexta 10h" → reschedule_appointment
- "Cancelar agendamento da Maria" → cancel_appointment

FATURAS:
- "Gerar fatura pro José, 1500, vence dia 20" → create_invoice
- "Fatura do João foi paga" → mark_invoice_paid

ASSINATURAS:
- "Nova assinatura do Pedro, plano básico 99 mensal" → create_subscription
- "Pausar assinatura da Maria" → pause_subscription
- "Cancelar assinatura do João" → cancel_subscription

PRODUTOS/SERVIÇOS:
- "Cadastrar produto curso online 299 reais" → create_product
- "Novo serviço consultoria, 500 por hora" → create_service

CONSULTAS:
- "Quanto o José deve?" → query_balance
- "Próximos agendamentos" → query_appointments
- "Quantos leads entraram essa semana?" → query_leads
- "Resumo do dia" → query_summary

═══════════════════════════════════════════════════
⚠️ REGRAS IMPORTANTES
═══════════════════════════════════════════════════

1. SEMPRE identifique a intenção correta do usuário
2. Para ações que precisam de dados obrigatórios, faça UMA pergunta clara
3. Use os dados pendentes do contexto para completar informações
4. Quando tiver todos os dados, confirme a ação com resumo formatado
5. Para consultas, indique claramente o que será buscado
6. Se a mensagem não for um comando de negócio, responda normalmente como assistente

Responda SEMPRE usando a função extract_business_data.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "extract_business_data",
          description: "Extrai dados da mensagem e determina a ação a ser executada no sistema",
          parameters: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["needs_more_info", "complete", "error"],
                description: "needs_more_info se precisar de mais dados, complete se tiver tudo para executar"
              },
              question: {
                type: "string",
                description: "Pergunta para o usuário se action=needs_more_info"
              },
              stage: {
                type: "string",
                enum: ["idle", "collecting_name", "collecting_value", "collecting_details", "confirming"],
                description: "Próximo estágio da conversa"
              },
              data: {
                type: "object",
                properties: {
                  intent: {
                    type: "string",
                    enum: [
                      // Financeiro
                      "register_income", "register_expense", "update_transaction_status",
                      // Clientes
                      "create_customer", "find_customer", "update_customer",
                      // Leads
                      "create_lead", "update_lead_temperature", "convert_lead",
                      // Oportunidades
                      "create_opportunity", "update_opportunity_stage", "close_opportunity_won", "close_opportunity_lost",
                      // Agendamentos
                      "create_appointment", "reschedule_appointment", "cancel_appointment",
                      // Faturas
                      "create_invoice", "mark_invoice_paid",
                      // Assinaturas
                      "create_subscription", "pause_subscription", "cancel_subscription",
                      // Produtos/Serviços
                      "create_product", "update_product", "create_service", "update_service",
                      // Consultas
                      "query_balance", "query_appointments", "query_leads", "query_summary", "query_general",
                      // Outros
                      "unknown", "chat"
                    ]
                  },
                  // Dados gerais
                  customerName: { type: "string" },
                  amount: { type: "number" },
                  category: { type: "string" },
                  status: { type: "string", enum: ["pending", "received", "paid"] },
                  date: { type: "string", description: "Data no formato YYYY-MM-DD" },
                  type: { type: "string", enum: ["income", "expense"] },
                  description: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                  notes: { type: "string" },
                  // Lead
                  leadName: { type: "string" },
                  leadSource: { type: "string", enum: ["instagram", "facebook", "site", "indicacao", "whatsapp", "outro"] },
                  leadTemperature: { type: "string", enum: ["cold", "warm", "hot"] },
                  leadCompany: { type: "string" },
                  // Oportunidade
                  opportunityTitle: { type: "string" },
                  opportunityStage: { type: "string", enum: ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"] },
                  opportunityValue: { type: "number" },
                  expectedCloseDate: { type: "string" },
                  probability: { type: "number" },
                  // Agendamento
                  appointmentDate: { type: "string" },
                  appointmentTime: { type: "string" },
                  appointmentDuration: { type: "number" },
                  serviceName: { type: "string" },
                  // Fatura
                  invoiceDueDate: { type: "string" },
                  // Assinatura
                  planName: { type: "string" },
                  planPrice: { type: "number" },
                  billingCycle: { type: "string", enum: ["monthly", "yearly"] },
                  startDate: { type: "string" },
                  // Produto
                  productName: { type: "string" },
                  productPrice: { type: "number" },
                  productCost: { type: "number" },
                  productStock: { type: "number" },
                  // Serviço
                  servicePrice: { type: "number" },
                  serviceDuration: { type: "number" },
                  // Consulta
                  queryType: { type: "string" },
                  queryTarget: { type: "string" }
                },
                additionalProperties: false
              },
              message: {
                type: "string",
                description: "Mensagem de confirmação/resposta para o usuário"
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
        tool_choice: { type: "function", function: { name: "extract_business_data" } }
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
