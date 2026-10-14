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
  versao?: number; motivo?: string; pedido_grande?: boolean;
};
export type EtapaV2 = {
  id: string; codigo: string; nome: string; estado: string; autor: string;
  dono: string | null; prazo_ate: string | null; revisores: string[];
  versao: number; portao1_ok: boolean; entrega_fresca: boolean;
  motivo?: string; revisor?: string; julgadora?: boolean;
};
export type AcaoExternaV2 = { id: string; codigo: string; etapa_codigo: string; estado: string;
  tipo: string; versao: number; tem_ferramenta: boolean };
export type EntregaV2 = {
  id: number; etapa_id: string; versao: number; portao1: string | null;
  conteudo: unknown; criada_em: string;
};
export type ResumoOrdemCardV2 = { pedido_original: string | null; como_e_o_pronto: unknown;
  nao_pode: unknown; fontes_que_pode_ler: unknown };
export type DetalheCardV2 = { etapas: EtapaV2[]; entregas: EntregaV2[]; acoes?: AcaoExternaV2[];
  ordem?: ResumoOrdemCardV2 | null };
export type EventoFundadorV2 = { maquina: 'card' | 'etapa' | 'acao_externa'; alvo: string;
  evento: 'RESPONDER' | 'APROVAR' | 'PEDIR_AJUSTE' | 'CANCELAR'; parametros: Record<string, string>;
  versaoVista: number | null; toque: string };
export type HistoricoToqueFundadorV2 = { historico_id: number; resultado: string; momento: string;
  maquina: EventoFundadorV2['maquina']; alvo_id: string; evento: EventoFundadorV2['evento'] };
export type PerguntaEtapaFundadorV2 = { card_id: string; etapa_id: string; versao: number; chave: number;
  historico_id: number; pergunta: string; opcoes: { letra: 'A' | 'B' | 'C'; texto: string; consequencia: string }[] };
export type LeituraCardFundadorV2 = { card_id: string; versao: number; motivo_atual: string;
  chave: number; historico_id: number; momento: string;
  escolha: { tipo: 'SERVICO' | 'ROTEIRO'; id: string } | null;
  leitura_de_volta: string | { o_que_quer: string; como_e_o_pronto: string[]; nao_pode: string[] } };
/** Estados do pedido de publicação (migration 0018). "No ar" só existe em PUBLICADA. */
export const ESTADOS_PUBLICACAO = ['PEDIDA', 'EM_EXECUCAO', 'PUBLICADA', 'FALHOU', 'REVERTIDA'] as const;
export type EstadoPublicacao = (typeof ESTADOS_PUBLICACAO)[number];
export type PedidoPublicacao = {
  id?: string | number; pedido_id?: string | number; pedido_em: string; dia_brasilia: string;
  // Os campos abaixo vêm da 0018. Banco anterior a ela não os envia: o pedido conta como PEDIDA (nunca como no ar).
  estado?: string | null; destino?: string | null; versao_publicada?: string | null;
  iniciada_em?: string | null; concluida_em?: string | null; falhou_em?: string | null;
  revertida_em?: string | null; erro?: string | null;
};
export type SituacaoPublicacao = { fundador: boolean; dia_brasilia: string; pedido: PedidoPublicacao | null };
/** Estado verdadeiro do pedido: sem estado = PEDIDA; estado que a tela não conhece = DESCONHECIDO (nunca "no ar"). */
export function estadoDoPedido(pedido: PedidoPublicacao): EstadoPublicacao | 'DESCONHECIDO' {
  if (pedido.estado === undefined || pedido.estado === null) return 'PEDIDA';
  return (ESTADOS_PUBLICACAO as readonly string[]).includes(pedido.estado) ? pedido.estado as EstadoPublicacao : 'DESCONHECIDO';
}
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
  aplicarEventoFundador(evento: EventoFundadorV2): Promise<{ resultado: string }>;
  consultarToqueFundador(cardId: string, toque: string): Promise<HistoricoToqueFundadorV2 | null>;
  lerPerguntaEtapaFundador(etapaId: string): Promise<PerguntaEtapaFundadorV2 | null>;
  lerLeituraCardFundador(cardId: string): Promise<LeituraCardFundadorV2 | null>;
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
      .select('id,titulo,empresa,estado,dono,prazo,criado_em,versao,motivo,pedido_grande').order('criado_em', { ascending: false })),
    async detalhar(cardId) {
      const [etapas, entregas, acoes, ordem] = await Promise.all([
        ler<EtapaV2[]>(banco.from('etapa')
          .select('id,codigo,nome,estado,autor,dono,prazo_ate,revisores,versao,portao1_ok,entrega_fresca,motivo,revisor,julgadora')
          .eq('card_id', cardId).eq('atual', true).order('ordem')),
        ler<EntregaV2[]>(banco.from('entrega').select('id,etapa_id,versao,portao1,conteudo,criada_em')
          .eq('card_id', cardId).eq('portao1', 'PASSOU').order('id')),
        ler<AcaoExternaV2[]>(banco.rpc('listar_acoes_card', { p_card_id: cardId })),
        ler<ResumoOrdemCardV2>(banco.from('card').select('pedido_original:ordem_de_servico->>pedido_original,como_e_o_pronto:ordem_de_servico->como_e_o_pronto,nao_pode:ordem_de_servico->nao_pode,fontes_que_pode_ler:ordem_de_servico->fontes_que_pode_ler')
          .eq('id', cardId).maybeSingle()),
      ]);
      const aprovadas = new Map(etapas.filter(e =>
        ['APROVADA', 'PRONTA'].includes(e.estado) && e.portao1_ok && e.entrega_fresca,
      ).map(e => [e.id, e.versao]));
      return { etapas, entregas: entregas.filter(e => aprovadas.get(e.etapa_id) === e.versao), acoes, ordem };
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
    async aplicarEventoFundador(evento) {
      const { data, error } = await banco.rpc('aplicar_evento', {
        p_maquina: evento.maquina, p_alvo: evento.alvo, p_papel: 'FUNDADOR', p_evento: evento.evento,
        p_parametros: evento.parametros, p_ator: null, p_chave: null, p_versao_vista: evento.versaoVista,
        p_conteudo: null, p_toque: evento.toque, p_automaticos: true,
      });
      if (error) throw new ErroBancoCardsV2(error.message || 'O banco recusou esta ação.', error.code);
      if (!data || typeof data !== 'object' || typeof (data as { resultado?: unknown }).resultado !== 'string') {
        throw new Error('O banco não confirmou o estado desta ação.');
      }
      return data as { resultado: string };
    },
    async consultarToqueFundador(cardId, toque) {
      const { data, error } = await banco.rpc('consultar_toque_fundador', { p_card_id: cardId, p_toque: toque });
      if (error) throw new ErroBancoCardsV2(error.message || 'Não foi possível consultar o toque.', error.code);
      return data as HistoricoToqueFundadorV2 | null;
    },
    async lerPerguntaEtapaFundador(etapaId) {
      const { data, error } = await banco.rpc('ler_pergunta_etapa_fundador', { p_etapa_id: etapaId });
      if (error) throw new ErroBancoCardsV2(error.message || 'Não foi possível ler a pergunta.', error.code);
      return data as PerguntaEtapaFundadorV2 | null;
    },
    async lerLeituraCardFundador(cardId) {
      const { data, error } = await banco.rpc('ler_leitura_card_fundador', { p_card_id: cardId });
      if (error) throw new ErroBancoCardsV2(error.message || 'Não foi possível ler a interpretação da Helena.', error.code);
      return data as LeituraCardFundadorV2 | null;
    },
  };
}
