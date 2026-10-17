import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { EntregaGaleria, type CarregarDetalhe } from './EntregaGaleria';
import { dadosDeTeste, entrega } from '@/integrations/comando-v2/dados-de-teste-execucao';
import type { DadosComando } from '@/integrations/comando-v2/tipos';
import type { DetalheCardV2, EntregaV2 } from '@/integrations/cards-v2/repository';

const entregaV2 = (id: number, etapa_id: string, conteudo: unknown): EntregaV2 =>
  ({ id, etapa_id, versao: 1, portao1: 'PASSOU', conteudo, criada_em: '2026-10-15T15:00:00Z' });
const detalheDoCard = (): DetalheCardV2 => ({
  etapas: [],
  entregas: [
    entregaV2(1, 'a1', { titulo_do_post: 'Vitamina D no inverno', legenda: { curta: 'Tome sol' } }),
    entregaV2(2, 'a2', 'Texto simples da revisão'),
  ],
});
function montar(dados: DadosComando = dadosDeTeste(), opcoes: { empresa?: string; carregar?: CarregarDetalhe } = {}) {
  const abrirCard = vi.fn();
  const carregar = opcoes.carregar ?? vi.fn<CarregarDetalhe>().mockResolvedValue(detalheDoCard());
  render(<EntregaGaleria dados={dados} empresa={opcoes.empresa ?? 'GRUPO'} abrirCard={abrirCard} carregarDetalhe={carregar} />);
  return { abrirCard, carregar: carregar as ReturnType<typeof vi.fn<CarregarDetalhe>> };
}
const botaoDe = (titulo: RegExp) => screen.getAllByRole('button', { name: titulo })[0];
afterEach(() => { Reflect.deleteProperty(navigator, 'clipboard'); });

it('lista só as entregas aprovadas, agrupadas por empresa', () => {
  montar();
  expect(screen.getByText('4 entregas aprovadas')).toBeTruthy();
  const humano = within(screen.getByRole('region', { name: 'Humano Digital' }));
  expect(humano.getAllByRole('listitem')).toHaveLength(3);
  expect(within(screen.getByRole('region', { name: 'Max Nutrition' })).getAllByRole('listitem')).toHaveLength(1);
  expect(screen.queryByText('5')).toBeNull();
});

it('agrupa por agente e por etapa e permite tirar os grupos', () => {
  montar();
  fireEvent.click(screen.getByRole('button', { name: 'Agente' }));
  expect(screen.getByRole('region', { name: 'Helena' })).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Sirlene' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Etapa' }));
  expect(screen.getByRole('region', { name: 'E1 · Redigir' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Sem grupos' }));
  expect(screen.getByRole('region', { name: 'Todas as entregas' })).toBeTruthy();
});

it('busca ignorando acento e maiúsculas e diz quando nada combina', () => {
  montar();
  fireEvent.change(screen.getByLabelText('Buscar entrega'), { target: { value: 'SITE DA MAX' } });
  expect(screen.getByText('1 entrega aprovada (de 4)')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Buscar entrega'), { target: { value: 'zzz' } });
  expect(screen.getByText('Nenhuma entrega combina com a busca')).toBeTruthy();
});

it('abre a entrega, carrega o texto do card uma vez e mostra linhas legíveis', async () => {
  const { carregar } = montar();
  const abrir = screen.getAllByRole('button', { name: /Post semanal/ })[0];
  fireEvent.click(abrir);
  expect(abrir.getAttribute('aria-expanded')).toBe('true');
  expect(await screen.findByText('Vitamina D no inverno')).toBeTruthy();
  expect(screen.getByText('titulo do post')).toBeTruthy();
  expect(screen.getByText('legenda curta')).toBeTruthy();
  expect(screen.getByText('Parecer: Texto claro')).toBeTruthy();
  // segunda entrega do mesmo card reaproveita o detalhe já pedido
  fireEvent.click(document.querySelector('[aria-controls="entrega-2-painel"]') as HTMLElement);
  expect(await screen.findByText('Texto simples da revisão')).toBeTruthy();
  expect(carregar).toHaveBeenCalledTimes(1);
  expect(carregar).toHaveBeenCalledWith('c3');
});

it('mostra erro de carregamento sem inventar texto e deixa tentar de novo', async () => {
  const carregar = vi.fn<CarregarDetalhe>().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(detalheDoCard());
  montar(dadosDeTeste(), { carregar });
  fireEvent.click(botaoDe(/Post semanal/));
  expect(await screen.findByText('Não foi possível carregar o texto desta entrega. Motivo: offline')).toBeTruthy();
  expect(screen.queryByText('Vitamina D no inverno')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Copiar texto' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
  expect(await screen.findByText('Vitamina D no inverno')).toBeTruthy();
  expect(carregar).toHaveBeenCalledTimes(2);
});

it('trata detalhe sem a entrega pedida como erro, não como texto vazio', async () => {
  const carregar = vi.fn<CarregarDetalhe>().mockResolvedValue({ etapas: [], entregas: [] });
  montar(dadosDeTeste(), { carregar });
  fireEvent.click(botaoDe(/Post semanal/));
  expect(await screen.findByText(/não consta mais como aprovada no card/)).toBeTruthy();
});

it('casa a entrega pelo id antes de casar por etapa e versão', async () => {
  const carregar = vi.fn<CarregarDetalhe>().mockResolvedValue({
    etapas: [], entregas: [entregaV2(99, 'a1', 'Texto de outra entrega'), entregaV2(1, 'a1', 'Texto certo da entrega 1')],
  });
  montar(dadosDeTeste(), { carregar });
  fireEvent.click(botaoDe(/Post semanal/));
  expect(await screen.findByText('Texto certo da entrega 1')).toBeTruthy();
  expect(screen.queryByText('Texto de outra entrega')).toBeNull();
});

it('não lista entrega velha nem de etapa que não está aprovada (o card também não a abriria)', () => {
  const dados = dadosDeTeste();
  dados.etapas = dados.etapas.map(e => (e.id === 'a1' ? { ...e, entrega_fresca: false } : e));
  dados.entregas.push(entrega('8', 'c3', { etapa_id: 'e1' }), entrega('9', 'c3', { etapa_id: 'a2', versao: 2 }));
  montar(dados);
  expect(screen.getByText('3 entregas aprovadas')).toBeTruthy();
});

it('sem a leitura das etapas não afirma nada sobre entregas aprovadas', () => {
  const dados = dadosDeTeste();
  dados.estado.etapas = 'erro';
  render(<EntregaGaleria dados={dados} empresa="GRUPO" abrirCard={vi.fn()} />);
  expect(screen.getByText('Não foi possível confirmar as entregas aprovadas')).toBeTruthy();
});

it('copia o texto e avisa o resultado', async () => {
  const escrever = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: escrever }, configurable: true });
  montar();
  fireEvent.click(botaoDe(/Post semanal/));
  fireEvent.click(await screen.findByRole('button', { name: 'Copiar texto' }));
  expect(await screen.findByText('Texto copiado.')).toBeTruthy();
  expect(escrever).toHaveBeenCalledWith('titulo do post: Vitamina D no inverno\nlegenda curta: Tome sol');
});

it('avisa quando não consegue copiar', async () => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('negado')) }, configurable: true });
  Object.defineProperty(document, 'execCommand', { value: vi.fn().mockReturnValue(false), configurable: true, writable: true });
  montar();
  fireEvent.click(botaoDe(/Post semanal/));
  fireEvent.click(await screen.findByRole('button', { name: 'Copiar texto' }));
  expect(await screen.findByText(/Não foi possível copiar/)).toBeTruthy();
});

it('abre o card da entrega', async () => {
  const { abrirCard } = montar();
  fireEvent.click(botaoDe(/Post semanal/));
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Abrir card: Post semanal' }).length).toBeGreaterThan(0));
  const painel = document.getElementById('entrega-1-painel') as HTMLElement;
  fireEvent.click(within(painel).getByRole('button', { name: 'Abrir card: Post semanal' }));
  expect(abrirCard).toHaveBeenCalledWith('c3');
});

it('filtra por empresa pelo card e avisa das entregas sem card na leitura', () => {
  const dados = dadosDeTeste();
  dados.entregas.push(entrega('9', 'fantasma', { etapa_id: 'a1' }));
  montar(dados, { empresa: 'BIZ-001' });
  expect(screen.getByText('1 entrega aprovada')).toBeTruthy();
  expect(screen.getByText(/1 entrega aprovada não pôde ser ligada a uma empresa/)).toBeTruthy();
});

it('mostra título honesto para entrega cujo card saiu da leitura (visão do grupo)', () => {
  const dados = dadosDeTeste();
  dados.entregas = [entrega('9', 'fantasma', { etapa_id: 'a1' })];
  montar(dados);
  expect(screen.getByText('Card fora da amostra lida')).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Empresa não confirmada' })).toBeTruthy();
});

it('erro e carregamento da leitura nunca viram "zero entregas"', () => {
  const erro = dadosDeTeste();
  erro.estado.entregas = 'erro';
  const { unmount } = render(<EntregaGaleria dados={erro} empresa="GRUPO" abrirCard={vi.fn()} />);
  expect(screen.getByText('Não foi possível ler as entregas')).toBeTruthy();
  expect(screen.queryByText(/Ainda não há entregas aprovadas/)).toBeNull();
  unmount();
  const lendo = dadosDeTeste();
  lendo.estado.entregas = 'carregando';
  render(<EntregaGaleria dados={lendo} empresa="GRUPO" abrirCard={vi.fn()} />);
  expect(screen.getByRole('status', { name: 'Carregando entregas aprovadas' })).toBeTruthy();
});

it('erro nos cards impede separar por empresa, mas o grupo ainda mostra as entregas', () => {
  const dados = dadosDeTeste();
  dados.estado.cards = 'erro';
  dados.cards = [];
  const { unmount } = render(<EntregaGaleria dados={dados} empresa="BIZ-003" abrirCard={vi.fn()} />);
  expect(screen.getByText('Não foi possível separar as entregas por empresa')).toBeTruthy();
  unmount();
  render(<EntregaGaleria dados={dados} empresa="GRUPO" abrirCard={vi.fn()} />);
  expect(screen.getByText(/Não foi possível ler os cards/)).toBeTruthy();
  expect(screen.getByText('4 entregas aprovadas')).toBeTruthy();
});

it('vazio de verdade e amostra', () => {
  const dados = dadosDeTeste();
  dados.entregas = [];
  dados.amostra = true;
  montar(dados);
  expect(screen.getByText('Ainda não há entregas aprovadas')).toBeTruthy();
  expect(screen.getByText(/Amostra: a leitura foi cortada/)).toBeTruthy();
});

it('pagina a lista quando há muitas entregas', () => {
  const dados = dadosDeTeste();
  dados.entregas = Array.from({ length: 35 }, (_, i) => entrega(`m${i}`, 'c3', { etapa_id: 'a1' }));
  montar(dados);
  expect(screen.getAllByRole('listitem')).toHaveLength(30);
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais (5 restantes)' }));
  expect(screen.getAllByRole('listitem')).toHaveLength(35);
});
