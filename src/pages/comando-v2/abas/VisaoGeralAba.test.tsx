import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import VisaoGeralAba from './VisaoGeralAba';
import { dadosVazios, type DadosComando } from '@/integrations/comando-v2/tipos';
import { AGORA, card, cardsBase, dadosCheios } from '@/integrations/comando-v2/visao-geral.fixtures';

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
const auth = vi.hoisted(() => ({ user: { email: 'arthur@exemplo.com', user_metadata: { full_name: 'Arthur Costa' } } as unknown }));
vi.mock('@/auth', () => ({ useAuth: () => ({ user: auth.user }) }));
beforeEach(() => { auth.user = { email: 'arthur@exemplo.com', user_metadata: { full_name: 'Arthur Costa' } }; });

function montar(dados: DadosComando, empresa = 'GRUPO', abrirCard = vi.fn()) {
  render(<MemoryRouter><VisaoGeralAba dados={dados} empresa={empresa} abrirCard={abrirCard} /></MemoryRouter>);
  return abrirCard;
}
const valorDoKpi = (rotulo: string) => {
  const caixa = within(screen.getByTestId('kpis-comando')).getByText(rotulo).closest('.he-metric') as HTMLElement;
  return within(caixa).getByText(/^\d+$/).textContent;
};
const grafico = (parte: string) => screen.getByRole('img', { name: new RegExp(parte) }).getAttribute('aria-label') ?? '';

it('com dados: saudação, frase, 4 números, prioridades, processo, gráficos e entregas por empresa', () => {
  const abrir = montar(dadosCheios());
  expect(screen.getByRole('heading', { name: 'Boa tarde, Arthur.' })).toBeTruthy();
  expect(screen.getByText('2 cards esperam você e 1 está atrasado.')).toBeTruthy();
  expect(['Cards abertos', 'Esperando você', 'Atrasados', 'Prontos em 7 dias'].map(valorDoKpi)).toEqual(['5', '2', '1', '1']);

  const lista = within(screen.getByRole('list', { name: 'Cards que pedem atenção' }));
  expect(lista.getAllByRole('listitem').map(li => within(li).getByRole('button').getAttribute('aria-label'))).toEqual([
    'Abrir card Escolher a campanha', 'Abrir card Confirmar o pedido novo', 'Abrir card Montar o site', 'Abrir card Plano quebrado',
  ]);
  expect(lista.getByText(/A Helena não conseguiu ler o pedido/)).toBeTruthy();
  expect(lista.getByText(/Parado há 3 dias/)).toBeTruthy();
  expect(lista.getAllByText('Humano Digital').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Abrir card Montar o site' }));
  expect(abrir).toHaveBeenCalledWith('c3');
  expect(screen.getByRole('link', { name: 'Ver todos os cards' }).getAttribute('href')).toBe('/comando?aba=cards');

  const processo = screen.getByRole('link', { name: /^Aguardando você: 1 card\./ });
  expect(processo.getAttribute('href')).toBe('/comando?aba=cards');
  expect(screen.getByRole('link', { name: /^Preparação: 2 cards/ })).toBeTruthy();
  expect(screen.getByRole('link', { name: /Abrir o Financeiro/ }).getAttribute('href')).toBe('/financeiro');

  expect(grafico('Cards por estado')).toMatch(/Em andamento 2.*Pronto 2.*Total 8/);
  expect(grafico('Cards por empresa')).toMatch(/Max Nutrition, 2 outros abertos, 0 esperando você, 2 prontos/);
  expect(grafico('Etapas abertas por agente')).toBe('Etapas abertas por agente: Maya 2; Fulano externo 1; Helena 1.');
  expect(grafico('Últimos 14 dias')).toMatch(/Cards criados somam 8; Pedidos recebidos somam 3; Entregas aprovadas somam 2/);
  expect(screen.getAllByText('Ver os números em texto')).toHaveLength(4);

  const faixa = within(screen.getByRole('region', { name: 'Entregas por empresa' }));
  const max = faixa.getByRole('heading', { name: 'Max Nutrition' }).closest('li') as HTMLElement;
  expect(within(max).getAllByRole('definition').map(d => d.textContent)).toEqual(['2', '0', '2', '2']);
  expect(faixa.getByRole('heading', { name: 'Empresa Parada' })).toBeTruthy();
});

it('leitura de cards com erro nunca mostra zero e leitura de entregas com erro mostra traço', () => {
  const d = dadosCheios();
  d.estado.cards = 'erro';
  montar(d);
  expect(screen.getByText('Não foi possível ler os cards')).toBeTruthy();
  expect(screen.getByText('Não foi possível ler o que decidir')).toBeTruthy();
  expect(screen.queryByText('Cards abertos')).toBeNull();
  expect(screen.queryByText('Nada para decidir agora')).toBeNull();
  expect(screen.getByText(/Não consegui ler os cards agora/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Ver o que decidir/ })).toBeNull();
  // Etapas e linha do tempo continuam: cada fonte falha sozinha.
  expect(grafico('Etapas abertas por agente')).toMatch(/Maya 2/);
});

it('entregas e pedidos com erro saem da faixa e da linha do tempo sem virar zero', () => {
  const d = dadosCheios();
  d.estado.entregas = 'erro';
  d.estado.pedidos = 'erro';
  montar(d);
  expect(screen.getByText(/Não foi possível ler: pedidos recebidos, entregas aprovadas\./)).toBeTruthy();
  expect(grafico('Últimos 14 dias')).toBe('Últimos 14 dias, por dia: Cards criados somam 8.');
  expect(screen.getByText(/não é mostrada para não parecer zero/)).toBeTruthy();
  const max = screen.getByRole('heading', { name: 'Max Nutrition' }).closest('li') as HTMLElement;
  expect(within(max).getAllByRole('definition').map(x => x.textContent)).toEqual(['2', '0', '2', '—']);
});

it('tudo com erro mostra erro na linha do tempo; carregando mostra estado de carregando', () => {
  const d = dadosCheios();
  d.estado = { cards: 'erro', etapas: 'erro', entregas: 'erro', pedidos: 'erro', catalogo: 'erro' };
  const { unmount } = render(<MemoryRouter><VisaoGeralAba dados={d} empresa="GRUPO" abrirCard={vi.fn()} /></MemoryRouter>);
  expect(screen.getByText('Não foi possível ler a linha do tempo')).toBeTruthy();
  unmount();
  montar(dadosVazios(AGORA));
  expect(screen.getAllByRole('status').length).toBeGreaterThan(3);
  expect(screen.queryByText('Nada para decidir agora')).toBeNull();
  expect(screen.getByText('Estou lendo os cards…')).toBeTruthy();
});

it('vazio verdadeiro: mensagens honestas, sem erro', () => {
  const d = dadosVazios(AGORA);
  d.estado = { cards: 'pronta', etapas: 'pronta', entregas: 'pronta', pedidos: 'pronta', catalogo: 'pronta' };
  montar(d);
  expect(screen.getByText('Nada espera você agora e nenhum card está atrasado.')).toBeTruthy();
  expect(screen.getByText('Nada para decidir agora')).toBeTruthy();
  expect(screen.getByText('Nenhum card ainda')).toBeTruthy();
  expect(screen.getByText('Nenhuma etapa aberta')).toBeTruthy();
  expect(screen.getByText('Nada nos últimos 14 dias')).toBeTruthy();
  expect(screen.getByText('Nenhuma empresa para mostrar')).toBeTruthy();
  expect(['Cards abertos', 'Esperando você', 'Atrasados', 'Prontos em 7 dias'].map(valorDoKpi)).toEqual(['0', '0', '0', '0']);
  expect(screen.queryByText(/Não foi possível/)).toBeNull();
});

it('filtro de empresa recorta KPIs, prioridades, gráficos e faixa', () => {
  montar(dadosCheios(), 'BIZ-001');
  expect(['Cards abertos', 'Esperando você', 'Atrasados', 'Prontos em 7 dias'].map(valorDoKpi)).toEqual(['2', '0', '1', '1']);
  expect(screen.getByText('Nenhum card espera você e 1 está atrasado.')).toBeTruthy();
  const lista = within(screen.getByRole('list', { name: 'Cards que pedem atenção' }));
  expect(lista.getAllByRole('listitem')).toHaveLength(1);
  expect(grafico('Etapas abertas por agente')).toBe('Etapas abertas por agente: Maya 2.');
  expect(grafico('Cards por estado')).toMatch(/Total 4/);
  expect(grafico('Últimos 14 dias')).toMatch(/Cards criados somam 4; Pedidos recebidos somam 1; Entregas aprovadas somam 2/);
  const faixa = within(screen.getByRole('region', { name: 'Entregas por empresa' }));
  expect(faixa.getAllByRole('heading', { level: 3 }).map(h => h.textContent)).toEqual(['Max Nutrition']);
});

it('filtro de empresa sem os cards lidos não inventa recorte nem zero', () => {
  const d = dadosCheios();
  d.estado.cards = 'erro';
  montar(d, 'BIZ-001');
  expect(screen.getByText('Não foi possível ler as etapas por agente')).toBeTruthy();
  expect(screen.getByText('Não foi possível ler a linha do tempo')).toBeTruthy();
});

it('amostra: avisa "amostra, não o total" no topo, nos números e na lista', () => {
  const d = dadosCheios();
  d.amostra = true;
  montar(d);
  expect(screen.getByText(/amostra, não o total: a leitura foi cortada por limite/)).toBeTruthy();
  expect(screen.getAllByText(/\(amostra, não o total\)/).length).toBeGreaterThanOrEqual(4);
  expect(screen.getByText(/\(na amostra lida, não no total\)/)).toBeTruthy();
  expect(screen.getByText('na amostra')).toBeTruthy();
});

it('"Ver o que decidir" leva o foco para as prioridades', () => {
  montar(dadosCheios());
  fireEvent.click(screen.getByRole('button', { name: /Ver o que decidir/ }));
  expect(document.activeElement?.id).toBe('prioridades-comando');
});

it('mostra no máximo 8 prioridades e avisa quantas existem', () => {
  const d = dadosCheios();
  d.cards = Array.from({ length: 11 }, (_, i) => card(`w${i}`, 'ESPERANDO_FUNDADOR'));
  montar(d);
  expect(within(screen.getByRole('list', { name: 'Cards que pedem atenção' })).getAllByRole('listitem')).toHaveLength(8);
  expect(screen.getByText('Mostrando 8 de 11.')).toBeTruthy();
});

it('saudação cai para a parte do e-mail e nunca mostra vírgula sem nome', () => {
  auth.user = { email: 'fundador@exemplo.com' };
  montar(dadosCheios());
  expect(screen.getByRole('heading', { name: 'Boa tarde, fundador.' })).toBeTruthy();
});

it('botões e links com altura mínima de toque e catálogo com erro cai para os códigos', () => {
  const d = dadosCheios();
  d.estado.catalogo = 'erro';
  d.catalogo.empresas = [];
  montar(d);
  const alvos = [...screen.getAllByRole('button'), ...screen.getAllByRole('link')];
  expect(alvos.length).toBeGreaterThan(8);
  for (const el of alvos) expect(el.className).toMatch(/min-h-11/);
  expect(screen.getAllByText('BIZ-001').length).toBeGreaterThan(0);
  expect(screen.getAllByText(/aparecem os códigos/).length).toBeGreaterThan(0);
  expect(cardsBase.length).toBe(8);
});
