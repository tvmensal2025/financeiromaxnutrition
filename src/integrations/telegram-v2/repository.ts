/** Pareamento do bot com a conta autenticada do fundador. O código nunca é persistido pelo cliente. */
export type CodigoPareamentoTelegramV2 = { codigo: string; expira_em: string };
export type StatusPareamentoTelegramV2 = {
  vinculado: boolean;
  chat_id: string | null;
  usuario_id: string | null;
  vinculado_em: string | null;
  codigo_pendente: boolean;
  codigo_expira_em: string | null;
};
export interface RepositorioPareamentoTelegramV2 {
  gerar(): Promise<CodigoPareamentoTelegramV2>;
  consultar(): Promise<StatusPareamentoTelegramV2>;
  revogar(): Promise<StatusPareamentoTelegramV2>;
}
type Resposta = { data: unknown; error: { code?: string; message?: string } | null };
export interface ClientePareamentoTelegramV2 {
  schema(nome: string): { rpc(nome: string): PromiseLike<Resposta> };
}

export class ErroPareamentoTelegramV2 extends Error {
  constructor(codigo?: string) {
    super(codigo === '42501' ? 'Entre com a conta do fundador para consultar ou alterar o vínculo do Telegram.'
      : codigo === '23505' ? 'Este Telegram já está vinculado. Consulte a situação antes de gerar outro código.'
        : codigo === 'PGRST202' || codigo === '42883' ? 'O pareamento Telegram ainda não está disponível neste ambiente.'
          : 'Não foi possível confirmar o pareamento Telegram no banco.');
  }
}

function objeto(valor: unknown): valor is Record<string, unknown> {
  return !!valor && typeof valor === 'object' && !Array.isArray(valor);
}
function dataValida(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0 && Number.isFinite(Date.parse(valor));
}
function textoOuNulo(valor: unknown): valor is string | null {
  return valor === null || typeof valor === 'string' && valor.length > 0;
}
function lerStatus(valor: unknown): StatusPareamentoTelegramV2 {
  if (!objeto(valor) || typeof valor.vinculado !== 'boolean'
      || !textoOuNulo(valor.chat_id) || !textoOuNulo(valor.usuario_id)
      || !(valor.vinculado_em === null || dataValida(valor.vinculado_em))
      || typeof valor.codigo_pendente !== 'boolean'
      || !(valor.codigo_expira_em === null || dataValida(valor.codigo_expira_em))
      || (valor.vinculado && (!valor.chat_id || !valor.usuario_id || !valor.vinculado_em))
      || (!valor.vinculado && (valor.chat_id !== null || valor.usuario_id !== null || valor.vinculado_em !== null))
      || (valor.codigo_pendente !== (valor.codigo_expira_em !== null))) {
    throw new Error('O banco não confirmou uma situação de pareamento válida.');
  }
  return valor as StatusPareamentoTelegramV2;
}
function lerCodigo(valor: unknown): CodigoPareamentoTelegramV2 {
  if (!objeto(valor) || typeof valor.codigo !== 'string' || !/^[0-9a-f]{48}$/i.test(valor.codigo)
      || !dataValida(valor.expira_em)) {
    throw new Error('O banco não confirmou um código de pareamento válido.');
  }
  return valor as CodigoPareamentoTelegramV2;
}

export function criarRepositorioPareamentoTelegramV2(cliente: ClientePareamentoTelegramV2): RepositorioPareamentoTelegramV2 {
  const banco = cliente.schema('helena_v2');
  async function consultarRpc(nome: string): Promise<unknown> {
    const { data, error } = await banco.rpc(nome);
    if (error) throw new ErroPareamentoTelegramV2(error.code);
    return data;
  }
  return {
    async gerar() { return lerCodigo(await consultarRpc('gerar_pareamento_telegram')); },
    async consultar() { return lerStatus(await consultarRpc('consultar_pareamento_telegram')); },
    async revogar() {
      const status = lerStatus(await consultarRpc('revogar_pareamento_telegram'));
      if (status.vinculado) throw new Error('O banco não confirmou a revogação do vínculo.');
      return status;
    },
  };
}
