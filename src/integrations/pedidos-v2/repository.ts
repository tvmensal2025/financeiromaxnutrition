/** Entrada de triagem. Receber um pedido ainda não cria nem executa um card. */
export const LIMITE_TEXTO_PEDIDO = 10_000;
export const uuidValido = (valor: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);
export type EnvioPedido = { requestId: string; eventoId: string; texto: string };
export type PedidoEntrada = {
  pedido_id: string; request_id: string; estado: 'RECEBIDO'; texto_inicial: string;
  total_eventos: number; criado_em: string; atualizado_em: string;
  origem_inicial: 'SITE' | 'CODEX' | 'TELEGRAM';
};
export type ListaPedidos = { limite: number; itens: PedidoEntrada[] };
export type EventoPedido = { origem: 'SITE' | 'CODEX' | 'TELEGRAM'; evento_id: string; texto: string; recebido_em: string };
export type DetalhePedidoEntrada = PedidoEntrada & { eventos: EventoPedido[] };
export interface RepositorioPedidosV2 {
  receber(envio: EnvioPedido): Promise<PedidoEntrada>;
  ler(requestId: string): Promise<DetalhePedidoEntrada | null>;
  listar(): Promise<ListaPedidos>;
}
type Resposta = { data: unknown; error: { code?: string; message?: string } | null };
export interface ClientePedidosV2 {
  schema(nome: string): { rpc(nome: string, argumentos?: Record<string, unknown>): PromiseLike<Resposta> };
}
export class ErroEntradaPedidos extends Error {
  constructor(public readonly codigo?: string) {
    super(codigo === 'PGRST202' || codigo === '42883'
      ? 'O recebimento de pedidos ainda não está disponível neste ambiente.'
      : codigo === '42501' ? 'Entre com a conta do fundador para consultar ou registrar pedidos.'
        : codigo === '23505' ? 'Este identificador já foi usado em outro pedido. Consulte o pedido antes de continuar.'
          : 'Não foi possível confirmar o pedido no banco.');
  }
}
function objeto(valor: unknown): valor is Record<string, unknown> {
  return !!valor && typeof valor === 'object' && !Array.isArray(valor);
}
function lerRecibo(valor: unknown): PedidoEntrada {
  if (!objeto(valor) || typeof valor.pedido_id !== 'string' || !uuidValido(valor.pedido_id)
      || typeof valor.request_id !== 'string' || !uuidValido(valor.request_id) || valor.estado !== 'RECEBIDO'
      || typeof valor.texto_inicial !== 'string' || !valor.texto_inicial.trim()
      || typeof valor.total_eventos !== 'number' || !Number.isSafeInteger(valor.total_eventos) || valor.total_eventos < 1
      || typeof valor.criado_em !== 'string' || !Number.isFinite(Date.parse(valor.criado_em))
      || typeof valor.atualizado_em !== 'string' || !Number.isFinite(Date.parse(valor.atualizado_em))
      || typeof valor.origem_inicial !== 'string' || !['SITE', 'CODEX', 'TELEGRAM'].includes(valor.origem_inicial)) {
    throw new Error('O banco não confirmou um recibo válido.');
  }
  return valor as PedidoEntrada;
}
export function validarEnvioPedido(envio: EnvioPedido) {
  if (!uuidValido(envio.requestId) || !envio.eventoId.trim() || envio.eventoId.length > 160
      || !envio.texto.trim() || envio.texto.length > LIMITE_TEXTO_PEDIDO) {
    throw new Error(`Escreva um pedido com até ${LIMITE_TEXTO_PEDIDO.toLocaleString('pt-BR')} caracteres.`);
  }
}
export function criarRepositorioPedidosV2(cliente: ClientePedidosV2): RepositorioPedidosV2 {
  const banco = cliente.schema('helena_v2');
  async function consultar(nome: string, argumentos: Record<string, unknown>) {
    let resposta: Resposta;
    try { resposta = await banco.rpc(nome, argumentos); }
    catch { throw new ErroEntradaPedidos(); }
    const { data, error } = resposta;
    if (error) throw new ErroEntradaPedidos(error.code);
    return data;
  }
  return {
    async receber(envio) {
      validarEnvioPedido(envio);
      const recibo = lerRecibo(await consultar('receber_pedido_entrada', {
        p_request_id: envio.requestId, p_origem: 'SITE', p_evento_id: envio.eventoId, p_texto: envio.texto,
      }));
      if (recibo.request_id !== envio.requestId) throw new Error('O recibo não corresponde ao pedido enviado.');
      return recibo;
    },
    async ler(requestId) {
      if (!uuidValido(requestId)) throw new Error('Identificador do pedido inválido.');
      const data = await consultar('ler_pedido_entrada', { p_request_id: requestId });
      if (data === null) return null;
      const recibo = lerRecibo(data);
      if (recibo.request_id !== requestId) throw new Error('O recibo não corresponde ao pedido consultado.');
      if (!objeto(data) || !Array.isArray(data.eventos) || data.eventos.length !== recibo.total_eventos) {
        throw new Error('O banco não devolveu as mensagens deste pedido.');
      }
      const eventos = data.eventos.map((evento: unknown): EventoPedido => {
        if (!objeto(evento) || typeof evento.origem !== 'string' || !['SITE', 'CODEX', 'TELEGRAM'].includes(evento.origem)
            || typeof evento.evento_id !== 'string' || !evento.evento_id.trim() || evento.evento_id.length > 160
            || typeof evento.texto !== 'string' || !evento.texto.trim() || evento.texto.length > LIMITE_TEXTO_PEDIDO
            || typeof evento.recebido_em !== 'string' || !Number.isFinite(Date.parse(evento.recebido_em))) {
          throw new Error('O banco não confirmou as mensagens deste pedido.');
        }
        return evento as EventoPedido;
      });
      return { ...recibo, eventos };
    },
    async listar() {
      const data = await consultar('listar_pedidos_entrada', { p_limite: 50 });
      if (!objeto(data) || !Number.isSafeInteger(data.limite) || Number(data.limite) < 1
          || Number(data.limite) > 100 || !Array.isArray(data.itens) || data.itens.length > Number(data.limite)) {
        throw new Error('O banco não devolveu a lista de pedidos.');
      }
      return { limite: Number(data.limite), itens: data.itens.map(lerRecibo) };
    },
  };
}
