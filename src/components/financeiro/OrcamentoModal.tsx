import React, { useState } from "react";
import { X, Target, Calendar, Building2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useBusiness } from "@/contexts/BusinessContext";

interface OrcamentoModalProps {
  aberto: boolean;
  onFechar: () => void;
  onSalvo: () => void;
  planosDisponiveis?: Array<{ plano_conta_id: string; nome_conta?: string | null }>;
}

export function OrcamentoModal({
  aberto,
  onFechar,
  onSalvo,
  planosDisponiveis = [],
}: OrcamentoModalProps) {
  const { currentBusinessId, empresas } = useBusiness();

  const mesAtual = new Date().toISOString().slice(0, 7);
  const primeiroDia = `${mesAtual}-01`;
  const ultimoDia = `${mesAtual}-28`;

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const [form, setForm] = useState({
    business_id: currentBusinessId || "BIZ-001",
    periodo_inicio: primeiroDia,
    periodo_fim: ultimoDia,
    plano_conta_id: planosDisponiveis[0]?.plano_conta_id || "GERAL",
    valor_orcado_brl: "",
    responsavel: "AGT-05 Caio",
    observacoes: "",
    status: "PLANEJADO",
  });

  if (!aberto) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    const val = Number(String(form.valor_orcado_brl).replace(",", "."));
    if (isNaN(val) || val <= 0) {
      setErro("Informe um valor orçado maior que zero.");
      return;
    }

    setSalvando(true);
    try {
      const budgetId = `BDG-${Date.now().toString().slice(-8)}`;
      const payload = {
        budget_id: budgetId,
        business_id: form.business_id,
        periodo_inicio: form.periodo_inicio,
        periodo_fim: form.periodo_fim,
        plano_conta_id: form.plano_conta_id || "GERAL",
        valor_orcado_brl: val,
        valor_realizado_brl: 0,
        responsavel: form.responsavel || "Caio (CFO)",
        observacoes: form.observacoes?.trim() || null,
        status: form.status || "PLANEJADO",
      };

      const { error: errInsert } = await supabase.from("orcamento").insert(payload);
      if (errInsert) {
        setErro(errInsert.message || "Erro ao registrar orçamento.");
        setSalvando(false);
        return;
      }

      onSalvo();
      onFechar();
    } catch (err: any) {
      setErro(err?.message || "Erro ao salvar orçamento.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-titulo-orcamento"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-6 shadow-2xl space-y-5 animate-in fade-in-50 zoom-in-95">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Target className="h-4 w-4" />
            </span>
            <div>
              <h2 id="modal-titulo-orcamento" className="text-base font-semibold text-foreground">
                Nova Meta Orçamentária
              </h2>
              <p className="text-xs text-muted-foreground">
                Defina o teto de gastos ou meta por centro de custo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Fechar modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {erro && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
              <Building2 className="h-3 w-3" /> Empresa
            </label>
            <select
              aria-label="Empresa do Orçamento"
              value={form.business_id || ""}
              onChange={(e) => setForm({ ...form, business_id: e.target.value })}
              className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.business_id}>
                  {emp.nome} ({emp.sigla})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                <Calendar className="h-3 w-3" /> Início do Período
              </label>
              <input
                type="date"
                required
                value={form.periodo_inicio}
                onChange={(e) => setForm({ ...form, periodo_inicio: e.target.value })}
                className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                <Calendar className="h-3 w-3" /> Fim do Período
              </label>
              <input
                type="date"
                required
                value={form.periodo_fim}
                onChange={(e) => setForm({ ...form, periodo_fim: e.target.value })}
                className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                Centro de Custo / Conta
              </label>
              {planosDisponiveis.length > 0 ? (
                <select
                  aria-label="Conta ou Categoria"
                  value={form.plano_conta_id}
                  onChange={(e) => setForm({ ...form, plano_conta_id: e.target.value })}
                  className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {planosDisponiveis.map((p) => (
                    <option key={p.plano_conta_id} value={p.plano_conta_id}>
                      {p.nome_conta || p.plano_conta_id}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Ex: Marketing, Infra"
                  value={form.plano_conta_id}
                  onChange={(e) => setForm({ ...form, plano_conta_id: e.target.value })}
                  className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              )}
            </div>

            <div>
              <label htmlFor="orcamento-valor" className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                Valor Orçado (R$) *
              </label>
              <input
                id="orcamento-valor"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0,00"
                value={form.valor_orcado_brl}
                onChange={(e) => setForm({ ...form, valor_orcado_brl: e.target.value })}
                className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-mono font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label htmlFor="orcamento-responsavel" className="text-[11px] font-semibold text-muted-foreground mb-1 block">
              Responsável / Dono
            </label>
            <input
              id="orcamento-responsavel"
              type="text"
              placeholder="Ex: AGT-05 Caio, Fundador"
              value={form.responsavel}
              onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
              className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
              Observações / Justificativa
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Limite aprovado para tráfego e ferramentas de CRM"
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/50">
            <button
              type="button"
              onClick={onFechar}
              disabled={salvando}
              className="rounded-xl border border-border/70 bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted/70 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex items-center gap-1.5 rounded-xl bg-foreground text-background px-5 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{salvando ? "Registrando..." : "Salvar Orçamento"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
