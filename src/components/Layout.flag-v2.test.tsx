// Prova o menu lateral (Layout) diante da flag VITE_HELENA_V2_HABILITADA:
// 'Cards v2' só aparece com a flag exatamente 'true'; 'Configuração da Helena v2'
// exige a flag E ser fundador. O Layout lê a flag na importação do módulo (lista de
// Operação), por isso cada caso faz vi.resetModules() + import dinâmico.
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

// resetModules + import dinâmico recarregam o Layout (e ícones) a cada caso; sob carga isso passa de 5 s.
vi.setConfig({ testTimeout: 30_000 });

const auth = vi.hoisted(() => ({ isFounder: false }));
vi.mock('@/auth', () => ({ useAuth: () => ({ isFounder: auth.isFounder, user: { id: 'u1' }, role: auth.isFounder ? 'founder' : 'member' }) }));
vi.mock('@/contexts/BusinessContext', () => ({ useBusiness: () => ({ currentBusiness: null, isConsolidated: true, error: null }) }));
vi.mock('@/components/Header', () => ({ Header: () => <div data-testid="cabecalho" /> }));
vi.mock('@/components/executive/ExecutiveBusinessSwitcher', () => ({ ExecutiveBusinessSwitcher: () => <div data-testid="seletor-empresa" /> }));
vi.mock('@/components/executive/ExecutiveCommandMenu', () => ({ ExecutiveCommandMenu: () => null }));

async function abrirMenu(flag: string | undefined, fundador: boolean) {
  vi.stubEnv('VITE_HELENA_V2_HABILITADA', flag);
  auth.isFounder = fundador;
  vi.resetModules();
  const { Layout } = await import('./Layout');
  render(<MemoryRouter initialEntries={['/']}><Layout /></MemoryRouter>);
  // O menu aparece duas vezes (barra fixa e gaveta do celular, ambas no DOM).
  // Abre cada grupo uma única vez para não alternar o estado compartilhado.
  for (const grupo of ['Operação', 'Administração']) {
    fireEvent.click(screen.getAllByRole('button', { name: grupo })[0]);
  }
}
const links = (nome: string) => screen.queryAllByRole('link', { name: nome });

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe('menu com a flag v2 desligada', () => {
  it.each([['"false"', 'false'], ['vazia', ''], ['ausente', undefined], ['"TRUE"', 'TRUE'], ['"1"', '1']] as [string, string | undefined][])(
    'com a flag %s o menu não mostra Cards v2 nem Configuração da Helena v2, nem para o fundador', async (_rotulo, valor) => {
      await abrirMenu(valor, true);
      // Controles positivos: os grupos foram de fato abertos e o resto do menu existe.
      expect(links('Entregas da equipe').length).toBeGreaterThan(0);
      expect(links('Configurações').length).toBeGreaterThan(0);
      expect(links('Cards v2')).toHaveLength(0);
      expect(links('Configuração da Helena v2')).toHaveLength(0);
      expect(document.querySelector('a[href="/cards-v2"]')).toBeNull();
      expect(document.querySelector('a[href="/configuracoes-v2"]')).toBeNull();
    });
});

describe('menu com a flag v2 exatamente "true"', () => {
  it('membro vê Cards v2, mas não vê Configuração da Helena v2', async () => {
    await abrirMenu('true', false);
    expect(links('Entregas da equipe').length).toBeGreaterThan(0);
    expect(links('Configurações').length).toBeGreaterThan(0);
    const cards = links('Cards v2');
    expect(cards.length).toBeGreaterThan(0);
    cards.forEach(link => expect(link).toHaveAttribute('href', '/cards-v2'));
    expect(links('Configuração da Helena v2')).toHaveLength(0);
    expect(document.querySelector('a[href="/configuracoes-v2"]')).toBeNull();
  });

  it('fundador vê Cards v2 e Configuração da Helena v2', async () => {
    await abrirMenu('true', true);
    const cards = links('Cards v2');
    const config = links('Configuração da Helena v2');
    expect(cards.length).toBeGreaterThan(0);
    expect(config.length).toBeGreaterThan(0);
    cards.forEach(link => expect(link).toHaveAttribute('href', '/cards-v2'));
    config.forEach(link => expect(link).toHaveAttribute('href', '/configuracoes-v2'));
  });

  it('Cards v2 fica no grupo Operação e Configuração da Helena v2 no grupo Administração', async () => {
    await abrirMenu('true', true);
    const grupoDe = (nome: string) => screen.getAllByRole('button', { name: nome })[0].closest('.he-nav-group') as HTMLElement;
    expect(grupoDe('Operação').querySelector('a[href="/cards-v2"]')).not.toBeNull();
    expect(grupoDe('Operação').querySelector('a[href="/configuracoes-v2"]')).toBeNull();
    expect(grupoDe('Administração').querySelector('a[href="/configuracoes-v2"]')).not.toBeNull();
    expect(grupoDe('Administração').querySelector('a[href="/cards-v2"]')).toBeNull();
  });
});
