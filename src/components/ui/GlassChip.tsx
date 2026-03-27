"use client";

import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

type GlassChipProps = {
  children: ReactNode;
  selected?: boolean;
  variant?: "like" | "dislike" | "neutral" | "default";
  onClick?: () => void;
  className?: string;
};

export function GlassChip({
  children,
  selected,
  variant = "default",
  onClick,
  className,
}: GlassChipProps) {
  const variantClasses = {
    default: selected ? "bg-accent/20 border-accent/40 text-accent" : "",
    like: selected ? "bg-success/20 border-success/40 text-green-700" : "",
    dislike: selected ? "bg-danger/20 border-danger/40 text-red-700" : "",
    neutral: selected ? "bg-white/30 border-white/40 text-foreground/60" : "",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "glass inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium",
        "transition-all duration-200 cursor-pointer rounded-xl",
        "hover:bg-white/25",
        !selected && "text-foreground/60",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </button>
  );
}
