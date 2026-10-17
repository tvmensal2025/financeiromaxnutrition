import { criarRepositorioComandoV2, type ClienteComandoV2 } from './repository';

/** O cliente do Supabase só é carregado ao abrir a Sala de comando. */
export async function repositorioComandoV2DoApp() {
  const { supabase } = await import('@/lib/supabase');
  return criarRepositorioComandoV2(supabase as unknown as ClienteComandoV2);
}
