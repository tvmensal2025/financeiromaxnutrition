import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import CoberturaAba from './CoberturaAba';
import { dadosVazios, type CardComando, type DadosComando, type EntregaResumo, type EtapaComando } from '@/integrations/comando-v2/tipos';

const AGORA = new Date('2026-10-17T15:00:00Z');
const h = (horas: number) => new Date(AGORA.getTime() - horas * 3_600_000).toISOString();
const card = (id: string, empresa: string): CardComando => ({
  id, titulo: `Card ${id}`, empresa, estado: 'PRONTO', dono: 'HELENA', prazo: h(-48), criado_em: h(5),
  atualizado_em: h(0.2), prazo_ate: h(-48), prioridade: 1,
});
const etapa = (id: string, cardId: string): EtapaComando => ({
  id, codigo: `E-${id}`, nome: `Etapa ${id}`, estado: 'APROVADA', autor: 'BIANCA', dono: 'BIANCA', prazo_ate: h(-5), revisores: [],
  versao: 1, portao1_ok: true, entrega_fresca: true, card_id: cardId, ordem: 1, atualizado_em: h(1), execucoes: 1,
});
const entrega = (id: string, cardId: string, etapaId: string, autor: string): EntregaResumo => ({
  id, card_id: cardId, etapa_id: etapaId, etapa_codigo: null, versao: 1, autor, portao1: 'PASSOU', criada_em: h(1), parecer: null, usou_internet: null,
});
function dados(extra: Partial<DadosComando> = {}): DadosComando {
  return {
    ...dadosVazios(AGORA),
    catalogo: {
      revisao: 'rev',
      empresas: [{ id: 'BIZ-003', nome: 'Humano Digital', pacote: 'CONFIRMADO' }, { id: 'BIZ-001', nome: 'iGreen', pacote: 'NAO_CONFIRMADO' }],
      agentes: [],
      servicos: [
        { id: 'SRV-1', nome: 'Perfil de função', dono: 'BIANCA', revisor: 'HELENA', estado: 'ATIVO', empresas: ['BIZ-003'] },
        { id: 'SRV-2', nome: 'Análise financeira', dono: 'LEO', revisor: 'HELENA', estado: 'RASCUNHO', empresas: ['BIZ-003', 'PESSOAL'] },
      ],
    },
    estado: { cards: 'pronta', etapas: 'pronta', entregas: 'pronta', pedidos: 'pronta', catalogo: 'pronta' },
    cards: [card('a', 'BIZ-003'), card('b', 'BIZ-001')],
    etapas: [etapa('1', 'a'), etapa('2', 'b')],
    entregas: [entrega('x', 'a', '1', 'BIANCA'), entrega('y', 'b', '2', 'BIANCA')],
    ...extra,
  };
}
const montar = (d: DadosComando, empresa = 'GRUPO') => render(<CoberturaAba dados={d} empresa={empresa} abrirCard={() => undefined} />);
const tabela = () => within(screen.getByRole('table', { name: 'Matriz de serviços por empresa' }));

it('monta a matriz serviço x empresa com o estado do serviço', () => {
  montar(dados());
  const t = tabela();
  expect(t.getByRole('columnheader', { name: 'Humano Digital' })).toBeTruthy();
  expect(t.getByRole('columnheader', { name: 'iGreen' })).toBeTruthy();
  const linha1 = within(t.getByRole('rowheader', { name: /Perfil de função/ }).closest('tr')!);
  expect(linha1.getByText('Ativo')).toBeTruthy();
  expect(linha1.getByText('Atende Humano Digital')).toBeTruthy();
  expect(linha1.getByText('Não atende iGreen')).toBeTruthy();
  const linha2 = within(t.getByRole('rowheader', { name: /Análise financeira/ }).closest('tr')!);
  expect(linha2.getByText('Rascunho')).toBeTruthy();
  expect(linha2.getByText('PESSOAL')).toBeTruthy();
});

it('marca a entrega aprovada como aproximação, pelo dono do serviço', () => {
  montar(dados());
  const t = tabela();
  expect(t.getByRole('columnheader', { name: /aproximação/ })).toBeTruthy();
  expect(within(t.getByRole('rowheader', { name: /Perfil de função/ }).closest('tr')!).getByText('Sim (2) · aproximação')).toBeTruthy();
  expect(within(t.getByRole('rowheader', { name: /Análise financeira/ }).closest('tr')!).getByText('Não · aproximação')).toBeTruthy();
});

it('mostra o texto de limite e avisa empresa sem serviço que receba card real', () => {
  montar(dados());
  expect(screen.getByText('Cobertura da configuração, não prova de operação do motor, do Telegram ou da VPS.')).toBeTruthy();
  expect(screen.getByRole('alert').textContent).toContain('iGreen');
  expect(screen.getByRole('alert').textContent).not.toContain('Humano Digital');
});

it('respeita o filtro de empresa na coluna e no indicador de entrega', () => {
  montar(dados(), 'BIZ-001');
  const t = tabela();
  expect(t.queryByRole('columnheader', { name: 'Humano Digital' })).toBeNull();
  expect(t.getByRole('columnheader', { name: 'iGreen' })).toBeTruthy();
  expect(within(t.getByRole('rowheader', { name: /Perfil de função/ }).closest('tr')!).getByText('Sim (1) · aproximação')).toBeTruthy();
});

it('entrega indisponível quando etapas ou entregas não foram lidas, sem virar "Não"', () => {
  montar(dados({ estado: { ...dados().estado, entregas: 'erro' } }));
  const linha = within(tabela().getByRole('rowheader', { name: /Perfil de função/ }).closest('tr')!);
  expect(linha.getByText('Indisponível')).toBeTruthy();
  expect(linha.queryByText(/Não · aproximação/)).toBeNull();
  // a matriz da configuração continua visível
  expect(linha.getByText('Atende Humano Digital')).toBeTruthy();
});

it('erro na configuração mostra erro; carregando mostra carregando; vazio é honesto', () => {
  const { unmount } = montar(dados({ estado: { ...dados().estado, catalogo: 'erro' } }));
  expect(screen.getByText('Não foi possível ler a cobertura')).toBeTruthy();
  expect(screen.queryByRole('table')).toBeNull();
  unmount();
  const { unmount: u2 } = montar(dados({ estado: { ...dados().estado, catalogo: 'carregando' } }));
  expect(screen.getByRole('status', { name: 'Carregando a cobertura' })).toBeTruthy();
  u2();
  montar(dados({ catalogo: { revisao: 'r', empresas: [], agentes: [], servicos: [] } }));
  expect(screen.getByText('Nenhum serviço na configuração ativa')).toBeTruthy();
});
