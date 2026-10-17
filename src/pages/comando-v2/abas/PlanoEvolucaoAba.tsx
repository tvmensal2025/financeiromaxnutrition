/**
 * O que é: aba "Plano de evolução" da Sala de comando v2: roteiro em 3 colunas (Pronto / Em construção / Planejado) com texto
 * fixo e honesto, mais os agentes do catálogo agrupados por fase e estado. Só leitura.
 * Como mudar: o texto do roteiro fica em src/integrations/comando-v2/roteiro-plano.ts; os agentes vêm de dados.catalogo.
 */
import { useMemo } from 'react';
import { CheckCircle2, Hammer, ListTodo, TriangleAlert, Users } from 'lucide-react';
import { ExecutiveBadge, type BadgeVariant } from '@/components/executive/ExecutiveBadge';
import { ExecutiveEmptyState } from '@/components/executive/ExecutiveEmptyState';
import { ExecutiveErrorState } from '@/components/executive/ExecutiveErrorState';
import { ExecutiveLoadingState } from '@/components/executive/ExecutiveLoadingState';
import { AVISO_ROTEIRO, COLUNAS_ROTEIRO, ITENS_ROTEIRO, rotuloEstadoAgente, type ColunaRoteiro } from '@/integrations/comando-v2/roteiro-plano';
import type { AgenteComando, PropsAba } from '@/integrations/comando-v2/tipos';

const ICONE_COLUNA = { pronto: CheckCircle2, construcao: Hammer, planejado: ListTodo } as const;
const SELO_COLUNA: Record<ColunaRoteiro, BadgeVariant> = { pronto: 'success', construcao: 'warning', planejado: 'neutral' };
const SEM_FASE = 'Sem fase informada';

function varianteEstado(estado: string): BadgeVariant {
  if (estado === 'ESTAGIO') return 'info';
  if (estado === 'PAUSADO') return 'warning';
  return 'neutral';
}

type GrupoFase = { fase: string; agentes: AgenteComando[]; porEstado: [string, number][] };

function agruparPorFase(agentes: AgenteComando[]): GrupoFase[] {
  const mapa = new Map<string, AgenteComando[]>();
  for (const agente of agentes) {
    const fase = agente.fase?.trim() || SEM_FASE;
    mapa.set(fase, [...(mapa.get(fase) ?? []), agente]);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => (a === SEM_FASE ? 1 : b === SEM_FASE ? -1 : a.localeCompare(b, 'pt-BR', { numeric: true })))
    .map(([fase, lista]) => {
      const contagem = new Map<string, number>();
      for (const a of lista) contagem.set(a.estado, (contagem.get(a.estado) ?? 0) + 1);
      return { fase, agentes: lista, porEstado: [...contagem.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR')) };
    });
}

export default function PlanoEvolucaoAba({ dados }: PropsAba) {
  const { estado, catalogo } = dados;
  const fases = useMemo(() => agruparPorFase(catalogo.agentes), [catalogo.agentes]);

  return (
    <div className="space-y-5" data-aba="plano">
      <header>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Plano de evolução</h2>
        <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
          Para onde o sistema está indo e em que ponto cada parte está. Vale para o sistema todo e não muda com o filtro de empresa.
        </p>
      </header>

      <p role="note" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <span><strong>{AVISO_ROTEIRO}</strong> O que está escrito aqui é texto fixo, não uma leitura do banco: &quot;construído&quot; ou &quot;testado&quot; não quer dizer que funciona em produção.</span>
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUNAS_ROTEIRO.map(coluna => {
          const Icone = ICONE_COLUNA[coluna.id];
          const itens = ITENS_ROTEIRO.filter(i => i.coluna === coluna.id);
          return (
            <section key={coluna.id} aria-labelledby={`plano-${coluna.id}`} data-coluna={coluna.id} className="rounded-xl border border-border bg-card p-4">
              <header className="flex items-start gap-3">
                <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted/60 text-muted-foreground"><Icone className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <h3 id={`plano-${coluna.id}`} className="text-sm font-semibold tracking-tight text-foreground">{coluna.titulo}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{coluna.ajuda}</p>
                </div>
              </header>
              <ul className="mt-3 space-y-3">
                {itens.map(item => (
                  <li key={item.id} className="rounded-lg border border-border/70 bg-background p-3">
                    <p className="text-sm font-medium text-foreground">{item.titulo}</p>
                    <div className="mt-1.5"><ExecutiveBadge variant={SELO_COLUNA[item.coluna]}>{item.situacao}</ExecutiveBadge></div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.descricao}</p>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <section aria-labelledby="plano-agentes" className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <header className="flex items-start gap-3">
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted/60 text-muted-foreground"><Users className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h3 id="plano-agentes" className="text-sm font-semibold tracking-tight text-foreground">Agentes por fase de ativação</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Vem do catálogo ativo. Estar listado ou em estágio não quer dizer que o agente está trabalhando em cards.
              {catalogo.revisao ? ` Revisão: ${catalogo.revisao}.` : ''}
            </p>
          </div>
        </header>
        <div className="mt-3">
          {estado.catalogo === 'carregando' ? <ExecutiveLoadingState message="Carregando agentes do catálogo" rows={2} />
            : estado.catalogo === 'erro' ? <ExecutiveErrorState title="Não foi possível ler os agentes"
                message="A leitura do catálogo falhou, então nenhum agente é mostrado. Isto não significa que não há agentes." />
            : fases.length === 0 ? <ExecutiveEmptyState icon={Users} title="Nenhum agente no catálogo"
                description="A leitura funcionou e a revisão ativa não lista agentes." />
            : <ul className="grid gap-3 md:grid-cols-2">
                {fases.map(grupo => (
                  <li key={grupo.fase} data-fase={grupo.fase} className="rounded-lg border border-border/70 bg-background p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{grupo.fase === SEM_FASE ? SEM_FASE : `Fase ${grupo.fase}`}</p>
                      <span className="text-xs text-muted-foreground">{grupo.agentes.length} {grupo.agentes.length === 1 ? 'agente' : 'agentes'}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {grupo.porEstado.map(([est, qtd]) => (
                        <ExecutiveBadge key={est} variant={varianteEstado(est)}>{rotuloEstadoAgente(est)}: {qtd}</ExecutiveBadge>
                      ))}
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {grupo.agentes.map(a => <li key={a.id}>{a.nome} ({rotuloEstadoAgente(a.estado).toLowerCase()})</li>)}
                    </ul>
                  </li>
                ))}
              </ul>}
        </div>
      </section>
    </div>
  );
}
