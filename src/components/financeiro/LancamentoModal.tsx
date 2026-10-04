import React, { useState, useEffect } from "react";
import { X, DollarSign, Calendar, Building2, Tag, Layers, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { escreverRegistro } from "@/lib/escrita-protegida";
import { useBusiness } from "@/contexts/BusinessContext";

export type LancamentoEditavel = {
  finance_id?: string;
  business_id?: string | null;
  fluxo?: string | null;
  status?: string | null;
  descricao?: string | null;
  contraparte?: string | null;
  valor_original?: number | string | null;
  vencimento?: string | null;
  liquidacao?: string | null;
  competencia?: string | null;
  conta_id?: string | null;
  conta_destino_id?: string | null;
  categoria?: string | null;
  plano_conta_id?: string | null;
  row_version?: number | string;
};

interface LancamentoModalProps {
  aberto: boolean;
  onFechar: () => void;
  onSalvo: () => void;
  lancamentoParaEditar?: LancamentoEditavel | null;
  contasDisponiveis?: Array<{ conta_id: string; nome?: string | null }>;
  planosDisponiveis?: Array<{ plano_conta_id: string; nome_conta?: string | null }>;
}

export function LancamentoModal({
  aberto,
  onFechar,
  onSalvo,
  lancamentoParaEditar,
  contasDisponiveis = [],
  planosDisponiveis = [],
}: LancamentoModalProps) {
  const { currentBusinessId, empresas } = useBusiness();

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const mesAtual = new Date().toISOString().slice(0, 7);
  const hoje = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState<LancamentoEditavel>({
    business_id: currentBusinessId || "BIZ-001",
    fluxo: "SAÍDA",
    status: "PAGO",
    descricao: "",
    contraparte: "",
    valor_original: "",
    vencimento: hoje,
    liquidacao: hoje,
    competencia: mesAtual,
    conta_id: "CONTA-PRINCIPAL",
    categoria: "Despesa Operacional",
    plano_conta_id: "",
  });

  useEffect(() => {
    if (lancamentoParaEditar) {
      setForm({
        ...lancamentoParaEditar,
        business_id: lancamentoParaEditar.business_id || currentBusinessId || "BIZ-001",
        fluxo: lancamentoParaEditar.fluxo || "SAÍDA",
        status: lancamentoParaEditar.status || "PAGO",
        descricao: lancamentoParaEditar.descricao || "",
        contraparte: lancamentoParaEditar.contraparte || "",
        valor_original: lancamentoParaEditar.valor_original ?? "",
        vencimento: lancamentoParaEditar.vencimento || hoje,
        liquidacao: lancamentoParaEditar.liquidacao || "",
        competencia: lancamentoParaEditar.competencia || mesAtual,
        conta_id: lancamentoParaEditar.conta_id || "CONTA-PRINCIPAL",
        categoria: lancamentoParaEditar.categoria || "",
        plano_conta_id: lancamentoParaEditar.plano_conta_id || "",
      });
    } else {
      setForm({
        business_id: currentBusinessId || "BIZ-001",
        fluxo: "SAÍDA",
        status: "PAGO",
        descricao: "",
        contraparte: "",
        valor_original: "",
        vencimento: hoje,
        liquidacao: hoje,
        competencia: mesAtual,
        conta_id: contasDisponiveis[0]?.conta_id || "CONTA-PRINCIPAL",
        categoria: "Despesa Operacional",
        plano_conta_id: planosDisponiveis[0]?.plano_conta_id || "",
      });
    }
    setErro("");
  }, [lancamentoParaEditar, aberto, currentBusinessId]);

  if (!aberto) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    const val = Number(String(form.valor_original).replace(",", "."));
    if (!form.descricao?.trim()) {
      setErro("Informe uma descrição para o lançamento.");
      return;
    }
    if (isNaN(val) || val <= 0) {
      setErro("O valor deve ser um número maior que zero.");
      return;
    }

    setSalvando(true);
    try {
      const payload: Record<string, any> = {
        business_id: form.business_id,
        fluxo: form.fluxo,
        status: form.status,
        descricao: form.descricao.trim(),
        contraparte: form.contraparte?.trim() || null,
        valor_original: val,
        moeda: "BRL",
        vencimento: form.vencimento || null,
        liquidacao:
          form.status === "PAGO" || form.status === "RECEBIDO"
            ? form.liquidacao || form.vencimento || hoje
            : null,
        competencia: form.competencia || mesAtual,
        conta_id: form.conta_id || "CONTA-PRINCIPAL",
        conta_destino_id: form.fluxo === "TRANSFERÊNCIA" ? form.conta_destino_id : null,
        categoria: form.categoria || null,
        plano_conta_id: form.plano_conta_id || null,
      };

      if (lancamentoParaEditar?.finance_id) {
        // Atualização otimista
        const { error: errUpdate } = await escreverRegistro(
          "financeiro",
          lancamentoParaEditar.finance_id,
          lancamentoParaEditar.row_version,
          payload
        );
        if (errUpdate) {
          setErro(errUpdate.message || "Erro ao atualizar lançamento.");
          setSalvando(false);
          return;
        }
      } else {
        // Novo lançamento
        const novoId = `FIN-${Date.now().toString().slice(-8)}`;
        const { error: errInsert } = await supabase.from("financeiro").insert({
          finance_id: novoId,
          ...payload,
        });
        if (errInsert) {
          setErro(errInsert.message || "Erro ao criar lançamento.");
          setSalvando(false);
          return;
        }
      }

      onSalvo();
      onFechar();
    } catch (err: any) {
      setErro(err?.message || "Ocorreu um erro ao salvar o registro financeiro.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-titulo-lancamento"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border/70 bg-card p-6 shadow-2xl space-y-5 animate-in fade-in-50 zoom-in-95 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <DollarSign className="h-4 w-4" />
            </span>
            <div>
              <h2 id="modal-titulo-lancamento" className="text-base font-semibold text-foreground">
                {lancamentoParaEditar ? "Editar Lançamento" : "Novo Lançamento Financeiro"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Preencha os dados do registro contábil e de caixa
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
          {/* Empresa e Fluxo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                <Building2 className="h-3 w-3" /> Empresa
              </label>
              <select
                aria-label="Empresa"
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

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                <Layers className="h-3 w-3" /> Tipo / Fluxo
              </label>
              <select
                aria-label="Tipo ou Fluxo"
                value={form.fluxo || "SAÍDA"}
                onChange={(e) => setForm({ ...form, fluxo: e.target.value })}
                className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              >
                <option value="SAÍDA">Saída (Despesa)</option>
                <option value="ENTRADA">Entrada (Receita)</option>
                <option value="TRANSFERÊNCIA">Transferência</option>
              </select>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label htmlFor="lancamento-descricao" className="text-[11px] font-semibold text-muted-foreground mb-1 block">
              Descrição do Lançamento *
            </label>
            <input
              id="lancamento-descricao"
              type="text"
              required
              placeholder="Ex: Assinatura de Software, Pagamento Fornecedor, Venda Plano"
              value={form.descricao || ""}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Contraparte e Valor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="lancamento-contraparte" className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                Favorecido / Contraparte
              </label>
              <input
                id="lancamento-contraparte"
                type="text"
                placeholder="Ex: Google Cloud, Max Nutrition, Cliente X"
                value={form.contraparte || ""}
                onChange={(e) => setForm({ ...form, contraparte: e.target.value })}
                className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="lancamento-valor" className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                Valor Original (R$) *
              </label>
              <input
                id="lancamento-valor"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0,00"
                value={form.valor_original ?? ""}
                onChange={(e) => setForm({ ...form, valor_original: e.target.value })}
                className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-mono font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Status e Competência */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                Status
              </label>
              <select
                aria-label="Status do Lançamento"
                value={form.status || "PAGO"}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="PAGO">Pago (Liquidado)</option>
                <option value="RECEBIDO">Recebido (Liquidado)</option>
                <option value="ABERTO">Aberto / Pendente</option>
                <option value="PREVISTO">Previsto</option>
                <option value="PARCIAL">Parcial</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                <Calendar className="h-3 w-3" /> Competência (AAAA-MM)
              </label>
              <input
                type="text"
                placeholder="AAAA-MM (ex: 2026-10)"
                pattern="^\d{4}-\d{2}$"
                value={form.competencia || ""}
                onChange={(e) => setForm({ ...form, competencia: e.target.value })}
                className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Vencimento e Liquidação */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                Data de Vencimento
              </label>
              <input
                type="date"
                value={form.vencimento || ""}
                onChange={(e) => setForm({ ...form, vencimento: e.target.value })}
                className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                Data de Liquidação
              </label>
              <input
                type="date"
                value={form.liquidacao || ""}
                onChange={(e) => setForm({ ...form, liquidacao: e.target.value })}
                className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Conta e Categoria */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                Conta de Origem
              </label>
              {contasDisponiveis.length > 0 ? (
                <select
                  aria-label="Conta de Origem"
                  value={form.conta_id || ""}
                  onChange={(e) => setForm({ ...form, conta_id: e.target.value })}
                  className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {contasDisponiveis.map((c) => (
                    <option key={c.conta_id} value={c.conta_id}>
                      {c.nome || c.conta_id}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Ex: Inter, Itaú, Caixa"
                  value={form.conta_id || ""}
                  onChange={(e) => setForm({ ...form, conta_id: e.target.value })}
                  className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              )}
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                <Tag className="h-3 w-3" /> Categoria / Classificação
              </label>
              <input
                type="text"
                placeholder="Ex: Marketing, Infraestrutura, Vendas"
                value={form.categoria || ""}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Se for transferência, conta destino */}
          {form.fluxo === "TRANSFERÊNCIA" && (
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                Conta de Destino *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: CONTA-DESTINO-02"
                value={form.conta_destino_id || ""}
                onChange={(e) => setForm({ ...form, conta_destino_id: e.target.value })}
                className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          {/* Ações */}
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
              <span>{salvando ? "Salvando..." : lancamentoParaEditar ? "Atualizar" : "Salvar Lançamento"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
