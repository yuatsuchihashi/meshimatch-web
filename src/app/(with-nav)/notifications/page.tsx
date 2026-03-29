"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MemberAvatar } from "@/components/groups/MemberAvatar";
import { useUser } from "@/lib/hooks/useUser";
import { createClient } from "@/lib/supabase/client";

interface InvitationData {
  id: string;
  groupId: string;
  groupName: string;
  inviterName: string;
  memberCount: number;
  createdAt: Date;
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}

export default function NotificationsPage() {
  const { userId } = useUser();
  const [invitations, setInvitations] = useState<InvitationData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    async function fetchInvitations() {
      const supabase = createClient();

      const { data } = await supabase
        .from("invitations")
        .select(`
          id,
          group_id,
          created_at,
          groups (
            id,
            name,
            group_members (id, display_name, role)
          )
        `)
        .eq("invitee_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (data) {
        const mapped: InvitationData[] = data
          .filter((inv: Record<string, unknown>) => inv.groups)
          .map((inv: Record<string, unknown>) => {
            const group = inv.groups as { id: string; name: string; group_members: { id: string; display_name: string; role: string }[] };
            const owner = group.group_members?.find(
              (m: { role: string }) => m.role === "owner"
            );
            return {
              id: inv.id as string,
              groupId: group.id,
              groupName: group.name,
              inviterName: owner?.display_name ?? "不明",
              memberCount: group.group_members?.length ?? 0,
              createdAt: new Date(inv.created_at as string),
            };
          });
        setInvitations(mapped);
      }
      setLoading(false);
    }

    fetchInvitations();
  }, [userId]);

  async function handleAccept(invitationId: string, groupId: string) {
    if (!userId) return;
    const supabase = createClient();

    // 招待を承認
    await supabase
      .from("invitations")
      .update({ status: "accepted" })
      .eq("id", invitationId);

    // グループメンバーに追加
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .single();

    await supabase.from("group_members").insert({
      group_id: groupId,
      profile_id: userId,
      display_name: profile?.display_name ?? "ユーザー",
      role: "member",
    });

    // UIから削除
    setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="animate-spin-slow" style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%" }} />
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh" }}>
      {/* Header */}
      <div style={{ padding: "60px 20px 20px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>
          通知
        </div>
      </div>

      <div style={{ padding: "0 20px 40px" }}>
        {invitations.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: "60px 20px",
              textAlign: "center",
            }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-tertiary)"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.143 17.082a24.248 24.248 0 003.844.148m-3.844-.148a23.856 23.856 0 01-5.455-1.31 8.964 8.964 0 002.3-5.542m3.155 6.852a3 3 0 005.667 1.329m.14-6.544-.33.33m0 0a2.25 2.25 0 000-3.182l-.33-.33m0 3.512L14 12m-3 3l-1.5 1.5M14 12l-1.5-1.5M7.5 7.5L9 9m5.5-1.5L13 9M12 5.25a.75.75 0 01.75.75v.01a.75.75 0 01-1.5 0V6a.75.75 0 01.75-.75z"
              />
            </svg>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>
              通知はありません
            </div>
            <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>
              グループに招待されると<br />ここに表示されます
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="card"
                style={{ padding: 16 }}
              >
                {/* Inviter info */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  <MemberAvatar name={inv.inviterName} size={40} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                      <span style={{ color: "var(--primary)" }}>{inv.inviterName}</span>さんから招待が届いています
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                      {timeAgo(inv.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Group info */}
                <div
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                      {inv.groupName}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: 12,
                        backgroundColor: "var(--surface)",
                        color: "var(--text-secondary)",
                        borderRadius: 8,
                        padding: "3px 10px",
                        fontWeight: 500,
                      }}
                    >
                      {inv.memberCount}名
                    </span>
                  </div>
                </div>

                {/* Accept button */}
                <Link
                  href={`/groups/${inv.groupId}/survey`}
                  onClick={() => handleAccept(inv.id, inv.groupId)}
                  style={{ textDecoration: "none" }}
                >
                  <button className="btn-primary" style={{ height: 46, fontSize: 15 }}>
                    参加してアンケートに回答する
                  </button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
