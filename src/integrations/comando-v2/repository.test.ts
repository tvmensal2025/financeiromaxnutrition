import { describe, expect, it } from 'vitest';
import {
  COLUNAS_ENTREGA, criarRepositorioComandoV2, LIMITE_CARDS, LIMITE_ENTREGAS, LIMITE_ETAPAS, TAMANHO_PAGINA,
  type ClienteComandoV2, type ConsultaComandoV2,
} from './repository';

// Cliente somente em memória: nunca importa o cliente real do app.
function cliente(tabelas: Record<string, Record<string, unknown>[]>, erroEm?: string) {
  const esquemas: string[] = [];
  const chamadas: { tabela: string; colunas: string; filtros: Record<string, unknown>; intervalos: [number, number][] }[] = [];
  const banco: ClienteComandoV2 = {
    schema(nome) {
      esquemas.push(nome);
      return {
        from(tabela) {
          return {
            select(colunas) {
              const chamada = { tabela, colunas, filtros: {} as Record<string, unknown>, intervalos: [] as [number, number][] };
              chamadas.push(chamada);
              let de = 0; let ate = Number.MAX_SAFE_INTEGER;
              const consulta: ConsultaComandoV2 = {
                eq(coluna, valor) { chamada.filtros[coluna] = valor; return consulta; },
                order() { return consulta; },
                range(a, b) { de = a; ate = b; chamada.intervalos.push([a, b]); return consulta; },
                then(resolve, reject) {
                  const linhas = (tabelas[tabela] ?? []).filter(l => Object.entries(chamada.filtros).every(([k, v]) => l[k] === v));
                  return Promise.resolve(erroEm === tabela
                    ? { data: null, error: { message: 'indisponível' } }
                    : { data: linhas.slice(de, ate + 1), error: null }).then(resolve, reject);
                },
              };
              return consulta;
            },
          };
        },
      };
    },
  };
  return { banco, esquemas, chamadas };
}

const gerar = (n: number, f: (i: number) => Record<string, unknown>) => Array.from({ length: n }, (_, i) => f(i));

describe('leitura em lote da Sala de comando', () => {
  it('lê cards, etapas atuais e entregas no esquema helena_v2, sem o corpo das entregas', async () => {
    const { banco, esquemas, chamadas } = cliente({
      card: [{ id: 'c1', titulo: 'T', empresa: 'BIZ-003', estado: 'EM_ANDAMENTO', dono: 'CAIO', prazo: '2026-10-20', criado_em: '2026-10-01', versao: 2, motivo: 'NENHUM', pedido_grande: false, atualizado_em: '2026-10-02', prazo_ate: null, prioridade: 3 }],
      etapa: [
        { id: 'e1', card_id: 'c1', atual: true, codigo: 'E1', nome: 'N', estado: 'REVISAO', autor: 'CAIO', ordem: 1, execucoes: 2, atualizado_em: '2026-10-02', revisores: [] },
        { id: 'e0', card_id: 'c1', atual: false, codigo: 'E1', nome: 'N', estado: 'CANCELADA', autor: 'CAIO' },
      ],
      entrega: [{ id: 7, card_id: 'c1', etapa_id: 'e1', etapa_codigo: 'E1', versao: 1, autor: 'CAIO', portao1: 'PASSOU', criada_em: '2026-10-02', parecer: 'OK', usou_internet: 'SIM', conteudo: { segredo: 1 } }],
    });
    const repo = criarRepositorioComandoV2(banco);
    const [cards, etapas, entregas] = await Promise.all([repo.lerCards(), repo.lerEtapasAtuais(), repo.lerEntregas()]);

    expect(new Set(esquemas)).toEqual(new Set(['helena_v2']));
    expect(cards).toMatchObject({ amostra: false, itens: [{ id: 'c1', prioridade: 3, prazo_ate: null, atualizado_em: '2026-10-02' }] });
    expect(etapas.itens).toHaveLength(1);
    expect(etapas.itens[0]).toMatchObject({ id: 'e1', card_id: 'c1', ordem: 1, execucoes: 2 });
    expect(chamadas.find(c => c.tabela === 'etapa')?.filtros).toEqual({ atual: true });
    expect(entregas.itens).toEqual([{
      id: '7', card_id: 'c1', etapa_id: 'e1', etapa_codigo: 'E1', versao: 1, autor: 'CAIO', portao1: 'PASSOU',
      criada_em: '2026-10-02', parecer: 'OK', usou_internet: true,
    }]);
    expect(COLUNAS_ENTREGA).not.toContain('conteudo');
    expect(chamadas.find(c => c.tabela === 'entrega')?.colunas).not.toContain('conteudo');
    // cada tabela: uma página com dados e uma vazia que confirma o fim
    expect(chamadas.map(c => c.tabela).sort()).toEqual(['card', 'card', 'entrega', 'entrega', 'etapa', 'etapa']);
    expect(new Set(chamadas.map(c => c.tabela))).toEqual(new Set(['card', 'entrega', 'etapa']));
  });

  it('devolve null para o que o banco não informa', async () => {
    const { banco } = cliente({
      card: [{ id: 'c1', titulo: 'T', estado: 'PRONTO' }],
      entrega: [{ id: 1, card_id: 'c', etapa_id: 'e', portao1: null, usou_internet: null, criada_em: 'x' }],
    });
    const repo = criarRepositorioComandoV2(banco);
    expect((await repo.lerCards()).itens[0]).toMatchObject({ atualizado_em: null, prazo_ate: null, prioridade: null });
    expect((await repo.lerEntregas()).itens[0]).toMatchObject({ portao1: '', usou_internet: null, parecer: null, autor: null });
  });

  it('lê em páginas e marca amostra ao bater no limite', async () => {
    const { banco, chamadas } = cliente({
      card: gerar(LIMITE_CARDS + 50, i => ({ id: `c${i}`, titulo: 'T', estado: 'PRONTO' })),
      etapa: gerar(LIMITE_ETAPAS + 1, i => ({ id: `e${i}`, card_id: 'c', atual: true })),
      entrega: gerar(LIMITE_ENTREGAS - 1, i => ({ id: i, card_id: 'c', etapa_id: 'e', criada_em: 'x' })),
    });
    const repo = criarRepositorioComandoV2(banco);
    const cards = await repo.lerCards();
    const etapas = await repo.lerEtapasAtuais();
    const entregas = await repo.lerEntregas();
    expect(cards.itens).toHaveLength(LIMITE_CARDS);
    expect(cards.amostra).toBe(true);
    expect(etapas.itens).toHaveLength(LIMITE_ETAPAS);
    expect(etapas.amostra).toBe(true);
    expect(entregas.itens).toHaveLength(LIMITE_ENTREGAS - 1);
    expect(entregas.amostra).toBe(false);
    // páginas até o limite, mais uma consulta de 1 linha que confirma que há mais
    expect(chamadas.filter(c => c.tabela === 'etapa')).toHaveLength(Math.ceil(LIMITE_ETAPAS / TAMANHO_PAGINA) + 1);
    expect(chamadas.filter(c => c.tabela === 'card').flatMap(c => c.intervalos)).toEqual([[0, LIMITE_CARDS - 1], [LIMITE_CARDS, LIMITE_CARDS]]);
  });

  it('exatamente o limite, sem mais nada no banco, não é amostra', async () => {
    const { banco } = cliente({ card: gerar(LIMITE_CARDS, i => ({ id: `c${i}`, titulo: 'T', estado: 'PRONTO' })) });
    const cards = await criarRepositorioComandoV2(banco).lerCards();
    expect(cards.itens).toHaveLength(LIMITE_CARDS);
    expect(cards.amostra).toBe(false);
  });

  it('só uma página vazia encerra a leitura, mesmo que o servidor devolva menos que o pedido', async () => {
    const linhas = gerar(300, i => ({ id: `c${i}`, titulo: 'T', estado: 'PRONTO' }));
    // servidor que corta cada resposta em 100 linhas, mesmo pedindo 1000
    const banco: ClienteComandoV2 = { schema: () => ({ from: () => ({ select: () => {
      let de = 0; let ate = 0;
      const consulta: ConsultaComandoV2 = {
        eq: () => consulta, order: () => consulta, range: (a, b) => { de = a; ate = b; return consulta; },
        then: (resolve, reject) => Promise.resolve({ data: linhas.slice(de, Math.min(ate, de + 99) + 1), error: null }).then(resolve, reject),
      };
      return consulta;
    } }) }) };
    const cards = await criarRepositorioComandoV2(banco).lerCards();
    expect(cards.itens).toHaveLength(300);
    expect(cards.amostra).toBe(false);
  });

  it('linha repetida entre páginas conta uma vez só', async () => {
    const repetida = { id: 'c1', titulo: 'T', estado: 'PRONTO' };
    let n = 0;
    const banco: ClienteComandoV2 = { schema: () => ({ from: () => ({ select: () => {
      const consulta: ConsultaComandoV2 = {
        eq: () => consulta, order: () => consulta, range: () => consulta,
        then: (resolve, reject) => Promise.resolve({ data: n++ < 2 ? [repetida, { id: `c${n + 1}`, titulo: 'T', estado: 'PRONTO' }] : [], error: null }).then(resolve, reject),
      };
      return consulta;
    } }) }) };
    const cards = await criarRepositorioComandoV2(banco).lerCards();
    expect(cards.itens.map(c => c.id)).toEqual(['c1', 'c2', 'c3']); // 'c1' veio nas duas páginas e vale uma vez
    expect(cards.amostra).toBe(false);
  });

  it('informa falha em vez de lista vazia', async () => {
    const { banco } = cliente({}, 'card');
    await expect(criarRepositorioComandoV2(banco).lerCards()).rejects.toThrow('Não foi possível ler os cards');
    await expect(criarRepositorioComandoV2(banco).lerEntregas()).resolves.toMatchObject({ itens: [], amostra: false });
  });
});
