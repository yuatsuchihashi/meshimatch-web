"use client";

// ============================================================
// survey フォームの「今日の気分」気分ワードピル。
// 絵文字なし・テキストのみの大きめタップピル。
// groups/[id]/survey と invite/[id]/survey で共有する。
// ============================================================

import { useState } from "react";
import { MOODS } from "@/lib/moods";

type Translate = (key: string) => string;

const MAX_SLOT = 2;

// 気分ラベルは i18n から引く (en は rich/light/... に切り替わる)
function moodLabel(t: Translate, moodId: string, fallback: string): string {
  const key = `survey.mood_${moodId}`;
  const translated = t(key);
  return translated === key ? fallback : translated;
}

// --- 食べたい気分: オレンジ塗り ---
export function MoodPickGrid({
  hint,
  remaining,
  selected,
  onToggle,
  maxReached,
  t,
}: {
  hint: string;
  remaining: string;
  selected: string[];
  onToggle: (moodId: string) => void;
  maxReached: boolean;
  t: Translate;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{hint}</div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--primary)",
            whiteSpace: "nowrap",
          }}
        >
          {remaining}
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
        }}
      >
        {MOODS.map((mood) => {
          const isSelected = selected.includes(mood.id);
          const dim = maxReached && !isSelected;
          return (
            <button
              key={mood.id}
              type="button"
              onClick={() => onToggle(mood.id)}
              className={isSelected ? "animate-tile-pop" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 52,
                padding: "8px 6px",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: 15,
                fontWeight: 700,
                border: `1.5px solid ${isSelected ? "var(--primary)" : "var(--border-light)"}`,
                backgroundColor: isSelected ? "var(--primary)" : "var(--surface)",
                color: isSelected ? "#fff" : "var(--text-primary)",
                opacity: dim ? 0.45 : 1,
                boxShadow: isSelected ? "0 4px 12px rgba(240,90,40,0.28)" : "none",
                transform: isSelected ? "scale(1.04)" : "scale(1)",
                transition: "opacity 0.15s ease, box-shadow 0.2s ease",
              }}
            >
              {moodLabel(t, mood.id, mood.label)}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 8 }}>
        {t("survey.moodNoneCaption")}
      </div>
    </div>
  );
}

// --- 今日はナシ: 折りたたみ + エスプレッソ塗り、同じ気分リスト ---
export function MoodAvoidSection({
  selected,
  onToggle,
  maxReached,
  t,
}: {
  selected: string[];
  onToggle: (moodId: string) => void;
  maxReached: boolean;
  t: Translate;
}) {
  const [open, setOpen] = useState(selected.length > 0);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "10px 12px",
          borderRadius: 999,
          border: "1px dashed var(--border)",
          backgroundColor: "var(--bg)",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
            {t("survey.avoidCollapsed")}
            {selected.length > 0 ? ` (${selected.length})` : ""}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            {t("survey.avoidCollapsedHint")}
          </span>
        </span>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-tertiary)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s ease",
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="animate-fade-in" style={{ marginTop: 10 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
            }}
          >
            {MOODS.map((mood) => {
              const isSelected = selected.includes(mood.id);
              const dim = maxReached && !isSelected;
              return (
                <button
                  key={mood.id}
                  type="button"
                  onClick={() => onToggle(mood.id)}
                  className={isSelected ? "animate-tile-pop" : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 52,
                    padding: "8px 6px",
                    borderRadius: 999,
                    cursor: "pointer",
                    fontSize: 15,
                    fontWeight: 700,
                    border: `1.5px solid ${isSelected ? "var(--secondary)" : "var(--border-light)"}`,
                    backgroundColor: isSelected ? "var(--secondary)" : "var(--surface)",
                    color: isSelected ? "#fff" : "var(--text-secondary)",
                    textDecoration: isSelected ? "line-through" : "none",
                    opacity: dim ? 0.4 : 1,
                    transition: "opacity 0.15s ease",
                  }}
                >
                  {moodLabel(t, mood.id, mood.label)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export { MAX_SLOT as MOOD_MAX_SLOT };
