/**
 * O que é: lista de cards da aba Cards (tabela no computador, cartões no celular) e o aviso de "amostra" que as três abas
 * deste pedaço reutilizam. Só apresenta o que recebe; filtro, ordem e leitura ficam na aba.
 * Como mudar: mantenha cada linha como botão com altura mínima de 44px e sem rolagem horizontal em 390px.
 */
import { ChevronRight, Info } from 'lucide-react';
import { ExecutiveBadge } from '@/components/executive/ExecutiveBadge';
import type { CardComando, CatalogoComando } from '@/integrations/comando-v2/tipos';
import {
  cardPrazoVencido, nomeEmpresa, prazoDoCard, prazoRelativo, rotuloEstadoCard, rotuloMotivo, varianteEstado,
} from '@/integrations/comando-v2/derivar-cards';

export function AvisoAmostra() {
  return (
    <div role="note" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <p>Esta tela mostra só uma amostra: a leitura foi cortada por limite. Contagens e listas podem estar incompletas.</p>
    </div>
  );
}

type Props = {
  cards: CardComando[];
  catalogo: CatalogoComando;
  agora: Date;
  selecionadoId: string | null;
  onSelecionar: (id: string) => void;
  /** Quantos cards combinam com o filtro no total (a lista recebe só os que cabem na página atual). */
  total: number;
  onMostrarMais?: () => void;
  passo?: number;
};

export function ListaCards({ cards, catalogo, agora, selecionadoId, onSelecionar, total, onMostrarMais, passo = 25 }: Props) {
  const restantes = total - cards.length;
  return (
    <section aria-label="Lista de cards" className="min-w-0 space-y-2">
      <div aria-hidden="true" className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_1rem] gap-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
        <span>Card</span><span>Empresa</span><span>Dono</span><span>Prazo</span><span>Estado</span><span />
      </div>
      <ul className="space-y-2">
        {cards.map(card => {
          const vencido = cardPrazoVencido(card, agora);
          const motivo = rotuloMotivo(card.motivo);
          const selecionado = selecionadoId === card.id;
          return (
            <li key={card.id}>
              <button
                type="button"
                onClick={() => onSelecionar(card.id)}
                aria-label={`Abrir detalhes do card ${card.titulo}`}
                aria-current={selecionado ? 'true' : undefined}
                className={`grid min-h-11 w-full min-w-0 gap-1.5 rounded-lg border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_1rem] md:items-center md:gap-3 ${selecionado ? 'border-primary ring-1 ring-primary/40' : 'border-border'}`}
              >
                <span className="min-w-0">
                  <strong className="block break-words text-sm font-semibold leading-snug text-foreground">{card.titulo}</strong>
                  {motivo && <span className="mt-0.5 block break-words text-xs text-warning">{motivo}</span>}
                </span>
                <span className="min-w-0 break-words text-xs text-muted-foreground">
                  <span className="md:hidden">Empresa: </span>{nomeEmpresa(catalogo, card.empresa)}
                </span>
                <span className="min-w-0 break-words text-xs text-muted-foreground">
                  <span className="md:hidden">Dono: </span>{card.dono || 'Sem dono'}
                </span>
                <span className={`min-w-0 break-words text-xs ${vencido ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                  {prazoRelativo(prazoDoCard(card), agora)}
                </span>
                <span><ExecutiveBadge variant={varianteEstado(card.estado)} dot>{rotuloEstadoCard(card.estado)}</ExecutiveBadge></span>
                <ChevronRight className="hidden h-4 w-4 text-muted-foreground md:block" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      {restantes > 0 && onMostrarMais && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={onMostrarMais}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Mostrar mais ({Math.min(passo, restantes)} de {restantes} restantes)
          </button>
        </div>
      )}
    </section>
  );
}
