import { useLocation } from "react-router-dom";
import { useBusiness } from "@/contexts/BusinessContext";
import { MODULOS } from "@/lib/modulos";

const ROTAS: Record<string, { titulo: string; detalhe: string }> = {
  "/": { titulo: "Painel executivo", detalhe: "Foco, empresas e números reais do ecossistema." },
  "/crm": { titulo: "CRM e pipeline", detalhe: "Negociação aberta, datas e ganho viram cliente." },
  "/financeiro": { titulo: "Financeiro", detalhe: "Caixa, DRE, lançamentos e recorrência por empresa." },
  "/calendario": { titulo: "Calendário", detalhe: "Compromissos, follow-ups do CRM e agenda do fundador." },
};

export function PageHero() {
  const { pathname } = useLocation();
  const { rotulo } = useBusiness();
  const modulo = pathname.startsWith("/modulo/") ? MODULOS.find((m) => pathname === `/modulo/${m.tabela}`) : undefined;
  const info =
    ROTAS[pathname] ||
    (modulo ? { titulo: modulo.titulo, detalhe: `Tabela ${modulo.tabela} · cadastro oficial.` } : { titulo: "Módulo", detalhe: "Cadastro e operação do Sistema Helena." });

  return (
    <section className="pe-hero">
      <div className="pe-hero-glow" aria-hidden />
      <div className="pe-hero-inner">
        <div>
          <p className="pe-hero-kicker">Sistema Helena · {rotulo}</p>
          <h1 className="pe-hero-title">{info.titulo}</h1>
          <p className="pe-hero-sub">{info.detalhe}</p>
        </div>
        <p className="pe-hero-note">
          A Helena conversa no ChatGPT oficial. Aqui você vê e opera os dados confirmados.
        </p>
      </div>
    </section>
  );
}
