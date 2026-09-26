import React, { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";

type FormularioNovaSenhaProps = {
  onSubmit: (senha: string, confirmacao: string) => Promise<void> | void;
  enviando: boolean;
  botaoLabel?: string;
  disabled?: boolean;
};

export function FormularioNovaSenha({
  onSubmit,
  enviando,
  botaoLabel = "Salvar nova senha",
  disabled = false,
}: FormularioNovaSenhaProps) {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(senha, confirmacao);
  }

  const bloqueado = enviando || disabled;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label
          htmlFor="nova-senha"
          className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Nova senha
        </label>
        <input
          id="nova-senha"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Mínimo de 8 caracteres"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          disabled={bloqueado}
          className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-[#007A3D] focus:outline-none focus:ring-1 focus:ring-[#007A3D]"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="confirmar-senha"
          className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Confirmar nova senha
        </label>
        <input
          id="confirmar-senha"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Repita a nova senha"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          disabled={bloqueado}
          className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-[#007A3D] focus:outline-none focus:ring-1 focus:ring-[#007A3D]"
        />
      </div>

      <button
        type="submit"
        disabled={bloqueado}
        className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#007A3D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#006030] focus:outline-none focus:ring-2 focus:ring-[#007A3D] focus:ring-offset-2 disabled:opacity-60 cursor-pointer"
      >
        {enviando ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Salvando…</span>
          </>
        ) : (
          <span>{botaoLabel}</span>
        )}
      </button>
    </form>
  );
}
