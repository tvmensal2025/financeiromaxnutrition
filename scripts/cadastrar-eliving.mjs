import { requireEnv } from './require-env.mjs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wxkgrykduqtsgmjkzlou.supabase.co';
const SUPABASE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('1. Verificando se BIZ-004 já existe no portfolio...');
  const { data: existente } = await supabase
    .from('portfolio')
    .select('business_id, negocio')
    .eq('business_id', 'BIZ-004')
    .maybeSingle();

  if (existente) {
    console.log('BIZ-004 já existe no portfolio:', existente);
  } else {
    console.log('Cadastrando E-living no portfolio como BIZ-004...');
    const novaEmpresa = {
      business_id: 'BIZ-004',
      negocio: 'E-living',
      ativo: 'SIM',
      visao: 'Ser uma das melhores plataformas globais de evolução pessoal, conectando inteligência, saúde e comportamento humano.',
      problema_que_resolve: 'Muitas pessoas não deixam de se cuidar por falta de vontade; deixam porque não sabem por onde começar, não conseguem manter uma rotina e não entendem como conduzir sua própria evolução.',
      publico: 'Pessoas buscando evolução pessoal contínua, saúde e qualidade de vida por meio de dados e IA.',
      modelo_de_receita: 'Plataforma inteligente de acompanhamento de saúde, comportamento e evolução pessoal.',
      estagio: 'VALIDAÇÃO',
      objetivo_atual: 'Estruturar blueprint completo de empresa, marca, produto e operação da E-living.',
      marco_atual: 'Briefing oficial MEM-ELIVING-BRIEF-20261004 registrado pelo fundador.',
      definicao_de_saida_do_estagio: 'Posicionamento, arquitetura de produto, MVP e governança aprovados.',
      principal_gargalo: 'Estruturação inicial da proposta de valor e produto.',
      kpi_principal: 'Blueprint estratégico concluído',
      responsavel_executivo: 'Helena + Equipe de 21 Agentes',
      source_system: 'HELENA',
      sync_status: 'INTERNO',
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    };

    const { data: inserido, error: errInsert } = await supabase
      .from('portfolio')
      .insert(novaEmpresa)
      .select()
      .single();

    if (errInsert) {
      console.error('Erro ao cadastrar BIZ-004 no portfolio:', errInsert);
      process.exit(1);
    }
    console.log('✅ BIZ-004 (E-living) cadastrada com sucesso no portfolio:', inserido.business_id, inserido.negocio);
  }

  console.log('\n2. Atualizando tarefa TSK-ELIVING-20261004-001 para vincular business_id = BIZ-004...');
  const { data: taskUpdated, error: errTask } = await supabase
    .from('tarefas')
    .update({
      business_id: 'BIZ-004',
      atualizado_em: new Date().toISOString()
    })
    .eq('task_id', 'TSK-ELIVING-20261004-001')
    .select('task_id, tarefa, business_id, status')
    .single();

  if (errTask) {
    console.error('Erro ao atualizar tarefa:', errTask);
  } else {
    console.log('✅ Tarefa vinculada a BIZ-004 com sucesso:', taskUpdated);
  }

  console.log('\n3. Registrando na memoria_mestre a ativação da E-living no portfólio...');
  const { error: errMem } = await supabase
    .from('memoria_mestre')
    .insert({
      id: `MEM-ELIVING-REG-${Date.now()}`,
      data_hora: new Date().toISOString(),
      tipo: 'DECISAO',
      assunto: 'Ativação formal da E-living no Portfólio de Empresas (BIZ-004)',
      registro: 'A empresa E-living ("Onde sua evolução ganha direção") foi formalmente cadastrada no portfólio oficial como BIZ-004, integrando o seletor multiempresa e a governança executiva.',
      status: 'ATIVO',
      agente_origem: 'AGT-01',
      business_id_area: 'BIZ-004',
      confianca: 'ALTA',
      evidencia_origem: 'Instrução do Fundador e Briefing MEM-ELIVING-BRIEF-20261004',
      proxima_acao: 'Acompanhar desdobramento das 12 entregas da blueprint da E-living pela equipe de agentes.',
      responsavel: 'AGT-01 Helena',
      sensibilidade: 'INTERNO'
    });

  if (errMem) {
    console.error('Erro memoria mestre:', errMem);
  } else {
    console.log('✅ Registro gravado em memoria_mestre com sucesso.');
  }

  console.log('\n--- VERIFICAÇÃO FINAL DO PORTFÓLIO ---');
  const { data: todos } = await supabase.from('portfolio').select('business_id, negocio, estagio, ativo').order('business_id');
  console.table(todos);
}

main().catch(console.error);
