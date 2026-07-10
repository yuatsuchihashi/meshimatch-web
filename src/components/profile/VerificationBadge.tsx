import { CheckCircle2 } from "lucide-react";

interface VerificationBadgeProps {
  label?: string;
  title: string;
  compact?: boolean;
}

export function VerificationBadge({ label, title, compact = false }: VerificationBadgeProps) {
  return (
    <span
      aria-label={title}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? 3 : 4,
        borderRadius: 999,
        padding: label ? (compact ? "2px 6px" : "3px 8px") : 0,
        backgroundColor: label ? "rgba(92,139,82,0.12)" : "transparent",
        color: "var(--success-deep)",
        fontSize: compact ? 10 : 11,
        fontWeight: 900,
        lineHeight: 1,
        verticalAlign: "middle",
        flexShrink: 0,
      }}
    >
      <CheckCircle2 size={compact ? 13 : 15} strokeWidth={2.7} />
      {label ? <span>{label}</span> : null}
    </span>
  );
}
