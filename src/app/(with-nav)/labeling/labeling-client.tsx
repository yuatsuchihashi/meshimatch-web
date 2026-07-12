"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { FounderLabel, FounderLabelRow } from "@/lib/labeling/labels";
import type { LabelingCatalogRestaurant } from "@/lib/labeling/catalog";

const labelButtons: { label: FounderLabel; text: string; shortcut: string; color: string }[] = [
  { label: "good", text: "良い", shortcut: "1", color: "#166534" },
  { label: "ok", text: "普通", shortcut: "2", color: "#854d0e" },
  { label: "bad", text: "ダメ", shortcut: "3", color: "#991b1b" },
];

export default function LabelingClient() {
  const [restaurants, setRestaurants] = useState<LabelingCatalogRestaurant[]>([]);
  const [labels, setLabels] = useState<Record<string, FounderLabelRow>>({});
  const [index, setIndex] = useState(0);
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState("読み込み中");

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [catalogResponse, labelsResponse] = await Promise.all([
        fetch("/api/quality/catalog", { cache: "no-store" }),
        fetch("/api/quality/labels", { cache: "no-store" }),
      ]);
      if (!catalogResponse.ok || !labelsResponse.ok) throw new Error("データを読み込めませんでした");
      const catalogJson = (await catalogResponse.json()) as { restaurants: LabelingCatalogRestaurant[] };
      const labelsJson = (await labelsResponse.json()) as { labels: FounderLabelRow[] };
      if (!mounted) return;
      setRestaurants(catalogJson.restaurants);
      setLabels(Object.fromEntries(labelsJson.labels.map((row) => [row.external_id, row])));
      setStatus("");
    }

    load().catch((error) => {
      if (mounted) setStatus(error instanceof Error ? error.message : "エラーが発生しました");
    });
    return () => {
      mounted = false;
    };
  }, []);

  const current = restaurants[index] ?? null;
  const currentLabel = current ? labels[current.external_id] : null;
  const labeledCount = restaurants.filter((restaurant) => labels[restaurant.external_id]).length;

  useEffect(() => {
    setMemo(currentLabel?.memo ?? "");
  }, [current?.external_id, currentLabel?.memo]);

  const progressText = useMemo(() => {
    if (restaurants.length === 0) return "0 / 0";
    return `${labeledCount} / ${restaurants.length} labeled`;
  }, [labeledCount, restaurants.length]);

  async function saveLabel(label: FounderLabel) {
    if (!current) return;
    setStatus("保存中");
    const response = await fetch("/api/quality/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        external_id: current.external_id,
        place_id: current.place_id,
        name: current.name,
        label,
        memo,
      }),
    });

    const json = (await response.json()) as { label?: FounderLabelRow; error?: string };
    if (!response.ok || !json.label) {
      setStatus(json.error ?? "保存に失敗しました");
      return;
    }

    setLabels((prev) => ({ ...prev, [json.label!.external_id]: json.label! }));
    setStatus("保存しました");
    setIndex((value) => Math.min(value + 1, Math.max(restaurants.length - 1, 0)));
  }

  function skip() {
    setStatus("");
    setIndex((value) => Math.min(value + 1, Math.max(restaurants.length - 1, 0)));
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const match = labelButtons.find((button) => button.shortcut === event.key);
      if (match) void saveLabel(match.label);
      if (event.key === "ArrowRight") skip();
      if (event.key === "ArrowLeft") setIndex((value) => Math.max(value - 1, 0));
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <main style={{ minHeight: "100dvh", background: "#f7f4ef", color: "#1f2933", padding: "24px 16px 40px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline" }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b", fontWeight: 700 }}>Founder labeling</p>
            <h1 style={{ margin: "4px 0 0", fontSize: 28, lineHeight: 1.2 }}>お店ラベリング</h1>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{progressText}</div>
        </header>

        {status ? <p style={{ margin: "18px 0 0", color: "#475569" }}>{status}</p> : null}

        {current ? (
          <section style={{ marginTop: 18, display: "grid", gap: 16 }}>
            <nav style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
              <button type="button" onClick={() => setIndex((value) => Math.max(value - 1, 0))} style={navButtonStyle}>
                前へ
              </button>
              <strong>
                {index + 1} / {restaurants.length}
              </strong>
              <button type="button" onClick={skip} style={navButtonStyle}>
                スキップ
              </button>
            </nav>

            <article style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 18 }}>
              <div
                style={{
                  height: 170,
                  border: "1px dashed #cbd5e1",
                  borderRadius: 8,
                  display: "grid",
                  placeItems: "center",
                  color: "#64748b",
                  background: "#f8fafc",
                  textAlign: "center",
                  padding: 16,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>写真 placeholder</div>
                  <div style={{ marginTop: 6, fontSize: 12 }}>
                    {current.photo_refs.length > 0 ? `refs: ${current.photo_refs.join(", ")}` : "写真・レビュー詳細は未取得"}
                  </div>
                </div>
              </div>

              <h2 style={{ margin: "18px 0 8px", fontSize: 26, lineHeight: 1.25 }}>{current.name}</h2>
              <dl style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "6px 12px", margin: 0 }}>
                <dt style={termStyle}>エリア</dt>
                <dd style={descStyle}>{current.area}</dd>
                <dt style={termStyle}>価格帯</dt>
                <dd style={descStyle}>{current.price_band}</dd>
                <dt style={termStyle}>座標</dt>
                <dd style={descStyle}>
                  {current.lat !== null && current.lng !== null
                    ? `${current.lat.toFixed(6)}, ${current.lng.toFixed(6)}`
                    : "未取得"}
                </dd>
                <dt style={termStyle}>Maps</dt>
                <dd style={{ ...descStyle, overflowWrap: "anywhere" }}>
                  {current.resolved_url ?? current.short_url ?? "未取得"}
                </dd>
                <dt style={termStyle}>評価</dt>
                <dd style={descStyle}>
                  {current.rating === null ? "未取得" : `${current.rating} (${current.rating_count ?? 0}件)`}
                </dd>
                <dt style={termStyle}>現在のラベル</dt>
                <dd style={descStyle}>{currentLabel ? labelText(currentLabel.label) : "未ラベル"}</dd>
              </dl>

              <section style={{ marginTop: 16 }}>
                <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>レビュー</h3>
                <ul style={{ display: "grid", gap: 8, margin: 0, paddingLeft: 18 }}>
                  {current.reviews.length > 0 ? (
                    current.reviews.map((review) => <li key={review}>{review}</li>)
                  ) : (
                    <li>レビュー未取得</li>
                  )}
                </ul>
              </section>
            </article>

            <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
              メモ
              <input
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                maxLength={160}
                placeholder="任意: 気になった理由を一行で"
                style={{
                  minHeight: 46,
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "0 12px",
                  fontSize: 16,
                }}
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {labelButtons.map((button) => (
                <button
                  key={button.label}
                  type="button"
                  onClick={() => void saveLabel(button.label)}
                  style={{
                    minHeight: 72,
                    border: 0,
                    borderRadius: 8,
                    background: button.color,
                    color: "#fff",
                    fontSize: 22,
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {button.text}
                  <span style={{ display: "block", marginTop: 4, fontSize: 12, opacity: 0.8 }}>
                    {button.shortcut}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function labelText(label: FounderLabel): string {
  return label === "good" ? "良い" : label === "ok" ? "普通" : "ダメ";
}

const navButtonStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  minHeight: 38,
  padding: "0 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const termStyle: CSSProperties = { color: "#64748b", fontWeight: 800 };
const descStyle: CSSProperties = { margin: 0, fontWeight: 700 };
