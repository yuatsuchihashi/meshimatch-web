import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

export type PillButtonVariant = "cta" | "ink" | "ghost";

export function getPillButtonClassName(variant: PillButtonVariant = "cta", className?: string) {
  return clsx("v2-pill-button", `v2-pill-button--${variant}`, className);
}

export interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PillButtonVariant;
  icon?: ReactNode;
}

export function PillButton({
  variant = "cta",
  icon,
  children,
  className,
  type = "button",
  ...props
}: PillButtonProps) {
  return (
    <button type={type} className={getPillButtonClassName(variant, className)} {...props}>
      {icon}
      <span>{children}</span>
    </button>
  );
}
