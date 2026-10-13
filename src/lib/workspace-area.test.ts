import { expect, it } from 'vitest';
import { areaDoCaminho } from './workspace-area';

it.each([
  ['/', 'comando'],
  ['/modulo/foco_executivo', 'comando'],
  ['/financeiro', 'negocios'],
  ['/modulo/financeiro', 'negocios'],
  ['/modulo/contas_financeiras', 'negocios'],
  ['/modulo/marketing', 'negocios'],
  ['/entregas', 'operacao'],
  ['/modulo/tarefas', 'operacao'],
  ['/modulo/fornecedores', 'operacao'],
  ['/equipe', 'inteligencia'],
  ['/modulo/memoria_mestre', 'inteligencia'],
  ['/modulo/agentes', 'inteligencia'],
  ['/modulo/dicionario_dados', 'inteligencia'],
  ['/configuracoes-v2', 'governanca'],
  ['/modulo/decisoes', 'governanca'],
  ['/modulo/auditoria', 'governanca'],
  ['/modulo/documentos', 'registros'],
  ['/modulo/area_futura', 'registros'],
] as const)('atribui %s à área %s', (rota, area) => {
  expect(areaDoCaminho(rota)).toBe(area);
});
