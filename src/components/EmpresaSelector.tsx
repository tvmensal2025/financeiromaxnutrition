import { FormEvent, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Layers } from "lucide-react";
import { useBusiness } from "@/contexts/BusinessContext";

export function EmpresaSelector() {
  const {
    empresas,
    currentBusiness,
    currentBusinessId,
    isConsolidated,
    rotulo,
    carregandoEmpresas,
    setCurrentBusiness,
    ligarTodas,
    incluirEmpresa,
    tirarEmpresa,
  } = useBusiness();

  const [painel, setPainel] = useState(false);
  const [nome, setNome] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const painelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fora(event: MouseEvent) {
      if (painelRef.current && !painelRef.current.contains(event.target as Node)) setPainel(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  async function incluir(event: FormEvent) {
    event.preventDefault();
    setOcupado(true);
    const mensagem = await incluirEmpresa(nome);
    setOcupado(false);
    setAviso(mensagem);
    if (!mensagem) {
      setNome("");
      setPainel(false);
    }
  }

  async function tirar(id: string, nomeEmpresa: string) {
    if (!window.confirm(`Tirar ${nomeEmpresa} do cadastro?`)) return;
    setOcupado(true);
    const mensagem = await tirarEmpresa(id);
    setOcupado(false);
    setAviso(mensagem);
  }

  return (
    <details className="pe-empresa-sidebar" open>
      <summary className="pe-empresa-sidebar-summary">
        <span className="pe-empresa-sidebar-summary-label">Empresa</span>
        <span className="pe-empresa-sidebar-summary-rotulo" title={rotulo}>
          {carregandoEmpresas ? "Carregando…" : rotulo}
        </span>
        <span className="pe-empresa-sidebar-dots" aria-hidden>
          {isConsolidated ? (
            empresas.map((empresa) => (
              <span key={empresa.id} className="pe-empresa-dot" style={{ ["--cor" as string]: empresa.cor }} />
            ))
          ) : (
            <span
              className="pe-empresa-dot"
              style={{ ["--cor" as string]: currentBusiness?.cor || "#007A3D" }}
            />
          )}
        </span>
        <ChevronDown className="pe-empresa-sidebar-chevron h-4 w-4 shrink-0" />
      </summary>

      <div className="pe-empresa-sidebar-body">
        <div className="space-y-1.5">
          {empresas.map((empresa) => {
            const ativa = !isConsolidated && currentBusinessId === empresa.id;
            return (
              <button
                key={empresa.id}
                type="button"
                className={`pe-empresa-sidebar-btn ${ativa ? "is-on" : ""}`}
                style={{ ["--cor" as string]: empresa.cor }}
                aria-pressed={ativa}
                onClick={() => {
                  setAviso("");
                  setCurrentBusiness(empresa.id);
                }}
              >
                <span className="pe-empresa-dot" />
                <span className="min-w-0 flex-1 truncate text-left font-medium">{empresa.nome}</span>
                {ativa && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}

          {/* Opção explícita de Grupo / Visão Consolidada */}
          <button
            type="button"
            className={`pe-empresa-sidebar-btn ${isConsolidated ? "is-on" : ""}`}
            style={{ ["--cor" as string]: "#4F46E5" }}
            aria-pressed={isConsolidated}
            onClick={() => {
              setAviso("");
              ligarTodas();
            }}
          >
            <Layers className="h-3.5 w-3.5 shrink-0 opacity-80" />
            <span className="min-w-0 flex-1 truncate text-left font-medium">Todas as Empresas (Grupo)</span>
            {isConsolidated && <Check className="h-3.5 w-3.5 shrink-0" />}
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-1.5 border-t border-[var(--pe-border)] pt-2">
          <div className="relative min-w-0 flex-1" ref={painelRef}>
            <button
              type="button"
              className="pe-empresa-sidebar-link w-full justify-center"
              onClick={() => setPainel((v) => !v)}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Gerenciar Empresas</span>
            </button>
            {painel && (
              <div className="pe-empresa-painel pe-empresa-painel-sidebar">
                <p className="text-sm font-semibold">Gerenciar Unidades</p>
                <p className="mt-0.5 text-xs text-[var(--pe-text-muted)]">Empresa ativa: {rotulo}</p>
                <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto">
                  {empresas.map((empresa) => (
                    <li key={empresa.id} className="flex items-center justify-between gap-2 py-1">
                      <span className="truncate text-xs font-medium">{empresa.nome} ({empresa.id})</span>
                      <button
                        type="button"
                        className="text-[10px] font-semibold text-red-600 hover:text-red-700"
                        disabled={ocupado}
                        onClick={() => tirar(empresa.id, empresa.nome)}
                      >
                        Excluir
                      </button>
                    </li>
                  ))}
                </ul>
                <form className="mt-2 flex flex-col gap-2" onSubmit={incluir}>
                  <input
                    className="pe-input mt-0 text-xs"
                    placeholder="Nome da nova empresa"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                  <button type="submit" className="pe-button !mt-0 !min-h-[36px] text-sm" disabled={ocupado}>
                    {ocupado ? "Salvando…" : "Cadastrar Empresa"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {aviso && <p className="pt-2 text-[10px] leading-snug text-[var(--pe-text-muted)]">{aviso}</p>}
      </div>
    </details>
  );
}
