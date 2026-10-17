/**
 * O que é: um bloco da Central de execução (título, contagem, até 5 itens e "ver todos"). Só leitura.
 * Como mudar: os itens vêm prontos de derivarExecucao; aqui só se desenha. `estado` evita mostrar zero quando a leitura falhou.
 */
import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react';
import { ExecutiveBadge } from '@/components/executive/ExecutiveBadge';
import { ExecutiveErrorState } from '@/components/executive/ExecutiveErrorState';
import { ExecutiveLoadingState } from '@/components/executive/ExecutiveLoadingState';
import { LIMITE_ITENS_BLOCO, dataHoraSP, type ItemExecucao } from '@/integrations/comando-v2/derivar-execucao';
import type { EstadoLeitura } from '@/integrations/comando-v2/tipos';

type Tom = 'neutro' | 'atencao' | 'perigo';
type Props = {
  id: string;
  titulo: string;
  descricao: string;
  icone: LucideIcon;
  tom?: Tom;
  estado?: EstadoLeitura;
  itens?: ItemExecucao[];
  total?: number;
  vazio?: string;
  nota?: string;
  abrirCard?: (id: string) => void;
  /** Conteúdo fixo no lugar da lista (ex.: bloco explicativo). */
  children?: ReactNode;
};

const TOM: Record<Tom, { faixa: string; icone: string; selo: 'neutral' | 'warning' | 'danger' }> = {
  neutro: { faixa: 'border-border', icone: 'bg-muted/60 text-muted-foreground', selo: 'neutral' },
  atencao: { faixa: 'border-warning/40', icone: 'bg-warning/10 text-warning', selo: 'warning' },
  perigo: { faixa: 'border-destructive/40', icone: 'bg-destructive/10 text-destructive', selo: 'danger' },
};

export function BlocoExecucao({ id, titulo, descricao, icone: Icone, tom = 'neutro', estado = 'pronta', itens = [], total, vazio, nota, abrirCard, children }: Props) {
  const [todos, setTodos] = useState(false);
  const aparencia = TOM[tom];
  const quantidade = total ?? itens.length;
  const visiveis = todos ? itens : itens.slice(0, LIMITE_ITENS_BLOCO);
  const tituloId = `bloco-${id}-titulo`;
  const comContagem = !children && estado === 'pronta';
  return (
    <section aria-labelledby={tituloId} data-bloco={id} className={`rounded-xl border bg-card p-4 sm:p-5 ${aparencia.faixa}`}>
      <header className="flex items-start gap-3">
        <span aria-hidden="true" className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${aparencia.icone}`}><Icone className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <h3 id={tituloId} className="text-sm font-semibold tracking-tight text-foreground">{titulo}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{descricao}</p>
        </div>
        {comContagem && (
          <ExecutiveBadge variant={quantidade > 0 ? aparencia.selo : 'neutral'} size="md">
            <span aria-label={`${quantidade} ${quantidade === 1 ? 'item' : 'itens'}`}>{quantidade}</span>
          </ExecutiveBadge>
        )}
      </header>

      <div className="mt-3">
        {children ? children
          : estado === 'carregando' ? <ExecutiveLoadingState message={`Carregando ${titulo.toLowerCase()}`} rows={2} />
          : estado === 'erro' ? <ExecutiveErrorState title={`Não foi possível ler: ${titulo}`}
              message="A leitura falhou, então nenhum número é mostrado aqui. Isto não significa que está tudo em dia." />
          : itens.length === 0 ? <p className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-3 py-4 text-sm text-muted-foreground">{vazio ?? 'Nada por aqui agora.'}</p>
          : <>
              <ul id={`bloco-${id}-lista`} className="divide-y divide-border/60">
                {visiveis.map(item => (
                  <li key={item.chave} className="py-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                      {item.cardId && abrirCard
                        ? <button type="button" onClick={() => abrirCard(item.cardId as string)} aria-label={`Abrir card: ${item.titulo}`}
                            className="inline-flex min-h-11 min-w-0 max-w-full items-center rounded-md text-left text-sm font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <span className="break-words">{item.titulo}</span>
                          </button>
                        : <p className="min-w-0 break-words py-2 text-sm font-medium text-foreground">{item.titulo}</p>}
                      {item.prazo !== null && (
                        <span className={`shrink-0 pt-3 text-xs ${item.prazoVencido ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                          Prazo: {dataHoraSP(item.prazo)}{item.prazoVencido ? ' (vencido)' : ''}
                        </span>
                      )}
                    </div>
                    <p className="-mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{item.empresa}</span>
                      {item.quem && <span>{item.quem}</span>}
                    </p>
                    {item.detalhe && <p className="mt-0.5 break-words text-xs text-muted-foreground">{item.detalhe}</p>}
                  </li>
                ))}
              </ul>
              {itens.length > LIMITE_ITENS_BLOCO && (
                <button type="button" aria-expanded={todos} aria-controls={`bloco-${id}-lista`} onClick={() => setTodos(v => !v)}
                  className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {todos ? <><ChevronUp className="h-4 w-4" aria-hidden="true" />Ver menos</> : <><ChevronDown className="h-4 w-4" aria-hidden="true" />Ver todos ({itens.length})</>}
                </button>
              )}
            </>}
        {nota && estado === 'pronta' && <p className="mt-2 text-xs text-muted-foreground">{nota}</p>}
      </div>
    </section>
  );
}
