import { criarRepositorioConfigV2, type ClienteConfigV2 } from './repository';

/** O cliente do Supabase só é carregado ao abrir a tela de configuração. */
export async function repositorioConfigV2DoApp() {
  const { supabase } = await import('@/lib/supabase');
  return criarRepositorioConfigV2(supabase as unknown as ClienteConfigV2);
}
