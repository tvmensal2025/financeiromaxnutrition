/**
 * O que é: o texto FIXO e honesto do roteiro "Plano de evolução" da Sala de comando v2 (Pronto / Em construção / Planejado).
 * É uma lista de planejamento escrita à mão, NÃO é leitura do banco e NÃO prova que algo opera em produção.
 * Como mudar: edite os itens abaixo quando o estado real mudar (confira antes no banco/produção). Não escreva "pronto"
 * para o que não foi comprovado: use o campo `situacao` para dizer exatamente o que foi e o que não foi provado.
 */
export type ColunaRoteiro = 'pronto' | 'construcao' | 'planejado';
export type ItemRoteiro = {
  id: string;
  coluna: ColunaRoteiro;
  titulo: string;
  /** Rótulo curto do estado real, ex.: "pronto, em teste". */
  situacao: string;
  descricao: string;
};

export const AVISO_ROTEIRO = 'Lista de planejamento, não prova de operação.';

export const COLUNAS_ROTEIRO: { id: ColunaRoteiro; titulo: string; ajuda: string }[] = [
  { id: 'pronto', titulo: 'Pronto', ajuda: 'Está construído e em teste. Pronto não quer dizer comprovado em uso diário.' },
  { id: 'construcao', titulo: 'Em construção', ajuda: 'Existe em parte ou foi construído, mas ainda não foi comprovado em uso real.' },
  { id: 'planejado', titulo: 'Planejado', ajuda: 'Ainda não existe. É intenção, não entrega.' },
];

export const ITENS_ROTEIRO: ItemRoteiro[] = [
  {
    id: 'motor-banco-v2', coluna: 'pronto', titulo: 'Motor e banco da v2', situacao: 'pronto, em teste',
    descricao: 'As regras de cards, etapas e entregas vivem no banco da v2 e no motor. Estão construídos e em fase de teste; isso ainda não é o mesmo que uso diário comprovado.',
  },
  {
    id: 'hermes-chatgpt', coluna: 'construcao', titulo: 'Hermes real com ChatGPT', situacao: 'testado direto, não comprovado dentro de um card',
    descricao: 'A ligação funcionou em teste direto. Ainda NÃO foi comprovada dentro de um card real da v2.',
  },
  {
    id: 'pedido-livre', coluna: 'construcao', titulo: 'Pedido em texto livre e propostas', situacao: 'construído, não comprovado em produção',
    descricao: 'Você escreve o pedido e a Helena propõe um plano. A tela e as funções existem; falta comprovar o uso em produção.',
  },
  {
    id: 'telegram-v2', coluna: 'construcao', titulo: 'Telegram para a v2', situacao: 'construído, webhook não ligado',
    descricao: 'A caixa de entrada que recebe pedidos do Telegram foi construída. O webhook (a ligação do Telegram com o sistema) não está ligado, então nada chega por aí hoje.',
  },
  {
    id: 'consumo-real', coluna: 'planejado', titulo: 'Consumo real de tokens e custo', situacao: 'planejado',
    descricao: 'Medir tokens e custo exige uma função nova no banco, que só o fundador pode autorizar. Hoje a aba Consumo mostra apenas volume.',
  },
  {
    id: 'publicacao-real', coluna: 'planejado', titulo: 'Publicação real', situacao: 'planejado, destino indefinido',
    descricao: 'Publicar de fato o que foi aprovado. O destino ainda não foi definido, então nada é publicado automaticamente.',
  },
  {
    id: 'servicos-rascunho', coluna: 'planejado', titulo: 'Serviços em RASCUNHO', situacao: 'planejados',
    descricao: 'Serviços marcados como RASCUNHO no catálogo. Estão planejados, não liberados para uso.',
  },
];

/** Rótulos simples dos estados de agente (o estado vem do catálogo; aqui só se traduz). */
export function rotuloEstadoAgente(estado: string): string {
  const rotulos: Record<string, string> = { ESTAGIO: 'Em estágio', RASCUNHO: 'Rascunho', PAUSADO: 'Pausado', ATIVO: 'Ativo' };
  return rotulos[estado] ?? (estado ? estado.replace(/_/g, ' ').toLowerCase() : 'Estado não informado');
}
