"use client";

import { InstantDiscoveryBoundary } from "@/components/instant/DiscoveryFlow";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, MapPin, Phone, RotateCcw, ShieldCheck } from "lucide-react";
import { Chip, CircleIconButton, PhotoCard, PillButton } from "@/components/v2";
import { AnalyticsEvent, track } from "@/lib/analytics";
import { useLocale } from "@/lib/i18n";
import {
  INSTANT_BALLOT_NONE,
  resolveInstantBallot,
  selectDiverseInstantShortlist,
  type InstantBallotResolution,
} from "@/lib/instant/ballot";
import { INSTANT_DEMO_RESTAURANTS } from "@/lib/instant/demo-restaurants";
import { openingStateForRestaurant } from "@/lib/recommendation/ranking";
import type { InstantAggregate, InstantZoneSelection } from "@/lib/instant/types";
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
};

type ResultsResponse = {
  results?: Restaurant[];
  fewCandidates?: boolean;
  error?: string;
};

type BallotPhase = "shortlist" | "handoff" | "ballot" | "result";

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

function InstantTop3PageLegacy() {
  const router = useRouter();
  const { t } = useLocale();
  const [stored, setStored] = useState<StoredGroup | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<BallotPhase>("shortlist");
  const [votes, setVotes] = useState<string[][]>([]);
  const [selectedVotes, setSelectedVotes] = useState<string[]>([]);
  const [resolution, setResolution] = useState<InstantBallotResolution | null>(null);

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
        const results = data.results ?? [];
        const usedDemoFallback =
          results.length === 0 && process.env.NEXT_PUBLIC_MESHIMATCH_LOCAL_MODE === "1";
        const nextRestaurants = usedDemoFallback ? INSTANT_DEMO_RESTAURANTS : results;
        setRestaurants(nextRestaurants);
        track(AnalyticsEvent.INSTANT_CANDIDATES_SHOWN, {
          groupId: activeGroup.groupId,
          shortlistCount: Math.min(3, nextRestaurants.length),
          poolCount: nextRestaurants.length,
          source: usedDemoFallback
            ? "demo_fallback"
            : results.length === 0
              ? "trust_ring_empty"
              : "trust_ring",
        });
      } catch {
        setError(t("instant.top3LoadFailed"));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [stored, t]);

  const visible = useMemo(
    () => selectDiverseInstantShortlist(restaurants, offset, 3),
    [restaurants, offset]
  );
  const candidateIds = useMemo(() => visible.map((restaurant) => restaurant.id), [visible]);
  const currentVoter = votes.length + 1;
  const voteProgress = stored ? Math.round((votes.length / stored.partySize) * 100) : 0;
  const winner = useMemo(() => {
    if (resolution?.status !== "winner") return null;
    return visible.find((restaurant) => restaurant.id === resolution.winnerId) ?? null;
  }, [resolution, visible]);

  function resetBallot(nextPhase: BallotPhase = "shortlist") {
    setVotes([]);
    setSelectedVotes([]);
    setResolution(null);
    setPhase(nextPhase);
  }

  function startVoting() {
    resetBallot("handoff");
  }

  function submitVote() {
    if (!stored || selectedVotes.length === 0) return;
    const nextVotes = [...votes, selectedVotes];
    setVotes(nextVotes);
    setSelectedVotes([]);
    if (nextVotes.length >= stored.partySize) {
      const nextResolution = resolveInstantBallot({ candidateIds, votes: nextVotes });
      setResolution(nextResolution);
      track(AnalyticsEvent.INSTANT_BALLOT_COMPLETED, {
        groupId: stored.groupId,
        partySize: stored.partySize,
        result: nextResolution.status,
        tied: nextResolution.tied,
      });
      setPhase("result");
      return;
    }
    setPhase("handoff");
  }

  function toggleVote(value: string) {
    setSelectedVotes((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      if (value === INSTANT_BALLOT_NONE) return [INSTANT_BALLOT_NONE];
      return [...current.filter((item) => item !== INSTANT_BALLOT_NONE), value];
    });
  }

  function redraw() {
    if (stored) {
      track(AnalyticsEvent.INSTANT_REDRAWN, {
        groupId: stored.groupId,
        candidateIds,
      });
    }
    if (restaurants.length <= 3) {
      setOffset(0);
    } else {
      const next = offset + 3;
      setOffset(next >= restaurants.length ? 0 : next);
    }
    resetBallot("shortlist");
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
        approvalCount:
          resolution?.status === "winner"
            ? (resolution.counts[restaurant.id] ?? 0)
            : undefined,
        tied: resolution?.status === "winner" ? resolution.tied : false,
        decidedAt: new Date().toISOString(),
      })
    );
    track(AnalyticsEvent.INSTANT_DECIDED, {
      groupId: stored.groupId,
      restaurantId: restaurant.id,
      approvalCount:
        resolution?.status === "winner"
          ? (resolution.counts[restaurant.id] ?? 0)
          : null,
      partySize: stored.partySize,
    });
    router.push("/instant/ticket");
  }

  if (!stored) return <main className={styles.screen} />;

  const isEmpty = !loading && visible.length === 0;

  if (phase === "handoff") {
    return (
      <main className={styles.screen}>
        <div className={styles.shell}>
          <header className={styles.header}>
            <span className={styles.eyebrow}>
              {t("instant.voteEyebrow", {
                current: currentVoter,
                total: stored.partySize,
              })}
            </span>
            <h1 className={styles.title}>{t("instant.voteHandoffTitle")}</h1>
          </header>
          <section className={`${styles.panel} ${styles.stack}`}>
            <div className={styles.privateCover}>
              <span className={styles.privateIcon} aria-hidden="true">
                <ShieldCheck size={30} />
              </span>
              <h2>
                {t("instant.handoffPerson", {
                  person: t("instant.personLabel", { number: currentVoter }),
                })}
              </h2>
              <p className={styles.desc}>{t("instant.voteHandoffDesc")}</p>
            </div>
            <div className={styles.voteProgress} aria-label={`${votes.length}/${stored.partySize}`}>
              <span style={{ width: `${voteProgress}%` }} />
            </div>
            <PillButton
              variant="cta"
              icon={<Eye size={18} />}
              onClick={() => setPhase("ballot")}
            >
              {t("instant.openPrivateVote")}
            </PillButton>
          </section>
        </div>
      </main>
    );
  }

  if (phase === "ballot") {
    return (
      <main className={styles.screen}>
        <div className={styles.shell}>
          <header className={styles.header}>
            <span className={styles.eyebrow}>
              {t("instant.voteEyebrow", {
                current: currentVoter,
                total: stored.partySize,
              })}
            </span>
            <h1 className={styles.title}>{t("instant.voteQuestion")}</h1>
            <p className={styles.desc}>{t("instant.votePrivateDesc")}</p>
          </header>
          <section className={`${styles.panel} ${styles.stack}`}>
            <div className={styles.voteCandidateList}>
              {visible.map((restaurant) => (
                <button
                  key={restaurant.id}
                  type="button"
                  aria-pressed={selectedVotes.includes(restaurant.id)}
                  className={`${styles.voteCandidate} ${
                    selectedVotes.includes(restaurant.id)
                      ? styles.voteCandidateSelected
                      : ""
                  }`}
                  onClick={() => toggleVote(restaurant.id)}
                >
                  <span>
                    <strong>{restaurant.name}</strong>
                    <small>
                      {[restaurant.area, restaurant.reasonTags?.[0]]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                  <span aria-hidden="true">○</span>
                </button>
              ))}
              <button
                type="button"
                aria-pressed={selectedVotes.includes(INSTANT_BALLOT_NONE)}
                className={`${styles.voteCandidate} ${styles.voteNone} ${
                  selectedVotes.includes(INSTANT_BALLOT_NONE)
                    ? styles.voteCandidateSelected
                    : ""
                }`}
                onClick={() => toggleVote(INSTANT_BALLOT_NONE)}
              >
                <span>
                  <strong>{t("instant.voteNone")}</strong>
                  <small>{t("instant.voteNoneDesc")}</small>
                </span>
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <PillButton
              variant="cta"
              disabled={selectedVotes.length === 0}
              onClick={submitVote}
            >
              {t("instant.submitPrivateVote")}
            </PillButton>
          </section>
        </div>
      </main>
    );
  }

  if (phase === "result" && resolution) {
    const redrawRequired = resolution.status === "redraw";
    return (
      <main className={styles.screen}>
        <div className={styles.shell}>
          <header className={styles.header}>
            <span className={styles.eyebrow}>{t("instant.voteResultEyebrow")}</span>
            <h1 className={styles.title}>
              {redrawRequired ? t("instant.voteRedrawTitle") : winner?.name}
            </h1>
            <p className={styles.desc}>
              {redrawRequired
                ? t("instant.voteRedrawDesc")
                : resolution.tied
                  ? t("instant.voteTieDesc")
                  : t("instant.voteWinnerDesc")}
            </p>
          </header>
          <section className={`${styles.panel} ${styles.stack}`}>
            <div className={styles.tallyList}>
              {visible.map((restaurant) => (
                <div className={styles.tallyRow} key={restaurant.id}>
                  <span>{restaurant.name}</span>
                  <strong>
                    {t("instant.voteCount", {
                      count: resolution.counts[restaurant.id] ?? 0,
                    })}
                  </strong>
                </div>
              ))}
              <div className={styles.tallyRow}>
                <span>{t("instant.voteNone")}</span>
                <strong>
                  {t("instant.voteCount", {
                    count: resolution.counts[INSTANT_BALLOT_NONE] ?? 0,
                  })}
                </strong>
              </div>
            </div>
            {redrawRequired ? (
              <PillButton variant="cta" icon={<RotateCcw size={18} />} onClick={redraw}>
                {t("instant.voteRedraw")}
              </PillButton>
            ) : (
              winner && (
                <PillButton variant="cta" onClick={() => chooseRestaurant(winner)}>
                  {t("instant.confirmVoteWinner")}
                </PillButton>
              )
            )}
            {error && <p className={styles.desc}>{error}</p>}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.screen}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>{t("instant.shortlistEyebrow")}</span>
          <h1 className={styles.title}>
            {t("instant.shortlistTitle", { count: loading ? 3 : visible.length })}
          </h1>
          <p className={styles.desc}>
            {stored.zone
              ? t("instant.shortlistDescWithZone", { zone: stored.zone.name })
              : t("instant.shortlistDescLocationless")}
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

        {!loading && !isEmpty && (
          <>
            <div className={styles.safeBanner}>
              {t("instant.shortlistSafe", { count: visible.length })}
            </div>
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
                        {openState === "open"
                          ? t("instant.openNow")
                          : t("instant.checkHours")}
                      </Chip>
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
            <div className={styles.actions} style={{ marginTop: 16 }}>
              <PillButton variant="cta" icon={<ShieldCheck size={18} />} onClick={startVoting}>
                {t("instant.startSecretVote")}
              </PillButton>
              <PillButton variant="ghost" icon={<RotateCcw size={18} />} onClick={redraw}>
                {t("instant.redraw")}
              </PillButton>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function InstantTop3Page() {
  return <InstantDiscoveryBoundary screen="top3"><InstantTop3PageLegacy /></InstantDiscoveryBoundary>;
}
