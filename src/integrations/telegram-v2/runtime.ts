import { criarRepositorioPareamentoTelegramV2, type ClientePareamentoTelegramV2 } from './repository';

export async function repositorioPareamentoTelegramV2DoApp() {
  const { supabase } = await import('@/lib/supabase');
  return criarRepositorioPareamentoTelegramV2(supabase as unknown as ClientePareamentoTelegramV2);
}
