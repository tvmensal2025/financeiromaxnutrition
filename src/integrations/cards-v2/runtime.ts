import { criarRepositorioCardsV2, type ClienteCardsV2 } from './repository';

/** O cliente do Supabase só é carregado ao abrir a tela dos cards. */
export async function repositorioCardsV2DoApp() {
  const { supabase } = await import('@/lib/supabase');
  return criarRepositorioCardsV2(supabase as unknown as ClienteCardsV2);
}
