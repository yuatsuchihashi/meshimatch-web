"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const MESSAGES = [
  "みんなの好みを分析中...",
  "ティアランキングを集計中...",
  "エリアを特定中...",
  "レストランを検索中...",
  "一致度を計算中...",
];

export default function SearchingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 0.02;
        if (next >= 1) {
          clearInterval(interval);
          setTimeout(() => router.push(`/groups/${id}/results`), 300);
          return 1;
        }
        return next;
      });
    }, 60);

    const msgInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 1200);

    return () => {
      clearInterval(interval);
      clearInterval(msgInterval);
    };
  }, [id, router]);

  const percent = Math.round(progress * 100);

  return (
    <div
      style={{
        backgroundColor: "var(--bg)",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        textAlign: "center",
      }}
    >
      {/* Animated search icon with pulse rings */}
      <div style={{ position: "relative", marginBottom: 40 }}>
        {/* Pulse rings */}
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse-ring"
            style={{
              position: "absolute",
              inset: -(i * 20),
              borderRadius: "50%",
              border: `2px solid var(--primary)`,
              opacity: 0.3 / i,
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
        {/* Search icon */}
        <div
          className="animate-spin-slow"
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            backgroundColor: "rgba(196,85,42,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
        </div>
      </div>

      {/* Progress */}
      <div style={{ width: "100%", maxWidth: 280, marginBottom: 24 }}>
        <div
          style={{
            height: 6,
            backgroundColor: "var(--border-light)",
            borderRadius: 6,
            overflow: "hidden",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${percent}%`,
              backgroundColor: "var(--primary)",
              borderRadius: 6,
              transition: "width 0.1s linear",
            }}
          />
        </div>
        <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
          {percent}%
        </div>
      </div>

      {/* Message */}
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 8,
        }}
        key={messageIndex}
        className="animate-fade-in"
      >
        {MESSAGES[messageIndex]}
      </div>
      <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
        AIがベストマッチを探しています 🍽️
      </div>
    </div>
  );
}
