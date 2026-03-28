"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MOCK_GROUPS, GENRES } from "@/lib/mockData";
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

const SUBMIT_MESSAGES = [
  "回答を送信中...",
  "グループに参加中...",
  "メンバーに通知中...",
  "準備完了！",
];

const JOINED_KEY = "meshimatch-joined-groups";

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
function TierZone({ tier, config, items }: { tier: TierKey; config: (typeof TIER_CONFIG)[TierKey]; items: string[] }) {
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: items.length > 0 ? 10 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: config.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
            {config.emoji}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: config.color }}>{config.label}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{config.subtitle}</div>
          </div>
        </div>
        <div style={{ backgroundColor: config.color + "20", color: config.color, fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>
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

// ---- Submitting animation screen ----
function SubmittingScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 0.02;
        if (next >= 1) {
          clearInterval(interval);
          setTimeout(onDone, 400);
          return 1;
        }
        return next;
      });
    }, 60);

    const msgInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % SUBMIT_MESSAGES.length);
    }, 900);

    return () => {
      clearInterval(interval);
      clearInterval(msgInterval);
    };
  }, [onDone]);

  const percent = Math.round(progress * 100);

  return (
    <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, textAlign: "center" }}>
      <div style={{ position: "relative", marginBottom: 40 }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse-ring"
            style={{
              position: "absolute",
              inset: -(i * 20),
              borderRadius: "50%",
              border: `2px solid var(--primary)`,
              opacity: 0.3 / i,
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
        <div
          className="animate-spin-slow"
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            backgroundColor: "rgba(196,85,42,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <span style={{ fontSize: 36 }}>🍽️</span>
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 280, marginBottom: 24 }}>
        <div style={{ height: 6, backgroundColor: "var(--border-light)", borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
          <div
            style={{
              height: "100%",
              width: `${percent}%`,
              backgroundColor: "var(--primary)",
              borderRadius: 6,
              transition: "width 0.1s linear",
            }}
          />
        </div>
        <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{percent}%</div>
      </div>

      <div
        key={messageIndex}
        className="animate-fade-in"
        style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}
      >
        {SUBMIT_MESSAGES[messageIndex]}
      </div>
      <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
        グループへの参加を処理しています
      </div>
    </div>
  );
}

// ---- Main page ----
export default function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const group = MOCK_GROUPS.find((g) => g.id === id);
  const groupName = group?.name ?? "グループ";

  const [preferredAreas, setPreferredAreas] = useState<string[]>([]);
  const [tiers, setTiers] = useState<TierData>({ S: [], A: [], B: [] });
  const [activeGenreId, setActiveGenreId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
  );

  const unranked = GENRES.filter(
    (g) => !tiers.S.includes(g.id) && !tiers.A.includes(g.id) && !tiers.B.includes(g.id)
  );
  const rankedCount = tiers.S.length + tiers.A.length + tiers.B.length;
  const activeGenre = activeGenreId ? GENRES.find((x) => x.id === activeGenreId) : null;

  function toggleArea(area: string) {
    setPreferredAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
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
        S: prev.S.filter((x) => x !== genreId),
        A: prev.A.filter((x) => x !== genreId),
        B: prev.B.filter((x) => x !== genreId),
      }));
    } else if (["S", "A", "B"].includes(dest)) {
      setTiers((prev) => {
        const next = {
          S: prev.S.filter((x) => x !== genreId),
          A: prev.A.filter((x) => x !== genreId),
          B: prev.B.filter((x) => x !== genreId),
        };
        next[dest as TierKey] = [...next[dest as TierKey], genreId];
        return next;
      });
    }
  }

  function handleSubmit() {
    try {
      const joined: string[] = JSON.parse(localStorage.getItem(JOINED_KEY) ?? "[]");
      if (!joined.includes(id)) {
        localStorage.setItem(JOINED_KEY, JSON.stringify([...joined, id]));
      }
    } catch { /* ignore */ }
    setSubmitted(true);
  }

  if (submitted) {
    return <SubmittingScreen onDone={() => router.push("/home")} />;
  }

  return (
    <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh" }}>
      <div style={{ padding: "56px 20px 0" }}>
        <Link href="/home" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--primary)", textDecoration: "none", fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
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
        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
          {groupName} · ジャンルをドラッグしてティアに分けてください
        </div>

        {/* 希望エリア（複数選択） */}
        <div style={{ backgroundColor: "var(--surface)", borderRadius: 16, padding: 16, border: "1px solid var(--border-light)", marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>📍 希望エリア</div>
          <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 12 }}>複数選択OK・未選択の場合はどこでもOK</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {AREAS.map((area) => (
              <button
                key={area}
                onClick={() => toggleArea(area)}
                className={`chip ${preferredAreas.includes(area) ? "chip-selected" : ""}`}
                style={{ fontSize: 13 }}
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        {/* DnD エリア */}
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
              ジャンル一覧
            </div>
            <UnrankedPool unranked={unranked} />
          </div>

          {(["S", "A", "B"] as TierKey[]).map((tier) => (
            <TierZone key={tier} tier={tier} config={TIER_CONFIG[tier]} items={tiers[tier]} />
          ))}

          <DragOverlay dropAnimation={null}>
            {activeGenre && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "8px 14px", borderRadius: 20, backgroundColor: "var(--primary)", color: "white", fontSize: 14, fontWeight: 600, boxShadow: "0 8px 24px rgba(196,85,42,0.4)", cursor: "grabbing", userSelect: "none" }}>
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
      </div>
    </div>
  );
}
