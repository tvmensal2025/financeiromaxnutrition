import { requireEnv } from './require-env.mjs';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://wxkgrykduqtsgmjkzlou.supabase.co';
const SUPABASE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('--- 1. CARREGANDO BRANDBOOK OFICIAL DE ELIVING ---');
  const brandPath = path.resolve('src/data/eliving-brand.json');
  const brandIdentity = JSON.parse(fs.readFileSync(brandPath, 'utf8'));

  console.log('--- 2. LENDO VERSÃO ATUAL DO PORTFOLIO (BIZ-004) ---');
  const { data: portAtual, error: errLeitura } = await supabase
    .from('portfolio')
    .select('business_id, row_version, negocio')
    .eq('business_id', 'BIZ-004')
    .single();

  if (errLeitura || !portAtual) {
    console.error('Erro na leitura de BIZ-004:', errLeitura);
    return;
  }

  console.log(`Versão encontrada: ${portAtual.row_version}. Atualizando via helena_write_record...`);
  const { data: gravacao, error: errGravacao } = await supabase.rpc('helena_write_record', {
    p_table: 'portfolio',
    p_id: 'BIZ-004',
    p_expected_version: portAtual.row_version,
    p_changes: {
      negocio: 'eLiving',
      visao: 'Ser uma das maiores plataformas globais de evolução pessoal, conectando inteligência artificial, saúde e comportamento humano.',
      problema_que_resolve: 'A eLiving existe para combater: pessoas tentando cuidar da saúde sozinhas, excesso de informação sem orientação, aplicativos isolados sem conexão, falta de continuidade e dificuldade de transformar conhecimento em hábito.',
      publico: 'Usuário chega cansado, frustrado, buscando mudança, querendo orientação e com medo de continuar igual. Conduzido para esperança, clareza, confiança e ação.',
      modelo_de_receita: 'Plataforma inteligente de acompanhamento de saúde, comportamento e evolução pessoal com 4 pilares: Sirlene (Nutrição), Dr. Vital (Saúde), Alex (Movimento) e Rafael (Hábitos).',
      brand_identity: brandIdentity
    },
    p_delete: false
  });

  if (errGravacao) {
    console.error('Erro ao gravar portfolio:', errGravacao);
  } else {
    console.log('✅ Portfolio BIZ-004 atualizado com sucesso:', gravacao);
  }

  console.log('\n--- 3. REGISTRANDO/ATUALIZANDO DECISÃO VIGENTE DEC-023 ---');
  const decisaoData = {
    decision_id: 'DEC-023',
    business_id: 'BIZ-004',
    escopo: 'GLOBAL',
    tipo: 'ESTRATÉGIA',
    decisao: 'Oficialização Master da Marca eLiving™: Arquétipos (O Guia, O Cuidador, O Inovador), Combate ao Isolamento/Excesso de Informação, Diferencial Único ("conecta a pessoa inteira"), Regra Suprema do Agente ("Isso aproxima a pessoa da sua evolução?"), Regra Visual 2026 (Apple/OpenAI), Direção de Fotografia ("pessoas reais evoluindo"), Paleta com códigos HEX e RGB (Azul Profundo #0B192C, Azul Luminoso #0EA5E9, Dourado Luz #F59E0B, Branco #FFFFFF) e Governança dos 4 Pilares (Sirlene, Doutor Vital, Alex, Rafael).',
    motivo: 'Diretiva do Fundador para estruturação completa da identidade, tom de voz, compliance e estética de 2026 da eLiving™.',
    decisor: 'Fundador',
    evidencia_fonte: 'docs/COMANDO-MASTER-ELIVING.md e docs/MANUAL-DE-COMPORTAMENTO-AGENTES-ELIVING.md',
    impacto_esperado: 'Marca blindada, consistente e pronta para orientar IA de criação, designers, copywriters e desenvolvedores com padrão global.',
    status: 'VIGENTE',
    data_hora: new Date().toISOString()
  };

  const { error: errDec } = await supabase
    .from('decisoes')
    .upsert(decisaoData, { onConflict: 'decision_id' });

  if (errDec) {
    console.warn('Aviso decisoes:', errDec.message);
  } else {
    console.log('✅ DEC-023 sincronizada com sucesso.');
  }

  console.log('\n=== PROCESSO DE SINCRONIZAÇÃO DA MARCA CONCLUÍDO COM SUCESSO ===');
}

main().catch(console.error);
