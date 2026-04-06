"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import { RestaurantCard } from "@/components/restaurants/RestaurantCard";
import { RestaurantDetailModal } from "@/components/restaurants/RestaurantDetailModal";
import { MemberAvatarStack, MemberAvatar } from "@/components/groups/MemberAvatar";
import { useLocale } from "@/lib/i18n";
import type { Restaurant } from "@/lib/types";
import type { CandidateArea } from "@/lib/recommendation/types";

type SortMode = "match" | "rating";
type CandidateAreaResult = CandidateArea & { restaurants: Restaurant[] };
type DietaryNote = { memberName: string; labels: string[] };

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLocale();
  const { userId } = useUser();
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("match");
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<"delete" | "leave" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [decidedRestaurant, setDecidedRestaurant] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [candidateAreas, setCandidateAreas] = useState<CandidateAreaResult[]>([]);
  const [groupName, setGroupName] = useState("グループ");
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [members, setMembers] = useState<{ id: string; displayName: string; role: string; hasSurvey: boolean }[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [dietaryNotes, setDietaryNotes] = useState<DietaryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<"owner" | "member" | null>(null);

  useEffect(() => {
    async function fetchResults() {
      const supabase = createClient();

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

      try {
        const res = await fetch(`/api/groups/results?group_id=${id}&sort=${sortMode}`);
        const data = await res.json();

        if (data.candidateAreas) {
          setCandidateAreas(data.candidateAreas);
        }
        if (data.resolvedAreas) {
          setAreas(data.resolvedAreas);
        }
        if (data.dietaryNotes) {
          setDietaryNotes(data.dietaryNotes);
        }
      } catch (err) {
        console.error("Failed to fetch results:", err);
      }

      setLoading(false);
    }

    void fetchResults();
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
      const res = await fetch("/api/groups", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: id, profileId: userId, action }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "エラーが発生しました");
        setActionLoading(false);
        setShowConfirmDialog(null);
        return;
      }

      window.location.href = "/home";
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
          <div style={{ fontSize: 14 }}>{t("results.loading")}</div>
        </div>
      </div>
    );
  }

  const totalRestaurants = candidateAreas.reduce(
    (count, area) => count + area.restaurants.length,
    0
  );

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
          {t("results.backToHome")}
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
                    backgroundColor: "rgba(194,106,74,0.08)",
                    color: "var(--primary)",
                    borderRadius: 100,
                    padding: "4px 12px",
                    fontWeight: 500,
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
                      border: "1px solid var(--border-light)",
                      borderRadius: 16,
                      boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
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
                      {myRole === "owner" ? t("results.deleteGroupMenu") : t("results.leaveGroupMenu")}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 決定済みバナー */}
      {decidedRestaurant && (
        <div
          style={{
            margin: "0 20px 16px",
            backgroundColor: "rgba(61,139,94,0.06)",
            border: "1.5px solid rgba(61,139,94,0.2)",
            borderRadius: 20,
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success)", marginBottom: 2 }}>
              {t("results.decided")}
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
          {([["match", t("results.matchScore")], ["rating", t("results.rating")]] as [SortMode, string][]).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              style={{
                padding: "8px 20px",
                borderRadius: 100,
                border: "none",
                backgroundColor: sortMode === mode ? "var(--surface)" : "transparent",
                color: sortMode === mode ? "var(--text-primary)" : "var(--text-tertiary)",
                fontSize: 13,
                fontWeight: sortMode === mode ? 600 : 500,
                cursor: "pointer",
                boxShadow: sortMode === mode ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 8 }}>
          {t("results.resultCount", { count: totalRestaurants })}
        </div>
      </div>

      <div style={{ padding: "0 20px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
        {myRole === "owner" && dietaryNotes.length > 0 && (
          <section
            className="card"
            style={{
              padding: 18,
              backgroundColor: "rgba(194,106,74,0.06)",
              border: "1px solid rgba(194,106,74,0.14)",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
              幹事メモ
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
              食事制限とアレルギーの共有です。候補の並び替えには使っていません。
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {dietaryNotes.map((note) => (
                <div key={`${note.memberName}-${note.labels.join("-")}`}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                    {note.memberName}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {note.labels.map((label) => (
                      <span
                        key={`${note.memberName}-${label}`}
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
                </div>
              ))}
            </div>
          </section>
        )}

        {candidateAreas.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-secondary)", fontSize: 15 }}>
            {t("results.noResultsApi")}
          </div>
        ) : (
          candidateAreas.map((area, areaIndex) => (
            <section key={area.areaName} className="animate-fade-in" style={{ animationDelay: `${areaIndex * 0.06}s`, animationFillMode: "both" }}>
              <div
                className="card"
                style={{
                  padding: 18,
                  marginBottom: 12,
                  background:
                    areaIndex === 0
                      ? "linear-gradient(160deg, rgba(194,106,74,0.12), rgba(194,106,74,0.03))"
                      : "var(--surface)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)", marginBottom: 4 }}>
                      候補エリア {areaIndex + 1}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>
                      {area.areaName}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                      {area.stationName}
                    </div>
                  </div>
                  <div
                    style={{
                      alignSelf: "flex-start",
                      padding: "8px 12px",
                      borderRadius: 999,
                      backgroundColor: "rgba(26,26,46,0.06)",
                      color: "var(--secondary)",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {Math.round(area.scores.combined * 100)}%
                  </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {area.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 12,
                        backgroundColor: "rgba(194,106,74,0.08)",
                        color: "var(--primary)",
                        borderRadius: 100,
                        padding: "4px 10px",
                        fontWeight: 600,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                  {area.explanation}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {area.restaurants.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "18px 16px", color: "var(--text-secondary)", fontSize: 14 }}>
                    {t("results.noResultsArea")}
                  </div>
                ) : (
                  area.restaurants.map((restaurant) => (
                    <RestaurantCard
                      key={`${area.areaName}-${restaurant.id}`}
                      restaurant={restaurant}
                      onClick={setSelectedRestaurant}
                    />
                  ))
                )}
              </div>
            </section>
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
            borderRadius: 100,
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
          {t("results.decidedToast")}
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
              borderRadius: 24,
              padding: "32px 24px 24px",
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
              {showConfirmDialog === "delete" ? t("results.deleteGroup") : t("results.leaveGroup")}
            </div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.5 }}>
              {showConfirmDialog === "delete" ? t("results.deleteGroupDesc") : t("results.leaveGroupDesc")}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowConfirmDialog(null)}
                disabled={actionLoading}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 100,
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface)",
                  color: "var(--text-primary)",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => handleGroupAction(showConfirmDialog)}
                disabled={actionLoading}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 100,
                  border: "none",
                  backgroundColor: "var(--danger)",
                  color: "white",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: actionLoading ? "wait" : "pointer",
                  opacity: actionLoading ? 0.7 : 1,
                }}
              >
                {actionLoading ? t("common.processing") : showConfirmDialog === "delete" ? t("results.deleteConfirm") : t("results.leaveConfirm")}
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
              {t("results.groupMembers", { group: groupName })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {members.map((member) => (
                <div key={member.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <MemberAvatar name={member.displayName} size={40} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                      {member.displayName}
                      {member.role === "owner" && (
                        <span style={{ fontSize: 11, color: "var(--primary)", marginLeft: 6 }}>{t("results.organizer")}</span>
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
                    {member.hasSurvey ? t("results.answered") : t("results.notAnswered")}
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
