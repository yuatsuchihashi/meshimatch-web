"use client";

import { use, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import { RestaurantCard } from "@/components/restaurants/RestaurantCard";
import { RestaurantDetailModal } from "@/components/restaurants/RestaurantDetailModal";
import { MemberAvatarStack, MemberAvatar } from "@/components/groups/MemberAvatar";
import { useLocale } from "@/lib/i18n";
import { track, AnalyticsEvent } from "@/lib/analytics";
import { Confetti } from "@/components/ui/Confetti";
import { TicketSheet } from "@/components/results/TicketSheet";
import type { Restaurant } from "@/lib/types";
import type { CandidateArea } from "@/lib/recommendation/types";

type CandidateAreaResult = CandidateArea & { restaurants: Restaurant[] };
type DietaryNote = { memberName?: string; labels: string[] };

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLocale();
  const { userId } = useUser();
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [selectedArea, setSelectedArea] = useState<CandidateAreaResult | null>(null);
  const [areaLines, setAreaLines] = useState<{ name: string; color: string | null }[] | null>(null);
  const [searchSeed, setSearchSeed] = useState<number | null>(null);
  const [fewCandidates, setFewCandidates] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<"delete" | "leave" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [decidedRestaurant, setDecidedRestaurant] = useState<string | null>(null);
  const [decidedArea, setDecidedArea] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [showTicket, setShowTicket] = useState(false);
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
          scheduled_at,
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
        if ((group as { scheduled_at?: string | null }).scheduled_at) {
          setScheduledAt(new Date((group as { scheduled_at: string }).scheduled_at));
        }
      }

      try {
        const res = await fetch(`/api/groups/results?group_id=${id}${searchSeed ? `&seed=${searchSeed}` : ""}`);
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
        setFewCandidates(Boolean(data.fewCandidates));
      } catch (err) {
        console.error("Failed to fetch results:", err);
      }

      setLoading(false);
    }

    void fetchResults();
  }, [id, userId, searchSeed]);

  // エリアシートを開いたら Transit API で「何線が通ってるか」を引く
  useEffect(() => {
    if (!selectedArea) {
      return;
    }
    let cancelled = false;
    async function fetchLines() {
      try {
        const station = selectedArea!.stationName.replace(/駅$/, "");
        const res = await fetch(
          `https://api.transit.ls8h.com/api/v1/locations/suggest?q=${encodeURIComponent(station)}`
        );
        const json = await res.json();
        const stationIds = ((json.stations ?? []) as { id: string; name: string }[])
          .filter((entry) => entry.name === station)
          .map((entry) => entry.id);

        // 各フィードの駅詳細から正式な路線名 + ラインカラーを集める
        const details = await Promise.all(
          stationIds.slice(0, 8).map(async (id) => {
            try {
              const detailRes = await fetch(
                `https://api.transit.ls8h.com/api/v1/stations/${encodeURIComponent(id)}`
              );
              const detail = await detailRes.json();
              return (detail.routes ?? []) as { name: string; color?: string }[];
            } catch {
              return [];
            }
          })
        );

        const seen = new Map<string, { name: string; color: string | null }>();
        for (const route of details.flat()) {
          // 「山手線（外回り）」「埼京線（大宮方面）」→「山手線」「埼京線」に正規化
          const name = (route.name ?? "").split("（")[0].split("(")[0].trim();
          if (!name || seen.has(name)) continue;
          seen.set(name, {
            name,
            color: route.color ? `#${route.color.replace(/^#/, "")}` : null,
          });
        }
        if (!cancelled) setAreaLines([...seen.values()]);
      } catch {
        if (!cancelled) setAreaLines([]);
      }
    }
    void fetchLines();
    return () => { cancelled = true; };
  }, [selectedArea]);

  // result_viewed: 提案画面の閲覧（ファネル）
  useEffect(() => {
    track(AnalyticsEvent.RESULT_VIEWED, { groupId: id });
  }, [id]);

  async function handleDecide(restaurant: Restaurant) {
    // 楽観更新: 紙吹雪とトーストは即時、保存は裏で走らせる
    setDecidedRestaurant(restaurant.name);
    setDecidedArea(restaurant.area ?? null);
    track(AnalyticsEvent.RESTAURANT_DECIDED, { groupId: id, restaurantId: restaurant.id });
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);

    const supabase = createClient();
    void supabase.from("decisions").upsert(
      {
        group_id: id,
        restaurant_name: restaurant.name,
        restaurant_id: restaurant.id,
        genre_id: restaurant.genreId,
        decided_by: userId,
      },
      { onConflict: "group_id" }
    );
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

  // 店はエリア別に分けず、全エリアをまとめてフラット一覧で見せる
  const flatRestaurants = (() => {
    const seen = new Set<string>();
    return candidateAreas
      .flatMap((area) => area.restaurants)
      .filter((restaurant) => {
        if (seen.has(restaurant.id)) return false;
        seen.add(restaurant.id);
        return true;
      });
  })();

  return (
    <div className="service-canvas" style={{ minHeight: "100dvh" }}>
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
            {/* 候補エリア: タップで概要シート */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600 }}>
                候補エリア:
              </span>
              {areas.map((area) => (
                <button
                  key={area}
                  onClick={() => {
                    const info = candidateAreas.find((c) => c.areaName === area);
                    if (info) {
                      setAreaLines(null);
                      setSelectedArea(info);
                    }
                  }}
                  style={{
                    fontSize: 12,
                    backgroundColor: "rgba(240,90,40,0.08)",
                    color: "var(--primary)",
                    borderRadius: 100,
                    padding: "4px 12px",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {area} ›
                </button>
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

      {/* ○×投票 CTA */}
      {!decidedRestaurant && !loading && candidateAreas.length > 0 && (
        <div style={{ padding: "0 20px 16px" }}>
          <Link href={`/groups/${id}/vote`} className="btn-primary" style={{ textDecoration: "none" }}>
            {t("vote.startVoting")}
          </Link>
        </div>
      )}

      {/* 自分の回答を編集する (控えめなテキストリンク・未決定時のみ) */}
      {!decidedRestaurant && (
        <div style={{ padding: "0 20px 16px", textAlign: "center" }}>
          <Link
            href={`/groups/${id}/survey`}
            style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "underline" }}
          >
            {t("results.editMyResponse")}
          </Link>
        </div>
      )}

      {/* 決定済みバナー */}
      {decidedRestaurant && (
        <div
          className="service-card"
          style={{
            position: "relative",
            margin: "0 20px 16px",
            backgroundColor: "rgba(168,198,134,0.14)",
            border: "1.5px solid rgba(168,198,134,0.55)",
            borderRadius: 20,
            padding: "14px 126px 14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            minHeight: 118,
          }}
        >
          <Image
            src="/img/service/04-result-ticket-check.webp"
            alt=""
            width={134}
            height={102}
            className="service-deco"
            style={{
              position: "absolute",
              right: -4,
              bottom: -2,
              width: 124,
              height: "auto",
              opacity: 0.96,
            }}
          />
          <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success-deep)", marginBottom: 2 }}>
              {t("results.decided")}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              {decidedRestaurant}
            </div>
            {/* 決定後の導線: 地図と予約検索 */}
            <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button
                onClick={() => setShowTicket(true)}
                style={{
                  fontSize: 12, fontWeight: 700, color: "white", backgroundColor: "var(--primary)",
                  border: "none", borderRadius: 100, padding: "6px 14px", cursor: "pointer",
                }}
              >
                チケットを見る
              </button>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(decidedRestaurant)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)", textDecoration: "none" }}
              >
                Googleマップ →
              </a>

            </div>
          </div>
        </div>
      )}

      {/* グロースCTA: 決定を見た参加者 → 次の幹事へ（要件セクション6） */}
      {decidedRestaurant && (
        <Link
          href="/groups/create?from=decided"
          className="service-create-card"
          style={{
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            margin: "0 20px 16px",
            padding: "16px 94px 16px 16px",
            borderRadius: 16,
            border: "1px dashed var(--border)",
            textDecoration: "none",
            minHeight: 86,
          }}
        >
          <Image
            src="/img/service/02-create-group-plate.webp"
            alt=""
            width={96}
            height={77}
            className="service-deco"
            style={{
              position: "absolute",
              right: 4,
              bottom: -10,
              width: 88,
              height: "auto",
              opacity: 0.9,
            }}
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>
              自分のグループでもやってみる
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
              次の食事会、あなたが幹事に
            </div>
          </div>
          <span style={{ position: "relative", zIndex: 1, fontSize: 18, fontWeight: 800, color: "var(--primary)" }}>→</span>
        </Link>
      )}

      {/* 候補が少ないよ (持ち寄りを促す) */}
      {fewCandidates && !decidedRestaurant && (
        <div
          style={{
            margin: "0 20px 14px",
            backgroundColor: "rgba(243,201,107,0.22)",
            border: "1px solid rgba(243,201,107,0.6)",
            borderRadius: 16,
            padding: "12px 16px",
          }}
        >
          <div style={{ fontSize: 13, color: "var(--secondary)", lineHeight: 1.6 }}>
            {t("results.fewCandidates")}
          </div>
          <Link
            href={`/groups/${id}/suggest`}
            style={{ display: "inline-block", marginTop: 6, fontSize: 13, fontWeight: 700, color: "var(--primary)", textDecoration: "none" }}
          >
            {t("results.addSuggestion")}
          </Link>
        </div>
      )}

      {/* 件数 + 再検索 */}
      <div style={{ padding: "0 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
          {t("results.resultCount", { count: flatRestaurants.length })}
        </div>
        <button
          onClick={() => { setLoading(true); setSearchSeed(Math.floor(Math.random() * 1e9) + 1); }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 13, fontWeight: 700, color: "var(--primary)",
            background: "none", border: "1.5px solid var(--border-strong)",
            borderRadius: 100, padding: "6px 14px", cursor: "pointer",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 11a8 8 0 1 0-2.34 5.66" />
            <path d="M20 5v6h-6" />
          </svg>
          もう一度探す
        </button>
      </div>

      <div style={{ padding: "0 20px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* 幹事メモ: 付箋メモ風。ひと目で「誰が何NG」が読める1行形式 */}
        {myRole === "owner" && dietaryNotes.length > 0 && (
          <section
            style={{
              padding: "14px 16px",
              backgroundColor: "#FBF0CE",
              border: "1px solid #EFD990",
              borderRadius: 4,
              boxShadow: "0 2px 8px rgba(74,53,42,0.08)",
              transform: "rotate(-0.4deg)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--secondary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              📌 幹事メモ: お店選びのとき気をつけて
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {dietaryNotes.map((note, index) => (
                <div
                  key={`note-${index}-${note.labels.join("-")}`}
                  style={{ fontSize: 13, color: "var(--secondary)", lineHeight: 1.6 }}
                >
                  ・<strong>{note.memberName || `参加者${index + 1}`}</strong>: {note.labels.join("、")} NG
                </div>
              ))}
            </div>
          </section>
        )}

        {flatRestaurants.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-secondary)", fontSize: 15 }}>
            {t("results.noResultsApi")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {flatRestaurants.map((restaurant) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                onClick={setSelectedRestaurant}
              />
            ))}
          </div>
        )}
      </div>

      {/* エリア概要ボトムシート */}
      {selectedArea && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 220, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
        >
          <div
            style={{ position: "absolute", inset: 0, backgroundColor: "rgba(74,53,42,0.45)" }}
            onClick={() => setSelectedArea(null)}
          />
          <div
            className="animate-fade-in"
            style={{
              position: "relative",
              backgroundColor: "var(--bg)",
              borderRadius: "24px 24px 0 0",
              padding: "20px 20px 40px",
              maxHeight: "70dvh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              <div style={{ width: 40, height: 4, backgroundColor: "var(--border)", borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>
              {selectedArea.areaName}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2, marginBottom: 12 }}>
              {selectedArea.stationName}
            </div>
            {/* 通っている路線 (Transit API)。一般論の説明文は出さない */}
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>
              通っている路線
            </div>
            {areaLines === null ? (
              <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>読み込み中…</div>
            ) : areaLines.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>路線情報を取得できなかった</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {areaLines.map((line) => (
                  <span
                    key={line.name}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      fontSize: 13, backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)",
                      borderRadius: 100, padding: "6px 12px", fontWeight: 600,
                    }}
                  >
                    <span
                      style={{
                        width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                        backgroundColor: line.color ?? "var(--border-strong)",
                      }}
                    />
                    {line.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail modal */}
      <RestaurantDetailModal
        restaurant={selectedRestaurant}
        onClose={() => setSelectedRestaurant(null)}
        onDecide={handleDecide}
      />

      {/* チケット */}
      {showTicket && decidedRestaurant && (
        <TicketSheet
          data={{
            groupName,
            restaurantName: decidedRestaurant,
            area: decidedArea ?? flatRestaurants.find((r) => r.name === decidedRestaurant)?.area ?? null,
            scheduledAt,
            memberNames: members.map((m) => m.displayName),
          }}
          onClose={() => setShowTicket(false)}
        />
      )}

      {/* 決定トースト */}
      {showToast && <Confetti />}
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
