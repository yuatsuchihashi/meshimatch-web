"use client";

// ============================================================
// お店を足すだけの軽いページ
// ============================================================
// results から「候補が少ない」導線で来る想定。
// 既存メンバー (ログイン or ゲスト) の survey_responses に
// suggested_restaurants だけを追記する。他のカラムは温存する。
// ============================================================

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import { SuggestPicker, type SuggestPick } from "@/components/survey/SuggestPicker";
import { buildSuggestedRestaurantPayload } from "@/lib/suggestions";
import { isVerified, type VerificationClient } from "@/lib/verification";

export default function SuggestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: groupId } = use(params);
  const router = useRouter();
  const { t } = useLocale();
  const { userId, loading: userLoading } = useUser();

  const [memberId, setMemberId] = useState<string | null>(null);
  const [needSurvey, setNeedSurvey] = useState(false);
  const [picks, setPicks] = useState<SuggestPick[]>([]);
  const [showName, setShowName] = useState(false);
  const [suggestPr, setSuggestPr] = useState(false);
  const [verifiedUser, setVerifiedUser] = useState(false);
  const [quickPicks, setQuickPicks] = useState<{ id: string; name: string; area?: string | null }[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // メンバー解決: ログイン (group_members.profile_id) → ゲスト (localStorage)
  useEffect(() => {
    if (userLoading) {
      return;
    }
    let cancelled = false;
    async function resolveMember() {
      const supabase = createClient();

      if (userId) {
        const { data: existing } = await supabase
          .from("group_members")
          .select("id")
          .eq("group_id", groupId)
          .eq("profile_id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (existing) {
          setMemberId(existing.id);
          return;
        }
      }

      const guestMemberId =
        typeof window !== "undefined"
          ? window.localStorage.getItem(`mm_member_${groupId}`)
          : null;
      if (guestMemberId) {
        const { data: guestMember } = await supabase
          .from("group_members")
          .select("id")
          .eq("id", guestMemberId)
          .eq("group_id", groupId)
          .maybeSingle();
        if (cancelled) return;
        if (guestMember) {
          setMemberId(guestMember.id);
          return;
        }
      }

      if (!cancelled) {
        setNeedSurvey(true);
      }
    }
    void resolveMember();
    return () => {
      cancelled = true;
    };
  }, [groupId, userId, userLoading]);

  useEffect(() => {
    if (!userId) {
      setVerifiedUser(false);
      setSuggestPr(false);
      return;
    }
    let cancelled = false;
    async function loadVerification() {
      const supabase = createClient();
      const verified = await isVerified(supabase as unknown as VerificationClient, userId);
      if (!cancelled) setVerifiedUser(verified);
    }
    void loadVerification();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // 既存の提案をプリフィル
  useEffect(() => {
    if (!memberId) {
      return;
    }
    let cancelled = false;
    async function loadExisting() {
      const supabase = createClient();
      const { data } = await supabase
        .from("survey_responses")
        .select("suggested_restaurants")
        .eq("group_id", groupId)
        .eq("member_id", memberId)
        .maybeSingle();
      if (cancelled || !data) {
        return;
      }
      const savedList = (data.suggested_restaurants as SuggestPick[] | null) ?? [];
      if (savedList.length > 0) {
        setPicks(
          savedList.map((s) => ({ id: s.id, name: s.name, area: s.area, showName: !!s.showName }))
        );
        setShowName(savedList.some((s) => s.showName));
        setSuggestPr(savedList.some((s) => s.pr === true));
      }
    }
    void loadExisting();
    return () => {
      cancelled = true;
    };
  }, [memberId, groupId]);

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
      const favorites = (data as unknown as {
        restaurants: { id: string; name: string; nearest_area: string | null } | null;
      }[])
        .map((row) => row.restaurants)
        .filter((r): r is { id: string; name: string; nearest_area: string | null } => !!r)
        .map((r) => ({ id: r.id, name: r.name, area: r.nearest_area }));
      setQuickPicks(favorites);
    }
    void loadFavorites();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleSave() {
    if (!memberId || saving) {
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      // 既存行を温存: suggested_restaurants だけ上書きする
      const { data: existing } = await supabase
        .from("survey_responses")
        .select("*")
        .eq("group_id", groupId)
        .eq("member_id", memberId)
        .maybeSingle();

      const payload = {
        ...(existing ?? {}),
        group_id: groupId,
        member_id: memberId,
        suggested_restaurants: buildSuggestedRestaurantPayload({
          picks,
          showName,
          isVerified: verifiedUser,
          pr: suggestPr,
        }),
      };

      await supabase
        .from("survey_responses")
        .upsert(payload, { onConflict: "group_id,member_id" });

      if (userId && verifiedUser && picks.length > 0) {
        await supabase.from("restaurant_sources").upsert(
          picks.map((pick) => ({
            restaurant_id: pick.id,
            source_type: "user_favorite",
            visibility: "public",
            added_by: userId,
            pr: suggestPr,
          })),
          { onConflict: "restaurant_id,source_type,added_by" }
        );
      }

      await supabase
        .from("group_members")
        .update({ has_survey: true })
        .eq("id", memberId);

      setSaved(true);
      setTimeout(() => router.push(`/groups/${groupId}/results`), 1200);
    } catch (error) {
      console.error("Suggest save error:", error);
      setSaving(false);
    }
  }

  if (needSurvey) {
    return (
      <div
        className="v2-scope service-canvas"
        style={{
          backgroundColor: "var(--v2-canvas)",
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 40,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
          {t("suggest.needSurvey")}
        </div>
        <Link
          href={`/groups/${groupId}/survey`}
          style={{ color: "var(--v2-ink)", fontSize: 15, fontWeight: 700, textDecoration: "none" }}
        >
          {t("suggest.goSurvey")}
        </Link>
      </div>
    );
  }

  if (!memberId) {
    return (
      <div
        className="v2-scope service-canvas"
        style={{
          backgroundColor: "var(--v2-canvas)",
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

  return (
    <div className="v2-scope service-canvas" style={{ backgroundColor: "var(--v2-canvas)", minHeight: "100dvh" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ padding: "56px 20px 0" }}>
          <Link
            href={`/groups/${groupId}/results`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "var(--v2-ink)",
              textDecoration: "none",
              fontSize: 16,
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t("suggest.back")}
          </Link>
        </div>

        <div style={{ padding: "8px 20px 40px" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
            {t("suggest.title")}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
            {t("suggest.hint")}
          </div>

          <div
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: 20,
              padding: 16,
              border: "1px solid var(--border-light)",
              boxShadow: "var(--v2-shadow)",
              marginBottom: 20,
            }}
          >
            <SuggestPicker
              picks={picks}
              onChange={setPicks}
              showName={showName}
              onShowNameChange={setShowName}
              pr={suggestPr}
              onPrChange={setSuggestPr}
              canMarkPr={verifiedUser}
              quickPicks={quickPicks}
              t={t}
            />
          </div>

          <button className="btn-primary" onClick={handleSave} disabled={saving || saved}>
            {saving ? t("suggest.saving") : t("suggest.save")}
          </button>
        </div>
      </div>

      {saved && (
        <div
          style={{
            position: "fixed",
            bottom: 100,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "var(--success)",
            color: "white",
            padding: "12px 24px",
            borderRadius: 100,
            fontSize: 15,
            fontWeight: 700,
            zIndex: 110,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(74,138,90,0.3)",
          }}
        >
          {t("suggest.saved")}
        </div>
      )}
    </div>
  );
}
