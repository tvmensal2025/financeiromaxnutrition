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
  /** true quando a leitura foi cortada por limite: a tela deve avisar "amostra". */
  amostra: boolean;
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
