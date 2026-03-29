"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/hooks/useUser";
import { useGroups } from "@/lib/hooks/useGroups";
import { createClient } from "@/lib/supabase/client";
import { GroupCard } from "@/components/groups/GroupCard";
import { MemberAvatar } from "@/components/groups/MemberAvatar";
import type { Invitation, MeshiGroup } from "@/lib/types";

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}

export default function HomePage() {
  const router = useRouter();
  const { user, userId, loading: userLoading } = useUser();
  const { groups, loading: groupsLoading, refresh: refreshGroups } = useGroups(userId);
  const [showArchived, setShowArchived] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [hiddenGroupIds, setHiddenGroupIds] = useState<Set<string>>(new Set());
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifVisible, setNotifVisible] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  // 招待通知を取得
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
        setInvitations(
          data.map((inv) => ({
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
          <div style={{ fontSize: 14 }}>読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh" }}>
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
            こんにちは、
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)" }}>
            {user?.displayName ?? "ユーザー"}さん
          </div>
        </div>

        {/* 通知ボタン */}
        <button
          onClick={openNotifications}
          style={{ position: "relative", background: "none", border: "none", padding: 0, cursor: "pointer" }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              src="/icons/notification_line.svg"
              alt="通知"
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

      <div style={{ padding: "0 20px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Create Group CTA */}
        <Link href="/groups/create" style={{ textDecoration: "none" }}>
          <div
            style={{
              background: "linear-gradient(135deg, var(--secondary), #3D3B6E)",
              borderRadius: 20,
              padding: 20,
              display: "flex",
              alignItems: "center",
              gap: 16,
              boxShadow: "0 4px 16px rgba(45,43,85,0.25)",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                backgroundColor: "rgba(255,255,255,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Image
                src="/icons/add_line.svg"
                alt="作成"
                width={28}
                height={28}
                style={{ filter: "brightness(0) invert(1)" }}
              />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "white", marginBottom: 4 }}>
                グループを作ろう
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                みんなで行くお店をAIが提案
              </div>
            </div>
            <div style={{ marginLeft: "auto", color: "rgba(255,255,255,0.5)" }}>
              <Image
                src="/icons/arrow_right_line.svg"
                alt=""
                width={20}
                height={20}
                style={{ filter: "brightness(0) invert(1) opacity(0.5)" }}
              />
            </div>
          </div>
        </Link>

        {/* Active Groups */}
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
            進行中のグループ
          </div>
          {visibleActiveGroups.length === 0 ? (
            <EmptyState />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {visibleActiveGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  onToggleHide={() => toggleHide(group.id)}
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
              非表示のグループ ({hiddenActiveGroups.length}件)
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
              過去のグループ ({archivedGroups.length})
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
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>通知</div>
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
                    通知はありません
                  </div>
                  <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>
                    グループに招待されるとここに表示されます
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
                            <span style={{ color: "var(--primary)" }}>{inv.inviterName}</span>さんから招待
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                            {timeAgo(inv.createdAt)}
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
                        参加してアンケートに回答する
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "40px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Image
        src="/icons/search_line.svg"
        alt=""
        width={48}
        height={48}
        style={{ filter: "brightness(0) saturate(100%) invert(70%) sepia(5%) saturate(400%) hue-rotate(210deg)", opacity: 0.4 }}
      />
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>
        グループがありません
      </div>
      <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>
        「グループを作ろう」から始めてみましょう
      </div>
    </div>
  );
}
