import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];
    console.log(`Processing recurring transactions for date: ${today}`);

    // Find recurring transactions that need to be processed
    const { data: recurringTransactions, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('is_recurring', true)
      .lte('next_due_date', today)
      .is('parent_transaction_id', null); // Only original recurring transactions

    if (fetchError) {
      console.error('Error fetching recurring transactions:', fetchError);
      throw fetchError;
    }

    if (!recurringTransactions || recurringTransactions.length === 0) {
      console.log('No recurring transactions to process');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No recurring transactions to process',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${recurringTransactions.length} recurring transactions to process`);

    let processedCount = 0;
    let skippedCount = 0;

    for (const transaction of recurringTransactions) {
      try {
        // Check if recurrence has ended
        if (transaction.recurrence_end_date && transaction.recurrence_end_date < today) {
          console.log(`Transaction ${transaction.id} recurrence has ended`);
          skippedCount++;
          continue;
        }

        // Calculate next due date based on pattern
        const currentDueDate = new Date(transaction.next_due_date);
        let nextDueDate: Date;

        switch (transaction.recurrence_pattern) {
          case 'daily':
            nextDueDate = new Date(currentDueDate);
            nextDueDate.setDate(nextDueDate.getDate() + (transaction.recurrence_interval || 1));
            break;
          case 'weekly':
            nextDueDate = new Date(currentDueDate);
            nextDueDate.setDate(nextDueDate.getDate() + 7);
            break;
          case 'biweekly':
            nextDueDate = new Date(currentDueDate);
            nextDueDate.setDate(nextDueDate.getDate() + 14);
            break;
          case 'monthly':
            nextDueDate = new Date(currentDueDate);
            nextDueDate.setMonth(nextDueDate.getMonth() + 1);
            break;
          case 'custom':
            nextDueDate = new Date(currentDueDate);
            nextDueDate.setDate(nextDueDate.getDate() + (transaction.recurrence_interval || 30));
            break;
          default:
            nextDueDate = new Date(currentDueDate);
            nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        }

        const nextDueDateStr = nextDueDate.toISOString().split('T')[0];

        // Create new transaction
        const newTransaction = {
          business_id: transaction.business_id,
          type: transaction.type,
          description: transaction.description,
          amount: transaction.amount,
          category: transaction.category,
          customer_id: transaction.customer_id,
          transaction_date: transaction.next_due_date,
          due_date: transaction.next_due_date,
          notes: transaction.notes,
          status: 'pending',
          is_recurring: false, // Child transactions are not recurring themselves
          parent_transaction_id: transaction.id,
        };

        const { error: insertError } = await supabase
          .from('transactions')
          .insert(newTransaction);

        if (insertError) {
          console.error(`Error creating transaction for ${transaction.id}:`, insertError);
          continue;
        }

        // Update original transaction with next due date
        const { error: updateError } = await supabase
          .from('transactions')
          .update({ next_due_date: nextDueDateStr })
          .eq('id', transaction.id);

        if (updateError) {
          console.error(`Error updating next_due_date for ${transaction.id}:`, updateError);
          continue;
        }

        console.log(`Created recurring transaction from ${transaction.id}, next due: ${nextDueDateStr}`);
        processedCount++;

      } catch (error) {
        console.error(`Error processing transaction ${transaction.id}:`, error);
      }
    }

    console.log(`Processed ${processedCount} transactions, skipped ${skippedCount}`);

    return new Response(JSON.stringify({ 
      success: true, 
      processed: processedCount,
      skipped: skippedCount,
      total: recurringTransactions.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-recurring-transactions:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});