import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface ExecutiveDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  description?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "normal" | "wide" | "max-w-lg";
}

export function ExecutiveDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  description,
  badge,
  children,
  footer,
  width = "normal",
}: ExecutiveDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={`he-studio-drawer w-full ${
          width === "wide" ? "sm:max-w-[540px]" : "sm:max-w-[460px]"
        } p-0 flex flex-col bg-card border-l border-border shadow-xl`}
      >
        <SheetHeader className="p-6 border-b border-border/60 text-left bg-muted/10">
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="space-y-1">
              <SheetTitle className="text-base font-semibold text-foreground tracking-tight">
                {title}
              </SheetTitle>
              {(subtitle || description) && (
                <SheetDescription className="text-xs text-muted-foreground leading-normal">
                  {subtitle || description}
                </SheetDescription>
              )}
            </div>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {children}
        </div>

        {footer && (
          <div className="p-4 border-t border-border/60 bg-muted/10 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
