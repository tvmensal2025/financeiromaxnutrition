// Verificação de CÓDIGO-FONTE, não de layout: o jsdom não mede pixels, então este teste
// NÃO prova nada sobre 360 px (isso segue NÃO COMPROVADO até haver navegador real).
// Ele lê as classes dos botões/links/abas renderizados por CardV2Page e ConfiguracoesV2Page
// e procura a classe de alvo de toque (min-h-11, h-11... sem prefixo responsivo):
//  - quem já a declara não pode perdê-la;
//  - controle novo sem ela faz o teste falhar;
//  - as LACUNAS ATUAIS (botões sem a classe) ficam listadas abaixo como dívida conhecida;
//    ao corrigir uma, o teste falha pedindo para tirá-la da lista.
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CardV2Page from './CardV2Page';
import ConfiguracoesV2Page from './ConfiguracoesV2Page';
import type { RepositorioCardsV2 } from '@/integrations/cards-v2/repository';
import type { ConfigDetail, RepositorioConfigV2 } from '@/integrations/config-v2/repository';

configure({ asyncUtilTimeout: 15_000 });

const auth = vi.hoisted(() => ({ isFounder: true, userId: 'fundador-1' }));
vi.mock('@/auth', () => ({ useAuth: () => ({ isFounder: auth.isFounder, user: { id: auth.userId } }) }));

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
  };
}
const config = (repo: RepositorioConfigV2) => render(<MemoryRouter><ConfiguracoesV2Page repositorio={repo} /></MemoryRouter>);

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

// LACUNAS CONHECIDAS (estado do código em 2026-10-14): botões sem min-h-11/h-11.
// Cada item é um controle real renderizado; corrigir no código e remover daqui.
const LACUNAS_CARDS_FUNDADOR = [
  'button "Atualizar cards"', 'button "Card em andamentoEM ANDAMENTO · Helena"', 'button "Mostrar todas as 121 partes da entrega"',
  'button "Pedir publicação"',
].sort();
const LACUNAS_CARDS_ERROS = ['button "Atualizar cards"', 'button "Consultar novamente"', 'button "Tentar novamente"'].sort();
const LACUNAS_CONFIG_COMUNS = [
  'button "Agentes"', 'button "Atualizar estado"', 'button "Clonar revisão"', 'button "Configuração existenteVersão 3 · rascunho"',
  'button "Entregas"', 'button "Inativar"', 'button "Modelos"', 'button "Roteiros"', 'button "Serviços"', 'button "isabela.yaml"',
];
const LACUNAS_CONFIG_RASCUNHO = [
  ...LACUNAS_CONFIG_COMUNS, 'button "Adicionar documento"', 'button "Adicionar campo"', 'button "Adicionar item"',
  'button "Aplicar JSON ao rascunho"', 'button "Camposobjeto · 2"', 'button "Fechar editor avançado"',
  'button "Retirar Item 1 do rascunho"', 'button "Retirar deste rascunho"', 'button "Retirar missao do rascunho"',
  'button "Retirar servicos do rascunho"', 'button "Salvar rascunho"', 'button "Solicitar validação"', 'button "servicoslista · 1"',
].sort();
const LACUNAS_CONFIG_VALIDADA = [
  ...LACUNAS_CONFIG_COMUNS.filter(n => !n.includes('rascunho')), 'button "Configuração existenteVersão 3 · validada"', 'button "Ativar revisão"',
].sort();

describe('CardV2Page (fundador): botões e links', () => {
  it('os 4 "Revisar decisão" (card, etapa, pergunta e ação externa) declaram alvo de toque; as lacunas são só as listadas', async () => {
    render(<CardV2Page repositorio={repoCards()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Card em andamento/ }));
    await screen.findByText('Pergunta atual da etapa');
    await screen.findByRole('button', { name: 'Pedir publicação' });
    await screen.findByRole('button', { name: /Mostrar todas as 121/ });
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Revisar decisão' })).toHaveLength(4));
    expect(comAlvo()).toEqual(Array(4).fill('button "Revisar decisão"'));
    expect(semAlvo()).toEqual(LACUNAS_CARDS_FUNDADOR);
  });

  it('nos estados de erro, só os botões listados ficam sem alvo de toque', async () => {
    render(<CardV2Page repositorio={repoCards({ listar: vi.fn().mockRejectedValue(new Error('x')), situacaoPublicacao: vi.fn().mockRejectedValue(new Error('x')) })} />);
    await screen.findByText('Não foi possível carregar os cards.');
    await screen.findByText('Não foi possível consultar a publicação.');
    expect(comAlvo()).toEqual([]);
    expect(semAlvo()).toEqual(LACUNAS_CARDS_ERROS);
  });

  it('botões das áreas do fundador que tratam falhas de leitura declaram alvo de toque', async () => {
    const falha = vi.fn().mockRejectedValue(new Error('x'));
    render(<CardV2Page repositorio={repoCards({
      listar: vi.fn().mockResolvedValue([{ ...card, estado: 'ESPERANDO_CONFIRMACAO', motivo: 'NENHUM' }]),
      detalhar: vi.fn().mockResolvedValue({ etapas: [etapa('e2', 'E2', 'PERGUNTA')], entregas: [], acoes: [], ordem: null }),
      lerLeituraCardFundador: falha, lerPerguntaEtapaFundador: falha,
    })} />);
    fireEvent.click(await screen.findByRole('button', { name: /Card em andamento/ }));
    expect(await screen.findByRole('button', { name: 'Consultar leitura novamente' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Consultar pergunta novamente' })).toBeTruthy();
    // O 3º é o "Revisar decisão" do próprio card (a ação 'Cancelar card' continua disponível).
    expect(comAlvo()).toEqual(['button "Consultar leitura novamente"', 'button "Consultar pergunta novamente"', 'button "Revisar decisão"']);
  });
});

describe('ConfiguracoesV2Page (fundador): botões, abas e links', () => {
  it('rascunho aberto com editor de documento e JSON avançado: nenhum botão declara alvo de toque hoje', async () => {
    config(repoConfig());
    fireEvent.click(await screen.findByRole('button', { name: /Configuração existente/ }));
    fireEvent.click(await screen.findByRole('button', { name: /isabela.yaml/ }));
    fireEvent.click(await screen.findByText('Editar JSON avançado'));
    await screen.findByRole('button', { name: 'Aplicar JSON ao rascunho' });
    expect(comAlvo()).toEqual([]);
    expect(semAlvo()).toEqual(LACUNAS_CONFIG_RASCUNHO);
  });

  it('revisão validada (botão Ativar revisão): idem', async () => {
    config(repoConfig({ ...base, estado: 'VALIDADA' }));
    fireEvent.click(await screen.findByRole('button', { name: /Configuração existente/ }));
    await screen.findByRole('button', { name: 'Ativar revisão' });
    expect(comAlvo()).toEqual([]);
    expect(semAlvo()).toEqual(LACUNAS_CONFIG_VALIDADA);
  });

  it('membro vê só o link "Voltar ao sistema", também sem alvo de toque', async () => {
    auth.isFounder = false;
    config(repoConfig());
    await screen.findByText('Acesso restrito');
    expect(comAlvo()).toEqual([]);
    expect(semAlvo()).toEqual(['a "Voltar ao sistema"']);
  });
});
