/**
 * O que é: os três gráficos da Visão geral: (1) rosca de cards por estado, (2) barras empilhadas por empresa e
 * (3) barras de etapas abertas por agente. Cada um tem texto alternativo (role="img" + aria-label) e uma lista em texto.
 * Como mudar: os números vêm de porEstado(), porEmpresa() e etapasPorAgente() (derivar-visao-geral.ts). Cores só com tokens
 * do tema. Sem animação (isAnimationActive={false}) para não atrapalhar quem prefere menos movimento.
 */
import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ExecutiveEmptyState } from '@/components/executive/ExecutiveEmptyState';
import {
  cardsDaEmpresa, ESTILO_TOOLTIP, etapasPorAgente, porEmpresa, porEstado, recortarPorEmpresa, TIQUE_EIXO,
} from '@/integrations/comando-v2/derivar-visao-geral';
import { PorLeitura, type PropsVisao } from './KpisComando';
import { amostraDe } from '@/integrations/comando-v2/derivar-cards';

const COR_PRIMARIA = 'hsl(var(--primary))';
const COR_ESPERA = 'hsl(var(--warning))';
const COR_PRONTO = 'hsl(var(--success) / 0.45)';
const MAX_AGENTES = 10;

export function CartaoGrafico({ id, titulo, subtitulo, children }: { id: string; titulo: string; subtitulo?: string; children: ReactNode }) {
  return <section aria-labelledby={id} className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
    <h2 id={id} className="text-base font-semibold tracking-tight text-foreground">{titulo}</h2>
    {subtitulo && <p className="mt-0.5 text-xs text-muted-foreground">{subtitulo}</p>}
    <div className="mt-4">{children}</div>
  </section>;
}

export function ValoresEmTexto({ itens, titulo = 'Ver os números em texto' }: { itens: string[]; titulo?: string }) {
  return <details className="mt-3 text-xs text-muted-foreground">
    <summary className="flex min-h-11 cursor-pointer items-center rounded-md font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{titulo}</summary>
    <ul className="mt-1 list-disc space-y-1 pl-5">{itens.map(t => <li key={t}>{t}</li>)}</ul>
  </details>;
}

const unidade = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function GraficoEstados({ dados, empresa }: PropsVisao) {
  return <CartaoGrafico id="grafico-estados" titulo="Cards por estado" subtitulo="Como os cards se distribuem hoje.">
    <PorLeitura estados={[dados.estado.cards]} oQue="os cards por estado" linhas={3}>
      <Estados dados={dados} empresa={empresa} />
    </PorLeitura>
  </CartaoGrafico>;
}

function Estados({ dados, empresa }: PropsVisao) {
  const cards = cardsDaEmpresa(dados.cards, empresa);
  const fatias = porEstado(cards);
  if (cards.length === 0) {
    return <ExecutiveEmptyState title="Nenhum card ainda" description="Quando houver cards, a distribuição por estado aparece aqui." />;
  }
  const rotulo = `Cards por estado: ${fatias.map(f => `${f.rotulo} ${f.quantidade}`).join('; ')}. Total ${cards.length}.`;
  return <>
    <div role="img" aria-label={rotulo} className="relative">
      <ResponsiveContainer width="100%" height={210}>
        <PieChart>
          <Pie data={fatias} dataKey="quantidade" nameKey="rotulo" cx="50%" cy="50%" innerRadius={62} outerRadius={88}
            paddingAngle={2} stroke="hsl(var(--card))" isAnimationActive={false}>
            {fatias.map(f => <Cell key={f.estado} fill={f.cor} />)}
          </Pie>
          <Tooltip contentStyle={ESTILO_TOOLTIP} formatter={(v: number) => [unidade(v, 'card', 'cards'), 'Quantidade']} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
        <div className="text-center"><div className="text-3xl font-semibold text-foreground">{cards.length}</div>
          <div className="text-[11px] text-muted-foreground">{amostraDe(dados, ['cards']) ? 'na amostra' : 'cards'}</div></div>
      </div>
    </div>
    <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2" aria-label="Legenda">
      {fatias.map(f => <li key={f.estado} className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-sm border border-border" style={{ background: f.cor }} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{f.rotulo}</span>
        <span className="font-semibold text-foreground">{f.quantidade}</span>
      </li>)}
    </ul>
    <ValoresEmTexto itens={fatias.map(f => `${f.rotulo}: ${unidade(f.quantidade, 'card', 'cards')}`)} />
  </>;
}

export function GraficoEmpresas({ dados, empresa }: PropsVisao) {
  return <CartaoGrafico id="grafico-empresas" titulo="Cards por empresa" subtitulo="Abertos, esperando você e prontos.">
    <PorLeitura estados={[dados.estado.cards]} oQue="os cards por empresa" linhas={3}>
      <Empresas dados={dados} empresa={empresa} />
    </PorLeitura>
  </CartaoGrafico>;
}

function Empresas({ dados, empresa }: PropsVisao) {
  const linhas = porEmpresa(dados.cards, [], dados.catalogo, empresa);
  const total = linhas.reduce((s, l) => s + l.abertos + l.prontos, 0);
  if (linhas.length === 0 || total === 0) {
    return <ExecutiveEmptyState title="Nenhum card aberto ou pronto" description="Quando as empresas tiverem cards, as barras aparecem aqui." />;
  }
  const serie = linhas.map(l => ({ nome: l.nome, 'Outros abertos': l.outrosAbertos, 'Esperando você': l.esperando, Prontos: l.prontos }));
  const rotulo = `Cards por empresa: ${linhas.map(l => `${l.nome}, ${l.outrosAbertos} outros abertos, ${l.esperando} esperando você, ${l.prontos} prontos`).join('; ')}.`;
  return <>
    {dados.estado.catalogo === 'erro' && <p role="status" className="mb-2 text-xs text-warning">Não foi possível ler os nomes das empresas; aparecem os códigos.</p>}
    <div role="img" aria-label={rotulo}>
      <ResponsiveContainer width="100%" height={Math.max(150, serie.length * 44 + 40)}>
        <BarChart data={serie} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }} barSize={18}>
          <CartesianGrid strokeDasharray="3 6" horizontal={false} stroke="hsl(var(--border))" />
          <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={TIQUE_EIXO} />
          <YAxis type="category" dataKey="nome" width={96} axisLine={false} tickLine={false} tick={TIQUE_EIXO}
            tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)} />
          <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} contentStyle={ESTILO_TOOLTIP} />
          <Bar dataKey="Outros abertos" stackId="c" fill={COR_PRIMARIA} isAnimationActive={false} />
          <Bar dataKey="Esperando você" stackId="c" fill={COR_ESPERA} isAnimationActive={false} />
          <Bar dataKey="Prontos" stackId="c" fill={COR_PRONTO} isAnimationActive={false} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
      {[['Outros abertos', COR_PRIMARIA], ['Esperando você', COR_ESPERA], ['Prontos', COR_PRONTO]].map(([n, c]) => <li key={n} className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-sm border border-border" style={{ background: c }} aria-hidden="true" />{n}</li>)}
    </ul>
    <ValoresEmTexto itens={linhas.map(l => `${l.nome}: ${l.outrosAbertos} outros abertos, ${l.esperando} esperando você, ${l.prontos} prontos`)} />
  </>;
}

export function GraficoAgentes({ dados, empresa }: PropsVisao) {
  // Com filtro de empresa, as etapas só podem ser recortadas se os cards foram lidos.
  const estados = empresa === 'GRUPO' ? [dados.estado.etapas] : [dados.estado.etapas, dados.estado.cards];
  return <CartaoGrafico id="grafico-agentes" titulo="Etapas abertas por agente" subtitulo="Quem está com mais trabalho em andamento.">
    <PorLeitura estados={estados} oQue="as etapas por agente" linhas={3}>
      <Agentes dados={dados} empresa={empresa} />
    </PorLeitura>
  </CartaoGrafico>;
}

function Agentes({ dados, empresa }: PropsVisao) {
  const recorte = recortarPorEmpresa(dados, empresa);
  const todos = etapasPorAgente(recorte.etapas, dados.catalogo, dados.estado.cards === 'pronta' ? dados.cards : undefined);
  if (todos.length === 0) {
    return <ExecutiveEmptyState title="Nenhuma etapa aberta" description="Quando houver etapas em andamento, elas aparecem aqui por agente." />;
  }
  const linhas = todos.slice(0, MAX_AGENTES);
  const resto = todos.length - linhas.length;
  const serie = linhas.map(l => ({ nome: l.nome, Etapas: l.etapas }));
  const rotulo = `Etapas abertas por agente: ${linhas.map(l => `${l.nome} ${l.etapas}`).join('; ')}.`;
  return <>
    <div role="img" aria-label={rotulo}>
      <ResponsiveContainer width="100%" height={Math.max(130, serie.length * 34 + 30)}>
        <BarChart data={serie} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }} barSize={16}>
          <CartesianGrid strokeDasharray="3 6" horizontal={false} stroke="hsl(var(--border))" />
          <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={TIQUE_EIXO} />
          <YAxis type="category" dataKey="nome" width={96} axisLine={false} tickLine={false} tick={TIQUE_EIXO}
            tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)} />
          <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} contentStyle={ESTILO_TOOLTIP} />
          <Bar dataKey="Etapas" fill={COR_PRIMARIA} radius={[0, 6, 6, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    {resto > 0 && <p className="mt-1 text-xs text-muted-foreground">Mais {unidade(resto, 'agente', 'agentes')} fora do gráfico (veja o texto abaixo).</p>}
    {(dados.estado.catalogo === 'erro' || todos.some(l => l.naoCadastrado)) && <p className="mt-1 text-xs text-muted-foreground">
      {dados.estado.catalogo === 'erro' ? 'Não foi possível ler o catálogo de agentes; aparece o nome gravado na etapa.'
        : 'Alguns autores não estão no catálogo de agentes; aparece o nome gravado na etapa.'}
    </p>}
    <ValoresEmTexto itens={todos.map(l => `${l.nome}: ${unidade(l.etapas, 'etapa aberta', 'etapas abertas')}`)} />
  </>;
}

export default function GraficosComando({ dados, empresa }: PropsVisao) {
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" data-testid="graficos-comando">
    <GraficoEstados dados={dados} empresa={empresa} />
    <GraficoEmpresas dados={dados} empresa={empresa} />
    <GraficoAgentes dados={dados} empresa={empresa} />
  </div>;
}
