import type { CardV2 } from '@/integrations/cards-v2/repository';

const colunas = [
  { id: 'preparacao', titulo: 'Preparação', estados: ['RASCUNHO', 'VALIDANDO_PLANO'] },
  { id: 'fundador', titulo: 'Aguardando você', estados: ['ESPERANDO_CONFIRMACAO', 'ESPERANDO_FUNDADOR'] },
  { id: 'trabalho', titulo: 'Em trabalho', estados: ['EM_ANDAMENTO'] },
  { id: 'pronto', titulo: 'Pronto', estados: ['PRONTO'] },
  { id: 'encerrado', titulo: 'Encerrado', estados: ['CANCELADO', 'ENCERRADO_COM_FALHA'] },
] as const;

type Props = {
  cards: CardV2[];
  selecionado: string | null;
  onSelecionar(id: string): void;
  formatarPrazo(valor: string | null): string;
};

function Cartao({ card, selecionado, onSelecionar, formatarPrazo }: {
  card: CardV2; selecionado: boolean; onSelecionar(id: string): void; formatarPrazo: Props['formatarPrazo'];
}) {
  return <button type="button" onClick={() => onSelecionar(card.id)}
    aria-current={selecionado ? 'true' : undefined}
    className={`min-h-11 w-full rounded-lg border bg-card p-3 text-left shadow-sm transition hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selecionado ? 'border-primary ring-1 ring-primary/40' : 'border-border'}`}>
    <strong className="block break-words text-sm leading-snug">{card.titulo}</strong>
    <span className="mt-2 block break-all text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{card.estado}</span>
    {card.motivo && card.motivo !== 'NENHUM' && <span className="mt-1 block break-all text-xs text-amber-800 dark:text-amber-300">Motivo: {card.motivo}</span>}
    {card.empresa && <span className="mt-2 block break-words text-xs text-muted-foreground">Empresa: {card.empresa}</span>}
    <span className="mt-2 block text-xs text-muted-foreground">Dono: {card.dono || 'Não informado'}</span>
    <span className="mt-1 block text-xs text-muted-foreground">Prazo: {formatarPrazo(card.prazo)}</span>
  </button>;
}

export function KanbanV2({ cards, selecionado, onSelecionar, formatarPrazo }: Props) {
  const conhecidos = new Set<string>(colunas.flatMap(coluna => [...coluna.estados]));
  const desconhecidos = cards.filter(card => !conhecidos.has(card.estado));
  const grupos = [
    ...colunas.map(coluna => ({ ...coluna, cards: cards.filter(card => (coluna.estados as readonly string[]).includes(card.estado)) })),
    ...(desconhecidos.length ? [{ id: 'desconhecido', titulo: 'Estado não reconhecido', cards: desconhecidos }] : []),
  ];
  return <section aria-label="Quadro Kanban dos cards" className="min-w-0 space-y-3">
    <p className="text-xs text-muted-foreground">O quadro mostra o estado do card no banco. Etapas e ações externas têm seus próprios estados no detalhe; “Pronto” não significa publicado.</p>
    <div className="overflow-x-auto pb-3">
      <div className="grid w-max grid-flow-col auto-cols-[17rem] gap-3 xl:w-full xl:grid-flow-row xl:grid-cols-5 xl:auto-cols-auto">
        {grupos.map(grupo => <section key={grupo.id} aria-label={`${grupo.titulo}: ${grupo.cards.length} ${grupo.cards.length === 1 ? 'card' : 'cards'}`}
          className="min-w-0 rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex min-h-11 items-center justify-between gap-2 border-b border-border pb-2">
            <h3 className="text-sm font-semibold">{grupo.titulo}</h3>
            <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold" aria-label={`${grupo.cards.length} ${grupo.cards.length === 1 ? 'card' : 'cards'}`}>{grupo.cards.length}</span>
          </div>
          <div className="mt-3 space-y-2">
            {grupo.cards.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Nenhum card</p>}
            {grupo.cards.map(card => <Cartao key={card.id} card={card} selecionado={selecionado === card.id}
              onSelecionar={onSelecionar} formatarPrazo={formatarPrazo} />)}
          </div>
        </section>)}
      </div>
    </div>
  </section>;
}
