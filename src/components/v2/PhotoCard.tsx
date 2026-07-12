import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

export interface PhotoCardProps extends HTMLAttributes<HTMLElement> {
  photoSrc?: string | null;
  photoAlt: string;
  placeholder?: ReactNode;
  overlayStart?: ReactNode;
  overlayEnd?: ReactNode;
  panelAction?: ReactNode;
}

export function PhotoCard({
  photoSrc,
  photoAlt,
  placeholder,
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
        {photoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoSrc} alt={photoAlt} />
        ) : (
          <div className="v2-photo-card__placeholder" aria-label={photoAlt}>
            {placeholder}
          </div>
        )}
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
