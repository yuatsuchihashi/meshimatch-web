"use client";

import { useState } from "react";
import Link from "next/link";
import { MOCK_GROUPS, MOCK_CURRENT_USER } from "@/lib/mockData";
import { GroupCard } from "@/components/groups/GroupCard";

export default function HomePage() {
  const [showArchived, setShowArchived] = useState(false);
  const [hiddenGroupIds, setHiddenGroupIds] = useState<Set<string>>(new Set());

  const user = MOCK_CURRENT_USER;
  const activeGroups = MOCK_GROUPS.filter((g) => g.status === "active");
  const archivedGroups = MOCK_GROUPS.filter((g) => g.status === "archived");

  function toggleHide(groupId: string) {
    setHiddenGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
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
            {user.displayName}さん 👋
          </div>
        </div>
      </div>

      <div style={{ padding: "0 20px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Create Group CTA */}
        <Link href="/groups/create" style={{ textDecoration: "none" }}>
          <div
            style={{
              background: "linear-gradient(135deg, var(--primary), var(--primary-light))",
              borderRadius: 20,
              padding: 20,
              display: "flex",
              alignItems: "center",
              gap: 16,
              boxShadow: "0 4px 16px rgba(196,85,42,0.3)",
              transition: "transform 0.15s ease",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                backgroundColor: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: 26,
              }}
            >
              🎉
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "white", marginBottom: 4 }}>
                グループを作ろう
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                みんなで行くお店をAIが提案
              </div>
            </div>
            <div style={{ marginLeft: "auto", color: "rgba(255,255,255,0.7)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </Link>

        {/* Active Groups */}
        <div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: 12,
            }}
          >
            進行中のグループ
          </div>
          {activeGroups.length === 0 ? (
            <EmptyState />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {activeGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  isHidden={hiddenGroupIds.has(group.id)}
                  onToggleHide={() => toggleHide(group.id)}
                />
              ))}
            </div>
          )}
        </div>

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
                style={{
                  transform: showArchived ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}
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
                    isHidden={hiddenGroupIds.has(group.id)}
                    onToggleHide={() => toggleHide(group.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
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
      <div style={{ fontSize: 48 }}>🍽️</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>
        グループがありません
      </div>
      <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>
        「グループを作ろう」から始めてみましょう
      </div>
    </div>
  );
}
