import { render, screen, within } from '@testing-library/react';
import { beforeAll, expect, it, vi } from 'vitest';
import ConsumoAba from './ConsumoAba';
import { dadosDeTeste } from '@/integrations/comando-v2/dados-de-teste-execucao';
import type { DadosComando } from '@/integrations/comando-v2/tipos';

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

const montar = (dados: DadosComando, empresa = 'GRUPO') => render(<ConsumoAba dados={dados} empresa={empresa} abrirCard={vi.fn()} />);
const painel = (nome: string) => within(screen.getByRole('region', { name: nome }));
const metrica = (rotulo: string) => resumo().getByText(rotulo).closest('div.he-metric')?.textContent ?? '';
const resumo = () => within(screen.getByLabelText('Resumo do volume'));

it('mostra volume medido: entregas por semana, execuções por etapa e etapas abertas', () => {
  montar(dadosDeTeste());
  expect(metrica('Entregas aprovadas')).toContain('4');
  expect(metrica('Etapas abertas')).toContain('4');
  expect(metrica('Execuções somadas')).toContain('6');
  const semanal = screen.getByRole('img', { name: /Entregas aprovadas por semana\. 24\/08: 1; .*05\/10: 1; 12\/10: 2\./ });
  expect(semanal).toBeTruthy();
  const tabela = painel('Entregas aprovadas por semana').getByRole('table', { name: 'Entregas aprovadas por semana' });
  expect(within(tabela).getByRole('row', { name: /12\/10/ }).textContent).toContain('2');
  expect(screen.getByRole('img', { name: /Execuções por etapa\. Redigir: 5; Revisar: 1\./ })).toBeTruthy();
  expect(painel('Execuções por etapa').getByText(/6 etapas estão sem número de execuções/)).toBeTruthy();
});

it('diz com todas as letras que tokens e custo não são medidos, sem inventar número', () => {
  montar(dadosDeTeste());
  const aviso = within(screen.getByRole('region', { name: 'Consumo de tokens e custo' }));
  expect(aviso.getByText(/ainda não medido nesta tela/)).toBeTruthy();
  expect(aviso.getByText(/função nova no banco que só o fundador pode autorizar/)).toBeTruthy();
  expect(aviso.queryByText(/R\$|\$|tokens:\s*\d/)).toBeNull();
});

it('não mostra zero quando o banco não informou execuções por etapa', () => {
  const dados = dadosDeTeste();
  dados.etapas = dados.etapas.map(e => ({ ...e, execucoes: null }));
  montar(dados);
  expect(resumo().getByText('O banco ainda não informou este número')).toBeTruthy();
  expect(screen.getByText('Sem número de execuções para mostrar')).toBeTruthy();
  expect(screen.queryByRole('img', { name: /Execuções por etapa/ })).toBeNull();
});

it('respeita o filtro de empresa', () => {
  montar(dadosDeTeste(), 'BIZ-001');
  expect(metrica('Etapas abertas')).toContain('1');
  expect(metrica('Execuções somadas')).toContain('3');
  expect(screen.getByRole('img', { name: /Execuções por etapa\. Redigir: 3\./ })).toBeTruthy();
  expect(screen.getByText(/para Max Nutrition/)).toBeTruthy();
});

it('erro nunca vira zero e carregando não mostra gráfico', () => {
  const dados = dadosDeTeste();
  dados.estado = { ...dados.estado, entregas: 'erro', etapas: 'carregando' };
  montar(dados);
  expect(screen.getByText('Não foi possível ler: Entregas aprovadas por semana')).toBeTruthy();
  expect(screen.queryByRole('img', { name: /Entregas aprovadas por semana/ })).toBeNull();
  expect(painel('Execuções por etapa').getByRole('status', { name: /Carregando execuções por etapa/ })).toBeTruthy();
  expect(within(screen.getByLabelText('Resumo do volume')).getAllByText('—')).toHaveLength(3);
});

it('diz a verdade quando a leitura funcionou e não há entregas nas 8 semanas', () => {
  const dados = dadosDeTeste();
  dados.entregas = [];
  dados.amostra = true;
  montar(dados);
  expect(screen.getByText('Nenhuma entrega aprovada nas últimas 8 semanas')).toBeTruthy();
  expect(screen.getByText(/Amostra: a leitura foi cortada por limite/)).toBeTruthy();
});

it('esconde a tabela de leitores de tela num div sr-only, para ela não alargar a página no celular', () => {
  montar(dadosDeTeste());
  const tabelas = screen.getAllByRole('table');
  expect(tabelas.length).toBeGreaterThan(0);
  for (const t of tabelas) {
    expect(t.classList.contains('sr-only')).toBe(false); // numa <table> o sr-only não limita a largura
    expect(t.parentElement?.classList.contains('sr-only')).toBe(true);
  }
});
