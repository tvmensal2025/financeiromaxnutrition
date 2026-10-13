import { MODULOS } from './modulos';

export type WorkspaceArea = 'comando' | 'negocios' | 'operacao' | 'inteligencia' | 'governanca' | 'registros';

const AREA_DOS_GRUPOS: Record<string, WorkspaceArea> = {
  Comando: 'comando', Receita: 'negocios', 'Execução': 'operacao', 'Finanças': 'negocios',
  'Operação': 'operacao', 'Risco & Governança': 'governanca', Equipe: 'inteligencia',
  Sistema: 'governanca', 'Referência': 'inteligencia',
};

const EXCECOES: Record<string, WorkspaceArea> = {
  estado_mestre: 'inteligencia', decisoes: 'governanca',
  documentos: 'registros', ativos: 'registros',
};

const AREA_DOS_MODULOS = new Map(MODULOS.map(modulo => [
  modulo.tabela,
  EXCECOES[modulo.tabela] ?? AREA_DOS_GRUPOS[modulo.grupo] ?? 'registros',
]));

export function areaDoCaminho(pathname: string): WorkspaceArea {
  if (pathname.startsWith('/modulo/')) return AREA_DOS_MODULOS.get(pathname.slice('/modulo/'.length)) ?? 'registros';
  if (['/financeiro', '/crm', '/indicadores', '/portfolio', '/empresas', '/identidade'].includes(pathname)) return 'negocios';
  if (['/execucao', '/entregas', '/cards-v2', '/calendario', '/consumo'].includes(pathname)) return 'operacao';
  if (['/equipe', '/conversa'].includes(pathname)) return 'inteligencia';
  if (['/sistema', '/integracoes', '/configuracoes-v2', '/supervisao'].includes(pathname)) return 'governanca';
  return 'comando';
}
