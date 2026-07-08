"use client";

import { use, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import { useLocale } from "@/lib/i18n";
import { SURVEY_AREAS } from "@/lib/areas";
import { BudgetCapPicker } from "@/components/survey/GenreTiles";
import { MoodPickGrid, MoodAvoidSection } from "@/components/survey/MoodPills";
import { SuggestPicker, type SuggestPick } from "@/components/survey/SuggestPicker";
import { buildGenrePreferencesFromMoods } from "@/lib/moods";
import { track, AnalyticsEvent } from "@/lib/analytics";
import { markParticipated } from "@/lib/anon-id";

const STORAGE_KEY = "meshimatch-guest-prefs";
const MAX_SLOT = 2;

type Step = "name" | "restrictions" | "survey" | "done";

interface GuestPrefs {
  allergyNote: string;
  dietaryNote: string;
}

function readGuestPrefs(): GuestPrefs {
  if (typeof window === "undefined") {
    return { allergyNote: "", dietaryNote: "" };
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return { allergyNote: "", dietaryNote: "" };
    }

    // 新形式は文字列フィールド。旧形式 (allergies/dietaryRestrictions 配列) は無視する。
    const prefs = JSON.parse(saved) as Partial<GuestPrefs>;
    return {
      allergyNote: typeof prefs.allergyNote === "string" ? prefs.allergyNote : "",
      dietaryNote: typeof prefs.dietaryNote === "string" ? prefs.dietaryNote : "",
    };
  } catch {
    return { allergyNote: "", dietaryNote: "" };
  }
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

export default function GuestSurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { userId } = useUser();
  const { t } = useLocale();
  const [groupName, setGroupName] = useState("グループ");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [step, setStep] = useState<Step>("name");
  const [guestName, setGuestName] = useState("");
  const [allergyNote, setAllergyNote] = useState<string>(() => readGuestPrefs().allergyNote);
  const [dietaryNote, setDietaryNote] = useState<string>(() => readGuestPrefs().dietaryNote);
  const [submitting, setSubmitting] = useState(false);
  const [showOtherArea, setShowOtherArea] = useState(false);
  const [otherAreaInput, setOtherAreaInput] = useState("");
  const [preferredAreas, setPreferredAreas] = useState<string[]>([]);
  const [budgetMaxYen, setBudgetMaxYen] = useState<number | null>(null);
  const [preferMoods, setPreferMoods] = useState<string[]>([]);
  const [avoidMoods, setAvoidMoods] = useState<string[]>([]);
  const [suggestedPicks, setSuggestedPicks] = useState<SuggestPick[]>([]);
  const [suggestShowName, setSuggestShowName] = useState(false);
  const [quickPicks, setQuickPicks] = useState<{ id: string; name: string; area?: string | null }[]>([]);

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

  // link_opened: 招待リンクからフォームを開いた（ファネル入口）
  useEffect(() => {
    track(AnalyticsEvent.LINK_OPENED, { inviteCode: id });
  }, [id]);

  // 既存の回答をプリフィル (localStorage の memberId から)
  useEffect(() => {
    if (!groupId) {
      return;
    }
    const storedMemberId =
      typeof window !== "undefined"
        ? window.localStorage.getItem(`mm_member_${groupId}`)
        : null;
    if (!storedMemberId) {
      return;
    }
    let cancelled = false;
    async function fetchExisting() {
      const supabase = createClient();
      const { data: existing } = await supabase
        .from("survey_responses")
        .select("*")
        .eq("group_id", groupId!)
        .eq("member_id", storedMemberId!)
        .maybeSingle();
      if (cancelled || !existing) {
        return;
      }
      setPreferredAreas((existing.preferred_areas as string[]) ?? []);
      setBudgetMaxYen((existing.budget_max_yen as number | null) ?? null);
      setPreferMoods((existing.prefer_moods as string[]) ?? []);
      setAvoidMoods((existing.avoid_moods as string[]) ?? []);
      if (existing.allergy_note) setAllergyNote(existing.allergy_note as string);
      if (existing.dietary_note) setDietaryNote(existing.dietary_note as string);
      const suggested = (existing.suggested_restaurants as SuggestPick[] | null) ?? [];
      if (suggested.length > 0) {
        setSuggestedPicks(suggested);
        setSuggestShowName(suggested.some((pick) => pick.showName));
      }
    }
    void fetchExisting();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  // ログインユーザーのお気に入りをクイック追加候補として読む (ゲストは対象外)
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

  // form_started: 最初のチップをタップした瞬間に一度だけ
  const formStartedRef = useRef(false);
  function markStarted() {
    if (formStartedRef.current) return;
    formStartedRef.current = true;
    track(AnalyticsEvent.FORM_STARTED, { groupId });
  }

  function savePrefs() {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          allergyNote: allergyNote.trim(),
          dietaryNote: dietaryNote.trim(),
        })
      );
    } catch {
      // noop
    }
  }

  function toggleArea(area: string) {
    markStarted();
    setPreferredAreas((current) =>
      current.includes(area)
        ? current.filter((item) => item !== area)
        : [...current, area]
    );
  }

  function togglePrefer(moodId: string) {
    markStarted();
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
    markStarted();
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

      // ゲスト (アカウントなし) でも後で○×投票できるよう、memberId を保存
      try {
        window.localStorage.setItem(`mm_member_${groupId}`, memberId);
      } catch {
        // noop
      }

      const response = await fetch("/api/groups/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          memberId,
          responseVersion: 2,
          departureArea: null,
          departureStation: null, // 出発駅は v2 (Transit API 統合時) に復活予定
          preferredAreas,
          budgetIdealYen: null,
          budgetMaxYen,
          budgetPriority: budgetMaxYen ? "prefer" : null,
          preferMoods,
          avoidMoods,
          genrePreferences: buildGenrePreferencesFromMoods(
            preferMoods,
            avoidMoods
          ),
          allergyNote: allergyNote.trim() || null,
          dietaryNote: dietaryNote.trim() || null,
          suggestedRestaurants: suggestedPicks.map((pick) => ({
            id: pick.id,
            name: pick.name,
            showName: suggestShowName,
          })),
          dietaryRestrictions: [],
        }),
      });

      if (!response.ok) {
        console.error("Survey submit failed:", await response.text());
      }

      if (userId) {
        await supabase
          .from("profiles")
          .update({
            allergy_note: allergyNote.trim() || null,
            dietary_note: dietaryNote.trim() || null,
          })
          .eq("id", userId);
      }

      // form_completed + 参加実績を記録（後日この端末が幹事になれば participant_converted）
      track(AnalyticsEvent.FORM_COMPLETED, { groupId });
      markParticipated();

      setStep("done");
    } catch (error) {
      console.error("Submit error:", error);
      setSubmitting(false);
    }
  }

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
        <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 28 }}>
          食事制限は次回から自動入力されます
        </div>

        <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 12 }}>
          <a
            href={`/groups/${groupId}/waiting`}
            className="btn-primary"
            style={{ width: "100%", textDecoration: "none", textAlign: "center" }}
          >
            結果を待つ
          </a>

          {/* グロースCTA: 参加者 → 次の幹事への転化（要件セクション6） */}
          <a
            href="/groups/create?from=survey_done"
            style={{
              width: "100%",
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              padding: "14px 16px",
              borderRadius: 16,
              border: "1px dashed var(--border)",
              backgroundColor: "var(--surface)",
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 800, color: "var(--primary)" }}>
              自分のグループでもやってみる →
            </span>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              次の食事会、あなたが幹事に
            </span>
          </a>

          <a
            href={`/signup?from=guest_done&group=${groupId}`}
            style={{
              width: "100%",
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              padding: "13px 16px",
              borderRadius: 16,
              backgroundColor: "rgba(240,90,40,0.08)",
              border: "1px solid rgba(240,90,40,0.16)",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--primary)" }}>
              アプリに登録する
            </span>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              次回の食事会をもっと早く
            </span>
          </a>
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
            {t("survey.dietaryHint")}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                {t("survey.allergyInputLabel")}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{allergyNote.length}/50</span>
            </div>
            <input
              value={allergyNote}
              maxLength={50}
              onChange={(event) => {
                markStarted();
                setAllergyNote(event.target.value);
              }}
              placeholder={t("survey.allergyInputPlaceholder")}
              style={inputStyle}
            />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 18, marginBottom: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                {t("survey.dietaryInputLabel")}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{dietaryNote.length}/50</span>
            </div>
            <input
              value={dietaryNote}
              maxLength={50}
              onChange={(event) => {
                markStarted();
                setDietaryNote(event.target.value);
              }}
              placeholder={t("survey.dietaryInputPlaceholder")}
              style={inputStyle}
            />
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
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ padding: "56px 20px 0" }}>
          <BackButton onClick={() => setStep("restrictions")} />
        </div>

        <div style={{ padding: "8px 20px 40px" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
            {t("survey.constraintsTitle")}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
            {guestName}さん・{groupName}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>
            {t("survey.constraintsSubtitle").replace("{group}", groupName)}
          </div>

          {(allergyNote.trim().length > 0 || dietaryNote.trim().length > 0) && (
            <div
              style={{
                backgroundColor: "rgba(240,90,40,0.06)",
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
              {allergyNote.trim().length > 0 && (
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {allergyNote.trim()}
                </span>
              )}
              {dietaryNote.trim().length > 0 && (
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {dietaryNote.trim()}
                </span>
              )}
            </div>
          )}

          {/* 希望エリア */}
          <div style={cardStyle}>
            <div style={titleStyle}>{t("survey.areaTitle")}</div>
            <div style={captionStyle}>{t("survey.areaHint")}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SURVEY_AREAS.map((area) => (
                <button
                  key={`pref-${area}`}
                  type="button"
                  className={`chip ${preferredAreas.includes(area) ? "chip-selected" : ""}`}
                  onClick={() => toggleArea(area)}
                  style={{ fontSize: 13 }}
                >
                  {area}
                </button>
              ))}
              {preferredAreas
                .filter((area) => !(SURVEY_AREAS as readonly string[]).includes(area))
                .map((area) => (
                  <button
                    key={`custom-${area}`}
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

          {/* 持ち寄り: あなたのおすすめが候補の主役になる */}
          <div style={cardStyle}>
            <div style={titleStyle}>{t("survey.suggestTitle")}</div>
            <div style={captionStyle}>{t("survey.suggestHint")}</div>
            <SuggestPicker
              picks={suggestedPicks}
              onChange={(picks) => { markStarted(); setSuggestedPicks(picks); }}
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

          <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "送信中..." : t("survey.submit")}
          </button>

          <StepDots current="survey" />
        </div>
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
