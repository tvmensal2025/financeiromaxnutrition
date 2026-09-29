export type AgenteComando = {
  agent_id: string; agente: string; cargo_funcao: string; missao: string | null;
  quando_ativar: string | null; ler_antes_de_responder: string | null;
  pode_atualizar: string | null; saida_obrigatoria: string | null;
  escalar_para: string | null; status: string | null;
};
export type TarefaComando = {
  task_id: string; tarefa: string; business_id: string | null; project_id: string | null;
  responsavel: string | null; status: string | null; prioridade: string | null;
  prazo: string | null; bloqueio: string | null; evidencia: string | null;
  definicao_de_pronto: string | null; atualizado_em: string | null;
};
export type FocoComando = { id: string; frente: string; status: string; responsavel: string | null; criterio_de_saida: string | null; objetivo: string | null };
export type ConexaoComando = { agent_id: string; connection_status: string | null; last_tested_at: string | null };
export type HandoffComando = { id: string; de: string | null; para: string | null; business_id_area: string | null; assunto: string; status: string | null; atualizado_em: string | null };
export type JobComando = { job_id: string; task_id: string | null; agent_id: string; business_id: string | null; objective: string | null; status: string; priority: string | null; correlation_id: string | null; available_at: string | null; claimed_at: string | null; started_at: string | null; completed_at: string | null; attempt_count: number; max_attempts: number; approval_required: boolean; approval_status: string | null; result_summary: string | null; result_payload?: unknown; evidence_refs: unknown; error_message: string | null; created_at: string | null; updated_at: string | null };
export type EventoComando = { event_id: string; job_id: string | null; agent_id: string | null; business_id: string | null; event_type: string | null; status: string | null; message: string | null; payload?: unknown; created_at: string | null };
export type DecisaoComando = { decision_id: string; business_id: string | null; escopo: string | null; tipo: string | null; decisao: string; motivo: string | null; decisor: string | null; evidencia_fonte: string | null; impacto_esperado: string | null; revisar_em: string | null; status: string | null; data_hora: string | null; atualizado_em: string | null };
export type AuditoriaComando = { audit_id: string; data_hora: string | null; agente_usuario: string | null; acao: string | null; sheet: string | null; object_id: string | null; campo: string | null; motivo: string | null; fonte_evidencia: string | null; valor_novo: string | null; criado_em: string | null };
export type AtividadeTarefaComando = { event_id: number; task_id: string; business_id: string | null; event_type: string; changed_fields: string[]; status_before: string | null; status_after: string | null; actor_uid: string | null; actor_role: string | null; occurred_at: string };
export type Fonte<T> = { rows: T[]; estado: "ok" | "erro" | "parcial" };
export type DadosComando = {
  agentes: Fonte<AgenteComando>; tarefas: Fonte<TarefaComando>; focos: Fonte<FocoComando>;
  conexoes: Fonte<ConexaoComando>; handoffs: Fonte<HandoffComando>;
  projetos: Fonte<{ project_id: string; business_id: string | null }>;
  recorrencias: Fonte<{ recurrence_id: string; nome: string; business_id: string | null; status: string | null; responsavel: string | null; frequencia: string | null; gerar_automaticamente: string | null; proxima_ocorrencia: string | null }>;
  jobs: Fonte<JobComando>;
  eventos: Fonte<EventoComando>;
  decisoes: Fonte<DecisaoComando>;
  auditoria: Fonte<AuditoriaComando>;
  atividade: Fonte<AtividadeTarefaComando>;
  checkpoint: Fonte<{ checkpoint_id: string; versao: number | null; status: string | null; atualizado_em: string | null; snapshot: unknown }>;
};
export function normalizar(s: string | null | undefined) {
  return (s ?? "").normalize("NFD").replace(/\p{M}/gu, "").trim().toUpperCase();
}
export function encerrada(status: string | null) {
  return ["CONCLUIDA", "CONCLUIDO", "CANCELADA", "CANCELADO"].includes(normalizar(status));
}
export function temInformacao(valor: string | null | undefined) {
  return !!valor?.trim() && !["DADO A COLETAR", "NAO CONFIRMADO", "NAO INFORMADO", "NENHUM", "NENHUMA", "N/A", "-"].includes(normalizar(valor));
}
export function pendenciasCadastro(t: TarefaComando) {
  const cancelada = ["CANCELADA", "CANCELADO"].includes(normalizar(t.status));
  return [
    !temInformacao(t.responsavel) && "Definir o responsável pela entrega",
    !temInformacao(t.prazo) && "Registrar o prazo combinado",
    !temInformacao(t.definicao_de_pronto) && "Definir o critério para aceitar a entrega",
    !cancelada && !temInformacao(t.evidencia) && (encerrada(t.status) ? "Conferir a ausência de evidência no registro encerrado" : "Anexar a evidência do trabalho realizado"),
  ].filter((s): s is string => !!s);
}
export function noEscopo(empresa: string | null, selecionada: string) {
  if (selecionada === "GRUPO") return true;
  return empresa === selecionada || ["GRUPO", "SISTEMA"].includes(normalizar(empresa));
}
// Campos legados misturam nome e identificador. Um ID explícito tem precedência
// sobre o nome no mesmo trecho; isso não substitui um vínculo relacional futuro.
export function atribuidoA(responsavel: string | null, agente: Pick<AgenteComando, "agent_id" | "agente">) {
  return normalizar(responsavel).split(/[+;,/]|\s+E\s+/).some(trecho => {
    const ids = trecho.match(/\bAGT-\d+\b/g);
    if (ids) return ids.includes(normalizar(agente.agent_id));
    const nome = normalizar(agente.agente);
    return !!nome && trecho.split(/[^A-Z0-9]+/).includes(nome);
  });
}
export function diaSaoPaulo(agora = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(agora);
  return ["year", "month", "day"].map(k => p.find(x => x.type === k)?.value).join("-");
}
export function atrasada(t: TarefaComando, hoje = diaSaoPaulo()) {
  return !encerrada(t.status) && !!t.prazo && /^\d{4}-\d{2}-\d{2}$/.test(t.prazo) && t.prazo < hoje;
}
export function requerFundador(t: TarefaComando) {
  if (encerrada(t.status)) return false;
  return /\bFUNDADOR\b/.test(normalizar(t.responsavel)) || /DECISAO NECESSARIA\s*[—–:-]*\s*FUNDADOR\b/.test(normalizar(t.bloqueio));
}
export function resumoExecutivoTarefa(t: TarefaComando) {
  const texto = t.tarefa?.trim() || "Entrega sem título registrado";
  const base = texto
    .replace(/\b(RUNPOD_API_KEY|API_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ACCESS_TOKEN|OPENAI_API_KEY|GEMINI_API_KEY|WHAPI_TOKEN|LOGIN_PASSWORD)\b/gi, "credenciais sensíveis")
    .replace(/\s*\([^)]{35,}\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base.length > 118 ? `${base.slice(0, 115).trim()}...` : base;
}
export function etiquetasPrioridade(t: TarefaComando) {
  return [
    requerFundador(t) && "Precisa de você",
    normalizar(t.status) === "BLOQUEADA" && "Travada",
    atrasada(t) && "Prazo vencido",
  ].filter((s): s is string => !!s);
}
export function scorePrioridade(t: TarefaComando) {
  const pesos: Record<string, number> = { CRITICA: 40, ALTA: 30, MEDIA: 20, BAIXA: 10 };
  return (requerFundador(t) ? 100 : 0) + (normalizar(t.status) === "BLOQUEADA" ? 70 : 0) + (atrasada(t) ? 50 : 0) + (pesos[normalizar(t.prioridade)] || 0);
}
export function agruparStatus(tarefas: TarefaComando[]) {
  const grupos = [
    { id: "NÃO INICIADA", cor: "#79877f", n: 0 },
    { id: "EM EXECUÇÃO", cor: "#187757", n: 0 },
    { id: "BLOQUEADA", cor: "#b86523", n: 0 },
    { id: "CONCLUÍDA", cor: "#519582", n: 0 },
    { id: "CANCELADA", cor: "#9b91a6", n: 0 },
    { id: "OUTROS", cor: "#5b738f", n: 0 },
  ];
  for (const t of tarefas) {
    const grupo = grupos.find(g => normalizar(g.id) === normalizar(t.status));
    (grupo ?? grupos[5]).n++;
  }
  return grupos;
}
export function fonteResultado<T>(resultado: { data: unknown; error: unknown; count: number | null }): Fonte<T> {
  if (resultado.error || !Array.isArray(resultado.data)) return { rows: [], estado: "erro" };
  return { rows: resultado.data as T[], estado: resultado.count !== null && resultado.count > resultado.data.length ? "parcial" : "ok" };
}

export const indicadoresPropostos: Record<string, string> = {
  "AGT-01": "Foco único, decisões pendentes, entregas aceitas e exceções sem responsável.",
  "AGT-02": "Práticas realizadas, evidência de evolução e próximo exercício do fundador.",
  "AGT-03": "Hipóteses validadas, premissas em aberto e escolhas aguardando decisão.",
  "AGT-04": "Prazo, dependências, entregas com evidência e tempo de bloqueio.",
  "AGT-05": "Caixa conciliado, previsto × realizado, margem e dados financeiros faltantes.",
  "AGT-06": "Riscos abertos, controles comprovados e pareceres humanos necessários.",
  "AGT-07": "Responsabilidades sem dono, lacunas de capacidade e ações de desenvolvimento.",
  "AGT-08": "Indicadores com fonte e fórmula, atualização dos dados e lacunas de medição.",
  "AGT-09": "Execuções com identidade correta, falhas, disponibilidade, custo e critérios de aceite.",
  "AGT-10": "Hipóteses de produto, valor esperado, prioridade e entregas validadas.",
  "AGT-11": "Pesquisas concluídas, força da evidência e hipóteses ainda incertas.",
  "AGT-12": "Fluxos testados, problemas de usabilidade, acessibilidade e handoffs aceitos.",
  "AGT-13": "Cenários aprovados/reprovados, severidade dos defeitos e evidências de reteste.",
  "AGT-14": "Rotinas cumpridas, falhas recorrentes, tempo de ciclo e melhoria de processos.",
  "AGT-15": "Atividade comercial, avanço no funil, conversão e receita comprovada.",
  "AGT-16": "Experimentos por canal, aquisição, custo por resultado e próximo teste.",
  "AGT-17": "Conteúdos por etapa, revisões, aprovação editorial e resultado quando mensurável.",
  "AGT-18": "Parcerias por estágio, regras comerciais confirmadas e próxima negociação.",
  "AGT-19": "Ativação, valor alcançado, retenção e sinais de risco por cliente.",
  "AGT-20": "Tempo de resposta/resolução, solicitações abertas e recorrência de problemas.",
  "AGT-21": "Vencimentos, documentação completa, fornecedores e obrigações pendentes.",
};

export const planoEvolucao = [
  { fase: "01", titulo: "Confiar no que a página mostra", estado: "PARCIAL", dono: "Daniel · Theo · Bruno", existe: "Sala de comando local consulta tarefas, decisões, fila, eventos e checkpoint no Supabase, com paginação e falhas de leitura explícitas.", lacuna: "A publicação dessas mudanças e o comportamento de cada integração externa ainda precisam de homologação.", ajuste: "Publicar a versão revisada e comprovar atualização de cada fonte e isolamento por empresa; conservar a distinção entre ausência, erro e zero confirmado.", aceite: "Mudar um registro autorizado e verificar sua atualização na tela; simular falha de leitura sem gerar zeros ou dados fictícios." },
  { fase: "02", titulo: "Enxergar cada execução", estado: "PARCIAL", dono: "Theo · Marina · Clara", existe: "A sala já lê a fila, os eventos, as tentativas, o resultado e as evidências de cada job.", lacuna: "Os jobs atuais não têm task_id, portanto não há histórico de execução ligado diretamente às tarefas.", ajuste: "Exigir vínculo explícito nos novos jobs e reconciliar os antigos apenas com prova de origem; validar a identidade do executor.", aceite: "Uma execução de teste aparece do início ao fim, ligada à tarefa correta, e outro usuário não acessa empresas indevidas." },
  { fase: "03", titulo: "Helena no comando, fundador no controle", estado: "PARCIAL", dono: "Helena · Marina · Theo", existe: "Foco executivo, decisões, memória, handoffs e regras de autoridade já existem. A conversa local classifica pedidos por regras.", lacuna: "O fluxo local de conversa não comprova orquestração completa dos especialistas. Aprovação, despacho e aceite não formam ainda uma trilha única na página.", ajuste: "Manter Helena no ChatGPT oficial e os especialistas no Grok, conforme decisões vigentes. Inbox persistente com pedido, contexto, recomendação, impacto e decisão. Permitir aprovar, devolver ou pausar apenas via ações autorizadas e auditadas.", aceite: "Aprovação sobrevive ao recarregamento, não executa duas vezes e gera retorno à Helena. WIP executivo = 1 permanece respeitado." },
  { fase: "04", titulo: "Acompanhar resultado, não só atividade", estado: "PARCIAL", dono: "Daniel · Caio · donos de cada área", existe: "Dados de tarefas, negócios e indicadores podem ser reaproveitados; os agentes têm entregas obrigatórias definidas.", lacuna: "Contar tarefas não mede produtividade nem qualidade. Faltam cobertura comprovada e séries históricas para duração, custo e resultado.", ajuste: "Adicionar metas, tendência, tempo de ciclo, bloqueios, custo por execução e impacto no negócio, sempre com fórmula e origem.", aceite: "Cada gráfico permite chegar aos registros que o compõem; sem dados históricos, mostrar lacuna em vez de uma curva inventada." },
  { fase: "05", titulo: "Evoluir a experiência sem perder funções", estado: "PARCIAL", dono: "Maya · Nina · Bruno", existe: "Autenticação, navegação por empresa, módulos e avatares foram preservados nesta proposta local.", lacuna: "A navegação atual é extensa, mistura gestão com detalhes técnicos e exige percorrer páginas longas para entender uma entrega.", ajuste: "Organizar a experiência em Visão geral, Agentes, Processos e Decisões. Detalhes abrem ao lado; manter os módulos atuais acessíveis durante a evolução.", aceite: "Fundador identifica prioridade, dono, bloqueio e próxima entrega em poucos passos, no computador e no celular, inclusive usando teclado." },
];

export function planoDoCheckpoint(snapshot: unknown): typeof planoEvolucao | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const planejamento = (snapshot as Record<string, unknown>).planejamento;
  if (!planejamento || typeof planejamento !== 'object') return null;
  const plano = (planejamento as Record<string, unknown>).plano_evolucao;
  const campos = ['fase', 'titulo', 'estado', 'dono', 'existe', 'lacuna', 'ajuste', 'aceite'];
  if (!Array.isArray(plano) || !plano.length || !plano.every(item =>
    item && typeof item === 'object' && campos.every(campo => typeof item[campo] === 'string')
  )) return null;
  return plano as typeof planoEvolucao;
}
