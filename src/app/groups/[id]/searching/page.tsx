"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n";

export default function SearchingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useLocale();
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  const MESSAGES = [
    t("searching.msg0"),
    t("searching.msg1"),
    t("searching.msg2"),
    t("searching.msg3"),
    t("searching.msg4"),
  ];
  const messageCount = MESSAGES.length;

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
      setMessageIndex((prev) => (prev + 1) % messageCount);
    }, 1200);

    return () => {
      clearInterval(interval);
      clearInterval(msgInterval);
    };
  }, [id, messageCount, router]);

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
        <div
          className="animate-spin-slow"
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            backgroundColor: "rgba(240,90,40,0.12)",
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
        {t("searching.aiSearching")}
      </div>
    </div>
  );
}
