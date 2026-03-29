"use client";

import type { Restaurant } from "@/lib/types";
import { MatchScoreBar, ScoreBadge } from "@/components/ui/MatchScoreBar";

interface RestaurantCardProps {
  restaurant: Restaurant;
  onClick: (r: Restaurant) => void;
}

const GENRE_COLORS: Record<string, string> = {
  G001: "#CC7755",
  G002: "#6B6896",
  G003: "#8B6A4A",
  G004: "#CC7755",
  G005: "#8B1A1A",
  G006: "#A03030",
  G007: "#4A8A5A",
  G008: "#6B6896",
  G009: "#2D2B55",
  G010: "#8A6B3A",
  G013: "#8A6B3A",
  G014: "#CC7755",
  G016: "#6B3A2A",
  G017: "#2D6B8A",
  G018: "#2D2B55",
  G019: "#8B1A1A",
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

export function RestaurantCard({ restaurant, onClick }: RestaurantCardProps) {
  const genreColor = GENRE_COLORS[restaurant.genreId] ?? "var(--text-secondary)";

  return (
    <div
      className="card"
      style={{ overflow: "hidden", cursor: "pointer" }}
      onClick={() => onClick(restaurant)}
    >
      {/* Compact genre bar instead of large gradient hero */}
      <div
        style={{
          height: 6,
          backgroundColor: genreColor,
          borderRadius: "20px 20px 0 0",
        }}
      />

      {/* Content */}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Header: Name + Score badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: "var(--text-primary)",
              lineHeight: 1.3,
              flex: 1,
            }}
          >
            {restaurant.name}
          </div>
          <ScoreBadge score={restaurant.matchScore} />
        </div>

        {/* Genre & Budget chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 12,
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-secondary)",
              borderRadius: 8,
              padding: "3px 10px",
              fontWeight: 500,
            }}
          >
            {restaurant.genre}
          </span>
          <span
            style={{
              fontSize: 12,
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-secondary)",
              borderRadius: 8,
              padding: "3px 10px",
              fontWeight: 500,
            }}
          >
            {restaurant.budget}
          </span>
          {restaurant.hasPrivateRoom && (
            <span
              style={{
                fontSize: 12,
                backgroundColor: "rgba(45,43,85,0.08)",
                color: "var(--secondary)",
                borderRadius: 8,
                padding: "3px 10px",
                fontWeight: 500,
              }}
            >
              個室あり
            </span>
          )}
        </div>

        {/* Match score bar */}
        <div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, fontWeight: 500 }}>
            一致度
          </div>
          <MatchScoreBar score={restaurant.matchScore} height={8} />
        </div>

        {/* Rating & Access */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <StarRating rating={restaurant.rating} />
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
