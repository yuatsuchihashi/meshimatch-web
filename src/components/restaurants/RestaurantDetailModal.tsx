"use client";

import { useState, useEffect } from "react";
import type { Restaurant } from "@/lib/types";
import { useLocale } from "@/lib/i18n";

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
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!restaurant) return;

    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [restaurant]);

  if (!restaurant) return null;

  const [g1, g2] = GENRE_GRADIENTS[restaurant.genreId] ?? ["#9A8B78", "#B8A898"];
  const recommendationLabel =
    restaurant.recommendationLabel ??
    restaurant.reasonTags?.find((tag) => tag.includes("おすすめ") || tag.includes("お気に入り")) ??
    null;

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

        {/* 写真の代わりに: 公式写真があれば表示、なければGoogleマップ埋め込み */}
        {restaurant.photoUrl ? (
          <div style={{ margin: "12px 16px 0", borderRadius: 16, overflow: "hidden", height: 180 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={restaurant.photoUrl}
              alt={restaurant.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        ) : (
          <div style={{ margin: "12px 16px 0", borderRadius: 16, overflow: "hidden", height: 220, position: "relative", background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
            {/* キーレス埋め込み: /maps/embed?origin=mfe が X-Frame-Options なしで返る最終形 */}
            <iframe
              title={`${restaurant.name} の地図`}
              src={`https://www.google.com/maps/embed?origin=mfe&pb=!1m2!2m1!1s${encodeURIComponent(
                `${restaurant.name} ${restaurant.address ?? restaurant.area ?? ""}`
              )}!3m1!1sja`}
              style={{ width: "100%", height: "100%", border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}

        <div style={{ padding: "20px 20px 40px" }}>
          {/* Name */}
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
            {restaurant.name}
          </div>
          <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 16 }}>
            {restaurant.genre} · {restaurant.budget}
          </div>

          {recommendationLabel && (
            <div
              style={{
                backgroundColor: "rgba(240,90,40,0.08)",
                color: "var(--primary)",
                borderRadius: 16,
                padding: "12px 14px",
                marginBottom: 16,
                fontSize: 14,
                fontWeight: 800,
                border: "1px solid rgba(240,90,40,0.12)",
              }}
            >
              {recommendationLabel}
            </div>
          )}

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
                label: t("restaurantDetail.rating"),
                value: `${restaurant.rating.toFixed(1)} / 5.0`,
              },
              {
                icon: "→",
                label: t("restaurantDetail.access"),
                value: restaurant.access,
              },
              restaurant.address && {
                icon: "○",
                label: t("restaurantDetail.address"),
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
                      backgroundColor: "rgba(240,90,40,0.08)",
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {copied ? t("common.copied") : t("common.copy")}
                  </button>
                ),
              },
              restaurant.phoneNumber && {
                icon: "☎",
                label: t("restaurantDetail.phone"),
                value: restaurant.phoneNumber,
              },
              restaurant.openHours && {
                icon: "◷",
                label: t("restaurantDetail.openHours"),
                value: restaurant.openHours,
              },
              {
                icon: "□",
                label: t("restaurantDetail.privateRoom"),
                value: restaurant.hasPrivateRoom ? t("restaurantDetail.yes") : t("restaurantDetail.no"),
              },
              restaurant.partyCapacity && {
                icon: "⊕",
                label: t("restaurantDetail.capacity"),
                value: t("restaurantDetail.capacityValue", { n: String(restaurant.partyCapacity) }),
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
                {t("restaurantDetail.decide")}
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
                {t("restaurantDetail.openMap")}
              </button>
            </a>
            <button className="btn-secondary" onClick={handleClose}>
              {t("common.close")}
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
          {t("restaurantDetail.addressCopied")}
        </div>
      )}
    </div>
  );
}
