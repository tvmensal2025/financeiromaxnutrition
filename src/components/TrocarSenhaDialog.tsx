import React, { useState } from "react";
import { KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormularioNovaSenha } from "@/components/FormularioNovaSenha";
import { supabase } from "@/lib/supabase";
import { atualizarSenhaUsuario } from "@/lib/auth-senha";

type TrocarSenhaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TrocarSenhaDialog({ open, onOpenChange }: TrocarSenhaDialogProps) {
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function onSalvar(senha: string, confirmacao: string) {
    setEnviando(true);
    setErro("");
    setSucesso("");
    const resultado = await atualizarSenhaUsuario(supabase.auth, senha, confirmacao);
    if (!resultado.ok) {
      setErro(resultado.mensagem);
      setEnviando(false);
      return;
    }
    setSucesso("Senha atualizada com sucesso.");
    setEnviando(false);
    window.setTimeout(() => {
      onOpenChange(false);
      setSucesso("");
    }, 900);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(proximo) => {
        if (!proximo) {
          setErro("");
          setSucesso("");
        }
        onOpenChange(proximo);
      }}
    >
      <DialogContent className="max-w-[400px] rounded-2xl border-border bg-card p-6 sm:p-7">
        <DialogHeader className="space-y-2 text-left">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#007A3D] text-white">
            <KeyRound className="h-4 w-4" />
          </div>
          <DialogTitle className="text-lg font-semibold tracking-tight">
            Trocar senha
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Defina uma nova senha de acesso à Central Executiva.
          </DialogDescription>
        </DialogHeader>

        {erro && (
          <p className="text-xs text-[#B91C1C] dark:text-[#f87171]" role="alert">
            {erro}
          </p>
        )}
        {sucesso && (
          <p className="text-xs text-[#007A3D] dark:text-[#4ade80]" role="status">
            {sucesso}
          </p>
        )}

        <FormularioNovaSenha
          onSubmit={onSalvar}
          enviando={enviando}
          botaoLabel="Atualizar senha"
        />
      </DialogContent>
    </Dialog>
  );
}
