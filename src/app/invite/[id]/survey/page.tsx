"use client";

import { use, useEffect, useState } from "react";
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
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import { useLocale } from "@/lib/i18n";
import type {
  Genre,
  GenrePreferenceBucketData,
  GenrePreferenceBucketKey,
} from "@/lib/types";

const STORAGE_KEY = "meshimatch-guest-prefs";

type Step = "name" | "restrictions" | "survey" | "done";

interface GuestPrefs {
  allergies: string[];
  dietaryRestrictions: string[];
}

function readGuestPrefs(): GuestPrefs {
  if (typeof window === "undefined") {
    return { allergies: [], dietaryRestrictions: [] };
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return { allergies: [], dietaryRestrictions: [] };
    }

    const prefs: GuestPrefs = JSON.parse(saved);
    return {
      allergies: prefs.allergies ?? [],
      dietaryRestrictions: prefs.dietaryRestrictions ?? [],
    };
  } catch {
    return { allergies: [], dietaryRestrictions: [] };
  }
}

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

function UnrankedPool({ unranked }: { unranked: Genre[] }) {
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
          すべて分類済みです
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

export default function GuestSurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { userId } = useUser();
  const { locale } = useLocale();
  const [groupName, setGroupName] = useState("グループ");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [step, setStep] = useState<Step>("name");
  const [guestName, setGuestName] = useState("");
  const [allergies, setAllergies] = useState<string[]>(() => readGuestPrefs().allergies);
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>(
    () => readGuestPrefs().dietaryRestrictions
  );
  const [submitting, setSubmitting] = useState(false);
  const [preferenceBuckets, setPreferenceBuckets] =
    useState<GenrePreferenceBucketData>({
      prioritize: [],
      nice_to_have: [],
      open_to_it: [],
    });
  const [activeGenreId, setActiveGenreId] = useState<string | null>(null);

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

  useEffect(() => {
    async function fetchGroup() {
      const supabase = createClient();
      const { data } = await supabase
        .from("groups")
        .select("id, name")
        .eq("invite_code", id)
        .single();

      if (data) {
        setGroupId(data.id);
        setGroupName(data.name);
        setPageLoading(false);
        return;
      }

      const { data: directGroup } = await supabase
        .from("groups")
        .select("id, name")
        .eq("id", id)
        .single();

      if (directGroup) {
        setGroupId(directGroup.id);
        setGroupName(directGroup.name);
      } else {
        setNotFound(true);
      }
      setPageLoading(false);
    }

    void fetchGroup();
  }, [id]);

  function savePrefs() {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ allergies, dietaryRestrictions })
      );
    } catch {
      // noop
    }
  }

  function toggleAllergy(allergyId: string) {
    setAllergies((current) =>
      current.includes(allergyId)
        ? current.filter((id) => id !== allergyId)
        : [...current, allergyId]
    );
  }

  function toggleDietary(restrictionId: string) {
    setDietaryRestrictions((current) =>
      current.includes(restrictionId)
        ? current.filter((id) => id !== restrictionId)
        : [...current, restrictionId]
    );
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
    if (!groupId) {
      return;
    }

    savePrefs();
    setSubmitting(true);

    try {
      const supabase = createClient();
      let memberId: string | null = null;

      if (userId) {
        const { data: existing } = await supabase
          .from("group_members")
          .select("id")
          .eq("group_id", groupId)
          .eq("profile_id", userId)
          .maybeSingle();

        if (existing) {
          memberId = existing.id;
          await supabase
            .from("group_members")
            .update({ display_name: guestName })
            .eq("id", memberId);
        }
      }

      if (!memberId) {
        const { data: newMember } = await supabase
          .from("group_members")
          .insert({
            group_id: groupId,
            display_name: guestName,
            role: "member",
            profile_id: userId ?? null,
          })
          .select("id")
          .single();

        memberId = newMember?.id ?? null;
      }

      if (!memberId) {
        setSubmitting(false);
        return;
      }

      const response = await fetch("/api/groups/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          memberId,
          responseVersion: 2,
          genrePreferences: buildGenrePreferences(preferenceBuckets),
          dietaryRestrictions: [
            ...allergies.map((restrictionId) => ({
              restrictionId,
              priority: "must" as const,
            })),
            ...dietaryRestrictions.map((restrictionId) => ({
              restrictionId,
              priority: "must" as const,
            })),
          ],
        }),
      });

      if (!response.ok) {
        console.error("Survey submit failed:", await response.text());
      }

      if (userId) {
        await supabase
          .from("profiles")
          .update({
            allergies,
            dietary_restrictions: dietaryRestrictions.map((restrictionId) => ({
              restrictionId,
              priority: "must" as const,
            })),
          })
          .eq("id", userId);
      }

      setStep("done");
      window.setTimeout(() => {
        window.location.href = `/groups/${groupId}/waiting`;
      }, 1800);
    } catch (error) {
      console.error("Submit error:", error);
      setSubmitting(false);
    }
  }

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

  if (pageLoading) {
    return (
      <div
        style={{
          backgroundColor: "var(--bg)",
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="animate-spin-slow"
          style={{
            width: 32,
            height: 32,
            border: "3px solid var(--border)",
            borderTopColor: "var(--primary)",
            borderRadius: "50%",
          }}
        />
      </div>
    );
  }

  if (notFound) {
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
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
          グループが見つかりません
        </div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          招待リンクが無効です
        </div>
      </div>
    );
  }

  if (step === "done") {
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
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            backgroundColor: "rgba(74,138,90,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
          {guestName}さん、回答完了
        </div>
        <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 8 }}>
          食事制限は次回から自動入力されます
        </div>
        <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>
          待機室に移動します...
        </div>
      </div>
    );
  }

  if (step === "name") {
    return (
      <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh", padding: "60px 24px 40px" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 4 }}>
            {groupName}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
            はじめまして
          </div>
          <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 32 }}>
            グループのみんなに表示される名前を教えてください
          </div>

          <div
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: 20,
              padding: 24,
              border: "1px solid var(--border-light)",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10 }}>
              ニックネーム
            </div>
            <input
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              placeholder="例: たろう"
              autoFocus
              onKeyDown={(event) =>
                event.key === "Enter" && guestName.trim() && setStep("restrictions")
              }
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 14,
                border: "1.5px solid var(--border)",
                fontSize: 16,
                color: "var(--text-primary)",
                backgroundColor: "var(--bg)",
                outline: "none",
                marginBottom: 4,
              }}
            />
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 20 }}>
              アカウント登録は不要です
            </div>

            <button
              className="btn-primary"
              onClick={() => setStep("restrictions")}
              disabled={guestName.trim().length === 0}
              style={{ width: "100%" }}
            >
              次へ
            </button>
          </div>

          <StepDots current="name" />
        </div>
      </div>
    );
  }

  if (step === "restrictions") {
    return (
      <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh", padding: "60px 24px 40px" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <BackButton onClick={() => setStep("name")} />

          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
            食事制限・アレルギー
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
            {guestName}さん
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
            幹事に共有されるメモです。お店の並び替えには使いません。
          </div>

          <div
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: 20,
              padding: 20,
              border: "1px solid var(--border-light)",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>
              アレルギー
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ALLERGIES.map((allergy) => {
                const selected = allergies.includes(allergy.id);
                return (
                  <button
                    key={allergy.id}
                    onClick={() => toggleAllergy(allergy.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "8px 14px",
                      borderRadius: 20,
                      fontSize: 14,
                      cursor: "pointer",
                      backgroundColor: selected ? "rgba(204,119,85,0.12)" : "var(--bg)",
                      border: `1.5px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                      color: selected ? "var(--primary)" : "var(--text-primary)",
                      fontWeight: selected ? 600 : 400,
                    }}
                  >
                    {allergy.emoji} {allergy.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: 20,
              padding: 20,
              border: "1px solid var(--border-light)",
              marginBottom: 28,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>
              食事制限
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {DIETARY_RESTRICTIONS.map((restriction) => {
                const selected = dietaryRestrictions.includes(restriction.id);
                return (
                  <button
                    key={restriction.id}
                    onClick={() => toggleDietary(restriction.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "8px 14px",
                      borderRadius: 20,
                      fontSize: 14,
                      cursor: "pointer",
                      backgroundColor: selected ? "rgba(204,119,85,0.12)" : "var(--bg)",
                      border: `1.5px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                      color: selected ? "var(--primary)" : "var(--text-primary)",
                      fontWeight: selected ? 600 : 400,
                    }}
                  >
                    {restriction.emoji} {restriction.name}
                  </button>
                );
              })}
            </div>
          </div>

          <button className="btn-primary" onClick={() => setStep("survey")} style={{ width: "100%" }}>
            次へ
          </button>
          <button
            onClick={() => setStep("survey")}
            style={{
              width: "100%",
              marginTop: 10,
              padding: "12px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-tertiary)",
              fontSize: 14,
            }}
          >
            スキップ
          </button>

          <StepDots current="restrictions" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh" }}>
      <div style={{ padding: "56px 20px 0" }}>
        <BackButton onClick={() => setStep("restrictions")} />
      </div>

      <div style={{ padding: "8px 20px 40px" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
          今日の気分を教えてください
        </div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
          {guestName}さん・{groupName}
        </div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>
          ジャンルの希望があれば、近い強さの箱へ分けてください。空でも送信できます。
        </div>

        {(allergies.length > 0 || dietaryRestrictions.length > 0) && (
          <div
            style={{
              backgroundColor: "rgba(204,119,85,0.06)",
              borderRadius: 12,
              padding: "10px 14px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>
              幹事メモ:
            </span>
            {allergies.map((allergyId) => {
              const allergy = ALLERGIES.find((item) => item.id === allergyId);
              return allergy ? (
                <span key={allergyId} style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {allergy.name}
                </span>
              ) : null;
            })}
            {dietaryRestrictions.map((restrictionId) => {
              const restriction = DIETARY_RESTRICTIONS.find(
                (item) => item.id === restrictionId
              );
              return restriction ? (
                <span key={restrictionId} style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {restriction.name}
                </span>
              ) : null;
            })}
          </div>
        )}

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
              ジャンル一覧
            </div>
            <UnrankedPool unranked={unranked} />
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

        <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "送信中..." : "回答を送信する"}
        </button>

        <StepDots current="survey" />
      </div>
    </div>
  );
}

function StepDots({ current }: { current: Step }) {
  const steps: Step[] = ["name", "restrictions", "survey"];
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 24 }}>
      {steps.map((step) => (
        <div
          key={step}
          style={{
            width: step === current ? 24 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: "var(--primary)",
            opacity:
              step === current
                ? 1
                : steps.indexOf(step) < steps.indexOf(current)
                  ? 0.4
                  : 0.2,
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
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        color: "var(--primary)",
        background: "none",
        border: "none",
        fontSize: 16,
        fontWeight: 600,
        cursor: "pointer",
        padding: 0,
        marginBottom: 16,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      戻る
    </button>
  );
}
