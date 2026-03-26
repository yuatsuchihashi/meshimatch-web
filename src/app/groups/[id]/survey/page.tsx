"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MOCK_GROUPS } from "@/lib/mockData";
import { GENRES, ALLERGIES, DIETARY_RESTRICTIONS } from "@/lib/mockData";
import type { TierData, TierKey } from "@/lib/types";
import { useState } from "react";

const TIER_CONFIG = {
  S: { label: "Tier S", emoji: "🔥", subtitle: "めっちゃ食べたい", color: "var(--primary)" },
  A: { label: "Tier A", emoji: "👍", subtitle: "食べたい", color: "var(--warning)" },
  B: { label: "Tier B", emoji: "😐", subtitle: "まぁいいよ", color: "var(--text-tertiary)" },
};

const AREAS = ["渋谷", "新宿", "池袋", "銀座", "六本木", "恵比寿", "表参道", "下北沢", "吉祥寺", "上野"];

export default function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const group = MOCK_GROUPS.find((g) => g.id === id);
  const groupName = group?.name ?? "グループ";

  const [anywhereOk, setAnywhereOk] = useState(true);
  const [departureStation, setDepartureStation] = useState("");
  const [preferredArea, setPreferredArea] = useState("");
  const [tiers, setTiers] = useState<TierData>({ S: [], A: [], B: [] });
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const unranked = GENRES.filter(
    (g) => !tiers.S.includes(g.id) && !tiers.A.includes(g.id) && !tiers.B.includes(g.id)
  );
  const rankedCount = tiers.S.length + tiers.A.length + tiers.B.length;

  function assignToTier(genreId: string, tier: TierKey) {
    setTiers((prev) => {
      const next = {
        S: prev.S.filter((id) => id !== genreId),
        A: prev.A.filter((id) => id !== genreId),
        B: prev.B.filter((id) => id !== genreId),
      };
      next[tier] = [...next[tier], genreId];
      return next;
    });
    setSelectedGenre(null);
  }

  function removeFromTier(genreId: string) {
    setTiers((prev) => ({
      S: prev.S.filter((id) => id !== genreId),
      A: prev.A.filter((id) => id !== genreId),
      B: prev.B.filter((id) => id !== genreId),
    }));
  }

  function handleSubmit() {
    setSubmitted(true);
    setTimeout(() => {
      router.push(`/groups/${id}/waiting`);
    }, 2000);
  }

  if (submitted) {
    return (
      <div
        style={{
          backgroundColor: "var(--bg)",
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 40,
          textAlign: "center",
        }}
      >
        <div
          className="animate-bounce-in"
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            backgroundColor: "rgba(107,122,82,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
            marginBottom: 20,
          }}
        >
          ✅
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
          回答完了！
        </div>
        <div style={{ fontSize: 15, color: "var(--text-secondary)" }}>
          待機室に移動します...
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh" }}>
      {/* Header */}
      <div style={{ padding: "56px 20px 0" }}>
        <Link
          href="/home"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--primary)",
            textDecoration: "none",
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          戻る
        </Link>
      </div>

      <div style={{ padding: "8px 20px 40px" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
          今日の気分は？ 🍽️
        </div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
          {groupName}
        </div>
        <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 24 }}>
          食べたいジャンルをティアに分けてください
        </div>

        {/* Location section */}
        <div
          style={{
            backgroundColor: "var(--surface)",
            borderRadius: 16,
            padding: 16,
            border: "1px solid var(--border-light)",
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
            📍 場所
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: anywhereOk ? 0 : 12,
              cursor: "pointer",
            }}
          >
            <div
              onClick={() => setAnywhereOk(!anywhereOk)}
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                border: `2px solid ${anywhereOk ? "var(--primary)" : "var(--border)"}`,
                backgroundColor: anywhereOk ? "var(--primary)" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                cursor: "pointer",
              }}
            >
              {anywhereOk && <span style={{ color: "white", fontSize: 13, fontWeight: 700 }}>✓</span>}
            </div>
            <span style={{ fontSize: 15, color: "var(--text-primary)" }}>
              場所はなんでもいい
            </span>
          </label>
          {!anywhereOk && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                value={departureStation}
                onChange={(e) => setDepartureStation(e.target.value)}
                placeholder="出発駅（例: 渋谷駅）"
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1.5px solid var(--border)",
                  fontSize: 15,
                  color: "var(--text-primary)",
                  backgroundColor: "var(--bg)",
                  outline: "none",
                  width: "100%",
                }}
              />
              <div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
                  希望エリア（任意）
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {AREAS.map((area) => (
                    <button
                      key={area}
                      onClick={() => setPreferredArea(preferredArea === area ? "" : area)}
                      className={`chip ${preferredArea === area ? "chip-selected" : ""}`}
                      style={{ fontSize: 13 }}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Genre pool */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10 }}>
            ジャンル一覧（タップしてティアに追加）
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {unranked.map((g) => (
              <button
                key={g.id}
                className="chip"
                onClick={() => setSelectedGenre(g.id)}
                style={{
                  backgroundColor: selectedGenre === g.id ? "rgba(196,85,42,0.1)" : "var(--surface)",
                  borderColor: selectedGenre === g.id ? "var(--primary)" : "var(--border)",
                  color: selectedGenre === g.id ? "var(--primary)" : "var(--text-primary)",
                  fontSize: 14,
                }}
              >
                {g.emoji} {g.name}
              </button>
            ))}
            {unranked.length === 0 && (
              <span style={{ fontSize: 14, color: "var(--text-tertiary)" }}>
                全てのジャンルをランク付けしました ✓
              </span>
            )}
          </div>
        </div>

        {/* Tier zones */}
        {(["S", "A", "B"] as TierKey[]).map((tier) => {
          const config = TIER_CONFIG[tier];
          const tierItems = tiers[tier];
          return (
            <div
              key={tier}
              style={{
                backgroundColor: "var(--surface)",
                borderRadius: 16,
                border: `2px ${tierItems.length === 0 ? "dashed" : "solid"} ${
                  tierItems.length === 0 ? "var(--border)" : config.color + "55"
                }`,
                padding: 14,
                marginBottom: 12,
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: tierItems.length > 0 ? 10 : 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: config.color + "20",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                    }}
                  >
                    {config.emoji}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: config.color }}>
                      {config.label}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                      {config.subtitle}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    backgroundColor: config.color + "20",
                    color: config.color,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "2px 10px",
                    borderRadius: 20,
                  }}
                >
                  {tierItems.length}件
                </div>
              </div>

              {tierItems.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {tierItems.map((id) => {
                    const g = GENRES.find((x) => x.id === id);
                    return g ? (
                      <button
                        key={id}
                        onClick={() => removeFromTier(id)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "6px 10px",
                          borderRadius: 20,
                          backgroundColor: config.color + "15",
                          border: `1px solid ${config.color}55`,
                          color: config.color,
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        {g.emoji} {g.name}
                        <span style={{ fontSize: 14, opacity: 0.6 }}>×</span>
                      </button>
                    ) : null;
                  })}
                </div>
              )}

              {selectedGenre && (
                <button
                  onClick={() => assignToTier(selectedGenre, tier)}
                  style={{
                    marginTop: tierItems.length > 0 ? 8 : 0,
                    width: "100%",
                    padding: "8px",
                    border: `1.5px dashed ${config.color}`,
                    borderRadius: 10,
                    backgroundColor: config.color + "08",
                    color: config.color,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  ＋ ここに追加
                </button>
              )}
            </div>
          );
        })}

        <div
          style={{
            fontSize: 14,
            color: "var(--text-secondary)",
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          {rankedCount}/{GENRES.length} ジャンルをランク付け済み
        </div>

        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={rankedCount === 0}
        >
          回答を送信する
        </button>
      </div>

      {/* Tier picker bottom sheet */}
      {selectedGenre && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "var(--surface)",
            borderRadius: "20px 20px 0 0",
            padding: "16px 20px 40px",
            boxShadow: "0 -4px 20px rgba(0,0,0,0.1)",
            zIndex: 50,
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <div style={{ width: 40, height: 4, backgroundColor: "var(--border)", borderRadius: 2 }} />
          </div>
          {(() => {
            const g = GENRES.find((x) => x.id === selectedGenre);
            return (
              <div style={{ marginBottom: 16, textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                  {g?.emoji} {g?.name}
                </div>
                <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                  どのティアに入れますか？
                </div>
              </div>
            );
          })()}
          <div style={{ display: "flex", gap: 10 }}>
            {(["S", "A", "B"] as TierKey[]).map((tier) => {
              const config = TIER_CONFIG[tier];
              return (
                <button
                  key={tier}
                  onClick={() => assignToTier(selectedGenre, tier)}
                  style={{
                    flex: 1,
                    padding: "14px 8px",
                    borderRadius: 14,
                    backgroundColor: config.color + "15",
                    border: `2px solid ${config.color}`,
                    color: config.color,
                    fontSize: 20,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {config.emoji}
                  <span style={{ fontSize: 15 }}>{tier}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>{config.subtitle}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setSelectedGenre(null)}
            style={{
              marginTop: 12,
              width: "100%",
              padding: "12px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-secondary)",
              fontSize: 15,
            }}
          >
            キャンセル
          </button>
        </div>
      )}
    </div>
  );
}
