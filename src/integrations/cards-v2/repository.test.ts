import { describe, expect, it } from 'vitest';
import { criarRepositorioCardsV2, type ConsultaCardsV2 } from './repository';

// Cliente somente em memória: estes testes nunca importam o cliente do app.
function cliente(tabelas: Record<string, unknown[]>, erro = false) {
  const chamadas: string[] = [];
  const parametros: Array<Record<string, unknown> | undefined> = [];
  return {
    chamadas,
    parametros,
    schema(nome: string) {
      chamadas.push(nome);
      return {
        from(tabela: string) {
          let rows = [...(tabelas[tabela] ?? [])] as Record<string, unknown>[];
          const query: ConsultaCardsV2 & { select(): ConsultaCardsV2 } = {
            select() { return query; },
            eq(coluna: string, valor: unknown) { rows = rows.filter(r => r[coluna] === valor); return query; },
            order() { return query; },
            limit(quantidade) { rows = rows.slice(0, quantidade); return query; },
            maybeSingle() { return Promise.resolve({ data: rows[0] ?? null, error: erro ? { message: 'indisponível' } : null }); },
            then(resolve, reject) { return Promise.resolve({ data: rows, error: erro ? { message: 'indisponível' } : null }).then(resolve, reject); },
          };
          return query;
        },
        async rpc(nome: string, argumentos?: Record<string, unknown>) {
          chamadas.push(nome);
          parametros.push(argumentos);
          return { data: nome === 'solicitar_card_real' ? { id: 'solicitacao-real', card_id: null } : { fundador: true, dia_brasilia: '2026-10-13', pedido: null }, error: erro ? { message: 'indisponível' } : null };
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
  it('envia a solicitação autenticada ao schema v2 com os nomes exatos da RPC', async () => {
    const banco = cliente({});
    const pedido = { tarefaId: 'TSK-REAL', prazo: '2026-10-20T15:00:00-03:00', plano: { id: 'roteiro-real' },
      dadosReais: { proveniencia: { tarefa_id: 'TSK-REAL' } }, configRevisionId: null, chaveIdempotencia: 'uuid-local' };
    expect(await criarRepositorioCardsV2(banco).solicitarCardReal(pedido)).toEqual({ id: 'solicitacao-real', card_id: null });
    expect(banco.chamadas).toEqual(['helena_v2', 'solicitar_card_real']);
    expect(banco.parametros).toEqual([{
      p_tarefa_id: pedido.tarefaId, p_prazo: pedido.prazo, p_plano: pedido.plano,
      p_dados_reais: pedido.dadosReais, p_config_revision_id: null,
      p_chave_idempotencia: pedido.chaveIdempotencia,
    }]);
  });
  it('não anuncia criação quando a RPC recusa o pedido', async () => {
    await expect(criarRepositorioCardsV2(cliente({}, true)).solicitarCardReal({
      tarefaId: 'TSK-REAL', prazo: '2026-10-20T15:00:00-03:00', plano: {}, dadosReais: {},
      configRevisionId: null, chaveIdempotencia: 'uuid-local',
    })).rejects.toThrow('indisponível');
  });
  it('reconsulta por chave com RLS após resposta ambígua', async () => {
    const banco = cliente({ solicitacao_card_real: [
      { id: 'solicitacao-confirmada', card_id: null, chave_idempotencia: 'chave-correta' },
      { id: 'outra', card_id: null, chave_idempotencia: 'outra-chave' },
    ] });
    expect(await criarRepositorioCardsV2(banco).consultarSolicitacaoPorChave('chave-correta'))
      .toMatchObject({ id: 'solicitacao-confirmada', card_id: null });
    expect(await criarRepositorioCardsV2(banco).consultarSolicitacaoPorChave('chave-ausente')).toBeNull();
    expect(banco.chamadas).toEqual(['helena_v2', 'helena_v2']);
  });
  it('lista metadados próprios e confere a tarefa antes de nova solicitação', async () => {
    const banco = cliente({ solicitacao_card_real: [
      { id: 'pedido-1', chave_origem: 'TSK-REAL', criado_em: '2026-10-13T00:00:00Z', card_id: null },
    ] });
    const repositorio = criarRepositorioCardsV2(banco);
    expect(await repositorio.listarSolicitacoesReais()).toHaveLength(1);
    expect(await repositorio.consultarSolicitacaoPorTarefa('TSK-REAL')).toMatchObject({ id: 'pedido-1', card_id: null });
    expect(await repositorio.consultarSolicitacaoPorTarefa('OUTRA')).toBeNull();
  });
});
