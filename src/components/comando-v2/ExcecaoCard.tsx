/**
 * O que é: o cartão de uma exceção da Supervisão (severidade, texto simples, empresa, há quanto tempo e "Abrir card").
 * Como mudar: as regras e os textos vêm de `analisarCardsV2` (src/integrations/comando-v2/supervisao-v2.ts); aqui só a aparência.
 */
import { ArrowUpRight, Building2, Clock3 } from 'lucide-react';
import { ExecutiveBadge, type BadgeVariant } from '@/components/executive/ExecutiveBadge';
import {
  dataHoraSaoPaulo, haQuantoTempo, ROTULO_REGRA, ROTULO_SEVERIDADE, type Excecao, type Severidade,
} from '@/integrations/comando-v2/supervisao-v2';

const FAIXA: Record<Severidade, string> = {
  ALTA: 'border-l-destructive', MEDIA: 'border-l-warning', BAIXA: 'border-l-border',
};
const VARIANTE: Record<Severidade, BadgeVariant> = { ALTA: 'danger', MEDIA: 'warning', BAIXA: 'neutral' };

type Props = {
  excecao: Excecao;
  /** Nome da empresa já resolvido pela aba (sem nome, a aba manda o código). */
  nomeEmpresa?: string;
  agora: Date;
  abrirCard?: (id: string) => void;
};

export default function ExcecaoCard({ excecao, nomeEmpresa, agora, abrirCard }: Props) {
  const { severidade, regra, titulo, detalhe, cardId, desde } = excecao;
  return (
    <li
      data-severidade={severidade}
      className={`list-none rounded-xl border border-l-4 border-border bg-card p-4 ${FAIXA[severidade]}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ExecutiveBadge variant={VARIANTE[severidade]} dot>Severidade {ROTULO_SEVERIDADE[severidade].toLowerCase()}</ExecutiveBadge>
        <ExecutiveBadge variant="outline">{ROTULO_REGRA[regra]}</ExecutiveBadge>
      </div>
      <h3 className="mt-2 break-words text-sm font-semibold text-foreground">{titulo}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{detalhe}</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            {nomeEmpresa ?? 'Empresa não definida'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            <time dateTime={desde} title={dataHoraSaoPaulo(desde)}>{haQuantoTempo(desde, agora)}</time>
          </span>
        </div>
        {cardId && abrirCard ? (
          <button
            type="button"
            onClick={() => abrirCard(cardId)}
            aria-label={`Abrir card: ${titulo}`}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Abrir card <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">Ainda não há card para abrir.</span>
        )}
      </div>
    </li>
  );
}
