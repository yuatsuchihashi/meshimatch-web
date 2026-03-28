"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { MOCK_GROUPS } from "@/lib/mockData";

export default function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const group = MOCK_GROUPS.find((g) => g.id === id);
  const groupName = group?.name ?? "グループ";
  const memberCount = group?.members.length ?? 0;

  return (
    <div
      style={{
        backgroundColor: "var(--bg)",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
      }}
    >
      {/* Logo */}
      <div style={{ marginBottom: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🍽️</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "var(--primary)", letterSpacing: "-0.5px" }}>
          MeshiMatch
        </div>
      </div>

      {/* Card */}
      <div
        style={{
          backgroundColor: "var(--surface)",
          borderRadius: 24,
          padding: "28px 24px",
          border: "1px solid var(--border-light)",
          width: "100%",
          maxWidth: 400,
          textAlign: "center",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
        <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 4 }}>
          グループに招待されました
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "var(--text-primary)",
            marginBottom: 8,
          }}
        >
          {groupName}
        </div>
        <div
          style={{
            fontSize: 14,
            color: "var(--text-secondary)",
            marginBottom: 28,
          }}
        >
          {memberCount}人が参加中
        </div>

        <div
          style={{
            backgroundColor: "rgba(196,85,42,0.06)",
            borderRadius: 14,
            padding: "14px 16px",
            marginBottom: 28,
            textAlign: "left",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)", marginBottom: 6 }}>
            📋 アンケートに答えてね
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            好きな食べ物のジャンルをティア分けするだけ！
            AIがみんなの好みに合うお店を提案します。
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={() => router.push(`/invite/${id}/survey`)}
          style={{ width: "100%", fontSize: 16 }}
        >
          アンケートに答える →
        </button>

        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 16 }}>
          ログイン不要・1分で完了
        </div>
      </div>
    </div>
  );
}
