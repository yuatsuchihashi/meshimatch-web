"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import { SURVEY_AREAS } from "@/lib/areas";
import { BudgetCapPicker } from "@/components/survey/GenreTiles";
import { MoodPickGrid, MoodAvoidSection } from "@/components/survey/MoodPills";
import { SuggestPicker, type SuggestPick } from "@/components/survey/SuggestPicker";
import { buildGenrePreferencesFromMoods } from "@/lib/moods";

const AREAS = SURVEY_AREAS;
const MAX_SLOT = 2;

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
            backgroundColor: "rgba(240,90,40,0.12)",
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

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--surface)",
  borderRadius: 20,
  padding: 16,
  border: "1px solid var(--border-light)",
  marginBottom: 16,
};

const titleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "var(--text-primary)",
  marginBottom: 4,
};

const captionStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text-secondary)",
  marginBottom: 12,
};

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

export default function SurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: groupId } = use(params);
  const router = useRouter();
  const { t } = useLocale();
  const { user, userId } = useUser();
  const [groupName, setGroupName] = useState("グループ");
  const [preferredAreas, setPreferredAreas] = useState<string[]>([]);
  const [showOtherArea, setShowOtherArea] = useState(false);
  const [otherAreaInput, setOtherAreaInput] = useState("");
  const [budgetMaxYen, setBudgetMaxYen] = useState<number | null>(null);
  const [preferMoods, setPreferMoods] = useState<string[]>([]);
  const [avoidMoods, setAvoidMoods] = useState<string[]>([]);
  const [suggestedPicks, setSuggestedPicks] = useState<SuggestPick[]>([]);
  const [suggestShowName, setSuggestShowName] = useState(false);
  const [allergyNote, setAllergyNote] = useState("");
  const [dietaryNote, setDietaryNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [editingExisting, setEditingExisting] = useState(false);
  const [quickPicks, setQuickPicks] = useState<{ id: string; name: string; area?: string | null }[]>([]);

  // プロフィールの自由記入からプリフィル (レンダー中の同期更新パターン)
  const [prefilled, setPrefilled] = useState(false);
  if (!prefilled && user) {
    setPrefilled(true);
    if (user.allergyNote) setAllergyNote(user.allergyNote);
    if (user.dietaryNote) setDietaryNote(user.dietaryNote);
  }

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

  // 既存の回答をプリフィル (memberId は userId → group_members で解決)
  useEffect(() => {
    if (!userId) {
      return;
    }
    let cancelled = false;
    async function fetchExisting() {
      const supabase = createClient();
      const { data: member } = await supabase
        .from("group_members")
        .select("id")
        .eq("group_id", groupId)
        .eq("profile_id", userId)
        .maybeSingle();
      if (cancelled || !member) {
        return;
      }
      setMemberId(member.id);

      const { data: existing } = await supabase
        .from("survey_responses")
        .select("*")
        .eq("group_id", groupId)
        .eq("member_id", member.id)
        .maybeSingle();
      if (cancelled || !existing) {
        return;
      }

      setEditingExisting(true);
      setPreferredAreas((existing.preferred_areas as string[]) ?? []);
      setBudgetMaxYen((existing.budget_max_yen as number | null) ?? null);
      setPreferMoods((existing.prefer_moods as string[]) ?? []);
      setAvoidMoods((existing.avoid_moods as string[]) ?? []);
      const savedSuggestions =
        (existing.suggested_restaurants as SuggestPick[] | null) ?? [];
      if (savedSuggestions.length > 0) {
        setSuggestedPicks(
          savedSuggestions.map((s) => ({ id: s.id, name: s.name, area: s.area, showName: !!s.showName }))
        );
        setSuggestShowName(savedSuggestions.some((s) => s.showName));
      }
      // アンケート行のメモがあればプロフィール値より優先
      if (existing.allergy_note) setAllergyNote(existing.allergy_note as string);
      if (existing.dietary_note) setDietaryNote(existing.dietary_note as string);
    }

    void fetchExisting();
    return () => {
      cancelled = true;
    };
  }, [groupId, userId]);

  // ログインユーザーのお気に入りをクイック追加候補として読む
  useEffect(() => {
    if (!userId) {
      return;
    }
    let cancelled = false;
    async function loadFavorites() {
      const supabase = createClient();
      const { data } = await supabase
        .from("restaurant_sources")
        .select("id, restaurants (id, name, nearest_area)")
        .eq("added_by", userId)
        .eq("source_type", "user_favorite")
        .limit(6);
      if (cancelled || !data) {
        return;
      }
      const picks = (data as unknown as {
        restaurants: { id: string; name: string; nearest_area: string | null } | null;
      }[])
        .map((row) => row.restaurants)
        .filter((r): r is { id: string; name: string; nearest_area: string | null } => !!r)
        .map((r) => ({ id: r.id, name: r.name, area: r.nearest_area }));
      setQuickPicks(picks);
    }
    void loadFavorites();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const submitMessages = [
    t("survey.submitting0"),
    t("survey.submitting1"),
    t("survey.submitting2"),
    t("survey.submitting3"),
  ];

  function toggleArea(area: string) {
    setPreferredAreas((current) =>
      current.includes(area)
        ? current.filter((item) => item !== area)
        : [...current, area]
    );
  }

  function togglePrefer(moodId: string) {
    setPreferMoods((current) => {
      if (current.includes(moodId)) {
        return current.filter((id) => id !== moodId);
      }
      if (current.length >= MAX_SLOT) {
        return current;
      }
      setAvoidMoods((avoid) => avoid.filter((id) => id !== moodId));
      return [...current, moodId];
    });
  }

  function toggleAvoid(moodId: string) {
    setAvoidMoods((current) => {
      if (current.includes(moodId)) {
        return current.filter((id) => id !== moodId);
      }
      if (current.length >= MAX_SLOT) {
        return current;
      }
      setPreferMoods((prefer) => prefer.filter((id) => id !== moodId));
      return [...current, moodId];
    });
  }

  async function handleSubmit() {
    if (!userId) {
      // 未ログインで直リンクから開いた場合はログインへ (無反応バグ回避)
      router.push("/login");
      return;
    }

    setSubmitted(true);

    try {
      const supabase = createClient();
      let resolvedMemberId = memberId;
      if (!resolvedMemberId) {
        const { data: existingMember } = await supabase
          .from("group_members")
          .select("id")
          .eq("group_id", groupId)
          .eq("profile_id", userId)
          .maybeSingle();
        resolvedMemberId = existingMember?.id ?? null;
      }
      if (!resolvedMemberId) {
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
        resolvedMemberId = newMember?.id ?? null;
      }

      if (!resolvedMemberId) {
        setSubmitted(false);
        return;
      }

      const trimmedAllergy = allergyNote.trim();
      const trimmedDietary = dietaryNote.trim();

      await supabase.from("survey_responses").upsert(
        {
          group_id: groupId,
          member_id: resolvedMemberId,
          response_version: 2,
          departure_area: null,
          departure_station: null, // 出発駅は v2 (Transit API 統合時) に復活予定
          preferred_areas: preferredAreas,
          budget_ideal_yen: null,
          budget_max_yen: budgetMaxYen,
          budget_priority: budgetMaxYen ? "prefer" : null,
          prefer_moods: preferMoods,
          avoid_moods: avoidMoods,
          genre_preferences: buildGenrePreferencesFromMoods(
            preferMoods,
            avoidMoods
          ),
          dietary_restrictions: user?.dietaryRestrictions ?? [],
          allergy_note: trimmedAllergy || null,
          dietary_note: trimmedDietary || null,
          suggested_restaurants: suggestedPicks.map((p) => ({
            id: p.id,
            name: p.name,
            showName: suggestShowName,
          })),
        },
        { onConflict: "group_id,member_id" }
      );

      await supabase
        .from("group_members")
        .update({ has_survey: true })
        .eq("id", resolvedMemberId);

      // 次回のためにプロフィールも最新の値で更新
      await supabase
        .from("profiles")
        .update({
          allergy_note: trimmedAllergy || null,
          dietary_note: trimmedDietary || null,
        })
        .eq("id", userId);
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
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
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
            {t("survey.constraintsTitle")}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
            {t("survey.constraintsSubtitle").replace("{group}", groupName)}
          </div>

          {editingExisting && (
            <div
              style={{
                backgroundColor: "rgba(240,90,40,0.08)",
                borderRadius: 12,
                padding: "10px 14px",
                marginBottom: 16,
                fontSize: 13,
                fontWeight: 600,
                color: "var(--primary)",
              }}
            >
              {t("survey.editingBanner")}
            </div>
          )}

          {/* 希望エリア */}
          <div style={cardStyle}>
            <div style={titleStyle}>{t("survey.areaTitle")}</div>
            <div style={captionStyle}>{t("survey.areaHint")}</div>
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
              {/* カスタムエリア (その他で追加したもの) */}
              {preferredAreas
                .filter((area) => !AREAS.includes(area as (typeof AREAS)[number]))
                .map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => toggleArea(area)}
                    className="chip chip-selected"
                    style={{ fontSize: 13 }}
                  >
                    {area} ×
                  </button>
                ))}
              <button
                type="button"
                onClick={() => setShowOtherArea((v) => !v)}
                className={`chip ${showOtherArea ? "chip-selected" : ""}`}
                style={{ fontSize: 13 }}
              >
                {t("survey.areaOther")}
              </button>
            </div>
            {showOtherArea && (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <input
                  value={otherAreaInput}
                  onChange={(event) => setOtherAreaInput(event.target.value)}
                  placeholder={t("survey.areaOtherPlaceholder")}
                  style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const area = otherAreaInput.trim();
                    if (area && !preferredAreas.includes(area)) {
                      setPreferredAreas((prev) => [...prev, area]);
                    }
                    setOtherAreaInput("");
                  }}
                  style={{
                    padding: "0 16px", borderRadius: 100, border: "none",
                    background: "var(--primary)", color: "white",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {t("common.add")}
                </button>
              </div>
            )}
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 10 }}>
              {t("survey.areaCoverageNote")}
            </div>
          </div>

          {/* 予算 */}
          <div style={cardStyle}>
            <div style={titleStyle}>{t("survey.budgetTitle")}</div>
            <div style={captionStyle}>{t("survey.budgetHint")}</div>
            <BudgetCapPicker value={budgetMaxYen} onChange={setBudgetMaxYen} t={t} />
          </div>

          {/* アレルギー・食事制限 (自由記入・プロフィールからプリフィル) */}
          <div style={cardStyle}>
            <div style={titleStyle}>{t("survey.dietaryTitle")}</div>
            <div style={captionStyle}>{t("survey.dietaryHint")}</div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>
                {t("survey.allergyInputLabel")}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{allergyNote.length}/50</span>
            </div>
            <input
              value={allergyNote}
              maxLength={50}
              onChange={(event) => setAllergyNote(event.target.value)}
              placeholder={t("survey.allergyInputPlaceholder")}
              style={inputStyle}
            />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 14, marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>
                {t("survey.dietaryInputLabel")}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{dietaryNote.length}/50</span>
            </div>
            <input
              value={dietaryNote}
              maxLength={50}
              onChange={(event) => setDietaryNote(event.target.value)}
              placeholder={t("survey.dietaryInputPlaceholder")}
              style={inputStyle}
            />
          </div>

          {/* 特別枠 */}
          <div style={cardStyle}>
            <div style={titleStyle}>{t("survey.specialTitle")}</div>
            <div style={captionStyle}>{t("survey.specialHint")}</div>

            <MoodPickGrid
              hint={t("survey.preferSlotHint")}
              remaining={
                preferMoods.length >= MAX_SLOT
                  ? t("survey.slotFull")
                  : t("survey.slotRemaining").replace(
                      "{count}",
                      String(MAX_SLOT - preferMoods.length)
                    )
              }
              selected={preferMoods}
              onToggle={togglePrefer}
              maxReached={preferMoods.length >= MAX_SLOT}
              t={t}
            />

            <div style={{ height: 14 }} />

            <MoodAvoidSection
              selected={avoidMoods}
              onToggle={toggleAvoid}
              maxReached={avoidMoods.length >= MAX_SLOT}
              t={t}
            />
          </div>

          {/* 持ち寄り: 行きたい店 */}
          <div style={cardStyle}>
            <div style={titleStyle}>{t("survey.suggestTitle")}</div>
            <div style={captionStyle}>{t("survey.suggestHint")}</div>
            <SuggestPicker
              picks={suggestedPicks}
              onChange={setSuggestedPicks}
              showName={suggestShowName}
              onShowNameChange={setSuggestShowName}
              quickPicks={quickPicks}
              t={t}
            />
          </div>

          <div
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              textAlign: "center",
              margin: "16px 0",
            }}
          >
            {t("survey.privacyNote")}
          </div>

          <button className="btn-primary" onClick={handleSubmit}>
            {t("survey.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}

