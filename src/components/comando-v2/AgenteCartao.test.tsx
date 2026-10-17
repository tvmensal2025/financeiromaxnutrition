import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import AgenteCartao from './AgenteCartao';
import type { AgenteComando } from '@/integrations/comando-v2/tipos';

const agente: AgenteComando = { id: 'AGT-02', identidade: 'BIANCA', nome: 'Bianca Souza', cargo: 'Pessoas', grupo: 'Execução', estado: 'PAUSADO', fase: 'Fase 2' };
const servico = (n: number) => ({ id: `S${n}`, nome: `Serviço ${n}`, dono: 'BIANCA', revisor: 'HELENA', estado: 'ATIVO', empresas: [] });

it('mostra identidade, estado traduzido, fase e carga', () => {
  render(<ul><AgenteCartao agente={agente} carga={{ etapasAbertas: 3, revisoesPendentes: 1 }} servicos={[servico(1)]} /></ul>);
  expect(screen.getByText('Bianca Souza')).toBeTruthy();
  expect(screen.getByText('AGT-02 · BIANCA')).toBeTruthy();
  expect(screen.getByText('Configuração: Pausado')).toBeTruthy();
  expect(screen.getByText('Fase: Fase 2')).toBeTruthy();
  expect(screen.getByText('etapas abertas como autor').parentElement!.textContent).toContain('3');
  expect(screen.getByText('Serviço 1')).toBeTruthy();
});

it('carga nula aparece como indisponível, nunca zero, e resume serviços demais', () => {
  render(<ul><AgenteCartao agente={agente} carga={null} servicos={[1, 2, 3, 4, 5, 6].map(servico)} /></ul>);
  expect(screen.getAllByLabelText('indisponível')).toHaveLength(2);
  expect(screen.getByText('Carga indisponível: as etapas não foram lidas.')).toBeTruthy();
  expect(screen.getByText(/e mais 2/)).toBeTruthy();
});

it('estado de configuração desconhecido continua legível', () => {
  render(<ul><AgenteCartao agente={{ ...agente, estado: 'EM_VALIDACAO_NOVA', fase: undefined }} carga={{ etapasAbertas: 0, revisoesPendentes: 0 }} servicos={[]} /></ul>);
  expect(screen.getByText('Configuração: Em validacao nova')).toBeTruthy();
  expect(screen.queryByText(/^Fase:/)).toBeNull();
  expect(screen.getByText('Nenhum serviço no cadastro ativo.')).toBeTruthy();
});
