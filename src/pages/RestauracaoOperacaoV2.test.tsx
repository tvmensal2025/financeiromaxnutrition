import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import EquipeV2Page from './EquipeV2Page';
import OperacaoV2Page from './OperacaoV2Page';
import IntegracoesV2Page from './IntegracoesV2Page';
import ConversaV2Page from './ConversaV2Page';
import GovernancaV2Page from './GovernancaV2Page';
import type { RepositorioConfigV2, ConfigDetail } from '@/integrations/config-v2/repository';
import type { CardV2, RepositorioCardsV2 } from '@/integrations/cards-v2/repository';
import type { RepositorioGovernancaV2 } from '@/integrations/operacao-v2/governanca';

const auth = vi.hoisted(() => ({ id: 'fundador-a', founder: true }));
vi.mock('@/auth', () => ({ useAuth: () => ({ user: { id: auth.id }, isFounder: auth.founder }) }));
vi.mock('./PareamentoTelegramV2', () => ({ PareamentoTelegramV2: ({ identidade }: { identidade: string }) => <p>pareamento:{identidade}</p> }));
vi.mock('./EntradaPedidosV2', () => ({ EntradaPedidosV2: ({ identidade }: { identidade: string }) => <p>entrada:{identidade}</p> }));

const detalhe: ConfigDetail = { id: 'rev-1', nome: 'Revisão atual', versao: 7, estado: 'VALIDADA', ativa: true,
  tecnica: false, hash_sha256: 'hash-7', criada_em: '', validada_em: '', aposentada_em: null,
  conteudo: { 'helena-v2/organograma.yaml': { agentes: [
    { id: 'AGT-01', nome: 'Helena', cargo: 'Coordenação', estado: 'ATIVO', grupo: 'COORDENACAO', escopo: 'EMPRESAS' },
    { id: 'AGT-02', nome: 'Laura', cargo: 'Pessoal', estado: 'PAUSADO', escopo: 'PESSOAL' },
  ] }, 'helena-v2/servicos.yaml': { servicos: [{ id: 'SRV-CALCULO', nome: 'Cálculo', dono: 'CAIO', revisor: 'HELENA', estado: 'ESTAGIO', empresas: ['BIZ-003'] }] } } };
function config(): RepositorioConfigV2 {
  return { listar: vi.fn().mockResolvedValue([{ ...detalhe }]), ler: vi.fn().mockResolvedValue(detalhe) } as unknown as RepositorioConfigV2;
}
const card: CardV2 = { id: 'card-a', titulo: 'Análise Humano Digital', empresa: 'BIZ-003', estado: 'EM_ANDAMENTO',
  dono: 'Helena', prazo: '2026-10-20', criado_em: '2026-10-17T00:00:00Z', versao: 3 };
function cards(): RepositorioCardsV2 {
  return { listar: vi.fn().mockResolvedValue([card, { ...card, id: 'card-b', titulo: 'Aprovação', estado: 'ESPERANDO_FUNDADOR' }]),
    detalhar: vi.fn().mockResolvedValue({ etapas: [{ id: 'etapa-a', codigo: 'A', nome: 'Conferência', estado: 'APROVADA', autor: 'CAIO', dono: 'CAIO', prazo_ate: null, revisores: ['HELENA'], versao: 2, portao1_ok: true, entrega_fresca: true }],
      entregas: [{ id: 1, etapa_id: 'etapa-a', versao: 2, portao1: 'PASSOU', conteudo: { resultado: 'aprovado' }, criada_em: '' }] }) } as unknown as RepositorioCardsV2;
}
function governanca(): RepositorioGovernancaV2 {
  return { checkpoint: vi.fn().mockResolvedValue({ id: 'CP-ATUAL', versao: '38', estado: 'ATIVO', atualizadoEm: null }),
    decisoes: vi.fn().mockResolvedValue([{ id: 'DEC-023', estado: 'VIGENTE', escopo: 'GRUPO', data: null }]) };
}
function montar(path: string, page: JSX.Element) { return render(<MemoryRouter initialEntries={[path]}>{page}</MemoryRouter>); }
beforeEach(() => { auth.id = 'fundador-a'; auth.founder = true; });
afterEach(() => cleanup());

it('equipe mostra nomes e estados da revisão ativa, sem anunciar runtime', async () => {
  const repo = config();
  montar('/equipe', <EquipeV2Page repositorio={repo} />);
  expect(await screen.findByText('Revisão atual')).toBeTruthy();
  expect(screen.getByText('Helena')).toBeTruthy();
  expect(screen.getByText('Laura')).toBeTruthy();
  expect(screen.getByText('Cálculo')).toBeTruthy();
  expect(screen.getAllByText(/runtime não verificado/i)).toHaveLength(2);
  expect(repo.ler).toHaveBeenCalledWith('rev-1');
});

it.each(['execucao', 'entregas', 'consumo', 'cobertura', 'supervisao'] as const)('área /%s lê cards v2 e explica sua fonte', async secao => {
  const repo = cards();
  montar(`/${secao}`, <OperacaoV2Page repositorio={repo} />);
  expect(await screen.findByText(/Fonte: cards v2 consultados/)).toBeTruthy();
  expect(repo.listar).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('link', { name: 'Execução' }).getAttribute('href')).toBe('/execucao');
  if (secao === 'consumo') {
    expect(screen.getByText(/não fornece medição de tokens/)).toBeTruthy();
    expect(screen.queryByText('Análise Humano Digital')).toBeNull();
  } else {
    expect(screen.getByText('Análise Humano Digital')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Ver etapas' })[0]);
    expect(await screen.findByText('Entrega aprovada disponível no card')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Abrir card' })[0].getAttribute('href')).toBe('/cards?card=card-a');
  }
});

it('falha de cards não vira zero e retry consulta novamente', async () => {
  const repo = cards();
  vi.mocked(repo.listar).mockRejectedValueOnce(new Error('offline'));
  montar('/supervisao', <OperacaoV2Page repositorio={repo} />);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Não foi possível consultar os cards. Tente atualizar.');
  expect(screen.queryByText('Cards consultados')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
  expect(await screen.findByText('Cards consultados')).toBeTruthy();
  expect(repo.listar).toHaveBeenCalledTimes(2);
});

it('membro não consulta as fontes reservadas e troca de sessão descarta resposta antiga', async () => {
  const repoCards = cards(), repoConfig = config(), repoGov = governanca();
  auth.founder = false;
  const membro = montar('/equipe', <EquipeV2Page repositorio={repoConfig} />);
  expect(screen.getByText(/somente para o fundador/)).toBeTruthy();
  membro.rerender(<MemoryRouter initialEntries={['/execucao']}><OperacaoV2Page repositorio={repoCards} /></MemoryRouter>);
  membro.rerender(<MemoryRouter initialEntries={['/comando']}><GovernancaV2Page repositorio={repoGov} repositorioConfig={repoConfig} /></MemoryRouter>);
  expect(repoConfig.listar).not.toHaveBeenCalled();
  expect(repoCards.listar).not.toHaveBeenCalled();
  expect(repoGov.checkpoint).not.toHaveBeenCalled();
  membro.unmount();

  auth.founder = true;
  let resolver!: (valor: CardV2[]) => void;
  vi.mocked(repoCards.listar).mockImplementationOnce(() => new Promise(resolve => { resolver = resolve; })).mockResolvedValueOnce([]);
  const pagina = () => <MemoryRouter initialEntries={['/execucao']}><OperacaoV2Page repositorio={repoCards}/></MemoryRouter>;
  const tela = render(pagina());
  auth.id = 'fundador-b'; tela.rerender(pagina());
  await act(async () => resolver([card]));
  expect(await screen.findByText('Nenhum card encontrado nesta consulta.')).toBeTruthy();
  expect(screen.queryByText('Análise Humano Digital')).toBeNull();
});

it('governança lê checkpoint antes das demais fontes e isola falha de decisões', async () => {
  const ordem: string[] = [];
  const repo = governanca(), cfg = config();
  vi.mocked(repo.checkpoint).mockImplementation(async () => { ordem.push('checkpoint'); return { id: 'CP-ATUAL', versao: '38', estado: 'ATIVO', atualizadoEm: null }; });
  vi.mocked(repo.decisoes).mockImplementation(async () => { ordem.push('decisoes'); throw new Error('offline'); });
  vi.mocked(cfg.listar).mockImplementation(async () => { ordem.push('config'); return [detalhe]; });
  montar('/comando', <GovernancaV2Page repositorio={repo} repositorioConfig={cfg} />);
  expect(await screen.findByText('CP-ATUAL')).toBeTruthy();
  expect(await screen.findByText('Não foi possível consultar as decisões.')).toBeTruthy();
  expect(await screen.findByText('Revisão atual', { exact: false })).toBeTruthy();
  expect(ordem[0]).toBe('checkpoint');
  expect(screen.queryByText('DEC-023')).toBeNull();
});

it('integrações e conversa usam componentes v2 com identidade da sessão e vedam membro', () => {
  const tela = montar('/integracoes', <IntegracoesV2Page/>);
  expect(screen.getByText('pareamento:fundador-a')).toBeTruthy();
  tela.rerender(<MemoryRouter initialEntries={['/conversa']}><ConversaV2Page/></MemoryRouter>);
  expect(screen.getByText('entrada:fundador-a')).toBeTruthy();
  auth.founder = false;
  tela.rerender(<MemoryRouter initialEntries={['/integracoes']}><IntegracoesV2Page/></MemoryRouter>);
  expect(screen.queryByText('pareamento:fundador-a')).toBeNull();
  tela.rerender(<MemoryRouter initialEntries={['/conversa']}><ConversaV2Page/></MemoryRouter>);
  expect(screen.queryByText('entrada:fundador-a')).toBeNull();
});
