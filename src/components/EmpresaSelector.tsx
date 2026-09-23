import { FormEvent, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { useBusiness } from "@/contexts/BusinessContext";

export function EmpresaSelector() {
  const {
    empresas,
    selecionadas,
    todasLigadas,
    rotulo,
    carregandoEmpresas,
    alternar,
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

  const ativas = empresas.filter((empresa) => selecionadas.includes(empresa.id));

  return (
    <details className="pe-empresa-sidebar">
      <summary className="pe-empresa-sidebar-summary">
        <span className="pe-empresa-sidebar-summary-label">Empresas</span>
        <span className="pe-empresa-sidebar-summary-rotulo" title={rotulo}>
          {carregandoEmpresas ? "Lendo…" : rotulo}
        </span>
        <span className="pe-empresa-sidebar-dots" aria-hidden>
          {ativas.map((empresa) => (
            <span key={empresa.id} className="pe-empresa-dot" style={{ ["--cor" as string]: empresa.cor }} />
          ))}
        </span>
        <ChevronDown className="pe-empresa-sidebar-chevron h-4 w-4 shrink-0" />
      </summary>

      <div className="pe-empresa-sidebar-body">
        <div className="space-y-1.5">
          {empresas.map((empresa) => {
            const ligada = selecionadas.includes(empresa.id);
            return (
              <button
                key={empresa.id}
                type="button"
                className={`pe-empresa-sidebar-btn ${ligada ? "is-on" : ""}`}
                style={{ ["--cor" as string]: empresa.cor }}
                aria-pressed={ligada}
                onClick={() => {
                  if (ligada && selecionadas.length === 1) {
                    setAviso("Deixe ao menos uma empresa ligada.");
                    return;
                  }
                  setAviso("");
                  alternar(empresa.id);
                }}
              >
                <span className="pe-empresa-dot" />
                <span className="min-w-0 flex-1 truncate text-left">{empresa.nome}</span>
                {ligada && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {!todasLigadas && empresas.length > 1 && (
            <button type="button" className="pe-empresa-sidebar-link" onClick={() => { setAviso(""); ligarTodas(); }}>
              Todas
            </button>
          )}
          <div className="relative min-w-0 flex-1" ref={painelRef}>
            <button type="button" className="pe-empresa-sidebar-link w-full" onClick={() => setPainel((v) => !v)}>
              <Plus className="h-3.5 w-3.5" />
              Empresa
            </button>
            {painel && (
              <div className="pe-empresa-painel pe-empresa-painel-sidebar">
                <p className="text-sm font-semibold">Cadastro</p>
                <p className="mt-1 text-xs text-[var(--pe-text-muted)]">Visão: {rotulo}</p>
                <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto">
                  {empresas.map((empresa) => (
                    <li key={empresa.id} className="flex items-center justify-between gap-2 py-1">
                      <span className="truncate text-xs">{empresa.nome}</span>
                      <button
                        type="button"
                        className="text-[10px] font-semibold text-red-700"
                        disabled={ocupado}
                        onClick={() => tirar(empresa.id, empresa.nome)}
                      >
                        Tirar
                      </button>
                    </li>
                  ))}
                </ul>
                <form className="mt-2 flex flex-col gap-2" onSubmit={incluir}>
                  <input
                    className="pe-input mt-0 text-xs"
                    placeholder="Nova empresa"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                  <button type="submit" className="pe-button !mt-0 !min-h-[36px] text-sm" disabled={ocupado}>
                    Incluir
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
