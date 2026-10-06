import { extractBRLCents } from "./domain/money";

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
  // Centavos inteiros: "R$ 1000" vale mil (o regex antigo lia 100), e
  // mais de um valor no mesmo texto fica sem confirmação em vez de chutado.
  const centavos = extractBRLCents(texto);
  return centavos === null ? null : centavos / 100;
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

  if (/publica|post\b|stor(?:y|ies)|feed\b|conteudo para rede|anuncio|campanha/.test(n)) {
    // Pedido de conteúdo vira missão real: nada de texto pronto nem aprovação
    // inventada. A entrega só existe depois da execução e da revisão dos agentes.
    const empresaAlvo = empresasReais[0] || null;
    plano.tipo_acao = "CRIACAO_CONTEUDO";
    if (!empresaAlvo) {
      plano.conclusao = "Pedido de conteúdo recebido, mas a empresa não ficou clara. Nada foi gravado.";
      plano.decisao = "ESCLARECIMENTO: a missão precisa de business_id antes de ir para a equipe.";
      plano.pergunta_esclarecimento = "Para qual empresa é esse conteúdo?";
      plano.opcoes_resposta = ctx.negocios.map((item) => ({
        label: `${item.negocio} (${item.business_id})`,
        comando: `${texto.trim()} — empresa ${item.business_id}`,
      }));
      plano.proxima = "Responda indicando a empresa para a Helena abrir a missão.";
      return plano;
    }
    plano.conclusao = "Missão de conteúdo registrada. Ainda não existe peça produzida: a equipe executa e revisa antes de qualquer entrega.";
    plano.decisao = "Fluxo: Camila (estratégia) → Isabela (copy) → Maya (peças) → revisão independente → Helena consolida.";
    plano.responsavel = "AGT-16 Camila";
    plano.proxima = "Camila recebe o pedido original e abre a estratégia; acompanhe em Entregas e na Sala de comando.";
    plano.escritas.push({
      tabela: "tarefas",
      row: {
        task_id: "{{TSK}}",
        business_id: empresaAlvo,
        tarefa: texto.trim().slice(0, 300),
        tipo: "MARKETING",
        responsavel: "AGT-16",
        prioridade: "ALTA",
        status: "NÃO INICIADA",
        definicao_de_pronto: "Todas as peças pedidas existem como arquivo final, com copy, revisão independente aprovada e evidência.",
        source_system: "HELENA",
        sync_status: "INTERNO",
      },
    });
    handoff(plano, agora, "AGT-16", "Missão de conteúdo do fundador", texto.trim(), empresaAlvo);
    memoria(plano, agora, "Pedido de conteúdo do fundador", texto.trim(), empresaAlvo, plano.proxima);
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
      "BIZ-004": "eLiving",
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
    const nomeLimpo = nomeBruto.replace(/[.,;!?].*$/, "").replace(/\s+(?:hoje|por favor|agora|urgente).*$/i, "").trim();
    const nomeEmpresa = /^(?:e-?living|iliving)$/i.test(nomeLimpo) ? "eLiving" : nomeLimpo;
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
