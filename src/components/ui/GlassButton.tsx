"use client";

import { cn } from "@/lib/utils";
import { type ReactNode, type ButtonHTMLAttributes } from "react";

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "default" | "accent" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
};

export function GlassButton({
  children,
  className,
  variant = "default",
  size = "md",
  ...props
}: GlassButtonProps) {
  const variantClasses = {
    default: "glass hover:bg-white/30 active:bg-white/40 text-white",
    accent:
      "bg-primary hover:opacity-90 active:opacity-80 text-white border border-primary-light/30 shadow-lg shadow-primary/20",
    danger:
      "bg-danger hover:opacity-90 active:opacity-80 text-white border border-red-400/30",
    ghost:
      "bg-transparent hover:bg-white/10 active:bg-white/20 text-white border-none shadow-none",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm rounded-xl",
    md: "px-5 py-2.5 text-base rounded-2xl",
    lg: "px-7 py-3.5 text-lg rounded-2xl",
  };

  return (
    <button
      className={cn(
        "font-medium transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
