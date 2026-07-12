"use client";

// ============================================================
// ホーム用おすすめカルーセル – 横スクロールの店ミニカード
// ============================================================
// 信頼レイヤー由来のおすすめを写真つきで横に流す。
// タップで詳細モーダル (マップ埋め込み) を開く。
// ============================================================

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";
import { genreEmoji } from "@/lib/genre-emoji";
import type { Restaurant } from "@/lib/types";
import { VerificationBadge } from "@/components/profile/VerificationBadge";
import { Chip, PhotoCard } from "@/components/v2";

export interface RecommendedRestaurant extends Restaurant {
  isMemberFavorite?: boolean;
  endorsementLabel?: string | null;
  publicFavoriteCount?: number;
  isCurated?: boolean;
}

export function RecommendCarousel({
  userId,
  onSelect,
}: {
  userId: string | null;
  onSelect: (restaurant: RecommendedRestaurant) => void;
}) {
  const { t } = useLocale();
  const [items, setItems] = useState<RecommendedRestaurant[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/recommendations?profile_id=${userId}`);
        const json = await res.json();
        if (!cancelled) setItems(json.recommendations ?? []);
      } catch {
        // おすすめは補助枠なので静かに諦める
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [userId]);

  if (!loaded || items.length === 0) return null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--v2-ink)", letterSpacing: "var(--v2-tracking-display)" }}>
          {t("home.recommendTitle")}
        </div>
        <div style={{ fontSize: 12, color: "var(--v2-muted)" }}>
          {t("home.recommendSub")}
        </div>
      </div>

      {/* 自動で横に流れ続けるマーキー。リストを2周分並べて -50% でループ。
          触っている間は停止。手動スクロールも可能 (overflow-x)。 */}
      <div
        style={{
          overflowX: "auto",
          margin: "0 -20px",
          padding: "2px 20px 8px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          className="carousel-track"
          style={{ ["--marquee-duration" as string]: `${Math.max(items.length * 4, 20)}s` }}
        >
        {[...items, ...items].map((item, index) => {
          const names = item.recommendedByNames ?? [];
          const officialNames = item.officialRecommendedByNames ?? [];
          const label =
            item.recommendationLabel ??
            (names[0]
              ? `${names[0]}さんが追加`
              : item.isMemberFavorite
                ? `★ ${t("home.recommendBadgeFavorite")}`
                : item.endorsementLabel
                  ? item.endorsementLabel
                  : (item.publicFavoriteCount ?? 0) > 0
                    ? t("home.recommendBadgePopular")
                    : null);
          const stateTag = item.reasonTags?.find((tag) => tag.includes("営業中") || tag.includes("要確認"));
          return (
            <button
              key={`${item.id}-${index}`}
              onClick={() => onSelect(item)}
              style={{
                flex: "0 0 226px",
                scrollSnapAlign: "start",
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
                border: "none",
                background: "none",
              }}
            >
              <PhotoCard
                photoSrc={item.photoUrl}
                photoAlt={item.name}
                placeholder={genreEmoji(item.genreId)}
                overlayStart={
                  label ? (
                    <Chip
                      label={
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {label}
                          {officialNames.length > 0 && <VerificationBadge title={t("official.badgeTitle")} compact />}
                        </span>
                      }
                    />
                  ) : null
                }
                overlayEnd={
                  <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {stateTag && (
                      <Chip variant={stateTag.includes("要確認") ? "honey" : "sage"} label={stateTag} />
                    )}
                    {item.pr && <Chip variant="blush" label={t("official.prChip")} />}
                  </span>
                }
                style={{ ["--v2-ticket-notch" as string]: "var(--v2-canvas)" }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: "var(--v2-ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.name}
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 7 }}>
                    {item.area && <Chip label={item.area} />}
                    {item.genre && <Chip label={item.genre} />}
                    {item.budget && <Chip label={item.budget} />}
                  </div>
                </div>
              </PhotoCard>
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}
