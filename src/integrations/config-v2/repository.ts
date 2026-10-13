export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type ConfigBundle = Record<string, JsonValue>;

export type ConfigRevision = {
  id: string;
  nome: string;
  versao: number;
  estado: 'RASCUNHO' | 'VALIDADA' | 'APOSENTADA';
  ativa: boolean;
  hash_sha256: string | null;
  criada_em: string;
  validada_em: string | null;
  aposentada_em: string | null;
  validacao_pendente?: boolean;
  resultado_validacao?: { ok: boolean; erros?: string[] } | null;
};
export type ConfigDetail = ConfigRevision & { conteudo: ConfigBundle };

export type RespostaConfig = { data: unknown; error: { message: string; code?: string } | null };
export interface ClienteConfigV2 {
  schema(nome: string): { rpc(nome: string, args?: Record<string, unknown>): PromiseLike<RespostaConfig> };
}
export interface RepositorioConfigV2 {
  listar(): Promise<ConfigRevision[]>;
  ler(id: string): Promise<ConfigDetail>;
  salvar(args: { nome: string; conteudo: ConfigBundle; id?: string; versao_esperada?: number; base_id?: string }): Promise<ConfigDetail>;
  solicitarValidacao(id: string, versao: number): Promise<ConfigRevision>;
  ativar(id: string, ativa_esperada: string | null): Promise<ConfigRevision>;
  aposentar(id: string): Promise<ConfigRevision>;
}

function erroDaResposta(error: RespostaConfig['error']): Error {
  if (error?.code === '40001') return new Error('A configuração mudou durante a edição. Atualize a lista e confira a versão antes de salvar novamente.');
  if (error?.code === '23514') return new Error(error.message || 'Esta revisão não pode ser ativada. Confira a validação e as regras da máquina.');
  return new Error(error?.message || 'O banco não concluiu a operação. Consulte o estado antes de tentar novamente.');
}

async function chamar<T>(cliente: ClienteConfigV2, nome: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await cliente.schema('helena_v2').rpc(nome, args);
  if (error) throw erroDaResposta(error);
  if (data === null || data === undefined) throw new Error('O banco não devolveu a configuração solicitada.');
  return data as T;
}

export function criarRepositorioConfigV2(cliente: ClienteConfigV2): RepositorioConfigV2 {
  return {
    listar: () => chamar<ConfigRevision[]>(cliente, 'listar_configuracoes'),
    ler: id => chamar<ConfigDetail>(cliente, 'ler_configuracao', { id }),
    salvar: ({ nome, conteudo, id, versao_esperada, base_id }) =>
      chamar<ConfigDetail>(cliente, 'salvar_rascunho', {
        nome, conteudo, id: id ?? null, versao_esperada: versao_esperada ?? null, base_id: base_id ?? null,
      }),
    solicitarValidacao: (id, versao) => chamar<ConfigRevision>(cliente, 'solicitar_validacao_config', { id, versao }),
    ativar: (id, ativa_esperada) => chamar<ConfigRevision>(cliente, 'ativar_configuracao', { id, ativa_esperada }),
    aposentar: id => chamar<ConfigRevision>(cliente, 'aposentar_configuracao', { id }),
  };
}
