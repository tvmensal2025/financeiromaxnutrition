import { describe, expect, it } from 'vitest';
import { criarRepositorioCardsV2, type ConsultaCardsV2 } from './repository';

// Cliente somente em memória: estes testes nunca importam o cliente do app.
function cliente(tabelas: Record<string, unknown[]>, erro = false) {
  const chamadas: string[] = [];
  return {
    chamadas,
    schema(nome: string) {
      chamadas.push(nome);
      return {
        from(tabela: string) {
          let rows = [...(tabelas[tabela] ?? [])] as Record<string, unknown>[];
          const query: ConsultaCardsV2 & { select(): ConsultaCardsV2 } = {
            select() { return query; },
            eq(coluna: string, valor: unknown) { rows = rows.filter(r => r[coluna] === valor); return query; },
            order() { return query; },
            then(resolve, reject) { return Promise.resolve({ data: rows, error: erro ? { message: 'indisponível' } : null }).then(resolve, reject); },
          };
          return query;
        },
        async rpc(nome: string) {
          chamadas.push(nome);
          return { data: { fundador: true, dia_brasilia: '2026-10-13', pedido: null }, error: erro ? { message: 'indisponível' } : null };
        },
      };
    },
  };
}

describe('leitura de cards v2', () => {
  it('não cria dados quando o banco está vazio', async () => {
    const banco = cliente({});
    expect(await criarRepositorioCardsV2(banco).listar()).toEqual([]);
    expect(banco.chamadas).toEqual(['helena_v2']);
  });
  it('informa falha em vez de converter erro em lista vazia', async () => {
    await expect(criarRepositorioCardsV2(cliente({}, true)).listar()).rejects.toThrow();
  });
  it('mostra somente entregas da versão atual, aprovadas nos dois portões', async () => {
    const banco = cliente({
      etapa: [
        { id: 'etapa-atual', card_id: 'card', atual: true, estado: 'PRONTA', versao: 2, portao1_ok: true, entrega_fresca: true },
        { id: 'etapa-revisao', card_id: 'card', atual: true, estado: 'REVISAO', versao: 1, portao1_ok: true, entrega_fresca: true },
        { id: 'etapa-antiga', card_id: 'card', atual: false, estado: 'PRONTA', versao: 1, portao1_ok: true, entrega_fresca: true },
      ],
      entrega: [
        { id: 1, card_id: 'card', etapa_id: 'etapa-atual', versao: 1, portao1: 'PASSOU' },
        { id: 2, card_id: 'card', etapa_id: 'etapa-atual', versao: 2, portao1: 'PASSOU' },
        { id: 3, card_id: 'card', etapa_id: 'etapa-revisao', versao: 1, portao1: 'PASSOU' },
        { id: 4, card_id: 'card', etapa_id: 'etapa-antiga', versao: 1, portao1: 'PASSOU' },
      ],
    });
    const detalhe = await criarRepositorioCardsV2(banco).detalhar('card');
    expect(detalhe.etapas).toHaveLength(2);
    expect(detalhe.entregas.map(e => e.id)).toEqual([2]);
  });
  it('usa a situação e o dia calculados pelo banco', async () => {
    const banco = cliente({});
    expect(await criarRepositorioCardsV2(banco).situacaoPublicacao()).toEqual({ fundador: true, dia_brasilia: '2026-10-13', pedido: null });
    expect(banco.chamadas).toContain('situacao_publicacao');
  });
  it('pede publicação somente pela função protegida, sem chamar deploy', async () => {
    const banco = cliente({});
    await criarRepositorioCardsV2(banco).pedirPublicacao();
    expect(banco.chamadas).toEqual(['helena_v2', 'pedir_publicacao']);
  });
});
