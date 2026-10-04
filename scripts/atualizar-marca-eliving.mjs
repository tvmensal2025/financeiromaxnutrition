import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://wxkgrykduqtsgmjkzlou.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4a2dyeWtkdXF0c2dtamt6bG91Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDEyOTQyOSwiZXhwIjoyMTA1NzA1NDI5fQ.1tf7YBL8ib52pAbVQHVg7Pwwr3iIBAYPOaKg_3dQWek';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('--- 1. CARREGANDO BRANDBOOK OFICIAL DE ELIVING ---');
  const brandPath = path.resolve('src/data/eliving-brand.json');
  const brandIdentity = JSON.parse(fs.readFileSync(brandPath, 'utf8'));

  console.log('--- 2. ATUALIZANDO PORTFOLIO (BIZ-004) PARA eLiving ---');
  const { data: portAtual, error: errPort } = await supabase
    .from('portfolio')
    .update({
      negocio: 'eLiving',
      visao: 'Ser uma das maiores plataformas globais de evolução pessoal, conectando inteligência artificial, saúde e comportamento humano.',
      problema_que_resolve: 'Transformar informações da vida real em decisões melhores. Ajudar pessoas a entenderem seu corpo, seus hábitos e sua evolução através de uma experiência inteligente, personalizada e contínua.',
      publico: 'Pessoas buscando clareza, direção e acompanhamento contínuo para evoluírem todos os dias em sua saúde, alimentação, rotina e bem-estar.',
      modelo_de_receita: 'Plataforma inteligente de acompanhamento de saúde, comportamento e evolução pessoal com 4 pilares: Sirlene (Nutrição), Dr. Vital (Saúde), Alex (Movimento) e Rafael (Hábitos).',
      brand_identity: brandIdentity,
      atualizado_em: new Date().toISOString()
    })
    .eq('business_id', 'BIZ-004')
    .select();

  if (errPort) {
    console.error('Erro ao atualizar portfolio:', errPort);
  } else {
    console.log('✅ Portfolio atualizado:', portAtual);
  }

  console.log('\n--- 3. ATUALIZANDO TAREFAS VINCULADAS ---');
  const { data: tarefas, error: errTarefas } = await supabase
    .from('tarefas')
    .update({
      tarefa: 'Estruturar blueprint estratégico, marca e operação da eLiving™',
      definicao_de_pronto: 'Blueprint completo da eLiving™ ("Onde sua evolução ganha direção") com os 4 pilares: Sirlene (Nutrição), Doutor Vital (Saúde), Alex (Movimento) e Rafael (Hábitos), posicionamento como inteligência pessoal de evolução e governança aprovada.',
      atualizado_em: new Date().toISOString()
    })
    .eq('business_id', 'BIZ-004')
    .select();

  if (errTarefas) {
    console.error('Erro ao atualizar tarefas:', errTarefas);
  } else {
    console.log(`✅ ${tarefas?.length || 0} tarefas atualizadas.`);
  }

  console.log('\n--- 4. ATUALIZANDO ESTADO_MESTRE ---');
  const { data: estadoAtualizado, error: errEstado } = await supabase
    .from('estado_mestre')
    .update({
      item: 'eLiving',
      valor_ou_detalhe: 'Portfólio oficial BIZ-004: eLiving™ ("Onde sua evolução ganha direção"). Status: ATIVO. Marca oficial e 4 pilares configurados.',
      atualizado_em: new Date().toISOString()
    })
    .eq('business_id', 'BIZ-004')
    .select();

  if (errEstado) {
    console.error('Erro ao atualizar estado_mestre:', errEstado);
  } else {
    console.log('✅ Estado mestre atualizado:', estadoAtualizado?.length || 0, 'registros.');
  }

  console.log('\n--- 5. REGISTRANDO DECISÃO VIGENTE DEC-023 ---');
  const { data: decExistente } = await supabase
    .from('decisoes')
    .select('id')
    .eq('id', 'DEC-023')
    .maybeSingle();

  const decisaoData = {
    id: 'DEC-023',
    data: new Date().toISOString().slice(0, 10),
    decisao: 'Oficialização da Marca eLiving™ e Governança Master dos 4 Pilares: A empresa é formalmente eLiving™ (com "e" minúsculo e "L" maiúsculo, sem hífen; estritamente proibido grafar "E-living" ou "Iliving"). Slogan oficial: "Onde sua evolução ganha direção." Posicionamento soberano: inteligência pessoal de evolução (proibido apresentar como app de dieta, contador de calorias ou app fitness comum). Arquitetura dos 4 pilares sinérgicos: 1) Sirlene (Nutrição), 2) Doutor Vital (Saúde), 3) Alex (Movimento), 4) Rafael (Hábitos). Identidade de marca aprovada formalmente para os 21 agentes de IA.',
    motivo: 'Diretiva do Fundador (COMANDO MASTER — AGENTE OFICIAL eLiving™) para unificação, expansão e posicionamento global premium de tecnologia e saúde.',
    status: 'VIGENTE',
    categoria: 'ESTRATÉGIA',
    responsavel: 'Helena',
    business_id: 'BIZ-004',
    evidencia_fonte: 'COMANDO MASTER — AGENTE OFICIAL eLiving™ homologado pelo Fundador em 04/10/2026',
    source_system: 'HELENA',
    sync_status: 'INTERNO',
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString()
  };

  if (decExistente) {
    await supabase.from('decisoes').update(decisaoData).eq('id', 'DEC-023');
    console.log('✅ DEC-023 atualizada com sucesso.');
  } else {
    await supabase.from('decisoes').insert(decisaoData);
    console.log('✅ DEC-023 inserida com sucesso.');
  }

  console.log('\n--- 6. REGISTRANDO MEMORIA_MESTRE ---');
  const { error: errMem } = await supabase
    .from('memoria_mestre')
    .insert({
      data_hora: new Date().toISOString(),
      agente_origem: 'AGT-01',
      assunto: 'COMANDO MASTER — Homologação da Marca eLiving™ e 4 Pilares',
      registro: 'Homologação oficial: a marca canônica é eLiving™ (não E-living). Identidade aprovada no portfólio (BIZ-004) com paleta Azul Profundo (#0B192C), Azul Luminoso (#0EA5E9), Dourado Luz (#F59E0B) e Branco (#FFFFFF), fontes Sora/Inter e integração dos 4 pilares: Sirlene (Nutrição), Dr. Vital (Saúde), Alex (Movimento) e Rafael (Hábitos).',
      proxima_acao: 'Todos os 21 agentes de IA devem proteger, desenvolver e expandir a marca eLiving™ em todos os pontos de contato conforme as diretrizes do comando master.',
      business_id_area: 'BIZ-004',
      source_system: 'HELENA',
      sync_status: 'INTERNO'
    });

  if (errMem) console.error('Erro memoria_mestre:', errMem);
  else console.log('✅ Memória Mestre registrada com sucesso.');

  console.log('\n=== PROCESSO DE SINCRONIZAÇÃO CONCLUÍDO COM SUCESSO ===');
}

main().catch(console.error);
