import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { EtapaV2, RepositorioCardsV2 } from '@/integrations/cards-v2/repository';
import { PerguntaFundadorV2 } from './PerguntaFundadorV2';

const etapa = { id: 'etapa-local', codigo: 'E1', nome: 'Pesquisa', estado: 'ESPERANDO_FUNDADOR',
  autor: 'Ravi', dono: 'FUNDADOR', prazo_ate: null, revisores: [], versao: 3,
  motivo: 'PERGUNTA', portao1_ok: false, entrega_fresca: false } satisfies EtapaV2;

it('oculta respostas quando não há pergunta atual comprovada', async () => {
  const repo = { lerPerguntaEtapaFundador: vi.fn().mockResolvedValue(null) } as unknown as RepositorioCardsV2;
  render(<PerguntaFundadorV2 etapa={etapa} cardId="card-local" identidade="fundador-local" repositorio={repo}
    onAtualizar={vi.fn()} />);
  expect(await screen.findByText(/pergunta atual não está disponível/)).toBeTruthy();
  expect(screen.queryByLabelText('Decisão do fundador')).toBeNull();
});

it('mostra texto e consequências reais antes de oferecer somente opções atuais', async () => {
  const repo = { lerPerguntaEtapaFundador: vi.fn().mockResolvedValue({ card_id: 'card-local', etapa_id: etapa.id,
    versao: 3, chave: 1, historico_id: 8, pergunta: 'Qual caminho observado?',
    opcoes: [{ letra: 'A', texto: 'Caminho A observado', consequencia: 'Retomar análise A' },
      { letra: 'B', texto: 'Caminho B observado', consequencia: 'Retomar análise B' }] }) } as unknown as RepositorioCardsV2;
  render(<PerguntaFundadorV2 etapa={etapa} cardId="card-local" identidade="fundador-local" repositorio={repo}
    onAtualizar={vi.fn()} />);
  expect(await screen.findByText('Qual caminho observado?')).toBeTruthy();
  expect(screen.getByText('Consequência: Retomar análise A')).toBeTruthy();
  const select = screen.getByLabelText('Decisão do fundador') as HTMLSelectElement;
  expect(Array.from(select.options).map(item => item.textContent)).toEqual(['Escolha uma ação', 'Responder A', 'Responder B']);
});

it.each([
  [[{ letra: 'A', texto: 'A', consequencia: 'Efeito A' }], 'uma opção'],
  [[{ letra: 'A', texto: 'A', consequencia: 'Efeito A' }, { letra: 'A', texto: 'B', consequencia: 'Efeito B' }], 'letra repetida'],
])('recusa pergunta com %s', async (opcoes) => {
  const repo = { lerPerguntaEtapaFundador: vi.fn().mockResolvedValue({ card_id: 'card-local', etapa_id: etapa.id,
    versao: 3, chave: 1, historico_id: 8, pergunta: 'Qual caminho observado?', opcoes }) } as unknown as RepositorioCardsV2;
  render(<PerguntaFundadorV2 etapa={etapa} cardId="card-local" identidade="fundador-local" repositorio={repo}
    onAtualizar={vi.fn()} />);
  expect(await screen.findByText(/pergunta atual não está disponível/)).toBeTruthy();
  expect(screen.queryByLabelText('Decisão do fundador')).toBeNull();
});
