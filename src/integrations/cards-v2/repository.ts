/** Contrato mínimo e injetável. Este módulo não cria conexões nem importa o cliente global. */
export type RespostaBancoV2 = { data: unknown; error: { message: string; code?: string } | null };
export class ErroBancoCardsV2 extends Error {
  constructor(message: string, public readonly codigo?: string) { super(message); }
}
export interface ConsultaCardsV2 extends PromiseLike<RespostaBancoV2> {
  eq(coluna: string, valor: unknown): ConsultaCardsV2;
  order(coluna: string, opcoes?: { ascending: boolean }): ConsultaCardsV2;
  limit(quantidade: number): ConsultaCardsV2;
  maybeSingle(): PromiseLike<RespostaBancoV2>;
}
export interface ClienteCardsV2 {
  schema(nome: string): {
    from(tabela: string): { select(colunas: string): ConsultaCardsV2 };
    rpc(nome: string, argumentos?: Record<string, unknown>): PromiseLike<RespostaBancoV2>;
  };
}
export type CardV2 = {
  id: string; titulo: string; empresa: string | null; estado: string;
  dono: string | null; prazo: string; criado_em: string;
};
export type EtapaV2 = {
  id: string; codigo: string; nome: string; estado: string; autor: string;
  dono: string | null; prazo_ate: string | null; revisores: string[];
  versao: number; portao1_ok: boolean; entrega_fresca: boolean;
};
export type EntregaV2 = {
  id: number; etapa_id: string; versao: number; portao1: string | null;
  conteudo: unknown; criada_em: string;
};
export type DetalheCardV2 = { etapas: EtapaV2[]; entregas: EntregaV2[] };
export type PedidoPublicacao = { id?: string | number; pedido_id?: string | number; pedido_em: string; dia_brasilia: string };
export type SituacaoPublicacao = { fundador: boolean; dia_brasilia: string; pedido: PedidoPublicacao | null };
export type SolicitacaoCardReal = {
  tarefaId: string;
  prazo: string;
  plano: Record<string, unknown>;
  dadosReais: Record<string, unknown>;
  configRevisionId: string | null;
  chaveIdempotencia: string;
};
export type ResultadoSolicitacaoCardReal = { id: string; card_id: string | null };
export type ResumoSolicitacaoCardReal = ResultadoSolicitacaoCardReal & { chave_origem: string; criado_em: string };
export interface RepositorioCardsV2 {
  listar(): Promise<CardV2[]>;
  detalhar(cardId: string): Promise<DetalheCardV2>;
  situacaoPublicacao(): Promise<SituacaoPublicacao>;
  pedirPublicacao(): Promise<void>;
  solicitarCardReal(pedido: SolicitacaoCardReal): Promise<ResultadoSolicitacaoCardReal>;
  consultarSolicitacaoPorChave(chaveIdempotencia: string): Promise<ResultadoSolicitacaoCardReal | null>;
  listarSolicitacoesReais(): Promise<ResumoSolicitacaoCardReal[]>;
  consultarSolicitacaoPorTarefa(tarefaId: string): Promise<ResumoSolicitacaoCardReal | null>;
}
async function ler<T>(consulta: PromiseLike<RespostaBancoV2>): Promise<T> {
  const resultado = await consulta;
  if (resultado.error) throw new Error('Não foi possível consultar os cards. Tente novamente.');
  if (resultado.data === null) throw new Error('O banco não devolveu os dados esperados.');
  return resultado.data as T;
}
export function criarRepositorioCardsV2(cliente: ClienteCardsV2): RepositorioCardsV2 {
  const banco = cliente.schema('helena_v2');
  return {
    listar: () => ler<CardV2[]>(banco.from('card')
      .select('id,titulo,empresa,estado,dono,prazo,criado_em').order('criado_em', { ascending: false })),
    async detalhar(cardId) {
      const [etapas, entregas] = await Promise.all([
        ler<EtapaV2[]>(banco.from('etapa')
          .select('id,codigo,nome,estado,autor,dono,prazo_ate,revisores,versao,portao1_ok,entrega_fresca')
          .eq('card_id', cardId).eq('atual', true).order('ordem')),
        ler<EntregaV2[]>(banco.from('entrega').select('id,etapa_id,versao,portao1,conteudo,criada_em')
          .eq('card_id', cardId).eq('portao1', 'PASSOU').order('id')),
      ]);
      const aprovadas = new Map(etapas.filter(e =>
        ['APROVADA', 'PRONTA'].includes(e.estado) && e.portao1_ok && e.entrega_fresca,
      ).map(e => [e.id, e.versao]));
      return { etapas, entregas: entregas.filter(e => aprovadas.get(e.etapa_id) === e.versao) };
    },
    situacaoPublicacao: () => ler<SituacaoPublicacao>(banco.rpc('situacao_publicacao')),
    async pedirPublicacao() {
      const { error } = await banco.rpc('pedir_publicacao');
      if (error) throw new Error('Não foi possível registrar. Confira se você já fez o pedido hoje ou tente novamente.');
    },
    async solicitarCardReal(pedido) {
      const { data, error } = await banco.rpc('solicitar_card_real', {
        p_tarefa_id: pedido.tarefaId,
        p_prazo: pedido.prazo,
        p_plano: pedido.plano,
        p_dados_reais: pedido.dadosReais,
        p_config_revision_id: pedido.configRevisionId,
        p_chave_idempotencia: pedido.chaveIdempotencia,
      });
      if (error) throw new ErroBancoCardsV2(error.message || 'O banco recusou o pedido.', error.code);
      if (!data || typeof data !== 'object' || typeof (data as ResultadoSolicitacaoCardReal).id !== 'string') {
        throw new Error('O banco não confirmou o identificador do pedido.');
      }
      return data as ResultadoSolicitacaoCardReal;
    },
    async consultarSolicitacaoPorChave(chaveIdempotencia) {
      const { data, error } = await banco.from('solicitacao_card_real')
        .select('id,card_id')
        .eq('chave_idempotencia', chaveIdempotencia).maybeSingle();
      if (error) throw new Error(error.message || 'Não foi possível consultar a solicitação.');
      if (data === null) return null;
      if (!data || typeof data !== 'object' || typeof (data as ResultadoSolicitacaoCardReal).id !== 'string') {
        throw new Error('O banco não devolveu a solicitação esperada.');
      }
      return data as ResultadoSolicitacaoCardReal;
    },
    listarSolicitacoesReais: () => ler<ResumoSolicitacaoCardReal[]>(banco.from('solicitacao_card_real')
      .select('id,chave_origem,card_id,criado_em').order('criado_em', { ascending: false }).limit(20)),
    async consultarSolicitacaoPorTarefa(tarefaId) {
      const { data, error } = await banco.from('solicitacao_card_real')
        .select('id,chave_origem,card_id,criado_em').eq('chave_origem', tarefaId)
        .order('criado_em', { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error(error.message || 'Não foi possível consultar solicitações desta tarefa.');
      if (data === null) return null;
      if (!data || typeof data !== 'object' || typeof (data as ResumoSolicitacaoCardReal).id !== 'string') {
        throw new Error('O banco não devolveu a solicitação esperada.');
      }
      return data as ResumoSolicitacaoCardReal;
    },
  };
}
