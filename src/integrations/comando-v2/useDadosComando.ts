/**
 * O que é: gancho que entrega `DadosComando` às abas da Sala de comando v2, lendo SÓ o esquema helena_v2: cards, etapas
 * atuais e entregas (sem corpo), pedidos de entrada e o catálogo da configuração ativa. Nunca a fila agent_jobs da v1.
 * Como mudar: cada fonte é independente (uma falha marca só o estado dela como 'erro'; as outras seguem). Recarregar
 * mantém os dados anteriores até chegar o novo, e a última recarga vence. Para testar, use `criarUseDadosComando(deps)`
 * com repositórios falsos; `useDadosComando` (sem argumentos) usa os repositórios reais do app.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RepositorioConfigV2 } from '@/integrations/config-v2/repository';
import { repositorioConfigV2DoApp } from '@/integrations/config-v2/runtime';
import type { RepositorioPedidosV2 } from '@/integrations/pedidos-v2/repository';
import { repositorioPedidosV2DoApp } from '@/integrations/pedidos-v2/runtime';
import { lerCatalogoComandoAtivo } from './catalogo-comando';
import type { RepositorioComandoV2 } from './repository';
import { repositorioComandoV2DoApp } from './runtime';
import { dadosVazios, type DadosComando, type ResultadoDadosComando, type UsarDadosComando } from './tipos';

/** Fábricas (e não repositórios prontos) para que o cliente do Supabase só seja carregado ao ler. */
export type DependenciasComando = {
  comando: () => Promise<RepositorioComandoV2>;
  pedidos: () => Promise<RepositorioPedidosV2>;
  config: () => Promise<RepositorioConfigV2>;
  /** Relógio injetável; o padrão é `new Date()`. */
  agora?: () => Date;
};

export const dependenciasPadrao: DependenciasComando = {
  comando: repositorioComandoV2DoApp,
  pedidos: repositorioPedidosV2DoApp,
  config: repositorioConfigV2DoApp,
};

type Cortes = { cards: boolean; etapas: boolean; entregas: boolean; pedidos: boolean };
type Interno = { dados: DadosComando; cortes: Cortes; carregando: boolean; atualizadoEm: Date | null };
type Atualizacao = (anterior: Interno) => Interno;

function inicial(agora: Date): Interno {
  return {
    dados: dadosVazios(agora), carregando: true, atualizadoEm: null,
    cortes: { cards: false, etapas: false, entregas: false, pedidos: false },
  };
}

type Chave = keyof DadosComando['estado'];

/** Aplica o resultado de UMA fonte sem tocar nas outras. Em erro mantém os itens anteriores, mas o estado vira 'erro'. */
function aplicar<K extends Chave>(
  chave: K, agora: Date, resultado: { itens?: DadosComando[K]; corte?: boolean } | null,
): Atualizacao {
  return anterior => {
    const dados: DadosComando = { ...anterior.dados, agora, estado: { ...anterior.dados.estado, [chave]: resultado ? 'pronta' : 'erro' } };
    const cortes = { ...anterior.cortes };
    if (resultado?.itens !== undefined) (dados as Record<string, unknown>)[chave] = resultado.itens;
    if (resultado && chave !== 'catalogo') cortes[chave as keyof Cortes] = resultado.corte === true;
    dados.amostra = Object.values(cortes).some(Boolean);
    return { ...anterior, dados, cortes };
  };
}

export function criarUseDadosComando(deps: DependenciasComando = dependenciasPadrao): UsarDadosComando {
  const relogio = deps.agora ?? (() => new Date());
  return function useDadosComandoInjetado(): ResultadoDadosComando {
    const [interno, setInterno] = useState<Interno>(() => inicial(relogio()));
    const montado = useRef(false);
    const rodada = useRef(0);

    const carregar = useCallback(() => {
      const minha = ++rodada.current;
      // Resultado de rodada antiga ou depois de desmontar é descartado (a última recarga vence).
      const aceitar = (atualizacao: Atualizacao) => { if (montado.current && minha === rodada.current) setInterno(atualizacao); };
      const fonte = <K extends Chave, T>(chave: K, ler: () => Promise<T>, ok: (valor: T) => { itens?: DadosComando[K]; corte?: boolean }) =>
        ler().then(
          valor => { aceitar(aplicar(chave, relogio(), ok(valor))); return true; },
          () => { aceitar(aplicar(chave, relogio(), null)); return false; },
        );
      const leituras = [
        fonte('cards', async () => (await deps.comando()).lerCards(), r => ({ itens: r.itens, corte: r.amostra })),
        fonte('etapas', async () => (await deps.comando()).lerEtapasAtuais(), r => ({ itens: r.itens, corte: r.amostra })),
        fonte('entregas', async () => (await deps.comando()).lerEntregas(), r => ({ itens: r.itens, corte: r.amostra })),
        fonte('pedidos', async () => (await deps.pedidos()).listar(), r => ({ itens: r.itens, corte: r.limite > 0 && r.itens.length >= r.limite })),
        fonte('catalogo', async () => lerCatalogoComandoAtivo(await deps.config()), catalogo => ({ itens: catalogo })),
      ];
      void Promise.allSettled(leituras).then(resultados => {
        const algumaOk = resultados.some(r => r.status === 'fulfilled' && r.value);
        const fim = relogio();
        aceitar(anterior => ({ ...anterior, carregando: false, atualizadoEm: algumaOk ? fim : anterior.atualizadoEm }));
      });
    }, []);

    useEffect(() => {
      montado.current = true;
      carregar();
      return () => { montado.current = false; rodada.current += 1; };
    }, [carregar]);

    return { dados: interno.dados, carregando: interno.carregando, atualizadoEm: interno.atualizadoEm, recarregar: carregar };
  };
}

export const useDadosComando: UsarDadosComando = criarUseDadosComando();
