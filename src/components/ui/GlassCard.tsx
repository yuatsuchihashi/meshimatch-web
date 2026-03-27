import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  variant?: "default" | "strong" | "dark";
  onClick?: () => void;
};

export function GlassCard({
  children,
  className,
  variant = "default",
  onClick,
}: GlassCardProps) {
  const variantClass = {
    default: "glass",
    strong: "glass-strong",
    dark: "glass-dark",
  }[variant];

  return (
    <div
      className={cn(variantClass, "p-4", className)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}
