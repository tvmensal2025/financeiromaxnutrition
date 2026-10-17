// Verificação de CÓDIGO-FONTE, não de layout: o jsdom não mede pixels, então este teste
// NÃO prova nada sobre 360 px (isso segue NÃO COMPROVADO até haver navegador real).
// Ele lê as classes dos botões/links/abas renderizados por CardV2Page e ConfiguracoesV2Page
// e procura a classe de alvo de toque (min-h-11, h-11... sem prefixo responsivo):
//  - TODO botão, link e aba renderizado por essas páginas precisa declarar a classe;
//  - controle novo sem ela faz o teste falhar (não há mais lista de exceções).
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CardV2Page from './CardV2Page';
import ConfiguracoesV2Page from './ConfiguracoesV2Page';
import type { RepositorioCardsV2 } from '@/integrations/cards-v2/repository';
import type { ConfigDetail, RepositorioConfigV2 } from '@/integrations/config-v2/repository';

configure({ asyncUtilTimeout: 15_000 });

const auth = vi.hoisted(() => ({ isFounder: true, userId: 'fundador-1' }));
vi.mock('@/auth', () => ({ useAuth: () => ({ isFounder: auth.isFounder, user: { id: auth.userId } }) }));
vi.mock('./EntradaPedidosV2', () => ({ EntradaPedidosV2: () => null }));

const ALVO_DE_TOQUE = /(?:^|\s)(?:min-h|h|size)-(?:11|12|14)(?:\s|$)/;
const CONTROLES = 'button, a[href], [role="tab"], [role="button"]';

type Controle = { nome: string; ok: boolean };
function inventario(): Controle[] {
  return Array.from(document.body.querySelectorAll(CONTROLES)).map(el => {
    const texto = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
    return { nome: `${el.tagName.toLowerCase()} "${texto}"`, ok: ALVO_DE_TOQUE.test(el.getAttribute('class') ?? '') };
  });
}
const semAlvo = () => inventario().filter(c => !c.ok).map(c => c.nome).sort();
const comAlvo = () => inventario().filter(c => c.ok).map(c => c.nome).sort();

const card = { id: 'c1', titulo: 'Card em andamento', empresa: null, estado: 'EM_ANDAMENTO', dono: 'Helena', prazo: '2026-10-20', criado_em: '2026-10-12T12:00:00Z', versao: 2, motivo: 'NENHUM' };
const etapa = (id: string, codigo: string, motivo: string) => ({ id, codigo, nome: `Etapa ${codigo}`, estado: 'ESPERANDO_FUNDADOR', autor: 'Clara', dono: null, prazo_ate: null, revisores: ['Helena'], versao: 3, portao1_ok: true, entrega_fresca: true, motivo });
const campos = Object.fromEntries(Array.from({ length: 121 }, (_, i) => [`campo_${i}`, `valor ${i}`]));
function repoCards(parcial: Partial<RepositorioCardsV2> = {}): RepositorioCardsV2 {
  return {
    listar: vi.fn().mockResolvedValue([card]),
    detalhar: vi.fn().mockResolvedValue({
      etapas: [etapa('e1', 'E1', 'REVISAO'), etapa('e2', 'E2', 'PERGUNTA')],
      entregas: [{ id: 1, etapa_id: 'e1', versao: 1, portao1: 'PASSOU', conteudo: campos, criada_em: '2026-10-13T12:00:00Z' }],
      acoes: [{ id: 'a1', codigo: 'A1', etapa_codigo: 'E1', estado: 'PROPOSTA', tipo: 'PUBLICAR_POST', versao: 1, tem_ferramenta: true }],
      ordem: null,
    }),
    situacaoPublicacao: vi.fn().mockResolvedValue({ fundador: true, dia_brasilia: '2026-10-13', pedido: null }),
    pedirPublicacao: vi.fn(),
    solicitarCardReal: vi.fn(),
    consultarSolicitacaoPorChave: vi.fn().mockResolvedValue(null),
    listarSolicitacoesReais: vi.fn().mockResolvedValue([]),
    consultarSolicitacaoPorTarefa: vi.fn().mockResolvedValue(null),
    aplicarEventoFundador: vi.fn(),
    consultarToqueFundador: vi.fn().mockResolvedValue(null),
    lerPerguntaEtapaFundador: vi.fn().mockImplementation(async (etapaId: string) => ({
      card_id: 'c1', etapa_id: etapaId, versao: 3, chave: 1, historico_id: 1, pergunta: 'Qual tom usar?',
      opcoes: [{ letra: 'A', texto: 'Formal', consequencia: 'Texto sóbrio.' }, { letra: 'B', texto: 'Leve', consequencia: 'Texto próximo.' }],
    })),
    lerLeituraCardFundador: vi.fn().mockResolvedValue(null),
    ...parcial,
  };
}

const base: ConfigDetail = {
  id: 'uuid-a', nome: 'Configuração existente', versao: 3, estado: 'RASCUNHO', ativa: false, tecnica: false,
  hash_sha256: null, criada_em: '2026-10-13T10:00:00Z', validada_em: null, aposentada_em: null,
  conteudo: { 'helena-v2/agents/isabela.yaml': { missao: 'Texto registrado', servicos: ['SRV-COPY'] } },
};
function repoConfig(revisao: ConfigDetail = base): RepositorioConfigV2 {
  return {
    listar: vi.fn().mockResolvedValue([revisao]), ler: vi.fn().mockResolvedValue(revisao),
    salvar: vi.fn(), solicitarValidacao: vi.fn(), ativar: vi.fn(), aposentar: vi.fn(),
    listarAtivacoes: vi.fn().mockResolvedValue([]), reverter: vi.fn(),
  };
}
const config = (repo: RepositorioConfigV2) => render(<MemoryRouter><ConfiguracoesV2Page repositorio={repo} /></MemoryRouter>);
const renderCards = (page: ReactElement) => render(<MemoryRouter>{page}</MemoryRouter>);

beforeEach(() => { auth.isFounder = true; auth.userId = 'fundador-1'; });
afterEach(cleanup);

describe('detector de classe de alvo de toque', () => {
  it.each(['min-h-11', 'mt-3 min-h-11 rounded-lg', 'h-11 w-11 grid', 'a size-12 b', 'min-h-14'])('reconhece "%s"', classes => {
    expect(ALVO_DE_TOQUE.test(classes)).toBe(true);
  });
  it.each(['', 'px-4 py-2 text-sm', 'sm:min-h-11', 'md:h-11', 'max-h-11', 'min-h-110', 'h-1', 'min-h-10', 'h-9'])('não confunde "%s" com alvo de toque', classes => {
    expect(ALVO_DE_TOQUE.test(classes)).toBe(false);
  });
});

describe('CardV2Page (fundador): botões e links', () => {
  it('com pedido de publicação em qualquer estado, o botão "Atualizar situação" declara alvo de toque', async () => {
    for (const estado of ['PEDIDA', 'EM_EXECUCAO', 'PUBLICADA', 'FALHOU', 'REVERTIDA']) {
      const pedido = { id: 1, pedido_em: '2026-10-13T12:00:00Z', dia_brasilia: '2026-10-13', estado, erro: estado === 'FALHOU' ? 'erro' : null, versao_publicada: 'v1' };
      renderCards(<CardV2Page repositorio={repoCards({ situacaoPublicacao: vi.fn().mockResolvedValue({ fundador: true, dia_brasilia: '2026-10-13', pedido }) })} />);
      await screen.findByRole('button', { name: 'Atualizar situação' });
      expect(semAlvo(), estado).toEqual([]);
      expect(comAlvo(), estado).toEqual(expect.arrayContaining(['button "Atualizar situação"']));
      cleanup();
    }
  });

  it('todo controle do fundador (inclusive os 4 "Revisar decisão") declara alvo de toque', async () => {
    renderCards(<CardV2Page repositorio={repoCards()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Card em andamento/ }));
    await screen.findByText('Pergunta atual da etapa');
    await screen.findByRole('button', { name: 'Pedir publicação' });
    await screen.findByRole('button', { name: /Mostrar todas as 121/ });
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Revisar decisão' })).toHaveLength(4));
    expect(semAlvo()).toEqual([]);
    expect(comAlvo().filter(n => n === 'button "Revisar decisão"')).toHaveLength(4);
  });

  it('nos estados de erro, todo botão declara alvo de toque', async () => {
    renderCards(<CardV2Page repositorio={repoCards({ listar: vi.fn().mockRejectedValue(new Error('x')), situacaoPublicacao: vi.fn().mockRejectedValue(new Error('x')) })} />);
    await screen.findByText('Não foi possível carregar os cards.');
    await screen.findByText('Não foi possível consultar a publicação.');
    expect(semAlvo()).toEqual([]);
    expect(comAlvo()).toEqual(expect.arrayContaining(['button "Atualizar cards"', 'button "Tentar novamente"']));
  });

  it('botões das áreas do fundador que tratam falhas de leitura declaram alvo de toque', async () => {
    const falha = vi.fn().mockRejectedValue(new Error('x'));
    renderCards(<CardV2Page repositorio={repoCards({
      listar: vi.fn().mockResolvedValue([{ ...card, estado: 'ESPERANDO_CONFIRMACAO', motivo: 'NENHUM' }]),
      detalhar: vi.fn().mockResolvedValue({ etapas: [etapa('e2', 'E2', 'PERGUNTA')], entregas: [], acoes: [], ordem: null }),
      lerLeituraCardFundador: falha, lerPerguntaEtapaFundador: falha,
    })} />);
    fireEvent.click(await screen.findByRole('button', { name: /Card em andamento/ }));
    expect(await screen.findByRole('button', { name: 'Consultar leitura novamente' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Consultar pergunta novamente' })).toBeTruthy();
    // O 3º é o "Revisar decisão" do próprio card (a ação 'Cancelar card' continua disponível).
    expect(semAlvo()).toEqual([]);
    expect(comAlvo()).toEqual(expect.arrayContaining(['button "Consultar leitura novamente"', 'button "Consultar pergunta novamente"', 'button "Revisar decisão"']));
  });
});

describe('ConfiguracoesV2Page (fundador): botões, abas e links', () => {
  it('rascunho aberto com editor de documento e JSON avançado: todo controle declara alvo de toque', async () => {
    config(repoConfig());
    fireEvent.click(await screen.findByRole('button', { name: /Configuração existente/ }));
    fireEvent.click(await screen.findByRole('button', { name: /isabela.yaml/ }));
    fireEvent.click(await screen.findByText('Editar JSON avançado'));
    await screen.findByRole('button', { name: 'Aplicar JSON ao rascunho' });
    expect(semAlvo()).toEqual([]);
    expect(comAlvo()).toEqual(expect.arrayContaining(['button "Salvar rascunho"', 'button "Aplicar JSON ao rascunho"']));
  });

  it('revisão validada (botão Ativar revisão): todo controle declara alvo de toque', async () => {
    config(repoConfig({ ...base, estado: 'VALIDADA' }));
    fireEvent.click(await screen.findByRole('button', { name: /Configuração existente/ }));
    await screen.findByRole('button', { name: 'Ativar revisão' });
    expect(semAlvo()).toEqual([]);
    expect(comAlvo()).toEqual(expect.arrayContaining(['button "Ativar revisão"']));
  });

  it('histórico de ativações com o botão "Reverter para a revisão anterior": todo controle declara alvo de toque', async () => {
    const ativa = { ...base, id: 'uuid-ativa', estado: 'VALIDADA' as const, ativa: true };
    const repo = repoConfig(ativa);
    vi.mocked(repo.listarAtivacoes).mockResolvedValue([{
      id: 2, tipo: 'ATIVACAO', ativada_por: 'fundador-1', ativada_em: '2026-10-13T15:30:00Z',
      configuracao_id: 'uuid-ativa', configuracao_nome: 'Configuração existente', configuracao_versao: 3,
      anterior_id: 'uuid-anterior', anterior_nome: 'Revisão anterior', anterior_versao: 2, anterior_estado: 'VALIDADA',
    }]);
    config(repo);
    await screen.findByRole('region', { name: 'Ativações recentes' });
    expect(semAlvo()).toEqual([]);
    expect(comAlvo()).toEqual(expect.arrayContaining(['button "Reverter para a revisão anterior"']));
  });

  it('membro vê só o link "Voltar aos cards", que também declara alvo de toque', async () => {
    auth.isFounder = false;
    config(repoConfig());
    await screen.findByText('Acesso restrito');
    expect(semAlvo()).toEqual([]);
    expect(comAlvo()).toEqual(['a "Voltar aos cards"']);
  });
});
