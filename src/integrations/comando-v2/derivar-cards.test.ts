import { describe, expect, it } from 'vitest';
import {
  amostraDe, cardPrazoVencido, combinarLeituras, contarPorFiltro, etapaAtrasada, etapaParada, etapasDaEmpresa, filtrarCards, formatarDataHora,
  mensagemFalha, ordenarCards, revisoresDaEtapa, pedidosDaEmpresa, pedidosSemCard, prazoRelativo, rotuloMotivo, normalizarBusca,
} from './derivar-cards';
import { AGORA, card, etapa, montarDados, pedido } from './derivar-cards.fixtures';

const h = (n: number) => new Date(AGORA.getTime() + n * 3600_000).toISOString();

describe('prazoRelativo', () => {
  it('descreve futuro e passado em linguagem simples', () => {
    expect(prazoRelativo(h(48), AGORA)).toBe('vence em 2 dias');
    expect(prazoRelativo(h(24), AGORA)).toBe('vence em 1 dia');
    expect(prazoRelativo(h(-3), AGORA)).toBe('venceu há 3 h');
    expect(prazoRelativo(h(0.5), AGORA)).toBe('vence em 30 min');
    expect(prazoRelativo(null, AGORA)).toBe('Sem prazo');
    expect(prazoRelativo('lixo', AGORA)).toBe('Sem prazo');
  });
});

it('formata data no fuso de São Paulo', () => {
  expect(formatarDataHora('2026-10-17T15:30:00Z')).toMatch(/^17\/10\/2026,? 12:30$/);
  expect(formatarDataHora(null)).toBe('Sem data');
});

it('traduz motivos e ignora NENHUM', () => {
  expect(rotuloMotivo('NENHUM')).toBeNull();
  expect(rotuloMotivo(undefined)).toBeNull();
  expect(rotuloMotivo('PERGUNTA')).toMatch(/pergunta/);
});

describe('filtros e ordem de cards', () => {
  const cards = [
    card('a', { titulo: 'Campanha de Operação', estado: 'ESPERANDO_FUNDADOR', prioridade: 2 }),
    card('b', { estado: 'EM_ANDAMENTO', prazo: h(-5), prazo_ate: h(-5), dono: 'LAURA' }),
    card('c', { estado: 'PRONTO', prazo: h(-9), prazo_ate: h(-9) }),
    card('d', { estado: 'ESPERANDO_CONFIRMACAO', prioridade: 1 }),
    card('e', { empresa: 'BIZ-005', estado: 'EM_ANDAMENTO', prazo: h(1), prazo_ate: h(1) }),
  ];
  const catalogo = montarDados().catalogo;
  const opcoes = { busca: '', filtro: 'todos' as const, ordem: 'prioridade' as const, agora: AGORA, catalogo };

  it('prazo vencido ignora cards finais', () => {
    expect(cardPrazoVencido(cards[1], AGORA)).toBe(true);
    expect(cardPrazoVencido(cards[2], AGORA)).toBe(false);
  });
  it('filtra por chip', () => {
    expect(filtrarCards(cards, { ...opcoes, filtro: 'precisa' }).map(c => c.id).sort()).toEqual(['a', 'd']);
    expect(filtrarCards(cards, { ...opcoes, filtro: 'vencido' }).map(c => c.id)).toEqual(['b']);
    expect(filtrarCards(cards, { ...opcoes, filtro: 'andamento' }).map(c => c.id).sort()).toEqual(['b', 'e']);
    expect(filtrarCards(cards, { ...opcoes, filtro: 'prontos' }).map(c => c.id)).toEqual(['c']);
    expect(contarPorFiltro(cards, AGORA)).toEqual({ todos: 5, precisa: 2, vencido: 1, andamento: 2, prontos: 1 });
  });
  it('busca por título, nome da empresa e dono, sem acento', () => {
    expect(filtrarCards(cards, { ...opcoes, busca: 'operacao' }).map(c => c.id)).toEqual(['a']);
    expect(filtrarCards(cards, { ...opcoes, busca: 'eliving' }).map(c => c.id)).toEqual(['e']);
    expect(filtrarCards(cards, { ...opcoes, busca: 'laura' }).map(c => c.id)).toEqual(['b']);
    expect(normalizarBusca('  Ação ')).toBe('acao');
  });
  it('ordena por prioridade (espera você, vencido, número), prazo e recentes', () => {
    expect(ordenarCards(cards, 'prioridade', AGORA).map(c => c.id)).toEqual(['a', 'd', 'b', 'e', 'c']);
    // o motor despacha ORDER BY prioridade DESC: maior número = mais urgente; sem prioridade vai ao fim do grupo
    const iguais = [card('p1', { prioridade: 1 }), card('p3', { prioridade: 3 }), card('pn', { prioridade: null }), card('p2', { prioridade: 2 })];
    expect(ordenarCards(iguais, 'prioridade', AGORA).map(c => c.id)).toEqual(['p3', 'p2', 'p1', 'pn']);
    expect(ordenarCards(cards, 'prazo', AGORA).map(c => c.id).slice(0, 2)).toEqual(['c', 'b']);
    const recentes = [card('x', { atualizado_em: h(-10) }), card('y', { atualizado_em: h(-1) })];
    expect(ordenarCards(recentes, 'recentes', AGORA).map(c => c.id)).toEqual(['y', 'x']);
  });
});

describe('etapas e pedidos', () => {
  it('atrasada e parada', () => {
    expect(etapaAtrasada(etapa('1', 'a', { prazo_ate: h(-1) }), AGORA)).toBe(true);
    expect(etapaAtrasada(etapa('1', 'a', { estado: 'PRONTA', prazo_ate: h(-1) }), AGORA)).toBe(false);
    expect(etapaParada(etapa('1', 'a', { atualizado_em: h(-2) }), AGORA)).toBe(true);
    expect(etapaParada(etapa('1', 'a', { atualizado_em: h(-0.5) }), AGORA)).toBe(false);
    expect(etapaParada(etapa('1', 'a', { estado: 'NA_FILA', atualizado_em: h(-9) }), AGORA)).toBe(false);
    expect(etapaParada(etapa('1', 'a', { atualizado_em: null }), AGORA)).toBe(false);
  });
  it('filtra etapas e pedidos pela empresa', () => {
    const cards = [card('a'), card('e', { empresa: 'BIZ-005' })];
    const etapas = [etapa('1', 'a'), etapa('2', 'e'), etapa('3', 'fora')];
    expect(etapasDaEmpresa(etapas, cards, 'GRUPO')).toHaveLength(3);
    expect(etapasDaEmpresa(etapas, cards, 'BIZ-005').map(e => e.id)).toEqual(['2']);
    const pedidos = [pedido('p1', 'RECEBIDO', { empresa_id: 'BIZ-003' }), pedido('p2', 'RECEBIDO')];
    expect(pedidosDaEmpresa(pedidos, 'BIZ-003').map(p => p.pedido_id)).toEqual(['p1']);
    expect(pedidosDaEmpresa(pedidos, 'GRUPO')).toHaveLength(2);
  });
  it('pedidos sem card: só RECEBIDO e PLANO_CONFIRMADO sem card_id', () => {
    const lista = [pedido('a', 'RECEBIDO'), pedido('b', 'PLANO_CONFIRMADO'), pedido('c', 'CARD_CRIADO', { card_id: 'x' }), pedido('d', 'RECEBIDO', { card_id: 'z' })];
    expect(pedidosSemCard(lista).map(p => p.pedido_id)).toEqual(['a', 'b']);
  });
});

it('combina leituras: erro vence carregando e nunca vira pronta', () => {
  const estado = { ...montarDados().estado, cards: 'carregando' as const, etapas: 'erro' as const };
  expect(combinarLeituras(estado, ['cards', 'etapas'])).toEqual({ estado: 'erro', falhas: ['as etapas'] });
  expect(combinarLeituras(estado, ['cards']).estado).toBe('carregando');
  expect(combinarLeituras(estado, ['entregas']).estado).toBe('pronta');
  expect(mensagemFalha(['os cards', 'as etapas'])).toContain('os cards e as etapas');
});

it('amostra: cada aba olha só as fontes que usa; sem corte por fonte vale a amostra global', () => {
  const base = montarDados();
  const soPedidos = { ...base, amostra: false, amostras: { cards: false, etapas: false, entregas: false, pedidos: true } };
  expect(amostraDe(soPedidos, ['cards', 'etapas'])).toBe(false);
  expect(amostraDe(soPedidos, ['cards', 'pedidos'])).toBe(true);
  expect(amostraDe({ ...base, amostra: true }, ['cards'])).toBe(true);
  expect(amostraDe({ ...base, amostra: false }, ['pedidos'])).toBe(false);
});

it('revisor NENHUM vira "Sem revisor" (e não esconde nem inventa nomes)', () => {
  expect(revisoresDaEtapa(etapa('1', 'a', { revisor: 'NENHUM', revisores: ['CLARA'] }))).toBe('Sem revisor');
  expect(revisoresDaEtapa(etapa('1', 'a', { revisor: 'MAYA', revisores: ['CLARA'] }))).toBe('MAYA');
  expect(revisoresDaEtapa(etapa('1', 'a', { revisor: '', revisores: ['CLARA', 'NENHUM'] }))).toBe('CLARA');
  expect(revisoresDaEtapa(etapa('1', 'a', { revisor: undefined, revisores: [] }))).toBe('Sem revisor');
});
