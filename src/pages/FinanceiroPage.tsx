import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  CalendarClock,
  Clock,
  Layers,
  TableProperties,
} from "lucide-react";
import { lerPaginas } from "@/lib/leitura-paginada";
import { supabase } from "@/lib/supabase";
import { lerCaixa, lerDre, type Lancamento } from "@/lib/caixa";
import { useBusiness } from "@/contexts/BusinessContext";
import { ExecutivePageHeader } from "@/components/executive/ExecutivePageHeader";
import { ExecutiveMetricCard } from "@/components/executive/ExecutiveMetricCard";
import { ExecutiveBadge } from "@/components/executive/ExecutiveBadge";
import { ExecutiveLoadingState } from "@/components/executive/ExecutiveLoadingState";
import { ExecutiveErrorState } from "@/components/executive/ExecutiveErrorState";
import { ExecutiveEmptyState } from "@/components/executive/ExecutiveEmptyState";

type Recorrencia = {
  recurrence_id: string;
  business_id: string;
  nome: string;
  valor?: string | number | null;
  equivalente_mensal_brl?: string | number | null;
  frequencia?: string | null;
  proxima_ocorrencia?: string | null;
  status?: string | null;
};

type Fluxo = {
  periodo_inicio?: string | null;
  periodo_fim?: string | null;
  entradas_liquidadas_brl?: string | number | null;
  saidas_liquidadas_brl?: string | number | null;
  fluxo_liquido_brl?: string | number | null;
  a_receber_aberto_brl?: string | number | null;
  a_pagar_aberto_brl?: string | number | null;
};

type PlanoConta = {
  plano_conta_id: string;
  codigo?: string | null;
  nome_conta?: string | null;
  tipo?: string | null;
  categoria_macro?: string | null;
  descricao?: string | null;
};

type LancamentoCompleto = Lancamento & {
  finance_id?: string;
  descricao?: string | null;
  contraparte?: string | null;
  vencimento?: string | null;
  valor_brl?: number | string | null;
  categoria?: string | null;
  plano_conta_id?: string | null;
};

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

type TabFinanceiro =
  | "visao_geral"
  | "lancamentos"
  | "fluxo_caixa"
  | "dre"
  | "orcamento"
  | "recorrencias"
  | "plano_contas";

const TABS: { id: TabFinanceiro; label: string }[] = [
  { id: "visao_geral", label: "Visão Geral" },
  { id: "lancamentos", label: "Lançamentos" },
  { id: "fluxo_caixa", label: "Fluxo de Caixa" },
  { id: "dre", label: "DRE" },
  { id: "orcamento", label: "Orçamento" },
  { id: "recorrencias", label: "Recorrências" },
  { id: "plano_contas", label: "Plano de Contas" },
];

export default function FinanceiroPage() {
  const { currentBusinessId, isConsolidated, selecionadas, todasLigadas, nomeDe } = useBusiness();
  const [aba, setAba] = useState<TabFinanceiro>("visao_geral");
  const [lancamentos, setLancamentos] = useState<LancamentoCompleto[]>([]);
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [fluxos, setFluxos] = useState<Fluxo[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  const readVersion = useRef(0);
  const leitura = useRef<AbortController | null>(null);
  const filtro = todasLigadas ? undefined : selecionadas;

  async function carregarDados() {
    const version = ++readVersion.current;
    leitura.current?.abort();
    const controller = new AbortController(); leitura.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 25000);
    setCarregando(true); setErro("");
    setLancamentos([]); setRecorrencias([]); setFluxos([]); setPlanoContas([]);
    const read = (table: string, order: string, scoped = true) => lerPaginas<Record<string, any>>((start, end) => {
      let query = supabase.from(table).select("*", { count: "exact" }).order(order).range(start, end).abortSignal(controller.signal);
      if (scoped) {
        if (!isConsolidated && currentBusinessId) query = query.eq("business_id", currentBusinessId);
        else query = query.in("business_id", selecionadas.length ? selecionadas : ['__NONE__']);
      }
      return query;
    }, controller.signal);
    try {
      const [fin, rec, flux, plano] = await Promise.all([
        read('financeiro', 'finance_id'), read('recorrencias', 'recurrence_id'),
        read('fluxo_caixa', 'periodo_inicio'), read('plano_contas', 'plano_conta_id', false),
      ]);
      if (version !== readVersion.current) return;
      if (fin.error || rec.error || flux.error || plano.error) throw new Error('Não foi possível consultar todos os dados financeiros. Tente atualizar novamente.');
      setLancamentos((fin.data || []).sort((a,b) => String(b.vencimento || "").localeCompare(String(a.vencimento || ""))) as LancamentoCompleto[]);
      setRecorrencias((rec.data || []) as Recorrencia[]);
      setFluxos((flux.data || []).sort((a,b) => String(b.periodo_inicio).localeCompare(String(a.periodo_inicio))) as Fluxo[]);
      setPlanoContas((plano.data || []) as PlanoConta[]);
    } catch {
      if (version === readVersion.current) setErro("Não foi possível consultar todos os dados financeiros. Tente atualizar novamente.");
    } finally {
      window.clearTimeout(timeout);
      if (version === readVersion.current) setCarregando(false);
    }
  }

  useEffect(() => {
    void carregarDados();
    return () => { readVersion.current++; leitura.current?.abort(); };
  }, [currentBusinessId, isConsolidated, selecionadas.join('|')]);

  const caixa = useMemo(() => lerCaixa(lancamentos, filtro), [lancamentos, filtro]);
  const dre = useMemo(() => lerDre(lancamentos, filtro), [lancamentos, filtro]);

  // Cálculos do Cockpit Financeiro
  const cockpit = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    let aReceber = 0;
    let aPagar = 0;
    let temLiquidados = false;

    for (const l of lancamentos) {
      if (!todasLigadas && l.business_id && !selecionadas.includes(l.business_id)) continue;
      const st = (l.status || "").toUpperCase();
      const fl = (l.fluxo || "").toUpperCase();
      const val = num(l.valor_brl || l.valor_original);

      if (st === "RECEBIDO" || st === "PAGO" || st === "LIQUIDADO") {
        temLiquidados = true;
        if (fl.startsWith("ENTRADA") || fl.includes("RECEITA")) {
          entradas += val;
        } else if (fl.startsWith("SAIDA") || fl.includes("DESPESA")) {
          saidas += val;
        }
      } else if (st === "ABERTO" || st === "PENDENTE" || st === "PREVISTO") {
        if (fl.startsWith("ENTRADA") || fl.includes("RECEITA")) {
          aReceber += val;
        } else if (fl.startsWith("SAIDA") || fl.includes("DESPESA")) {
          aPagar += val;
        }
      }
    }

    return {
      temLiquidados,
      caixaRealizado: caixa.vazio ? null : caixa.saldo,
      entradas: temLiquidados ? entradas : null,
      saidas: temLiquidados ? saidas : null,
      resultado: dre.vazio ? null : dre.resultado,
      aReceber: aReceber > 0 ? aReceber : null,
      aPagar: aPagar > 0 ? aPagar : null,
    };
  }, [lancamentos, caixa, dre, todasLigadas, selecionadas]);

  const lancamentosVisiveis = useMemo(() => {
    return lancamentos.filter((l) => !filtro || (l.business_id && filtro.includes(l.business_id)));
  }, [lancamentos, filtro]);

  return (
    <div className="he-finance-page space-y-6">
      <ExecutivePageHeader
        icon={Wallet}
        title="Financeiro"
        description="Cockpit de caixa, competência, fluxo e plano de contas"
        actions={
          <button
            type="button"
            onClick={() => setAba("lancamentos")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/70 transition-colors"
          >
            <TableProperties className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Ver lançamentos</span>
          </button>
        }
      />

      {/* Tabs Oficiais */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border/50">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setAba(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              aba === t.id
                ? "bg-foreground text-background font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {erro && (
        <ExecutiveErrorState
          title="Erro ao carregar registros financeiros"
          message={erro}
          onRetry={carregarDados}
        />
      )}

      {carregando ? (
        <ExecutiveLoadingState message="Consultando lançamentos e demonstrativos..." />
      ) : erro ? null : (
        <>
          {/* TAB 1: VISÃO GERAL */}
          {aba === "visao_geral" && (
            <div className="space-y-6">
              <div className="he-finance-metrics grid grid-cols-2 lg:grid-cols-3 gap-4">
                <ExecutiveMetricCard
                  label="Caixa realizado"
                  value={cockpit.caixaRealizado !== null ? moeda(cockpit.caixaRealizado) : null}
                  subtext={cockpit.caixaRealizado !== null ? "Lançamentos liquidados" : "Sem lançamentos liquidados"}
                  icon={Wallet}
                />
                <ExecutiveMetricCard
                  label="Entradas"
                  value={cockpit.entradas !== null ? moeda(cockpit.entradas) : null}
                  subtext={cockpit.entradas !== null ? "Liquidadas no período" : "Sem dados realizados"}
                  icon={ArrowDownLeft}
                />
                <ExecutiveMetricCard
                  label="Saídas"
                  value={cockpit.saidas !== null ? moeda(cockpit.saidas) : null}
                  subtext={cockpit.saidas !== null ? "Liquidadas no período" : "Sem dados realizados"}
                  icon={ArrowUpRight}
                />
                <ExecutiveMetricCard
                  label="Resultado"
                  value={cockpit.resultado !== null ? moeda(cockpit.resultado) : null}
                  subtext={cockpit.resultado !== null ? "DRE de competência" : "Sem competência na DRE"}
                  icon={Scale}
                />
                <ExecutiveMetricCard
                  label="A receber"
                  value={cockpit.aReceber !== null ? moeda(cockpit.aReceber) : null}
                  subtext={cockpit.aReceber !== null ? "Previsão aberta" : "Sem valores em aberto"}
                  icon={CalendarClock}
                />
                <ExecutiveMetricCard
                  label="A pagar"
                  value={cockpit.aPagar !== null ? moeda(cockpit.aPagar) : null}
                  subtext={cockpit.aPagar !== null ? "Obrigações abertas" : "Sem valores em aberto"}
                  icon={Clock}
                />
              </div>

              {!erro && !lancamentosVisiveis.length && !fluxos.length && <section className="he-finance-start"><div><span className="hc-eyebrow">BASE FINANCEIRA</span><h2>Uma visão de caixa começa<br/>com registros confiáveis.</h2><p>Sem lançamentos visíveis neste recorte. Consulte as previsões, as obrigações recorrentes e a estrutura de contas para organizar a leitura financeira.</p></div><div><button onClick={() => setAba("recorrencias")}>Consultar recorrências <CalendarClock size={18}/></button><button onClick={() => setAba("orcamento")}>Ver orçamento <ArrowUpRight size={18}/></button><button onClick={() => setAba("plano_contas")}>Consultar plano de contas <TableProperties size={18}/></button></div></section>}
              {/* Fluxo de Caixa Recente (se houver dados) */}
              {fluxos.length > 0 && (
                <div className="rounded-xl border border-border/70 bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Fluxo de Caixa Consolidado</h3>
                      <p className="text-xs text-muted-foreground">
                        Período: {fluxos[0].periodo_inicio || "—"} até {fluxos[0].periodo_fim || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                      <span className="text-xs text-muted-foreground">Entradas Liquidadas:</span>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        {moeda(num(fluxos[0].entradas_liquidadas_brl))}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                      <span className="text-xs text-muted-foreground">Saídas Liquidadas:</span>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        {moeda(num(fluxos[0].saidas_liquidadas_brl))}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                      <span className="text-xs text-muted-foreground">Fluxo Líquido:</span>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        {moeda(num(fluxos[0].fluxo_liquido_brl))}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LANÇAMENTOS */}
          {aba === "lancamentos" && (
            <div className="space-y-4">
              {lancamentosVisiveis.length === 0 ? (
                <ExecutiveEmptyState
                  icon={Wallet}
                  title="Nenhum lançamento realizado"
                  description="Ainda não existem lançamentos financeiros registrados para o recorte atual."
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground text-[11px] font-medium">
                      <tr>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Descrição</th>
                        <th className="px-4 py-3">Conta</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Competência</th>
                        <th className="px-4 py-3">Vencimento</th>
                        <th className="px-4 py-3">Liquidação</th>
                        <th className="px-4 py-3 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {lancamentosVisiveis.map((l, idx) => {
                        const isEntrada = (l.fluxo || "").toUpperCase().startsWith("ENTRADA");
                        const val = num(l.valor_brl || l.valor_original);

                        return (
                          <tr key={l.finance_id || idx} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                              {l.vencimento || l.liquidacao || "—"}
                            </td>
                            <td className="px-4 py-3 font-medium text-foreground max-w-[220px] truncate">
                              {l.descricao || l.contraparte || "Lançamento financeiro"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {l.conta_id || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-muted-foreground">
                                {l.fluxo || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <ExecutiveBadge
                                variant={
                                  l.status?.toLowerCase().includes("pago") || l.status?.toLowerCase().includes("receb")
                                    ? "success"
                                    : l.status?.toLowerCase().includes("pend") || l.status?.toLowerCase().includes("abert")
                                    ? "warning"
                                    : "neutral"
                                }
                              >
                                {l.status || "—"}
                              </ExecutiveBadge>
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                              {l.competencia || "—"}
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                              {l.vencimento || "—"}
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                              {l.liquidacao || "—"}
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-medium font-mono ${
                                isEntrada ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
                              }`}
                            >
                              {moeda(val)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FLUXO DE CAIXA */}
          {aba === "fluxo_caixa" && (
            <div className="space-y-4">
              {fluxos.length === 0 ? (
                <ExecutiveEmptyState
                  icon={Wallet}
                  title="Nenhum registro de fluxo de caixa"
                  description="Ainda não há consolidação de fluxo de caixa para a empresa selecionada."
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground text-[11px] font-medium">
                      <tr>
                        <th className="px-4 py-3">Período Início</th>
                        <th className="px-4 py-3">Período Fim</th>
                        <th className="px-4 py-3 text-right">Entradas</th>
                        <th className="px-4 py-3 text-right">Saídas</th>
                        <th className="px-4 py-3 text-right">Fluxo Líquido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {fluxos.map((f, i) => (
                        <tr key={i} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono">{f.periodo_inicio || "—"}</td>
                          <td className="px-4 py-3 font-mono">{f.periodo_fim || "—"}</td>
                          <td className="px-4 py-3 text-right font-mono">{moeda(num(f.entradas_liquidadas_brl))}</td>
                          <td className="px-4 py-3 text-right font-mono">{moeda(num(f.saidas_liquidadas_brl))}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">{moeda(num(f.fluxo_liquido_brl))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DRE */}
          {aba === "dre" && (
            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Demonstração do Resultado (Competência)</h3>
              {dre.vazio ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum lançamento com competência registrada para apuração de DRE.
                </p>
              ) : (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-2 border-b border-border/40">
                    <span className="text-muted-foreground">Resultado Líquido do Período:</span>
                    <span className="font-mono font-semibold text-foreground">{moeda(dre.resultado)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ORÇAMENTO */}
          {aba === "orcamento" && (
            <ExecutiveEmptyState
              icon={Scale}
              title="Orçamento não configurado"
              description="As metas de despesas e receitas por centro de custo estão em fase de homologação."
            />
          )}

          {/* TAB 6: RECORRÊNCIAS */}
          {aba === "recorrencias" && (
            <div className="space-y-4">
              {recorrencias.length === 0 ? (
                <ExecutiveEmptyState
                  icon={CalendarClock}
                  title="Nenhuma recorrência ativa"
                  description="Não há assinaturas, contratos ou despesas recorrentes registradas."
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground text-[11px] font-medium">
                      <tr>
                        <th className="px-4 py-3">Nome</th>
                        <th className="px-4 py-3">Frequência</th>
                        <th className="px-4 py-3">Próxima Ocorrência</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Equivalente Mensal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {recorrencias.map((r) => (
                        <tr key={r.recurrence_id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">{r.nome}</td>
                          <td className="px-4 py-3 text-muted-foreground">{r.frequencia || "Mensal"}</td>
                          <td className="px-4 py-3 font-mono">{r.proxima_ocorrencia || "—"}</td>
                          <td className="px-4 py-3">
                            <ExecutiveBadge variant="neutral">{r.status || "Ativo"}</ExecutiveBadge>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium">
                            {moeda(num(r.equivalente_mensal_brl || r.valor))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: PLANO DE CONTAS */}
          {aba === "plano_contas" && (
            <div className="space-y-4">
              {planoContas.length === 0 ? (
                <ExecutiveEmptyState
                  icon={Layers}
                  title="Plano de contas vazio"
                  description="Nenhuma categoria contábil encontrada."
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground text-[11px] font-medium">
                      <tr>
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">Código</th>
                        <th className="px-4 py-3">Nome da Conta</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Categoria Macro</th>
                        <th className="px-4 py-3">Descrição</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {planoContas.map((p) => (
                        <tr key={p.plano_conta_id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{p.plano_conta_id}</td>
                          <td className="px-4 py-3 font-mono">{p.codigo || "—"}</td>
                          <td className="px-4 py-3 font-medium text-foreground">{p.nome_conta || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{p.tipo || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{p.categoria_macro || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{p.descricao || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
