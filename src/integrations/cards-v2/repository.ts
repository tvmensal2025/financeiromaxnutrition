/** Contrato mínimo e injetável. Este módulo não cria conexões nem importa o cliente global. */
export type RespostaBancoV2 = { data: unknown; error: { message: string } | null };
export interface ConsultaCardsV2 extends PromiseLike<RespostaBancoV2> {
  eq(coluna: string, valor: unknown): ConsultaCardsV2;
  order(coluna: string, opcoes?: { ascending: boolean }): ConsultaCardsV2;
}
export interface ClienteCardsV2 {
  schema(nome: string): {
    from(tabela: string): { select(colunas: string): ConsultaCardsV2 };
    rpc(nome: string): PromiseLike<RespostaBancoV2>;
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
export interface RepositorioCardsV2 {
  listar(): Promise<CardV2[]>;
  detalhar(cardId: string): Promise<DetalheCardV2>;
  situacaoPublicacao(): Promise<SituacaoPublicacao>;
  pedirPublicacao(): Promise<void>;
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
  };
}
