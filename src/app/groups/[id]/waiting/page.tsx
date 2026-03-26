"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { MOCK_GROUPS } from "@/lib/mockData";
import { MemberAvatarStack } from "@/components/groups/MemberAvatar";
import Link from "next/link";

export default function WaitingRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const group = MOCK_GROUPS.find((g) => g.id === id) ?? {
    id,
    name: "新しいグループ",
    inviteCode: "XXXX",
    status: "active" as const,
    members: [
      { id: "m1", displayName: "ゆあ", role: "owner" as const, hasSurvey: true },
    ],
    surveyResponses: [
      {
        id: "r1",
        memberName: "ゆあ",
        tierS: ["G005"],
        tierA: ["G001"],
        tierB: [],
        departureStation: "渋谷駅",
        preferredArea: "渋谷",
        submittedAt: new Date(),
      },
    ],
    resolvedAreas: ["渋谷"],
  };

  const respondedCount = group.surveyResponses.length;
  const totalCount = group.members.length;
  const respondedNames = group.surveyResponses.map((r) => r.memberName);
  const canSearch = respondedCount >= 2;

  function handleSearch() {
    router.push(`/groups/${id}/searching`);
  }

  return (
    <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh" }}>
      {/* Header */}
      <div style={{ padding: "60px 20px 24px" }}>
        <Link
          href="/home"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--primary)",
            textDecoration: "none",
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 20,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          ホームに戻る
        </Link>

        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
          {group.name}
        </div>

        {/* Area chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {group.resolvedAreas.map((area) => (
            <span
              key={area}
              style={{
                fontSize: 13,
                backgroundColor: "rgba(196,85,42,0.1)",
                color: "var(--primary)",
                borderRadius: 20,
                padding: "4px 12px",
                fontWeight: 600,
              }}
            >
              📍 {area}
            </span>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 20px 40px", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Response count circle */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 110,
              height: 110,
              borderRadius: "50%",
              border: "4px solid var(--primary)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(196,85,42,0.08)",
            }}
          >
            <span style={{ fontSize: 32, fontWeight: 800, color: "var(--primary)" }}>
              {respondedCount}
            </span>
            <span style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: -2 }}>
              / {totalCount}
            </span>
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 500 }}>
            回答件数
          </div>
        </div>

        {/* Members list */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>
            メンバー
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {group.members.map((member) => {
              const responded = respondedNames.includes(member.displayName);
              return (
                <div
                  key={member.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, var(--primary), var(--primary-light))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontWeight: 700,
                      fontSize: 15,
                      flexShrink: 0,
                    }}
                  >
                    {member.displayName.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                      {member.displayName}
                    </div>
                    {member.role === "owner" && (
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>幹事</div>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: responded ? "var(--secondary)" : "var(--text-tertiary)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {responded ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        回答済み
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        未回答
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Share button */}
        <button
          className="btn-secondary"
          onClick={() => alert("招待リンクをコピーしました！（デモ）")}
        >
          🔗 招待リンクを共有
        </button>

        {/* Search button */}
        <div>
          <button
            className="btn-primary"
            onClick={handleSearch}
            disabled={!canSearch}
          >
            🔍 お店を検索する
          </button>
          {!canSearch && (
            <div
              style={{
                fontSize: 13,
                color: "var(--text-tertiary)",
                textAlign: "center",
                marginTop: 8,
              }}
            >
              2名以上の回答が必要です
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
