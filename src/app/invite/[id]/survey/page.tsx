"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MOCK_GROUPS, GENRES, ALLERGIES, DIETARY_RESTRICTIONS } from "@/lib/mockData";
import type { TierData, TierKey } from "@/lib/types";
import type { Genre } from "@/lib/types";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

const TIER_CONFIG = {
  S: { label: "Tier S", emoji: "🔥", subtitle: "めっちゃ食べたい", color: "var(--primary)" },
  A: { label: "Tier A", emoji: "👍", subtitle: "食べたい", color: "var(--warning)" },
  B: { label: "Tier B", emoji: "😐", subtitle: "まぁいいよ", color: "var(--text-tertiary)" },
};

const AREAS = ["渋谷", "新宿", "池袋", "銀座", "六本木", "恵比寿", "表参道", "下北沢", "吉祥寺", "上野"];
const STORAGE_KEY = "meshimatch-guest-prefs";

type Step = "name" | "restrictions" | "survey" | "done";

interface GuestPrefs {
  allergies: string[];
  dietaryRestrictions: string[];
}

// ---- Draggable genre chip ----
function GenreChip({ genre, color, size = "md" }: { genre: Genre; color?: string; size?: "sm" | "md" }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: genre.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: size === "sm" ? "6px 10px" : "8px 14px",
        borderRadius: 20,
        backgroundColor: color ? color + "15" : "var(--surface)",
        border: `1.5px solid ${color ? color + "55" : "var(--border)"}`,
        color: color ?? "var(--text-primary)",
        fontSize: size === "sm" ? 13 : 14,
        fontWeight: color ? 500 : 400,
        cursor: isDragging ? "grabbing" : "grab",
        opacity: isDragging ? 0.3 : 1,
        transform: CSS.Translate.toString(transform),
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {genre.emoji} {genre.name}
    </div>
  );
}

// ---- Droppable unranked pool ----
function UnrankedPool({ unranked }: { unranked: Genre[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: "unranked" });

  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight: 56,
        borderRadius: 12,
        padding: "8px 4px",
        backgroundColor: isOver ? "rgba(196,85,42,0.05)" : "transparent",
        border: isOver ? "2px dashed var(--primary)" : "2px dashed transparent",
        transition: "all 0.15s ease",
      }}
    >
      {unranked.length === 0 ? (
        <span style={{ fontSize: 14, color: "var(--text-tertiary)" }}>
          全てのジャンルをランク付けしました ✓
        </span>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {unranked.map((g) => (
            <GenreChip key={g.id} genre={g} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Droppable tier zone ----
function TierZone({
  tier,
  config,
  items,
}: {
  tier: TierKey;
  config: (typeof TIER_CONFIG)[TierKey];
  items: string[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: tier });

  return (
    <div
      ref={setNodeRef}
      style={{
        borderRadius: 16,
        border: `2px ${items.length === 0 && !isOver ? "dashed" : "solid"} ${
          isOver ? config.color : items.length === 0 ? "var(--border)" : config.color + "55"
        }`,
        padding: 14,
        marginBottom: 12,
        minHeight: 80,
        transition: "all 0.15s ease",
        backgroundColor: isOver ? config.color + "08" : "var(--surface)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: items.length > 0 ? 10 : 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: config.color + "20",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            }}
          >
            {config.emoji}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: config.color }}>{config.label}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{config.subtitle}</div>
          </div>
        </div>
        <div
          style={{
            backgroundColor: config.color + "20",
            color: config.color,
            fontSize: 12, fontWeight: 700,
            padding: "2px 10px", borderRadius: 20,
          }}
        >
          {items.length}件
        </div>
      </div>

      {items.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {items.map((id) => {
            const g = GENRES.find((x) => x.id === id);
            return g ? <GenreChip key={id} genre={g} color={config.color} size="sm" /> : null;
          })}
        </div>
      ) : (
        <div style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: 13, paddingTop: 2 }}>
          ここにドラッグ
        </div>
      )}
    </div>
  );
}

// ---- Main page ----
export default function GuestSurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const group = MOCK_GROUPS.find((g) => g.id === id);
  const groupName = group?.name ?? "グループ";

  const [step, setStep] = useState<Step>("name");
  const [guestName, setGuestName] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);

  const [anywhereOk, setAnywhereOk] = useState(true);
  const [departureStation, setDepartureStation] = useState("");
  const [preferredArea, setPreferredArea] = useState("");
  const [tiers, setTiers] = useState<TierData>({ S: [], A: [], B: [] });
  const [activeGenreId, setActiveGenreId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
  );

  // localStorageから前回の設定を読み込む
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const prefs: GuestPrefs = JSON.parse(saved);
        setAllergies(prefs.allergies ?? []);
        setDietaryRestrictions(prefs.dietaryRestrictions ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  function savePrefs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ allergies, dietaryRestrictions }));
    } catch { /* ignore */ }
  }

  function toggleAllergy(id: string) {
    setAllergies((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function toggleDietary(id: string) {
    setDietaryRestrictions((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveGenreId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveGenreId(null);
    if (!over) return;

    const genreId = active.id as string;
    const dest = over.id as string;

    if (dest === "unranked") {
      setTiers((prev) => ({
        S: prev.S.filter((id) => id !== genreId),
        A: prev.A.filter((id) => id !== genreId),
        B: prev.B.filter((id) => id !== genreId),
      }));
    } else if (["S", "A", "B"].includes(dest)) {
      setTiers((prev) => {
        const next = {
          S: prev.S.filter((id) => id !== genreId),
          A: prev.A.filter((id) => id !== genreId),
          B: prev.B.filter((id) => id !== genreId),
        };
        next[dest as TierKey] = [...next[dest as TierKey], genreId];
        return next;
      });
    }
  }

  function handleSubmit() {
    savePrefs();
    setStep("done");
    setTimeout(() => router.push(`/groups/${id}/waiting`), 2500);
  }

  const unranked = GENRES.filter(
    (g) => !tiers.S.includes(g.id) && !tiers.A.includes(g.id) && !tiers.B.includes(g.id)
  );
  const rankedCount = tiers.S.length + tiers.A.length + tiers.B.length;
  const activeGenre = activeGenreId ? GENRES.find((x) => x.id === activeGenreId) : null;

  // ---- DONE ----
  if (step === "done") {
    return (
      <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, textAlign: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", backgroundColor: "rgba(107,122,82,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 20 }}>
          ✅
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
          {guestName}さん、回答完了！
        </div>
        <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 8 }}>
          次回はアレルギー・食の制限が自動で入力されます
        </div>
        <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>待機室に移動します...</div>
      </div>
    );
  }

  // ---- STEP: NAME ----
  if (step === "name") {
    return (
      <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh", padding: "60px 24px 40px" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 4 }}>{groupName}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
            はじめまして！👋
          </div>
          <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 32 }}>
            グループのみんなに表示される名前を教えてください
          </div>

          <div style={{ backgroundColor: "var(--surface)", borderRadius: 20, padding: 24, border: "1px solid var(--border-light)" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10 }}>ニックネーム</div>
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="例：たろう"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && guestName.trim() && setStep("restrictions")}
              style={{
                width: "100%", padding: "14px 16px", borderRadius: 14,
                border: "1.5px solid var(--border)", fontSize: 16,
                color: "var(--text-primary)", backgroundColor: "var(--bg)", outline: "none", marginBottom: 4,
              }}
            />
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 20 }}>
              ※ アカウント登録は不要です
            </div>

            <button
              className="btn-primary"
              onClick={() => setStep("restrictions")}
              disabled={guestName.trim().length === 0}
              style={{ width: "100%" }}
            >
              次へ →
            </button>
          </div>

          <StepDots current="name" />
        </div>
      </div>
    );
  }

  // ---- STEP: RESTRICTIONS ----
  if (step === "restrictions") {
    return (
      <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh", padding: "60px 24px 40px" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <BackButton onClick={() => setStep("name")} />

          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
            食の制限・アレルギー 🚫
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>{guestName}さん</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
            該当するものを選んでください。次回から自動で入力されます。
          </div>

          {/* アレルギー */}
          <div style={{ backgroundColor: "var(--surface)", borderRadius: 20, padding: "20px", border: "1px solid var(--border-light)", marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>🤧 アレルギー</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ALLERGIES.map((a) => {
                const selected = allergies.includes(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleAllergy(a.id)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "8px 14px", borderRadius: 20, fontSize: 14,
                      cursor: "pointer",
                      backgroundColor: selected ? "rgba(196,85,42,0.12)" : "var(--bg)",
                      border: `1.5px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                      color: selected ? "var(--primary)" : "var(--text-primary)",
                      fontWeight: selected ? 600 : 400,
                    }}
                  >
                    {a.emoji} {a.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 食の制限 */}
          <div style={{ backgroundColor: "var(--surface)", borderRadius: 20, padding: "20px", border: "1px solid var(--border-light)", marginBottom: 28 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>🥗 食の制限</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {DIETARY_RESTRICTIONS.map((d) => {
                const selected = dietaryRestrictions.includes(d.id);
                return (
                  <button
                    key={d.id}
                    onClick={() => toggleDietary(d.id)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "8px 14px", borderRadius: 20, fontSize: 14,
                      cursor: "pointer",
                      backgroundColor: selected ? "rgba(196,85,42,0.12)" : "var(--bg)",
                      border: `1.5px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                      color: selected ? "var(--primary)" : "var(--text-primary)",
                      fontWeight: selected ? 600 : 400,
                    }}
                  >
                    {d.emoji} {d.name}
                  </button>
                );
              })}
            </div>
          </div>

          <button className="btn-primary" onClick={() => setStep("survey")} style={{ width: "100%" }}>
            次へ（ジャンル選択）→
          </button>
          <button
            onClick={() => setStep("survey")}
            style={{ width: "100%", marginTop: 10, padding: "12px", background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 14 }}
          >
            特になし・スキップ
          </button>

          <StepDots current="restrictions" />
        </div>
      </div>
    );
  }

  // ---- STEP: SURVEY (DnD ティア選択) ----
  return (
    <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh" }}>
      <div style={{ padding: "56px 20px 0" }}>
        <BackButton onClick={() => setStep("restrictions")} />
      </div>

      <div style={{ padding: "8px 20px 40px" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
          今日の気分は？ 🍽️
        </div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
          {guestName}さん・{groupName}
        </div>

        {/* アレルギー・制限サマリー */}
        {(allergies.length > 0 || dietaryRestrictions.length > 0) && (
          <div style={{ backgroundColor: "rgba(196,85,42,0.06)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>除外:</span>
            {allergies.map((aId) => {
              const a = ALLERGIES.find((x) => x.id === aId);
              return a ? <span key={aId} style={{ fontSize: 12, color: "var(--text-secondary)" }}>{a.emoji} {a.name}</span> : null;
            })}
            {dietaryRestrictions.map((dId) => {
              const d = DIETARY_RESTRICTIONS.find((x) => x.id === dId);
              return d ? <span key={dId} style={{ fontSize: 12, color: "var(--text-secondary)" }}>{d.emoji} {d.name}</span> : null;
            })}
          </div>
        )}

        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
          ジャンルをドラッグしてティアに分けてください
        </div>

        {/* 場所 */}
        <div style={{ backgroundColor: "var(--surface)", borderRadius: 16, padding: 16, border: "1px solid var(--border-light)", marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>📍 希望エリア</div>
          <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 12 }}>未選択の場合はどこでもOK</div>
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

        {/* DnD エリア */}
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {/* ジャンル一覧 */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
              ジャンル一覧
            </div>
            <UnrankedPool unranked={unranked} />
          </div>

          {/* ティアゾーン */}
          {(["S", "A", "B"] as TierKey[]).map((tier) => (
            <TierZone key={tier} tier={tier} config={TIER_CONFIG[tier]} items={tiers[tier]} />
          ))}

          {/* ドラッグ中のオーバーレイ */}
          <DragOverlay dropAnimation={null}>
            {activeGenre && (
              <div
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "8px 14px", borderRadius: 20,
                  backgroundColor: "var(--primary)", color: "white",
                  fontSize: 14, fontWeight: 600,
                  boxShadow: "0 8px 24px rgba(196,85,42,0.4)",
                  cursor: "grabbing",
                  userSelect: "none",
                }}
              >
                {activeGenre.emoji} {activeGenre.name}
              </div>
            )}
          </DragOverlay>
        </DndContext>

        <div style={{ fontSize: 14, color: "var(--text-secondary)", textAlign: "center", marginBottom: 24 }}>
          {rankedCount}/{GENRES.length} ジャンルをランク付け済み
        </div>

        <button className="btn-primary" onClick={handleSubmit} disabled={rankedCount === 0}>
          回答を送信する
        </button>

        <StepDots current="survey" />
      </div>
    </div>
  );
}

// ---- 共通パーツ ----
function StepDots({ current }: { current: Step }) {
  const steps: Step[] = ["name", "restrictions", "survey"];
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 24 }}>
      {steps.map((s) => (
        <div
          key={s}
          style={{
            width: s === current ? 24 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: "var(--primary)",
            opacity: s === current ? 1 : steps.indexOf(s) < steps.indexOf(current) ? 0.4 : 0.2,
            transition: "all 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        color: "var(--primary)", background: "none", border: "none",
        fontSize: 16, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 16,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      戻る
    </button>
  );
}
