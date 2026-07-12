import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

export interface PhotoCardProps extends HTMLAttributes<HTMLElement> {
  photoSrc: string;
  photoAlt: string;
  overlayStart?: ReactNode;
  overlayEnd?: ReactNode;
  panelAction?: ReactNode;
}

export function PhotoCard({
  photoSrc,
  photoAlt,
  overlayStart,
  overlayEnd,
  panelAction,
  children,
  className,
  ...props
}: PhotoCardProps) {
  return (
    <article className={clsx("v2-photo-card", className)} {...props}>
      <div className="v2-photo-card__media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoSrc} alt={photoAlt} />
        {(overlayStart || overlayEnd) && (
          <div className="v2-photo-card__overlays">
            <div className="v2-photo-card__overlay-group">{overlayStart}</div>
            <div className="v2-photo-card__overlay-group">{overlayEnd}</div>
          </div>
        )}
      </div>
      <div className="v2-photo-card__panel">
        <div style={{ minWidth: 0 }}>{children}</div>
        {panelAction}
      </div>
    </article>
  );
}
