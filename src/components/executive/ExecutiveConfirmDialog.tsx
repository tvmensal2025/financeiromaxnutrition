import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ExecutiveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  isDestructive?: boolean;
}

export function ExecutiveConfirmDialog({
  open,
  onOpenChange,
  title = "Excluir registro?",
  description = "Esta ação removerá o registro do sistema. Deseja prosseguir?",
  confirmLabel = "Excluir",
  cancelLabel = "Cancelar",
  onConfirm,
  isDestructive = true,
}: ExecutiveConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md bg-card border-border rounded-xl p-6">
        <AlertDialogHeader className="text-left space-y-2">
          <AlertDialogTitle className="text-base font-semibold text-foreground">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-5 flex items-center justify-end gap-2">
          <AlertDialogCancel className="rounded-md border border-border text-xs font-medium px-4 py-2 hover:bg-muted transition-colors">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={`rounded-md text-xs font-semibold px-4 py-2 text-white transition-colors ${
              isDestructive
                ? "bg-[#B91C1C] hover:bg-[#991B1B]"
                : "bg-[#007A3D] hover:bg-[#006030]"
            }`}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
