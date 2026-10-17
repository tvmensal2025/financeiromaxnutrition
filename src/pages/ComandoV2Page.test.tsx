import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import ComandoV2Page, { type CarregadoresAbas } from './ComandoV2Page';
import { ABAS, dadosVazios, type DadosComando, type PropsAba, type ResultadoDadosComando } from '@/integrations/comando-v2/tipos';

vi.mock('@/auth', () => ({ useAuth: () => ({ user: { id: 'fundador-a' }, isFounder: true }) }));

const CHAVE = 'helena_v2_comando_empresa';

function dadosProntos(parcial: Partial<DadosComando> = {}): DadosComando {
  const base = dadosVazios(new Date('2026-10-17T15:00:00Z'));
  return {
    ...base,
    catalogo: {
      revisao: 'rev-1',
      empresas: [{ id: 'BIZ-001', nome: 'iGreen', pacote: 'CONFIRMADO' }, { id: 'BIZ-003', nome: 'Humano Digital', pacote: 'CONFIRMADO' }],
      agentes: [], servicos: [],
    },
    estado: { cards: 'pronta', etapas: 'pronta', entregas: 'pronta', pedidos: 'pronta', catalogo: 'pronta' },
    ...parcial,
  };
}
function resultado(parcial: Partial<ResultadoDadosComando> = {}): ResultadoDadosComando {
  return { dados: dadosProntos(), carregando: false, atualizadoEm: new Date('2026-10-17T15:05:00Z'), recarregar: vi.fn(), ...parcial };
}

/** Aba falsa: mostra a empresa e o total de cards que recebeu e um botão que chama abrirCard. */
function AbaFalsa({ dados, empresa, abrirCard }: PropsAba) {
  return <div>
    <p>Conteúdo da aba falsa</p>
    <p>empresa={empresa}</p>
    <p>cards={dados.cards.length}</p>
    <button type="button" onClick={() => abrirCard('card-1')}>Abrir card 1</button>
  </div>;
}
const carregadores = (...arquivos: string[]): CarregadoresAbas =>
  Object.fromEntries(arquivos.map(arquivo => [`./comando-v2/abas/${arquivo}.tsx`, async () => ({ default: AbaFalsa })]));

function Local() { const { pathname, search } = useLocation(); return <output data-testid="local">{pathname}{search}</output>; }
function montar(resultadoHook: ResultadoDadosComando, abas: CarregadoresAbas = carregadores('VisaoGeralAba'), inicial = '/comando') {
  const usarDados = () => resultadoHook;
  return render(<MemoryRouter initialEntries={[inicial]}>
    <Routes>
      <Route path="/comando" element={<><ComandoV2Page usarDados={usarDados} carregadoresAbas={abas} /><Local /></>} />
      <Route path="/cards" element={<><p>quadro de cards</p><Local /></>} />
    </Routes>
  </MemoryRouter>);
}
const local = () => screen.getByTestId('local').textContent;

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('cabeçalho', () => {
  it('mostra título, hora de São Paulo e atualiza pelo botão', () => {
    const r = resultado();
    montar(r, {});
    expect(screen.getByRole('heading', { level: 1, name: 'Sala de comando' })).toBeInTheDocument();
    expect(screen.getByText('Atualizado às 12:05')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(r.recarregar).toHaveBeenCalledTimes(1);
    for (const botao of screen.getAllByRole('button')) expect(botao.className).toMatch(/min-h-11/);
  });

  it('não inventa hora enquanto não houve leitura', () => {
    montar(resultado({ atualizadoEm: null, carregando: true }), {});
    expect(screen.getByText('Carregando dados…')).toBeInTheDocument();
    expect(screen.queryByText(/Atualizado às/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Atualizar' })).toBeDisabled();
  });
});

describe('abas', () => {
  it('abre a visão geral por padrão e carrega a aba com dados, empresa e abrirCard', async () => {
    const dados = dadosProntos({ cards: [{ id: 'card-1', titulo: 'A', empresa: 'BIZ-001', estado: 'EM_ANDAMENTO', dono: 'Helena', prazo: '2026-10-19T12:00:00Z', criado_em: '2026-10-17T12:00:00Z', atualizado_em: null, prazo_ate: null, prioridade: null }] });
    montar(resultado({ dados }));
    expect(screen.getByRole('status', { name: /Abrindo Visão geral/ })).toBeInTheDocument();
    expect(await screen.findByText('Conteúdo da aba falsa')).toBeInTheDocument();
    expect(screen.getByText('empresa=GRUPO')).toBeInTheDocument();
    expect(screen.getByText('cards=1')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Visão geral' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir card 1' }));
    expect(screen.getByText('quadro de cards')).toBeInTheDocument();
    expect(local()).toBe('/cards?card=card-1');
  });

  it('aba sem arquivo mostra "em construção" e não quebra a navegação', () => {
    montar(resultado(), {}, '/comando?aba=cards');
    expect(screen.getByText('Esta aba está em construção')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Cards' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Processo' }));
    expect(local()).toBe('/comando?aba=processo');
    expect(screen.getByRole('tab', { name: 'Processo' })).toHaveAttribute('aria-selected', 'true');
  });

  it('aba inválida na URL cai na visão geral', () => {
    montar(resultado(), {}, '/comando?aba=nao-existe');
    expect(screen.getByRole('tab', { name: 'Visão geral' })).toHaveAttribute('aria-selected', 'true');
  });

  it('lista só as abas visíveis na barra e as demais no menu Mais', async () => {
    montar(resultado(), carregadores('VisaoGeralAba', 'ExecucaoAba'));
    const barra = screen.getByRole('tablist', { name: 'Abas da Sala de comando' });
    expect(within(barra).getAllByRole('tab').map(tab => tab.textContent)).toEqual(ABAS.filter(aba => aba.visivel).map(aba => aba.rotulo));
    expect(within(barra).queryByRole('tab', { name: 'Execução' })).toBeNull();
    const mais = screen.getByRole('button', { name: 'Mais abas' });
    fireEvent.keyDown(mais, { key: 'Enter' });
    const itens = await screen.findAllByRole('menuitemradio');
    expect(itens.map(item => item.textContent)).toEqual(ABAS.filter(aba => !aba.visivel).map(aba => aba.rotulo));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Execução' }));
    expect(local()).toBe('/comando?aba=execucao');
    expect(await screen.findByText('Conteúdo da aba falsa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mais abas (aberta: Execução)' })).toBeInTheDocument();
    expect(screen.getByRole('tabpanel', { name: 'Execução' })).toBeInTheDocument();
  });

  it('setas, Home e End navegam entre as abas visíveis', () => {
    montar(resultado(), {});
    const visiveis = ABAS.filter(aba => aba.visivel);
    const primeira = screen.getByRole('tab', { name: visiveis[0].rotulo });
    expect(primeira).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: visiveis[1].rotulo })).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(primeira, { key: 'ArrowRight' });
    const segunda = screen.getByRole('tab', { name: visiveis[1].rotulo });
    expect(segunda).toHaveAttribute('aria-selected', 'true');
    expect(segunda).toHaveFocus();
    fireEvent.keyDown(segunda, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: visiveis[0].rotulo })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('tab', { name: visiveis[0].rotulo }), { key: 'ArrowLeft' });
    const ultima = screen.getByRole('tab', { name: visiveis[visiveis.length - 1].rotulo });
    expect(ultima).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(ultima, { key: 'Home' });
    expect(screen.getByRole('tab', { name: visiveis[0].rotulo })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: visiveis[0].rotulo }), { key: 'End' });
    expect(screen.getByRole('tab', { name: visiveis[visiveis.length - 1].rotulo })).toHaveAttribute('aria-selected', 'true');
  });

  it('uma aba que quebra não derruba o cabeçalho nem as outras abas', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const quebrada: CarregadoresAbas = { './comando-v2/abas/VisaoGeralAba.tsx': async () => ({ default: () => { throw new Error('falhou'); } }) };
    montar(resultado(), quebrada);
    expect(await screen.findByText('Não foi possível abrir a aba Visão geral')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Sala de comando' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Cards' }));
    expect(screen.getByText('Esta aba está em construção')).toBeInTheDocument();
    erro.mockRestore();
  });
});

describe('empresa', () => {
  it('lista o grupo e as empresas do catálogo, repassa a escolha e a guarda no navegador', async () => {
    montar(resultado());
    const seletor = screen.getByLabelText('Empresa');
    expect(within(seletor).getAllByRole('option').map(o => o.textContent)).toEqual(['Grupo consolidado', 'iGreen', 'Humano Digital']);
    fireEvent.change(seletor, { target: { value: 'BIZ-003' } });
    expect(await screen.findByText('empresa=BIZ-003')).toBeInTheDocument();
    expect(window.localStorage.getItem(CHAVE)).toBe('BIZ-003');
  });

  it('lembra a empresa salva e volta ao grupo se ela não existe mais no catálogo', async () => {
    window.localStorage.setItem(CHAVE, 'BIZ-003');
    const primeiro = montar(resultado());
    expect(await screen.findByText('empresa=BIZ-003')).toBeInTheDocument();
    primeiro.unmount();
    window.localStorage.setItem(CHAVE, 'BIZ-999');
    montar(resultado());
    expect(await screen.findByText('empresa=GRUPO')).toBeInTheDocument();
    expect(window.localStorage.getItem(CHAVE)).toBe('BIZ-999');
  });

  it('enquanto o catálogo carrega, mantém a empresa salva (não troca por grupo)', async () => {
    window.localStorage.setItem(CHAVE, 'BIZ-003');
    montar(resultado({ dados: dadosVazios(), carregando: true, atualizadoEm: null }));
    expect(await screen.findByText('empresa=BIZ-003')).toBeInTheDocument();
  });

  it('funciona sem localStorage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    montar(resultado());
    expect(await screen.findByText('empresa=GRUPO')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Empresa'), { target: { value: 'BIZ-001' } });
    expect(await screen.findByText('empresa=BIZ-001')).toBeInTheDocument();
  });
});

describe('avisos', () => {
  it('leitura de cards ou catálogo com erro mostra aviso com "Tentar de novo" e mantém as abas', () => {
    const r = resultado({ dados: dadosProntos({ estado: { cards: 'erro', etapas: 'pronta', entregas: 'pronta', pedidos: 'pronta', catalogo: 'erro' } }) });
    montar(r, {});
    const aviso = screen.getByRole('alert');
    expect(aviso).toHaveTextContent('os cards');
    expect(aviso).toHaveTextContent('o catálogo de empresas e agentes');
    expect(screen.getAllByRole('tab').length).toBeGreaterThan(3);
    fireEvent.click(within(aviso).getByRole('button', { name: 'Tentar de novo' }));
    expect(r.recarregar).toHaveBeenCalledTimes(1);
  });

  it('sem erro não mostra o aviso; com amostra avisa que os números podem estar abaixo do total', () => {
    const limpo = montar(resultado(), {});
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/Amostra:/)).toBeNull();
    limpo.unmount();
    montar(resultado({ dados: dadosProntos({ amostra: true }) }), {});
    expect(screen.getByText(/Amostra:/)).toBeInTheDocument();
  });
});

describe('atualização automática', () => {
  const ocultar = (oculto: boolean) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => oculto });
    document.dispatchEvent(new Event('visibilitychange'));
  };
  afterEach(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); });

  it('chama recarregar a cada 30 s, pausa com a aba oculta e limpa ao desmontar', () => {
    vi.useFakeTimers();
    const r = resultado();
    const tela = montar(r, {});
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(r.recarregar).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(r.recarregar).toHaveBeenCalledTimes(2);

    act(() => ocultar(true));
    act(() => { vi.advanceTimersByTime(120_000); });
    expect(r.recarregar).toHaveBeenCalledTimes(2);

    act(() => ocultar(false));
    expect(r.recarregar).toHaveBeenCalledTimes(3);
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(r.recarregar).toHaveBeenCalledTimes(4);

    tela.unmount();
    act(() => { vi.advanceTimersByTime(120_000); });
    expect(r.recarregar).toHaveBeenCalledTimes(4);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('não empilha leituras: pula o ciclo enquanto a anterior ainda carrega', () => {
    vi.useFakeTimers();
    const r = resultado({ carregando: true });
    montar(r, {});
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(r.recarregar).not.toHaveBeenCalled();
  });
});
