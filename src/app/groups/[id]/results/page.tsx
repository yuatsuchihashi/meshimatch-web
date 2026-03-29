"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import { useGroups } from "@/lib/hooks/useGroups";
import { RestaurantCard } from "@/components/restaurants/RestaurantCard";
import { RestaurantDetailModal } from "@/components/restaurants/RestaurantDetailModal";
import { MemberAvatarStack, MemberAvatar } from "@/components/groups/MemberAvatar";
import type { Restaurant } from "@/lib/types";

type SortMode = "match" | "rating";

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { userId } = useUser();
  const { deleteGroup, leaveGroup } = useGroups(userId);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("match");
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<"delete" | "leave" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [decidedRestaurant, setDecidedRestaurant] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [groupName, setGroupName] = useState("グループ");
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [members, setMembers] = useState<{ id: string; displayName: string; role: string; hasSurvey: boolean }[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<"owner" | "member" | null>(null);

  useEffect(() => {
    async function fetchResults() {
      const supabase = createClient();

      // グループ情報取得
      const { data: group } = await supabase
        .from("groups")
        .select(`
          name,
          group_members (id, profile_id, display_name, role, has_survey),
          decisions (restaurant_name)
        `)
        .eq("id", id)
        .single();

      if (group) {
        setGroupName(group.name);
        const m = (group.group_members ?? []).map((mem: { id: string; display_name: string; role: string; has_survey: boolean }) => ({
          id: mem.id,
          displayName: mem.display_name,
          role: mem.role,
          hasSurvey: mem.has_survey,
        }));
        setMembers(m);
        setMemberNames(m.map((x: { displayName: string }) => x.displayName));

        // 自分のロールを特定
        if (userId) {
          const myMember = (group.group_members ?? []).find(
            (mem: { profile_id: string }) => mem.profile_id === userId
          );
          if (myMember) {
            setMyRole(myMember.role as "owner" | "member");
          }
        }

        if (group.decisions?.[0]?.restaurant_name) {
          setDecidedRestaurant(group.decisions[0].restaurant_name);
        }
      }

      // マッチング結果をAPIから取得
      try {
        const res = await fetch(`/api/groups/results?group_id=${id}&sort=${sortMode}`);
        const data = await res.json();

        if (data.results) {
          setRestaurants(data.results);
        }
        if (data.resolvedAreas) {
          setAreas(data.resolvedAreas);
        }
      } catch (err) {
        console.error("Failed to fetch results:", err);
      }

      setLoading(false);
    }

    fetchResults();
  }, [id, sortMode, userId]);

  async function handleDecide(restaurant: Restaurant) {
    const supabase = createClient();
    await supabase.from("decisions").upsert(
      {
        group_id: id,
        restaurant_name: restaurant.name,
        restaurant_id: restaurant.id,
        genre_id: restaurant.genreId,
        decided_by: userId,
      },
      { onConflict: "group_id" }
    );
    setDecidedRestaurant(restaurant.name);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  async function handleGroupAction(action: "delete" | "leave") {
    if (!userId) return;
    setActionLoading(true);
    try {
      const supabase = createClient();

      if (action === "delete") {
        // 幹事のみ: 関連データを順番に削除してからグループ本体を削除
        const { error: e1 } = await supabase.from("decisions").delete().eq("group_id", id);
        if (e1) console.error("decisions delete:", e1);
        const { error: e2 } = await supabase.from("survey_responses").delete().eq("group_id", id);
        if (e2) console.error("survey_responses delete:", e2);
        const { error: e3 } = await supabase.from("invitations").delete().eq("group_id", id);
        if (e3) console.error("invitations delete:", e3);
        const { error: e4 } = await supabase.from("group_members").delete().eq("group_id", id);
        if (e4) console.error("group_members delete:", e4);
        const { error: e5 } = await supabase.from("groups").delete().eq("id", id);
        if (e5) {
          console.error("groups delete:", e5);
          alert("削除に失敗しました: " + e5.message);
          setActionLoading(false);
          setShowConfirmDialog(null);
          return;
        }
      } else {
        // メンバー: 自分のアンケート回答とメンバーシップを削除
        const myMembership = await supabase
          .from("group_members")
          .select("id")
          .eq("group_id", id)
          .eq("profile_id", userId)
          .single();

        if (myMembership.data) {
          await supabase.from("survey_responses").delete()
            .eq("group_id", id)
            .eq("member_id", myMembership.data.id);
          const { error: leaveErr } = await supabase.from("group_members").delete()
            .eq("id", myMembership.data.id);
          if (leaveErr) {
            console.error("leave error:", leaveErr);
            alert("退出に失敗しました: " + leaveErr.message);
            setActionLoading(false);
            setShowConfirmDialog(null);
            return;
          }
        }
      }

      if (action === "delete") {
        deleteGroup(id);
      } else {
        leaveGroup(id);
      }
      router.push("/home");
    } catch (err) {
      console.error("Group action failed:", err);
      alert("エラーが発生しました");
      setActionLoading(false);
      setShowConfirmDialog(null);
    }
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          <div className="animate-spin-slow" style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", marginBottom: 12 }} />
          <div style={{ fontSize: 14 }}>結果を取得中...</div>
        </div>
      </div>
    );
  }

  const filteredRestaurants =
    selectedArea === "all"
      ? restaurants
      : restaurants.filter((r) => r.area === selectedArea);

  const sortedRestaurants = [...filteredRestaurants].sort((a, b) =>
    sortMode === "match" ? b.matchScore - a.matchScore : b.rating - a.rating
  );

  const allAreas = ["all", ...Array.from(new Set(restaurants.map((r) => r.area).filter(Boolean)))];

  return (
    <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh" }}>
      {/* Header */}
      <div style={{ padding: "60px 20px 16px" }}>
        <Link
          href="/home"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--primary)",
            textDecoration: "none",
            fontSize: 15,
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          ホームに戻る
        </Link>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
              {groupName}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {areas.map((area) => (
                <span
                  key={area}
                  style={{
                    fontSize: 12,
                    backgroundColor: "rgba(196,85,42,0.1)",
                    color: "var(--primary)",
                    borderRadius: 20,
                    padding: "3px 10px",
                    fontWeight: 600,
                  }}
                >
                  {area}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setShowMembersModal(true)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <MemberAvatarStack members={memberNames} size={28} />
            </button>
            {/* グループメニューボタン */}
            {myRole && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowGroupMenu(!showGroupMenu)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 4,
                    color: "var(--text-tertiary)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="5" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="19" r="2" />
                  </svg>
                </button>
                {showGroupMenu && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      marginTop: 4,
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                      overflow: "hidden",
                      zIndex: 60,
                      minWidth: 180,
                    }}
                  >
                    <button
                      onClick={() => {
                        setShowGroupMenu(false);
                        setShowConfirmDialog(myRole === "owner" ? "delete" : "leave");
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        padding: "14px 16px",
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#C53030",
                        textAlign: "left",
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        {myRole === "owner" ? (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                        )}
                      </svg>
                      {myRole === "owner" ? "グループを削除" : "グループを退出"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Area tabs */}
      {allAreas.length > 2 && (
        <div style={{ display: "flex", gap: 8, padding: "0 20px 16px", overflowX: "auto", scrollbarWidth: "none" }}>
          {allAreas.map((area) => (
            <button
              key={area}
              onClick={() => setSelectedArea(area)}
              style={{
                padding: "7px 16px",
                borderRadius: 20,
                border: "1.5px solid",
                borderColor: selectedArea === area ? "var(--primary)" : "var(--border)",
                backgroundColor: selectedArea === area ? "rgba(204,119,85,0.1)" : "var(--surface)",
                color: selectedArea === area ? "var(--primary)" : "var(--text-secondary)",
                fontSize: 14,
                fontWeight: selectedArea === area ? 700 : 500,
                cursor: "pointer",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              {area === "all" ? "すべて" : area}
            </button>
          ))}
        </div>
      )}

      {/* 決定済みバナー */}
      {decidedRestaurant && (
        <div
          style={{
            margin: "0 20px 16px",
            backgroundColor: "rgba(74,138,90,0.08)",
            border: "1.5px solid rgba(74,138,90,0.3)",
            borderRadius: 16,
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success)", marginBottom: 2 }}>
              決定済み
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              {decidedRestaurant}
            </div>
          </div>
        </div>
      )}

      {/* Sort tabs */}
      <div style={{ padding: "0 20px 16px" }}>
        <div style={{ display: "inline-flex", backgroundColor: "var(--bg-secondary)", borderRadius: 12, padding: 4, gap: 4 }}>
          {([["match", "一致度"], ["rating", "評価"]] as [SortMode, string][]).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              style={{
                padding: "8px 20px",
                borderRadius: 9,
                border: "none",
                backgroundColor: sortMode === mode ? "var(--surface)" : "transparent",
                color: sortMode === mode ? "var(--primary)" : "var(--text-secondary)",
                fontSize: 14,
                fontWeight: sortMode === mode ? 700 : 500,
                cursor: "pointer",
                boxShadow: sortMode === mode ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 8 }}>
          {sortedRestaurants.length}件の結果
        </div>
      </div>

      {/* Restaurant list */}
      <div style={{ padding: "0 20px 40px", display: "flex", flexDirection: "column", gap: 14 }}>
        {sortedRestaurants.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-secondary)", fontSize: 15 }}>
            {restaurants.length === 0 ? "HotPepper APIキーが設定されていないか、該当するお店が見つかりませんでした" : "このエリアのお店が見つかりませんでした"}
          </div>
        ) : (
          sortedRestaurants.map((restaurant, i) => (
            <div key={restaurant.id} className="animate-fade-in" style={{ animationDelay: `${i * 0.05}s`, animationFillMode: "both" }}>
              <RestaurantCard restaurant={restaurant} onClick={setSelectedRestaurant} />
            </div>
          ))
        )}
      </div>

      {/* Detail modal */}
      <RestaurantDetailModal
        restaurant={selectedRestaurant}
        onClose={() => setSelectedRestaurant(null)}
        onDecide={handleDecide}
      />

      {/* 決定トースト */}
      {showToast && (
        <div
          style={{
            position: "fixed",
            bottom: 100,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "var(--success)",
            color: "white",
            padding: "12px 24px",
            borderRadius: 24,
            fontSize: 15,
            fontWeight: 700,
            zIndex: 110,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(74,138,90,0.3)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          決定しました！
        </div>
      )}

      {/* メニュー外クリックで閉じる */}
      {showGroupMenu && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 55 }}
          onClick={() => setShowGroupMenu(false)}
        />
      )}

      {/* 確認ダイアログ */}
      {showConfirmDialog && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div
            style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
            onClick={() => !actionLoading && setShowConfirmDialog(null)}
          />
          <div
            style={{
              position: "relative",
              backgroundColor: "var(--bg)",
              borderRadius: 20,
              padding: "28px 24px 20px",
              width: "min(320px, calc(100vw - 40px))",
              textAlign: "center",
            }}
          >
            <div style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              backgroundColor: "rgba(197,48,48,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C53030" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
              {showConfirmDialog === "delete" ? "グループを削除しますか？" : "グループを退出しますか？"}
            </div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.5 }}>
              {showConfirmDialog === "delete"
                ? "この操作は取り消せません。グループのデータ（メンバー・アンケート回答・決定情報）がすべて削除されます。"
                : "グループから退出すると、あなたのアンケート回答も削除されます。再度参加するには招待が必要です。"}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowConfirmDialog(null)}
                disabled={actionLoading}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface)",
                  color: "var(--text-primary)",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                キャンセル
              </button>
              <button
                onClick={() => handleGroupAction(showConfirmDialog)}
                disabled={actionLoading}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "none",
                  backgroundColor: "#C53030",
                  color: "white",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: actionLoading ? "wait" : "pointer",
                  opacity: actionLoading ? 0.7 : 1,
                }}
              >
                {actionLoading ? "処理中..." : showConfirmDialog === "delete" ? "削除する" : "退出する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members modal */}
      {showMembersModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div
            style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
            onClick={() => setShowMembersModal(false)}
          />
          <div
            style={{
              position: "relative",
              backgroundColor: "var(--bg)",
              borderRadius: "24px 24px 0 0",
              padding: "20px 20px 40px",
              maxHeight: "70dvh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div style={{ width: 40, height: 4, backgroundColor: "var(--border)", borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
              {groupName} のメンバー
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {members.map((member) => (
                <div key={member.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <MemberAvatar name={member.displayName} size={40} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                      {member.displayName}
                      {member.role === "owner" && (
                        <span style={{ fontSize: 11, color: "var(--primary)", marginLeft: 6 }}>幹事</span>
                      )}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: 20,
                      backgroundColor: member.hasSurvey ? "rgba(74,138,90,0.1)" : "var(--bg-secondary)",
                      color: member.hasSurvey ? "var(--success)" : "var(--text-tertiary)",
                    }}
                  >
                    {member.hasSurvey ? "回答済み" : "未回答"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
