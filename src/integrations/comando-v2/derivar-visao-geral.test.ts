import { describe, expect, it } from 'vitest';
import {
  atrasados, cardsDaEmpresa, contagemPorColuna, dataCurtaSP, diaSaoPaulo, etapasPorAgente, haQuantoTempo, instantePrazo,
  kpis, porEmpresa, porEstado, prioridades, prontosRecentes, recortarPorEmpresa, saudacaoPorHora, serieDiaria,
} from './derivar-visao-geral';
import { AGORA, card, cardsBase, dadosCheios } from './visao-geral.fixtures';

describe('porEstado', () => {
  it('conta por estado na ordem do fluxo, com rótulo em português e cor de token', () => {
    const r = porEstado(cardsBase);
    expect(r.map(f => [f.estado, f.quantidade])).toEqual([
      ['RASCUNHO', 1], ['ESPERANDO_CONFIRMACAO', 1], ['ESPERANDO_FUNDADOR', 1], ['EM_ANDAMENTO', 2], ['PRONTO', 2], ['ENCERRADO_COM_FALHA', 1],
    ]);
    expect(r.find(f => f.estado === 'ESPERANDO_FUNDADOR')?.rotulo).toBe('Esperando você');
    expect(r.every(f => f.cor.startsWith('hsl(var(--'))).toBe(true);
  });
  it('estado desconhecido aparece ao final com o próprio código, e vazio dá lista vazia', () => {
    expect(porEstado([card('x', 'ESTADO_NOVO')]).map(f => f.rotulo)).toEqual(['ESTADO_NOVO']);
    expect(porEstado([])).toEqual([]);
  });
});

describe('atrasados e prazos', () => {
  it('só cards abertos com prazo vencido; final nunca atrasa; prazo só com dia vale até o fim do dia em São Paulo', () => {
    expect(atrasados(cardsBase, AGORA).map(c => c.id)).toEqual(['c3']);
    expect(instantePrazo(card('x', 'EM_ANDAMENTO', { prazo: '2026-10-17' }))).toBe(Date.parse('2026-10-18T02:59:59Z'));
    expect(atrasados([card('x', 'EM_ANDAMENTO', { prazo: '2026-10-16' })], AGORA)).toHaveLength(1);
  });
  it('prazo_ate vence sobre prazo e prazo inválido não atrasa', () => {
    expect(atrasados([card('x', 'EM_ANDAMENTO', { prazo: '2030-01-01T00:00:00Z', prazo_ate: '2026-10-01T00:00:00Z' })], AGORA)).toHaveLength(1);
    expect(atrasados([card('x', 'EM_ANDAMENTO', { prazo: 'lixo' })], AGORA)).toHaveLength(0);
  });
});

describe('kpis e prontos recentes', () => {
  it('calcula os 4 números', () => {
    expect(kpis(cardsBase, AGORA)).toEqual({ abertos: 5, esperando: 2, atrasados: 1, prontos7d: 1 });
    expect(prontosRecentes(cardsBase, AGORA, 7)).toBe(1);
  });
});

describe('filtro de empresa', () => {
  it('GRUPO traz tudo; código traz só a empresa e recorta etapas, entregas e pedidos', () => {
    const d = dadosCheios();
    expect(cardsDaEmpresa(d.cards, 'GRUPO')).toHaveLength(8);
    expect(cardsDaEmpresa(d.cards, 'BIZ-001').map(c => c.id)).toEqual(['c3', 'c4', 'c5', 'c7']);
    const r = recortarPorEmpresa(d, 'BIZ-001');
    expect(r.etapas.map(e => e.id)).toEqual(['e1', 'e2', 'e4', 'e5']);
    expect(r.entregas.map(e => e.id)).toEqual(['d1', 'd2', 'd3']);
    expect(r.pedidos.map(p => p.pedido_id)).toEqual(['p3']);
    expect(recortarPorEmpresa(d, 'BIZ-003').pedidos.map(p => p.pedido_id)).toEqual(['p2']);
  });
});

describe('porEmpresa', () => {
  it('usa nomes do catálogo, inclui empresa sem cards e card sem empresa, e conta só entregas que passaram', () => {
    const d = dadosCheios();
    const r = porEmpresa(d.cards, d.entregas, d.catalogo);
    expect(r.map(l => l.nome)).toEqual(['Max Nutrition', 'Humano Digital', 'Empresa Parada', 'Sem empresa']);
    expect(r[0]).toMatchObject({ abertos: 2, esperando: 0, outrosAbertos: 2, prontos: 2, entregas: 2 });
    expect(r[1]).toMatchObject({ abertos: 2, esperando: 2, outrosAbertos: 0, prontos: 0, entregas: 1 });
    expect(r[2]).toMatchObject({ abertos: 0, prontos: 0, entregas: 0 });
    expect(r[3]).toMatchObject({ abertos: 1 });
  });
  it('filtro devolve só a empresa pedida e usa o código se o catálogo não a conhece', () => {
    const d = dadosCheios();
    expect(porEmpresa(d.cards, d.entregas, d.catalogo, 'BIZ-003')).toHaveLength(1);
    expect(porEmpresa([card('z', 'EM_ANDAMENTO', { empresa: 'BIZ-999' })], [], { empresas: [] }, 'BIZ-999')[0]).toMatchObject({ nome: 'BIZ-999', abertos: 1 });
  });
});

describe('etapasPorAgente', () => {
  it('casa autor com identidade sem diferenciar maiúsculas, ignora etapa final e de card encerrado, e mantém texto sem cadastro', () => {
    const d = dadosCheios();
    const r = etapasPorAgente(d.etapas, d.catalogo, d.cards);
    expect(r.map(l => [l.nome, l.etapas, l.naoCadastrado])).toEqual([['Maya', 2, false], ['Fulano externo', 1, true], ['Helena', 1, false]]);
  });
  it('sem lista de cards não descarta etapa de card encerrado', () => {
    const d = dadosCheios();
    expect(etapasPorAgente(d.etapas, d.catalogo).find(l => l.nome === 'Helena')?.etapas).toBe(2);
    expect(etapasPorAgente([], d.catalogo)).toEqual([]);
  });
});

describe('serieDiaria', () => {
  it('dá 14 dias terminando hoje em São Paulo, com pedido das 23h de ontem no dia certo', () => {
    const d = dadosCheios();
    const s = serieDiaria(d, AGORA);
    expect(s).toHaveLength(14);
    expect(s[13]).toMatchObject({ dia: '2026-10-17', rotulo: '17/10', pedidos: 1, entregas: 1 });
    expect(s[12]).toMatchObject({ dia: '2026-10-16', pedidos: 1, entregas: 1 });
    expect(s[0].dia).toBe('2026-10-04');
    expect(s.reduce((n, p) => n + p.cards, 0)).toBe(8); // todos criados em 10/10
    expect(s.find(p => p.dia === '2026-10-10')?.cards).toBe(8);
    expect(s.reduce((n, p) => n + p.entregas, 0)).toBe(2); // d3 reprovada e d4 antiga ficam de fora
  });
  it('vira o mês e o ano sem quebrar', () => {
    const s = serieDiaria({ cards: [], pedidos: [], entregas: [] }, new Date('2027-01-02T12:00:00Z'), 5);
    expect(s.map(p => p.dia)).toEqual(['2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  });
  it('diaSaoPaulo trata data inválida', () => {
    expect(diaSaoPaulo('2026-10-17T02:30:00Z')).toBe('2026-10-16');
    expect(diaSaoPaulo('lixo')).toBeNull();
  });
});

describe('prioridades', () => {
  it('ordena: esperando você, depois prazo vencido, depois falha; cada card uma vez, com motivo em português', () => {
    const r = prioridades(cardsBase, AGORA);
    expect(r.map(p => [p.card.id, p.grupo])).toEqual([['c1', 'decidir'], ['c2', 'decidir'], ['c3', 'atrasado'], ['c6', 'falha']]);
    expect(r[0].haQuanto).toBe('há 3 dias');
    expect(r[1].motivo).toMatch(/Helena não conseguiu ler/);
    expect(r[3].motivo).toMatch(/plano não passou na checagem/);
    expect(prioridades([card('f', 'ENCERRADO_COM_FALHA')], AGORA)[0].motivo).toBe('Terminou com falha. Veja o que aconteceu.');
    expect(r[2].motivo).toMatch(/prazo já passou/i);
  });
  it('traduz todos os motivos conhecidos e marca atrasado dentro de quem espera você', () => {
    const lista = ['HELENA_FALHOU', 'PLANO_INVALIDO', 'VALIDADOR_FALHOU', 'DEPENDENCIA', 'NAO_PODE'].map(m =>
      card(m, 'ESPERANDO_CONFIRMACAO', { motivo: m, prazo: '2026-10-01T00:00:00Z' }));
    const r = prioridades(lista, AGORA);
    expect(new Set(r.map(p => p.motivo)).size).toBe(5);
    expect(r.every(p => p.atrasado && p.grupo === 'decidir' && !/_/.test(p.motivo))).toBe(true);
  });
  it('quem espera há mais tempo vem primeiro e vazio dá lista vazia', () => {
    const r = prioridades([
      card('novo', 'ESPERANDO_FUNDADOR', { atualizado_em: '2026-10-17T14:00:00Z' }),
      card('velho', 'ESPERANDO_FUNDADOR', { atualizado_em: '2026-10-01T14:00:00Z' }),
    ], AGORA);
    expect(r.map(p => p.card.id)).toEqual(['velho', 'novo']);
    expect(prioridades([], AGORA)).toEqual([]);
  });
});

describe('processo, tempo e saudação', () => {
  it('conta por coluna do quadro (confirmação entra em Preparação)', () => {
    expect(contagemPorColuna(cardsBase).map(c => [c.id, c.quantidade])).toEqual([
      ['preparacao', 2], ['fundador', 1], ['trabalho', 2], ['pronto', 2], ['encerrado', 1],
    ]);
  });
  it('há quanto tempo em português simples', () => {
    const h = (iso: string) => haQuantoTempo(iso, AGORA);
    expect(h('2026-10-17T14:59:40Z')).toBe('agora há pouco');
    expect(h('2026-10-17T14:59:00Z')).toBe('há 1 minuto');
    expect(h('2026-10-17T12:00:00Z')).toBe('há 3 horas');
    expect(h('2026-10-16T14:00:00Z')).toBe('há 1 dia');
    expect(haQuantoTempo(null, AGORA)).toBe('sem data');
  });
  it('saudação pela hora de São Paulo e data curta no fuso', () => {
    expect(saudacaoPorHora(new Date('2026-10-17T08:00:00Z'))).toBe('Bom dia'); // 5h
    expect(saudacaoPorHora(AGORA)).toBe('Boa tarde'); // 12h
    expect(saudacaoPorHora(new Date('2026-10-17T21:00:00Z'))).toBe('Boa noite'); // 18h
    expect(saudacaoPorHora(new Date('2026-10-17T07:59:00Z'))).toBe('Boa noite'); // 4h59
    expect(dataCurtaSP('2026-10-17T02:00:00Z')).toBe('16/10');
    expect(dataCurtaSP('lixo')).toBe('');
  });
});
