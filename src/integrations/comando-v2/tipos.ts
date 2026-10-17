/**
 * O que é: o contrato de dados da Sala de comando v2 (abas do dashboard). Toda aba recebe `PropsAba` e lê SÓ dados do
 * esquema helena_v2 (cards, etapas, entregas, pedidos e a configuração ativa). Nunca a fila agent_jobs da v1.
 * Como mudar: acrescente campos OPCIONAIS aqui; nunca renomeie nem remova um campo sem atualizar todas as abas e os testes.
 * Cada aba é um arquivo `src/pages/comando-v2/abas/<Nome>Aba.tsx` com `export default` de um componente `(props: PropsAba)`.
 */
import type { CardV2, EtapaV2 } from '@/integrations/cards-v2/repository';
import type { PedidoEntrada } from '@/integrations/pedidos-v2/repository';
import type { ServicoCatalogo } from '@/integrations/operacao-v2/catalogo';

/** 'carregando' = ainda lendo; 'pronta' = leitura ok (mesmo vazia); 'erro' = falhou (a tela mostra erro, nunca zero). */
export type EstadoLeitura = 'carregando' | 'pronta' | 'erro';

/** Cartão com os campos extras que o banco já entrega por tabela (sem migration). */
export type CardComando = CardV2 & {
  atualizado_em: string | null;
  prazo_ate: string | null;
  prioridade: number | null;
};

export type EtapaComando = EtapaV2 & {
  card_id: string;
  ordem: number | null;
  atualizado_em: string | null;
  execucoes: number | null;
};

/** Entrega sem o corpo (o conteúdo é carregado por card, ao abrir). */
export type EntregaResumo = {
  id: string;
  card_id: string;
  etapa_id: string;
  etapa_codigo: string | null;
  versao: number;
  autor: string | null;
  portao1: string;
  criada_em: string;
  parecer: string | null;
  usou_internet: boolean | null;
};

export type EmpresaComando = { id: string; nome: string; pacote: string };

export type AgenteComando = {
  id: string;            // AGT-01
  identidade: string;    // HELENA (é o que aparece em etapa.autor e servico.dono)
  nome: string;
  cargo: string;
  grupo: string;
  estado: string;        // ESTAGIO | RASCUNHO | PAUSADO | ...
  fase?: string;         // fase de ativação (fase_de_ativacao do organograma), se houver
};

export type CatalogoComando = {
  revisao: string;
  empresas: EmpresaComando[];
  agentes: AgenteComando[];
  servicos: ServicoCatalogo[];
};

export type DadosComando = {
  agora: Date;
  cards: CardComando[];
  etapas: EtapaComando[];
  entregas: EntregaResumo[];
  pedidos: PedidoEntrada[];
  catalogo: CatalogoComando;
  estado: {
    cards: EstadoLeitura;
    etapas: EstadoLeitura;
    entregas: EstadoLeitura;
    pedidos: EstadoLeitura;
    catalogo: EstadoLeitura;
  };
  /**
   * true quando a leitura de cards, etapas ou entregas foi cortada por limite: a tela deve avisar "amostra".
   * Pedidos (limite próprio, 50) NÃO entram aqui; veja `amostras.pedidos`. Cada aba deve olhar só as fontes que usa
   * (`amostraDe` em derivar-cards.ts); sem `amostras` (dados montados à mão), vale este campo.
   */
  amostra: boolean;
  /** Corte por fonte. Opcional: quem monta `DadosComando` à mão pode omitir. */
  amostras?: Partial<Record<'cards' | 'etapas' | 'entregas' | 'pedidos', boolean>>;
  /** Causa da falha de cada fonte em erro (texto já pronto para o fundador ler, sem segredos). Opcional. */
  erros?: Partial<Record<keyof DadosComando['estado'], string>>;
};

export type PropsAba = {
  dados: DadosComando;
  /** 'GRUPO' = todas as empresas; senão o código, ex.: 'BIZ-003'. */
  empresa: string;
  /** Abre o card no painel lateral ou em /cards?card=<id>. */
  abrirCard: (id: string) => void;
};

export type AbaId =
  | 'visao-geral' | 'cards' | 'processo' | 'acompanhamento' | 'empresas' | 'agentes' | 'supervisao'
  | 'cobertura' | 'consumo' | 'plano' | 'execucao' | 'entregas';

/** Ordem e arquivo de cada aba. `visivel: false` vai para o menu "Mais". */
export const ABAS: { id: AbaId; rotulo: string; arquivo: string; visivel: boolean }[] = [
  { id: 'visao-geral', rotulo: 'Visão geral', arquivo: 'VisaoGeralAba', visivel: true },
  { id: 'cards', rotulo: 'Cards', arquivo: 'CardsAba', visivel: true },
  { id: 'processo', rotulo: 'Processo', arquivo: 'ProcessoAba', visivel: true },
  { id: 'acompanhamento', rotulo: 'Acompanhamento', arquivo: 'AcompanhamentoAba', visivel: true },
  { id: 'empresas', rotulo: 'Empresas', arquivo: 'EmpresasAba', visivel: true },
  { id: 'agentes', rotulo: 'Agentes', arquivo: 'AgentesAba', visivel: true },
  { id: 'supervisao', rotulo: 'Supervisão', arquivo: 'SupervisaoAba', visivel: true },
  { id: 'execucao', rotulo: 'Execução', arquivo: 'ExecucaoAba', visivel: false },
  { id: 'entregas', rotulo: 'Entregas', arquivo: 'EntregasAba', visivel: false },
  { id: 'cobertura', rotulo: 'Cobertura', arquivo: 'CoberturaAba', visivel: false },
  { id: 'consumo', rotulo: 'Consumo', arquivo: 'ConsumoAba', visivel: false },
  { id: 'plano', rotulo: 'Plano de evolução', arquivo: 'PlanoEvolucaoAba', visivel: false },
];

/** Estados de card que esperam uma decisão do fundador. */
export const ESTADOS_ESPERA_FUNDADOR = ['ESPERANDO_FUNDADOR', 'ESPERANDO_CONFIRMACAO'] as const;
/** Estados finais (o card já terminou). */
export const ESTADOS_FINAIS = ['PRONTO', 'CANCELADO', 'ENCERRADO_COM_FALHA'] as const;

/** O que o gancho de dados devolve. A implementação real fica em `useDadosComando.ts` (pedaço 2). */
export type ResultadoDadosComando = {
  dados: DadosComando;
  carregando: boolean;
  atualizadoEm: Date | null;
  recarregar: () => void;
};
export type UsarDadosComando = () => ResultadoDadosComando;

export function dadosVazios(agora: Date = new Date()): DadosComando {
  return {
    agora, cards: [], etapas: [], entregas: [], pedidos: [],
    catalogo: { revisao: '', empresas: [], agentes: [], servicos: [] },
    estado: { cards: 'carregando', etapas: 'carregando', entregas: 'carregando', pedidos: 'carregando', catalogo: 'carregando' },
    amostra: false,
  };
}
