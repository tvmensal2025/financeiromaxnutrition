/**
 * O que é: a aba Supervisão da Sala de comando v2 — a fila de exceções (o que está sem dono, atrasado, parado ou esperando
 * você), com resumo por severidade e por regra. Lê só `PropsAba` (dados do esquema helena_v2); não decide nada, só aponta.
 * Como mudar: as regras ficam em src/integrations/comando-v2/supervisao-v2.ts; o cartão de cada exceção em
 * src/components/comando-v2/ExcecaoCard.tsx.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import ExcecaoCard from '@/components/comando-v2/ExcecaoCard';
import { ExecutiveEmptyState } from '@/components/executive/ExecutiveEmptyState';
import { ExecutiveErrorState } from '@/components/executive/ExecutiveErrorState';
import { ExecutiveLoadingState } from '@/components/executive/ExecutiveLoadingState';
import {
  analisarCardsV2, EXPLICACAO_REGRA, filtrarPorEmpresa, listaDeFontes, nomeDaEmpresa, ORDEM_REGRAS, resumirExcecoes,
  ROTULO_REGRA, ROTULO_SEVERIDADE, situacaoDasLeituras, type RegraSupervisao, type Severidade,
} from '@/integrations/comando-v2/supervisao-v2';
import type { PropsAba } from '@/integrations/comando-v2/tipos';

const PAGINA = 20;
const SEVERIDADES: Severidade[] = ['ALTA', 'MEDIA', 'BAIXA'];
const COR_SEVERIDADE: Record<Severidade, string> = {
  ALTA: 'text-destructive', MEDIA: 'text-warning', BAIXA: 'text-muted-foreground',
};
const CHIP = 'inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const CHIP_ATIVO = 'border-primary bg-primary/10 text-foreground';
const CHIP_INATIVO = 'border-border bg-card text-foreground hover:bg-accent';

export default function SupervisaoAba({ dados, empresa, abrirCard }: PropsAba) {
  const [severidade, setSeveridade] = useState<Severidade | null>(null);
  const [regra, setRegra] = useState<RegraSupervisao | null>(null);
  const [limite, setLimite] = useState(PAGINA);

  const leitura = situacaoDasLeituras(dados, ['cards', 'etapas']);
  const todas = useMemo(
    () => (leitura.situacao === 'pronta' ? analisarCardsV2(dados, dados.agora) : []),
    [dados, leitura.situacao],
  );
  const { itens: daEmpresa, semEmpresa } = useMemo(() => filtrarPorEmpresa(todas, empresa), [todas, empresa]);
  const resumo = useMemo(() => resumirExcecoes(daEmpresa), [daEmpresa]);
  const visiveis = daEmpresa.filter(e => (!severidade || e.severidade === severidade) && (!regra || e.regra === regra));

  if (leitura.situacao === 'erro') {
    return (
      <ExecutiveErrorState
        title="Não foi possível ler os dados da Supervisão"
        message={`Não foi possível ler ${listaDeFontes(leitura.falhas)}. Sem isso a Supervisão não afirma que está tudo certo.`}
      />
    );
  }
  if (leitura.situacao === 'carregando') return <ExecutiveLoadingState message="Carregando a Supervisão" type="cards" rows={3} />;

  const pedidosIndisponiveis = dados.estado.pedidos !== 'pronta';
  const filtrando = severidade !== null || regra !== null;
  const limpar = () => { setSeveridade(null); setRegra(null); setLimite(PAGINA); };

  return (
    <section aria-labelledby="supervisao-titulo" className="space-y-5">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Supervisão</p>
        <h2 id="supervisao-titulo" className="mt-1 text-lg font-semibold tracking-tight text-foreground">
          Exceções à vista. Cada card tem um dono.
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Apontamentos calculados com os cards, etapas e pedidos lidos agora. Eles pedem a sua atenção; não aprovam nem executam nada.
        </p>
      </header>

      {dados.amostra && (
        <p role="note" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <span>Amostra: a leitura foi cortada por limite. Podem existir outras exceções que não aparecem aqui.</span>
        </p>
      )}
      {pedidosIndisponiveis && (
        <p role="note" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <span>
            {dados.estado.pedidos === 'erro' ? 'Não foi possível ler os pedidos' : 'Os pedidos ainda estão carregando'}:
            a regra “Pedido sem card” não foi avaliada.
          </span>
        </p>
      )}
      {empresa !== 'GRUPO' && semEmpresa > 0 && (
        <p role="note" className="text-xs text-muted-foreground">
          Filtro: {nomeDaEmpresa(dados, empresa)}. {semEmpresa} {semEmpresa === 1 ? 'exceção' : 'exceções'} sem empresa definida
          {semEmpresa === 1 ? ' fica' : ' ficam'} fora desta lista; veja no filtro do grupo.
        </p>
      )}

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Por severidade</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {SEVERIDADES.map(s => (
              <button
                key={s}
                type="button"
                aria-pressed={severidade === s}
                aria-label={`Filtrar por severidade ${ROTULO_SEVERIDADE[s].toLowerCase()}: ${resumo.porSeveridade[s]}`}
                onClick={() => { setSeveridade(severidade === s ? null : s); setLimite(PAGINA); }}
                className={`${CHIP} ${severidade === s ? CHIP_ATIVO : CHIP_INATIVO}`}
              >
                <span className={`text-lg font-semibold leading-none ${COR_SEVERIDADE[s]}`}>{resumo.porSeveridade[s]}</span>
                {ROTULO_SEVERIDADE[s]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Por regra</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {ORDEM_REGRAS.filter(r => (resumo.porRegra[r] ?? 0) > 0).map(r => (
              <button
                key={r}
                type="button"
                aria-pressed={regra === r}
                aria-label={`Filtrar pela regra ${ROTULO_REGRA[r]}: ${resumo.porRegra[r]}`}
                title={EXPLICACAO_REGRA[r]}
                onClick={() => { setRegra(regra === r ? null : r); setLimite(PAGINA); }}
                className={`${CHIP} ${regra === r ? CHIP_ATIVO : CHIP_INATIVO}`}
              >
                {ROTULO_REGRA[r]}
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{resumo.porRegra[r]}</span>
              </button>
            ))}
            {daEmpresa.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma regra apontou algo.</p>}
          </div>
        </div>
        {filtrando && (
          <button type="button" onClick={limpar} className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Limpar filtros
          </button>
        )}
      </div>

      {daEmpresa.length === 0 ? (
        <ExecutiveEmptyState
          icon={ShieldCheck}
          title="Nenhuma exceção encontrada nos dados lidos"
          description="Isso vale só para os cards, etapas e pedidos lidos agora e para as regras desta aba. Não prova que toda a operação está certa."
        />
      ) : visiveis.length === 0 ? (
        <ExecutiveEmptyState
          title="Nenhuma exceção neste filtro"
          description="Há exceções, mas nenhuma combina com os filtros escolhidos."
          actionLabel="Limpar filtros"
          onAction={limpar}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Mostrando {Math.min(limite, visiveis.length)} de {visiveis.length} {visiveis.length === 1 ? 'exceção' : 'exceções'}, das mais graves e antigas para as mais leves.
          </p>
          <ul aria-label="Exceções encontradas" className="space-y-3 p-0">
            {visiveis.slice(0, limite).map(e => (
              <ExcecaoCard
                key={e.id}
                excecao={e}
                agora={dados.agora}
                nomeEmpresa={e.empresa ? nomeDaEmpresa(dados, e.empresa) : undefined}
                abrirCard={abrirCard}
              />
            ))}
          </ul>
          {visiveis.length > limite && (
            <button
              type="button"
              onClick={() => setLimite(n => n + PAGINA)}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
            >
              Ver mais exceções
            </button>
          )}
        </>
      )}

      <details className="rounded-xl border border-border bg-card p-4 text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Como a Supervisão calcula
        </summary>
        <ul className="mt-2 space-y-1.5 p-0 text-muted-foreground">
          {ORDEM_REGRAS.map(r => (
            <li key={r} className="list-none"><strong className="font-medium text-foreground">{ROTULO_REGRA[r]}:</strong> {EXPLICACAO_REGRA[r]}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
