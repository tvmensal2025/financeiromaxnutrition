/**
 * O que é: aba "Consumo" da Sala de comando v2. Mostra só VOLUME que o banco já entrega (entregas aprovadas por semana,
 * execuções por etapa e etapas abertas). Consumo de tokens e custo NÃO são medidos aqui e a tela diz isso, sem número.
 * Como mudar: os cálculos ficam em src/integrations/comando-v2/derivar-execucao.ts. Medir tokens/custo exige uma função
 * nova no banco, que só o fundador pode autorizar (ver o painel "ainda não medido" no fim da aba).
 */
import { useMemo, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Boxes, CheckCircle2, Info, Repeat2 } from 'lucide-react';
import { ExecutiveEmptyState } from '@/components/executive/ExecutiveEmptyState';
import { ExecutiveErrorState } from '@/components/executive/ExecutiveErrorState';
import { ExecutiveLoadingState } from '@/components/executive/ExecutiveLoadingState';
import { ExecutiveMetricCard } from '@/components/executive/ExecutiveMetricCard';
import { entregasPorSemana, estadoCombinado, execucoesPorEtapa, nomeEmpresa } from '@/integrations/comando-v2/derivar-execucao';
import type { EstadoLeitura, PropsAba } from '@/integrations/comando-v2/tipos';

const EIXO = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };
const DICA = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))', fontSize: 12 };
const MAX_ETAPAS_NO_GRAFICO = 8;

type Barra = { nome: string; valor: number };

/** Gráfico de barras com nome acessível e alternativa em texto (tabela só para leitores de tela). */
function GraficoBarras({ titulo, rotuloValor, dados, horizontal = false }: { titulo: string; rotuloValor: string; dados: Barra[]; horizontal?: boolean }) {
  const altura = horizontal ? Math.max(180, dados.length * 36 + 40) : 220;
  const resumo = `${titulo}. ${dados.map(d => `${d.nome}: ${d.valor}`).join('; ')}.`;
  return (
    <div>
      <div role="img" aria-label={resumo} style={{ height: altura }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 16, right: 24, bottom: 4, left: horizontal ? 8 : 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={!horizontal} horizontal={horizontal ? false : true} />
            {horizontal
              ? <><XAxis type="number" allowDecimals={false} tick={EIXO} stroke="hsl(var(--border))" /><YAxis type="category" dataKey="nome" width={130} tick={EIXO} stroke="hsl(var(--border))" /></>
              : <><XAxis dataKey="nome" tick={EIXO} stroke="hsl(var(--border))" /><YAxis allowDecimals={false} tick={EIXO} stroke="hsl(var(--border))" width={32} /></>}
            <Tooltip contentStyle={DICA} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} formatter={(v: number) => [v, rotuloValor]} />
            <Bar dataKey="valor" name={rotuloValor} fill="hsl(var(--primary))" radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} isAnimationActive={false}>
              <LabelList dataKey="valor" position={horizontal ? 'right' : 'top'} fill="hsl(var(--foreground))" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* O sr-only vai no div: numa <table> o navegador ignora width/overflow e ela alargava a página no celular. */}
      <div className="sr-only">
        <table>
          <caption>{titulo}</caption>
          <thead><tr><th scope="col">Item</th><th scope="col">{rotuloValor}</th></tr></thead>
          <tbody>{dados.map(d => <tr key={d.nome}><th scope="row">{d.nome}</th><td>{d.valor}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function Painel({ titulo, descricao, children }: { titulo: string; descricao: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{titulo}</h3>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{descricao}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Leitura({ estado, titulo, children }: { estado: EstadoLeitura; titulo: string; children: ReactNode }) {
  if (estado === 'carregando') return <ExecutiveLoadingState message={`Carregando ${titulo.toLowerCase()}`} rows={2} />;
  if (estado === 'erro') {
    return <ExecutiveErrorState title={`Não foi possível ler: ${titulo}`} message="A leitura falhou, então nenhum número é mostrado. Isto não significa que o volume é zero." />;
  }
  return <>{children}</>;
}

export default function ConsumoAba({ dados, empresa }: PropsAba) {
  const { estado, catalogo } = dados;
  const semanal = useMemo(() => entregasPorSemana(dados, empresa), [dados, empresa]);
  const etapas = useMemo(() => execucoesPorEtapa(dados, empresa), [dados, empresa]);
  // Entrega aprovada depende também das etapas (etapa aprovada, entrega fresca, versão atual).
  const fonteEntregas = empresa === 'GRUPO' ? estadoCombinado(estado.entregas, estado.etapas) : estadoCombinado(estado.entregas, estado.etapas, estado.cards);
  const fonteEtapas = empresa === 'GRUPO' ? estado.etapas : estadoCombinado(estado.etapas, estado.cards);
  const amostra = dados.amostra ? ' (amostra recente)' : '';

  return (
    <div className="space-y-5" data-aba="consumo">
      <header>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Consumo</h2>
        <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
          Volume de trabalho medido nos dados da v2{empresa !== 'GRUPO' ? ` para ${nomeEmpresa(catalogo, empresa)}` : ' para todas as empresas'}.
          Aqui você vê quanto foi feito, não quanto custou.
        </p>
      </header>

      {dados.amostra && (
        <p role="note" className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
          Amostra: a leitura foi cortada por limite. Os números valem para o que foi lido, não para o banco inteiro.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Resumo do volume">
        <ExecutiveMetricCard label="Entregas aprovadas" icon={CheckCircle2} hasData={fonteEntregas === 'pronta'}
          value={fonteEntregas === 'pronta' ? semanal.total : null} subtext={`Nas últimas 8 semanas${amostra}`} />
        <ExecutiveMetricCard label="Etapas abertas" icon={Boxes} hasData={fonteEtapas === 'pronta'}
          value={fonteEtapas === 'pronta' ? etapas.abertas : null} subtext={`Ainda não terminaram${amostra}`} />
        <ExecutiveMetricCard label="Execuções somadas" icon={Repeat2} hasData={fonteEtapas === 'pronta' && etapas.totalExecucoes !== null}
          value={etapas.totalExecucoes} subtext={fonteEtapas === 'pronta' && etapas.totalExecucoes === null ? 'O banco ainda não informou este número' : `Soma das tentativas por etapa${amostra}`} />
      </div>

      <Painel titulo="Entregas aprovadas por semana" descricao="Entregas aprovadas (etapa aprovada ou pronta, portão 1 passou, entrega atual), por semana (segunda a domingo, horário de Brasília). Últimas 8 semanas.">
        <Leitura estado={fonteEntregas} titulo="Entregas aprovadas por semana">
          {semanal.total === 0
            ? <ExecutiveEmptyState icon={CheckCircle2} title="Nenhuma entrega aprovada nas últimas 8 semanas"
                description="A leitura funcionou e não encontrou entregas aprovadas neste período." />
            : <GraficoBarras titulo="Entregas aprovadas por semana" rotuloValor="Entregas aprovadas" dados={semanal.semanas.map(s => ({ nome: s.rotulo, valor: s.total }))} />}
          {semanal.ocultas > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {semanal.ocultas} {semanal.ocultas === 1 ? 'entrega não pôde' : 'entregas não puderam'} ser ligada{semanal.ocultas === 1 ? '' : 's'} a uma empresa (o card não está na leitura) e ficam fora desta contagem.
            </p>
          )}
        </Leitura>
      </Painel>

      <Painel titulo="Execuções por etapa" descricao="Quantas vezes cada tipo de etapa rodou, somando o número de execuções que o banco registra por etapa.">
        <Leitura estado={fonteEtapas} titulo="Execuções por etapa">
          {etapas.grupos.length === 0
            ? <ExecutiveEmptyState icon={Repeat2} title="Sem número de execuções para mostrar"
                description={dados.etapas.length === 0 ? 'A leitura funcionou e não há etapas.' : 'Existem etapas, mas o banco ainda não informou quantas vezes cada uma rodou.'} />
            : <>
                <GraficoBarras horizontal titulo="Execuções por etapa" rotuloValor="Execuções"
                  dados={etapas.grupos.slice(0, MAX_ETAPAS_NO_GRAFICO).map(g => ({ nome: g.nome, valor: g.execucoes }))} />
                {etapas.grupos.length > MAX_ETAPAS_NO_GRAFICO && (
                  <p className="mt-2 text-xs text-muted-foreground">Mostrando as {MAX_ETAPAS_NO_GRAFICO} etapas com mais execuções, de {etapas.grupos.length}.</p>
                )}
                {etapas.semLeitura > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {etapas.semLeitura} {etapas.semLeitura === 1 ? 'etapa está' : 'etapas estão'} sem número de execuções e {etapas.semLeitura === 1 ? 'não entra' : 'não entram'} na soma.
                  </p>
                )}
              </>}
        </Leitura>
      </Painel>

      <section aria-label="Consumo de tokens e custo" className="rounded-xl border border-dashed border-border bg-muted/10 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted/60 text-muted-foreground"><Info className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">Consumo de tokens e custo: ainda não medido nesta tela</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Para medir é preciso uma função nova no banco que só o fundador pode autorizar. Enquanto isso, esta aba não mostra
              nenhum número de tokens ou de custo, para não passar uma ideia falsa de gasto zero.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
