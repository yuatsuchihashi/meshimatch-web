import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

export type ChipVariant = "default" | "selected" | "sage" | "honey" | "blush";

export function getChipClassName(variant: ChipVariant = "default", className?: string) {
  return clsx("v2-chip", variant !== "default" && `v2-chip--${variant}`, className);
}

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant;
  icon?: ReactNode;
  label?: ReactNode;
}

export function Chip({ variant = "default", icon, label, children, className, ...props }: ChipProps) {
  const content = label ?? children;

  return (
    <span className={getChipClassName(variant, className)} {...props}>
      {icon && <span className="v2-chip__icon">{icon}</span>}
      <span className="v2-chip__label">{content}</span>
    </span>
  );
}
