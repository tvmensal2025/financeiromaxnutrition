/**
 * O que é: aba "Cards" da Sala de comando v2 (a "Tarefas" da v1): busca, filtros rápidos, ordenação, lista paginada
 * (25 por vez) e painel lateral com o resumo do card e navegação anterior/próximo.
 * Como mudar: regras de filtro/ordem/prazo ficam em src/integrations/comando-v2/derivar-cards.ts; a lista em
 * ListaCards.tsx e o painel em PainelCardLateral.tsx. Lê só `PropsAba` (helena_v2), nunca a v1.
 * Honestidade: erro de leitura mostra erro (nunca zero); `dados.amostra` mostra aviso; o filtro `empresa` vale para tudo.
 */
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ExecutiveEmptyState } from '@/components/executive/ExecutiveEmptyState';
import { ExecutiveErrorState } from '@/components/executive/ExecutiveErrorState';
import { ExecutiveLoadingState } from '@/components/executive/ExecutiveLoadingState';
import { AvisoAmostra, ListaCards } from '@/components/comando-v2/ListaCards';
import { PainelCardLateral } from '@/components/comando-v2/PainelCardLateral';
import type { PropsAba } from '@/integrations/comando-v2/tipos';
import {
  cardsDaEmpresa, combinarLeituras, contarPorFiltro, EMPRESA_GRUPO, etapasDoCard, filtrarCards, mensagemFalha, nomeEmpresa,
  type FiltroCards, type OrdemCards,
} from '@/integrations/comando-v2/derivar-cards';

const PASSO = 25;
const FILTROS: { id: FiltroCards; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'precisa', rotulo: 'Precisa de você' },
  { id: 'vencido', rotulo: 'Prazo vencido' },
  { id: 'andamento', rotulo: 'Em andamento' },
  { id: 'prontos', rotulo: 'Prontos' },
];
const ORDENS: { id: OrdemCards; rotulo: string }[] = [
  { id: 'prioridade', rotulo: 'Prioridade' },
  { id: 'prazo', rotulo: 'Prazo mais próximo' },
  { id: 'recentes', rotulo: 'Mais recentes' },
];

export default function CardsAba({ dados, empresa, abrirCard }: PropsAba) {
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroCards>('todos');
  const [ordem, setOrdem] = useState<OrdemCards>('prioridade');
  const [limite, setLimite] = useState(PASSO);
  const [abertoId, setAbertoId] = useState<string | null>(null);

  const leitura = combinarLeituras(dados.estado, ['cards']);
  const daEmpresa = useMemo(() => cardsDaEmpresa(dados.cards, empresa), [dados.cards, empresa]);
  const contagens = useMemo(() => contarPorFiltro(daEmpresa, dados.agora), [daEmpresa, dados.agora]);
  const filtrados = useMemo(
    () => filtrarCards(daEmpresa, { busca, filtro, ordem, agora: dados.agora, catalogo: dados.catalogo }),
    [daEmpresa, busca, filtro, ordem, dados.agora, dados.catalogo],
  );
  const visiveis = filtrados.slice(0, limite);
  const indice = abertoId ? filtrados.findIndex(card => card.id === abertoId) : -1;
  const cardAberto = abertoId ? daEmpresa.find(card => card.id === abertoId) ?? null : null;

  const mudar = <T,>(definir: (valor: T) => void) => (valor: T) => { definir(valor); setLimite(PASSO); };
  const irPara = (posicao: number) => { const alvo = filtrados[posicao]; if (alvo) setAbertoId(alvo.id); };
  const limpar = () => { setBusca(''); setFiltro('todos'); setLimite(PASSO); };
  const escopo = empresa === EMPRESA_GRUPO ? 'em nenhuma empresa' : `em ${nomeEmpresa(dados.catalogo, empresa)}`;

  if (leitura.estado === 'erro') return <ExecutiveErrorState title="Não foi possível carregar os cards" message={mensagemFalha(leitura.falhas)} />;
  if (leitura.estado === 'carregando') return <ExecutiveLoadingState message="Carregando cards" rows={5} />;

  return (
    <div className="min-w-0 space-y-4">
      {dados.amostra && <AvisoAmostra />}

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Buscar cards por título, empresa ou dono</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={busca}
            onChange={evento => mudar(setBusca)(evento.target.value)}
            placeholder="Buscar por título, empresa ou dono"
            aria-label="Buscar cards por título, empresa ou dono"
            className="min-h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground md:w-56">
          Ordenar por
          <select
            value={ordem}
            onChange={evento => mudar(setOrdem)(evento.target.value as OrdemCards)}
            aria-label="Ordenar cards"
            className="min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {ORDENS.map(opcao => <option key={opcao.id} value={opcao.id}>{opcao.rotulo}</option>)}
          </select>
        </label>
      </div>

      <div role="group" aria-label="Filtros rápidos" className="flex flex-wrap gap-2">
        {FILTROS.map(opcao => {
          const ativo = filtro === opcao.id;
          return (
            <button
              key={opcao.id}
              type="button"
              aria-pressed={ativo}
              onClick={() => mudar(setFiltro)(opcao.id)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${ativo ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-muted'}`}
            >
              {opcao.rotulo}
              <span className={`rounded-full px-1.5 text-xs ${ativo ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'}`}>{contagens[opcao.id]}</span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {filtrados.length} {filtrados.length === 1 ? 'card encontrado' : 'cards encontrados'}
        {dados.amostra ? ' (na amostra lida)' : ''}.
      </p>

      {daEmpresa.length === 0 && (
        <ExecutiveEmptyState title="Nenhum card por aqui" description={`Ainda não há cards ${escopo}. Quando um pedido virar card, ele aparece nesta lista.`} />
      )}
      {daEmpresa.length > 0 && filtrados.length === 0 && (
        <ExecutiveEmptyState
          title="Nenhum card combina com esse filtro"
          description="Tente outra busca ou volte para todos os cards."
          actionLabel="Limpar busca e filtros"
          onAction={limpar}
        />
      )}
      {filtrados.length > 0 && (
        <ListaCards
          cards={visiveis}
          catalogo={dados.catalogo}
          agora={dados.agora}
          selecionadoId={abertoId}
          onSelecionar={setAbertoId}
          total={filtrados.length}
          onMostrarMais={() => setLimite(atual => atual + PASSO)}
          passo={PASSO}
        />
      )}

      <PainelCardLateral
        card={cardAberto}
        etapas={cardAberto ? etapasDoCard(dados.etapas, cardAberto.id) : []}
        entregas={cardAberto ? dados.entregas.filter(entrega => entrega.card_id === cardAberto.id) : []}
        estadoEtapas={dados.estado.etapas}
        estadoEntregas={dados.estado.entregas}
        catalogo={dados.catalogo}
        agora={dados.agora}
        posicao={indice >= 0 ? { indice: indice + 1, total: filtrados.length } : null}
        onAnterior={indice > 0 ? () => irPara(indice - 1) : undefined}
        onProximo={indice >= 0 && indice < filtrados.length - 1 ? () => irPara(indice + 1) : undefined}
        onFechar={() => setAbertoId(null)}
        abrirCard={abrirCard}
      />
    </div>
  );
}
