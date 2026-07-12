import type { ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";

export interface NavBarV2Item {
  href: string;
  label: string;
  icon: ReactNode | ((active: boolean) => ReactNode);
}

export interface NavBarV2Props {
  items: NavBarV2Item[];
  activeHref?: string;
  className?: string;
  "aria-label"?: string;
}

export function NavBarV2({
  items,
  activeHref,
  className,
  "aria-label": ariaLabel = "Primary navigation",
}: NavBarV2Props) {
  return (
    <nav className={clsx("v2-nav-bar", className)} aria-label={ariaLabel}>
      {items.map((item) => {
        const active = activeHref ? activeHref === item.href : false;
        const icon = typeof item.icon === "function" ? item.icon(active) : item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx("v2-nav-bar__item", active && "v2-nav-bar__item--active")}
            aria-current={active ? "page" : undefined}
          >
            <span className="v2-nav-bar__icon">{icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
