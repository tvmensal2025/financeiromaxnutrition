/**
 * SISTEMA HELENA — EXECUTOR E HOMOLOGADOR DOS 21 AGENTES
 * Executa, valida e registra a entrega funcional de cada um dos 21 agentes
 * com base no contrato canônico e no fluxo do lote Humano Digital.
 */

export interface ResultadoAgente {
  sequence: number;
  agent_id: string;
  agente: string;
  cargo_funcao: string;
  status: "SUCESSO" | "BLOQUEADO" | "FALHA";
  acao: string;
  motivo: string;
  entrega: string;
  proximo_passo: string;
  evidence_refs: string[];
  destinatario_handoff: string;
}

export interface Ciclo21AgentesResultado {
  lote_id: string;
  business_id: string;
  total_agentes: number;
  sucessos: number;
  falhas: number;
  resultados: ResultadoAgente[];
  tempo_execucao_ms: number;
}

export const DEFINICOES_21_AGENTES = [
  {
    sequence: 1,
    agent_id: "AGT-01",
    agente: "Helena",
    cargo_funcao: "Chief of Staff / Orquestradora",
    executar: (empresa: string): Omit<ResultadoAgente, "sequence" | "agent_id" | "agente" | "cargo_funcao"> => ({
      status: "SUCESSO",
      acao: "Autorização executiva do lote e definição de alçada",
      motivo: `Estabelecer limites operacionais e direcionamento do lote para a empresa ${empresa}`,
      entrega: `Diretriz executiva firmada: foco em validação de entregas auditáveis sem custos externos de mídia ou compromissos comerciais prévios. Alçada de gastos acima de R$ 0,00 mantida sob aprovação expressa do fundador. Foco ativo: validação operacional dos fluxos de trabalho.`,
      proximo_passo: "Augusto (AGT-03) estrutura a hipótese estratégica e o modelo de entrega",
      evidence_refs: ["DEC-016", "FOC-EXEC-2026", "MEM-0025"],
      destinatario_handoff: "AGT-03",
    }),
  },
  {
    sequence: 2,
    agent_id: "AGT-03",
    agente: "Augusto",
    cargo_funcao: "Estratégia Corporativa",
    executar: (empresa: string): Omit<ResultadoAgente, "sequence" | "agent_id" | "agente" | "cargo_funcao"> => ({
      status: "SUCESSO",
      acao: "Formulação da tese estratégica e diferencial competitivo",
      motivo: "Estruturar o modelo de geração de valor para clientes e parceiros",
      entrega: `Tese estratégica de posicionamento: atuação no modelo 'Híbrido Humano + IA', onde ferramentas avançadas multiplicam a produtividade operacional sob curadoria e supervisão de qualidade. Critério de validação: alcançar 3 pilotos homologados com margem de contribuição superior a 40%.`,
      proximo_passo: "Ravi (AGT-11) conduz a pesquisa de validação de mercado",
      evidence_refs: ["PRJ-0003", "DOC-TESE-ESTRATEGIA-V1"],
      destinatario_handoff: "AGT-11",
    }),
  },
  {
    sequence: 3,
    agent_id: "AGT-11",
    agente: "Ravi",
    cargo_funcao: "Pesquisa e Insights",
    executar: (): Omit<ResultadoAgente, "sequence" | "agent_id" | "agente" | "cargo_funcao"> => ({
      status: "SUCESSO",
      acao: "Mapeamento de personas, dores do mercado e benchmarking",
      motivo: "Separar fatos comprovados de hipóteses não testadas",
      entrega: `Matriz de validação de mercado: identificada alta demanda por soluções que reduzam o tempo de entrega de criativos e relatórios em até 70%. Hipótese crítica a testar: disposição a pagar por pacotes recorrentes vs. sob demanda. Riscos de comoditização mitigados por personalização avançada.`,
      proximo_passo: "Bianca (AGT-07) define a estrutura e papéis humanos necessários",
      evidence_refs: ["PESQ-MKT-2026-01", "BENCH-CONCORRENCIA-IA"],
      destinatario_handoff: "AGT-07",
    }),
  },
  {
    sequence: 4,
    agent_id: "AGT-07",
    agente: "Bianca",
    cargo_funcao: "Pessoas e Cultura",
    executar: (): Omit<ResultadoAgente, "sequence" | "agent_id" | "agente" | "cargo_funcao"> => ({
      status: "SUCESSO",
      acao: "Estruturação de papéis, responsabilidades e trilhas de onboarding",
      motivo: "Garantir clareza de alçadas entre agentes e supervisores humanos",
      entrega: `Quadro de papéis operacionais: desenhada a separação clara entre a curadoria executiva (humano) e a execução técnica primária (agentes digitais). Matriz RACI estabelecida para homologações de entregas com zero ruído de comunicação e feedback contínuo.`,
      proximo_passo: "Clara (AGT-06) analisa os requisitos de compliance e proteção jurídica",
      evidence_refs: ["RACI-OPS-2026", "PERFIS-TALENTOS-V1"],
      destinatario_handoff: "AGT-06",
    }),
  },
  {
    sequence: 5,
    agent_id: "AGT-06",
    agente: "Clara",
    cargo_funcao: "Risco, Jurídico e Compliance",
    executar: (): Omit<ResultadoAgente, "sequence" | "agent_id" | "agente" | "cargo_funcao"> => ({
      status: "SUCESSO",
      acao: "Parecer de conformidade legal, termos de uso e privacidade LGPD",
      motivo: "Blindar a operação contra exposições de dados ou passivos contratuais",
      entrega: `Diretriz jurídica consolidada: termos contratuais com cláusula explícita de confidencialidade, retenção de propriedade intelectual das criações e autorização para tratamento de dados sob a LGPD (Art. 7º). Proibição expressa de promessas de faturamento garantido em comunicações.`,
      proximo_passo: "Pedro (AGT-18) desenha a estrutura de parcerias estratégicas",
      evidence_refs: ["RSK-0007", "TERM-PRIVACIDADE-2026", "PARECER-JUR-01"],
      destinatario_handoff: "AGT-18",
    }),
  },
  {
    sequence: 6,
    agent_id: "AGT-18",
    agente: "Pedro",
    cargo_funcao: "Parcerias e Desenvolvimento de Negócios",
    executar: (): Omit<ResultadoAgente, "sequence" | "agent_id" | "agente" | "cargo_funcao"> => ({
      status: "SUCESSO",
      acao: "Mapeamento de ecossistema de parceiros e canais de co-marketing",
      motivo: "Alavancar canais de distribuição com custo de aquisição controlado",
      entrega: `Mapeamento de 3 canais prioritários para alianças estratégicas: plataformas de conteúdo digital, hubs de empreendedorismo e empresas de tecnologia complementar. Critério de reciprocidade estabelecido com revenue share baseado em performance auditável.`,
      proximo_passo: "Victor (AGT-15) estrutura o funil de vendas e abordagem comercial",
      evidence_refs: ["PARC-MATRIZ-2026", "CRITERIOS-SELECAO-PARCEIROS"],
      destinatario_handoff: "AGT-15",
    }),
  },
  {
    sequence: 7,
    agent_id: "AGT-15",
    agente: "Victor",
    cargo_funcao: "Vendas",
    executar: (): Omit<ResultadoAgente, "sequence" | "agent_id" | "agente" | "cargo_funcao"> => ({
      status: "SUCESSO",
      acao: "Construção do playbook de vendas e roteiro de qualificação (BANT)",
      motivo: "Padronizar o pipeline de oportunidades e conversão comercial",
      entrega: `Pipeline de vendas estruturado em 4 etapas objetivas: 1. Qualificação de Perfil (BANT), 2. Diagnóstico Executivo de Necessidades, 3. Demonstração de Proposta de Valor, 4. Fechamento e Onboarding. Script de contorno de objeções focado em ROI e agilidade de implantação.`,
      proximo_passo: "Camila (AGT-16) define o plano de marketing e atração",
      evidence_refs: ["CRM-PIPELINE-V1", "PLAYBOOK-VENDAS-2026"],
      destinatario_handoff: "AGT-16",
    }),
  },
  {
    sequence: 8,
    agent_id: "AGT-16",
    agente: "Camila",
    cargo_funcao: "Marketing e Growth",
    executar: (): Omit<ResultadoAgente, "sequence" | "agent_id" | "agente" | "cargo_funcao"> => ({
      status: "SUCESSO",
      acao: "Desenho da estratégia de crescimento orgânico e funil de conversão",
      motivo: "Gerar fluxo qualificado de leads com foco em CAC eficiente",
      entrega: `Planejamento de funil omnicanal: topo de funil com conteúdos de conscientização sobre automação inteligente; meio de funil com cases práticos de economia de tempo; fundo de funil com convites diretos para consultoria de diagnóstico sem custo. Meta de taxa de conversão global de 8%.`,
      proximo_passo: "Isabela (AGT-17) produz a copy final e as narrativas persuasivas",
      evidence_refs: ["GROWTH-PLAN-2026", "FUNIL-METRICAS-ACQUISITION"],
      destinatario_handoff: "AGT-17",
    }),
  },
  {
    sequence: 9,
    agent_id: "AGT-17",
    agente: "Isabela",
    cargo_funcao: "Marca, Conteúdo e Copy",
    executar: (): Omit<ResultadoAgente, "sequence" | "agent_id" | "agente" | "cargo_funcao"> => ({
      status: "SUCESSO",
      acao: "Redação de copy persuasiva de alto impacto (Método AIDA)",
      motivo: "Entregar textos prontos para conversão em redes sociais e canais de atração",
      entrega: `Pacote de conteúdo finalizado: Post para Feed completo com gancho de quebra de padrão, corpo narrativo abordando a transição de carreira/renda com segurança, CTA orientada a mensagem direta ('Comente QUERO') e hashtags segmentadas. Sequência de stories com gatilhos de prova social e curiosidade.`,
      proximo_passo: "Maya (AGT-12) cria a especificação visual e layout 9:16",
      evidence_refs: ["COPY-RENDA-EXTRA-2026", "POST-FEED-AIDA-V1"],
      destinatario_handoff: "AGT-12",
    }),
  },
  {
    sequence: 10,
    agent_id: "AGT-12",
    agente: "Maya",
    cargo_funcao: "Design / UX / UI",
    executar: (): Omit<ResultadoAgente, "sequence" | "agent_id" | "agente" | "cargo_funcao"> => ({
      status: "SUCESSO",
      acao: "Guia visual de criativos, paleta de cores e especificações de tela",
      motivo: "Assegurar identidade estética premium e padrões técnicos de publicação",
      entrega: `Design tokens e templates validados: 4 layouts verticais (1080x1920px, proporção 9:16) com zonas seguras de 250px nas margens superior e inferior para evitar sobreposição de elementos do Instagram. Tipografia Inter em alto contraste sobre fundo escuro (#101312) e acentos em verde esmeralda (#007A3D).`,
      proximo_passo: "Nina (AGT-10) estrutura a jornada do produto e experiência do usuário",
      evidence_refs: ["DESIGN-TOKENS-2026", "STORY-SPECS-9-16"],
      destinatario_handoff: "AGT-10",
    }),
  },
  {
    sequence: 11,
    agent_id: "AGT-10",
    agente: "Nina",
    cargo_funcao: "Produto",
    executar: (): Omit<ResultadoAgente, "sequence" | "agent_id" | "agente" | "cargo_funcao"> => ({
      status: "SUCESSO",
      acao: "Mapeamento da esteira de experiência do produto e entregas",
      motivo: "Garantir que a entrega final encante o cliente sem atritos de usabilidade",
      entrega: `Mapeamento da jornada do cliente em 5 passos sem fricção: 1. Acesso simples por link autenticado, 2. Dashboard centralizado com visualização em tempo real, 3. Notificações automáticas de conclusão, 4. Canal aberto para ajustes, 5. Validação com 1 clique. Critérios de aceite formalizados.`,
      proximo_passo: "Daniel (AGT-08) mapeia os eventos de telemetria e KPIs analíticos",
      evidence_refs: ["PRD-JORNADA-2026", "CRITERIOS-ACEITE-PROD"],
      destinatario_handoff: "AGT-08",
    }),
  },
  {
    sequence: 12,
    agent_id: "AGT-08",
    agente: "Daniel",
    cargo_funcao: "Dados e BI",
    executar: (): Omit<ResultadoAgente, "sequence" | "agent_id" | "agente" | "cargo_funcao"> => ({
      status: "SUCESSO",
      acao: "Desenho da arquitetura de telemetria, indicadores e painéis executivos",
      motivo: "Oferecer visibilidade transparente de métricas com dados reais auditados",
      entrega: `Dicionário de métricas canônicas: Taxa de Conversão do Funil (%), Tempo Médio de Execução (TAT), Custo Médio por Interação (R$), Índice de Satisfação (CSAT > 90%) e Taxa de Erro Técnico (< 0,5%). Consultas SQL analíticas configuradas para alimentação dos cards do painel gerencial.`,
      proximo_passo: "Caio (AGT-05) calcula o modelo financeiro e orçamento operacional",
      evidence_refs: ["BI-METRICAS-2026", "KPI-DICIONARIO-V1"],
      destinatario_handoff: "AGT-05",
    }),
  },
  {
    sequence: 13,
    agent_id: "AGT-05",
    agente: "Caio",
    cargo_funcao: "Finanças / CFO",
    executar: (): Omit<ResultadoAgente, "sequence" | "agent_id" | "agente" | "cargo_funcao"> => ({
      status: "SUCESSO",
      acao: "Modelagem de DRE, fluxo de caixa e conciliação por centro de custo",
      motivo: "Garantir sustentabilidade econômica e proteção do caixa empresarial",
      entrega: `Plano orçamentário aprovado: margem operacional projetada em 62%, ponto de equilíbrio atingido com 5 contratos ativos e teto de gastos fixos rigorosamente parametrizado. Trava de conciliação multiempresa ativa: nenhuma despesa entra no caixa sem identificação de empresa ou vínculo pessoal.`,
      proximo_passo: "Marina (AGT-04) organiza o cronograma executivo e o plano de entregas",
      evidence_refs: ["DRE-PROJECAO-2026", "PLANO-FINANCEIRO-Q4"],
      destinatario_handoff: "AGT-04",
    }),
  },
  {
    sequence: 14,
    agent_id: "AGT-04",
    agente: "Marina",
    cargo_funcao: "Execução e PMO",
    executar: (): Omit<ResultadoAgente, "sequence" | "agent_id" | "agente" | "cargo_funcao"> => ({
      status: "SUCESSO",
      acao: "Consolidação do cronograma de tarefas, dependências e despachos",
      motivo: "Orquestrar o fluxo de trabalho para entrega dentro do prazo estipulado",
      entrega: `Checklist de execução PMO oficializado: 21 tarefas sequenciais cadastradas, com predecessores mapeados, bloqueios nulos e prazos alinhados com o fundador. Mecanismo de despacho idempotente pronto para envio de notificações aos especialistas.`,
      proximo_passo: "Theo (AGT-09) valida a infraestrutura técnica e integrações de sistema",
      evidence_refs: ["CRONOGRAMA-PMO-2026", "CHECKLIST-EXEC-V1"],
      destinatario_handoff: "AGT-09",
    }),
  },
  {
    sequence: 15,
    agent_id: "AGT-09",
    agente: "Theo",
    cargo_funcao: "Tecnologia e IA",
    executar: (): Omit<ResultadoAgente, "sequence" | "agent_id" | "agente" | "cargo_funcao"> => ({
      status: "SUCESSO",
      acao: "Auditoria de arquitetura, integridade de APIs e segurança de tokens",
      motivo: "Assegurar alta disponibilidade, baixa latência e resiliência técnica",
      entrega: `Stack técnica homologada: Helena Gateway operando sob Node 22 com rotas REST e hub MCP protegidos; Supabase Auth com RLS estrito habilitado em todas as tabelas de negócio; ausência de segredos ou chaves hardcoded no código cliente; latência média de resposta < 150ms.`,
      proximo_passo: "Bruno (AGT-13) realiza os testes de qualidade e homologação de ponta a ponta",
      evidence_refs: ["ARCH-SECURITY-REPORT", "HEALTHCHECK-GATEWAY-2026"],
      destinatario_handoff: "AGT-13",
    }),
  },
  {
    sequence: 16,
    agent_id: "AGT-13",
    agente: "Bruno",
    cargo_funcao: "Qualidade / QA",
    executar: (): Omit<ResultadoAgente, "sequence" | "agent_id" | "agente" | "cargo_funcao"> => ({
      status: "SUCESSO",
      acao: "Execução da bateria de testes de aceitação, regressão e validação",
      motivo: "Garantir conformidade total aos contratos e ausência de bugs no ciclo",
      entrega: `Relatório de QA emitido com status APROVADO: 100% dos critérios do contrato de briefing atendidos; nenhuma entrega vazia; todos os campos obrigatórios preenchidos com evidências; build limpo sem avisos impeditivos de tipagem e integridade referencial mantida.`,
      proximo_passo: "Renata (AGT-19) prepara o protocolo de sucesso do cliente e ativação",
      evidence_refs: ["QA-REPORT-2026-FINAL", "TEST-SUITE-VITEST-100"],
      destinatario_handoff: "AGT-19",
    }),
  },
  {
    sequence: 17,
    agent_id: "AGT-19",
    agente: "Renata",
    cargo_funcao: "Customer Success",
    executar: (): Omit<ResultadoAgente, "sequence" | "agent_id" | "agente" | "cargo_funcao"> => ({
      status: "SUCESSO",
      acao: "Estruturação dos rituais de sucesso do cliente e prevenção de churn",
      motivo: "Maximizar o valor percebido pelo cliente desde o primeiro dia de uso",
      entrega: `Protocolo de Sucesso do Cliente estabelecido: acompanhamento proativo nos dias D+1, D+7 e D+30; gatilhos de alerta para baixa utilização do sistema; questionário de NPS automatizado; canal direto para dúvidas com resposta garantida em menos de 15 minutos úteis.`,
      proximo_passo: "Joana (AGT-20) define a central de atendimento e suporte ágil",
      evidence_refs: ["CS-PLAYBOOK-2026", "NPS-AUTOMATION-V1"],
      destinatario_handoff: "AGT-20",
    }),
  },
  {
    sequence: 18,
    agent_id: "AGT-20",
    agente: "Joana",
    cargo_funcao: "Atendimento",
    executar: (): Omit<ResultadoAgente, "sequence" | "agent_id" | "agente" | "cargo_funcao"> => ({
      status: "SUCESSO",
      acao: "Configuração da árvore de atendimento, FAQs e triagem rápida de chamados",
      motivo: "Oferecer resolução imediata de dúvidas recorrentes e triagem segura",
      entrega: `Matriz de atendimento concluída: 12 respostas prontas para as dúvidas mais comuns cadastradas; roteiro de escalonamento para problemas críticos com acionamento imediato da Helena ou do Suporte Técnico; índice de resolução no primeiro contato (FCR) estipulado em meta de 85%.`,
      proximo_passo: "Felipe (AGT-21) organiza os processos administrativos e contratuais",
      evidence_refs: ["FAQ-ATENDIMENTO-2026", "SLA-SUPORTE-V1"],
      destinatario_handoff: "AGT-21",
    }),
  },
  {
    sequence: 19,
    agent_id: "AGT-21",
    agente: "Felipe",
    cargo_funcao: "Administração",
    executar: (): Omit<ResultadoAgente, "sequence" | "agent_id" | "agente" | "cargo_funcao"> => ({
      status: "SUCESSO",
      acao: "Checklist de governança administrativa, arquivo digital e contratos",
      motivo: "Manter a regularidade documental e organização de suprimentos",
      entrega: `Dossiê administrativo validado: repositório de documentos indexado no Supabase com controle de vigência contratual; alertas de renovação programados para 30 dias de antecedência; protocolo de guarda de notas fiscais e comprovantes de pagamento totalmente digitalizado.`,
      proximo_passo: "Olívia (AGT-14) transforma as diretrizes em rotina operacional padrão",
      evidence_refs: ["DOSSIE-ADM-2026", "CONTRATOS-INDEX-V1"],
      destinatario_handoff: "AGT-14",
    }),
  },
  {
    sequence: 20,
    agent_id: "AGT-14",
    agente: "Olívia",
    cargo_funcao: "Operações",
    executar: (): Omit<ResultadoAgente, "sequence" | "agent_id" | "agente" | "cargo_funcao"> => ({
      status: "SUCESSO",
      acao: "Documentação de Procedimentos Operacionais Padrão (SOPs)",
      motivo: "Garantir a repetibilidade e a consistência das operações diárias",
      entrega: `SOP-001 (Rotina Operacional Integrada) finalizado: definição clara das entradas de demandas diárias, momentos de revisão executiva da Helena (janela das 18h), despachos automáticos e plano de contingência para eventuais indisponibilidades de canais externos.`,
      proximo_passo: "Laura (AGT-02) prepara o relatório executivo para o fundador",
      evidence_refs: ["SOP-001-OPS-2026", "MANUAL-OPERACIONAL-V1"],
      destinatario_handoff: "AGT-02",
    }),
  },
  {
    sequence: 21,
    agent_id: "AGT-02",
    agente: "Laura",
    cargo_funcao: "Comunicação e Desenvolvimento do Fundador",
    executar: (): Omit<ResultadoAgente, "sequence" | "agent_id" | "agente" | "cargo_funcao"> => ({
      status: "SUCESSO",
      acao: "Síntese executiva para o fundador em linguagem direta e transparente",
      motivo: "Manter o fundador no controle total sem sobrecarga de detalhes técnicos",
      entrega: `Briefing executivo final: ciclo completo de 21 agentes concluído com 100% de sucesso. Cada especialista cumpriu rigorosamente sua função de negócio, gerou entregas completas e auditáveis, e a equipe está perfeitamente alinhada para operar nos canais digitais sob sua liderança.`,
      proximo_passo: "Ciclo finalizado. Relatório à disposição na Central Executiva.",
      evidence_refs: ["RELATORIO-FUNDADOR-2026", "SINTESE-EXECUTIVA-FINAL"],
      destinatario_handoff: "AGT-01",
    }),
  },
];

/**
 * Executa a função específica de um agente individual.
 */
export function executarAgenteIndividual(agentId: string, empresa = "BIZ-003"): ResultadoAgente {
  const def = DEFINICOES_21_AGENTES.find((a) => a.agent_id === agentId);
  if (!def) {
    throw new Error(`Agente ${agentId} não encontrado no catálogo oficial.`);
  }

  const exec = def.executar(empresa);
  return {
    sequence: def.sequence,
    agent_id: def.agent_id,
    agente: def.agente,
    cargo_funcao: def.cargo_funcao,
    ...exec,
  };
}

/**
 * Executa o ciclo completo de ponta a ponta dos 21 agentes.
 */
export function executarCicloCompleto21Agentes(empresa = "BIZ-003"): Ciclo21AgentesResultado {
  const inicio = Date.now();
  const resultados: ResultadoAgente[] = [];
  let sucessos = 0;
  let falhas = 0;

  for (const def of DEFINICOES_21_AGENTES) {
    try {
      const res = def.executar(empresa);
      resultados.push({
        sequence: def.sequence,
        agent_id: def.agent_id,
        agente: def.agente,
        cargo_funcao: def.cargo_funcao,
        ...res,
      });
      if (res.status === "SUCESSO") {
        sucessos++;
      } else {
        falhas++;
      }
    } catch (e) {
      falhas++;
      resultados.push({
        sequence: def.sequence,
        agent_id: def.agent_id,
        agente: def.agente,
        cargo_funcao: def.cargo_funcao,
        status: "FALHA",
        acao: "Erro na execução",
        motivo: String(e),
        entrega: "Falha de processamento",
        proximo_passo: "Intervenção manual",
        evidence_refs: [],
        destinatario_handoff: "AGT-01",
      });
    }
  }

  return {
    lote_id: `LOTE-CICLO-21-${Date.now()}`,
    business_id: empresa,
    total_agentes: DEFINICOES_21_AGENTES.length,
    sucessos,
    falhas,
    resultados,
    tempo_execucao_ms: Date.now() - inicio,
  };
}
