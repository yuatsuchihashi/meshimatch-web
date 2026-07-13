"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, Phone, RotateCcw } from "lucide-react";
import { Chip, CircleIconButton, PhotoCard, PillButton } from "@/components/v2";
import { useLocale } from "@/lib/i18n";
import { openingStateForRestaurant } from "@/lib/recommendation/ranking";
import type { InstantAggregate, InstantZoneSelection } from "@/lib/instant/types";
import type { InstantWinningGenre } from "@/lib/instant/winner";
import type { Restaurant } from "@/lib/types";
import styles from "../instant.module.css";

const GROUP_KEY = "meshimatch_instant_group";
const TICKET_KEY = "meshimatch_instant_ticket";
const FALLBACK_PHOTO = "/img/service/07-restaurant-sticker-sheet.webp";

type StoredGroup = {
  groupId: string;
  zone: InstantZoneSelection | null;
  partySize: number;
  aggregate: InstantAggregate;
  winner?: InstantWinningGenre;
};

type ResultsResponse = {
  results?: Restaurant[];
  fewCandidates?: boolean;
  error?: string;
};

function mapLink(restaurant: Restaurant) {
  const query = encodeURIComponent(
    [restaurant.name, restaurant.address, restaurant.area].filter(Boolean).join(" ")
  );
  if (restaurant.placeId) {
    return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${encodeURIComponent(
      restaurant.placeId
    )}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export default function InstantTop3Page() {
  const router = useRouter();
  const { t } = useLocale();
  const [stored, setStored] = useState<StoredGroup | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(GROUP_KEY);
    if (!raw) {
      router.replace("/instant");
      return;
    }
    setStored(JSON.parse(raw) as StoredGroup);
  }, [router]);

  useEffect(() => {
    if (!stored) return;
    const activeGroup = stored;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/groups/results?group_id=${activeGroup.groupId}`);
        const data = (await res.json()) as ResultsResponse;
        if (!res.ok) throw new Error(data.error ?? "failed");
        setRestaurants(data.results ?? []);
      } catch {
        setError(t("instant.top3LoadFailed"));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [stored, t]);

  const genreMatched = useMemo(
    () =>
      stored?.winner
        ? restaurants.filter((restaurant) => restaurant.genreId === stored.winner?.genreId)
        : restaurants,
    [restaurants, stored?.winner]
  );
  const hasGenreMatches = genreMatched.length > 0;
  const displayPool = hasGenreMatches ? genreMatched : restaurants;
  const visible = useMemo(
    () => displayPool.slice(offset, offset + 3),
    [displayPool, offset]
  );

  function redraw() {
    if (displayPool.length <= 3) {
      setOffset(0);
      return;
    }
    const next = offset + 3;
    setOffset(next >= displayPool.length ? 0 : next);
  }

  async function chooseRestaurant(restaurant: Restaurant) {
    if (!stored) return;
    const res = await fetch("/api/groups/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId: stored.groupId,
        restaurantName: restaurant.name,
        restaurantId: restaurant.id,
        genreId: restaurant.genreId,
      }),
    });
    if (!res.ok) {
      setError(t("instant.top3LoadFailed"));
      return;
    }
    localStorage.setItem(
      TICKET_KEY,
      JSON.stringify({
        groupId: stored.groupId,
        zone: stored.zone,
        partySize: stored.partySize,
        aggregate: stored.aggregate,
        restaurant,
        decidedAt: new Date().toISOString(),
      })
    );
    router.push("/instant/ticket");
  }

  if (!stored) {
    return <main className={styles.screen} />;
  }

  const isEmpty = !loading && visible.length === 0;

  return (
    <main className={styles.screen}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>{t("instant.top3Eyebrow")}</span>
          <h1 className={styles.title}>
            {stored.winner
              ? t("instant.top3TitleWithGenre", { genre: stored.winner.name })
              : t("instant.top3Title")}
          </h1>
          <p className={styles.desc}>
            {stored.zone
              ? t("instant.top3DescWithZone", { zone: stored.zone.name })
              : t("instant.top3DescLocationless")}
          </p>
        </header>

        {loading && <section className={styles.panel}>{t("common.loading")}</section>}
        {error && <section className={styles.panel}>{error}</section>}

        {isEmpty && (
          <section className={`${styles.empty} ${styles.stack}`}>
            <h2 className={styles.restaurantName}>{t("instant.thinPoolTitle")}</h2>
            <p className={styles.desc}>{t("instant.thinPoolDesc")}</p>
            <Link className={styles.anchorPill} href={`/groups/${stored.groupId}/suggest`}>
              {t("instant.addByLink")}
            </Link>
          </section>
        )}

        {!loading && !isEmpty && !hasGenreMatches && stored.winner && (
          <section className={`${styles.empty} ${styles.stack}`}>
            <h2 className={styles.restaurantName}>
              {t("instant.genrePoolEmptyTitle", { genre: stored.winner.name })}
            </h2>
            <p className={styles.desc}>{t("instant.genrePoolEmptyDesc")}</p>
          </section>
        )}

        <section className={styles.stack}>
          {visible.map((restaurant) => {
            const openState = openingStateForRestaurant(restaurant);
            const phone = restaurant.phoneNumber?.trim();
            return (
              <PhotoCard
                key={restaurant.id}
                photoSrc={restaurant.photoUrl ?? FALLBACK_PHOTO}
                photoAlt={restaurant.name}
                overlayStart={
                  <Chip variant={openState === "open" ? "sage" : "honey"}>
                    {openState === "open" ? t("instant.openNow") : t("instant.checkHours")}
                  </Chip>
                }
                overlayEnd={
                  restaurant.pr ? <Chip variant="blush">{t("official.prChip")}</Chip> : null
                }
                panelAction={
                  phone ? (
                    <CircleIconButton
                      icon={<Phone size={18} />}
                      label={t("instant.call")}
                      onClick={() => {
                        window.location.href = `tel:${phone}`;
                      }}
                    />
                  ) : undefined
                }
              >
                <div className={styles.cardText}>
                  <h2 className={styles.restaurantName}>{restaurant.name}</h2>
                  <p className={styles.restaurantMeta}>
                    {[restaurant.area, restaurant.budget].filter(Boolean).join(" / ")}
                  </p>
                  <div className={styles.chipGrid} style={{ marginTop: 10 }}>
                    {(restaurant.reasonTags ?? []).slice(0, 3).map((tag) => (
                      <Chip key={tag}>{tag}</Chip>
                    ))}
                  </div>
                  <div className={styles.actions} style={{ marginTop: 12 }}>
                    <PillButton variant="cta" onClick={() => chooseRestaurant(restaurant)}>
                      {t("instant.chooseHere")}
                    </PillButton>
                    <a className={styles.anchorPill} href={mapLink(restaurant)} target="_blank">
                      <MapPin size={16} />
                      {t("instant.openMap")}
                    </a>
                  </div>
                </div>
              </PhotoCard>
            );
          })}
        </section>

        {!isEmpty && !loading && (
          <div className={styles.actions} style={{ marginTop: 16 }}>
            <PillButton variant="ghost" icon={<RotateCcw size={18} />} onClick={redraw}>
              {t("instant.redraw")}
            </PillButton>
            <Link className={styles.anchorPill} href={`/groups/${stored.groupId}/suggest`}>
              {t("instant.addByLink")}
            </Link>
            <Link className={styles.anchorPill} href="/instant/round?add=1">
              {t("instant.addLater")}
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
