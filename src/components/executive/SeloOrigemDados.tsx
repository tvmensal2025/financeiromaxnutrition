import { Database } from "lucide-react";

type SeloOrigemDadosProps = {
  /** Tabelas (ou fontes) efetivamente lidas por esta tela. */
  fontes: string[];
  /** Recorte aplicado, por exemplo "Grupo consolidado" ou o nome da empresa. */
  escopo?: string;
  /** Quantidade de registros lidos; omitido enquanto a leitura não terminou. */
  registros?: number | null;
  /** Nome do registro no plural, por exemplo "oportunidades". */
  unidade?: string;
  className?: string;
};

/**
 * Selo discreto de procedência: mostra de onde a tela leu os números, o recorte e quantos
 * registros vieram. Não é prova de operação nem de saldo real; só descreve a consulta.
 */
export function SeloOrigemDados({ fontes, escopo, registros, unidade = "registros", className = "" }: SeloOrigemDadosProps) {
  return (
    <p
      role="note"
      aria-label="Origem dos dados"
      title="Os números vêm das tabelas listadas, como retornadas para o seu acesso. Não comprovam saldo real nem operação externa."
      className={`he-origem-dados flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground ${className}`}
    >
      <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 font-medium text-foreground/80">
        <Database aria-hidden="true" className="h-3 w-3" />
        Leitura do Supabase
      </span>
      <span className="min-w-0 break-words">Tabelas: {fontes.join(", ")}</span>
      {escopo ? <span className="min-w-0 break-words">Escopo: {escopo}</span> : null}
      {typeof registros === "number" ? <span className="font-medium text-foreground/80">{registros.toLocaleString("pt-BR")} {unidade}</span> : null}
    </p>
  );
}
