/**
 * O que é: o cartão de um agente na aba Agentes — identidade, cargo, estado da configuração (traduzido), fase, carga atual
 * (etapas abertas como autor e revisões pendentes) e os serviços de que é dono.
 * Como mudar: a carga vem de `cargaPorAgente` (src/integrations/comando-v2/supervisao-v2.ts). O estado é o da CONFIGURAÇÃO ativa:
 * não prova que o agente esteja operando.
 */
import { ClipboardCheck, PenLine } from 'lucide-react';
import { ExecutiveBadge, type BadgeVariant } from '@/components/executive/ExecutiveBadge';
import { rotuloEstadoConfig, type CargaAgente } from '@/integrations/comando-v2/supervisao-v2';
import type { AgenteComando } from '@/integrations/comando-v2/tipos';
import type { ServicoCatalogo } from '@/integrations/operacao-v2/catalogo';

const VARIANTE_ESTADO: Record<string, BadgeVariant> = {
  ATIVO: 'success', ESTAGIO: 'info', EM_TESTE: 'purple', RASCUNHO: 'neutral', PAUSADO: 'warning', APOSENTADO: 'outline',
};
const MAX_SERVICOS = 4;

const iniciais = (nome: string) =>
  nome.trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('') || '?';

type Props = {
  agente: AgenteComando;
  /** null = não deu para ler as etapas (a carga aparece como indisponível, nunca como zero). */
  carga: CargaAgente | null;
  servicos: ServicoCatalogo[];
  /** Texto curto de recorte da carga, por exemplo o nome da empresa filtrada. */
  recorte?: string;
};

export default function AgenteCartao({ agente, carga, servicos, recorte }: Props) {
  const rotuloEstado = rotuloEstadoConfig(agente.estado);
  const nomeServicos = servicos.map(s => s.nome);
  return (
    <li className="list-none rounded-xl border border-border bg-card p-4" aria-label={`Agente ${agente.nome}`}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {iniciais(agente.nome)}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="break-words text-sm font-semibold text-foreground">{agente.nome}</h4>
          <p className="break-words text-xs text-muted-foreground">{agente.cargo || 'Cargo não informado'}</p>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{agente.id} · {agente.identidade}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ExecutiveBadge variant={VARIANTE_ESTADO[agente.estado] ?? 'neutral'} dot>Configuração: {rotuloEstado}</ExecutiveBadge>
        {agente.fase && <ExecutiveBadge variant="outline">Fase: {agente.fase}</ExecutiveBadge>}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border bg-background p-2.5">
          <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <PenLine className="h-3 w-3" aria-hidden="true" /> Escrevendo
          </dt>
          <dd className="mt-1">
            <span className="text-xl font-semibold text-foreground">{carga ? carga.etapasAbertas : <span aria-label="indisponível">—</span>}</span>
            <span className="block text-xs text-muted-foreground">etapas abertas como autor</span>
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-background p-2.5">
          <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <ClipboardCheck className="h-3 w-3" aria-hidden="true" /> Revisando
          </dt>
          <dd className="mt-1">
            <span className="text-xl font-semibold text-foreground">{carga ? carga.revisoesPendentes : <span aria-label="indisponível">—</span>}</span>
            <span className="block text-xs text-muted-foreground">revisões pendentes</span>
          </dd>
        </div>
      </dl>
      {recorte && <p className="mt-1.5 text-xs text-muted-foreground">Carga contada só em {recorte}.</p>}
      {!carga && <p className="mt-1.5 text-xs text-muted-foreground">Carga indisponível: as etapas não foram lidas.</p>}

      <div className="mt-3">
        <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Serviços de que é dono</h5>
        {servicos.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">Nenhum serviço no cadastro ativo.</p>
        ) : (
          <p className="mt-1 break-words text-xs text-foreground">
            {nomeServicos.slice(0, MAX_SERVICOS).join(', ')}
            {nomeServicos.length > MAX_SERVICOS && (
              <span className="text-muted-foreground"> e mais {nomeServicos.length - MAX_SERVICOS}</span>
            )}
          </p>
        )}
      </div>
    </li>
  );
}
