import React from "react";

export type BadgeVariant =
  | "neutral"
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "purple"
  | "outline";

interface ExecutiveBadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
}

export function ExecutiveBadge({
  children,
  variant = "default",
  size = "sm",
  dot = false,
  className = "",
}: ExecutiveBadgeProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "success":
        return "bg-[#007A3D]/10 text-[#007A3D] dark:text-[#22c55e] border-[#007A3D]/20";
      case "warning":
        return "bg-[#B47D14]/10 text-[#B47D14] dark:text-[#fbbf24] border-[#B47D14]/25";
      case "danger":
        return "bg-[#B91C1C]/10 text-[#B91C1C] dark:text-[#f87171] border-[#B91C1C]/20";
      case "info":
        return "bg-[#2563EB]/10 text-[#2563EB] dark:text-[#60a5fa] border-[#2563EB]/20";
      case "purple":
        return "bg-[#7C3AED]/10 text-[#7C3AED] dark:text-[#c084fc] border-[#7C3AED]/20";
      case "outline":
        return "bg-transparent text-foreground border-border";
      default:
        return "bg-muted text-muted-foreground border-border/50";
    }
  };

  const getDotColor = () => {
    switch (variant) {
      case "success":
        return "bg-[#007A3D] dark:bg-[#22c55e]";
      case "warning":
        return "bg-[#B47D14] dark:bg-[#fbbf24]";
      case "danger":
        return "bg-[#B91C1C] dark:bg-[#f87171]";
      case "info":
        return "bg-[#2563EB] dark:bg-[#60a5fa]";
      case "purple":
        return "bg-[#7C3AED] dark:bg-[#c084fc]";
      default:
        return "bg-muted-foreground";
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-medium transition-colors ${
        size === "sm"
          ? "px-2 py-0.5 text-[11px] rounded-[6px]"
          : "px-2.5 py-1 text-xs rounded-[7px]"
      } ${getVariantStyles()} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${getDotColor()}`} />}
      {children}
    </span>
  );
}
