"use client";

// ============================================================
// survey フォームの「今日の気分」タイルグリッド + 予算プリセット。
// groups/[id]/survey と invite/[id]/survey で共有する。
// ============================================================

import { useState } from "react";
import { GENRES } from "@/lib/mockData";
import { genreEmoji } from "@/lib/genre-emoji";

type Translate = (key: string) => string;

// --- 食べたい気分: わくわくする絵文字タイルグリッド ---
export function MoodTileGrid({
  hint,
  remaining,
  selected,
  onToggle,
  maxReached,
}: {
  hint: string;
  remaining: string;
  selected: string[];
  onToggle: (genreId: string) => void;
  maxReached: boolean;
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
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
        }}
      >
        {GENRES.map((genre) => {
          const isSelected = selected.includes(genre.id);
          const dim = maxReached && !isSelected;
          return (
            <button
              key={genre.id}
              type="button"
              onClick={() => onToggle(genre.id)}
              className={isSelected ? "animate-tile-pop" : undefined}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: "10px 4px",
                borderRadius: 14,
                cursor: "pointer",
                border: `1.5px solid ${isSelected ? "var(--primary)" : "var(--border-light)"}`,
                backgroundColor: isSelected ? "var(--primary)" : "var(--surface)",
                color: isSelected ? "#fff" : "var(--text-primary)",
                opacity: dim ? 0.45 : 1,
                boxShadow: isSelected ? "0 4px 12px rgba(240,90,40,0.28)" : "none",
                transform: isSelected ? "scale(1.04)" : "scale(1)",
                transition: "opacity 0.15s ease, box-shadow 0.2s ease",
              }}
            >
              <span style={{ fontSize: 26, lineHeight: 1 }}>{genreEmoji(genre.id)}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  lineHeight: 1.15,
                  textAlign: "center",
                }}
              >
                {genre.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- 今日は避けたい: 折りたたみ + 小さめダークタイル ---
export function AvoidSection({
  selected,
  onToggle,
  maxReached,
  t,
}: {
  selected: string[];
  onToggle: (genreId: string) => void;
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
          borderRadius: 12,
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
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 6,
            }}
          >
            {GENRES.map((genre) => {
              const isSelected = selected.includes(genre.id);
              const dim = maxReached && !isSelected;
              return (
                <button
                  key={genre.id}
                  type="button"
                  onClick={() => onToggle(genre.id)}
                  className={isSelected ? "animate-tile-pop" : undefined}
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    padding: "7px 3px",
                    borderRadius: 12,
                    cursor: "pointer",
                    border: `1.5px solid ${isSelected ? "var(--secondary)" : "var(--border-light)"}`,
                    backgroundColor: isSelected ? "var(--secondary)" : "var(--surface)",
                    color: isSelected ? "#fff" : "var(--text-secondary)",
                    opacity: dim ? 0.4 : 1,
                    transition: "opacity 0.15s ease",
                  }}
                >
                  <span
                    style={{
                      fontSize: 20,
                      lineHeight: 1,
                      opacity: isSelected ? 0.55 : 1,
                    }}
                  >
                    {genreEmoji(genre.id)}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      lineHeight: 1.1,
                      textAlign: "center",
                      textDecoration: isSelected ? "line-through" : "none",
                    }}
                  >
                    {genre.name}
                  </span>
                  {isSelected && (
                    <span
                      style={{
                        position: "absolute",
                        top: 2,
                        right: 4,
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#fff",
                      }}
                    >
                      ✕
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// --- 予算: 上限プリセットチップ 1 列 ---
const BUDGET_CAPS: { value: number | null; key: string }[] = [
  { value: 2000, key: "survey.budgetCap2000" },
  { value: 4000, key: "survey.budgetCap4000" },
  { value: 6000, key: "survey.budgetCap6000" },
  { value: 10000, key: "survey.budgetCap10000" },
  { value: null, key: "survey.budgetCapNone" },
];

export function BudgetCapPicker({
  value,
  onChange,
  t,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  t: Translate;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {BUDGET_CAPS.map((cap) => {
        const isSelected = value === cap.value;
        return (
          <button
            key={cap.key}
            type="button"
            onClick={() => onChange(cap.value)}
            className={isSelected ? "animate-tile-pop" : undefined}
            style={{
              padding: "10px 16px",
              borderRadius: 100,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              border: `1.5px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
              backgroundColor: isSelected ? "var(--primary)" : "var(--surface)",
              color: isSelected ? "#fff" : "var(--text-primary)",
              boxShadow: isSelected ? "0 4px 12px rgba(240,90,40,0.24)" : "none",
              transition: "box-shadow 0.2s ease",
            }}
          >
            {t(cap.key)}
          </button>
        );
      })}
    </div>
  );
}
