import { criarRepositorioPedidosV2, type ClientePedidosV2 } from './repository';

export async function repositorioPedidosV2DoApp() {
  const { supabase } = await import('@/lib/supabase');
  return criarRepositorioPedidosV2(supabase as unknown as ClientePedidosV2);
}
