import { render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import PlanoEvolucaoAba from './PlanoEvolucaoAba';
import { dadosDeTeste } from '@/integrations/comando-v2/dados-de-teste-execucao';
import type { DadosComando } from '@/integrations/comando-v2/tipos';

const montar = (dados: DadosComando) => render(<PlanoEvolucaoAba dados={dados} empresa="GRUPO" abrirCard={vi.fn()} />);
const coluna = (nome: string) => within(screen.getByRole('region', { name: nome }));

it('avisa que é lista de planejamento e não prova de operação', () => {
  montar(dadosDeTeste());
  expect(screen.getByText('Lista de planejamento, não prova de operação.')).toBeTruthy();
});

it('distribui o roteiro nas três colunas com o estado real de cada item', () => {
  montar(dadosDeTeste());
  expect(coluna('Pronto').getByText('Motor e banco da v2')).toBeTruthy();
  expect(coluna('Pronto').getByText('pronto, em teste')).toBeTruthy();
  const construcao = coluna('Em construção');
  expect(construcao.getByText('Hermes real com ChatGPT')).toBeTruthy();
  expect(construcao.getByText(/Ainda NÃO foi comprovada dentro de um card real/)).toBeTruthy();
  expect(construcao.getByText('construído, não comprovado em produção')).toBeTruthy();
  expect(construcao.getByText('Telegram para a v2')).toBeTruthy();
  expect(construcao.getByText('construído, webhook não ligado')).toBeTruthy();
  const planejado = coluna('Planejado');
  expect(planejado.getByText('Consumo real de tokens e custo')).toBeTruthy();
  expect(planejado.getByText('planejado, destino indefinido')).toBeTruthy();
  expect(planejado.getByText('Serviços em RASCUNHO')).toBeTruthy();
  expect(coluna('Pronto').queryByText('Telegram para a v2')).toBeNull();
});

it('agrupa os agentes do catálogo por fase e por estado', () => {
  montar(dadosDeTeste());
  const fase1 = within(document.querySelector('[data-fase="1"]') as HTMLElement);
  expect(fase1.getByText('Fase 1')).toBeTruthy();
  expect(fase1.getByText('2 agentes')).toBeTruthy();
  expect(fase1.getByText('Em estágio: 2')).toBeTruthy();
  expect(fase1.getByText('Helena (em estágio)')).toBeTruthy();
  const fase2 = within(document.querySelector('[data-fase="2"]') as HTMLElement);
  expect(fase2.getByText('Rascunho: 1')).toBeTruthy();
  const semFase = within(document.querySelector('[data-fase="Sem fase informada"]') as HTMLElement);
  expect(semFase.getByText('Pausado: 1')).toBeTruthy();
});

it('erro do catálogo não vira "nenhum agente" e o roteiro fixo continua visível', () => {
  const dados = dadosDeTeste();
  dados.estado.catalogo = 'erro';
  dados.catalogo.agentes = [];
  montar(dados);
  expect(screen.getByText('Não foi possível ler os agentes')).toBeTruthy();
  expect(screen.queryByText('Nenhum agente no catálogo')).toBeNull();
  expect(screen.getByText('Motor e banco da v2')).toBeTruthy();
});

it('carregando e vazio de verdade são mostrados de forma diferente', () => {
  const lendo = dadosDeTeste();
  lendo.estado.catalogo = 'carregando';
  const { unmount } = montar(lendo);
  expect(screen.getByRole('status', { name: 'Carregando agentes do catálogo' })).toBeTruthy();
  unmount();
  const vazio = dadosDeTeste();
  vazio.catalogo.agentes = [];
  montar(vazio);
  expect(screen.getByText('Nenhum agente no catálogo')).toBeTruthy();
});
