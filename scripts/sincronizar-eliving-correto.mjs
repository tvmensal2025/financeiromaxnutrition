import { requireEnv } from './require-env.mjs';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://wxkgrykduqtsgmjkzlou.supabase.co';
const SUPABASE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('--- 1. CARREGANDO BRANDBOOK OFICIAL DE eLiving™ ---');
  const brandPath = path.resolve('docs/helena/dados-v1/eliving-brand.json');
  const brandIdentity = JSON.parse(fs.readFileSync(brandPath, 'utf8'));

  console.log('\n--- 2. LENDO PORTFOLIO ATUAL (BIZ-004) ---');
  const { data: port, error: errPortRead } = await supabase
    .from('portfolio')
    .select('business_id, negocio, row_version')
    .eq('business_id', 'BIZ-004')
    .single();

  if (errPortRead || !port) {
    console.error('Erro ao ler portfolio BIZ-004:', errPortRead);
    return;
  }
  console.log('Portfolio lido com sucesso:', port.business_id, port.negocio, 'versão:', port.row_version);

  console.log('\n--- 3. GRAVANDO EM PORTFOLIO COM helena_write_record ---');
  const portChanges = {
    negocio: 'eLiving',
    visao: 'Ser uma das maiores plataformas globais de evolução pessoal, conectando inteligência artificial, saúde e comportamento humano.',
    problema_que_resolve: 'Transformar informações da vida real em decisões melhores. Ajudar pessoas a entenderem seu corpo, seus hábitos e sua evolução através de uma experiência inteligente, personalizada e contínua.',
    publico: 'Pessoas buscando clareza, direção e acompanhamento contínuo para evoluírem todos os dias em sua saúde, alimentação, rotina e bem-estar.',
    modelo_de_receita: 'Plataforma inteligente de acompanhamento de saúde, comportamento e evolução pessoal com 4 pilares: Sirlene (Nutrição), Dr. Vital (Saúde), Alex (Movimento) e Rafael (Hábitos).',
    brand_identity: brandIdentity
  };

  const { data: portWritten, error: errPortWrite } = await supabase.rpc('helena_write_record', {
    p_table: 'portfolio',
    p_id: 'BIZ-004',
    p_expected_version: port.row_version,
    p_changes: portChanges,
    p_delete: false
  });

  if (errPortWrite) {
    console.error('Erro no helena_write_record para portfolio:', errPortWrite);
  } else {
    console.log('✅ Portfolio atualizado via helena_write_record:', portWritten);
  }

  console.log('\n--- 4. LENDO E ATUALIZANDO TAREFAS DE BIZ-004 ---');
  const { data: tarefas, error: errTarRead } = await supabase
    .from('tarefas')
    .select('task_id, tarefa, row_version')
    .eq('business_id', 'BIZ-004');

  if (errTarRead) {
    console.error('Erro ao ler tarefas:', errTarRead);
  } else {
    for (const t of tarefas || []) {
      const taskChanges = {
        tarefa: 'Estruturar blueprint estratégico, marca e operação da eLiving™',
        definicao_de_pronto: 'Blueprint completo da eLiving™ ("Onde sua evolução ganha direção") com os 4 pilares: Sirlene (Nutrição), Doutor Vital (Saúde), Alex (Movimento) e Rafael (Hábitos), posicionamento como inteligência pessoal de evolução e governança aprovada.'
      };
      const { data: taskRes, error: errTaskRpc } = await supabase.rpc('helena_write_record', {
        p_table: 'tarefas',
        p_id: t.task_id,
        p_expected_version: t.row_version,
        p_changes: taskChanges,
        p_delete: false
      });
      if (errTaskRpc) {
        console.error(`Erro ao atualizar tarefa ${t.task_id}:`, errTaskRpc);
      } else {
        console.log(`✅ Tarefa ${t.task_id} atualizada com sucesso:`, taskRes?.task_id || t.task_id);
      }
    }
  }

  console.log('\n--- 5. ATUALIZANDO ESTADO_MESTRE ---');
  const { data: estadoReg } = await supabase
    .from('estado_mestre')
    .select('id, row_version')
    .eq('related_id', 'BIZ-004')
    .maybeSingle();

  if (estadoReg) {
    const estadoChanges = {
      item: 'eLiving',
      estado_atual: 'Portfólio oficial BIZ-004: eLiving™ ("Onde sua evolução ganha direção"). Status: ATIVO. Marca aprovada, cores oficiais e arquitetura dos 4 pilares configurados.',
      ultima_mudanca: '2026-10-04',
      proxima_acao: 'Desdobrar as entregas da blueprint da eLiving™ com os 21 agentes de IA sob coordenação de Helena.'
    };
    const { data: estRes, error: errEstRpc } = await supabase.rpc('helena_write_record', {
      p_table: 'estado_mestre',
      p_id: String(estadoReg.id),
      p_expected_version: estadoReg.row_version,
      p_changes: estadoChanges,
      p_delete: false
    });
    if (errEstRpc) {
      console.error('Erro ao atualizar estado_mestre via RPC:', errEstRpc);
    } else {
      console.log('✅ estado_mestre atualizado via RPC:', estRes?.item || 'sucesso');
    }
  }

  console.log('\n--- 6. REGISTRANDO MEMORIA_MESTRE ---');
  const { data: memRes, error: errMem } = await supabase
    .from('memoria_mestre')
    .insert({
      data_hora: new Date().toISOString(),
      agente_origem: 'AGT-01',
      assunto: 'COMANDO MASTER — Homologação da Marca eLiving™ e 4 Pilares',
      registro: 'Homologação oficial do Fundador: a marca canônica é eLiving™ (não E-living). Identidade aprovada no portfólio (BIZ-004) com paleta Azul Profundo (#0B192C), Azul Luminoso (#0EA5E9), Dourado Luz (#F59E0B) e Branco (#FFFFFF), fontes Sora/Inter e integração dos 4 pilares: Sirlene (Nutrição), Dr. Vital (Saúde), Alex (Movimento) e Rafael (Hábitos).',
      proxima_acao: 'Todos os 21 agentes de IA devem proteger, desenvolver e expandir a marca eLiving™ em todos os pontos de contato conforme as diretrizes do comando master.',
      business_id_area: 'BIZ-004'
    })
    .select();

  if (errMem) console.error('Erro memoria_mestre:', errMem);
  else console.log('✅ Memória Mestre registrada com sucesso:', memRes);

  console.log('\n=== SINCRONIZAÇÃO COMPLETA NO SUPABASE FINALIZADA COM SUCESSO ===');
}

main().catch(console.error);
