"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
  ALLERGIES,
  DIETARY_RESTRICTIONS,
  GENRES,
} from "@/lib/mockData";
import { useUser } from "@/lib/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import type {
  Genre,
  GenrePreferenceBucketData,
  GenrePreferenceBucketKey,
} from "@/lib/types";

const AREAS = [
  "渋谷",
  "新宿",
  "池袋",
  "銀座",
  "六本木",
  "恵比寿",
  "表参道",
  "下北沢",
  "吉祥寺",
  "上野",
];

function buildGenrePreferences(buckets: GenrePreferenceBucketData) {
  return [
    ...buckets.prioritize.map((genreId) => ({
      genreId,
      priority: "prefer" as const,
    })),
    ...buckets.nice_to_have.map((genreId) => ({
      genreId,
      priority: "optional" as const,
    })),
    ...buckets.open_to_it.map((genreId) => ({
      genreId,
      priority: "optional" as const,
    })),
  ];
}

function GenreChip({
  genre,
  color,
  size = "md",
}: {
  genre: Genre;
  color?: string;
  size?: "sm" | "md";
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: genre.id });

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

function UnrankedPool({
  unranked,
  allRankedText,
}: {
  unranked: Genre[];
  allRankedText: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "unranked" });

  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight: 56,
        borderRadius: 12,
        padding: "8px 4px",
        backgroundColor: isOver ? "rgba(204,119,85,0.05)" : "transparent",
        border: isOver ? "2px dashed var(--primary)" : "2px dashed transparent",
        transition: "all 0.15s ease",
      }}
    >
      {unranked.length === 0 ? (
        <span style={{ fontSize: 14, color: "var(--text-tertiary)" }}>
          {allRankedText}
        </span>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {unranked.map((genre) => (
            <GenreChip key={genre.id} genre={genre} />
          ))}
        </div>
      )}
    </div>
  );
}

function PreferenceBucketZone({
  bucketKey,
  label,
  subtitle,
  color,
  items,
}: {
  bucketKey: GenrePreferenceBucketKey;
  label: string;
  subtitle: string;
  color: string;
  items: string[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: bucketKey });

  return (
    <div
      ref={setNodeRef}
      style={{
        borderRadius: 16,
        border: `2px ${items.length === 0 && !isOver ? "dashed" : "solid"} ${
          isOver ? color : items.length === 0 ? "var(--border)" : color + "55"
        }`,
        padding: 14,
        marginBottom: 12,
        minHeight: 80,
        transition: "all 0.15s ease",
        backgroundColor: isOver ? color + "08" : "var(--surface)",
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
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: color + "20",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color }}>{label}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              {subtitle}
            </div>
          </div>
        </div>
        <div
          style={{
            backgroundColor: color + "20",
            color,
            fontSize: 12,
            fontWeight: 700,
            padding: "2px 10px",
            borderRadius: 20,
          }}
        >
          {items.length}件
        </div>
      </div>

      {items.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {items.map((id) => {
            const genre = GENRES.find((item) => item.id === id);
            return genre ? (
              <GenreChip key={id} genre={genre} color={color} size="sm" />
            ) : null;
          })}
        </div>
      ) : (
        <div
          style={{
            textAlign: "center",
            color: "var(--text-tertiary)",
            fontSize: 13,
            paddingTop: 2,
          }}
        >
          ここにドラッグ
        </div>
      )}
    </div>
  );
}

function SubmittingScreen({
  onDone,
  messages,
  processingText,
}: {
  onDone: () => void;
  messages: string[];
  processingText: string;
}) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setProgress((previous) => {
        const next = previous + 0.02;
        if (next >= 1) {
          window.clearInterval(interval);
          window.setTimeout(onDone, 400);
          return 1;
        }
        return next;
      });
    }, 60);

    const messageInterval = window.setInterval(() => {
      setMessageIndex((previous) => (previous + 1) % messages.length);
    }, 900);

    return () => {
      window.clearInterval(interval);
      window.clearInterval(messageInterval);
    };
  }, [messages.length, onDone]);

  const percent = Math.round(progress * 100);

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
      <div style={{ position: "relative", marginBottom: 40 }}>
        {[1, 2, 3].map((index) => (
          <div
            key={index}
            className="animate-pulse-ring"
            style={{
              position: "absolute",
              inset: -(index * 20),
              borderRadius: "50%",
              border: "2px solid var(--primary)",
              opacity: 0.3 / index,
              animationDelay: `${index * 0.3}s`,
            }}
          />
        ))}
        <div
          className="animate-spin-slow"
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            backgroundColor: "rgba(204,119,85,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              border: "4px solid var(--border-light)",
              borderTop: "4px solid var(--primary)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 280, marginBottom: 24 }}>
        <div
          style={{
            height: 6,
            backgroundColor: "var(--border-light)",
            borderRadius: 6,
            overflow: "hidden",
            marginBottom: 12,
          }}
        >
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
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 8,
        }}
      >
        {messages[messageIndex]}
      </div>
      <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
        {processingText}
      </div>
    </div>
  );
}

export default function SurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: groupId } = use(params);
  const router = useRouter();
  const { t, locale } = useLocale();
  const { user, userId } = useUser();
  const [groupName, setGroupName] = useState("グループ");
  const [departureArea, setDepartureArea] = useState("");
  const [departureStation, setDepartureStation] = useState("");
  const [preferredAreas, setPreferredAreas] = useState<string[]>([]);
  const [budgetIdealYen, setBudgetIdealYen] = useState("");
  const [budgetMaxYen, setBudgetMaxYen] = useState("");
  const [preferenceBuckets, setPreferenceBuckets] =
    useState<GenrePreferenceBucketData>({
      prioritize: [],
      nice_to_have: [],
      open_to_it: [],
    });
  const [activeGenreId, setActiveGenreId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function fetchGroup() {
      const supabase = createClient();
      const { data } = await supabase
        .from("groups")
        .select("name")
        .eq("id", groupId)
        .single();

      if (data) {
        setGroupName(data.name);
      }
    }

    void fetchGroup();
  }, [groupId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 100, tolerance: 5 },
    })
  );

  const bucketConfig = {
    prioritize: {
      label: locale === "en" ? "Prioritize" : "優先したい",
      subtitle: locale === "en" ? "Show these first" : "まず候補に入れたい",
      color: "var(--primary)",
    },
    nice_to_have: {
      label: locale === "en" ? "Nice to have" : "あればうれしい",
      subtitle: locale === "en" ? "Would be nice to include" : "合うなら入れたい",
      color: "var(--warning)",
    },
    open_to_it: {
      label: locale === "en" ? "Open to it" : "候補に入ってOK",
      subtitle: locale === "en" ? "Fine as one of the options" : "選択肢に入っていて大丈夫",
      color: "var(--text-tertiary)",
    },
  } as const;

  const submitMessages = [
    t("survey.submitting0"),
    t("survey.submitting1"),
    t("survey.submitting2"),
    t("survey.submitting3"),
  ];

  const unranked = GENRES.filter(
    (genre) =>
      !preferenceBuckets.prioritize.includes(genre.id) &&
      !preferenceBuckets.nice_to_have.includes(genre.id) &&
      !preferenceBuckets.open_to_it.includes(genre.id)
  );
  const rankedCount =
    preferenceBuckets.prioritize.length +
    preferenceBuckets.nice_to_have.length +
    preferenceBuckets.open_to_it.length;
  const activeGenre = activeGenreId
    ? GENRES.find((genre) => genre.id === activeGenreId)
    : null;

  const dietaryNoteLabels = [
    ...(user?.allergies ?? []).map(
      (id) => ALLERGIES.find((allergy) => allergy.id === id)?.name ?? id
    ),
    ...((user?.dietaryRestrictions ?? []).map(
      (restriction) =>
        DIETARY_RESTRICTIONS.find(
          (item) => item.id === restriction.restrictionId
        )?.name ?? restriction.restrictionId
    ) ?? []),
  ];

  function toggleArea(area: string) {
    setPreferredAreas((current) =>
      current.includes(area)
        ? current.filter((item) => item !== area)
        : [...current, area]
    );
  }

  function toggleDepartureArea(area: string) {
    setDepartureArea((current) => (current === area ? "" : area));
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveGenreId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveGenreId(null);
    if (!over) {
      return;
    }

    const genreId = active.id as string;
    const destination = over.id as string;

    if (destination === "unranked") {
      setPreferenceBuckets((previous) => ({
        prioritize: previous.prioritize.filter((id) => id !== genreId),
        nice_to_have: previous.nice_to_have.filter((id) => id !== genreId),
        open_to_it: previous.open_to_it.filter((id) => id !== genreId),
      }));
      return;
    }

    if (["prioritize", "nice_to_have", "open_to_it"].includes(destination)) {
      setPreferenceBuckets((previous) => {
        const next = {
          prioritize: previous.prioritize.filter((id) => id !== genreId),
          nice_to_have: previous.nice_to_have.filter((id) => id !== genreId),
          open_to_it: previous.open_to_it.filter((id) => id !== genreId),
        };
        next[destination as GenrePreferenceBucketKey] = [
          ...next[destination as GenrePreferenceBucketKey],
          genreId,
        ];
        return next;
      });
    }
  }

  async function handleSubmit() {
    if (!userId) {
      return;
    }

    setSubmitted(true);

    try {
      const supabase = createClient();
      const { data: existingMember } = await supabase
        .from("group_members")
        .select("id")
        .eq("group_id", groupId)
        .eq("profile_id", userId)
        .maybeSingle();

      let memberId = existingMember?.id;
      if (!memberId) {
        const { data: newMember } = await supabase
          .from("group_members")
          .insert({
            group_id: groupId,
            profile_id: userId,
            display_name: user?.displayName ?? "メンバー",
            role: "member",
          })
          .select("id")
          .single();
        memberId = newMember?.id;
      }

      if (!memberId) {
        setSubmitted(false);
        return;
      }

      await supabase.from("survey_responses").upsert(
        {
          group_id: groupId,
          member_id: memberId,
          response_version: 2,
          departure_area: departureArea || null,
          departure_station: departureStation || null,
          preferred_areas: preferredAreas,
          budget_ideal_yen: budgetIdealYen ? Number(budgetIdealYen) : null,
          budget_max_yen: budgetMaxYen ? Number(budgetMaxYen) : null,
          budget_priority: "prefer",
          genre_preferences: buildGenrePreferences(preferenceBuckets),
          dietary_restrictions: user?.dietaryRestrictions ?? [],
        },
        { onConflict: "group_id,member_id" }
      );

      await supabase
        .from("group_members")
        .update({ has_survey: true })
        .eq("id", memberId);
    } catch (error) {
      console.error("Survey submission error:", error);
      setSubmitted(false);
    }
  }

  if (submitted) {
    return (
      <SubmittingScreen
        onDone={() => router.push(`/groups/${groupId}/waiting`)}
        messages={submitMessages}
        processingText={t("survey.processingGroup")}
      />
    );
  }

  return (
    <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh" }}>
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
          {t("common.back")}
        </Link>
      </div>

      <div style={{ padding: "8px 20px 40px" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
          参加条件を教えてください
        </div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
          {groupName} の候補づくりに使います。空欄は「特に希望なし」として扱います。
        </div>

        <div
          style={{
            backgroundColor: "var(--surface)",
            borderRadius: 16,
            padding: 16,
            border: "1px solid var(--border-light)",
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            集まりやすい場所
          </div>
          <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 12 }}>
            出発エリア、希望エリア、最寄り駅があれば入力してください
          </div>
          <input
            value={departureStation}
            onChange={(event) => setDepartureStation(event.target.value)}
            placeholder="例: 渋谷駅"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1.5px solid var(--border)",
              fontSize: 15,
              color: "var(--text-primary)",
              backgroundColor: "var(--bg)",
              outline: "none",
              marginBottom: 12,
            }}
          />
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
            出発エリア
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {AREAS.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => toggleDepartureArea(area)}
                className={`chip ${departureArea === area ? "chip-selected" : ""}`}
                style={{ fontSize: 13 }}
              >
                {area}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
            希望エリア
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {AREAS.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => toggleArea(area)}
                className={`chip ${preferredAreas.includes(area) ? "chip-selected" : ""}`}
                style={{ fontSize: 13 }}
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            backgroundColor: "var(--surface)",
            borderRadius: 16,
            padding: 16,
            border: "1px solid var(--border-light)",
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            予算範囲
          </div>
          <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 12 }}>
            だいたいの目安と、超えたくない上限があれば入力してください
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input
              inputMode="numeric"
              value={budgetIdealYen}
              onChange={(event) =>
                setBudgetIdealYen(event.target.value.replace(/[^\d]/g, ""))
              }
              placeholder="目安 3500"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: "1.5px solid var(--border)",
                fontSize: 15,
                color: "var(--text-primary)",
                backgroundColor: "var(--bg)",
                outline: "none",
              }}
            />
            <input
              inputMode="numeric"
              value={budgetMaxYen}
              onChange={(event) =>
                setBudgetMaxYen(event.target.value.replace(/[^\d]/g, ""))
              }
              placeholder="上限 5000"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: "1.5px solid var(--border)",
                fontSize: 15,
                color: "var(--text-primary)",
                backgroundColor: "var(--bg)",
                outline: "none",
              }}
            />
          </div>
        </div>

        <div
          style={{
            backgroundColor: "var(--surface)",
            borderRadius: 16,
            padding: 16,
            border: "1px solid var(--border-light)",
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            食事制限・アレルギー
          </div>
          <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 10 }}>
            ここで共有された内容は幹事メモとして表示されます。候補の並び替えには使いません。
          </div>
          {dietaryNoteLabels.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {dietaryNoteLabels.map((label) => (
                <span
                  key={label}
                  style={{
                    fontSize: 12,
                    backgroundColor: "rgba(194,106,74,0.08)",
                    color: "var(--primary)",
                    borderRadius: 100,
                    padding: "4px 10px",
                    fontWeight: 600,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              プロフィールに未設定です。必要ならプロフィール画面から更新できます。
            </div>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          ジャンルの気分
        </div>
        <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 12 }}>
            ここも空でOKです。希望があるときだけ、近い強さの箱へ分けてください。
        </div>
        </div>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
              ジャンル一覧
            </div>
            <UnrankedPool unranked={unranked} allRankedText={t("survey.allRanked")} />
          </div>

          {(
            ["prioritize", "nice_to_have", "open_to_it"] as GenrePreferenceBucketKey[]
          ).map((bucketKey) => (
            <PreferenceBucketZone
              key={bucketKey}
              bucketKey={bucketKey}
              label={bucketConfig[bucketKey].label}
              subtitle={bucketConfig[bucketKey].subtitle}
              color={bucketConfig[bucketKey].color}
              items={preferenceBuckets[bucketKey]}
            />
          ))}

          <DragOverlay dropAnimation={null}>
            {activeGenre ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "8px 14px",
                  borderRadius: 20,
                  backgroundColor: "var(--primary)",
                  color: "white",
                  fontSize: 14,
                  fontWeight: 600,
                  boxShadow: "0 8px 24px rgba(204,119,85,0.3)",
                  cursor: "grabbing",
                  userSelect: "none",
                }}
              >
                {activeGenre.emoji} {activeGenre.name}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <div style={{ fontSize: 14, color: "var(--text-secondary)", textAlign: "center", marginBottom: 24 }}>
          {rankedCount} / {GENRES.length} ジャンルを分類済み
        </div>

        <button className="btn-primary" onClick={handleSubmit}>
          回答を送信する
        </button>
      </div>
    </div>
  );
}
