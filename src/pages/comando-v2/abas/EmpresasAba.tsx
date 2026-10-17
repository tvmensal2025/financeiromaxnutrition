/**
 * O que é: a aba Empresas da Sala de comando v2 — um cartão por empresa do cadastro ativo, com cards abertos, esperando
 * você, atrasados, prontos e entregas aprovadas, e o aviso do pacote de voz (sem pacote confirmado, o card da empresa é recusado).
 * Como mudar: as contas ficam em `resumirEmpresas` (src/integrations/comando-v2/supervisao-v2.ts); aqui só a aparência.
 */
import { AlertTriangle, ArrowUpRight, Building2, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ExecutiveBadge } from '@/components/executive/ExecutiveBadge';
import { ExecutiveEmptyState } from '@/components/executive/ExecutiveEmptyState';
import { ExecutiveErrorState } from '@/components/executive/ExecutiveErrorState';
import { ExecutiveLoadingState } from '@/components/executive/ExecutiveLoadingState';
import {
  listaDeFontes, resumirEmpresas, situacaoDasLeituras, type ResumoEmpresa,
} from '@/integrations/comando-v2/supervisao-v2';
import type { PropsAba } from '@/integrations/comando-v2/tipos';

type Numero = { rotulo: string; valor: number | null; destaque?: 'alerta' | 'atencao'; dica?: string };

function Indicador({ rotulo, valor, destaque, dica }: Numero) {
  const cor = valor && destaque === 'alerta' ? 'text-destructive' : valor && destaque === 'atencao' ? 'text-warning' : 'text-foreground';
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{rotulo}</dt>
      <dd className="mt-1">
        <span className={`text-2xl font-semibold tracking-tight ${cor}`}>
          {valor === null ? <span aria-label="indisponível">—</span> : valor}
        </span>
        {dica && <span className="block text-xs text-muted-foreground">{dica}</span>}
      </dd>
    </div>
  );
}

function CartaoEmpresa({ resumo }: { resumo: ResumoEmpresa }) {
  const numeros: Numero[] = [
    { rotulo: 'Cards abertos', valor: resumo.abertos },
    { rotulo: 'Esperando você', valor: resumo.esperandoVoce, destaque: 'atencao' },
    { rotulo: 'Atrasados', valor: resumo.atrasados, destaque: 'alerta' },
    { rotulo: 'Prontos', valor: resumo.prontos },
    { rotulo: 'Entregas aprovadas', valor: resumo.entregasAprovadas, dica: resumo.entregasAprovadas === null ? 'Leitura indisponível' : undefined },
  ];
  return (
    <li className="list-none rounded-xl border border-border bg-card p-4 sm:p-5" aria-label={`Empresa ${resumo.nome}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted/60 text-muted-foreground">
            <Building2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="break-words text-base font-semibold text-foreground">{resumo.nome}</h3>
            <p className="text-xs text-muted-foreground">{resumo.id}</p>
          </div>
        </div>
        {resumo.pacoteConfirmado ? (
          <ExecutiveBadge variant="success" dot>Pacote de voz confirmado</ExecutiveBadge>
        ) : (
          <ExecutiveBadge variant="warning" dot>Pacote de voz pendente</ExecutiveBadge>
        )}
      </div>

      {!resumo.pacoteConfirmado && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <span>Pacote de voz não confirmado: card dessa empresa é recusado.</span>
        </p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {numeros.map(n => <Indicador key={n.rotulo} {...n} />)}
      </dl>

      <div className="mt-4">
        <Link
          to="/comando?aba=cards"
          aria-label={`Ver cards (${resumo.nome}): abre a aba Cards`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Ver cards <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </li>
  );
}

export default function EmpresasAba({ dados, empresa }: PropsAba) {
  const leitura = situacaoDasLeituras(dados, ['cards', 'catalogo']);
  if (leitura.situacao === 'erro') {
    return (
      <ExecutiveErrorState
        title="Não foi possível ler as empresas"
        message={`Não foi possível ler ${listaDeFontes(leitura.falhas)}. Os números das empresas não são mostrados sem essa leitura.`}
      />
    );
  }
  if (leitura.situacao === 'carregando') return <ExecutiveLoadingState message="Carregando as empresas" type="cards" rows={2} />;

  const { empresas, semEmpresa } = resumirEmpresas(dados, empresa, dados.agora);
  const pacotesPendentes = empresas.filter(e => !e.pacoteConfirmado).length;
  const entregasFora = dados.estado.etapas !== 'pronta' || dados.estado.entregas !== 'pronta';

  return (
    <section aria-labelledby="empresas-titulo" className="space-y-5">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Empresas</p>
        <h2 id="empresas-titulo" className="mt-1 text-lg font-semibold tracking-tight text-foreground">Uma operação, cada empresa com a sua fila</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Números calculados com os cards lidos agora, por empresa do cadastro ativo.
          {pacotesPendentes > 0 && ` ${pacotesPendentes} ${pacotesPendentes === 1 ? 'empresa está' : 'empresas estão'} sem pacote de voz confirmado.`}
        </p>
      </header>

      {dados.amostra && (
        <p role="note" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <span>Amostra: a leitura foi cortada por limite. Os números descrevem só o que foi lido, não o total da empresa.</span>
        </p>
      )}
      {entregasFora && (
        <p role="note" className="text-xs text-muted-foreground">
          {dados.estado.etapas === 'erro' || dados.estado.entregas === 'erro'
            ? 'Não foi possível ler etapas ou entregas: as entregas aprovadas aparecem como indisponíveis, não como zero.'
            : 'Etapas e entregas ainda estão carregando: as entregas aprovadas aparecem como indisponíveis por enquanto.'}
        </p>
      )}

      {empresas.length === 0 ? (
        <ExecutiveEmptyState
          icon={Building2}
          title={empresa === 'GRUPO' ? 'Nenhuma empresa na configuração ativa' : 'Esta empresa não está na configuração ativa'}
          description="A lista vem da configuração ativa. Sem empresa cadastrada, não há o que mostrar aqui."
        />
      ) : (
        <ul aria-label="Empresas" className="space-y-3 p-0">
          {empresas.map(r => <CartaoEmpresa key={r.id} resumo={r} />)}
        </ul>
      )}

      {semEmpresa > 0 && (
        <p role="note" className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {semEmpresa} {semEmpresa === 1 ? 'card aberto não tem' : 'cards abertos não têm'} empresa do cadastro e por isso {semEmpresa === 1 ? 'não entra' : 'não entram'} nas contas acima.
          </span>
        </p>
      )}
    </section>
  );
}
