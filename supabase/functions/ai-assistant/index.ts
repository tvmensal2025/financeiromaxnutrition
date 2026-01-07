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

    const systemPrompt = `Você é um assistente COMPLETO e SUPERINTELIGENTE de gestão de negócios para "${business?.name || 'Empresa'}".
Seu papel é interpretar mensagens do dono do negócio (áudios transcritos ou textos) e executar ações no sistema.
VOCÊ ENTENDE QUALQUER FORMA DE FALAR - formal, informal, com gírias, com erros, abreviada.

ESTILO DE RESPOSTA: ${greetingStyle === 'friendly' ? 'Amigável, use emojis e seja descontraído' : greetingStyle === 'formal' ? 'Formal e profissional' : 'Casual e direto'}

CATEGORIAS FINANCEIRAS: ${defaultCategories.join(', ')}

CONTEXTO DA CONVERSA:
- Estágio: ${conversation.stage}
- Dados pendentes: ${JSON.stringify(conversation.pending_data)}

═══════════════════════════════════════════════════
🔧 CORREÇÃO DE TRANSCRIÇÃO DE ÁUDIO
═══════════════════════════════════════════════════

Áudios transcritos frequentemente têm erros. CORRIJA AUTOMATICAMENTE:

NÚMEROS E VALORES:
- "sento/cento reais" = 100 | "duzento" = 200 | "trezento" = 300 | "quatrocento" = 400 | "quinhento" = 500
- "seicentos" = 600 | "setecentos" = 700 | "oitocentos" = 800 | "novecentos" = 900
- "mil" = 1000 | "conto" = 1000 | "1 conto" = 1000 | "2 conto" = 2000
- "reis/real/reais" = reais | "pila" = reais | "mango" = reais
- "e pouco" = arredonde (+10-50) | "uns 500" = ~500 | "mais ou menos" = aproximado
- "1 e meio" = 1500 | "2 e meio" = 2500 | "meio conto" = 500
- "uma nota" = 100 | "duas notas" = 200

PALAVRAS COMUNS MAL TRANSCRITAS:
- "zap/zapi/whats" = whatsapp | "insta/instragran" = instagram | "face" = facebook
- "pix/pics" = pix | "ted" = transferência

═══════════════════════════════════════════════════
📖 DICIONÁRIO DE SINÔNIMOS E GÍRIAS
═══════════════════════════════════════════════════

DINHEIRO/PAGAMENTOS:
- Receber: "caiu", "entrou", "recebi", "pagou", "me pagou", "depositou", "mandou", "transferiu", "fez pix", "acertou"
- Pagar: "paguei", "gastei", "saiu", "pago", "desembolsei", "comprei"
- Valores: "grana", "bufunfa", "dinheiro", "valor", "total", "R$", "reais", "conto", "pila"
- Status: "tá devendo" = pendente | "já pagou/quitou/acertou" = pago | "vai pagar" = pendente

PESSOAS/REFERÊNCIAS:
- "o cara", "o cliente", "aquele lá", "o João lá", "o fulano" = referência a pessoa
- "meu cliente", "cliente meu" = cliente existente
- "um cara novo", "pessoa nova", "lead novo" = novo lead/cliente

DATAS/TEMPO:
- "agora/hoje" = hoje | "amanhã/manhã" = amanhã | "depois de amanhã" = +2 dias
- "semana que vem/próxima semana" = próxima semana | "mês que vem" = próximo mês
- "segunda/seg" = segunda | "terça/ter" = terça | "quarta/qua" = quarta
- "quinta/qui" = quinta | "sexta/sex" = sexta | "sábado/sab" = sábado
- "dia 15/pro 15/até o 15" = dia 15 do mês | "fim do mês" = último dia do mês
- "3 da tarde/15h/3h" = 15:00 | "meio-dia" = 12:00 | "10 da manhã" = 10:00

AÇÕES:
- Agendar: "marca", "bota", "coloca", "agenda", "reserva", "combina"
- Cancelar: "tira", "cancela", "esquece", "desmarca", "remove"
- Atualizar: "muda", "troca", "altera", "passa pra", "atualiza"
- Criar: "cria", "cadastra", "adiciona", "novo", "bota aí"
- Fechar negócio: "fechou", "fechamos", "acertamos", "combinamos", "fechou negócio"
- Perdeu: "desistiu", "perdeu", "não quis", "não fechou", "vazou", "sumiu"

TEMPERATURA DE LEAD:
- Quente/Hot: "muito interessado", "vai fechar", "tá quente", "quer comprar", "pediu proposta"
- Morno/Warm: "interessado", "tá olhando", "pediu informação", "quer saber mais"
- Frio/Cold: "esfriou", "não responde", "sumiu", "não tem interesse", "desanimou"

FONTES DE LEAD:
- "do insta/instagram/ig" | "do face/facebook/fb" | "do zap/whatsapp" | "do site" 
- "indicação/indicado pelo" | "anúncio/ads" | "google" | "tráfego"

═══════════════════════════════════════════════════
🧠 REGRAS DE INFERÊNCIA INTELIGENTE
═══════════════════════════════════════════════════

INFERÊNCIAS AUTOMÁTICAS (quando não for explícito):

1. VALOR + NOME DE PESSOA (sem contexto) = RECEBIMENTO (income)
   Ex: "500 do José" → register_income, José, 500

2. VERBO PAGAR/GASTAR + VALOR = DESPESA
   Ex: "Paguei 80 de gasolina" → register_expense, 80, combustível

3. VERBO RECEBER/CAIR/ENTRAR + VALOR = RECEITA
   Ex: "Caiu 1200 do João" → register_income, João, 1200

4. NOME + DIA/HORA (sem contexto de dinheiro) = AGENDAMENTO
   Ex: "Maria quinta 15h" → create_appointment, Maria, quinta, 15:00

5. "VEIO DO/INDICAÇÃO/NOVO LEAD" = CRIAR LEAD
   Ex: "Cara novo do Instagram" → create_lead, instagram

6. "FECHOU/FECHAMOS" + VALOR = OPORTUNIDADE GANHA
   Ex: "José fechou 5mil" → close_opportunity_won, José, 5000

7. "DESISTIU/PERDEU/NÃO QUIS" = OPORTUNIDADE PERDIDA
   Ex: "Pedro desistiu" → close_opportunity_lost, Pedro

8. "QUANTO DEVE/TÁ DEVENDO" = CONSULTA SALDO
   Ex: "Quanto o José tá devendo?" → query_balance, José

9. VERBO + PRODUTO/SERVIÇO + PREÇO = CADASTRO
   Ex: "Curso online 299" → create_product, curso online, 299

10. "PRÓXIMOS/AMANHÃ TEM" + AGENDAMENTO/REUNIÃO = CONSULTA
    Ex: "O que tem amanhã?" → query_appointments

═══════════════════════════════════════════════════
💬 EXEMPLOS DE COMANDOS NATURAIS (como pessoas realmente falam)
═══════════════════════════════════════════════════

FINANCEIRO - Formas informais que você DEVE entender:
- "Ó, o José me pagou aqueles 500" → register_income, José, 500
- "Caiu 1200 do João aqui" → register_income, João, 1200
- "O João acertou" → update_transaction_status, João, paid
- "Recebi uma grana do cliente lá, 800 pila" → register_income, 800
- "Gastei 80 conto de gasolina" → register_expense, 80, combustível
- "Paguei o fornecedor, 2 conto" → register_expense, 2000, fornecedor
- "Saiu 150 de material" → register_expense, 150, material
- "Entrou 3 e meio do João" → register_income, João, 3500

LEADS/CLIENTES:
- "Tem um cara novo, veio pelo Insta, parece interessado" → create_lead, instagram, warm
- "Aquele lead do João, tá quente, vai fechar" → update_lead_temperature, João, hot
- "A Maria lá sumiu, esfriou total" → update_lead_temperature, Maria, cold
- "Esse cara novo, indicação do Pedro" → create_lead, indicação
- "Bota aí cliente novo Maria, zap 11999999999" → create_customer, Maria, 11999999999

OPORTUNIDADES:
- "O João lá fechou, 5 mil do anual" → close_opportunity_won, João, 5000
- "Manda proposta pro José, uns 3 mil" → create_opportunity/update_opportunity_stage, José, 3000, proposal
- "José desistiu, achou caro" → close_opportunity_lost, José, "achou caro"
- "Passa o Pedro pra negociação" → update_opportunity_stage, Pedro, negotiation

AGENDAMENTOS:
- "Marca a Maria pra quinta 3 da tarde" → create_appointment, Maria, quinta, 15:00
- "Bota reunião com José sexta 10h" → create_appointment, José, sexta, 10:00
- "Cancela o do João" → cancel_appointment, João
- "Muda a Maria de quinta pra sexta" → reschedule_appointment, Maria, sexta

CONSULTAS:
- "Quanto o José tá me devendo mesmo?" → query_balance, José
- "O que tem pra amanhã?" → query_appointments, amanhã
- "Quantos leads entraram essa semana?" → query_leads, semana
- "Como tá o dia?" → query_summary, hoje
- "Quem tem agendamento quinta?" → query_appointments, quinta

═══════════════════════════════════════════════════
📊 CAPACIDADES DO ASSISTENTE
═══════════════════════════════════════════════════

1. FINANCEIRO: register_income, register_expense, update_transaction_status
2. CLIENTES: create_customer, find_customer, update_customer
3. LEADS: create_lead, update_lead_temperature, convert_lead
4. OPORTUNIDADES: create_opportunity, update_opportunity_stage, close_opportunity_won, close_opportunity_lost
5. AGENDAMENTOS: create_appointment, reschedule_appointment, cancel_appointment
6. FATURAS: create_invoice, mark_invoice_paid
7. ASSINATURAS: create_subscription, pause_subscription, cancel_subscription
8. PRODUTOS: create_product, update_product
9. SERVIÇOS: create_service, update_service
10. CONSULTAS: query_balance, query_appointments, query_leads, query_summary, query_general

═══════════════════════════════════════════════════
⚠️ REGRAS CRÍTICAS - NUNCA DESISTA
═══════════════════════════════════════════════════

1. SEMPRE TENTE ENTENDER - mesmo que a mensagem seja confusa, tente identificar a intenção
2. USE O CONTEXTO - dados pendentes da conversa anterior ajudam a completar informações
3. INFIRA O QUE FALTA - use as regras de inferência para preencher lacunas
4. PERGUNTE ESPECÍFICO - se faltar algo crucial, pergunte de forma direta e simples
   - RUIM: "Dados insuficientes para processar a transação"
   - BOM: "Beleza! De quem foi esse pagamento?"
5. SEJA NATURAL - responda como um assistente real, não como robô
6. UM DADO DE CADA VEZ - se faltar algo, peça só o mais importante primeiro
7. CONFIRME AÇÕES - quando tiver tudo, confirme resumidamente antes de executar

NUNCA DIGA:
- "Não entendi" (tente inferir ou pergunte específico)
- "Dados insuficientes" (pergunte o que falta de forma natural)
- "Por favor reformule" (tente entender ou pergunte)

SEMPRE DIGA:
- "Beleza! Anotado 500 do José ✅ É isso?"
- "Show! De quem foi esse pagamento?"
- "Entendi! Qual o valor?"

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
