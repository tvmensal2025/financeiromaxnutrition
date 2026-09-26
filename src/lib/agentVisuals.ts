/**
 * Identidade visual dos agentes (front-end).
 *
 * Regras:
 *  - Fonte de dados dos cards: public.agentes — agent_id, agente (nome), cargo_funcao (cargo).
 *    Lidos pelo agent_id, sem coluna nova e sem alterar a tabela.
 *  - Este arquivo guarda só o visual, chaveado somente por agent_id (AGT-NN) já existente em public.agentes.
 *  - Nome e cargo não ficam aqui: vêm de public.agentes.agente / cargo_funcao em runtime.
 *  - Áreas = lista oficial "Área" de public.listas_dominio. A atribuição agente→área é proposta de design
 *    (não existe coluna de área em public.agentes).
 *  - Status: valores reais do banco -> estado visual via statusVisualFromDb().
 */

export type AreaId = "direcao" | "produto" | "crescimento" | "operacoes" | "cliente" | "pessoas" | "governanca";

export interface AreaVisual {
  id: AreaId;
  /** Nome exato da lista "Área" em public.listas_dominio */
  nome: string;
  accent: { light: string; dark: string };
  tone: { light: string; dark: string };
  className: { text: string; bgTone: string; fillTone: string; swatch: string };
}

export const AREA_VISUALS: Record<AreaId, AreaVisual> = {
  direcao: {
    id: "direcao",
    nome: "Direção e Portfólio",
    accent: { light: "#007A3D", dark: "#4FD08A" },
    tone: { light: "#E3F1E9", dark: "#14301F" },
    className: {
      text: "text-[#007A3D] dark:text-[#4FD08A]",
      bgTone: "bg-[#E3F1E9] dark:bg-[#14301F]",
      fillTone: "fill-[#E3F1E9] dark:fill-[#14301F]",
      swatch: "bg-[#007A3D] dark:bg-[#4FD08A]",
    },
  },
  produto: {
    id: "produto",
    nome: "Produto e Tecnologia",
    accent: { light: "#6D28D9", dark: "#B79CFB" },
    tone: { light: "#EFE9FC", dark: "#261D3F" },
    className: {
      text: "text-[#6D28D9] dark:text-[#B79CFB]",
      bgTone: "bg-[#EFE9FC] dark:bg-[#261D3F]",
      fillTone: "fill-[#EFE9FC] dark:fill-[#261D3F]",
      swatch: "bg-[#6D28D9] dark:bg-[#B79CFB]",
    },
  },
  crescimento: {
    id: "crescimento",
    nome: "Crescimento e Receita",
    accent: { light: "#C2410C", dark: "#FB9A62" },
    tone: { light: "#FCEDE4", dark: "#3A2115" },
    className: {
      text: "text-[#C2410C] dark:text-[#FB9A62]",
      bgTone: "bg-[#FCEDE4] dark:bg-[#3A2115]",
      fillTone: "fill-[#FCEDE4] dark:fill-[#3A2115]",
      swatch: "bg-[#C2410C] dark:bg-[#FB9A62]",
    },
  },
  operacoes: {
    id: "operacoes",
    nome: "Operações e Finanças",
    accent: { light: "#1D4ED8", dark: "#8AB0FF" },
    tone: { light: "#E7EEFD", dark: "#172542" },
    className: {
      text: "text-[#1D4ED8] dark:text-[#8AB0FF]",
      bgTone: "bg-[#E7EEFD] dark:bg-[#172542]",
      fillTone: "fill-[#E7EEFD] dark:fill-[#172542]",
      swatch: "bg-[#1D4ED8] dark:bg-[#8AB0FF]",
    },
  },
  cliente: {
    id: "cliente",
    nome: "Cliente e Qualidade",
    accent: { light: "#0E7490", dark: "#5CCFE6" },
    tone: { light: "#E1F3F7", dark: "#10303A" },
    className: {
      text: "text-[#0E7490] dark:text-[#5CCFE6]",
      bgTone: "bg-[#E1F3F7] dark:bg-[#10303A]",
      fillTone: "fill-[#E1F3F7] dark:fill-[#10303A]",
      swatch: "bg-[#0E7490] dark:bg-[#5CCFE6]",
    },
  },
  pessoas: {
    id: "pessoas",
    nome: "Pessoas e Parceiros",
    accent: { light: "#BE185D", dark: "#F58DBA" },
    tone: { light: "#FCE8F1", dark: "#3A1829" },
    className: {
      text: "text-[#BE185D] dark:text-[#F58DBA]",
      bgTone: "bg-[#FCE8F1] dark:bg-[#3A1829]",
      fillTone: "fill-[#FCE8F1] dark:fill-[#3A1829]",
      swatch: "bg-[#BE185D] dark:bg-[#F58DBA]",
    },
  },
  governanca: {
    id: "governanca",
    nome: "Governança e Risco",
    accent: { light: "#475569", dark: "#B4C0D0" },
    tone: { light: "#ECEFF3", dark: "#232A34" },
    className: {
      text: "text-[#475569] dark:text-[#B4C0D0]",
      bgTone: "bg-[#ECEFF3] dark:bg-[#232A34]",
      fillTone: "fill-[#ECEFF3] dark:fill-[#232A34]",
      swatch: "bg-[#475569] dark:bg-[#B4C0D0]",
    },
  },
};

/** Elementos de glifo no grid 64×64 (traço 2.5, pontas arredondadas). f = preenchido com a cor de acento. */
export type GlyphEl =
  | { t: "path"; d: string; f?: boolean }
  | { t: "circle"; cx: number; cy: number; r: number; f?: boolean }
  | { t: "rect"; x: number; y: number; w: number; h: number; rx?: number; f?: boolean; rot?: [number, number, number] };

export interface AgentVisual {
  agentId: string;
  area: AreaId;
  glyphName: string;
  /** Caminho sugerido do SVG estático (copiar avatars/ para public/agentes/avatars/) */
  avatarSrc: string;
  glyph: GlyphEl[];
}

export const AVATAR_BASE = "/agentes/avatars";

const G: Record<string, GlyphEl[]> = {
  hub: [{t: "circle",cx: 32,cy: 32,r: 6}, {t: "circle",cx: 32,cy: 32,r: 2,f: true}, {t: "path",d: "M27.8 27.8l-5-5M36.2 27.8l5-5M27.8 36.2l-5 5M36.2 36.2l5 5"}, {t: "circle",cx: 20.5,cy: 20.5,r: 3,f: true}, {t: "circle",cx: 43.5,cy: 20.5,r: 3,f: true}, {t: "circle",cx: 20.5,cy: 43.5,r: 3,f: true}, {t: "circle",cx: 43.5,cy: 43.5,r: 3,f: true}],
  voz: [{t: "path",d: "M19 29v6M25.5 24v16M32 18v28M38.5 25v14M45 29.5v5"}],
  bifurcacao: [{t: "path",d: "M32 47V35L22 25M32 35l10-10M22 31v-7h7M42 31v-7h-7"}, {t: "circle",cx: 32,cy: 35,r: 2.5,f: true}],
  gantt: [{t: "rect",x: 17,y: 18,w: 17,h: 7,rx: 3.5,f: true}, {t: "rect",x: 23,y: 28.5,w: 21,h: 7,rx: 3.5}, {t: "rect",x: 31,y: 39,w: 15,h: 7,rx: 3.5}],
  moeda: [{t: "circle",cx: 32,cy: 32,r: 14.5}, {t: "path",d: "M32 22v20M37 26.8c-.9-1.5-2.7-2.3-5-2.3-3 0-5 1.5-5 3.6 0 2.2 2 3.2 5 3.7 3 .5 5 1.6 5 3.9 0 2.1-2 3.8-5 3.8-2.4 0-4.3-.9-5.2-2.5"}],
  escudo: [{t: "path",d: "M32 17l13 5v9c0 8.5-5.5 13.8-13 16-7.5-2.2-13-7.5-13-16v-9z"}, {t: "path",d: "M26.5 32l4 4 7.5-7.5"}],
  circulos: [{t: "circle",cx: 32,cy: 25,r: 8}, {t: "circle",cx: 25,cy: 37.5,r: 8}, {t: "circle",cx: 39,cy: 37.5,r: 8}],
  barras: [{t: "path",d: "M17 46h30"}, {t: "rect",x: 20,y: 33,w: 6,h: 9,rx: 2}, {t: "rect",x: 29,y: 26,w: 6,h: 16,rx: 2}, {t: "rect",x: 38,y: 18,w: 6,h: 24,rx: 2,f: true}],
  chip: [{t: "rect",x: 22,y: 22,w: 20,h: 20,rx: 4}, {t: "rect",x: 28,y: 28,w: 8,h: 8,rx: 1.5,f: true}, {t: "path",d: "M27 17v5M37 17v5M27 42v5M37 42v5M17 27h5M17 37h5M42 27h5M42 37h5"}],
  cubo: [{t: "path",d: "M32 17l13 7.5v15L32 47l-13-7.5v-15z"}, {t: "path",d: "M19 24.5L32 32l13-7.5M32 32v15"}],
  lupa: [{t: "circle",cx: 29,cy: 29,r: 11}, {t: "path",d: "M37 37l9 9"}, {t: "path",d: "M29 23.5q.8 4.7 5.5 5.5-4.7.8-5.5 5.5-.8-4.7-5.5-5.5 4.7-.8 5.5-5.5z",f: true}],
  pena: [{t: "path",d: "M32 46l-9.5-14.5L27 22h10l4.5 9.5z"}, {t: "path",d: "M32 46V36.5M26 17h12"}, {t: "circle",cx: 32,cy: 33,r: 2.6,f: true}],
  checklist: [{t: "rect",x: 17,y: 18,w: 11,h: 11,rx: 3}, {t: "path",d: "M20 23.5l2.2 2.2 3.5-3.7M33 23.5h14"}, {t: "rect",x: 17,y: 35,w: 11,h: 11,rx: 3}, {t: "path",d: "M20 40.5l2.2 2.2 3.5-3.7M33 40.5h14"}],
  ciclo: [{t: "path",d: "M19.4 28.6A13 13 0 0 1 43.8 26.5M39.3 24.2L43.8 26.5L44.9 21.6"}, {t: "path",d: "M44.6 35.4A13 13 0 0 1 20.2 37.5M24.7 39.8L20.2 37.5L19.1 42.4"}],
  alvo: [{t: "circle",cx: 30,cy: 34,r: 13}, {t: "circle",cx: 30,cy: 34,r: 7}, {t: "circle",cx: 30,cy: 34,r: 2.5,f: true}, {t: "path",d: "M30 34L46 18M40 18h6v6"}],
  megafone: [{t: "path",d: "M20 27h5l13-8v26l-13-8h-5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z"}, {t: "path",d: "M23 37l2 8h4l-2-8M43 32h4M42.5 25l3-2.5M42.5 39l3 2.5"}],
  aspas: [{t: "circle",cx: 24,cy: 28,r: 5,f: true}, {t: "path",d: "M29 28c0 7-3.5 11-9 13"}, {t: "circle",cx: 40,cy: 28,r: 5,f: true}, {t: "path",d: "M45 28c0 7-3.5 11-9 13"}],
  elos: [{t: "rect",x: 16,y: 32,w: 22,h: 11,rx: 5.5,rot: [-45,27,37.5]}, {t: "rect",x: 26,y: 21,w: 22,h: 11,rx: 5.5,rot: [-45,37,26.5]}],
  coracao: [{t: "path",d: "M32 46C21 39 17 33 17 27.5 17 23 20.5 19.5 24.8 19.5c3 0 5.6 1.6 7.2 4.3 1.6-2.7 4.2-4.3 7.2-4.3 4.3 0 7.8 3.5 7.8 8 0 5.5-4 11.5-15 18.5z"}, {t: "path",d: "M22.5 31h5l2-3.5 3.5 7 2-3.5h6.5"}],
  balao: [{t: "path",d: "M21 19h22a4 4 0 0 1 4 4v13a4 4 0 0 1-4 4H31l-7 6v-6h-3a4 4 0 0 1-4-4V23a4 4 0 0 1 4-4z"}, {t: "circle",cx: 25,cy: 29.5,r: 2,f: true}, {t: "circle",cx: 32,cy: 29.5,r: 2,f: true}, {t: "circle",cx: 39,cy: 29.5,r: 2,f: true}],
  pasta: [{t: "path",d: "M17 23a3 3 0 0 1 3-3h7.5l3.5 4h13a3 3 0 0 1 3 3v15a3 3 0 0 1-3 3H20a3 3 0 0 1-3-3z"}, {t: "path",d: "M17 30h30"}],
};

export const AGENT_VISUALS: Record<string, AgentVisual> = {
  "AGT-01": { agentId: "AGT-01", area: "direcao", glyphName: "hub", avatarSrc: `${AVATAR_BASE}/AGT-01.svg`, glyph: G.hub },
  "AGT-02": { agentId: "AGT-02", area: "direcao", glyphName: "voz", avatarSrc: `${AVATAR_BASE}/AGT-02.svg`, glyph: G.voz },
  "AGT-03": { agentId: "AGT-03", area: "direcao", glyphName: "bifurcacao", avatarSrc: `${AVATAR_BASE}/AGT-03.svg`, glyph: G.bifurcacao },
  "AGT-04": { agentId: "AGT-04", area: "operacoes", glyphName: "gantt", avatarSrc: `${AVATAR_BASE}/AGT-04.svg`, glyph: G.gantt },
  "AGT-05": { agentId: "AGT-05", area: "operacoes", glyphName: "moeda", avatarSrc: `${AVATAR_BASE}/AGT-05.svg`, glyph: G.moeda },
  "AGT-06": { agentId: "AGT-06", area: "governanca", glyphName: "escudo", avatarSrc: `${AVATAR_BASE}/AGT-06.svg`, glyph: G.escudo },
  "AGT-07": { agentId: "AGT-07", area: "pessoas", glyphName: "circulos", avatarSrc: `${AVATAR_BASE}/AGT-07.svg`, glyph: G.circulos },
  "AGT-08": { agentId: "AGT-08", area: "produto", glyphName: "barras", avatarSrc: `${AVATAR_BASE}/AGT-08.svg`, glyph: G.barras },
  "AGT-09": { agentId: "AGT-09", area: "produto", glyphName: "chip", avatarSrc: `${AVATAR_BASE}/AGT-09.svg`, glyph: G.chip },
  "AGT-10": { agentId: "AGT-10", area: "produto", glyphName: "cubo", avatarSrc: `${AVATAR_BASE}/AGT-10.svg`, glyph: G.cubo },
  "AGT-11": { agentId: "AGT-11", area: "produto", glyphName: "lupa", avatarSrc: `${AVATAR_BASE}/AGT-11.svg`, glyph: G.lupa },
  "AGT-12": { agentId: "AGT-12", area: "produto", glyphName: "pena", avatarSrc: `${AVATAR_BASE}/AGT-12.svg`, glyph: G.pena },
  "AGT-13": { agentId: "AGT-13", area: "cliente", glyphName: "checklist", avatarSrc: `${AVATAR_BASE}/AGT-13.svg`, glyph: G.checklist },
  "AGT-14": { agentId: "AGT-14", area: "operacoes", glyphName: "ciclo", avatarSrc: `${AVATAR_BASE}/AGT-14.svg`, glyph: G.ciclo },
  "AGT-15": { agentId: "AGT-15", area: "crescimento", glyphName: "alvo", avatarSrc: `${AVATAR_BASE}/AGT-15.svg`, glyph: G.alvo },
  "AGT-16": { agentId: "AGT-16", area: "crescimento", glyphName: "megafone", avatarSrc: `${AVATAR_BASE}/AGT-16.svg`, glyph: G.megafone },
  "AGT-17": { agentId: "AGT-17", area: "crescimento", glyphName: "aspas", avatarSrc: `${AVATAR_BASE}/AGT-17.svg`, glyph: G.aspas },
  "AGT-18": { agentId: "AGT-18", area: "pessoas", glyphName: "elos", avatarSrc: `${AVATAR_BASE}/AGT-18.svg`, glyph: G.elos },
  "AGT-19": { agentId: "AGT-19", area: "cliente", glyphName: "coracao", avatarSrc: `${AVATAR_BASE}/AGT-19.svg`, glyph: G.coracao },
  "AGT-20": { agentId: "AGT-20", area: "cliente", glyphName: "balao", avatarSrc: `${AVATAR_BASE}/AGT-20.svg`, glyph: G.balao },
  "AGT-21": { agentId: "AGT-21", area: "operacoes", glyphName: "pasta", avatarSrc: `${AVATAR_BASE}/AGT-21.svg`, glyph: G.pasta },
};

export function getAgentVisual(agentId: string | null | undefined): AgentVisual | undefined {
  if (!agentId) return undefined;
  return AGENT_VISUALS[agentId.trim().toUpperCase()];
}

export function getAreaVisual(agentId: string | null | undefined): AreaVisual | undefined {
  const v = getAgentVisual(agentId);
  return v ? AREA_VISUALS[v.area] : undefined;
}

/* ------------------------------------------------------------------ status */

/**
 * Estados visuais. Derivados de campos REAIS do banco:
 *  - public.agentes.status            (lista "Status Agente": ATIVO | PAUSADO | DESATIVADO)
 *  - public.agent_connections.connection_status (CHECK: CONNECTED | PLANNED | NOT_CONNECTED | ERROR)
 * "desconhecido" (rótulo "Sem registro") = sem linha em agent_connections — não assumir CONNECTED.
 * "indisponivel" (rótulo "Status indisponível") = a consulta de agent_connections falhou.
 */
export type AgentStatusVisual =
  | "conectado"
  | "planejado"
  | "nao_conectado"
  | "erro"
  | "pausado"
  | "desativado"
  | "desconhecido"
  | "indisponivel";

export const STATUS_VISUALS: Record<AgentStatusVisual, { label: string; className: string }> = {
  conectado:     { label: "Conectado",          className: "text-[#006B35] bg-[#007A3D]/10 border-[#007A3D]/25 dark:text-[#4ADE80] dark:bg-[#4ADE80]/10 dark:border-[#4ADE80]/25" },
  planejado:     { label: "Planejado",          className: "text-[#1E40AF] bg-[#1D4ED8]/10 border-[#1D4ED8]/25 dark:text-[#93B4FF] dark:bg-[#93B4FF]/10 dark:border-[#93B4FF]/25" },
  nao_conectado: { label: "Não conectado",      className: "text-[#4B524F] bg-[#5E6662]/10 border-[#5E6662]/25 dark:text-[#B4BDB8] dark:bg-[#B4BDB8]/10 dark:border-[#B4BDB8]/25" },
  erro:          { label: "Erro de conexão",    className: "text-[#B91C1C] bg-[#B91C1C]/10 border-[#B91C1C]/25 dark:text-[#F87171] dark:bg-[#F87171]/10 dark:border-[#F87171]/25" },
  pausado:       { label: "Pausado",            className: "text-[#92400E] bg-[#B45309]/10 border-[#B45309]/25 dark:text-[#FBBF24] dark:bg-[#FBBF24]/10 dark:border-[#FBBF24]/25" },
  desativado:    { label: "Desativado",         className: "text-[#4B524F] bg-[#5E6662]/10 border-[#5E6662]/25 dark:text-[#B4BDB8] dark:bg-[#B4BDB8]/10 dark:border-[#B4BDB8]/25" },
  desconhecido:  { label: "Sem registro",       className: "text-[#4B524F] bg-transparent border-dashed border-[#5E6662]/40 dark:text-[#B4BDB8] dark:border-[#B4BDB8]/40" },
  indisponivel:  { label: "Status indisponível", className: "text-[#4B524F] bg-[#5E6662]/10 border-[#5E6662]/25 dark:text-[#B4BDB8] dark:bg-[#B4BDB8]/10 dark:border-[#B4BDB8]/25" },
};

/**
 * Precedência (proposta de design): status do agente (DESATIVADO/PAUSADO) vence o da conexão.
 * conexoesIndisponiveis = a consulta agent_connections falhou (não confundir com ausência de linha).
 */
export function statusVisualFromDb(
  agentStatus?: string | null,
  connectionStatus?: string | null,
  conexoesIndisponiveis = false,
): AgentStatusVisual {
  const a = (agentStatus ?? "").trim().toUpperCase();
  if (a === "DESATIVADO") return "desativado";
  if (a === "PAUSADO") return "pausado";
  if (conexoesIndisponiveis) return "indisponivel";
  switch ((connectionStatus ?? "").trim().toUpperCase()) {
    case "CONNECTED": return "conectado";
    case "PLANNED": return "planejado";
    case "NOT_CONNECTED": return "nao_conectado";
    case "ERROR": return "erro";
    default: return "desconhecido";
  }
}
