/**
 * O que é: a linha do tempo dos últimos 14 dias: cards criados, pedidos recebidos e entregas aprovadas por dia (fuso de
 * São Paulo). Cada série cuja leitura falhou sai do gráfico com aviso (nunca vira zero); sem nenhuma, mostra o erro.
 * Como mudar: a série vem de `serieDiaria()` (derivar-visao-geral.ts). Cores só com tokens do tema; traços diferentes
 * para não depender só da cor.
 */
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ExecutiveEmptyState } from '@/components/executive/ExecutiveEmptyState';
import { ExecutiveLoadingState } from '@/components/executive/ExecutiveLoadingState';
import { PorLeitura, type PropsVisao } from './KpisComando';
import { CartaoGrafico, ValoresEmTexto } from './GraficosComando';
import { entregasAprovadas } from '@/integrations/comando-v2/supervisao-v2';
import { combinarLeituras } from '@/integrations/comando-v2/derivar-cards';
import { ESTILO_TOOLTIP, recortarPorEmpresa, serieDiaria, TIQUE_EIXO } from '@/integrations/comando-v2/derivar-visao-geral';
import type { DadosComando } from '@/integrations/comando-v2/tipos';
import { amostraDe } from '@/integrations/comando-v2/derivar-cards';

export const DIAS_LINHA_DO_TEMPO = 14;
type Campo = 'cards' | 'pedidos' | 'entregas';
const SERIES: { campo: Campo; nome: string; fonte: keyof DadosComando['estado']; cor: string; traco?: string }[] = [
  { campo: 'cards', nome: 'Cards criados', fonte: 'cards', cor: 'hsl(var(--primary))' },
  { campo: 'pedidos', nome: 'Pedidos recebidos', fonte: 'pedidos', cor: 'hsl(var(--warning))', traco: '5 4' },
  { campo: 'entregas', nome: 'Entregas aprovadas', fonte: 'entregas', cor: 'hsl(var(--foreground) / 0.65)', traco: '2 3' },
];

export default function LinhaDoTempo({ dados, empresa }: PropsVisao) {
  return <CartaoGrafico id="linha-do-tempo-titulo" titulo="Últimos 14 dias"
    subtitulo={`Cards criados, pedidos recebidos e entregas aprovadas por dia${empresa !== 'GRUPO' ? ' (pedidos só entram se ligados à empresa)' : ''}.`}>
    <Corpo dados={dados} empresa={empresa} />
  </CartaoGrafico>;
}

function Corpo({ dados, empresa }: PropsVisao) {
  // Entrega aprovada = etapa aprovada + entrega fresca + versão atual: depende também da leitura das etapas.
  const leitura = (s: (typeof SERIES)[number]) => s.campo === 'entregas' ? combinarLeituras(dados.estado, ['entregas', 'etapas']).estado : dados.estado[s.fonte];
  const estados = SERIES.map(leitura);
  // Com filtro de empresa, tudo depende dos cards: sem eles, não dá para recortar nada.
  if (empresa !== 'GRUPO' && dados.estado.cards !== 'pronta') {
    return <PorLeitura estados={[dados.estado.cards]} oQue="a linha do tempo"><span /></PorLeitura>;
  }
  if (estados.every(e => e === 'erro')) return <PorLeitura estados={['erro']} oQue="a linha do tempo"><span /></PorLeitura>;
  if (estados.some(e => e === 'carregando')) return <ExecutiveLoadingState message="Carregando a linha do tempo" rows={3} />;
  const visiveis = SERIES.filter(s => leitura(s) === 'pronta');
  const faltando = SERIES.filter(s => leitura(s) === 'erro');
  const recorte = recortarPorEmpresa({ ...dados, entregas: entregasAprovadas(dados) ?? [] }, empresa);
  const serie = serieDiaria(recorte, dados.agora, DIAS_LINHA_DO_TEMPO);
  const total = serie.reduce((s, p) => s + visiveis.reduce((x, v) => x + p[v.campo], 0), 0);
  const aviso = <>
    {faltando.length > 0 && <p role="status" className="mb-2 text-xs text-warning">
      Não foi possível ler: {faltando.map(f => f.nome.toLowerCase()).join(', ')}. Essa linha não aparece (não é zero).
    </p>}
    {amostraDe(dados, ['cards', 'pedidos', 'entregas']) && <p className="mb-2 text-xs text-muted-foreground">Amostra, não o total: dias mais antigos podem estar incompletos.</p>}
  </>;
  if (total === 0) {
    return <>{aviso}<ExecutiveEmptyState title="Nada nos últimos 14 dias"
      description="Não houve cards criados, pedidos recebidos nem entregas aprovadas neste período." /></>;
  }
  const rotulo = `Últimos ${DIAS_LINHA_DO_TEMPO} dias, por dia: ${visiveis.map(v => `${v.nome} somam ${serie.reduce((s, p) => s + p[v.campo], 0)}`).join('; ')}.`;
  return <>
    {aviso}
    <div role="img" aria-label={rotulo}>
      <ResponsiveContainer width="100%" height={230}>
        <AreaChart data={serie} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="rotulo" axisLine={false} tickLine={false} tick={TIQUE_EIXO} interval="preserveStartEnd" minTickGap={18} />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={TIQUE_EIXO} />
          <Tooltip contentStyle={ESTILO_TOOLTIP} />
          {visiveis.map(s => <Area key={s.campo} type="monotone" dataKey={s.campo} name={s.nome} stroke={s.cor}
            strokeWidth={2} strokeDasharray={s.traco} fill={s.cor} fillOpacity={0.1} isAnimationActive={false} dot={false} />)}
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
      {visiveis.map(s => <li key={s.campo} className="flex items-center gap-2">
        <svg width="22" height="6" aria-hidden="true"><line x1="0" y1="3" x2="22" y2="3" stroke={s.cor} strokeWidth="2" strokeDasharray={s.traco} /></svg>
        {s.nome}
      </li>)}
    </ul>
    <ValoresEmTexto itens={serie.map(p => `${p.rotulo}: ${visiveis.map(v => `${p[v.campo]} ${v.nome.toLowerCase()}`).join(', ')}`)} />
  </>;
}
