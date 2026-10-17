import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import SupervisaoAba from './SupervisaoAba';
import { dadosVazios, type CardComando, type DadosComando } from '@/integrations/comando-v2/tipos';

const AGORA = new Date('2026-10-17T15:00:00Z');
const h = (horas: number) => new Date(AGORA.getTime() - horas * 3_600_000).toISOString();
const card = (id: string, extra: Partial<CardComando> = {}): CardComando => ({
  id, titulo: `Card ${id}`, empresa: 'BIZ-003', estado: 'EM_ANDAMENTO', dono: 'HELENA', prazo: h(-48), criado_em: h(5),
  atualizado_em: h(0.2), prazo_ate: h(-48), prioridade: 1, ...extra,
});
function dados(extra: Partial<DadosComando> = {}): DadosComando {
  return {
    ...dadosVazios(AGORA),
    catalogo: { revisao: 'rev', empresas: [{ id: 'BIZ-003', nome: 'Humano Digital', pacote: 'CONFIRMADO' }, { id: 'BIZ-001', nome: 'iGreen', pacote: 'NAO_CONFIRMADO' }], agentes: [], servicos: [] },
    estado: { cards: 'pronta', etapas: 'pronta', entregas: 'pronta', pedidos: 'pronta', catalogo: 'pronta' },
    ...extra,
  };
}
const montar = (d: DadosComando, empresa = 'GRUPO', abrirCard = vi.fn()) => {
  render(<SupervisaoAba dados={d} empresa={empresa} abrirCard={abrirCard} />);
  return abrirCard;
};
const comExcecoes = () => dados({ cards: [
  card('vencido', { prazo_ate: h(3), titulo: 'Contrato atrasado' }),
  card('sem-dono', { dono: null, titulo: 'Campanha sem dono' }),
  card('espera', { estado: 'ESPERANDO_FUNDADOR', atualizado_em: h(30), titulo: 'Decisão parada', empresa: 'BIZ-001' }),
  card('sem-empresa', { empresa: null, titulo: 'Card sem empresa' }),
] });

it('lista as exceções com texto simples, nome da empresa e há quanto tempo, e abre o card', () => {
  const abrir = montar(comExcecoes());
  const lista = screen.getByRole('list', { name: 'Exceções encontradas' });
  expect(within(lista).getAllByRole('listitem')).toHaveLength(4);
  // mais grave primeiro
  expect(within(lista).getAllByRole('heading', { level: 3 })[0].textContent).toBe('Contrato atrasado');
  expect(within(lista).getByText(/O prazo deste card venceu/)).toBeTruthy();
  expect(within(lista).getAllByText('Humano Digital').length).toBeGreaterThan(0);
  expect(within(lista).getByText('iGreen')).toBeTruthy();
  expect(within(lista).getByText('há 30 h')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Abrir card: Contrato atrasado' }));
  expect(abrir).toHaveBeenCalledWith('vencido');
});

it('mostra resumo por severidade e por regra e os chips filtram a lista', () => {
  montar(comExcecoes());
  expect(screen.getByRole('button', { name: 'Filtrar por severidade alta: 1' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Filtrar por severidade média: 2' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Filtrar pela regra Sem dono: 1' }));
  const lista = screen.getByRole('list', { name: 'Exceções encontradas' });
  expect(within(lista).getAllByRole('listitem')).toHaveLength(1);
  expect(within(lista).getByText('Campanha sem dono')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
  expect(within(screen.getByRole('list', { name: 'Exceções encontradas' })).getAllByRole('listitem')).toHaveLength(4);
});

it('estado vazio positivo só aparece com cards e etapas lidos', () => {
  montar(dados({ cards: [card('ok')] }));
  expect(screen.getByText('Nenhuma exceção encontrada nos dados lidos')).toBeTruthy();
});

it('com erro na leitura de cards ou etapas mostra o erro e nunca "tudo certo"', () => {
  montar(dados({ estado: { ...dados().estado, etapas: 'erro' } }));
  expect(screen.getByText('Não foi possível ler os dados da Supervisão')).toBeTruthy();
  expect(screen.queryByText('Nenhuma exceção encontrada nos dados lidos')).toBeNull();
});

it('enquanto lê, mostra carregando e não afirma que está tudo certo', () => {
  montar(dados({ estado: { ...dados().estado, cards: 'carregando' } }));
  expect(screen.getByRole('status', { name: 'Carregando a Supervisão' })).toBeTruthy();
  expect(screen.queryByText('Nenhuma exceção encontrada nos dados lidos')).toBeNull();
});

it('respeita o filtro de empresa e avisa das exceções sem empresa que ficam de fora', () => {
  montar(comExcecoes(), 'BIZ-001');
  const lista = screen.getByRole('list', { name: 'Exceções encontradas' });
  expect(within(lista).getAllByRole('listitem')).toHaveLength(1);
  expect(within(lista).getByText('Decisão parada')).toBeTruthy();
  expect(screen.getByText(/1 exceção sem empresa definida fica fora desta lista/)).toBeTruthy();
});

it('avisa amostra e pedidos que não puderam ser lidos', () => {
  montar(dados({ cards: [card('ok')], amostra: true, estado: { ...dados().estado, pedidos: 'erro' } }));
  expect(screen.getByText(/Amostra: a leitura foi cortada por limite/)).toBeTruthy();
  expect(screen.getByText(/Não foi possível ler os pedidos/)).toBeTruthy();
});
