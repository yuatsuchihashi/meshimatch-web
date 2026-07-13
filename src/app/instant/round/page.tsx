"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, RotateCcw } from "lucide-react";
import { Chip, PillButton, TimerRing } from "@/components/v2";
import { useLocale } from "@/lib/i18n";
import { GENRES } from "@/lib/restaurant-taxonomy";
import { INSTANT_NG_PRESETS, toggleInstantNgDraft } from "@/lib/instant/ng";
import {
  aggregateInstantParticipants,
  shouldRetryInstantFinalize,
  timedOutDraftToParticipant,
  type InstantRoundDraft,
} from "@/lib/instant/round";
import type {
  InstantAggregate,
  InstantParticipantInput,
  InstantStartState,
  InstantZoneSelection,
} from "@/lib/instant/types";
import {
  didInstantWinnerChange,
  instantTurnAccent,
  selectInstantWinningGenre,
  type InstantWinningGenre,
} from "@/lib/instant/winner";
import styles from "../instant.module.css";

const START_KEY = "meshimatch_instant_start";
const GROUP_KEY = "meshimatch_instant_group";
const ROUND_KEY = "meshimatch_instant_round";
const TICKET_KEY = "meshimatch_instant_ticket";
const MAX_INSTANT_PARTY_SIZE = 8;

type StoredRound = {
  participants: InstantParticipantInput[];
  aggregate: InstantAggregate;
  winner?: InstantWinningGenre;
};

type StoredGroup = {
  groupId: string;
  zone: InstantZoneSelection | null;
  partySize: number;
  aggregate: InstantAggregate;
  winner?: InstantWinningGenre;
};

function emptyDraft(): InstantRoundDraft {
  return {
    ngLabels: [],
    genrePreferences: [],
    dietaryRestrictions: [],
  };
}

function idFor(index: number) {
  return `instant-${Date.now()}-${index}`;
}

export default function InstantRoundPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [start, setStart] = useState<InstantStartState | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [seconds, setSeconds] = useState(10);
  const [draft, setDraft] = useState<InstantRoundDraft>(() => emptyDraft());
  const [participants, setParticipants] = useState<InstantParticipantInput[]>([]);
  const [previousWinner, setPreviousWinner] = useState<InstantWinningGenre | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(START_KEY);
    if (!raw) {
      router.replace("/instant");
      return;
    }
    const parsed = JSON.parse(raw) as InstantStartState;
    const addLater = new URLSearchParams(window.location.search).get("add") === "1";
    if (!addLater) {
      setStart(parsed);
      return;
    }

    const storedRoundRaw = localStorage.getItem(ROUND_KEY);
    const storedGroupRaw = localStorage.getItem(GROUP_KEY);
    const storedRound = storedRoundRaw
      ? (JSON.parse(storedRoundRaw) as StoredRound)
      : null;
    const storedGroup = storedGroupRaw
      ? (JSON.parse(storedGroupRaw) as StoredGroup)
      : null;
    const existingParticipants = storedRound?.participants ?? [];
    if (existingParticipants.length === 0) {
      setStart(parsed);
      return;
    }
    if (existingParticipants.length >= MAX_INSTANT_PARTY_SIZE) {
      setBlockedMessage(t("instant.addLimitReached"));
      return;
    }
    setParticipants(existingParticipants);
    setPreviousWinner(storedRound?.winner ?? storedGroup?.winner ?? null);
    setCurrentIndex(existingParticipants.length);
    setStart({ ...parsed, partySize: existingParticipants.length + 1 });
  }, [router, t]);

  useEffect(() => {
    setSeconds(10);
    setDraft(emptyDraft());
  }, [currentIndex]);

  useEffect(() => {
    if (!start || saving) return;
    if (seconds <= 0) {
      advance(
        timedOutDraftToParticipant({
          draft,
          id: idFor(currentIndex),
          label: t("instant.personLabel", { number: currentIndex + 1 }),
        })
      );
      return;
    }
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
    // The expiry path intentionally captures the visible draft for this one turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, start, saving]);

  const aggregate: InstantAggregate = useMemo(
    () => aggregateInstantParticipants(participants),
    [participants]
  );

  function resetCurrentDraft() {
    setDraft(emptyDraft());
    setSeconds(10);
  }

  function toggleNg(preset: (typeof INSTANT_NG_PRESETS)[number], label: string) {
    setDraft((value) => toggleInstantNgDraft(value, preset, label));
  }

  function toggleGenre(genreId: string) {
    setDraft((value) => {
      const selected = value.genrePreferences.some((item) => item.genreId === genreId);
      const genrePreferences = selected
        ? value.genrePreferences.filter((item) => item.genreId !== genreId)
        : [...value.genrePreferences, { genreId, priority: "prefer" as const }];
      return { ...value, genrePreferences };
    });
  }

  async function finalize(nextParticipants: InstantParticipantInput[]) {
    if (!start) return;
    setSaving(true);
    setError(null);
    const nextAggregate = aggregateInstantParticipants(nextParticipants);
    const winner = selectInstantWinningGenre(nextParticipants);
    try {
      const res = await fetch("/instant/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zone: start.zone,
          partySize: nextParticipants.length,
          participants: nextParticipants,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      localStorage.setItem(
        ROUND_KEY,
        JSON.stringify({
          participants: nextParticipants,
          aggregate: nextAggregate,
          winner,
        })
      );
      localStorage.setItem(
        GROUP_KEY,
        JSON.stringify({
          groupId: data.group.id,
          zone: start.zone,
          partySize: nextParticipants.length,
          aggregate: nextAggregate,
          winner,
          previousWinner,
          winnerChanged: didInstantWinnerChange(previousWinner, winner),
        })
      );
      localStorage.removeItem(TICKET_KEY);
      router.push("/instant/reveal");
    } catch {
      setError(t("instant.saveFailed"));
      setSaving(false);
    }
  }

  function advance(participant: InstantParticipantInput) {
    if (!start || saving) return;
    if (
      shouldRetryInstantFinalize({
        participantsLength: participants.length,
        partySize: start.partySize,
      })
    ) {
      void finalize(participants);
      return;
    }
    const nextParticipants = [...participants, participant];
    setParticipants(nextParticipants);
    if (nextParticipants.length >= start.partySize) {
      void finalize(nextParticipants);
      return;
    }
    setCurrentIndex((value) => value + 1);
  }

  function submitManual() {
    const participant: InstantParticipantInput = {
      id: idFor(currentIndex),
      nickname: t("instant.personLabel", { number: currentIndex + 1 }),
      source: "manual",
      ngLabels: draft.ngLabels,
      allergyNote: null,
      dietaryNote: null,
      genrePreferences: draft.genrePreferences,
      dietaryRestrictions: draft.dietaryRestrictions,
    };
    advance(participant);
  }

  if (blockedMessage) {
    return (
      <main className={styles.screen}>
        <div className={styles.shell}>
          <section className={`${styles.empty} ${styles.stack}`}>
            <p className={styles.desc}>{blockedMessage}</p>
          </section>
        </div>
      </main>
    );
  }

  if (!start) {
    return <main className={styles.screen} />;
  }

  const total = start.partySize;
  const selectedGenres = new Set(draft.genrePreferences.map((item) => item.genreId));
  const hasAggregate = aggregate.ng.length > 0 || aggregate.genres.length > 0;
  const personLabel = t("instant.personLabel", { number: currentIndex + 1 });
  const accentClass = styles[instantTurnAccent(currentIndex)];

  return (
    <main className={`${styles.screen} ${accentClass}`}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>
            {t("instant.roundEyebrow", {
              current: Math.min(currentIndex + 1, total),
              total,
            })}
          </span>
          <h1 className={styles.title}>{t("instant.roundTitle")}</h1>
          <p className={styles.desc}>
            {start.zone
              ? t("instant.locationReady", { zone: start.zone.name })
              : t("instant.locationlessReady")}
          </p>
        </header>

        <section className={`${styles.panel} ${styles.stack}`}>
          <div className={styles.timerWrap}>
            <TimerRing seconds={seconds} totalSeconds={10} label="SECONDS" />
          </div>

          <div className={styles.heroQuestion}>
            <span className={styles.personPill}>{personLabel}</span>
            <h2>{t("instant.genreQuestion")}</h2>
          </div>

          <div className={styles.genreHeroGrid}>
            {GENRES.slice(0, 17).map((genre) => (
              <button
                key={genre.code}
                type="button"
                className={`${styles.genreHeroChip} ${
                  selectedGenres.has(genre.code) ? styles.genreHeroSelected : ""
                }`}
                onClick={() => toggleGenre(genre.code)}
              >
                <span>{genre.icon}</span>
                {genre.name}
              </button>
            ))}
          </div>

          <div className={styles.ngRow} aria-label={t("instant.ngTitle")}>
            {INSTANT_NG_PRESETS.map((preset) => {
              const label = t(preset.key);
              return (
                <button
                  key={preset.key}
                  type="button"
                  className={`${styles.ngButton} ${
                    draft.ngLabels.includes(label) ? styles.ngButtonSelected : ""
                  }`}
                  onClick={() => toggleNg(preset, label)}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className={styles.actions}>
            <PillButton
              variant="ink"
              icon={<ChevronRight size={18} />}
              disabled={saving}
              onClick={submitManual}
            >
              {saving ? t("instant.saving") : t("instant.nextPerson")}
            </PillButton>
            <PillButton
              variant="ghost"
              icon={<RotateCcw size={18} />}
              disabled={saving}
              onClick={resetCurrentDraft}
            >
              {t("instant.resetTurn")}
            </PillButton>
          </div>

          <div className={styles.aggregate}>
            <p className={styles.sectionTitle}>{t("instant.aggregateTitle")}</p>
            {hasAggregate ? (
              <div className={styles.aggregateList}>
                {aggregate.ng.map((item) => (
                  <Chip key={`ng-${item.label}`} variant="honey">
                    {t("instant.aggregateNg", { label: item.label, count: item.count })}
                  </Chip>
                ))}
                {aggregate.genres.map((item) => (
                  <Chip key={`genre-${item.label}`} variant="sage">
                    {t("instant.aggregateGenre", {
                      label: item.label,
                      count: item.count,
                    })}
                  </Chip>
                ))}
              </div>
            ) : (
              <p className={styles.desc}>{t("instant.aggregateEmpty")}</p>
            )}
          </div>

          {error && <p className={styles.desc}>{error}</p>}
        </section>
      </div>
    </main>
  );
}
