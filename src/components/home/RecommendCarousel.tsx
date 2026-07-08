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
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
          {t("home.recommendTitle")}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
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
          return (
            <button
              key={`${item.id}-${index}`}
              onClick={() => onSelect(item)}
              className="card"
              style={{
                flex: "0 0 164px",
                scrollSnapAlign: "start",
                padding: 0,
                overflow: "hidden",
                cursor: "pointer",
                textAlign: "left",
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  height: 92,
                  background: "linear-gradient(140deg, #FBEBC9, #F7DFA8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 34,
                  position: "relative",
                }}
              >
                {item.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.photoUrl}
                    alt={item.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  genreEmoji(item.genreId)
                )}
                {label && (
                  <span
                    style={{
                      position: "absolute",
                      top: 6,
                      left: 6,
                      right: 6,
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "4px 8px",
                      borderRadius: 100,
                      backgroundColor: item.isMemberFavorite
                        ? "var(--primary)"
                        : item.endorsementLabel
                          ? "var(--warning)"
                          : "rgba(255,255,255,0.94)",
                      color: item.isMemberFavorite
                        ? "white"
                        : "var(--secondary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </span>
                )}
              </div>
              <div style={{ padding: "10px 12px 12px" }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                  {names.length > 0 ? `${names.slice(0, 2).join("・")}の公開お気に入り` : item.area}
                </div>
              </div>
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}
