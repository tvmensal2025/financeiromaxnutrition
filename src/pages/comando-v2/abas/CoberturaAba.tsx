/**
 * O que é: a aba Cobertura da Sala de comando v2 — a matriz serviço x empresa montada com a configuração ativa (estado do
 * serviço e empresas atendidas) e, por serviço, um indicador APROXIMADO de "tem entrega aprovada?".
 * Como mudar: a matriz vem de `dados.catalogo`; a entrega aprovada de `entregasAprovadas` (src/integrations/comando-v2/supervisao-v2.ts).
 * É cobertura da CONFIGURAÇÃO: não prova operação do motor, do Telegram ou da VPS.
 */
import { useMemo } from 'react';
import { AlertTriangle, Check, Info, Minus, Network } from 'lucide-react';
import { ExecutiveBadge, type BadgeVariant } from '@/components/executive/ExecutiveBadge';
import { ExecutiveEmptyState } from '@/components/executive/ExecutiveEmptyState';
import { ExecutiveErrorState } from '@/components/executive/ExecutiveErrorState';
import { ExecutiveLoadingState } from '@/components/executive/ExecutiveLoadingState';
import {
  entregasAprovadas, mesmaIdentidade, nomeDaEmpresa, rotuloEstadoConfig, situacaoDasLeituras,
} from '@/integrations/comando-v2/supervisao-v2';
import type { PropsAba } from '@/integrations/comando-v2/tipos';
import type { ServicoCatalogo } from '@/integrations/operacao-v2/catalogo';
import { amostraDe } from '@/integrations/comando-v2/derivar-cards';

/** Estados de serviço que recebem card real na v2 (helena-v2/servicos.yaml: recebem_card). */
const RECEBEM_CARD = ['ESTAGIO', 'ATIVO'];
const VARIANTE_ESTADO: Record<string, BadgeVariant> = {
  ATIVO: 'success', ESTAGIO: 'info', EM_TESTE: 'purple', RASCUNHO: 'neutral', PAUSADO: 'warning', APOSENTADO: 'outline',
};

type Entrega = { situacao: 'indisponivel' } | { situacao: 'ok'; quantidade: number };

function SeloEntrega({ entrega }: { entrega: Entrega }) {
  if (entrega.situacao === 'indisponivel') return <ExecutiveBadge variant="neutral">Indisponível</ExecutiveBadge>;
  return entrega.quantidade > 0
    ? <ExecutiveBadge variant="success" dot>Sim ({entrega.quantidade}) · aproximação</ExecutiveBadge>
    : <ExecutiveBadge variant="warning" dot>Não · aproximação</ExecutiveBadge>;
}

function Atende({ atende, empresa }: { atende: boolean; empresa: string }) {
  return atende ? (
    <span className="inline-flex items-center gap-1 text-success">
      <Check className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">Atende {empresa}</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Minus className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">Não atende {empresa}</span>
    </span>
  );
}

export default function CoberturaAba({ dados, empresa }: PropsAba) {
  const leitura = situacaoDasLeituras(dados, ['catalogo']);
  const empresas = useMemo(
    () => dados.catalogo.empresas.filter(e => empresa === 'GRUPO' || e.id === empresa),
    [dados.catalogo.empresas, empresa],
  );
  const conhecidas = useMemo(() => new Set(dados.catalogo.empresas.map(e => e.id)), [dados.catalogo.empresas]);
  const servicos = dados.catalogo.servicos;

  const { entregaPronta, entregaDe } = useMemo(() => {
    const aprovadas = entregasAprovadas(dados);
    const precisaCards = empresa !== 'GRUPO';
    if (aprovadas === null || (precisaCards && dados.estado.cards !== 'pronta')) {
      return { entregaPronta: false, entregaDe: (): Entrega => ({ situacao: 'indisponivel' }) };
    }
    const empresaDoCard = new Map(dados.cards.map(c => [c.id, c.empresa]));
    const doRecorte = aprovadas.filter(en => !precisaCards || empresaDoCard.get(en.card_id) === empresa);
    return {
      entregaPronta: true,
      entregaDe: (s: ServicoCatalogo): Entrega => ({
        situacao: 'ok', quantidade: doRecorte.filter(en => mesmaIdentidade(en.autor, s.dono)).length,
      }),
    };
  }, [dados, empresa]);

  const semServico = useMemo(
    () => empresas.filter(e => !servicos.some(s => RECEBEM_CARD.includes(s.estado) && s.empresas.includes(e.id))),
    [empresas, servicos],
  );

  if (leitura.situacao === 'erro') {
    return <ExecutiveErrorState title="Não foi possível ler a cobertura" message="Não foi possível ler a configuração ativa. A matriz não é mostrada sem ela." />;
  }
  if (leitura.situacao === 'carregando') return <ExecutiveLoadingState message="Carregando a cobertura" rows={5} />;

  const recebem = servicos.filter(s => RECEBEM_CARD.includes(s.estado)).length;
  const mostraOutras = servicos.some(s => s.empresas.some(id => !conhecidas.has(id)));
  const outras = (s: ServicoCatalogo) => s.empresas.filter(id => !conhecidas.has(id));

  return (
    <section aria-labelledby="cobertura-titulo" className="space-y-5">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cobertura</p>
        <h2 id="cobertura-titulo" className="mt-1 text-lg font-semibold tracking-tight text-foreground">Que serviço atende qual empresa</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {servicos.length} {servicos.length === 1 ? 'serviço' : 'serviços'} na configuração ativa; {recebem} {recebem === 1 ? 'recebe' : 'recebem'} card real agora (em estágio ou ativos).
        </p>
      </header>

      <p role="note" className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm text-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>Cobertura da configuração, não prova de operação do motor, do Telegram ou da VPS.</span>
      </p>

      {amostraDe(dados, ['cards', 'etapas', 'entregas']) && (
        <p role="note" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <span>Amostra: a leitura foi cortada por limite. O indicador de entrega pode estar incompleto.</span>
        </p>
      )}

      {servicos.length === 0 ? (
        <ExecutiveEmptyState icon={Network} title="Nenhum serviço na configuração ativa" description="A revisão ativa não lista serviços, então não há cobertura para mostrar." />
      ) : (
        <>
          {semServico.length > 0 && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              <span>
                Sem serviço que receba card real: {semServico.map(e => e.nome).join(', ')}.
              </span>
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            <strong className="font-medium text-foreground">Entrega aprovada (aproximação):</strong> conta entregas aprovadas escritas pelo dono do serviço
            {empresa !== 'GRUPO' ? `, só de cards de ${nomeDaEmpresa(dados, empresa)}` : ''}. A entrega não guarda de qual serviço veio,
            então um dono com vários serviços aparece igual em todos.
            {!entregaPronta ? ' Agora a leitura de etapas ou entregas não está pronta: o indicador aparece como indisponível.' : ''}
          </p>

          {/* Computador: matriz */}
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <caption className="sr-only">Matriz de serviços por empresa</caption>
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-semibold">Serviço</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Estado</th>
                  {empresas.map(e => <th key={e.id} scope="col" className="px-3 py-3 text-center font-semibold" title={e.nome}>{e.nome}</th>)}
                  {mostraOutras && <th scope="col" className="px-3 py-3 font-semibold">Outras</th>}
                  <th scope="col" className="px-3 py-3 font-semibold">Entrega aprovada? (aproximação)</th>
                </tr>
              </thead>
              <tbody>
                {servicos.map(s => (
                  <tr key={s.id} className="border-b border-border/60 last:border-0">
                    <th scope="row" className="px-4 py-3 font-medium text-foreground">
                      {s.nome}
                      <span className="block text-xs font-normal text-muted-foreground">{s.id}{s.dono ? ` · dono ${s.dono}` : ' · sem dono'}</span>
                    </th>
                    <td className="px-3 py-3"><ExecutiveBadge variant={VARIANTE_ESTADO[s.estado] ?? 'neutral'} dot>{rotuloEstadoConfig(s.estado)}</ExecutiveBadge></td>
                    {empresas.map(e => <td key={e.id} className="px-3 py-3 text-center"><Atende atende={s.empresas.includes(e.id)} empresa={e.nome} /></td>)}
                    {mostraOutras && <td className="px-3 py-3 text-xs text-muted-foreground">{outras(s).join(', ') || '—'}</td>}
                    <td className="px-3 py-3"><SeloEntrega entrega={entregaDe(s)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular: um cartão por serviço */}
          <ul aria-label="Serviços" className="space-y-3 p-0 md:hidden">
            {servicos.map(s => (
              <li key={s.id} className="list-none rounded-xl border border-border bg-card p-4">
                <h3 className="break-words text-sm font-semibold text-foreground">{s.nome}</h3>
                <p className="text-xs text-muted-foreground">{s.id}{s.dono ? ` · dono ${s.dono}` : ' · sem dono'}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ExecutiveBadge variant={VARIANTE_ESTADO[s.estado] ?? 'neutral'} dot>{rotuloEstadoConfig(s.estado)}</ExecutiveBadge>
                  <SeloEntrega entrega={entregaDe(s)} />
                </div>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Empresas</p>
                <ul className="mt-1 flex flex-wrap gap-1.5 p-0">
                  {empresas.map(e => {
                    const atende = s.empresas.includes(e.id);
                    return (
                      <li key={e.id} className="list-none">
                        <ExecutiveBadge variant={atende ? 'success' : 'neutral'}>
                          {atende ? <Check className="h-3 w-3" aria-hidden="true" /> : <Minus className="h-3 w-3" aria-hidden="true" />}
                          {e.nome}<span className="sr-only">{atende ? ': atende' : ': não atende'}</span>
                        </ExecutiveBadge>
                      </li>
                    );
                  })}
                  {outras(s).map(id => <li key={id} className="list-none"><ExecutiveBadge variant="outline">{id}</ExecutiveBadge></li>)}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
