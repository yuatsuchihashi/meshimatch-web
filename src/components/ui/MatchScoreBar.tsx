"use client";

interface MatchScoreBarProps {
  score: number; // 0.0 - 1.0
  height?: number;
}

export function MatchScoreBar({ score, height = 8 }: MatchScoreBarProps) {
  const percent = Math.round(score * 100);

  const color =
    score >= 0.8
      ? "var(--primary)"
      : score >= 0.6
      ? "var(--warning)"
      : "var(--text-tertiary)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          flex: 1,
          height,
          backgroundColor: "var(--border-light)",
          borderRadius: height,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percent}%`,
            backgroundColor: color,
            borderRadius: height,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color,
          width: 40,
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        {percent}%
      </span>
    </div>
  );
}

interface ScoreBadgeProps {
  score: number;
}

export function ScoreBadge({ score }: ScoreBadgeProps) {
  const percent = Math.round(score * 100);
  const color =
    score >= 0.8
      ? "var(--primary)"
      : score >= 0.6
      ? "var(--warning)"
      : "var(--text-tertiary)";

  return (
    <div
      style={{
        backgroundColor: color,
        color: "white",
        fontSize: 12,
        fontWeight: 700,
        padding: "3px 8px",
        borderRadius: 20,
      }}
    >
      {percent}%
    </div>
  );
}
