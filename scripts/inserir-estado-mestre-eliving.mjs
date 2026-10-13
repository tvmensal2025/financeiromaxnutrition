import { requireEnv } from './require-env.mjs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wxkgrykduqtsgmjkzlou.supabase.co';
const SUPABASE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { data: existente } = await supabase.from('estado_mestre').select('*').eq('related_id', 'BIZ-004').maybeSingle();
  if (existente) {
    console.log('BIZ-004 já existe em estado_mestre:', existente);
    return;
  }
  const { data, error } = await supabase.from('estado_mestre').insert({
    area: 'Portfólio',
    item: 'E-living',
    estado_atual: 'Empresa criada formalmente pelo fundador com o slogan "Onde sua evolução ganha direção". Tecnologia inteligente aplicada à saúde, evolução pessoal e comportamento humano.',
    ultima_mudanca: '2026-10-04',
    fonte: 'Fundador (instrução soberana)',
    confirmacao: 'CONFIRMADO',
    proxima_acao: 'Desdobrar as 12 entregas da blueprint com os agentes sob coordenação de Helena e revisão de Bruno/Clara.',
    responsavel: 'Helena + Equipe de Agentes',
    related_id: 'BIZ-004',
    scope_type: 'GLOBAL'
  }).select();

  console.log('Inserido estado_mestre:', data, error);
}

main().catch(console.error);
