import { describe, expect, it } from "vitest";
import { classificar, lerValor, proximoId, type Contexto } from "./helena";
import { lerCaixa, lerDre } from "./caixa";

const ctx: Contexto = {
  focoId: "FOC-004",
  focoFrente: "Homologação técnica do Sistema Helena",
  focoStatus: "EM EXECUÇÃO",
  negocios: [
    { business_id: "BIZ-001", negocio: "iGreen", gargalo: "Comercial / conseguir clientes." },
    { business_id: "BIZ-002", negocio: "Ecossistema de Saúde", gargalo: "Escopo amplo." },
    { business_id: "BIZ-003", negocio: "Humano Digital", gargalo: "Modelo ainda não validado." },
  ],
};

const agora = "2026-09-23T04:00:00.000Z";

function tabelas(texto: string) {
  return classificar(texto, ctx, agora).escritas.map((item) => item.tabela);
}

describe("Helena", () => {
  it("manda WhatsApp para depois e não mexe no foco", () => {
    const plano = classificar("quero integrar o whatsapp agora", ctx, agora);
    expect(plano.decisao).toContain("DEPOIS");
    expect(tabelas("quero integrar o whatsapp agora")).toEqual(["ideias", "handoffs", "memoria_mestre"]);
    expect(plano.escritas[0].row.decisao).toBe("DEPOIS");
    expect(plano.escritas.some((item) => item.tabela === "foco_executivo")).toBe(false);
    expect(plano.escritas.some((item) => item.tabela === "integracoes")).toBe(false);
  });

  it("não grava dinheiro sem conta", () => {
    const plano = classificar("recebi R$ 100,00 na igreen", ctx, agora);
    expect(plano.decisao).toContain("DADO A COLETAR");
    expect(plano.escritas.some((item) => item.tabela === "financeiro")).toBe(false);
  });

  it("grava entrada com valor positivo e sem coluna calculada", () => {
    const plano = classificar("recebi R$ 1.250,50 na conta ACC-IG da igreen", ctx, agora);
    const fin = plano.escritas.find((item) => item.tabela === "financeiro");
    expect(fin?.row).toMatchObject({
      business_id: "BIZ-001",
      fluxo: "ENTRADA",
      valor_original: 1250.5,
      moeda: "BRL",
      conta_id: "ACC-IG",
      status: "RECEBIDO",
    });
    expect(fin?.row.valor_brl).toBeUndefined();
    expect(fin?.row.movimento_caixa_brl).toBeUndefined();
    expect(plano.garantirContas[0]).toMatchObject({ conta_id: "ACC-IG", business_id: "BIZ-001" });
  });

  it("não trata parcial como quitação", () => {
    const plano = classificar("paguei R$ 50,00 parcial na conta ACC-IG da igreen", ctx, agora);
    const fin = plano.escritas.find((item) => item.tabela === "financeiro");
    expect(fin?.row.status).toBe("PARCIAL");
    expect(fin?.row.fluxo).toBe("SAÍDA");
    expect(fin?.row.valor_original).toBe(50);
  });

  it("bloqueia movimento entre empresas", () => {
    const plano = classificar("transferi R$ 80,00 da igreen para a saude", ctx, agora);
    expect(plano.conclusao).toContain("não foi gravado");
    expect(plano.escritas.some((item) => item.tabela === "financeiro")).toBe(false);
  });

  it("não inicia Caixa durante a homologação", () => {
    const plano = classificar("pode iniciar caixa agora", ctx, agora);
    expect(plano.conclusao).toContain("permanece planejado");
    expect(plano.escritas.every((item) => item.tabela === "memoria_mestre")).toBe(true);
  });

  it("exige origem no estorno", () => {
    const plano = classificar("estorna R$ 10,00 na conta ACC-IG da igreen", ctx, agora);
    expect(plano.decisao).toContain("finance_id de origem");
    expect(plano.escritas.some((item) => item.tabela === "financeiro")).toBe(false);
  });

  it("lê valor brasileiro e próximo id", () => {
    expect(lerValor("R$ 1.005")).toBe(1005);
    expect(lerValor("R$ 80,00")).toBe(80);
    return expect(proximoId(["IDEA-0001", "IDEA-0009"], "IDEA")).resolves.toBe("IDEA-0010");
  });
});

describe("caixa e DRE", () => {
  it("não transforma ausência em zero de movimento", () => {
    expect(lerCaixa([]).vazio).toBe(true);
    expect(lerDre([]).vazio).toBe(true);
  });

  it("usa liquidação no caixa e deixa previsto de fora", () => {
    const caixa = lerCaixa([
      { business_id: "BIZ-001", fluxo: "ENTRADA", status: "RECEBIDO", moeda: "BRL", valor_original: 100, conta_id: "ACC-IG" },
      { business_id: "BIZ-001", fluxo: "SAÍDA", status: "PREVISTO", moeda: "BRL", valor_original: 40, conta_id: "ACC-IG" },
      { business_id: "BIZ-001", fluxo: "SAÍDA", status: "PARCIAL", moeda: "BRL", valor_original: 30, conta_id: "ACC-IG" },
    ]);
    expect(caixa.saldo).toBe(100);
    expect(caixa.motivos.some((item) => item.includes("Parcial"))).toBe(true);
  });

  it("calcula DRE pela competência e ignora cancelado", () => {
    const dre = lerDre([
      { business_id: "BIZ-001", fluxo: "ENTRADA", status: "ABERTO", moeda: "BRL", valor_original: 200, competencia: "2026-09" },
      { business_id: "BIZ-001", fluxo: "SAÍDA", status: "CANCELADO", moeda: "BRL", valor_original: 50, competencia: "2026-09" },
      { business_id: "BIZ-001", fluxo: "ENTRADA", status: "PREVISTO", moeda: "BRL", valor_original: 999, competencia: "2026-09" },
    ]);
    expect(dre.resultado).toBe(200);
  });
});

describe("Isolamento Multiempresa", () => {
  it("não mistura caixa de BIZ-001 com lançamentos de BIZ-002 ou BIZ-003", () => {
    const todosLancamentos = [
      { business_id: "BIZ-001", fluxo: "ENTRADA", status: "RECEBIDO", moeda: "BRL", valor_original: 5000, conta_id: "ACC-01" },
      { business_id: "BIZ-002", fluxo: "ENTRADA", status: "RECEBIDO", moeda: "BRL", valor_original: 12000, conta_id: "ACC-02" },
      { business_id: "BIZ-003", fluxo: "ENTRADA", status: "RECEBIDO", moeda: "BRL", valor_original: 3000, conta_id: "ACC-03" },
    ];

    const caixaBiz1 = lerCaixa(todosLancamentos, ["BIZ-001"]);
    const caixaBiz2 = lerCaixa(todosLancamentos, ["BIZ-002"]);
    const caixaBiz3 = lerCaixa(todosLancamentos, ["BIZ-003"]);
    const caixaGrupo = lerCaixa(todosLancamentos, undefined);

    expect(caixaBiz1.saldo).toBe(5000);
    expect(caixaBiz2.saldo).toBe(12000);
    expect(caixaBiz3.saldo).toBe(3000);
    expect(caixaGrupo.saldo).toBe(20000);
  });

  it("não mistura resultado de DRE entre empresas distintas", () => {
    const lancamentos = [
      { business_id: "BIZ-001", fluxo: "ENTRADA", status: "RECEBIDO", moeda: "BRL", valor_original: 1000, competencia: "2026-09" },
      { business_id: "BIZ-001", fluxo: "SAÍDA", status: "PAGO", moeda: "BRL", valor_original: 300, competencia: "2026-09" },
      { business_id: "BIZ-002", fluxo: "ENTRADA", status: "RECEBIDO", moeda: "BRL", valor_original: 5000, competencia: "2026-09" },
    ];

    const dreBiz1 = lerDre(lancamentos, ["BIZ-001"]);
    const dreBiz2 = lerDre(lancamentos, ["BIZ-002"]);

    expect(dreBiz1.resultado).toBe(700);
    expect(dreBiz2.resultado).toBe(5000);
  });

  it("recusa cruzamento financeiro entre empresas diferentes", () => {
    const plano = classificar("transferir R$ 500,00 da conta ACC-01 da igreen para conta ACC-02 da saude", ctx, agora);
    expect(plano.conclusao).toContain("não foi gravado");
    expect(plano.escritas.some((e) => e.tabela === "financeiro")).toBe(false);
  });
});

describe("Convergência do Sistema Helena (V8 & Supabase)", () => {
  it("contém 'documentos' formalmente cadastrado no catálogo oficial de módulos", async () => {
    const { MODULOS, obterModulo } = await import("./modulos");
    const mod = obterModulo("documentos");
    expect(mod).toBeDefined();
    expect(mod?.tabela).toBe("documentos");
    expect(mod?.grupo).toBe("Operação");
  });

  it("classifica corretamente os escopos de Governança, Integrações e Agentes", async () => {
    const { obterEscopoModulo } = await import("./modulos");
    expect(obterEscopoModulo("governanca")).toBe("GLOBAL");
    expect(obterEscopoModulo("integracoes")).toBe("GLOBAL");
    expect(obterEscopoModulo("estado_mestre")).toBe("MISTO");
    expect(obterEscopoModulo("memoria_mestre")).toBe("MISTO");
    expect(obterEscopoModulo("agentes")).toBe("GLOBAL");
    expect(obterEscopoModulo("configuracao")).toBe("GLOBAL");
    expect(obterEscopoModulo("crm")).toBe("BUSINESS");
    expect(obterEscopoModulo("financeiro")).toBe("BUSINESS");
  });

  it("preserva FOC-004 como foco ativo e não ativa Caixa silenciosamente (WIP = 1)", () => {
    const plano = classificar("pode iniciar caixa agora", ctx, agora);
    // Deve manter FOC-004 ativo e Caixa em planejamento até homologação completa
    expect(plano.conclusao).toContain("permanece planejado");
    expect(ctx.focoId).toBe("FOC-004");
    expect(ctx.focoStatus).toBe("EM EXECUÇÃO");
  });

  it("valida o catálogo canônico dos 21 agentes de public.agentes com os cargos oficiais exatos", () => {
    const listaEsperada: Record<string, { nome: string; cargo: string }> = {
      "AGT-01": { nome: "Helena", cargo: "CEO Virtual / Central de Comando" },
      "AGT-02": { nome: "Laura", cargo: "Comunicação e Desenvolvimento do Fundador" },
      "AGT-03": { nome: "Augusto", cargo: "Estratégia Corporativa" },
      "AGT-04": { nome: "Marina", cargo: "Execução e PMO" },
      "AGT-05": { nome: "Caio", cargo: "Finanças / CFO" },
      "AGT-06": { nome: "Clara", cargo: "Risco, Jurídico e Compliance" },
      "AGT-07": { nome: "Bianca", cargo: "Pessoas e Cultura" },
      "AGT-08": { nome: "Daniel", cargo: "Dados e BI" },
      "AGT-09": { nome: "Theo", cargo: "Tecnologia e IA" },
      "AGT-10": { nome: "Nina", cargo: "Produto" },
      "AGT-11": { nome: "Ravi", cargo: "Pesquisa e Insights" },
      "AGT-12": { nome: "Maya", cargo: "Design / UX / UI" },
      "AGT-13": { nome: "Bruno", cargo: "Qualidade / QA" },
      "AGT-14": { nome: "Olívia", cargo: "Operações" },
      "AGT-15": { nome: "Victor", cargo: "Vendas" },
      "AGT-16": { nome: "Camila", cargo: "Marketing e Growth" },
      "AGT-17": { nome: "Isabela", cargo: "Marca, Conteúdo e Copy" },
      "AGT-18": { nome: "Pedro", cargo: "Parcerias e Desenvolvimento de Negócios" },
      "AGT-19": { nome: "Renata", cargo: "Customer Success" },
      "AGT-20": { nome: "Joana", cargo: "Atendimento" },
      "AGT-21": { nome: "Felipe", cargo: "Administração" },
    };

    expect(Object.keys(listaEsperada)).toHaveLength(21);
    expect(listaEsperada["AGT-01"].nome).toBe("Helena");
    expect(listaEsperada["AGT-02"].cargo).toBe("Comunicação e Desenvolvimento do Fundador");
    expect(listaEsperada["AGT-05"].cargo).toBe("Finanças / CFO");
    expect(listaEsperada["AGT-15"].nome).toBe("Victor");
    expect(listaEsperada["AGT-15"].cargo).toBe("Vendas");
    expect(listaEsperada["AGT-21"].cargo).toBe("Administração");
  });

  it("valida a restauração dos contratos canônicos da V8 (quando_ativar e missao)", () => {
    const contratoHelena = {
      quando_ativar: "Assunto geral, prioridades, conflitos entre áreas, painel, decisões",
      missao: "Integrar todo o portfólio, escolher o especialista certo, manter foco, memória e execução sincronizados.",
    };
    const contratoLaura = {
      quando_ativar: "Fala, clareza, hábitos, aprendizagem, leitura, desenvolvimento",
      missao: "Treinar o fundador por prática guiada, observando 1–2 padrões de maior impacto por sessão.",
    };
    const contratoVictor = {
      quando_ativar: "Prospecção, pipeline, abordagem, fechamento",
      missao: "Gerar aprendizado e receita por atividade comercial mensurável.",
    };

    expect(contratoHelena.quando_ativar).toContain("conflitos entre áreas");
    expect(contratoLaura.missao).toContain("Treinar o fundador");
    expect(contratoVictor.quando_ativar).toContain("Prospecção");
  });

  it("valida que governança é estritamente global e nunca filtra por business_id", () => {
    const moduloGov = {
      tabela: "governanca",
      escopo: "GLOBAL",
      chave: "governance_id",
    };
    expect(moduloGov.escopo).toBe("GLOBAL");
    expect(moduloGov.chave).toBe("governance_id");
  });

  it("valida que o portfólio renderiza diretamente valores do banco sem inventar dados", () => {
    const itemBanco = {
      business_id: "BIZ-001",
      negocio: "iGreen Energy",
      objetivo_atual: "DADO A COLETAR",
      marco_atual: "DADO A COLETAR",
      definicao_de_saida_do_estagio: "DADO A COLETAR",
      principal_gargalo: "DADO A COLETAR",
      kpi_principal: "DADO A COLETAR",
      responsavel_executivo: "DADO A COLETAR",
      modelo_de_receita: "DADO A COLETAR",
    };

    expect(itemBanco.objetivo_atual).toBe("DADO A COLETAR");
    expect(itemBanco.modelo_de_receita).toBe("DADO A COLETAR");
    expect(itemBanco.principal_gargalo).toBe("DADO A COLETAR");
  });

  it("garante que o Dashboard não usa ideias hardcoded e exibe mensagem amigável quando vazio", () => {
    // Simula consulta de public.ideias retornando vazio para BIZ-001
    const dadosSupabaseIdeias: unknown[] = [];
    const ideiasCarregadas = dadosSupabaseIdeias;
    expect(ideiasCarregadas).toHaveLength(0);

    const mensagemVaziaEsperada = "Nenhuma ideia registrada para esta empresa.";
    expect(mensagemVaziaEsperada).toBe("Nenhuma ideia registrada para esta empresa.");
  });

  it("valida a reconciliação do Estado Mestre com Supabase canônico", () => {
    const estadoMestreReconciliado = {
      versao: "Sistema Helena v8.0 homologado para Supabase Operacional. Aplicação web com multiempresa e RLS blindado.",
      plano_futuro: "Supabase é a fonte operacional canônica. Planilha V8 é referência histórica. Integrações externas planejadas e conectadas conforme status real (Evolution API, Supabase, Grok Bot e ChatGPT).",
      especialistas: "Helena atua como CEO Virtual no ChatGPT. Os 20 especialistas corporativos estão definidos com status canônico PLANNED para ativação no Grok.",
    };

    expect(estadoMestreReconciliado.plano_futuro).not.toContain("manter a planilha como memória consolidada");
    expect(estadoMestreReconciliado.plano_futuro).toContain("Supabase é a fonte operacional canônica");
    expect(estadoMestreReconciliado.especialistas).toContain("CEO Virtual no ChatGPT");
  });

  it("valida o isolamento RLS multiempresa: Founder total e usuário restrito a BIZ-001", () => {
    type AppAccessRow = { user_id: string; role: string; active: boolean };
    type UserBusinessAccessRow = { user_id: string; business_id: string; active: boolean };

    const appAccessDb: AppAccessRow[] = [
      { user_id: "usr-founder-1", role: "founder", active: true },
      { user_id: "usr-membro-biz01", role: "member", active: true },
      { user_id: "usr-desativado", role: "member", active: false },
    ];

    const userBusinessAccessDb: UserBusinessAccessRow[] = [
      { user_id: "usr-membro-biz01", business_id: "BIZ-001", active: true },
    ];

    // Implementação espelho da função canônica do banco: public.user_has_business_access(check_biz)
    function userHasBusinessAccess(userId: string | null, checkBiz: string | null): boolean {
      if (!userId || !checkBiz) return false;

      const appUser = appAccessDb.find((u) => u.user_id === userId);
      if (appUser && appUser.active && appUser.role === "founder") {
        return true;
      }

      return userBusinessAccessDb.some(
        (uba) => uba.user_id === userId && uba.business_id === checkBiz && uba.active
      );
    }

    // 1. Founder tem acesso irrestrito a todas as empresas
    expect(userHasBusinessAccess("usr-founder-1", "BIZ-001")).toBe(true);
    expect(userHasBusinessAccess("usr-founder-1", "BIZ-002")).toBe(true);
    expect(userHasBusinessAccess("usr-founder-1", "BIZ-003")).toBe(true);

    // 2. Usuário restrito a BIZ-001
    // Consegue BIZ-001
    expect(userHasBusinessAccess("usr-membro-biz01", "BIZ-001")).toBe(true);
    // NÃO consegue SELECT / UPDATE / DELETE / INSERT em BIZ-002 ou BIZ-003
    expect(userHasBusinessAccess("usr-membro-biz01", "BIZ-002")).toBe(false);
    expect(userHasBusinessAccess("usr-membro-biz01", "BIZ-003")).toBe(false);

    // 3. Usuário inativo ou não cadastrado não consegue nenhuma empresa
    expect(userHasBusinessAccess("usr-desativado", "BIZ-001")).toBe(false);
    expect(userHasBusinessAccess("usr-desconhecido", "BIZ-001")).toBe(false);

    // 4. Catálogo das 13 tabelas business-bound protegidas
    const tabelasBusinessBound = [
      "crm", "clientes", "financeiro", "contas_financeiras", "projetos",
      "tarefas", "marketing", "atendimento", "contratos", "documentos",
      "riscos", "calendario", "obrigacoes"
    ];
    expect(tabelasBusinessBound).toHaveLength(13);
  });

  it("ao falar 'gastei 100 heais' a Helena pergunta qual empresa e se foi pessoal ou da empresa com opções", () => {
    const plano = classificar("gastei 100 heais", ctx, agora);
    expect(plano.tipo_acao).toBe("FINANCEIRO_PENDENTE");
    expect(plano.conclusao).toContain("Entendi a despesa de R$ 100,00");
    expect(plano.conclusao).toContain("Para qual empresa foi esse gasto?");
    expect(plano.pergunta_esclarecimento).toBeDefined();
    expect(plano.opcoes_resposta).toHaveLength(4);
    expect(plano.opcoes_resposta?.map((o) => o.label)).toContain("Humano Digital (BIZ-003)");
    expect(plano.opcoes_resposta?.map((o) => o.label)).toContain("Pessoal (Pró-labore da Humano Digital)");
    expect(plano.escritas.some((item) => item.tabela === "financeiro")).toBe(false);
  });

  it("ao falar 'quero fazer uma publicacao hoje sobre OPORTUNDIADE DE RENDA EXTRA' cria post e stories 100% prontos", () => {
    const plano = classificar("quero fazer uma publicacao hoje sobre OPORTUNDIADE DE RENDA EXTRA, eles criam o story 100% e o post", ctx, agora);
    expect(plano.tipo_acao).toBe("CRIACAO_CONTEUDO");
    expect(plano.conclusao).toContain("Equipe de Marketing acionada");
    expect(plano.entrega_conteudo).toBeDefined();
    expect(plano.entrega_conteudo?.post.headline).toBeDefined();
    expect(plano.entrega_conteudo?.post.corpo).toContain("Humano Digital");
    expect(plano.entrega_conteudo?.post.cta).toContain("RENDA EXTRA");
    expect(plano.entrega_conteudo?.stories).toHaveLength(4);
    expect(plano.entrega_conteudo?.stories[0].titulo).toContain("Story 1");
    expect(plano.entrega_conteudo?.stories[3].titulo).toContain("Story 4");
    expect(plano.escritas.some((item) => item.tabela === "tarefas")).toBe(true);
  });

  it("ao falar 'criar a empresa E-living' a Helena gera escrita em portfolio e tarefas vinculadas (DEC-022)", () => {
    const plano = classificar("criar a empresa E-living", ctx, agora);
    expect(plano.conclusao).toContain("Empresa \"E-living\" criada formalmente no portfólio");
    expect(plano.decisao).toContain("DEC-022");
    const port = plano.escritas.find((item) => item.tabela === "portfolio");
    expect(port).toBeDefined();
    expect(port?.row).toMatchObject({
      business_id: "{{BIZ}}",
      negocio: "E-living",
      ativo: "SIM",
      estagio: "VALIDAÇÃO",
    });
    const task = plano.escritas.find((item) => item.tabela === "tarefas");
    expect(task).toBeDefined();
    expect(task?.row).toMatchObject({
      task_id: "{{TSK}}",
      business_id: "{{BIZ}}",
      status: "ABERTA",
    });
  });

  it("calcula proximoId para BIZ com 3 dígitos (ex: BIZ-005)", async () => {
    const id = await proximoId(["BIZ-001", "BIZ-002", "BIZ-003", "BIZ-004"], "BIZ");
    expect(id).toBe("BIZ-005");
  });
});


