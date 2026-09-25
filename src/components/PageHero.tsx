import { useLocation } from "react-router-dom";
import { useBusiness } from "@/contexts/BusinessContext";
import { MODULOS } from "@/lib/modulos";
import { Building2, ShieldCheck, Zap, Activity, Bot, Layers } from "lucide-react";

const ROTAS: Record<string, { titulo: string; detalhe: string }> = {
  "/": { titulo: "Painel executivo", detalhe: "Foco, empresas e números reais do ecossistema." },
  "/crm": { titulo: "CRM e pipeline", detalhe: "Negociação aberta, datas e ganho viram cliente." },
  "/financeiro": { titulo: "Financeiro", detalhe: "Caixa, DRE, lançamentos e recorrência por empresa." },
  "/calendario": { titulo: "Calendário", detalhe: "Compromissos, follow-ups do CRM e agenda do fundador." },
};

export function PageHero() {
  const { pathname } = useLocation();
  const { currentBusiness, currentBusinessId, isConsolidated, rotulo } = useBusiness();
  const modulo = pathname.startsWith("/modulo/") ? MODULOS.find((m) => pathname === `/modulo/${m.tabela}`) : undefined;
  const info =
    ROTAS[pathname] ||
    (modulo ? { titulo: modulo.titulo, detalhe: `Tabela ${modulo.tabela} · cadastro oficial.` } : { titulo: "Módulo", detalhe: "Cadastro e operação do Sistema Helena." });

  return (
    <section className="pe-hero">
      <div className="pe-hero-glow" aria-hidden />
      <div className="pe-hero-inner">
        <div>
          <div className="flex flex-wrap items-center gap-2 pb-1.5">
            <span className="pe-hero-kicker !pb-0">Sistema Helena</span>
            <span className="text-muted-foreground/60">·</span>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2.5 py-0.5 text-xs font-semibold text-foreground backdrop-blur-sm">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: currentBusiness?.cor || "#007A3D" }}
              />
              <span>{rotulo}</span>
              {currentBusiness?.estagio && !isConsolidated && (
                <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-black uppercase text-primary">
                  {currentBusiness.estagio}
                </span>
              )}
            </div>
          </div>
          <h1 className="pe-hero-title">{info.titulo}</h1>
          <p className="pe-hero-sub">{info.detalhe}</p>
        </div>
        <p className="pe-hero-note">
          A Helena conversa no ChatGPT oficial. Aqui você visualiza e opera os dados em tempo real com isolamento multiempresa.
        </p>
      </div>
    </section>
  );
}
