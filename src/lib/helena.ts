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

export type Plano = {
  conclusao: string;
  evidencia: string;
  decisao: string;
  responsavel: string;
  proxima: string;
  escritas: Escrita[];
  garantirContas: { conta_id: string; business_id: string; moeda: string }[];
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
  const m = texto.match(/r\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)/i);
  if (!m) return null;
  const raw = m[1];
  if (raw.includes(",")) return Number(raw.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(raw)) return Number(raw.replace(/\./g, ""));
  return Number(raw);
}

function empresas(texto: string) {
  const n = semAcento(texto);
  const achou: string[] = [];
  if (/\bigreen\b|\bi green\b|\bbiz-001\b|\bbiz 001\b/.test(n)) achou.push("BIZ-001");
  if (/\bsaude\b|\becossistema\b|\bbiz-002\b|\bbiz 002\b/.test(n)) achou.push("BIZ-002");
  if (/\bhumano digital\b|\bbiz-003\b|\bbiz 003\b/.test(n)) achou.push("BIZ-003");
  if (/\bgrupo\b/.test(n)) achou.push("GRUPO");
  return achou;
}

function fluxoDe(texto: string) {
  const n = semAcento(texto);
  if (/transfer/.test(n)) return "TRANSFERÊNCIA";
  if (/paguei|pagamento|despesa|saiu|saida/.test(n)) return "SAÍDA";
  if (/recebi|recebido|entrou|entrada|receita/.test(n)) return "ENTRADA";
  return null;
}

function statusDe(texto: string, fluxo: string | null) {
  const n = semAcento(texto);
  if (/parcial/.test(n)) return "PARCIAL";
  if (/previst/.test(n)) return "PREVISTO";
  if (/cancel/.test(n)) return "CANCELADO";
  if (/estorn/.test(n)) return "ESTORNADO";
  if (/recebi|recebido/.test(n) && fluxo === "ENTRADA") return "RECEBIDO";
  if (/paguei|\bpago\b/.test(n) && fluxo === "SAÍDA") return "PAGO";
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
  const biz = bizs.find((id) => id !== "GRUPO") || bizs[0] || null;
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

  const fluxo = fluxoDe(n);
  const valor = lerValor(texto);
  const pareceDinheiro = Boolean((fluxo || /estorn/.test(n)) && (valor !== null || /transfer|lanc|estorn/.test(n)));
  if (pareceDinheiro) {
    const contas = contasDe(texto);
    const status = statusDe(texto, fluxo);
    const faltando: string[] = [];
    if (!biz || bizs.filter((id) => id !== "GRUPO").length > 1) faltando.push("uma única empresa");
    if (valor === null || valor < 0) faltando.push("valor positivo com R$");
    if (!fluxo) faltando.push("fluxo ENTRADA, SAÍDA ou TRANSFERÊNCIA");
    const origemEstorno = texto.match(/FIN-\d+/i);
    if (fluxo === "TRANSFERÊNCIA") {
      if (!contas.origem || !contas.destino) faltando.push("conta de origem e conta de destino");
    } else if (!contas.origem) faltando.push("conta");
    if (status === "ESTORNADO" && !origemEstorno) faltando.push("finance_id de origem");
    if (bizs.filter((id) => id !== "GRUPO").length > 1) {
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
  "{{OPP}}": ["crm", "opportunity_id"],
  "{{TKT}}": ["atendimento", "ticket_id"],
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
  return `${prefixo}-${String(max + 1).padStart(4, "0")}`;
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
    crm: "OPP",
    atendimento: "TKT",
  };
  return { tabela: tabela[0], coluna: tabela[1], prefixo: prefixos[tabela[0]] };
}
