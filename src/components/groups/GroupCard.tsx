"use client";

import Link from "next/link";
import type { MeshiGroup } from "@/lib/types";
import { MemberAvatarStack } from "./MemberAvatar";

interface GroupCardProps {
  group: MeshiGroup;
}

export function GroupCard({ group }: GroupCardProps) {
  const respondedCount = group.surveyResponses.length;
  const totalCount = group.members.length;
  const memberNames = group.members.map((m) => m.displayName);

  return (
    <Link
      href={`/groups/${group.id}/results`}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div
        className="card"
        style={{
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          transition: "transform 0.15s ease",
          cursor: "pointer",
        }}
        onTouchStart={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
        onTouchEnd={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 4,
              }}
            >
              {group.name}
            </div>
            {group.decidedRestaurant && (
              <div
                style={{
                  fontSize: 13,
                  color: "var(--secondary)",
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span>✓</span>
                {group.decidedRestaurant}
              </div>
            )}
          </div>
          {/* Response count badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              backgroundColor:
                respondedCount === totalCount
                  ? "rgba(107,122,82,0.12)"
                  : "var(--bg-secondary)",
              borderRadius: 20,
              padding: "4px 10px",
              fontSize: 13,
              fontWeight: 600,
              color:
                respondedCount === totalCount
                  ? "var(--secondary)"
                  : "var(--text-secondary)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            {respondedCount}/{totalCount}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <MemberAvatarStack members={memberNames} size={28} />
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
    </Link>
  );
}
