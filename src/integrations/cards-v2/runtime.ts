import { criarRepositorioCardsV2, type ClienteCardsV2 } from './repository';

/** O cliente existente só é carregado ao abrir a rota com o rollout habilitado. */
export async function repositorioCardsV2DoApp() {
  if (import.meta.env.VITE_HELENA_V2_HABILITADA !== 'true') {
    throw new Error('A tela dos cards v2 ainda não está habilitada.');
  }
  const { supabase } = await import('@/lib/supabase');
  return criarRepositorioCardsV2(supabase as unknown as ClienteCardsV2);
}
