"use client";

// ============================================================
// 持ち寄りステップ「行きたい店ある？」のピッカー。
// 店名検索 → デバウンスして /api/restaurants/search → ドロップダウン。
// タップで選択チップに追加（最大2）。groups/[id]/survey と
// invite/[id]/survey で共有する。
// ============================================================

import { useEffect, useRef, useState } from "react";

type Translate = (
  key: string,
  params?: Record<string, string | number>
) => string;

export interface SuggestPick {
  id: string;
  name: string;
  showName: boolean;
  area?: string;
}

interface SearchResult {
  id: string;
  name: string;
  area?: string;
  address?: string;
  photoUrl?: string;
}

const MAX_PICKS = 2;

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1.5px solid var(--border)",
  fontSize: 15,
  color: "var(--text-primary)",
  backgroundColor: "var(--bg)",
  outline: "none",
};

export function SuggestPicker({
  picks,
  onChange,
  showName,
  onShowNameChange,
  quickPicks,
  t,
}: {
  picks: SuggestPick[];
  onChange: (picks: SuggestPick[]) => void;
  showName: boolean;
  onShowNameChange: (value: boolean) => void;
  quickPicks?: { id: string; name: string; area?: string | null }[];
  t: Translate;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const atMax = picks.length >= MAX_PICKS;

  // 入力をデバウンス (~250ms) して検索。2文字未満は検索しない。
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || atMax) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/restaurants/search?q=${encodeURIComponent(trimmed)}`
        );
        const data = await res.json();
        setResults((data.results as SearchResult[]) ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query, atMax]);

  const inputRef = useRef<HTMLInputElement>(null);

  function addPick(result: SearchResult) {
    if (picks.length >= MAX_PICKS || picks.some((p) => p.id === result.id)) {
      return;
    }
    onChange([
      ...picks,
      { id: result.id, name: result.name, area: result.area, showName },
    ]);
    setQuery("");
    setResults([]);
  }

  // 検索でヒットしない店を、入力した名前のまま台帳に登録して選ぶ
  async function addManual() {
    const name = query.trim();
    if (!name || picks.length >= MAX_PICKS) {
      return;
    }
    try {
      const res = await fetch("/api/restaurants/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        return; // 失敗時は黙って何もしない (ドロップダウンは残す)
      }
      const data = (await res.json()) as { id?: string; name?: string; area?: string };
      if (!data.id || picks.some((p) => p.id === data.id)) {
        return;
      }
      onChange([
        ...picks,
        { id: data.id, name: data.name ?? name, area: data.area, showName },
      ]);
      setQuery("");
      setResults([]);
    } catch {
      // 失敗時は黙って何もしない
    }
  }

  function removePick(id: string) {
    onChange(picks.filter((p) => p.id !== id));
  }

  const availableQuickPicks = (quickPicks ?? []).filter(
    (q) => !picks.some((p) => p.id === q.id)
  );

  return (
    <div>
      {/* 選択済みチップ */}
      {picks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: picks.length > 0 ? 12 : 0 }}>
          {picks.map((pick) => (
            <div
              key={pick.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 12,
                border: "1.5px solid var(--primary)",
                backgroundColor: "rgba(240,90,40,0.06)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {pick.name}
                </div>
                {pick.area && (
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                    {pick.area}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => removePick(pick.id)}
                aria-label="remove"
                style={{
                  flexShrink: 0,
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  border: "none",
                  background: "var(--bg-secondary)",
                  color: "var(--text-secondary)",
                  fontSize: 16,
                  lineHeight: 1,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* お気に入りからのクイック追加 (2件未満のときだけ) */}
      {!atMax && availableQuickPicks.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 8 }}>
            {t("survey.suggestFromFavorites")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {availableQuickPicks.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => addPick({ id: q.id, name: q.name, area: q.area ?? undefined })}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "6px 12px",
                  borderRadius: 100,
                  border: "1.5px solid var(--border-strong)",
                  background: "var(--surface)",
                  color: "var(--text-primary)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  maxWidth: "100%",
                }}
              >
                <span style={{ color: "var(--primary)", fontWeight: 800 }}>＋</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {q.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 検索入力 (2件埋まったら隠す) */}
      {!atMax && (
        <div style={{ position: "relative" }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("survey.suggestPlaceholder")}
            style={inputStyle}
          />
          {query.trim().length >= 2 && (
            <div
              style={{
                marginTop: 6,
                borderRadius: 12,
                border: "1px solid var(--border-light)",
                backgroundColor: "var(--surface)",
                overflow: "hidden",
                boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
              }}
            >
              {searching && results.length === 0 ? (
                <div style={{ padding: "12px 14px", fontSize: 13, color: "var(--text-tertiary)" }}>
                  {t("survey.suggestSearching")}
                </div>
              ) : (
                <>
                {results.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => addPick(result)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      padding: "10px 12px",
                      border: "none",
                      borderBottom: "1px solid var(--border-light)",
                      background: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {result.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={result.photoUrl}
                        alt=""
                        width={32}
                        height={32}
                        style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {result.name}
                      </div>
                      {result.area && (
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                          {result.area}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
                {/* 検索でヒットしない店を、入力名のまま追加 */}
                {!searching && (
                  <button
                    type="button"
                    onClick={addManual}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      padding: "10px 12px",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "rgba(240,90,40,0.1)",
                        color: "var(--primary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                        fontWeight: 800,
                      }}
                    >
                      ＋
                    </span>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: "var(--primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t("survey.suggestAddManual", { name: query.trim() })}
                    </div>
                  </button>
                )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* 名前を出すトグル (1件以上選択時のみ) */}
      {picks.length > 0 && (
        <button
          type="button"
          onClick={() => onShowNameChange(!showName)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            marginTop: 12,
            padding: "10px 4px",
            background: "none",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span
            style={{
              flexShrink: 0,
              width: 22,
              height: 22,
              borderRadius: 6,
              border: showName ? "none" : "1.5px solid var(--border-strong)",
              backgroundColor: showName ? "var(--primary)" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {showName && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
          <span style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}>
            {t("survey.suggestShowName")}
          </span>
        </button>
      )}
    </div>
  );
}
