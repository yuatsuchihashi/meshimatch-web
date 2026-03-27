"use client";

import { use, useState } from "react";
import Link from "next/link";
import { MOCK_GROUPS, MOCK_RESTAURANTS } from "@/lib/mockData";
import { RestaurantCard } from "@/components/restaurants/RestaurantCard";
import { RestaurantDetailModal } from "@/components/restaurants/RestaurantDetailModal";
import { MemberAvatarStack, MemberAvatar } from "@/components/groups/MemberAvatar";
import type { Restaurant } from "@/lib/types";

type SortMode = "match" | "rating";

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("match");
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [showMembersModal, setShowMembersModal] = useState(false);

  const group = MOCK_GROUPS.find((g) => g.id === id);
  const isNewGroup = !group;

  const groupName = group?.name ?? "新しいグループ";
  const memberNames = group?.members.map((m) => m.displayName) ?? ["ゆあ"];
  const areas = group?.resolvedAreas ?? ["渋谷"];

  // Filter restaurants
  const filteredRestaurants =
    selectedArea === "all"
      ? MOCK_RESTAURANTS
      : MOCK_RESTAURANTS.filter((r) => r.area === selectedArea);

  // Sort restaurants
  const sortedRestaurants = [...filteredRestaurants].sort((a, b) =>
    sortMode === "match" ? b.matchScore - a.matchScore : b.rating - a.rating
  );

  const allAreas = ["all", ...Array.from(new Set(MOCK_RESTAURANTS.map((r) => r.area)))];

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

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
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
                  📍 {area}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => setShowMembersModal(true)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <MemberAvatarStack members={memberNames} size={28} />
          </button>
        </div>
      </div>

      {/* Area tabs */}
      {allAreas.length > 2 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "0 20px 16px",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          {allAreas.map((area) => (
            <button
              key={area}
              onClick={() => setSelectedArea(area)}
              style={{
                padding: "7px 16px",
                borderRadius: 20,
                border: "1.5px solid",
                borderColor: selectedArea === area ? "var(--primary)" : "var(--border)",
                backgroundColor:
                  selectedArea === area ? "rgba(196,85,42,0.1)" : "var(--surface)",
                color: selectedArea === area ? "var(--primary)" : "var(--text-secondary)",
                fontSize: 14,
                fontWeight: selectedArea === area ? 700 : 500,
                cursor: "pointer",
                flexShrink: 0,
                whiteSpace: "nowrap",
                transition: "all 0.2s ease",
              }}
            >
              {area === "all" ? "すべて" : area}
            </button>
          ))}
        </div>
      )}

      {/* Sort tabs */}
      <div style={{ padding: "0 20px 16px" }}>
        <div
          style={{
            display: "inline-flex",
            backgroundColor: "var(--bg-secondary)",
            borderRadius: 12,
            padding: 4,
            gap: 4,
          }}
        >
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
                transition: "all 0.2s ease",
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
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              color: "var(--text-secondary)",
              fontSize: 15,
            }}
          >
            このエリアのお店が見つかりませんでした
          </div>
        ) : (
          sortedRestaurants.map((restaurant, i) => (
            <div
              key={restaurant.id}
              className="animate-fade-in"
              style={{ animationDelay: `${i * 0.05}s`, animationFillMode: "both" }}
            >
              <RestaurantCard
                restaurant={restaurant}
                onClick={setSelectedRestaurant}
              />
            </div>
          ))
        )}
      </div>

      {/* Detail modal */}
      <RestaurantDetailModal
        restaurant={selectedRestaurant}
        onClose={() => setSelectedRestaurant(null)}
      />

      {/* Members modal */}
      {showMembersModal && group && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
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
              {group.name} のメンバー
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {group.members.map((member) => {
                const hasResponded = group.surveyResponses.some((r) => r.memberName === member.displayName);
                return (
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
                        backgroundColor: hasResponded ? "rgba(107,122,82,0.12)" : "var(--bg-secondary)",
                        color: hasResponded ? "var(--secondary)" : "var(--text-tertiary)",
                      }}
                    >
                      {hasResponded ? "回答済み" : "未回答"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
