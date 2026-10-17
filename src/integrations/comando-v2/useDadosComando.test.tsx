import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ConfigDetail, ConfigRevision, RepositorioConfigV2 } from '@/integrations/config-v2/repository';
import type { PedidoEntrada, RepositorioPedidosV2 } from '@/integrations/pedidos-v2/repository';
import type { LeituraComando, RepositorioComandoV2 } from './repository';
import type { CardComando, EntregaResumo, EtapaComando } from './tipos';
import { criarUseDadosComando, useDadosComando } from './useDadosComando';

const card = (id: string): CardComando => ({
  id, titulo: id, empresa: 'BIZ-003', estado: 'EM_ANDAMENTO', dono: 'CAIO', prazo: '2026-10-20', criado_em: '2026-10-01',
  atualizado_em: null, prazo_ate: null, prioridade: null,
});
const etapa = { id: 'e1', card_id: 'c1', codigo: 'E1' } as unknown as EtapaComando;
const entrega = { id: '1', card_id: 'c1', etapa_id: 'e1' } as unknown as EntregaResumo;
const pedido = { pedido_id: 'p1' } as unknown as PedidoEntrada;

const revisao: ConfigRevision = {
  id: 'r1', nome: 'Rev', versao: 1, estado: 'VALIDADA', ativa: true, tecnica: false, hash_sha256: 'h',
  criada_em: 'x', validada_em: 'x', aposentada_em: null,
};
const detalhe = {
  ...revisao,
  conteudo: {
    'helena-v2/organograma.yaml': {
      empresas: { 'BIZ-003': { nome: 'Humano Digital', pacote: { estado: 'CONFIRMADO' } } },
      agentes: [{ id: 'AGT-01', identidade: 'HELENA', nome: 'Helena', cargo: 'c', grupo: 'g', estado: 'ESTAGIO' }],
    },
    'helena-v2/servicos.yaml': { servicos: [] },
  },
} as unknown as ConfigDetail;

type Falsos = {
  cards: () => Promise<LeituraComando<CardComando>>;
  falharConfig: boolean; falharPedidos: boolean; falharEntregas: boolean; chamadasCards: number; chamadasFabrica: number;
  pedidosLimite: number; falharComando: boolean;
};
function montar(parcial: Partial<Falsos> = {}) {
  const falsos: Falsos = {
    cards: async () => ({ itens: [card('c1')], amostra: false }), falharConfig: false, falharPedidos: false,
    falharEntregas: false, chamadasCards: 0, chamadasFabrica: 0, pedidosLimite: 100, falharComando: false, ...parcial,
  };
  const comando: RepositorioComandoV2 = {
    lerCards: () => { falsos.chamadasCards += 1; return falsos.cards(); },
    lerEtapasAtuais: async () => ({ itens: [etapa], amostra: false }),
    lerEntregas: async () => { if (falsos.falharEntregas) throw new Error('x'); return { itens: [entrega], amostra: false }; },
  };
  const pedidos = {
    listar: async () => { if (falsos.falharPedidos) throw new Error('x'); return { limite: falsos.pedidosLimite, itens: [pedido] }; },
  } as unknown as RepositorioPedidosV2;
  const config = {
    listar: async () => { if (falsos.falharConfig) throw new Error('x'); return [revisao]; },
    ler: async () => detalhe,
  } as unknown as RepositorioConfigV2;
  const useHook = criarUseDadosComando({
    comando: async () => { falsos.chamadasFabrica += 1; if (falsos.falharComando) throw new Error('x'); return comando; }, pedidos: async () => pedidos, config: async () => config,
  });
  return { falsos, useHook };
}

describe('useDadosComando', () => {
  it('mantém a assinatura sem argumentos', () => {
    expect(typeof useDadosComando).toBe('function');
    expect(useDadosComando.length).toBe(0);
  });

  it('carrega as cinco fontes e as expõe prontas', async () => {
    const { useHook } = montar();
    const { result } = renderHook(() => useHook());
    expect(result.current.carregando).toBe(true);
    expect(result.current.dados.estado.cards).toBe('carregando');
    await waitFor(() => expect(result.current.carregando).toBe(false));
    const { dados, atualizadoEm } = result.current;
    expect(dados.estado).toEqual({ cards: 'pronta', etapas: 'pronta', entregas: 'pronta', pedidos: 'pronta', catalogo: 'pronta' });
    expect(dados.cards).toHaveLength(1);
    expect(dados.etapas).toHaveLength(1);
    expect(dados.entregas).toHaveLength(1);
    expect(dados.pedidos).toHaveLength(1);
    expect(dados.catalogo.agentes[0].identidade).toBe('HELENA');
    expect(dados.amostra).toBe(false);
    expect(atualizadoEm).toBeInstanceOf(Date);
    expect(dados.agora).toBeInstanceOf(Date);
  });

  it('uma fonte que falha não derruba as outras', async () => {
    const { useHook } = montar({ falharConfig: true, falharEntregas: true });
    const { result } = renderHook(() => useHook());
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.dados.estado).toEqual({ cards: 'pronta', etapas: 'pronta', entregas: 'erro', pedidos: 'pronta', catalogo: 'erro' });
    expect(result.current.dados.cards).toHaveLength(1);
    expect(result.current.dados.pedidos).toHaveLength(1);
    expect(result.current.dados.catalogo.agentes).toEqual([]);
    expect(result.current.atualizadoEm).not.toBeNull();
  });

  it('com todas as fontes em falha não marca atualização', async () => {
    const { useHook } = montar({ falharComando: true, falharConfig: true, falharPedidos: true, falharEntregas: true });
    const { result } = renderHook(() => useHook());
    await waitFor(() => expect(result.current.dados.estado.cards).toBe('erro'));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.atualizadoEm).toBeNull();
  });

  it('marca amostra quando qualquer leitura é cortada pelo limite, inclusive pedidos', async () => {
    const corte = montar({ cards: async () => ({ itens: [card('c1')], amostra: true }) });
    const a = renderHook(() => corte.useHook());
    await waitFor(() => expect(a.result.current.carregando).toBe(false));
    expect(a.result.current.dados.amostra).toBe(true);

    const pedidosCortados = montar({ pedidosLimite: 1 });
    const b = renderHook(() => pedidosCortados.useHook());
    await waitFor(() => expect(b.result.current.carregando).toBe(false));
    expect(b.result.current.dados.amostra).toBe(true);
  });

  it('recarregar mantém os dados anteriores e não volta ao carregamento total', async () => {
    const { useHook, falsos } = montar();
    const { result } = renderHook(() => useHook());
    await waitFor(() => expect(result.current.carregando).toBe(false));
    const primeira = result.current.atualizadoEm;
    let liberar: (v: LeituraComando<CardComando>) => void = () => undefined;
    falsos.cards = () => new Promise(resolve => { liberar = resolve; });
    act(() => result.current.recarregar());
    await waitFor(() => expect(falsos.chamadasCards).toBe(2));
    expect(result.current.carregando).toBe(false);
    expect(result.current.dados.estado.cards).toBe('pronta');
    expect(result.current.dados.cards.map(c => c.id)).toEqual(['c1']);
    await act(async () => { liberar({ itens: [card('c2')], amostra: false }); });
    await waitFor(() => expect(result.current.dados.cards.map(c => c.id)).toEqual(['c2']));
    await waitFor(() => expect(result.current.atualizadoEm).not.toBe(primeira));
  });

  it('em recargas concorrentes a última vence, mesmo que a antiga termine depois', async () => {
    const { useHook, falsos } = montar();
    const { result } = renderHook(() => useHook());
    await waitFor(() => expect(result.current.carregando).toBe(false));
    const liberadores: Array<(v: LeituraComando<CardComando>) => void> = [];
    falsos.cards = () => new Promise(resolve => { liberadores.push(resolve); });
    act(() => { result.current.recarregar(); result.current.recarregar(); });
    await waitFor(() => expect(liberadores).toHaveLength(2));
    await act(async () => { liberadores[1]({ itens: [card('nova')], amostra: false }); });
    await waitFor(() => expect(result.current.dados.cards.map(c => c.id)).toEqual(['nova']));
    await act(async () => { liberadores[0]({ itens: [card('velha')], amostra: true }); });
    expect(result.current.dados.cards.map(c => c.id)).toEqual(['nova']);
    expect(result.current.dados.amostra).toBe(false);
  });

  it('não atualiza depois de desmontar', async () => {
    const { useHook, falsos } = montar();
    let liberar: (v: LeituraComando<CardComando>) => void = () => undefined;
    falsos.cards = () => new Promise(resolve => { liberar = resolve; });
    const erros: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { erros.push(args); };
    try {
      const { result, unmount } = renderHook(() => useHook());
      await waitFor(() => expect(result.current.dados.estado.etapas).toBe('pronta'));
      await waitFor(() => expect(falsos.chamadasCards).toBe(1));
      unmount();
      await act(async () => { liberar({ itens: [card('c9')], amostra: false }); });
      expect(result.current.dados.cards).toEqual([]);
      expect(result.current.dados.estado.cards).toBe('carregando');
    } finally { console.error = original; }
    expect(erros).toEqual([]);
  });

  it('só cria o repositório ao montar o gancho, nunca ao criá-lo', async () => {
    const { falsos, useHook } = montar();
    expect(falsos.chamadasFabrica).toBe(0);
    const { result } = renderHook(() => useHook());
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(falsos.chamadasFabrica).toBe(3);
  });
});
