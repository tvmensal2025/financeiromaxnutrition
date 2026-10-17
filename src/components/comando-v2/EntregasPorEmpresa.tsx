/**
 * O que é: a faixa "Entregas por empresa": para cada empresa, cards abertos, esperando você, prontos e entregas aprovadas.
 * Como mudar: os números vêm de `porEmpresa()` (derivar-visao-geral.ts). Entrega aprovada = passou no portão 1.
 */
import { ExecutiveEmptyState } from '@/components/executive/ExecutiveEmptyState';
import { Building2 } from 'lucide-react';
import { porEmpresa } from '@/integrations/comando-v2/derivar-visao-geral';
import { PorLeitura, type PropsVisao } from './KpisComando';
import { amostraDe } from '@/integrations/comando-v2/derivar-cards';

export default function EntregasPorEmpresa({ dados, empresa }: PropsVisao) {
  return <section aria-labelledby="entregas-empresa-titulo" className="rounded-xl border border-border bg-card p-4 sm:p-5">
    <h2 id="entregas-empresa-titulo" className="text-base font-semibold tracking-tight text-foreground">Entregas por empresa</h2>
    <p className="mt-0.5 text-xs text-muted-foreground">
      Cards e entregas aprovadas (que passaram no primeiro portão) de cada empresa.{amostraDe(dados, ['cards', 'entregas']) ? ' Amostra, não o total.' : ''}
    </p>
    <div className="mt-4">
      <PorLeitura estados={[dados.estado.cards]} oQue="as empresas" linhas={2}>
        <Faixa dados={dados} empresa={empresa} />
      </PorLeitura>
    </div>
  </section>;
}

function Faixa({ dados, empresa }: PropsVisao) {
  const linhas = porEmpresa(dados.cards, dados.estado.entregas === 'pronta' ? dados.entregas : [], dados.catalogo, empresa);
  const entregasOk = dados.estado.entregas === 'pronta';
  if (linhas.length === 0) {
    return <ExecutiveEmptyState icon={Building2} title="Nenhuma empresa para mostrar"
      description="O catálogo ainda não trouxe empresas e nenhum card aponta para uma." />;
  }
  return <>
    {dados.estado.catalogo === 'erro' && <p role="status" className="mb-3 text-xs text-warning">Não foi possível ler os nomes das empresas; aparecem os códigos.</p>}
    {!entregasOk && <p role="status" className="mb-3 text-xs text-warning">
      {dados.estado.entregas === 'erro' ? 'Não foi possível ler as entregas; a coluna "Entregas" não é mostrada para não parecer zero.' : 'Lendo as entregas…'}
    </p>}
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {linhas.map(l => <li key={l.id} className="rounded-lg border border-border bg-background/50 p-3">
        <h3 className="break-words text-sm font-semibold text-foreground">{l.nome}</h3>
        <dl className="mt-2 grid grid-cols-4 gap-2 text-center">
          <Numero rotulo="Abertos" valor={l.abertos} />
          <Numero rotulo="Esperando" valor={l.esperando} destaque={l.esperando > 0} />
          <Numero rotulo="Prontos" valor={l.prontos} />
          <Numero rotulo="Entregas" valor={entregasOk ? l.entregas : null} />
        </dl>
      </li>)}
    </ul>
  </>;
}

function Numero({ rotulo, valor, destaque = false }: { rotulo: string; valor: number | null; destaque?: boolean }) {
  return <div>
    <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
    <dd className={`mt-0.5 text-xl font-semibold ${destaque ? 'text-warning' : 'text-foreground'}`}>{valor ?? '—'}</dd>
  </div>;
}
