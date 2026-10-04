import React from "react";

interface ExecutiveLogoProps {
  collapsed?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ExecutiveLogo({ collapsed = false, className = "", size = "md" }: ExecutiveLogoProps) {
  const isLg = size === "lg";
  const isSm = size === "sm";

  return (
    <div className={`he-brand flex items-center gap-3 ${className}`}>
      {/* Monograma H executivo e discreto */}
      <div
        className={`he-brand-mark grid place-items-center rounded-lg bg-[#007A3D] text-white shadow-sm font-semibold tracking-tight transition-transform ${
          isLg ? "h-11 w-11 text-xl rounded-xl" : isSm ? "h-7 w-7 text-xs" : "h-8 w-8 text-sm"
        }`}
      >
        <span>H</span>
      </div>

      {!collapsed && (
        <div className="he-brand-copy flex flex-col leading-tight">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-semibold tracking-tight text-white ${
                isLg ? "text-lg" : isSm ? "text-xs" : "text-sm"
              }`}
            >
              Sistema Helena
            </span>
          </div>
          <span className="text-[11px] font-medium tracking-normal text-[#8A9690]">
            Central Executiva
          </span>
        </div>
      )}
    </div>
  );
}
