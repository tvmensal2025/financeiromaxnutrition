import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import EmpresasAba from './EmpresasAba';
import { dadosVazios, type CardComando, type DadosComando, type EntregaResumo, type EtapaComando } from '@/integrations/comando-v2/tipos';

const AGORA = new Date('2026-10-17T15:00:00Z');
const h = (horas: number) => new Date(AGORA.getTime() - horas * 3_600_000).toISOString();
const card = (id: string, extra: Partial<CardComando> = {}): CardComando => ({
  id, titulo: `Card ${id}`, empresa: 'BIZ-003', estado: 'EM_ANDAMENTO', dono: 'HELENA', prazo: h(-48), criado_em: h(5),
  atualizado_em: h(0.2), prazo_ate: h(-48), prioridade: 1, ...extra,
});
const etapa = (id: string, cardId: string, extra: Partial<EtapaComando> = {}): EtapaComando => ({
  id, codigo: `E-${id}`, nome: `Etapa ${id}`, estado: 'APROVADA', autor: 'BIANCA', dono: 'BIANCA', prazo_ate: h(-5), revisores: [],
  versao: 1, portao1_ok: true, entrega_fresca: true, card_id: cardId, ordem: 1, atualizado_em: h(1), execucoes: 1, ...extra,
});
const entrega = (id: string, cardId: string, etapaId: string): EntregaResumo => ({
  id, card_id: cardId, etapa_id: etapaId, etapa_codigo: null, versao: 1, autor: 'BIANCA', portao1: 'PASSOU', criada_em: h(1), parecer: null, usou_internet: null,
});
function dados(extra: Partial<DadosComando> = {}): DadosComando {
  return {
    ...dadosVazios(AGORA),
    catalogo: { revisao: 'rev', empresas: [{ id: 'BIZ-003', nome: 'Humano Digital', pacote: 'CONFIRMADO' }, { id: 'BIZ-001', nome: 'iGreen', pacote: 'NAO_CONFIRMADO' }], agentes: [], servicos: [] },
    estado: { cards: 'pronta', etapas: 'pronta', entregas: 'pronta', pedidos: 'pronta', catalogo: 'pronta' },
    ...extra,
  };
}
const montar = (d: DadosComando, empresa = 'GRUPO') =>
  render(<MemoryRouter><EmpresasAba dados={d} empresa={empresa} abrirCard={() => undefined} /></MemoryRouter>);
const cartao = (nome: string) => screen.getByRole('listitem', { name: `Empresa ${nome}` });

it('mostra um cartão por empresa com os números certos', () => {
  montar(dados({
    cards: [card('a'), card('b', { estado: 'ESPERANDO_FUNDADOR' }), card('c', { prazo_ate: h(3) }), card('d', { estado: 'PRONTO' }), card('e', { empresa: 'BIZ-001' })],
    etapas: [etapa('1', 'd')], entregas: [entrega('x', 'd', '1')],
  }));
  const humano = within(cartao('Humano Digital'));
  const valor = (rotulo: string) => humano.getByText(rotulo).closest('div')!.querySelector('dd')!.textContent;
  expect(valor('Cards abertos')).toBe('3');
  expect(valor('Esperando você')).toBe('1');
  expect(valor('Atrasados')).toBe('1');
  expect(valor('Prontos')).toBe('1');
  expect(valor('Entregas aprovadas')).toBe('1');
  expect(within(cartao('iGreen')).getByText('Cards abertos').closest('div')!.querySelector('dd')!.textContent).toBe('1');
});

it('alerta quando o pacote de voz não está confirmado e não alerta quando está', () => {
  montar(dados());
  expect(within(cartao('iGreen')).getByRole('alert').textContent).toContain('Pacote de voz não confirmado: card dessa empresa é recusado.');
  expect(within(cartao('Humano Digital')).queryByRole('alert')).toBeNull();
  expect(within(cartao('Humano Digital')).getByText('Pacote de voz confirmado')).toBeTruthy();
});

it('leva para a aba Cards', () => {
  montar(dados());
  expect(within(cartao('iGreen')).getByRole('link', { name: /Ver cards/ }).getAttribute('href')).toBe('/comando?aba=cards&empresa=BIZ-001');
});

it('respeita o filtro de empresa', () => {
  montar(dados({ cards: [card('a')] }), 'BIZ-003');
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  expect(screen.queryByRole('listitem', { name: 'Empresa iGreen' })).toBeNull();
});

it('entrega aprovada indisponível não vira zero quando a leitura falhou', () => {
  montar(dados({ cards: [card('a')], estado: { ...dados().estado, entregas: 'erro' } }));
  const aprovadas = within(cartao('Humano Digital')).getByText('Entregas aprovadas').closest('div')!;
  expect(within(aprovadas).getByLabelText('indisponível')).toBeTruthy();
  expect(screen.getByText(/aparecem como indisponíveis, não como zero/)).toBeTruthy();
});

it('erro nos cards mostra erro, não números; carregando mostra carregando', () => {
  const { unmount } = montar(dados({ estado: { ...dados().estado, cards: 'erro' } }));
  expect(screen.getByText('Não foi possível ler as empresas')).toBeTruthy();
  expect(screen.queryByText('Cards abertos')).toBeNull();
  unmount();
  montar(dados({ estado: { ...dados().estado, catalogo: 'carregando' } }));
  expect(screen.getByRole('status', { name: 'Carregando as empresas' })).toBeTruthy();
});

it('lista honesta quando não há empresa cadastrada e conta card sem empresa do cadastro', () => {
  const { unmount } = montar(dados({ catalogo: { revisao: 'r', empresas: [], agentes: [], servicos: [] } }));
  expect(screen.getByText('Nenhuma empresa na configuração ativa')).toBeTruthy();
  unmount();
  montar(dados({ cards: [card('a', { empresa: null }), card('b', { empresa: 'BIZ-999' })] }));
  expect(screen.getByText(/2 cards abertos não têm empresa do cadastro/)).toBeTruthy();
});
