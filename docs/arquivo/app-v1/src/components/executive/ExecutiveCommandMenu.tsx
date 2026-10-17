import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useBusiness } from "@/contexts/BusinessContext";
import { MODULOS } from "@/lib/modulos";
import {
  LayoutDashboard,
  Target,
  Receipt,
  CalendarClock,
  Building2,
  Users,
  Inbox,
  Shield,
  Layers,
  Activity,
  Search,
  Zap,
  MessageSquare,
} from "lucide-react";

interface ExecutiveCommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExecutiveCommandMenu({ open, onOpenChange }: ExecutiveCommandMenuProps) {
  const navigate = useNavigate();
  const { empresas, setCurrentBusiness, ligarTodas } = useBusiness();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const runCommand = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Digite um comando, módulo, agente ou empresa…" />
      <CommandList className="max-h-[360px] py-2">
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {/* NAVEGAÇÃO PRINCIPAL */}
        <CommandGroup heading="Central Executiva">
          <CommandItem
            onSelect={() => runCommand(() => navigate("/"))}
            className="flex items-center gap-2.5 px-3 py-2 text-xs"
          >
            <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
            <span>Sala de comando</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate("/conversa"))}
            className="flex items-center gap-2.5 px-3 py-2 text-xs"
          >
            <MessageSquare className="h-4 w-4 text-[#007A3D]" />
            <span>Conversa com Helena (Voz & Chat Direto)</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate("/execucao"))}
            className="flex items-center gap-2.5 px-3 py-2 text-xs"
          >
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span>Central de Execução (Agentes, Tarefas & Handoffs)</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate("/supervisao"))}
            className="flex items-center gap-2.5 px-3 py-2 text-xs"
          >
            <Inbox className="h-4 w-4 text-muted-foreground" />
            <span>Supervisão da Helena · pendências e exceções</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate("/portfolio"))}
            className="flex items-center gap-2.5 px-3 py-2 text-xs"
          >
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span>Portfólio de Negócios</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate("/equipe"))}
            className="flex items-center gap-2.5 px-3 py-2 text-xs"
          >
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>Equipe Digital · especialistas</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate("/integracoes"))}
            className="flex items-center gap-2.5 px-3 py-2 text-xs"
          >
            <Zap className="h-4 w-4 text-amber-500" />
            <span>Central de Canais, Voz & Integrações</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* OPERAÇÃO */}
        <CommandGroup heading="Operação & Finanças">
          <CommandItem
            onSelect={() => runCommand(() => navigate("/crm"))}
            className="flex items-center gap-2.5 px-3 py-2 text-xs"
          >
            <Target className="h-4 w-4 text-muted-foreground" />
            <span>CRM & Pipeline</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate("/financeiro"))}
            className="flex items-center gap-2.5 px-3 py-2 text-xs"
          >
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <span>Caixa & Financeiro</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate("/calendario"))}
            className="flex items-center gap-2.5 px-3 py-2 text-xs"
          >
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <span>Calendário & Agenda</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate("/sistema"))}
            className="flex items-center gap-2.5 px-3 py-2 text-xs"
          >
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span>Saúde do Sistema & Conexões</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* UNIDADES DE NEGÓCIO */}
        <CommandGroup heading="Alternar Empresa">
          {empresas.map((empresa) => (
            <CommandItem
              key={empresa.id}
              onSelect={() => runCommand(() => setCurrentBusiness(empresa.id))}
              className="flex items-center justify-between px-3 py-2 text-xs"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: empresa.cor || "#007A3D" }}
                />
                <span className="font-medium">{empresa.nome}</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                {empresa.id}
              </span>
            </CommandItem>
          ))}
          <CommandItem
            onSelect={() => runCommand(() => ligarTodas())}
            className="flex items-center gap-2 px-3 py-2 text-xs"
          >
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Visão Consolidada (Grupo)</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* MÓDULOS ESPECÍFICOS */}
        <CommandGroup heading="Módulos Corporativos">
          {MODULOS.filter(
            (m) =>
              !["portfolio", "crm", "financeiro", "calendario", "equipe"].includes(
                m.tabela
              )
          ).map((mod) => (
            <CommandItem
              key={mod.tabela}
              onSelect={() =>
                runCommand(() => navigate(mod.rota || `/modulo/${mod.tabela}`))
              }
              className="flex items-center justify-between px-3 py-2 text-xs"
            >
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-muted-foreground/70" />
                <span>{mod.titulo}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {mod.grupo}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
