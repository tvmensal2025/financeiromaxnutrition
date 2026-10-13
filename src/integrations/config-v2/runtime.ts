import { criarRepositorioConfigV2, type ClienteConfigV2 } from './repository';

export async function repositorioConfigV2DoApp() {
  if (import.meta.env.VITE_HELENA_V2_HABILITADA !== 'true') throw new Error('A configuração da Helena v2 ainda não está habilitada.');
  const { supabase } = await import('@/lib/supabase');
  return criarRepositorioConfigV2(supabase as unknown as ClienteConfigV2);
}
