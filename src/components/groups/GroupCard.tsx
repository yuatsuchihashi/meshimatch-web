"use client";

import { useState } from "react";
import Link from "next/link";
import type { MeshiGroup } from "@/lib/types";
import { MemberAvatarStack, MemberAvatar } from "./MemberAvatar";

interface GroupCardProps {
  group: MeshiGroup;
  isHidden: boolean;
  onToggleHide: () => void;
}

function getStatusBadge(group: MeshiGroup) {
  if (group.decidedRestaurant) {
    return { label: "レストラン決定済み", color: "var(--secondary)", bg: "rgba(107,122,82,0.12)" };
  }
  const totalCount = group.members.length;
  const respondedCount = group.surveyResponses.length;
  if (respondedCount === totalCount) {
    return { label: "全員回答済み", color: "var(--secondary)", bg: "rgba(107,122,82,0.12)" };
  }
  if (respondedCount > 0) {
    return { label: "回答待ち", color: "var(--warning, #d97706)", bg: "rgba(217,119,6,0.1)" };
  }
  return { label: "未回答", color: "var(--text-tertiary)", bg: "var(--bg-secondary)" };
}

export function GroupCard({ group, isHidden, onToggleHide }: GroupCardProps) {
  const [showMembersModal, setShowMembersModal] = useState(false);
  const respondedCount = group.surveyResponses.length;
  const totalCount = group.members.length;
  const memberNames = group.members.map((m) => m.displayName);
  const status = getStatusBadge(group);

  return (
    <>
      <div
        className="card"
        style={{
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          opacity: isHidden ? 0.45 : 1,
          transition: "opacity 0.2s ease",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Link href={`/groups/${group.id}/results`} style={{ textDecoration: "none", flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: group.decidedRestaurant ? 8 : 4,
              }}
            >
              {group.name}
            </div>
            {group.decidedRestaurant && (
              <div
                style={{
                  backgroundColor: "rgba(107,122,82,0.1)",
                  border: "1px solid rgba(107,122,82,0.3)",
                  borderRadius: 12,
                  padding: "8px 12px",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--secondary)", marginBottom: 2 }}>
                  🎉 ここに決まりました！
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                  {group.decidedRestaurant}
                </div>
              </div>
            )}
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 8 }}>
            {/* Response count badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                backgroundColor: respondedCount === totalCount ? "rgba(107,122,82,0.12)" : "var(--bg-secondary)",
                borderRadius: 20,
                padding: "4px 10px",
                fontSize: 13,
                fontWeight: 600,
                color: respondedCount === totalCount ? "var(--secondary)" : "var(--text-secondary)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
              {respondedCount}回答あり
            </div>

            {/* Hide/unhide button */}
            <button
              onClick={onToggleHide}
              title={isHidden ? "表示する" : "非表示にする"}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: isHidden ? "var(--primary)" : "var(--text-tertiary)",
                padding: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isHidden ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Status badge */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: status.color,
              backgroundColor: status.bg,
              borderRadius: 20,
              padding: "3px 10px",
            }}
          >
            {status.label}
          </span>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Clickable avatar stack → member modal */}
          <button
            onClick={() => setShowMembersModal(true)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <MemberAvatarStack members={memberNames} size={28} />
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{totalCount}人</span>
          </button>
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            {group.resolvedAreas.map((area) => (
              <span
                key={area}
                style={{
                  fontSize: 12,
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-secondary)",
                  borderRadius: 8,
                  padding: "2px 8px",
                  fontWeight: 500,
                }}
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Members modal */}
      {showMembersModal && (
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
                  <div
                    key={member.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <MemberAvatar name={member.displayName} size={40} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                        {member.displayName}
                        {member.role === "owner" && (
                          <span style={{ fontSize: 11, color: "var(--primary)", marginLeft: 6, fontWeight: 500 }}>
                            幹事
                          </span>
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
    </>
  );
}
