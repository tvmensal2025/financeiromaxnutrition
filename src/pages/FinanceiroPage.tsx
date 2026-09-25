import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { lerCaixa, lerDre, type Lancamento } from "@/lib/caixa";
import { useBusiness } from "@/contexts/BusinessContext";

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

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function num(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function FinanceiroPage() {
  const { selecionadas, todasLigadas, rotulo, nomeDe } = useBusiness();
  const [aba, setAba] = useState<"resumo" | "lancamentos" | "recorrencias">("resumo");
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [fluxos, setFluxos] = useState<Fluxo[]>([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  const filtro = todasLigadas ? undefined : selecionadas;

  useEffect(() => {
    setCarregando(true);
    let qFin = supabase.from("financeiro").select("*").order("vencimento", { ascending: false }).limit(200);
    let qRec = supabase.from("recorrencias").select("*").order("proxima_ocorrencia");
    let qFluxo = supabase.from("fluxo_caixa").select("*").order("periodo_inicio", { ascending: false }).limit(12);
    if (!todasLigadas && selecionadas.length) {
      qFin = qFin.in("business_id", selecionadas);
      qRec = qRec.in("business_id", selecionadas);
      qFluxo = qFluxo.in("business_id", selecionadas);
    }
    Promise.all([qFin, qRec, qFluxo]).then(([fin, rec, flux]) => {
      const falha = fin.error || rec.error || flux.error;
      if (falha && !/permission denied|jwt|unauthorized|not allowed/i.test(falha.message)) {
        setErro(falha.message);
      } else {
        setErro("");
      }
      setLancamentos((fin.data || []) as Lancamento[]);
      setRecorrencias((rec.data || []) as Recorrencia[]);
      setFluxos((flux.data || []) as Fluxo[]);
      setCarregando(false);
    });
  }, [selecionadas.join("|"), todasLigadas]);

  const caixa = useMemo(() => lerCaixa(lancamentos, filtro), [lancamentos, filtro]);
  const dre = useMemo(() => lerDre(lancamentos, filtro), [lancamentos, filtro]);

  const mrr = useMemo(() => {
    return recorrencias.reduce((acc, r) => acc + num(r.equivalente_mensal_brl || r.valor), 0);
  }, [recorrencias]);

  const fluxoRecente = fluxos[0];

  const lancamentosVisiveis = useMemo(() => {
    return lancamentos.filter((l) => !filtro || (l.business_id && filtro.includes(l.business_id)));
  }, [lancamentos, filtro]);

  if (carregando) {
    return <p className="text-sm text-[var(--pe-text-muted)]">Lendo financeiro…</p>;
  }

  return (
    <div className="space-y-6">
      {erro && <p className="pe-card text-sm text-red-700">{erro}</p>}

      <div className="flex flex-wrap gap-2">
        {(["resumo", "lancamentos", "recorrencias"] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={`pe-tab ${aba === id ? "is-active" : ""}`}
            onClick={() => setAba(id)}
          >
            {id === "resumo" ? "Resumo" : id === "lancamentos" ? "Lançamentos" : "Recorrências"}
          </button>
        ))}
        <Link to="/modulo/financeiro" className="pe-tab ml-auto">
          Cadastro completo
        </Link>
      </div>

      {aba === "resumo" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="pe-card-kpi">
            <p className="pe-kpi-label">Caixa realizado</p>
            {caixa.vazio ? (
              <p className="text-sm">Nenhum lançamento liquidado. Isso não é saldo zero.</p>
            ) : (
              <p className="pe-kpi-value">{moeda(caixa.saldo)}</p>
            )}
          </article>
          <article className="pe-card-kpi">
            <p className="pe-kpi-label">DRE (competência)</p>
            {dre.vazio ? (
              <p className="text-sm">Nenhum lançamento com competência na DRE.</p>
            ) : (
              <p className="pe-kpi-value">{moeda(dre.resultado)}</p>
            )}
          </article>
          <article className="pe-card-kpi">
            <p className="pe-kpi-label">Recorrência (equiv. mensal)</p>
            {recorrencias.length === 0 ? (
              <p className="text-sm">Sem recorrências cadastradas neste recorte.</p>
            ) : (
              <p className="pe-kpi-value">{moeda(mrr)}</p>
            )}
          </article>
          <article className="pe-card-kpi">
            <p className="pe-kpi-label">Recorte</p>
            <p className="text-lg font-semibold">{rotulo}</p>
          </article>
        </div>
      )}

      {aba === "resumo" && fluxoRecente && (
        <section className="pe-card">
          <h2 className="text-base font-semibold">Fluxo de caixa (planilha)</h2>
          <p className="mt-1 text-xs text-[var(--pe-text-muted)]">
            Período {fluxoRecente.periodo_inicio || "—"} a {fluxoRecente.periodo_fim || "—"}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <p className="pe-kpi-label">Entradas liquidadas</p>
              <p className="font-semibold">{moeda(num(fluxoRecente.entradas_liquidadas_brl))}</p>
            </div>
            <div>
              <p className="pe-kpi-label">Saídas liquidadas</p>
              <p className="font-semibold">{moeda(num(fluxoRecente.saidas_liquidadas_brl))}</p>
            </div>
            <div>
              <p className="pe-kpi-label">Fluxo líquido</p>
              <p className="font-semibold">{moeda(num(fluxoRecente.fluxo_liquido_brl))}</p>
            </div>
          </div>
        </section>
      )}

      {aba === "lancamentos" && (
        <div className="pe-card overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b text-[var(--pe-text-muted)]">
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Empresa</th>
                <th className="py-2 pr-3">Fluxo</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Valor</th>
                <th className="py-2">Vencimento</th>
              </tr>
            </thead>
            <tbody>
              {lancamentosVisiveis.map((l, i) => {
                const row = l as Lancamento & { finance_id?: string; vencimento?: string };
                return (
                <tr key={i} className="border-b border-[var(--pe-border)]/60">
                  <td className="py-2 pr-3 font-mono">{row.finance_id || "—"}</td>
                  <td className="py-2 pr-3">{nomeDe(row.business_id)}</td>
                  <td className="py-2 pr-3">{row.fluxo}</td>
                  <td className="py-2 pr-3">{row.status}</td>
                  <td className="py-2 pr-3">{row.valor_original}</td>
                  <td className="py-2">{row.vencimento || "—"}</td>
                </tr>
              );})}
              {lancamentosVisiveis.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[var(--pe-text-muted)]">
                    Nenhum lançamento neste recorte.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {aba === "recorrencias" && (
        <div className="grid gap-3 md:grid-cols-2">
          {recorrencias.map((r) => (
            <article key={r.recurrence_id} className="pe-card">
              <p className="pe-kpi-label">{nomeDe(r.business_id)} · {r.recurrence_id}</p>
              <h3 className="mt-1 font-semibold">{r.nome}</h3>
              <p className="mt-2 text-sm">
                {moeda(num(r.equivalente_mensal_brl || r.valor))} · {r.frequencia || "frequência não informada"}
              </p>
              <p className="mt-1 text-xs text-[var(--pe-text-muted)]">
                Próxima: {r.proxima_ocorrencia || "DADO A COLETAR"} · {r.status || "—"}
              </p>
            </article>
          ))}
          {recorrencias.length === 0 && (
            <p className="pe-card text-sm text-[var(--pe-text-muted)]">Nenhuma recorrência neste recorte.</p>
          )}
        </div>
      )}
    </div>
  );
}
