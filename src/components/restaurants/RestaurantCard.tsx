"use client";

import Image from "next/image";
import type { Restaurant } from "@/lib/types";
import { VerificationBadge } from "@/components/profile/VerificationBadge";
import { useLocale } from "@/lib/i18n";

interface RestaurantCardProps {
  restaurant: Restaurant;
  onClick: (r: Restaurant) => void;
}

const GENRE_COLORS: Record<string, string> = {
  G001: "var(--primary)",
  G002: "#6E6E7A",
  G003: "#8B6A4A",
  G004: "var(--primary)",
  G005: "var(--danger)",
  G006: "#A04040",
  G007: "var(--success-deep)",
  G008: "#6E6E7A",
  G009: "var(--secondary)",
  G010: "#8A6B3A",
  G013: "#8A6B3A",
  G014: "var(--primary)",
  G016: "#6B3A2A",
  G017: "#2D6B8A",
  G018: "var(--secondary)",
  G019: "var(--danger)",
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ display: "flex", gap: 1 }}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= Math.floor(rating);
          const half = !filled && star === Math.ceil(rating) && rating % 1 >= 0.5;
          return (
            <svg
              key={star}
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill={filled || half ? "var(--warning)" : "none"}
              stroke="var(--warning)"
              strokeWidth={1.5}
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          );
        })}
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--warning)" }}>
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

function initials(name: string) {
  return name.trim().slice(0, 1) || "人";
}

export function RestaurantCard({ restaurant, onClick }: RestaurantCardProps) {
  const { t } = useLocale();
  const genreColor = GENRE_COLORS[restaurant.genreId] ?? "var(--text-secondary)";
  const hasRating = restaurant.rating > 0;
  const recommenderNames = restaurant.recommendedByNames ?? [];
  const officialNames = restaurant.officialRecommendedByNames ?? [];
  const primaryLabel =
    restaurant.recommendationLabel ??
    restaurant.reasonTags?.find((tag) => tag !== "PR" && (tag.includes("おすすめ") || tag.includes("お気に入り"))) ??
    restaurant.reasonTags?.find((tag) => tag !== "PR") ??
    null;
  const supportingTags = (restaurant.reasonTags ?? [])
    .filter((tag) => tag !== "PR" && tag !== primaryLabel)
    .slice(0, 2);
  const hasOfficialBadge =
    officialNames.length > 0 || Boolean(primaryLabel?.includes("公式"));

  return (
    <div
      className="card restaurant-note-card"
      style={{
        overflow: "hidden",
        cursor: "pointer",
        position: "relative",
        padding: 0,
        borderColor: "rgba(226,207,192,0.95)",
      }}
      onClick={() => onClick(restaurant)}
    >
      <Image
        src="/img/service/07-restaurant-sticker-sheet.webp"
        alt=""
        width={86}
        height={56}
        className="service-deco"
        style={{
          position: "absolute",
          right: -6,
          bottom: -20,
          width: 68,
          height: "auto",
          opacity: 0.09,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "0 auto 0 0",
          width: 5,
          backgroundColor: genreColor,
          opacity: 0.72,
        }}
      />

      <div style={{ position: "relative", zIndex: 1, padding: "16px 16px 15px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div
            style={{
              width: 70,
              height: 70,
              borderRadius: 18,
              background: `linear-gradient(145deg, ${genreColor}, rgba(255,245,236,0.72))`,
              overflow: "hidden",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 22,
              fontWeight: 900,
              boxShadow: "0 8px 18px rgba(74,53,42,0.08)",
            }}
          >
            {restaurant.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={restaurant.photoUrl}
                alt={restaurant.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              "め"
            )}
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 7,
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: "var(--text-primary)",
                lineHeight: 1.28,
                wordBreak: "keep-all",
                overflowWrap: "anywhere",
              }}
            >
              {restaurant.name}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              {primaryLabel && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    backgroundColor: "rgba(240,90,40,0.09)",
                    color: "var(--primary)",
                    borderRadius: 100,
                    padding: "5px 11px",
                    fontWeight: 900,
                  }}
                >
                  {primaryLabel}
                  {hasOfficialBadge && <VerificationBadge title={t("official.badgeTitle")} compact />}
                </span>
              )}
              {restaurant.pr && (
                <span
                  style={{
                    fontSize: 11,
                    backgroundColor: "rgba(240,90,40,0.13)",
                    color: "var(--primary)",
                    borderRadius: 100,
                    padding: "5px 9px",
                    fontWeight: 900,
                  }}
                >
                  {t("official.prChip")}
                </span>
              )}
            </div>
          </div>
        </div>

        {recommenderNames.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex" }}>
              {recommenderNames.slice(0, 3).map((name, index) => (
                <span
                  key={`${name}-${index}`}
                  title={name}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: index % 2 === 0 ? "var(--success-deep)" : "var(--primary)",
                    color: "white",
                    fontSize: 11,
                    fontWeight: 900,
                    border: "2px solid var(--surface)",
                    marginLeft: index === 0 ? 0 : -7,
                  }}
                >
                  {initials(name)}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 800 }}>
              {recommenderNames.slice(0, 2).join("・")}
              {recommenderNames.length > 2 ? ` 他${recommenderNames.length - 2}人` : ""} の公開お気に入り
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 12,
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-secondary)",
              borderRadius: 100,
              padding: "5px 11px",
              fontWeight: 800,
            }}
          >
            {restaurant.genre || restaurant.area || "候補"}
          </span>
          {restaurant.budget && (
            <span
              style={{
                fontSize: 12,
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-secondary)",
                borderRadius: 100,
                padding: "5px 11px",
                fontWeight: 800,
              }}
            >
              {restaurant.budget}
            </span>
          )}
          {restaurant.hasPrivateRoom && (
            <span
              style={{
                fontSize: 12,
                backgroundColor: "rgba(26,26,46,0.06)",
                color: "var(--secondary)",
                borderRadius: 100,
                padding: "5px 11px",
                fontWeight: 800,
              }}
            >
              個室あり
            </span>
          )}
          {supportingTags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 12,
                backgroundColor: "rgba(168,198,134,0.15)",
                color: "var(--success-deep)",
                borderRadius: 100,
                padding: "5px 11px",
                fontWeight: 800,
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        {restaurant.reasonExplanation && (
          <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)" }}>
            {restaurant.reasonExplanation}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {hasRating ? <StarRating rating={restaurant.rating} /> : <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 700 }}>詳細を確認</span>}
          <span
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              maxWidth: "60%",
              textAlign: "right",
              lineHeight: 1.4,
            }}
          >
            {restaurant.access}
          </span>
        </div>
      </div>
    </div>
  );
}
