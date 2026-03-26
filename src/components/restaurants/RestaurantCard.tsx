"use client";

import type { Restaurant } from "@/lib/types";
import { MatchScoreBar, ScoreBadge } from "@/components/ui/MatchScoreBar";

interface RestaurantCardProps {
  restaurant: Restaurant;
  onClick: (r: Restaurant) => void;
}

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
  const [g1, g2] = GENRE_GRADIENTS[restaurant.genreId] ?? ["#9A8B78", "#B8A898"];

  return (
    <div
      className="card"
      style={{ overflow: "hidden", cursor: "pointer" }}
      onClick={() => onClick(restaurant)}
    >
      {/* Photo area */}
      <div
        style={{
          height: 140,
          background: `linear-gradient(135deg, ${g1}, ${g2})`,
          position: "relative",
          display: "flex",
          alignItems: "flex-end",
          padding: "12px 14px",
        }}
      >
        {/* Genre label */}
        <div
          style={{
            backgroundColor: "rgba(0,0,0,0.35)",
            color: "white",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            padding: "3px 10px",
            backdropFilter: "blur(8px)",
          }}
        >
          {restaurant.genre}
        </div>

        {/* Badges top-right */}
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            alignItems: "flex-end",
          }}
        >
          <ScoreBadge score={restaurant.matchScore} />
          {restaurant.hasPrivateRoom && (
            <div
              style={{
                backgroundColor: "rgba(0,0,0,0.4)",
                color: "white",
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 20,
                backdropFilter: "blur(8px)",
              }}
            >
              個室あり
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Name */}
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: 1.3,
          }}
        >
          {restaurant.name}
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
