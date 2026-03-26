"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GENRES, ALLERGIES, DIETARY_RESTRICTIONS } from "@/lib/mockData";
import type { TierData, TierKey } from "@/lib/types";

type Step = "name" | "members" | "survey" | "complete";

const TIER_CONFIG = {
  S: { label: "Tier S", emoji: "🔥", subtitle: "めっちゃ食べたい", color: "var(--primary)" },
  A: { label: "Tier A", emoji: "👍", subtitle: "食べたい", color: "var(--warning)" },
  B: { label: "Tier B", emoji: "😐", subtitle: "まぁいいよ", color: "var(--text-tertiary)" },
};

const AREAS = ["渋谷", "新宿", "池袋", "銀座", "六本木", "恵比寿", "表参道", "下北沢", "吉祥寺", "上野"];

export default function CreateGroupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("name");
  const [groupName, setGroupName] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [anywhereOk, setAnywhereOk] = useState(true);
  const [departureStation, setDepartureStation] = useState("");
  const [preferredArea, setPreferredArea] = useState("");
  const [tiers, setTiers] = useState<TierData>({ S: [], A: [], B: [] });
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

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

  function addMember() {
    const name = memberInput.trim();
    if (name && !members.includes(name)) {
      setMembers((prev) => [...prev, name]);
      setMemberInput("");
    }
  }

  function handleSubmitSurvey() {
    setStep("complete");
    // Navigate to waiting room after a moment
    setTimeout(() => {
      router.push("/groups/mock-new/waiting");
    }, 2000);
  }

  // ─── STEP: NAME ───
  if (step === "name") {
    return (
      <PageShell>
        <BackButton onClick={() => router.push("/home")} />
        <div style={{ padding: "16px 20px 40px" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>
            グループを作ろう 🎉
          </div>
          <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 32 }}>
            メンバーの好みを合わせて、みんながハッピーなお店を見つけましょう
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>
              グループ名
            </label>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="例: ゼミ飲み会"
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 14,
                border: "1.5px solid var(--border)",
                fontSize: 16,
                color: "var(--text-primary)",
                backgroundColor: "var(--surface)",
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
          </div>

          <div
            style={{
              backgroundColor: "var(--bg-secondary)",
              borderRadius: 14,
              padding: 16,
              marginBottom: 32,
              fontSize: 14,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            📍 場所・予算はアンケートで最適化されます
          </div>

          <button
            className="btn-primary"
            onClick={() => setStep("members")}
            disabled={!groupName.trim()}
          >
            次へ
          </button>
        </div>
      </PageShell>
    );
  }

  // ─── STEP: MEMBERS ───
  if (step === "members") {
    return (
      <PageShell>
        <BackButton onClick={() => setStep("name")} />
        <div style={{ padding: "16px 20px 40px" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>
            メンバーを追加 👥
          </div>
          <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 24 }}>
            一緒に行くメンバーを追加してください
          </div>

          {/* Added members */}
          {members.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {members.map((name) => (
                <div
                  key={name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: "rgba(196,85,42,0.1)",
                    border: "1px solid var(--primary)",
                    borderRadius: 20,
                    padding: "6px 12px",
                    fontSize: 14,
                    color: "var(--primary)",
                    fontWeight: 600,
                  }}
                >
                  {name}
                  <button
                    onClick={() => setMembers((p) => p.filter((m) => m !== name))}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--primary)",
                      padding: 0,
                      fontSize: 16,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add member input */}
          <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
            <input
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMember()}
              placeholder="名前を入力"
              style={{
                flex: 1,
                padding: "14px 16px",
                borderRadius: 14,
                border: "1.5px solid var(--border)",
                fontSize: 16,
                color: "var(--text-primary)",
                backgroundColor: "var(--surface)",
                outline: "none",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
            <button
              onClick={addMember}
              disabled={!memberInput.trim()}
              style={{
                padding: "0 20px",
                borderRadius: 14,
                backgroundColor: "var(--primary)",
                color: "white",
                fontWeight: 600,
                fontSize: 15,
                border: "none",
                cursor: "pointer",
                flexShrink: 0,
                opacity: !memberInput.trim() ? 0.4 : 1,
              }}
            >
              追加
            </button>
          </div>

          {/* Invite link */}
          <div
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: 14,
              padding: 16,
              border: "1px solid var(--border-light)",
              marginBottom: 32,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
              🔗 招待リンクを共有
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
              リンクを共有してメンバーを招待できます
            </div>
            <button
              className="btn-secondary"
              style={{ height: 42, fontSize: 14 }}
              onClick={() => alert("リンクをコピーしました！（デモ）")}
            >
              リンクをコピー
            </button>
          </div>

          <button
            className="btn-primary"
            onClick={() => setStep("survey")}
          >
            次へ（アンケートに回答する）
          </button>
        </div>
      </PageShell>
    );
  }

  // ─── STEP: SURVEY ───
  if (step === "survey") {
    return (
      <PageShell>
        <BackButton onClick={() => setStep("members")} />
        <div style={{ padding: "16px 20px 40px" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>
            今日の気分は？ 🍽️
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
                  onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
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
                    backgroundColor:
                      selectedGenre === g.id ? "rgba(196,85,42,0.1)" : "var(--surface)",
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

          {/* Tier pickers */}
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
                {/* Tier header */}
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

                {/* Items in tier */}
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

                {/* Add button when genre is selected */}
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

          {/* Progress */}
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
            onClick={handleSubmitSurvey}
            disabled={rankedCount === 0}
          >
            回答を送信する
          </button>
        </div>

        {/* Tier picker overlay (when genre selected) */}
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
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", textAlign: "center" }}>
                    {g?.emoji} {g?.name}
                  </div>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)", textAlign: "center", marginTop: 4 }}>
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
      </PageShell>
    );
  }

  // ─── STEP: COMPLETE ───
  return (
    <PageShell>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "80dvh",
          padding: 40,
          textAlign: "center",
        }}
      >
        <div
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
          className="animate-bounce-in"
        >
          ✅
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
          回答完了！
        </div>
        <div style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          みんなの回答を待っています。<br />
          全員が回答したらお店を検索します。
        </div>
        <div
          style={{
            marginTop: 24,
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--text-tertiary)",
            fontSize: 14,
          }}
        >
          <div className="animate-spin-slow" style={{ fontSize: 16 }}>⏳</div>
          待機室に移動中...
        </div>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh" }}>
      {children}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <div style={{ padding: "56px 20px 0" }}>
      <button
        onClick={onClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--primary)",
          fontSize: 16,
          fontWeight: 600,
          padding: 0,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        戻る
      </button>
    </div>
  );
}
