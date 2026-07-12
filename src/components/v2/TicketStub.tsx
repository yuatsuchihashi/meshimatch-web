import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

export interface TicketStubItem {
  label: string;
  value: ReactNode;
}

export interface TicketStubProps extends HTMLAttributes<HTMLElement> {
  tabLabel?: string;
  heading: ReactNode;
  subtitle?: ReactNode;
  items: TicketStubItem[];
  stamp?: ReactNode;
  showBarcode?: boolean;
}

export function TicketStub({
  tabLabel = "MESHIMATCH",
  heading,
  subtitle,
  items,
  stamp,
  showBarcode = true,
  className,
  ...props
}: TicketStubProps) {
  return (
    <article className={clsx("v2-ticket-stub", className)} {...props}>
      <div className="v2-ticket-stub__tab" aria-hidden>
        <span>{tabLabel}</span>
      </div>
      <div className="v2-ticket-stub__body">
        <div className="v2-ticket-stub__route">
          <div className="v2-ticket-stub__route-main">{heading}</div>
          {subtitle && <div className="v2-ticket-stub__route-sub">{subtitle}</div>}
        </div>
        {stamp && <div className="v2-ticket-stub__stamp">{stamp}</div>}
        <div className="v2-ticket-stub__grid">
          {items.map((item, index) => (
            <div key={`${item.label}-${index}`}>
              <span className="v2-ticket-stub__item-label">{item.label}</span>
              <span className="v2-ticket-stub__item-value">{item.value}</span>
            </div>
          ))}
        </div>
        {showBarcode && <div className="v2-ticket-stub__barcode" aria-hidden />}
      </div>
    </article>
  );
}
