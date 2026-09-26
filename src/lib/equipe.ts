import {
  AREA_VISUALS,
  getAreaVisual,
  statusVisualFromDb,
  type AgentStatusVisual,
} from "@/lib/agentVisuals";

export type ProviderAgente = "CHATGPT" | "GROK" | "HUMAN" | "OTHER";
export type ConnectionStatus = "CONNECTED" | "PLANNED" | "NOT_CONNECTED" | "ERROR";

export type AgenteCompleto = {
  agent_id: string;
  agente: string;
  cargo_funcao: string;
  quando_ativar?: string | null;
  missao?: string | null;
  status: string | null;
  area: string;
  provider: ProviderAgente | null;
  external_agent_id?: string | null;
  connection_status: ConnectionStatus | null;
  last_seen_at?: string | null;
  last_tested_at?: string | null;
  approval_policy?: string | null;
  escala_para?: string;
  pode_atualizar?: string;
};

export type AgenteRow = {
  agent_id: string;
  agente: string;
  cargo_funcao: string;
  quando_ativar?: string | null;
  missao?: string | null;
  status?: string | null;
};

export type ConexaoRow = {
  agent_id: string;
  provider?: string | null;
  external_agent_id?: string | null;
  connection_status?: string | null;
  last_seen_at?: string | null;
  last_tested_at?: string | null;
  approval_policy?: string | null;
};

export const AREAS_OFICIAIS = Object.values(AREA_VISUALS);
export const FILTROS_AREAS = ["Todos", ...AREAS_OFICIAIS.map((a) => a.nome)];

const PROVIDERS: ReadonlySet<string> = new Set(["CHATGPT", "GROK", "HUMAN", "OTHER"]);
const CONNECTION_STATUSES: ReadonlySet<string> = new Set([
  "CONNECTED",
  "PLANNED",
  "NOT_CONNECTED",
  "ERROR",
]);

function asProvider(value?: string | null): ProviderAgente | null {
  const v = (value ?? "").trim().toUpperCase();
  return PROVIDERS.has(v) ? (v as ProviderAgente) : null;
}

function asConnectionStatus(value?: string | null): ConnectionStatus | null {
  const v = (value ?? "").trim().toUpperCase();
  return CONNECTION_STATUSES.has(v) ? (v as ConnectionStatus) : null;
}

export function areaDoAgente(agentId: string): string {
  return getAreaVisual(agentId)?.nome ?? "Área não mapeada";
}

export function mesclarAgenteComConexao(
  ag: AgenteRow,
  conexao?: ConexaoRow | null,
): AgenteCompleto {
  const isHelena = ag.agent_id === "AGT-01";
  return {
    agent_id: ag.agent_id,
    agente: ag.agente,
    cargo_funcao: ag.cargo_funcao,
    quando_ativar: ag.quando_ativar ?? null,
    missao: ag.missao ?? null,
    status: ag.status ?? null,
    area: areaDoAgente(ag.agent_id),
    provider: asProvider(conexao?.provider),
    external_agent_id: conexao?.external_agent_id ?? null,
    connection_status: asConnectionStatus(conexao?.connection_status),
    last_seen_at: conexao?.last_seen_at ?? null,
    last_tested_at: conexao?.last_tested_at ?? null,
    approval_policy: conexao?.approval_policy ?? null,
    escala_para: isHelena ? "Fundador" : "Helena",
    pode_atualizar: isHelena
      ? "Diretivas corporativas, foco e governança"
      : "Propostas, análises e relatórios do setor",
  };
}

export function statusVisualDoAgente(
  membro: AgenteCompleto,
  conexoesIndisponiveis = false,
): AgentStatusVisual {
  return statusVisualFromDb(membro.status, membro.connection_status, conexoesIndisponiveis);
}

export function contarAgentesConectados(
  agentes: readonly AgenteCompleto[],
  conexoesIndisponiveis = false,
): number {
  if (conexoesIndisponiveis) return 0;
  return agentes.filter((m) => statusVisualDoAgente(m) === "conectado").length;
}

export function descricaoCabecalhoEquipe(opts: {
  carregando?: boolean;
  erroAgentes?: boolean;
  erroConexoes?: boolean;
  total: number;
  conectados: number;
}): string {
  if (opts.carregando || opts.erroAgentes) {
    return "Helena e os especialistas do Sistema Helena";
  }
  if (opts.erroConexoes) {
    return `${opts.total} agentes · status de conexão indisponível`;
  }
  return `${opts.total} agentes · ${opts.conectados} conectados · status real da conexão`;
}
