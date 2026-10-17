/**
 * O que é: as leituras EM LOTE da Sala de comando v2 (cards, etapas atuais e entregas sem corpo), só no esquema helena_v2
 * e só nas tabelas que o navegador pode ler (card, etapa, entrega; RLS sou_fundador, grant select da migration 0005).
 * Como mudar: toda coluna pedida aqui existe nas migrations 0001/0002 (cite a migration ao acrescentar uma). Coluna que
 * não existir deve voltar como null, nunca ser pedida. Este módulo não cria conexão: o cliente entra por injeção.
 */
import type { CardV2, EtapaV2, RespostaBancoV2 } from '@/integrations/cards-v2/repository';
import type { CardComando, EntregaResumo, EtapaComando } from './tipos';

/** O Supabase corta respostas no teto do servidor (1000 por padrão): por isso lemos em páginas e com limite nosso. */
export const TAMANHO_PAGINA = 1000;
export const LIMITE_CARDS = 500;
export const LIMITE_ETAPAS = 3000;
export const LIMITE_ENTREGAS = 1500;

export interface ConsultaComandoV2 extends PromiseLike<RespostaBancoV2> {
  eq(coluna: string, valor: unknown): ConsultaComandoV2;
  order(coluna: string, opcoes?: { ascending: boolean }): ConsultaComandoV2;
  range(de: number, ate: number): ConsultaComandoV2;
}
export interface ClienteComandoV2 {
  schema(nome: string): { from(tabela: string): { select(colunas: string): ConsultaComandoV2 } };
}

/** `amostra` = a leitura bateu no limite: pode haver mais linhas no banco do que as devolvidas. */
export type LeituraComando<T> = { itens: T[]; amostra: boolean };

export interface RepositorioComandoV2 {
  lerCards(): Promise<LeituraComando<CardComando>>;
  lerEtapasAtuais(): Promise<LeituraComando<EtapaComando>>;
  lerEntregas(): Promise<LeituraComando<EntregaResumo>>;
}

// card: 0001 (id,titulo,empresa,estado,dono,prazo,criado_em,atualizado_em,prioridade,prazo_ate,versao); 0002 (motivo,pedido_grande).
export const COLUNAS_CARD = 'id,titulo,empresa,estado,dono,prazo,criado_em,versao,motivo,pedido_grande,atualizado_em,prazo_ate,prioridade';
// etapa: 0001 (id,card_id,codigo,ordem,nome,atual,autor,revisores,estado,dono,prazo_ate,versao,portao1_ok,entrega_fresca,atualizado_em);
// 0002 (motivo,julgadora,revisor,execucoes).
export const COLUNAS_ETAPA = 'id,codigo,nome,estado,autor,dono,prazo_ate,revisores,versao,portao1_ok,entrega_fresca,motivo,revisor,julgadora,card_id,ordem,atualizado_em,execucoes';
// entrega: 0001 (id,card_id,etapa_id,etapa_codigo,versao,autor,parecer,usou_internet,portao1,criada_em). SEM `conteudo`.
export const COLUNAS_ENTREGA = 'id,card_id,etapa_id,etapa_codigo,versao,autor,portao1,criada_em,parecer,usou_internet';

type Linha = Record<string, unknown>;
const texto = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

async function lerPaginado(
  nome: string, consulta: (de: number, ate: number) => ConsultaComandoV2, limite: number,
): Promise<LeituraComando<Linha>> {
  const linhas: Linha[] = [];
  while (linhas.length < limite) {
    const de = linhas.length;
    const ate = Math.min(de + TAMANHO_PAGINA, limite) - 1;
    const { data, error } = await consulta(de, ate);
    if (error) throw new Error(`Não foi possível ler ${nome}. Tente novamente.`);
    if (!Array.isArray(data)) throw new Error(`O banco não devolveu a lista de ${nome}.`);
    linhas.push(...(data as Linha[]));
    if (data.length < ate - de + 1) break; // página curta: acabou
  }
  return { itens: linhas.slice(0, limite), amostra: linhas.length >= limite };
}

export function criarRepositorioComandoV2(cliente: ClienteComandoV2): RepositorioComandoV2 {
  const banco = cliente.schema('helena_v2');
  return {
    async lerCards() {
      const { itens, amostra } = await lerPaginado('os cards', (de, ate) => banco.from('card').select(COLUNAS_CARD)
        .order('criado_em', { ascending: false }).order('id').range(de, ate), LIMITE_CARDS);
      return {
        amostra,
        itens: itens.map((c): CardComando => ({
          ...(c as unknown as CardV2),
          atualizado_em: texto(c.atualizado_em), prazo_ate: texto(c.prazo_ate), prioridade: numero(c.prioridade),
        })),
      };
    },
    async lerEtapasAtuais() {
      const { itens, amostra } = await lerPaginado('as etapas', (de, ate) => banco.from('etapa').select(COLUNAS_ETAPA)
        .eq('atual', true).order('criado_em', { ascending: false }).order('id').range(de, ate), LIMITE_ETAPAS);
      return {
        amostra,
        itens: itens.map((e): EtapaComando => ({
          ...(e as unknown as EtapaV2),
          card_id: String(e.card_id), ordem: numero(e.ordem), atualizado_em: texto(e.atualizado_em), execucoes: numero(e.execucoes),
        })),
      };
    },
    async lerEntregas() {
      const { itens, amostra } = await lerPaginado('as entregas', (de, ate) => banco.from('entrega').select(COLUNAS_ENTREGA)
        .order('id', { ascending: false }).range(de, ate), LIMITE_ENTREGAS);
      return {
        amostra,
        itens: itens.map((e): EntregaResumo => ({
          id: String(e.id), card_id: String(e.card_id), etapa_id: String(e.etapa_id),
          etapa_codigo: texto(e.etapa_codigo), versao: numero(e.versao) ?? 0, autor: texto(e.autor),
          portao1: texto(e.portao1) ?? '', criada_em: String(e.criada_em), parecer: texto(e.parecer),
          // No banco é texto 'SIM'/'NAO' (0001); qualquer outra coisa vira "não informado".
          usou_internet: e.usou_internet === 'SIM' ? true : e.usou_internet === 'NAO' ? false : null,
        })),
      };
    },
  };
}
