import { requireEnv } from './require-env.mjs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wxkgrykduqtsgmjkzlou.supabase.co';
const SUPABASE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const memId = 'MEM-ELIVING-MASTER-20261004';
  const { data: existente } = await supabase.from('memoria_mestre').select('id').eq('id', memId).maybeSingle();

  const registro = {
    id: memId,
    data_hora: new Date().toISOString(),
    agente_origem: 'AGT-01',
    assunto: 'COMANDO MASTER — Homologação da Marca eLiving™ e 4 Pilares',
    registro: 'Homologação oficial do Fundador: a marca canônica é eLiving™ (não E-living nem Iliving). Identidade aprovada no portfólio (BIZ-004) com paleta Azul Profundo (#0B192C), Azul Luminoso (#0EA5E9), Dourado Luz (#F59E0B) e Branco (#FFFFFF), fontes Sora/Inter e integração sinérgica dos 4 pilares: Sirlene (Nutrição), Dr. Vital (Saúde), Alex (Movimento) e Rafael (Hábitos). Slogan: "Onde sua evolução ganha direção."',
    proxima_acao: 'Todos os 21 agentes de IA devem proteger, desenvolver e expandir a marca eLiving™ em todos os pontos de contato conforme as diretrizes soberanas do comando master.',
    business_id_area: 'BIZ-004'
  };

  if (existente) {
    const { data, error } = await supabase.from('memoria_mestre').update(registro).eq('id', memId).select();
    console.log('✅ Memória Mestre atualizada:', data, error);
  } else {
    const { data, error } = await supabase.from('memoria_mestre').insert(registro).select();
    console.log('✅ Memória Mestre inserida:', data, error);
  }
}

main().catch(console.error);
