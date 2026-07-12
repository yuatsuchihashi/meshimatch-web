import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

export interface CircleIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
}

export function CircleIconButton({
  icon,
  label,
  className,
  type = "button",
  ...props
}: CircleIconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={clsx("v2-circle-icon-button", className)}
      {...props}
    >
      {icon}
    </button>
  );
}
