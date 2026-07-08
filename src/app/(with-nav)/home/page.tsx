"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/hooks/useUser";
import { useGroups } from "@/lib/hooks/useGroups";
import { createClient } from "@/lib/supabase/client";
import { GroupCard } from "@/components/groups/GroupCard";
import { RecommendCarousel, type RecommendedRestaurant } from "@/components/home/RecommendCarousel";
import { RestaurantDetailModal } from "@/components/restaurants/RestaurantDetailModal";
import { MemberAvatar } from "@/components/groups/MemberAvatar";
import { useLocale } from "@/lib/i18n";
import { track, AnalyticsEvent } from "@/lib/analytics";
import type { Invitation } from "@/lib/types";

function timeAgo(date: Date, locale: string): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (locale === "en") {
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}

export default function HomePage() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const { user, userId, loading: userLoading } = useUser();
  const {
    groups,
    loading: groupsLoading,
    refresh: refreshGroups,
    deleteGroup,
    archiveGroup,
    leaveGroup,
  } = useGroups(userId);
  const [showArchived, setShowArchived] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [hiddenGroupIds, setHiddenGroupIds] = useState<Set<string>>(new Set());
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifVisible, setNotifVisible] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [selectedRecommend, setSelectedRecommend] = useState<RecommendedRestaurant | null>(null);

  useEffect(() => {
    if (!userId) return;
    async function fetchInvitations() {
      const supabase = createClient();
      const { data } = await supabase
        .from("invitations")
        .select(`
          *,
          groups!inner (name),
          inviter:profiles!invitations_inviter_id_fkey (display_name)
        `)
        .eq("invitee_id", userId)
        .eq("status", "pending");

      if (data) {
        type InvitationRow = {
          id: string;
          group_id: string;
          created_at: string;
          groups?: { name?: string } | null;
          inviter?: { display_name?: string } | null;
        };
        setInvitations(
          (data as InvitationRow[]).map((inv) => ({
            id: inv.id,
            groupId: inv.group_id,
            groupName: inv.groups?.name ?? "不明",
            inviterName: inv.inviter?.display_name ?? "不明",
            areaNames: [],
            memberCount: 0,
            createdAt: new Date(inv.created_at),
          }))
        );
      }
    }
    fetchInvitations();
  }, [userId]);

  const loading = userLoading || groupsLoading;

  // 「また行きたい？」: 決定から20時間以上経ったグループを、1回だけ聞く
  const [revisitDismissed, setRevisitDismissed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem("mm_revisit_asked") ?? "[]"));
    } catch {
      return new Set();
    }
  });
  const [revisitCutoff] = useState(() => Date.now() - 20 * 60 * 60 * 1000);
  const revisitGroup = groups.find(
    (g) =>
      g.decidedRestaurant &&
      g.decidedAt &&
      g.decidedAt.getTime() < revisitCutoff &&
      !revisitDismissed.has(g.id)
  );

  function dismissRevisit(groupId: string) {
    setRevisitDismissed((prev) => {
      const next = new Set(prev).add(groupId);
      localStorage.setItem("mm_revisit_asked", JSON.stringify([...next]));
      return next;
    });
  }

  async function handleRevisit(yes: boolean) {
    if (!revisitGroup) return;
    // visit_confirmed: 翌日フィードバック（実行率＝decided→visit の計測）
    track(AnalyticsEvent.VISIT_CONFIRMED, { groupId: revisitGroup.id, wouldReturn: yes });
    if (yes && userId && revisitGroup.decidedRestaurantId) {
      // 「また行きたい」= お気に入り登録 (公開して候補プールにも貢献)
      const supabase = createClient();
      await supabase.from("restaurant_sources").upsert(
        {
          restaurant_id: revisitGroup.decidedRestaurantId,
          source_type: "user_favorite",
          visibility: "public",
          added_by: userId,
          note: `「${revisitGroup.name}」の会でまた行きたいと回答`,
        },
        { onConflict: "restaurant_id,source_type,added_by" }
      );
    }
    dismissRevisit(revisitGroup.id);
  }

  const allActiveGroups = groups.filter((g) => g.status === "active");
  const visibleActiveGroups = allActiveGroups.filter((g) => !hiddenGroupIds.has(g.id));
  const hiddenActiveGroups = allActiveGroups.filter((g) => hiddenGroupIds.has(g.id));
  const archivedGroups = groups.filter((g) => g.status === "archived");

  function toggleHide(groupId: string) {
    setHiddenGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  async function handleArchiveGroup(groupId: string) {
    if (!userId) return;
    archiveGroup(groupId);
    const res = await fetch("/api/groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, profileId: userId, status: "archived" }),
    });
    if (!res.ok) {
      refreshGroups();
      const json = await res.json().catch(() => null);
      alert(json?.error ?? t("groupCard.archiveFailed"));
    }
  }

  async function handleSwipeDeleteGroup(groupId: string) {
    if (!userId) return;
    const group = groups.find((item) => item.id === groupId);
    const myMembership = group?.members.find((member) => member.profileId === userId);
    const action = myMembership?.role === "member" ? "leave" : "delete";
    const confirmed = window.confirm(
      action === "delete"
        ? `${t("results.deleteGroup")}\n${t("results.deleteGroupDesc")}`
        : `${t("results.leaveGroup")}\n${t("results.leaveGroupDesc")}`
    );
    if (!confirmed) return;

    if (action === "delete") deleteGroup(groupId);
    else leaveGroup(groupId);

    const res = await fetch("/api/groups", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, profileId: userId, action }),
    });
    if (!res.ok) {
      refreshGroups();
      const json = await res.json().catch(() => null);
      alert(json?.error ?? t("groupCard.deleteFailed"));
    }
  }

  function openNotifications() {
    setShowNotifications(true);
    requestAnimationFrame(() => setNotifVisible(true));
  }

  function closeNotifications() {
    setNotifVisible(false);
    setTimeout(() => setShowNotifications(false), 250);
  }

  async function handleAcceptInvitation(inv: Invitation) {
    if (!userId) return;
    const supabase = createClient();

    await supabase
      .from("invitations")
      .update({ status: "accepted" })
      .eq("id", inv.id);

    await supabase.from("group_members").insert({
      group_id: inv.groupId,
      profile_id: userId,
      display_name: user?.displayName ?? "ゲスト",
      role: "member",
    });

    setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
    closeNotifications();
    refreshGroups();
    router.push(`/groups/${inv.groupId}/survey`);
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          <div className="animate-spin-slow" style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14 }}>{t("common.loading")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="service-canvas" style={{ minHeight: "100dvh" }}>
      {/* Header */}
      <div
        style={{
          padding: "60px 20px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
            {t("home.greeting")}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)" }}>
            {user?.displayName ?? "ユーザー"}{t("home.greetingSuffix")}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={openNotifications}
          style={{ position: "relative", background: "none", border: "none", padding: 0, cursor: "pointer" }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 100,
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              src="/icons/notification_line.svg"
              alt={t("home.notifications")}
              width={22}
              height={22}
              style={{
                filter: "brightness(0) saturate(100%) invert(45%) sepia(10%) saturate(500%) hue-rotate(210deg) brightness(95%)",
              }}
            />
          </div>
          {invitations.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 18,
                height: 18,
                borderRadius: "50%",
                backgroundColor: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                color: "white",
                border: "2px solid var(--bg)",
              }}
            >
              {invitations.length}
            </div>
          )}
        </button>
        </div>
      </div>

      <div style={{ padding: "0 20px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Create Group CTA */}
        <Link href="/groups/create" style={{ textDecoration: "none" }}>
          <div
            className="card service-create-card"
            style={{
              padding: "20px 88px 20px 20px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              minHeight: 104,
            }}
          >
            <Image
              src="/img/service/02-create-group-plate.webp"
              alt=""
              width={112}
              height={90}
              className="service-deco"
              style={{
                position: "absolute",
                right: 6,
                bottom: 0,
                width: 82,
                height: "auto",
                opacity: 0.96,
              }}
            />
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "linear-gradient(135deg, var(--primary), var(--primary-light))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 8px 18px rgba(240,90,40,0.24)",
                position: "relative",
                zIndex: 1,
              }}
            >
              <Image
                src="/icons/add_line.svg"
                alt="作成"
                width={24}
                height={24}
                style={{ filter: "brightness(0) invert(1)" }}
              />
            </div>
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
                {t("home.createGroup")}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.45 }}>
                {t("home.createGroupDesc")}
              </div>
            </div>
            <div style={{ marginLeft: "auto", color: "var(--text-tertiary)" }}>
              <Image
                src="/icons/arrow_right_line.svg"
                alt=""
                width={18}
                height={18}
                style={{ filter: "brightness(0) saturate(100%) invert(70%) sepia(5%) saturate(400%) hue-rotate(210deg)" }}
              />
            </div>
          </div>
        </Link>

        {/* また行きたい？カード (決定の翌日に1回だけ) */}
        {revisitGroup && (
          <div className="card animate-fade-in" style={{ padding: "16px 18px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)", marginBottom: 4 }}>
              {t("home.revisitEyebrow", { group: revisitGroup.name })}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
              {t("home.revisitQuestion", { name: revisitGroup.decidedRestaurant ?? "" })}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button
                onClick={() => handleRevisit(true)}
                style={{
                  flex: 1, height: 42, borderRadius: 100, border: "none",
                  background: "var(--success)", color: "white", fontWeight: 700,
                  fontSize: 14, cursor: "pointer",
                }}
              >
                ○ {t("home.revisitYes")}
              </button>
              <button
                onClick={() => handleRevisit(false)}
                style={{
                  flex: 1, height: 42, borderRadius: 100,
                  border: "1.5px solid var(--border-strong)", background: "var(--surface)",
                  color: "var(--text-secondary)", fontWeight: 700, fontSize: 14, cursor: "pointer",
                }}
              >
                {t("home.revisitNo")}
              </button>
            </div>
          </div>
        )}

        {/* おすすめカルーセル (新規CTAの直下: 発見枠) */}
        <RecommendCarousel userId={userId} onSelect={setSelectedRecommend} />

        {/* Active Groups */}
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
            {t("home.activeGroups")}
          </div>
          {visibleActiveGroups.length === 0 ? (
            <EmptyState />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {visibleActiveGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  onSwipeArchive={() => void handleArchiveGroup(group.id)}
                  onSwipeDelete={() => void handleSwipeDeleteGroup(group.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Hidden Groups */}
        {hiddenActiveGroups.length > 0 && (
          <div>
            <button
              onClick={() => setShowHidden(!showHidden)}
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text-secondary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 0",
                marginBottom: showHidden ? 12 : 0,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                style={{ transform: showHidden ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              {t("home.hiddenGroups", { count: hiddenActiveGroups.length })}
            </button>
            {showHidden && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {hiddenActiveGroups.map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    onRestore={() => toggleHide(group.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Archived Groups */}
        {archivedGroups.length > 0 && (
          <div>
            <button
              onClick={() => setShowArchived(!showArchived)}
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text-secondary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 0",
                marginBottom: showArchived ? 12 : 0,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                style={{ transform: showArchived ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              {t("home.archivedGroups", { count: archivedGroups.length })}
            </button>
            {showArchived && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {archivedGroups.map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 通知シート */}
      {showNotifications && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
              opacity: notifVisible ? 1 : 0,
              transition: "opacity 0.2s ease",
            }}
            onClick={closeNotifications}
          />
          <div
            style={{
              position: "relative",
              backgroundColor: "var(--bg)",
              borderRadius: "24px 24px 0 0",
              maxHeight: "80dvh",
              overflowY: "auto",
              transform: notifVisible ? "translateY(0)" : "translateY(100%)",
              transition: "transform 0.25s cubic-bezier(0.34,1.1,0.64,1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
              <div style={{ width: 40, height: 4, backgroundColor: "var(--border)", borderRadius: 2 }} />
            </div>
            <div
              style={{
                padding: "16px 20px 12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>{t("home.notifications")}</div>
              <button
                onClick={closeNotifications}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-tertiary)",
                  fontSize: 20,
                  lineHeight: 1,
                  padding: "4px 8px",
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: "0 20px 40px" }}>
              {invitations.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "40px 20px",
                    gap: 12,
                    textAlign: "center",
                  }}
                >
                  <Image
                    src="/icons/notification_line.svg"
                    alt=""
                    width={40}
                    height={40}
                    style={{ filter: "brightness(0) saturate(100%) invert(70%) sepia(5%) saturate(400%) hue-rotate(210deg)", opacity: 0.5 }}
                  />
                  <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>
                    {t("home.noNotifications")}
                  </div>
                  <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>
                    {t("home.noNotificationsHint")}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {invitations.map((inv) => (
                    <div key={inv.id} className="card" style={{ padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                        <MemberAvatar name={inv.inviterName} size={40} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                            {t("home.invitedBy", { name: inv.inviterName })}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                            {timeAgo(inv.createdAt, locale)}
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          backgroundColor: "var(--bg-secondary)",
                          borderRadius: 12,
                          padding: 14,
                          marginBottom: 14,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                            {inv.groupName}
                          </span>
                        </div>
                      </div>
                      <button
                        className="btn-primary"
                        style={{ height: 46, fontSize: 15 }}
                        onClick={() => handleAcceptInvitation(inv)}
                      >
                        {t("home.joinSurvey")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* おすすめ店の詳細 (マップ埋め込み付き) */}
      <RestaurantDetailModal
        restaurant={selectedRecommend}
        onClose={() => setSelectedRecommend(null)}
      />
    </div>
  );
}

function EmptyState() {
  const { t } = useLocale();
  return (
    <div
      className="card service-create-card"
      style={{
        textAlign: "center",
        padding: "28px 20px 30px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Image
        src="/img/service/02-create-group-plate.webp"
        alt=""
        width={132}
        height={106}
        className="service-deco"
        style={{ width: 126, height: "auto" }}
      />
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>
        {t("home.noGroups")}
      </div>
      <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>
        {t("home.noGroupsHint")}
      </div>
    </div>
  );
}
