"use client";

import { useState, useEffect } from "react";
import type { Restaurant } from "@/lib/types";
import { MatchScoreBar } from "@/components/ui/MatchScoreBar";

const GENRE_GRADIENTS: Record<string, [string, string]> = {
  G001: ["#C4552A", "#E8734A"],
  G002: ["#5B8A9A", "#7AAFC4"],
  G003: ["#9A6B4A", "#C48A6B"],
  G004: ["#C4552A", "#D47A2A"],
  G005: ["#8A3A2A", "#C45A3A"],
  G006: ["#C43A3A", "#E85A5A"],
  G007: ["#4A8A5A", "#6AAA7A"],
  G008: ["#6B7A52", "#8FA367"],
  G009: ["#4A5A8A", "#6A7AAA"],
  G010: ["#8A4A6B", "#AA6A8B"],
  G013: ["#8A6B3A", "#AA8B5A"],
  G014: ["#C4552A", "#E87A4A"],
  G016: ["#6B3A2A", "#8B5A4A"],
  G017: ["#2A6B8A", "#4A8BAA"],
  G018: ["#4A3A8A", "#6A5AAA"],
  G019: ["#6B2A2A", "#8B4A4A"],
};

interface Props {
  restaurant: Restaurant | null;
  onClose: () => void;
  onDecide?: (restaurant: Restaurant) => void;
}

export function RestaurantDetailModal({ restaurant, onClose, onDecide }: Props) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (restaurant) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [restaurant]);

  if (!restaurant) return null;

  const [g1, g2] = GENRE_GRADIENTS[restaurant.genreId] ?? ["#9A8B78", "#B8A898"];
  const percent = Math.round(restaurant.matchScore * 100);
  const scoreColor =
    restaurant.matchScore >= 0.8
      ? "var(--primary)"
      : restaurant.matchScore >= 0.6
      ? "var(--warning)"
      : "var(--text-tertiary)";

  function handleCopyAddress() {
    if (restaurant?.address) {
      navigator.clipboard.writeText(restaurant.address).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.2s ease",
        }}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        style={{
          position: "relative",
          backgroundColor: "var(--bg)",
          borderRadius: "24px 24px 0 0",
          maxHeight: "90dvh",
          overflowY: "auto",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.25s cubic-bezier(0.34,1.1,0.64,1)",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 40, height: 4, backgroundColor: "var(--border)", borderRadius: 2 }} />
        </div>

        {/* Gradient photo */}
        <div
          style={{
            height: 180,
            background: `linear-gradient(135deg, ${g1}, ${g2})`,
            margin: "12px 16px 0",
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: 600 }}>
              {restaurant.genre}
            </div>
          </div>
        </div>

        <div style={{ padding: "20px 20px 40px" }}>
          {/* Name */}
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
            {restaurant.name}
          </div>
          <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 16 }}>
            {restaurant.genre} · {restaurant.budget}
          </div>

          {/* Match score */}
          <div
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
              border: "1px solid var(--border-light)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>
                一致度
              </span>
              <span style={{ fontSize: 20, fontWeight: 800, color: scoreColor }}>
                {percent}%
              </span>
            </div>
            <MatchScoreBar score={restaurant.matchScore} height={12} />
          </div>

          {/* Details */}
          <div
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: 16,
              overflow: "hidden",
              border: "1px solid var(--border-light)",
              marginBottom: 16,
            }}
          >
            {[
              {
                icon: "★",
                label: "評価",
                value: `${restaurant.rating.toFixed(1)} / 5.0`,
              },
              {
                icon: "→",
                label: "アクセス",
                value: restaurant.access,
              },
              restaurant.address && {
                icon: "○",
                label: "住所",
                value: restaurant.address,
                action: (
                  <button
                    onClick={handleCopyAddress}
                    style={{
                      fontSize: 12,
                      color: "var(--primary)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "2px 8px",
                      borderRadius: 8,
                      backgroundColor: "rgba(204,119,85,0.08)",
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {copied ? "コピー済み" : "コピー"}
                  </button>
                ),
              },
              restaurant.phoneNumber && {
                icon: "☎",
                label: "電話",
                value: restaurant.phoneNumber,
              },
              restaurant.openHours && {
                icon: "◷",
                label: "営業時間",
                value: restaurant.openHours,
              },
              {
                icon: "□",
                label: "個室",
                value: restaurant.hasPrivateRoom ? "あり" : "なし",
              },
              restaurant.partyCapacity && {
                icon: "⊕",
                label: "収容人数",
                value: `最大${restaurant.partyCapacity}名`,
              },
            ]
              .filter(Boolean)
              .map((item, i, arr) => {
                const row = item as {
                  icon: string;
                  label: string;
                  value: string;
                  action?: React.ReactNode;
                };
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "14px 16px",
                      borderBottom: i < arr.length - 1 ? "1px solid var(--border-light)" : "none",
                    }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0, width: 20, textAlign: "center" }}>
                      {row.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 2 }}>
                        {row.label}
                      </div>
                      <div
                        style={{
                          fontSize: 15,
                          color: "var(--text-primary)",
                          wordBreak: "break-all",
                          lineHeight: 1.4,
                        }}
                      >
                        {row.value}
                      </div>
                    </div>
                    {row.action}
                  </div>
                );
              })}
          </div>

          {/* CTA buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {onDecide && (
              <button
                className="btn-primary"
                style={{ backgroundColor: "var(--success)", gap: 8, fontSize: 16, fontWeight: 800 }}
                onClick={() => { onDecide(restaurant); handleClose(); }}
              >
                このレストランに決定する
              </button>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                restaurant.name + (restaurant.address ? " " + restaurant.address : " " + restaurant.access)
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
            >
              <button className="btn-primary" style={{ gap: 8 }}>
                Mapで開く
              </button>
            </a>
            <button className="btn-secondary" onClick={handleClose}>
              閉じる
            </button>
          </div>
        </div>
      </div>

      {/* Copied toast */}
      {copied && (
        <div
          style={{
            position: "fixed",
            bottom: 100,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "var(--text-primary)",
            color: "white",
            padding: "10px 20px",
            borderRadius: 20,
            fontSize: 14,
            fontWeight: 600,
            zIndex: 110,
          }}
        >
          住所をコピーしました
        </div>
      )}
    </div>
  );
}
