/**
 * O que é: a aba Agentes da Sala de comando v2 — os agentes do organograma ativo agrupados por grupo, com cargo, estado da
 * configuração, fase, carga atual (etapas abertas como autor e revisões pendentes) e serviços de que cada um é dono.
 * Como mudar: a carga vem de `cargaPorAgente` (src/integrations/comando-v2/supervisao-v2.ts); o cartão é AgenteCartao.
 * Importante: o estado é o da CONFIGURAÇÃO ativa e não prova que o agente esteja operando.
 */
import { useMemo, useState } from 'react';
import { Info, Search, Users } from 'lucide-react';
import AgenteCartao from '@/components/comando-v2/AgenteCartao';
import { ExecutiveEmptyState } from '@/components/executive/ExecutiveEmptyState';
import { ExecutiveErrorState } from '@/components/executive/ExecutiveErrorState';
import { ExecutiveLoadingState } from '@/components/executive/ExecutiveLoadingState';
import {
  cargaPorAgente, chaveAgente, mesmaIdentidade, nomeDaEmpresa, rotuloEstadoConfig, situacaoDasLeituras,
} from '@/integrations/comando-v2/supervisao-v2';
import type { AgenteComando, PropsAba } from '@/integrations/comando-v2/tipos';

const CHIP = 'inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const normaliza = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function AgentesAba({ dados, empresa }: PropsAba) {
  const [busca, setBusca] = useState('');
  const [estado, setEstado] = useState<string | null>(null);

  const leitura = situacaoDasLeituras(dados, ['catalogo']);
  const fontesCarga = empresa === 'GRUPO' ? (['etapas'] as const) : (['etapas', 'cards'] as const);
  const cargaLeitura = situacaoDasLeituras(dados, [...fontesCarga]);
  const carga = useMemo(
    () => (cargaLeitura.situacao === 'pronta' ? cargaPorAgente(dados, empresa) : null),
    [dados, empresa, cargaLeitura.situacao],
  );
  const agentes = dados.catalogo.agentes;
  const estados = useMemo(() => {
    const contagem = new Map<string, number>();
    agentes.forEach(a => contagem.set(a.estado, (contagem.get(a.estado) ?? 0) + 1));
    return [...contagem].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [agentes]);
  const grupos = useMemo(() => {
    const termo = normaliza(busca.trim());
    const mapa = new Map<string, AgenteComando[]>();
    for (const a of agentes) {
      if (estado && a.estado !== estado) continue;
      if (termo && !normaliza(`${a.nome} ${a.identidade} ${a.cargo} ${a.id}`).includes(termo)) continue;
      const grupo = a.grupo.trim() || 'Sem grupo';
      mapa.set(grupo, [...(mapa.get(grupo) ?? []), a]);
    }
    return [...mapa];
  }, [agentes, busca, estado]);

  if (leitura.situacao === 'erro') {
    return <ExecutiveErrorState title="Não foi possível ler os agentes" message="Não foi possível ler a configuração ativa. A lista de agentes não é mostrada sem ela." />;
  }
  if (leitura.situacao === 'carregando') return <ExecutiveLoadingState message="Carregando os agentes" type="cards" rows={3} />;

  const total = grupos.reduce((n, [, lista]) => n + lista.length, 0);
  const filtrando = busca.trim() !== '' || estado !== null;

  return (
    <section aria-labelledby="agentes-titulo" className="space-y-5">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Agentes</p>
        <h2 id="agentes-titulo" className="mt-1 text-lg font-semibold tracking-tight text-foreground">Quem está no time e o que tem nas mãos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {agentes.length} {agentes.length === 1 ? 'agente' : 'agentes'} na configuração ativa{dados.catalogo.revisao ? ` (${dados.catalogo.revisao})` : ''}.
        </p>
      </header>

      <p role="note" className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm text-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>O estado vem da configuração ativa e não prova que o agente esteja operando.</span>
      </p>

      {cargaLeitura.situacao === 'erro' && (
        <ExecutiveErrorState title="Não foi possível ler a carga dos agentes" message="As etapas (ou os cards do filtro) não foram lidos. A carga aparece como indisponível, não como zero." />
      )}
      {cargaLeitura.situacao === 'carregando' && (
        <p role="status" className="text-xs text-muted-foreground">A carga atual ainda está carregando.</p>
      )}
      {cargaLeitura.situacao === 'pronta' && (
        <p className="text-xs text-muted-foreground">
          Carga: etapas abertas em que o agente é autor e revisões pendentes (etapa em revisão com o agente entre os revisores)
          {empresa !== 'GRUPO' ? `, só de ${nomeDaEmpresa(dados, empresa)}` : ''}.
          {dados.amostra ? ' Amostra: a leitura foi cortada por limite, a carga pode ser maior.' : ''}
        </p>
      )}

      {agentes.length === 0 ? (
        <ExecutiveEmptyState icon={Users} title="Nenhum agente na configuração ativa" description="O organograma da revisão ativa não lista agentes." />
      ) : (
        <>
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <label className="relative block">
              <span className="sr-only">Buscar agente por nome, cargo ou identidade</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar agente, cargo ou identidade"
                aria-label="Buscar agente por nome, cargo ou identidade"
                className="min-h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado da configuração">
              <button
                type="button"
                aria-pressed={estado === null}
                onClick={() => setEstado(null)}
                className={`${CHIP} ${estado === null ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card text-foreground hover:bg-accent'}`}
              >
                Todos <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{agentes.length}</span>
              </button>
              {estados.map(([codigo, n]) => (
                <button
                  key={codigo}
                  type="button"
                  aria-pressed={estado === codigo}
                  onClick={() => setEstado(estado === codigo ? null : codigo)}
                  className={`${CHIP} ${estado === codigo ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card text-foreground hover:bg-accent'}`}
                >
                  {rotuloEstadoConfig(codigo)} <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{n}</span>
                </button>
              ))}
            </div>
          </div>

          {total === 0 ? (
            <ExecutiveEmptyState
              icon={Search}
              title="Nenhum agente neste filtro"
              description="Tente outra busca ou outro estado."
              actionLabel={filtrando ? 'Limpar filtros' : undefined}
              onAction={filtrando ? () => { setBusca(''); setEstado(null); } : undefined}
            />
          ) : (
            grupos.map(([grupo, lista]) => (
              <section key={grupo} aria-label={`Grupo ${grupo}`} className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {grupo} <span className="font-normal text-muted-foreground">({lista.length})</span>
                </h3>
                <ul className="grid grid-cols-1 gap-3 p-0 md:grid-cols-2 xl:grid-cols-3">
                  {lista.map(agente => (
                    <AgenteCartao
                      key={agente.id}
                      agente={agente}
                      carga={carga?.get(chaveAgente(agente)) ?? null}
                      servicos={dados.catalogo.servicos.filter(s => mesmaIdentidade(s.dono, agente.identidade))}
                      recorte={carga && empresa !== 'GRUPO' ? nomeDaEmpresa(dados, empresa) : undefined}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </section>
  );
}
