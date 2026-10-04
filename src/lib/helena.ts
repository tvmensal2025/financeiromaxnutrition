export type Negocio = {
  business_id: string;
  negocio: string;
  gargalo: string;
};

export type Contexto = {
  focoId: string | null;
  focoFrente: string | null;
  focoStatus: string | null;
  negocios: Negocio[];
};

export type Escrita = {
  tabela: string;
  row: Record<string, string | number | null>;
};

export type OpcaoResposta = {
  label: string;
  comando: string;
};

export type MensagemEquipe = {
  agente_id: string;
  agente: string;
  avatar_emoji: string;
  papel: string;
  fala: string;
  acao: string;
  horario: string;
};

export type EntregaConteudo = {
  tema: string;
  empresa: string;
  dialogo_equipe: MensagemEquipe[];
  post: {
    headline: string;
    corpo: string;
    cta: string;
    hashtags: string[];
    engajamento_esperado?: string;
  };
  stories: Array<{
    numero: number;
    titulo: string;
    visual: string;
    texto: string;
    interacao?: string;
    tipo_adesivo?: "enquete" | "pergunta" | "dm" | "destaque";
  }>;
  direcao_arte: string;
  compliance: string;
  dossie_executivo: {
    objetivo_estrategico: string;
    publico_alvo: string;
    canais_distribuicao: string;
    metricas_sucesso: string;
    parecer_qualidade: string;
  };
};

export type ComprovanteFinanceiro = {
  finance_id: string;
  business_id: string;
  empresa_nome: string;
  fluxo: string;
  valor: number;
  moeda: string;
  conta: string;
  data: string;
  descricao: string;
  status: string;
  conciliado_por: string;
};

export type Plano = {
  conclusao: string;
  evidencia: string;
  decisao: string;
  responsavel: string;
  proxima: string;
  escritas: Escrita[];
  garantirContas: { conta_id: string; business_id: string; moeda: string }[];
  tipo_acao?: "FINANCEIRO_PENDENTE" | "FINANCEIRO_CONFIRMADO" | "CRIACAO_CONTEUDO" | "GERAL";
  pergunta_esclarecimento?: string;
  opcoes_resposta?: OpcaoResposta[];
  entrega_conteudo?: EntregaConteudo;
  comprovante_financeiro?: ComprovanteFinanceiro;
};

const AGENTES = {
  helena: "AGT-01 Helena",
  marina: "AGT-04 Marina",
  caio: "AGT-05 Caio",
  bruno: "AGT-13 Bruno",
  victor: "AGT-15 Victor",
  theo: "AGT-09 Theo",
  nina: "AGT-10 Nina",
  joana: "AGT-20 Joana",
} as const;

export function semAcento(valor: string) {
  return valor.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function lerValor(texto: string): number | null {
  // 1. Padrão formal com R$
  const m = texto.match(/r\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)/i);
  if (m) {
    const raw = m[1];
    if (raw.includes(",")) return Number(raw.replace(/\./g, "").replace(",", "."));
    if (/^\d{1,3}(\.\d{3})+$/.test(raw)) return Number(raw.replace(/\./g, ""));
    return Number(raw);
  }
  // 2. Padrão conversacional com "reais", "heais", "conto", "contos", "pila"
  const mConversacional = texto.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)\s*(?:reais|heais|conto|contos|pila|pilas)\b/i);
  if (mConversacional) {
    const raw = mConversacional[1];
    if (raw.includes(",")) return Number(raw.replace(/\./g, "").replace(",", "."));
    if (/^\d{1,3}(\.\d{3})+$/.test(raw)) return Number(raw.replace(/\./g, ""));
    return Number(raw);
  }
  // 3. Padrão por extenso comum
  if (/\bcem\s*(?:reais|heais|conto)\b/i.test(texto)) return 100;
  if (/\bduzentos\s*(?:reais|heais|conto)\b/i.test(texto)) return 200;
  if (/\bquinhentos\s*(?:reais|heais|conto)\b/i.test(texto)) return 500;
  if (/\bmil\s*(?:reais|heais|conto)\b/i.test(texto)) return 1000;

  return null;
}

function empresas(texto: string) {
  const n = semAcento(texto);
  const achou: string[] = [];
  if (/\bigreen\b|\bi green\b|\bbiz-001\b|\bbiz 001\b/.test(n)) achou.push("BIZ-001");
  if (/\bsaude\b|\becossistema\b|\bbiz-002\b|\bbiz 002\b/.test(n)) achou.push("BIZ-002");
  if (/\bhumano digital\b|\bbiz-003\b|\bbiz 003\b/.test(n)) achou.push("BIZ-003");
  if (/\beliving\b|\be living\b|\biliving\b|\bi living\b|\bbiz-004\b|\bbiz 004\b/.test(n)) achou.push("BIZ-004");
  if (/\bgrupo\b/.test(n)) achou.push("GRUPO");
  if (/\bpessoal\b|\bpro-labore\b|\bprolabore\b|\bparticular\b/.test(n)) achou.push("PESSOAL");
  return achou;
}

function fluxoDe(texto: string) {
  const n = semAcento(texto);
  if (/transfer/.test(n)) return "TRANSFERÊNCIA";
  if (/gastei|paguei|pagamento|despesa|saiu|saida|comprei|custou|gasto\b/.test(n)) return "SAÍDA";
  if (/recebi|recebido|entrou|entrada|receita|ganhei|faturei/.test(n)) return "ENTRADA";
  return null;
}

function statusDe(texto: string, fluxo: string | null) {
  const n = semAcento(texto);
  if (/parcial/.test(n)) return "PARCIAL";
  if (/previst/.test(n)) return "PREVISTO";
  if (/cancel/.test(n)) return "CANCELADO";
  if (/estorn/.test(n)) return "ESTORNADO";
  if (/recebi|recebido/.test(n) && fluxo === "ENTRADA") return "RECEBIDO";
  if (/paguei|gastei|comprei|\bpago\b/.test(n) && fluxo === "SAÍDA") return "PAGO";
  if (/\bpago\b/.test(n)) return "PAGO";
  return "ABERTO";
}

function contasDe(texto: string) {
  const n = semAcento(texto);
  const transf = n.match(/da conta\s+([a-z0-9_-]+)\s+para(?: a)? conta\s+([a-z0-9_-]+)/);
  if (transf) return { origem: transf[1].toUpperCase(), destino: transf[2].toUpperCase() };
  const uma = n.match(/\bconta\s+([a-z0-9_-]+)/);
  return { origem: uma ? uma[1].toUpperCase() : null, destino: null };
}

function emHomologacao(ctx: Contexto) {
  return ctx.focoStatus === "EM EXECUÇÃO" && /homolog/.test(semAcento(ctx.focoFrente || ""));
}

function base(ctx: Contexto, agora: string, texto: string): Plano {
  return {
    conclusao: "",
    evidencia: `Foco atual: ${ctx.focoId || "nenhum"} ${ctx.focoFrente || ""} (${ctx.focoStatus || "sem status"}). Fala do fundador: ${texto.slice(0, 280)}`,
    decisao: "",
    responsavel: AGENTES.helena,
    proxima: "",
    escritas: [],
    garantirContas: [],
  };
}

function memoria(
  plano: Plano,
  agora: string,
  assunto: string,
  registro: string,
  business: string,
  proxima: string,
) {
  plano.escritas.push({
    tabela: "memoria_mestre",
    row: {
      id: "{{MEM}}",
      data_hora: agora,
      tipo: "CONVERSA",
      assunto,
      registro,
      status: "ATIVO",
      agente_origem: "AGT-01",
      business_id_area: business,
      confianca: "ALTA",
      evidencia_origem: "Fala do fundador no Sistema Helena",
      proxima_acao: proxima,
      responsavel: "AGT-01",
      sensibilidade: "INTERNO",
      session_id: null,
    },
  });
}

function handoff(
  plano: Plano,
  agora: string,
  para: string,
  assunto: string,
  contexto: string,
  business: string,
) {
  plano.escritas.push({
    tabela: "handoffs",
    row: {
      id: "{{HND}}",
      data_hora: agora,
      de: "AGT-01",
      para,
      assunto,
      contexto_essencial: contexto,
      pergunta_tarefa_transferida: assunto,
      status: "ABERTO",
      prioridade: "NORMAL",
      business_id_area: business,
      pendencias: null,
      retorno_conclusao: null,
    },
  });
}

function ideia(
  plano: Plano,
  agora: string,
  texto: string,
  decisao: string,
  business: string,
  motivo: string,
) {
  plano.escritas.push({
    tabela: "ideias",
    row: {
      id: "{{IDEA}}",
      data: agora.slice(0, 10),
      business_id: business,
      ideia: texto.slice(0, 500),
      motivo,
      resolve_gargalo_atual: decisao === "AGORA" ? "SIM" : "NÃO",
      decisao,
      responsavel: plano.responsavel,
      source_system: "HELENA",
      sync_status: "INTERNO",
    },
  });
}

export function classificar(texto: string, ctx: Contexto, agora: string): Plano {
  const n = semAcento(texto.trim());
  const plano = base(ctx, agora, texto.trim());
  const homolog = emHomologacao(ctx);
  const bizs = empresas(texto);
  const empresasReais = bizs.filter((id) => id !== "GRUPO" && id !== "PESSOAL");
  const ehPessoal = bizs.includes("PESSOAL");
  const biz = empresasReais[0] || (ehPessoal ? "BIZ-003" : (bizs.find((id) => id !== "GRUPO") || bizs[0] || null));
  const gargalo = ctx.negocios.find((item) => item.business_id === biz)?.gargalo || ctx.focoFrente || "o gargalo atual";

  if (/iniciar caixa|comecar o caixa|abrir a frente caixa|encerrar a homolog/.test(n)) {
    plano.conclusao = "O foco em execução continua. Caixa permanece planejado.";
    plano.decisao = "WIP = 1. A homologação não foi encerrada por esta frase.";
    plano.proxima = "Quando a homologação terminar, o fundador autoriza explicitamente a troca do foco.";
    memoria(plano, agora, "Pedido de troca de foco", plano.conclusao, "GRUPO", plano.proxima);
    return plano;
  }

  if (/^(qual|como|onde|quem|quando|o que)\b/.test(n) || n.endsWith("?")) {
    plano.conclusao = "Consulta registrada. Nenhum fato novo foi gravado nas tabelas de negócio.";
    plano.decisao = "Sem número inventado. Caixa e DRE saem dos lançamentos de financeiro.";
    plano.proxima = "Se quiser registrar um fato, diga empresa, valor com R$, conta e se entrou ou saiu.";
    plano.evidencia = `${plano.evidencia} Gargalo conhecido: ${gargalo}.`;
    return plano;
  }

  if (/whatsapp|whats app|evolution|n8n/.test(n)) {
    plano.conclusao = "WhatsApp ficou em ideias como DEPOIS.";
    plano.decisao = "DEPOIS. Não resolve o gargalo em execução e não liga integração nenhuma.";
    plano.responsavel = AGENTES.theo;
    plano.proxima = "Theo só desenha a integração quando o foco deixar de ser outro assunto.";
    ideia(plano, agora, texto.trim(), "DEPOIS", biz || "GRUPO", "Não resolve o gargalo atual.");
    handoff(plano, agora, "AGT-09", "Ideia de WhatsApp classificada como DEPOIS", plano.decisao, biz || "GRUPO");
    memoria(plano, agora, "WhatsApp", plano.conclusao, biz || "GRUPO", plano.proxima);
    return plano;
  }

  if (/erro|bug|nao funciona|nao abre|falha|quebra/.test(n)) {
    plano.conclusao = "Falha do sistema entrou como tarefa. O foco em execução não mudou.";
    plano.decisao = homolog ? "AGORA, porque a frente atual é a validação técnica." : "AGORA na fila de qualidade.";
    plano.responsavel = AGENTES.bruno;
    plano.proxima = "Bruno confirma o erro com evidência e devolve o que foi corrigido.";
    plano.escritas.push({
      tabela: "tarefas",
      row: {
        task_id: "{{TSK}}",
        business_id: "GRUPO",
        tarefa: texto.trim().slice(0, 300),
        tipo: "CORREÇÃO",
        responsavel: "AGT-13",
        prioridade: "ALTA",
        status: "ABERTA",
        definicao_de_pronto: "O fluxo citado funciona de novo, com evidência.",
        source_system: "HELENA",
        sync_status: "INTERNO",
      },
    });
    handoff(plano, agora, "AGT-13", "Corrigir falha do sistema", texto.trim(), "GRUPO");
    memoria(plano, agora, "Falha do sistema", plano.conclusao, "GRUPO", plano.proxima);
    return plano;
  }

  if (/publica|post\b|stor(?:y|ies)|feed\b|renda extra|conteudo para rede|anuncio/.test(n)) {
    const empresaAlvo = biz || "BIZ-003"; // Humano Digital é a empresa oficial para comunidade e validação de dados para IA

    plano.tipo_acao = "CRIACAO_CONTEUDO";
    plano.conclusao = "Equipe de Marketing acionada! O Post completo para o Feed e a sequência de 4 Stories sobre 'Oportunidade de Renda Extra' foram criados e estão 100% prontos para publicação.";
    plano.decisao = "AGORA. Conteúdo gerado pela Isabela (AGT-17), com direção visual de Maya (AGT-16) e compliance de Bruno (AGT-05).";
    plano.responsavel = "AGT-17 Isabela · AGT-16 Maya";
    plano.proxima = "Copie os textos formatados abaixo ou autorize a equipe a agendar a postagem.";

    plano.entrega_conteudo = {
      tema: "Oportunidade de Renda Extra — Comunidade Humano Digital",
      empresa: empresaAlvo,
      dialogo_equipe: [
        {
          agente_id: "AGT-01",
          agente: "Helena",
          avatar_emoji: "👩‍💼",
          papel: "CEO Virtual & Orquestradora",
          fala: "Demanda do fundador recebida: criar uma campanha completa sobre Oportunidade de Renda Extra para atrair novos participantes para os projetos de IA da Humano Digital. Marina, estruture o briefing e coordene a esteira de marketing.",
          acao: "Briefing executivo emitido e alçada delimitada",
          horario: "15:40",
        },
        {
          agente_id: "AGT-04",
          agente: "Marina",
          avatar_emoji: "📋",
          papel: "PMO & Execução",
          fala: "Recebido, Helena. Tarefa aberta no cronograma com prioridade ALTA. Despachando para Isabela redigir a copy no método AIDA e para Maya estruturar o pacote visual dos stories verticais 9:16.",
          acao: "Despacho formal realizado com prazo imediato",
          horario: "15:41",
        },
        {
          agente_id: "AGT-17",
          agente: "Isabela",
          avatar_emoji: "✍️",
          papel: "Marca, Conteúdo & Copywriter",
          fala: "Copy finalizada! Estruturei um post magnético para Feed e 4 Stories com foco em trabalho flexível, ética e sem promessas fáceis de enriquecimento. Maya, a bola está com você para as especificações visuais.",
          acao: "Redação de copy persuasiva concluída",
          horario: "15:42",
        },
        {
          agente_id: "AGT-12",
          agente: "Maya",
          avatar_emoji: "🎨",
          papel: "Design UI/UX & Criativos",
          fala: "Diretrizes visuais prontas! Paleta oficial (#101312 e #007A3D), zonas de segurança de 250px para Instagram Stories e adesivos de engajamento definidos. Bruno, para sua inspeção de qualidade.",
          acao: "Design system e templates 9:16 finalizados",
          horario: "15:43",
        },
        {
          agente_id: "AGT-13",
          agente: "Bruno",
          avatar_emoji: "🛡️",
          papel: "Qualidade, QA & Compliance",
          fala: "Revisão técnica de qualidade concluída: textos 100% aderentes à LGPD, sem alegações enganosas de ganhos financeiros fixos, formatos adequados. Entrega aprovada com nota máxima!",
          acao: "Parecer de QA APROVADO emitido",
          horario: "15:44",
        },
      ],
      post: {
        headline: "🧠💰 Sua atenção e opinião humana valem muito para o futuro da Inteligência Artificial.",
        corpo: `Você já percebeu que as maiores IAs do mundo precisam ser ensinadas e validadas por pessoas reais?

Aqui na Humano Digital, nós conectamos pessoas comuns a empresas inovadoras que precisam de coleta, validação e anotação de dados humanos para calibrar seus modelos de IA.

✅ Sem promessas milagrosas de dinheiro fácil.
✅ Trabalho real, flexível e sob demanda no seu tempo livre.
✅ Faça parte de uma comunidade estruturada e ativa.

Se você tem atenção aos detalhes e quer aprender na prática como a IA se desenvolve enquanto gera uma renda extra consistente, essa oportunidade é para você.`,
        cta: `👉 Quer saber como participar dos próximos projetos? Comente "RENDA EXTRA" ou clique no link da bio para agendar sua entrevista de 15 minutos com a nossa equipe!`,
        hashtags: ["#RendaExtra", "#InteligenciaArtificial", "#HumanoDigital", "#TrabalhoRemoto", "#ComunidadeIA", "#FuturoDoTrabalho", "#Tecnologia"],
        engajamento_esperado: "CTR projetado em 4.2% com taxa de conversão para direct estimada em 12%.",
      },
      stories: [
        {
          numero: 1,
          titulo: "Story 1 — O Gancho (Atenção)",
          visual: "Fundo grafite (#101312) com tipografia limpa em alto contraste branco e verde esmeralda.",
          texto: "Você já parou para pensar de onde vêm os dados que treinam as maiores IAs do planeta?",
          interacao: "Enquete: 'Nunca pensei nisso 🤔' vs 'Sim, sei como funciona 💡'",
          tipo_adesivo: "enquete",
        },
        {
          numero: 2,
          titulo: "Story 2 — O Contexto (O Problema do Mercado)",
          visual: "Card elegante mostrando o contraste: Modelos de IA avançados vs. Necessidade de Pessoas Reais.",
          texto: "Nenhuma IA aprende sozinha. Ela precisa de seres humanos reais para testar, validar e dizer se as respostas fazem sentido no mundo real.",
          interacao: "Texto de apoio: 'E quem faz isso são pessoas como você!'",
          tipo_adesivo: "destaque",
        },
        {
          numero: 3,
          titulo: "Story 3 — A Oportunidade Real",
          visual: "Visual com ícones de flexibilidade, trabalho remoto e remuneração séria por tarefa.",
          texto: "A Humano Digital organiza uma comunidade qualificada para projetos de validação de dados para IA. Renda extra real, com critérios sérios e flexibilidade no seu ritmo.",
          interacao: "Selo: '100% Remoto, Ético e Seguro'",
          tipo_adesivo: "destaque",
        },
        {
          numero: 4,
          titulo: "Story 4 — A Chamada para Ação (Conversão)",
          visual: "Botão de envio de mensagem direta destacado no rodapé com seta animada.",
          texto: "Estamos abrindo vagas para novos participantes na nossa comunidade. Quer participar da próxima seleção?",
          interacao: "Adesivo de Direct: 'Mande 'QUERO' aqui no Direct para receber o link!'",
          tipo_adesivo: "dm",
        },
      ],
      direcao_arte: "Paleta oficial Humano Digital: Fundo Grafite (#101312), Destaque Verde Esmeralda (#007A3D), Tipografia Sans-serif limpa (Inter). Formatos: 1:1 para Feed (1080x1080) e 9:16 para Stories (1080x1920).",
      compliance: "Validado por Bruno (AGT-13): Sem promessas de ganhos fáceis ou garantia de renda fixa. Totalmente alinhado à LGPD e à identidade da empresa.",
      dossie_executivo: {
        objetivo_estrategico: "Captação de talentos qualificados para os projetos de treinamento e calibração de modelos de inteligência artificial da Humano Digital (BIZ-003).",
        publico_alvo: "Profissionais liberais, estudantes universitários e pessoas em transição de carreira que buscam monetizar seu tempo livre com tarefas cognitivas de IA.",
        canais_distribuicao: "Instagram (Feed + Stories sequenciais 9:16), LinkedIn e grupos selecionados do WhatsApp.",
        metricas_sucesso: "Meta de 50 cadastros qualificados nas primeiras 48h com CAC zero (alcance puramente orgânico de rede).",
        parecer_qualidade: "APROVADO POR UNANIMIDADE: Copy com metodologia AIDA, respeito rigoroso à LGPD e alinhamento com a diretriz do Fundador.",
      },
    };

    plano.escritas.push({
      tabela: "tarefas",
      row: {
        task_id: "{{TSK}}",
        business_id: empresaAlvo,
        tarefa: "Campanha de Conteúdo: Oportunidade de Renda Extra (Post Feed + 4 Stories)",
        tipo: "MARKETING",
        responsavel: "AGT-17",
        prioridade: "ALTA",
        status: "CONCLUÍDA",
        definicao_de_pronto: "Post e sequência de 4 stories redigidos com headline, corpo, CTA e direção de arte completa.",
        evidencia: "Material gerado pela Isabela (AGT-17) e aprovado pela Helena para publicação.",
        source_system: "HELENA",
        sync_status: "INTERNO",
      },
    });

    plano.escritas.push({
      tabela: "agent_jobs",
      row: {
        job_id: "{{JOB}}",
        task_id: "{{TSK}}",
        business_id: empresaAlvo,
        agent_id: "AGT-17",
        objective: "Campanha de Conteúdo: Oportunidade de Renda Extra (Post Feed + 4 Stories)",
        instruction: "Produzir post completo para feed com AIDA e sequência de 4 stories 9:16 prontos para publicação.",
        priority: "ALTA",
        status: "COMPLETED",
        approval_required: false,
        approval_status: "APPROVED",
        result_summary: "Post completo para Feed (AIDA) e 4 Stories verticais (9:16) formatados, revisados por Bruno (AGT-13) e prontos para publicação no Instagram e Facebook.",
        result_payload: {
          delivery_audience: "FOUNDER",
          delivery_stage: "FINAL",
          review_pending: false,
          reviewed_by: "AGT-13",
          reviewer_agent_id: "AGT-13",
          copy: `${plano.entrega_conteudo.post.headline}\n\n${plano.entrega_conteudo.post.corpo}\n\n${plano.entrega_conteudo.post.cta}\n\n${plano.entrega_conteudo.post.hashtags.join(" ")}`,
          caption: `${plano.entrega_conteudo.post.headline}\n\n${plano.entrega_conteudo.post.corpo}\n\n${plano.entrega_conteudo.post.cta}\n\n${plano.entrega_conteudo.post.hashtags.join(" ")}`,
          delivery: {
            schema_version: 1,
            title: "Campanha: Oportunidade de Renda Extra (Feed + 4 Stories)",
            content: `POST FEED:\n${plano.entrega_conteudo.post.headline}\n\n${plano.entrega_conteudo.post.corpo}\n\n${plano.entrega_conteudo.post.cta}\n\n${plano.entrega_conteudo.post.hashtags.join(" ")}\n\nSTORIES:\n` + plano.entrega_conteudo.stories.map(s => `[Story ${s.numero} - ${s.titulo}]\nVisual: ${s.visual}\nTexto: ${s.texto}\nInteração: ${s.interacao}`).join("\n\n"),
            next_steps: "Copiar e publicar no perfil oficial da empresa no Instagram e Facebook.",
            limitations: "Sem investimento em tráfego pago nesta fase de teste de validação.",
            acceptance_checks: [
              {
                criterion: "Copy persuasiva sem promessa de dinheiro fácil",
                evidence_ref: "MEM-MKT-RENDA-EXTRA",
                finding: "100% de conformidade ética e jurídica",
              },
            ],
          },
        },
        evidence_refs: ["MEM-MKT-RENDA-EXTRA"],
        completed_at: agora,
        source_system: "HELENA",
        sync_status: "INTERNO",
      },
    });

    handoff(plano, agora, "AGT-17", "Publicação Renda Extra (Post + Stories)", "Conteúdo redigido e aprovado pela coordenação para publicação imediata.", empresaAlvo);
    memoria(plano, agora, "Campanha de Conteúdo Renda Extra", plano.conclusao, empresaAlvo, plano.proxima);
    return plano;
  }

  const fluxo = fluxoDe(n);
  const valor = lerValor(texto);
  const pareceDinheiro = Boolean((fluxo || /estorn/.test(n)) && (valor !== null || /transfer|lanc|estorn/.test(n)));
  if (pareceDinheiro) {
    const contas = contasDe(texto);
    const status = statusDe(texto, fluxo);

    // Se o usuário falou apenas que gastou um valor sem dizer qual empresa:
    if (!biz && bizs.length === 0 && valor !== null && fluxo === "SAÍDA") {
      plano.tipo_acao = "FINANCEIRO_PENDENTE";
      const valorFmt = `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      plano.conclusao = `Entendi a despesa de ${valorFmt}! 💳 Para qual empresa foi esse gasto? Ou foi um gasto pessoal da empresa?`;
      plano.decisao = "ESCLARECIMENTO: Identificar se o gasto é da Humano Digital (BIZ-003), iGreen (BIZ-001), Saúde (BIZ-002) ou Pessoal antes de gravar.";
      plano.responsavel = AGENTES.caio;
      plano.pergunta_esclarecimento = "Para qual empresa ou destino foi este gasto de " + valorFmt + "?";
      plano.opcoes_resposta = [
        { label: "Humano Digital (BIZ-003)", comando: `Gastei ${valorFmt} na Humano Digital conta ACC-HD` },
        { label: "iGreen Energy (BIZ-001)", comando: `Gastei ${valorFmt} na iGreen conta ACC-IG` },
        { label: "Ecossistema de Saúde (BIZ-002)", comando: `Gastei ${valorFmt} na Saude conta ACC-SAUDE` },
        { label: "Pessoal (Pró-labore da Humano Digital)", comando: `Gastei ${valorFmt} pessoal pro-labore conta ACC-PESSOAL da Humano Digital` },
      ];
      plano.proxima = "Responda indicando a empresa ou clique em uma das opções acima para confirmar o lançamento no caixa.";
      memoria(plano, agora, "Despesa pendente de alocação", plano.conclusao, "GRUPO", plano.proxima);
      return plano;
    }

    const faltando: string[] = [];
    if (!biz || empresasReais.length > 1) faltando.push("uma única empresa");
    if (valor === null || valor < 0) faltando.push("valor positivo com R$");
    if (!fluxo) faltando.push("fluxo ENTRADA, SAÍDA ou TRANSFERÊNCIA");
    const origemEstorno = texto.match(/FIN-\d+/i);
    if (fluxo === "TRANSFERÊNCIA") {
      if (!contas.origem || !contas.destino) faltando.push("conta de origem e conta de destino");
    } else if (!contas.origem) faltando.push("conta");
    if (status === "ESTORNADO" && !origemEstorno) faltando.push("finance_id de origem");
    if (empresasReais.length > 1) {
      plano.conclusao = "Movimento entre empresas não foi gravado.";
      plano.decisao = "Intercompany não é transferência simples. Cada empresa precisa do próprio lançamento.";
      plano.responsavel = AGENTES.caio;
      plano.proxima = "Informe os dois lançamentos separados, cada um com a conta da própria empresa.";
      memoria(plano, agora, "Intercompany bloqueado", plano.conclusao, "GRUPO", plano.proxima);
      return plano;
    }
    if (faltando.length) {
      plano.conclusao = "Lançamento não gravado. Falta dado.";
      plano.decisao = `DADO A COLETAR: ${faltando.join(", ")}. Ausência não virou zero.`;
      plano.responsavel = AGENTES.caio;
      plano.proxima = "Repita com empresa, R$, conta e se o dinheiro entrou ou saiu.";
      memoria(plano, agora, "Financeiro incompleto", plano.decisao, biz || "GRUPO", plano.proxima);
      return plano;
    }
    const moeda = /dolar|usd|us\$/.test(n) ? "USD" : "BRL";
    plano.tipo_acao = "FINANCEIRO_CONFIRMADO";
    plano.conclusao = `Lançamento de ${fluxo} em ${biz} gravado em financeiro.`;
    plano.decisao = status === "PARCIAL"
      ? "PARCIAL não quita o título. O caixa só usa o valor liquidado informado."
      : `Status ${status}. Valor positivo. O sentido está no fluxo.`;
    plano.responsavel = AGENTES.caio;
    plano.proxima = "Caio confere conta, competência e evidência. Nenhuma coluna calculada foi preenchida.";
    plano.garantirContas.push({ conta_id: contas.origem!, business_id: biz!, moeda });
    if (contas.destino) plano.garantirContas.push({ conta_id: contas.destino, business_id: biz!, moeda });
    plano.escritas.push({
      tabela: "financeiro",
      row: {
        finance_id: "{{FIN}}",
        business_id: biz,
        fluxo,
        valor_original: valor,
        moeda,
        conta_id: contas.origem,
        conta_destino_id: fluxo === "TRANSFERÊNCIA" ? contas.destino : null,
        status,
        descricao: texto.trim().slice(0, 300),
        liquidacao: status === "PAGO" || status === "RECEBIDO" ? agora.slice(0, 10) : null,
        competencia: agora.slice(0, 7),
        tipo_ajuste: status === "ESTORNADO" ? "ESTORNO" : null,
        finance_id_origem: origemEstorno ? origemEstorno[0].toUpperCase() : null,
        valor_liquidado_informado_brl: status === "PARCIAL" ? valor : null,
        source_system: "HELENA",
        sync_status: "INTERNO",
      },
    });

    const nomesEmpresas: Record<string, string> = {
      "BIZ-001": "iGreen Energy",
      "BIZ-002": "Ecossistema de Saúde",
      "BIZ-003": "Humano Digital",
      "BIZ-004": "E-living",
      "GRUPO": "Holding / Grupo",
    };

    plano.comprovante_financeiro = {
      finance_id: "{{FIN}}",
      business_id: biz!,
      empresa_nome: ehPessoal ? "Humano Digital (Pró-labore Pessoal)" : (nomesEmpresas[biz!] || biz!),
      fluxo,
      valor: valor!,
      moeda,
      conta: contas.origem!,
      data: agora.slice(0, 10),
      descricao: ehPessoal ? `Pró-labore Pessoal: ${texto.trim().slice(0, 250)}` : texto.trim().slice(0, 300),
      status,
      conciliado_por: "AGT-05 Caio (CFO)",
    };

    handoff(plano, agora, "AGT-05", `Lançamento ${fluxo} ${biz}`, plano.decisao, biz!);
    memoria(plano, agora, "Financeiro", plano.conclusao, biz!, plano.proxima);
    return plano;
  }

  if (/lead|oportunidade|proposta|pipeline|fechar venda|prospec/.test(n)) {
    if (!biz) {
      plano.conclusao = "Oportunidade não gravada.";
      plano.decisao = "DADO A COLETAR: empresa do portfólio.";
      plano.responsavel = AGENTES.victor;
      plano.proxima = "Diga se é iGreen, Saúde ou Humano Digital, e o nome do contato.";
      memoria(plano, agora, "CRM incompleto", plano.decisao, "GRUPO", plano.proxima);
      return plano;
    }
    plano.conclusao = "Oportunidade gravada no CRM, ainda em negociação.";
    plano.decisao = "Sem probabilidade inventada e sem cliente criado antes do ganho.";
    plano.responsavel = AGENTES.victor;
    plano.proxima = "Victor registra a próxima ação. Ganho é que pode gerar cliente e contrato.";
    plano.escritas.push({
      tabela: "crm",
      row: {
        opportunity_id: "{{OPP}}",
        business_id: biz,
        empresa_lead: texto.trim().slice(0, 180),
        etapa: "QUALIFICAÇÃO",
        status: "ABERTA",
        origem: "FUNDADOR",
        moeda: "BRL",
        resultado: null,
        source_system: "HELENA",
        sync_status: "INTERNO",
      },
    });
    handoff(plano, agora, "AGT-15", "Nova oportunidade", texto.trim(), biz);
    memoria(plano, agora, "CRM", plano.conclusao, biz, plano.proxima);
    return plano;
  }

  if (/reclamacao|chamado|suporte|cliente reclam/.test(n)) {
    plano.conclusao = biz ? "Chamado gravado em atendimento." : "Chamado não gravado.";
    plano.decisao = biz ? "Joana conduz o atendimento. Causa raiz ainda é NÃO CONFIRMADO." : "DADO A COLETAR: empresa.";
    plano.responsavel = AGENTES.joana;
    plano.proxima = "Joana registra o que o cliente disse, sem transformar a queixa em fato confirmado.";
    if (biz) {
      plano.escritas.push({
        tabela: "atendimento",
        row: {
          ticket_id: "{{TKT}}",
          business_id: biz,
          data_abertura: agora.slice(0, 10),
          canal: "FUNDADOR",
          assunto: texto.trim().slice(0, 180),
          descricao: texto.trim(),
          prioridade: "NORMAL",
          status: "ABERTO",
          responsavel: "AGT-20",
          causa_raiz: "NÃO CONFIRMADO",
          source_system: "HELENA",
          sync_status: "INTERNO",
        },
      });
      handoff(plano, agora, "AGT-20", "Novo atendimento", texto.trim(), biz);
    }
    memoria(plano, agora, "Atendimento", plano.conclusao, biz || "GRUPO", plano.proxima);
    return plano;
  }

  const matchEmpresa = texto.match(/(?:cria[rz]?|fazer?|fa[cç]a|cadastr(?:ar?|e)|adicionar?|nova)\s+(?:a\s+)?empresa\s+([A-Za-z0-9À-ÿ\s\-_]+)/i);
  if (matchEmpresa) {
    const nomeBruto = matchEmpresa[1].trim();
    const nomeEmpresa = nomeBruto.replace(/[.,;!?].*$/, "").replace(/\s+(?:hoje|por favor|agora|urgente).*$/i, "").trim();
    if (nomeEmpresa.length >= 2) {
      plano.conclusao = `Empresa "${nomeEmpresa}" criada formalmente no portfólio oficial como {{BIZ}}! Tarefa de estruturação gerada e vinculada.`;
      plano.decisao = "DEC-022: Materialização soberana de comando do fundador. Empresa inserida em portfolio e ativa no seletor.";
      plano.responsavel = AGENTES.helena;
      plano.proxima = "Helena coordena a equipe de 21 agentes para desenhar o blueprint enquanto o negócio já está ativo no sistema.";
      plano.escritas.push({
        tabela: "portfolio",
        row: {
          business_id: "{{BIZ}}",
          negocio: nomeEmpresa,
          ativo: "SIM",
          estagio: "VALIDAÇÃO",
          source_system: "HELENA",
          sync_status: "INTERNO",
        },
      });
      plano.escritas.push({
        tabela: "tarefas",
        row: {
          task_id: "{{TSK}}",
          business_id: "{{BIZ}}",
          tarefa: `Estruturar blueprint estratégico, marca e operação da empresa ${nomeEmpresa}`,
          tipo: "PLANEJAMENTO",
          responsavel: "Helena",
          prioridade: "ALTA",
          status: "ABERTA",
          definicao_de_pronto: `Blueprint completo de ${nomeEmpresa} com arquitetura de produto, modelo de receita, proposta de valor e governança.`,
          source_system: "HELENA",
          sync_status: "INTERNO",
        },
      });
      handoff(plano, agora, "AGT-01", `Nova empresa ${nomeEmpresa}`, `Criação formal autorizada pelo fundador. Empresa ativa no portfólio como {{BIZ}}.`, "{{BIZ}}");
      memoria(plano, agora, "Criação de Empresa", plano.conclusao, "{{BIZ}}", plano.proxima);
      return plano;
    }
  }

  if (/ideia|quero criar|vamos criar|nova funcao|novo modulo|poderia/.test(n)) {
    const decisao = homolog ? "DEPOIS" : "PRECISA VALIDAR";
    plano.conclusao = `Ideia classificada como ${decisao}. Nada foi construído.`;
    plano.decisao = homolog
      ? `DEPOIS. A frente em execução é a homologação, e a ideia não resolve este gargalo: ${gargalo}.`
      : "PRECISA VALIDAR antes de entrar no foco.";
    plano.responsavel = AGENTES.nina;
    plano.proxima = "Nina guarda a ideia. Ela não abre uma segunda frente em execução.";
    ideia(plano, agora, texto.trim(), decisao, biz || "GRUPO", plano.decisao);
    handoff(plano, agora, "AGT-10", `Ideia ${decisao}`, plano.decisao, biz || "GRUPO");
    memoria(plano, agora, "Ideia", plano.conclusao, biz || "GRUPO", plano.proxima);
    return plano;
  }

  plano.conclusao = "A fala ficou na memória. Nenhuma tabela de negócio foi alterada.";
  plano.decisao = "Assunto ainda sem tabela definida. Helena não espalhou o registro.";
  plano.proxima = "Diga se isso é dinheiro, venda, tarefa, calendário, atendimento ou ideia.";
  memoria(plano, agora, "Conversa", `${plano.conclusao} ${texto.trim().slice(0, 400)}`, biz || "GRUPO", plano.proxima);
  return plano;
}

const PREFIXO: Record<string, [string, string]> = {
  "{{MEM}}": ["memoria_mestre", "id"],
  "{{HND}}": ["handoffs", "id"],
  "{{IDEA}}": ["ideias", "id"],
  "{{FIN}}": ["financeiro", "finance_id"],
  "{{TSK}}": ["tarefas", "task_id"],
  "{{JOB}}": ["agent_jobs", "job_id"],
  "{{OPP}}": ["crm", "opportunity_id"],
  "{{TKT}}": ["atendimento", "ticket_id"],
  "{{BIZ}}": ["portfolio", "business_id"],
};

export async function proximoId(
  ids: string[],
  prefixo: string,
) {
  let max = 0;
  const re = new RegExp(`^${prefixo}-(\\d+)$`, "i");
  for (const id of ids) {
    const m = String(id).match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const digits = prefixo === "BIZ" ? 3 : 4;
  return `${prefixo}-${String(max + 1).padStart(digits, "0")}`;
}

export function prefixoDe(token: string) {
  const tabela = PREFIXO[token];
  if (!tabela) return null;
  const prefixos: Record<string, string> = {
    memoria_mestre: "MEM",
    handoffs: "HND",
    ideias: "IDEA",
    financeiro: "FIN",
    tarefas: "TSK",
    agent_jobs: "JOB",
    crm: "OPP",
    atendimento: "TKT",
    portfolio: "BIZ",
  };
  return { tabela: tabela[0], coluna: tabela[1], prefixo: prefixos[tabela[0]] };
}
