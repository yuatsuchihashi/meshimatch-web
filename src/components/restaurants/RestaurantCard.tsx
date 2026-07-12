"use client";

import type { Restaurant } from "@/lib/types";
import { VerificationBadge } from "@/components/profile/VerificationBadge";
import { useLocale } from "@/lib/i18n";
import { Chip, PhotoCard } from "@/components/v2";

interface RestaurantCardProps {
  restaurant: Restaurant;
  onClick: (r: Restaurant) => void;
}

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
  const stateTags = (restaurant.reasonTags ?? [])
    .filter((tag) => tag.includes("営業中") || tag.includes("要確認"))
    .slice(0, 1);
  const hasOfficialBadge =
    officialNames.length > 0 || Boolean(primaryLabel?.includes("公式"));

  return (
    <div
      className="v2-scope"
      style={{
        cursor: "pointer",
      }}
      onClick={() => onClick(restaurant)}
    >
      <PhotoCard
        photoSrc={restaurant.photoUrl}
        photoAlt={restaurant.name}
        placeholder="め"
        overlayStart={
          primaryLabel ? (
            <Chip
              label={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {primaryLabel}
                  {hasOfficialBadge && <VerificationBadge title={t("official.badgeTitle")} compact />}
                </span>
              }
            />
          ) : null
        }
        overlayEnd={
          <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {stateTags.map((tag) => (
              <Chip key={tag} variant={tag.includes("要確認") ? "honey" : "sage"} label={tag} />
            ))}
            {restaurant.pr && <Chip variant="blush" label={t("official.prChip")} />}
          </span>
        }
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "var(--v2-ink)",
                lineHeight: 1.28,
                wordBreak: "keep-all",
                overflowWrap: "anywhere",
              }}
            >
              {restaurant.name}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {restaurant.area && <Chip label={restaurant.area} />}
              {(restaurant.genre || !restaurant.area) && <Chip label={restaurant.genre || "候補"} />}
              {restaurant.budget && <Chip label={restaurant.budget} />}
              {restaurant.hasPrivateRoom && <Chip label="個室あり" />}
              {supportingTags
                .filter((tag) => !tag.includes("営業中") && !tag.includes("要確認"))
                .map((tag) => (
                  <Chip key={tag} variant="sage" label={tag} />
                ))}
            </div>
            {restaurant.reasonExplanation && (
              <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--v2-muted)" }}>
                {restaurant.reasonExplanation}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              {hasRating ? <StarRating rating={restaurant.rating} /> : <span style={{ fontSize: 12, color: "var(--v2-muted)", fontWeight: 700 }}>詳細を確認</span>}
              <span
                style={{
                  fontSize: 12,
                  color: "var(--v2-muted)",
                  maxWidth: "58%",
                  textAlign: "right",
                  lineHeight: 1.4,
                }}
              >
                {restaurant.access}
              </span>
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
                        backgroundColor: index % 2 === 0 ? "var(--v2-ink)" : "var(--v2-accent)",
                        color: "white",
                        fontSize: 11,
                        fontWeight: 900,
                        border: "2px solid var(--v2-surface)",
                        marginLeft: index === 0 ? 0 : -7,
                      }}
                    >
                      {initials(name)}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "var(--v2-muted)", fontWeight: 800 }}>
                  {recommenderNames.slice(0, 2).join("・")}
                  {recommenderNames.length > 2 ? ` 他${recommenderNames.length - 2}人` : ""} の公開お気に入り
                </div>
              </div>
            )}
          </div>
        </div>
      </PhotoCard>
    </div>
  );
}
