"use client";

import { useState } from "react";
import Link from "next/link";
import { MOCK_GROUPS, MOCK_CURRENT_USER, MOCK_INVITATIONS } from "@/lib/mockData";
import { GroupCard } from "@/components/groups/GroupCard";

export default function HomePage() {
  const [showArchived, setShowArchived] = useState(false);

  const user = MOCK_CURRENT_USER;
  const activeGroups = MOCK_GROUPS.filter((g) => g.status === "active");
  const archivedGroups = MOCK_GROUPS.filter((g) => g.status === "archived");
  const invitationCount = MOCK_INVITATIONS.length;

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

        {/* Notification bell */}
        <Link href="/notifications" style={{ textDecoration: "none", position: "relative" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 4,
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-secondary)"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
              />
            </svg>
            {invitationCount > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  backgroundColor: "var(--primary)",
                  color: "white",
                  fontSize: 11,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid var(--bg)",
                }}
              >
                {invitationCount}
              </div>
            )}
          </div>
        </Link>
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
                <GroupCard key={group.id} group={group} />
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
                  <GroupCard key={group.id} group={group} />
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
