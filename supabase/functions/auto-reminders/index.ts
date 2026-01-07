import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Business {
  id: string
  name: string
  n8n_webhook_url: string | null
  reminder_days_before: number
  low_credits_threshold: number
  auto_reminders_enabled: boolean
}

interface SubscriptionWithDetails {
  id: string
  end_date: string
  credits_used: number
  credits_total: number
  status: string
  customer_id: string
  business_id: string
  customers: {
    id: string
    name: string
    whatsapp: string | null
    email: string | null
  }
  plans: {
    name: string
  }
}

interface RecurringCustomer {
  id: string
  name: string
  whatsapp: string | null
  business_id: string
  recurring_due_date: string
  recurring_message_time: string
  recurring_reminder_days: number
  recurring_message_type: string
  recurring_reminder_template: string | null
  recurring_overdue_template: string | null
  interest_type: string
  interested_product_id: string | null
  interested_service_id: string | null
  products: { name: string; price: number } | null
  services: { name: string; price: number } | null
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('pt-BR')
}

function replaceTemplateVariables(
  template: string,
  customerName: string,
  productName: string,
  productPrice: number,
  dueDate: string
): string {
  return template
    .replace(/{nome}/g, customerName)
    .replace(/{produto}/g, productName)
    .replace(/{valor}/g, productPrice.toFixed(2))
    .replace(/{vencimento}/g, formatDate(dueDate))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Iniciando verificação de lembretes automáticos...')

    // Buscar todos os negócios com lembretes automáticos habilitados
    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, n8n_webhook_url, reminder_days_before, low_credits_threshold, auto_reminders_enabled')
      .eq('auto_reminders_enabled', true)
      .not('n8n_webhook_url', 'is', null)

    if (businessError) {
      console.error('Erro ao buscar negócios:', businessError)
      throw businessError
    }

    if (!businesses || businesses.length === 0) {
      console.log('Nenhum negócio com lembretes automáticos habilitados')
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum negócio configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Encontrados ${businesses.length} negócios com lembretes habilitados`)

    const results = {
      renewalReminders: 0,
      lowCreditsAlerts: 0,
      expirationAlerts: 0,
      customerReminders: 0,
      customerOverdue: 0,
      errors: 0,
    }

    for (const business of businesses as Business[]) {
      console.log(`Processando negócio: ${business.name} (${business.id})`)

      if (!business.n8n_webhook_url) {
        console.log(`Negócio ${business.name} não tem webhook configurado, pulando...`)
        continue
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString().split('T')[0]

      // =====================================================
      // 1. PROCESSAR CLIENTES COM ASSINATURAS RECORRENTES
      // =====================================================
      console.log('Buscando clientes com recorrência ativa...')
      
      const { data: recurringCustomers, error: rcError } = await supabase
        .from('customers')
        .select(`
          id, name, whatsapp, business_id, 
          recurring_due_date, recurring_message_time, recurring_reminder_days, 
          recurring_message_type, recurring_reminder_template, recurring_overdue_template,
          interest_type, interested_product_id, interested_service_id,
          products:interested_product_id(name, price),
          services:interested_service_id(name, price)
        `)
        .eq('business_id', business.id)
        .eq('interest_is_recurring', true)
        .not('recurring_due_date', 'is', null)

      if (rcError) {
        console.error('Erro ao buscar clientes recorrentes:', rcError)
        results.errors++
      } else if (recurringCustomers && recurringCustomers.length > 0) {
        console.log(`Encontrados ${recurringCustomers.length} clientes recorrentes para ${business.name}`)

        for (const customer of recurringCustomers as unknown as RecurringCustomer[]) {
          if (!customer.whatsapp) {
            console.log(`Cliente ${customer.name} sem WhatsApp, pulando...`)
            continue
          }

          const dueDate = new Date(customer.recurring_due_date + 'T00:00:00')
          const reminderDate = new Date(dueDate)
          reminderDate.setDate(reminderDate.getDate() - customer.recurring_reminder_days)

          const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          
          // Get product/service info
          const productName = customer.products?.name || customer.services?.name || 'Assinatura'
          const productPrice = customer.products?.price || customer.services?.price || 0

          let messageType: string | null = null
          let content = ''
          const defaultReminderTemplate = 'Olá {nome}! Sua assinatura de {produto} (R$ {valor}) vence em {vencimento}. Podemos confirmar o pagamento?'
          const defaultOverdueTemplate = 'Olá {nome}! Sua fatura de {produto} (R$ {valor}) venceu. Por favor, regularize o pagamento para continuar utilizando o serviço.'

          // Check if should send OVERDUE message (after due date)
          if (daysUntilDue < 0 && (customer.recurring_message_type === 'overdue' || customer.recurring_message_type === 'both')) {
            messageType = 'customer_overdue'
            const template = customer.recurring_overdue_template || defaultOverdueTemplate
            content = replaceTemplateVariables(template, customer.name, productName, productPrice, customer.recurring_due_date)
            results.customerOverdue++
          }
          // Check if should send REMINDER message (X days before)
          else if (daysUntilDue === customer.recurring_reminder_days && 
                   (customer.recurring_message_type === 'reminder' || customer.recurring_message_type === 'both')) {
            messageType = 'customer_reminder'
            const template = customer.recurring_reminder_template || defaultReminderTemplate
            content = replaceTemplateVariables(template, customer.name, productName, productPrice, customer.recurring_due_date)
            results.customerReminders++
          }

          if (messageType && content) {
            console.log(`Enviando ${messageType} para ${customer.name} (${customer.whatsapp})`)

            try {
              // Send to n8n webhook
              const webhookResponse = await fetch(business.n8n_webhook_url!, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message_type: messageType,
                  customer_id: customer.id,
                  customer_name: customer.name,
                  customer_whatsapp: customer.whatsapp,
                  content,
                  product_name: productName,
                  product_price: productPrice,
                  due_date: customer.recurring_due_date,
                  days_until_due: daysUntilDue,
                  created_at: new Date().toISOString(),
                }),
              })

              if (webhookResponse.ok) {
                console.log(`Mensagem ${messageType} enviada para ${customer.name}`)
              } else {
                console.error(`Erro ao enviar para n8n: ${webhookResponse.status}`)
                results.errors++
              }
            } catch (webhookError) {
              console.error('Erro ao chamar webhook:', webhookError)
              results.errors++
            }
          }
        }
      }

      // =====================================================
      // 2. PROCESSAR ASSINATURAS (código existente)
      // =====================================================
      
      // Data limite para lembretes de renovação (X dias no futuro)
      const reminderDate = new Date(today)
      reminderDate.setDate(reminderDate.getDate() + business.reminder_days_before)

      // Buscar assinaturas ativas do negócio
      const { data: subscriptions, error: subError } = await supabase
        .from('subscriptions')
        .select(`
          id, end_date, credits_used, credits_total, status, customer_id, business_id,
          customers!inner (id, name, whatsapp, email),
          plans!inner (name)
        `)
        .eq('business_id', business.id)
        .eq('status', 'active')

      if (subError) {
        console.error(`Erro ao buscar assinaturas do negócio ${business.id}:`, subError)
        results.errors++
        continue
      }

      if (!subscriptions || subscriptions.length === 0) {
        console.log(`Nenhuma assinatura ativa para o negócio ${business.name}`)
        continue
      }

      console.log(`Encontradas ${subscriptions.length} assinaturas ativas para ${business.name}`)

      for (const sub of subscriptions as unknown as SubscriptionWithDetails[]) {
        const customer = sub.customers
        const plan = sub.plans

        if (!customer?.whatsapp) {
          console.log(`Cliente ${customer?.name} sem WhatsApp, pulando...`)
          continue
        }

        const endDate = new Date(sub.end_date)
        endDate.setHours(0, 0, 0, 0)
        
        const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        const creditsRemaining = sub.credits_total - sub.credits_used
        const creditsPercentage = sub.credits_total > 0 ? (creditsRemaining / sub.credits_total) * 100 : 100

        let messageType: string | null = null
        let content = ''

        // 1. Verificar se expirou (assinatura vencida)
        if (endDate < today) {
          messageType = 'expiration'
          content = `Olá ${customer.name}! Sua assinatura do plano ${plan.name} expirou. Renove agora para continuar usando nossos serviços.`
          results.expirationAlerts++
        }
        // 2. Verificar se vai vencer em X dias
        else if (daysUntilExpiry <= business.reminder_days_before && daysUntilExpiry > 0) {
          messageType = 'renewal_reminder'
          content = `Olá ${customer.name}! Sua assinatura do plano ${plan.name} vence em ${daysUntilExpiry} dia${daysUntilExpiry > 1 ? 's' : ''}. Não esqueça de renovar!`
          results.renewalReminders++
        }
        // 3. Verificar créditos baixos
        else if (creditsPercentage <= business.low_credits_threshold && creditsRemaining > 0) {
          messageType = 'low_credits'
          content = `Olá ${customer.name}! Você ainda tem ${creditsRemaining} crédito${creditsRemaining > 1 ? 's' : ''} restante${creditsRemaining > 1 ? 's' : ''} no plano ${plan.name}. Considere renovar para não ficar sem!`
          results.lowCreditsAlerts++
        }

        if (messageType && content) {
          console.log(`Enviando ${messageType} para ${customer.name} (${customer.whatsapp})`)

          try {
            // Criar registro da mensagem
            const { data: message, error: msgError } = await supabase
              .from('messages')
              .insert({
                customer_id: customer.id,
                content,
                business_id: business.id,
                message_type: messageType,
                status: 'pending',
                subscription_id: sub.id,
              })
              .select()
              .single()

            if (msgError) {
              console.error('Erro ao criar mensagem:', msgError)
              results.errors++
              continue
            }

            // Enviar para webhook do n8n
            const webhookResponse = await fetch(business.n8n_webhook_url!, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message_id: message.id,
                message_type: messageType,
                customer_name: customer.name,
                customer_whatsapp: customer.whatsapp,
                customer_email: customer.email,
                content,
                plan_name: plan.name,
                days_until_expiry: daysUntilExpiry,
                credits_remaining: creditsRemaining,
                credits_percentage: creditsPercentage.toFixed(1),
                subscription_id: sub.id,
                created_at: new Date().toISOString(),
              }),
            })

            if (webhookResponse.ok) {
              await supabase
                .from('messages')
                .update({ status: 'sent', sent_at: new Date().toISOString() })
                .eq('id', message.id)
              console.log(`Mensagem ${messageType} enviada para ${customer.name}`)
            } else {
              console.error(`Erro ao enviar para n8n: ${webhookResponse.status}`)
              results.errors++
            }
          } catch (webhookError) {
            console.error('Erro ao chamar webhook:', webhookError)
            results.errors++
          }
        }
      }
    }

    console.log('Resultado final:', results)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Verificação de lembretes concluída',
        results,
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
