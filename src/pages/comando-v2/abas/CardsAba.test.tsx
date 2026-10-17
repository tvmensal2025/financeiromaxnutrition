import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import CardsAba from './CardsAba';
import { AGORA, card, entrega, etapa, montarDados } from '@/integrations/comando-v2/derivar-cards.fixtures';
import type { DadosComando } from '@/integrations/comando-v2/tipos';

const h = (n: number) => new Date(AGORA.getTime() + n * 3600_000).toISOString();

function dadosBase(): DadosComando {
  return montarDados({
    cards: [
      card('a', { titulo: 'Campanha de Natal', estado: 'ESPERANDO_FUNDADOR', motivo: 'DEPENDENCIA', prioridade: 1 }),
      card('b', { titulo: 'Relatório fiscal', prazo: h(-3), prazo_ate: h(-3), dono: 'LAURA' }),
      card('c', { titulo: 'Site novo', estado: 'PRONTO' }),
      card('d', { titulo: 'Plano eLiving', empresa: 'BIZ-005', estado: 'ESPERANDO_CONFIRMACAO' }),
    ],
    etapas: [etapa('1', 'a', { codigo: 'ET-01', nome: 'Escrever texto', estado: 'APROVADA', ordem: 1 }), etapa('2', 'a', { codigo: 'ET-02', nome: 'Revisar', estado: 'NA_FILA', ordem: 2 })],
    entregas: [entrega(1 as unknown as string, 'a'), entrega(2 as unknown as string, 'a', 'FALHOU'), entrega(3 as unknown as string, 'b')],
  });
}
const montar = (dados = dadosBase(), empresa = 'GRUPO', abrirCard = vi.fn()) => ({ abrirCard, ...render(<CardsAba dados={dados} empresa={empresa} abrirCard={abrirCard} />) });
const titulosNaLista = () => screen.getAllByRole('button', { name: /^Abrir detalhes do card/ }).map(b => b.getAttribute('aria-label')?.replace('Abrir detalhes do card ', ''));

it('lista todos os cards com estado em português, empresa, dono e prazo relativo', () => {
  montar();
  expect(titulosNaLista()).toHaveLength(4);
  const linha = screen.getByRole('button', { name: /Relatório fiscal/ });
  expect(within(linha).getByText('venceu há 3 h')).toBeTruthy();
  expect(within(linha).getByText('Humano Digital')).toBeTruthy();
  expect(within(linha).getByText('Em andamento')).toBeTruthy();
  expect(within(screen.getByRole('button', { name: /Campanha de Natal/ })).getByText('Esperando você')).toBeTruthy();
  expect(screen.getByText('4 cards encontrados', { exact: false })).toBeTruthy();
});

it('chips filtram a lista e mostram a contagem', () => {
  montar();
  fireEvent.click(screen.getByRole('button', { name: /Precisa de você/ }));
  expect(titulosNaLista().sort()).toEqual(['Campanha de Natal', 'Plano eLiving']);
  fireEvent.click(screen.getByRole('button', { name: /Prazo vencido/ }));
  expect(titulosNaLista()).toEqual(['Relatório fiscal']);
  fireEvent.click(screen.getByRole('button', { name: /Prontos/ }));
  expect(titulosNaLista()).toEqual(['Site novo']);
  fireEvent.click(screen.getByRole('button', { name: /Em andamento/ }));
  expect(titulosNaLista()).toEqual(['Relatório fiscal']);
  fireEvent.click(screen.getByRole('button', { name: /Todos/ }));
  expect(titulosNaLista()).toHaveLength(4);
});

it('busca por título, empresa e dono, e mostra vazio honesto com opção de limpar', () => {
  montar();
  const campo = screen.getByRole('searchbox', { name: /Buscar cards/ });
  fireEvent.change(campo, { target: { value: 'laura' } });
  expect(titulosNaLista()).toEqual(['Relatório fiscal']);
  fireEvent.change(campo, { target: { value: 'eliving' } });
  expect(titulosNaLista()).toEqual(['Plano eLiving']);
  fireEvent.change(campo, { target: { value: 'nada disso' } });
  expect(screen.getByText('Nenhum card combina com esse filtro')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Limpar busca e filtros' }));
  expect(titulosNaLista()).toHaveLength(4);
});

it('ordena por prazo mais próximo', () => {
  montar();
  fireEvent.change(screen.getByRole('combobox', { name: 'Ordenar cards' }), { target: { value: 'prazo' } });
  expect(titulosNaLista()[0]).toBe('Relatório fiscal');
});

it('respeita o filtro de empresa', () => {
  montar(dadosBase(), 'BIZ-005');
  expect(titulosNaLista()).toEqual(['Plano eLiving']);
});

it('mostra 25 por vez e carrega mais', () => {
  const muitos = Array.from({ length: 60 }, (_, i) => card(`m${i}`, { titulo: `Card ${String(i).padStart(2, '0')}` }));
  montar(montarDados({ cards: muitos }));
  expect(titulosNaLista()).toHaveLength(25);
  fireEvent.click(screen.getByRole('button', { name: /Mostrar mais/ }));
  expect(titulosNaLista()).toHaveLength(50);
  fireEvent.click(screen.getByRole('button', { name: /Mostrar mais/ }));
  expect(titulosNaLista()).toHaveLength(60);
  expect(screen.queryByRole('button', { name: /Mostrar mais/ })).toBeNull();
});

it('abre o painel lateral com etapas, entregas aprovadas e botão de card completo', () => {
  const { abrirCard } = montar();
  fireEvent.click(screen.getByRole('button', { name: /Campanha de Natal/ }));
  const painel = screen.getByRole('dialog');
  expect(within(painel).getByText('Campanha de Natal')).toBeTruthy();
  expect(within(painel).getByText('Uma etapa da qual esta depende falhou.')).toBeTruthy();
  expect(within(painel).getAllByText('Humano Digital').length).toBeGreaterThan(0);
  expect(within(painel).getByText('ET-01 · Escrever texto')).toBeTruthy();
  expect(within(painel).getByText('Aprovada')).toBeTruthy();
  expect(within(painel).getByText('ET-02 · Revisar')).toBeTruthy();
  expect(within(painel).getAllByText(/Autor: CAIO · Revisor: CLARA/, { selector: 'p' })).toHaveLength(2);
  expect(painel.textContent).toContain('1 entrega aprovada no primeiro portão, de 2 registradas');
  fireEvent.click(within(painel).getByRole('button', { name: /Abrir card completo/ }));
  expect(abrirCard).toHaveBeenCalledWith('a');
});

it('navega entre anterior e próximo dentro da lista filtrada', () => {
  montar();
  fireEvent.click(screen.getByRole('button', { name: /Precisa de você/ }));
  const [primeiro, segundo] = titulosNaLista();
  fireEvent.click(screen.getByRole('button', { name: new RegExp(primeiro!) }));
  let painel = screen.getByRole('dialog');
  expect(within(painel).getByRole('button', { name: 'Card anterior' }).hasAttribute('disabled')).toBe(true);
  expect(painel.textContent).toContain('Card 1 de 2');
  fireEvent.click(within(painel).getByRole('button', { name: 'Próximo card' }));
  painel = screen.getByRole('dialog');
  expect(within(painel).getAllByText(segundo!).length).toBeGreaterThan(0);
  expect(painel.textContent).toContain('Card 2 de 2');
  expect(within(painel).getByRole('button', { name: 'Próximo card' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(within(painel).getByRole('button', { name: 'Card anterior' }));
  expect(within(screen.getByRole('dialog')).getAllByText(primeiro!).length).toBeGreaterThan(0);
});

it('erro de leitura dos cards mostra erro e nunca zero', () => {
  montar(montarDados({ cards: [], estado: { ...montarDados().estado, cards: 'erro' } }));
  expect(screen.getByText('Não foi possível carregar os cards')).toBeTruthy();
  expect(screen.queryByText(/0 cards/)).toBeNull();
  expect(screen.queryByRole('searchbox')).toBeNull();
});

it('carregando mostra o estado de carregamento', () => {
  montar(montarDados({ estado: { ...montarDados().estado, cards: 'carregando' } }));
  expect(screen.getByRole('status', { name: 'Carregando cards' })).toBeTruthy();
});

it('vazio verdadeiro mostra mensagem honesta, e a amostra é avisada', () => {
  montar(montarDados({ amostra: true }), 'BIZ-005');
  expect(screen.getByText('Nenhum card por aqui')).toBeTruthy();
  expect(screen.getByText(/Ainda não há cards em eLiving/)).toBeTruthy();
  expect(screen.getByText(/só uma amostra/)).toBeTruthy();
});

it('erro nas etapas aparece dentro do painel, sem virar "sem etapas"', () => {
  const dados = dadosBase();
  dados.estado.etapas = 'erro';
  dados.estado.entregas = 'erro';
  montar(dados);
  fireEvent.click(screen.getByRole('button', { name: /Campanha de Natal/ }));
  const painel = screen.getByRole('dialog');
  expect(within(painel).getByText('Não foi possível ler as etapas')).toBeTruthy();
  expect(within(painel).getByText('Não foi possível ler as entregas')).toBeTruthy();
  expect(within(painel).queryByText(/ainda não tem etapas/)).toBeNull();
});

it('corte só nos pedidos não faz a aba de cards avisar "amostra"', () => {
  montar(montarDados({ amostra: false, amostras: { cards: false, etapas: false, entregas: false, pedidos: true } }), 'BIZ-005');
  expect(screen.queryByText(/só uma amostra/)).toBeNull();
});
