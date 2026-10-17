// Prova a navegação v2 para membro/fundador, alvo de toque e saída.
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { Layout } from './Layout';
import { MODULOS } from '@/lib/modulos';
import { gruposNavegacao } from '@/lib/navegacao';
vi.mock('@/components/executive/ExecutiveBusinessSwitcher', () => ({ ExecutiveBusinessSwitcher: () => <span>Empresa selecionada</span> }));

const auth = vi.hoisted(() => ({ isFounder: false, sair: vi.fn() }));
vi.mock('@/auth', () => ({
  useAuth: () => ({ isFounder: auth.isFounder, user: { id: 'u1', email: 'pessoa@exemplo.com' }, role: auth.isFounder ? 'founder' : 'member', sair: auth.sair }),
}));

function abrir(fundador: boolean, caminho = '/') {
  auth.isFounder = fundador;
  auth.sair.mockReset().mockResolvedValue(undefined);
  render(<MemoryRouter initialEntries={[caminho]}>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<p>conteúdo da visão geral</p>} />
        <Route path="/cards" element={<p>conteúdo dos cards</p>} />
        <Route path="/configuracoes" element={<p>conteúdo da configuração</p>} />
      </Route>
    </Routes>
  </MemoryRouter>);
}
const links = (nome: string) => screen.queryAllByRole('link', { name: nome });

afterEach(() => cleanup());

describe('menu da v2', () => {
  it('membro vê Visão geral e Cards, sem Configuração, e o conteúdo abre dentro da casca', () => {
    abrir(false);
    expect(links('Visão geral')).toHaveLength(1);
    expect(links('Visão geral')[0]).toHaveAttribute('href', '/');
    expect(links('Cards')).toHaveLength(1);
    expect(links('Cards')[0]).toHaveAttribute('href', '/cards');
    expect(links('Configuração')).toHaveLength(0);
    expect(document.querySelector('a[href="/configuracoes"]')).toBeNull();
    expect(screen.getByText('conteúdo da visão geral')).toBeInTheDocument();
    expect(screen.getByText('pessoa@exemplo.com')).toBeInTheDocument();
  });

  it('fundador vê Visão geral, Cards e Configuração', () => {
    abrir(true);
    expect(links('Visão geral')[0]).toHaveAttribute('href', '/');
    expect(links('Cards')[0]).toHaveAttribute('href', '/cards');
    expect(links('Configuração')).toHaveLength(1);
    expect(links('Configuração')[0]).toHaveAttribute('href', '/configuracoes');
  });

  it('o menu recupera páginas de negócio e todos os módulos do catálogo têm um destino', () => {
    abrir(true);
    expect(links('Financeiro')[0]).toHaveAttribute('href', '/financeiro');
    expect(links('CRM')[0]).toHaveAttribute('href', '/crm');
    const destinos = gruposNavegacao(true).flatMap(grupo => grupo.itens.map(item => item.to));
    for (const modulo of MODULOS) expect(destinos).toContain(modulo.rota || `/modulo/${modulo.tabela}`);
  });

  it('busca encontra módulo de grupo fechado e limpar restaura o menu', () => {
    abrir(true);
    fireEvent.change(screen.getByLabelText('Buscar página ou módulo'), { target: { value: 'memoria' } });
    expect(links('Memória Mestre')[0]).toHaveAttribute('href', '/modulo/memoria_mestre');
    expect(links('Financeiro')).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Buscar página ou módulo'), { target: { value: '' } });
    expect(links('Financeiro')).toHaveLength(1);
  });

  it('menu móvel abre e fecha com Escape e restaura foco', () => {
    abrir(true);
    const abrirMenu = screen.getByRole('button', { name: 'Abrir menu' });
    fireEvent.click(abrirMenu);
    expect(abrirMenu).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(abrirMenu).toHaveAttribute('aria-expanded', 'false');
    expect(abrirMenu).toHaveFocus();
  });

  it('o link ativo é marcado conforme a rota', () => {
    abrir(true, '/configuracoes');
    expect(links('Configuração')[0]).toHaveAttribute('aria-current', 'page');
    expect(links('Cards')[0]).not.toHaveAttribute('aria-current');
    expect(links('Visão geral')[0]).not.toHaveAttribute('aria-current');
    expect(screen.getByText('conteúdo da configuração')).toBeInTheDocument();
  });

  it('destaca Cards em /cards e mantém as três opções alcançáveis no menu compacto', () => {
    abrir(true, '/cards');
    expect(links('Cards')[0]).toHaveAttribute('aria-current', 'page');
    expect(links('Visão geral')[0]).not.toHaveAttribute('aria-current');
    expect(screen.getByText('conteúdo dos cards')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Seções do Sistema Helena' });
    expect(nav).toHaveClass('min-w-0');
    for (const nome of ['Visão geral', 'Cards', 'Configuração']) {
      expect(links(nome)[0]).toHaveClass('min-w-0', 'min-h-11');
    }
  });

  it('Sair chama a saída da sessão uma vez', () => {
    abrir(false);
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(auth.sair).toHaveBeenCalledTimes(1);
  });

  it('todo botão e link da casca declara alvo de toque (min-h-11)', () => {
    abrir(true);
    const controles = Array.from(document.querySelectorAll('nav a, header button'));
    expect(controles.length).toBeGreaterThanOrEqual(3);
    controles.forEach(el => expect(el.getAttribute('class') ?? '').toMatch(/(?:^|\s)min-h-11(?:\s|$)/));
  });

  it('tem o atalho para o conteúdo principal', () => {
    abrir(false);
    expect(screen.getByRole('link', { name: 'Ir para o conteúdo' })).toHaveAttribute('href', '#conteudo-principal');
    expect(document.getElementById('conteudo-principal')).not.toBeNull();
  });
});
