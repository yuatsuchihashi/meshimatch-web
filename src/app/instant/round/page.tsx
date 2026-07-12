"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Chip, PillButton, TimerRing } from "@/components/v2";
import { useLocale } from "@/lib/i18n";
import { GENRES } from "@/lib/restaurant-taxonomy";
import {
  aggregateInstantParticipants,
  profileToInstantParticipant,
  timedOutDraftToParticipant,
  type InstantRoundDraft,
} from "@/lib/instant/round";
import type {
  InstantAggregate,
  InstantParticipantInput,
  InstantStartState,
} from "@/lib/instant/types";
import type { UserProfile } from "@/lib/types";
import styles from "../instant.module.css";

const START_KEY = "meshimatch_instant_start";
const GROUP_KEY = "meshimatch_instant_group";
const ROUND_KEY = "meshimatch_instant_round";

const NG_PRESETS = [
  { label: "辛いのNG" },
  { label: "そばNG" },
  { label: "甲殻類NG" },
  { label: "豚肉NG", restrictionId: "no_pork" },
  { label: "お酒なし", restrictionId: "no_alcohol" },
  { label: "ベジ", restrictionId: "vegetarian" },
];

function emptyDraft(): InstantRoundDraft {
  return {
    nickname: "",
    ngLabels: [],
    allergyNote: "",
    dietaryNote: "",
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
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [showProfiles, setShowProfiles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(START_KEY);
    if (!raw) {
      router.replace("/instant");
      return;
    }
    setStart(JSON.parse(raw) as InstantStartState);
  }, [router]);

  useEffect(() => {
    async function loadProfiles() {
      try {
        const res = await fetch("/instant/api/profiles");
        const data = (await res.json()) as { profiles?: UserProfile[] };
        setProfiles(data.profiles ?? []);
      } catch {
        setProfiles([]);
      }
    }
    void loadProfiles();
  }, []);

  useEffect(() => {
    setSeconds(10);
    setDraft(emptyDraft());
    setShowProfiles(false);
  }, [currentIndex]);

  useEffect(() => {
    if (!start || saving) return;
    if (seconds <= 0) {
      advance(
        timedOutDraftToParticipant({
          draft,
          index: currentIndex,
          id: idFor(currentIndex),
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

  function toggleNg(preset: (typeof NG_PRESETS)[number]) {
    setDraft((value) => {
      const selected = value.ngLabels.includes(preset.label);
      const ngLabels = selected
        ? value.ngLabels.filter((label) => label !== preset.label)
        : [...value.ngLabels, preset.label];
      const dietaryRestrictions = preset.restrictionId
        ? selected
          ? value.dietaryRestrictions.filter(
              (item) => item.restrictionId !== preset.restrictionId
            )
          : [
              ...value.dietaryRestrictions,
              { restrictionId: preset.restrictionId, priority: "must" as const },
            ]
        : value.dietaryRestrictions;
      return { ...value, ngLabels, dietaryRestrictions };
    });
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
    localStorage.setItem(
      ROUND_KEY,
      JSON.stringify({
        participants: nextParticipants,
        aggregate: aggregateInstantParticipants(nextParticipants),
      })
    );

    try {
      const res = await fetch("/instant/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zone: start.zone,
          partySize: start.partySize,
          participants: nextParticipants,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      localStorage.setItem(
        GROUP_KEY,
        JSON.stringify({
          groupId: data.group.id,
          zone: start.zone,
          partySize: start.partySize,
          aggregate: aggregateInstantParticipants(nextParticipants),
        })
      );
      router.push("/instant/top3");
    } catch {
      setError(t("instant.saveFailed"));
      setSaving(false);
    }
  }

  function advance(participant: InstantParticipantInput) {
    if (!start || saving) return;
    if (participants.length >= start.partySize) return; // finalize失敗リトライ中の二重追加ガード (レビューP2)
    const nextParticipants = [...participants, participant];
    setParticipants(nextParticipants);
    if (nextParticipants.length >= start.partySize) {
      void finalize(nextParticipants);
      return;
    }
    setCurrentIndex((value) => value + 1);
  }

  function submitManual() {
    const freeText = draft.dietaryNote?.trim();
    const participant: InstantParticipantInput = {
      id: idFor(currentIndex),
      nickname: draft.nickname.trim() || `Guest ${currentIndex + 1}`,
      source: "manual",
      ngLabels: draft.ngLabels,
      allergyNote: draft.allergyNote?.trim() || null,
      dietaryNote: freeText || null,
      genrePreferences: draft.genrePreferences,
      dietaryRestrictions: draft.dietaryRestrictions,
    };
    advance(participant);
  }

  function chooseProfile(profile: UserProfile) {
    advance(profileToInstantParticipant(profile, idFor(currentIndex)));
  }

  if (!start) {
    return <main className={styles.screen} />;
  }

  const total = start.partySize;
  const selectedGenres = new Set(draft.genrePreferences.map((item) => item.genreId));
  const hasAggregate = aggregate.ng.length > 0 || aggregate.genres.length > 0;

  return (
    <main className={styles.screen}>
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
            {t("instant.locationReady", { zone: start.zone.name })}
          </p>
        </header>

        <section className={`${styles.panel} ${styles.stack}`}>
          <div className={styles.timerWrap}>
            <TimerRing seconds={seconds} totalSeconds={10} label="SECONDS" />
          </div>

          {showProfiles ? (
            <div className={styles.stack}>
              <div className={styles.actions}>
                <PillButton variant="ghost" onClick={() => setShowProfiles(false)}>
                  {t("instant.memberPickClose")}
                </PillButton>
              </div>
              <div className={styles.memberList}>
                {profiles.length === 0 ? (
                  <p className={styles.desc}>{t("instant.memberPickEmpty")}</p>
                ) : (
                  profiles.map((profile) => (
                    <button
                      key={profile.id}
                      className={styles.memberButton}
                      type="button"
                      onClick={() => chooseProfile(profile)}
                    >
                      {profile.displayName}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <>
              <label className={styles.stack}>
                <span className={styles.sectionTitle}>{t("instant.nickname")}</span>
                <input
                  className={styles.input}
                  value={draft.nickname}
                  placeholder={t("instant.nicknamePlaceholder")}
                  onChange={(event) =>
                    setDraft((value) => ({ ...value, nickname: event.target.value }))
                  }
                />
              </label>

              <div className={styles.stack}>
                <p className={styles.sectionTitle}>{t("instant.ngTitle")}</p>
                <div className={styles.chipGrid}>
                  {NG_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => toggleNg(preset)}
                      style={{ border: 0, background: "transparent", padding: 0 }}
                    >
                      <Chip
                        variant={
                          draft.ngLabels.includes(preset.label) ? "selected" : "default"
                        }
                      >
                        {preset.label}
                      </Chip>
                    </button>
                  ))}
                </div>
                <input
                  className={styles.input}
                  value={draft.dietaryNote ?? ""}
                  placeholder={t("instant.ngFreePlaceholder")}
                  onChange={(event) =>
                    setDraft((value) => ({ ...value, dietaryNote: event.target.value }))
                  }
                />
              </div>

              <div className={styles.stack}>
                <p className={styles.sectionTitle}>{t("instant.genreTitle")}</p>
                <div className={styles.chipGrid}>
                  {GENRES.slice(0, 12).map((genre) => (
                    <button
                      key={genre.code}
                      type="button"
                      onClick={() => toggleGenre(genre.code)}
                      style={{ border: 0, background: "transparent", padding: 0 }}
                    >
                      <Chip
                        variant={selectedGenres.has(genre.code) ? "selected" : "default"}
                        icon={genre.icon}
                      >
                        {genre.name}
                      </Chip>
                    </button>
                  ))}
                </div>
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
                <PillButton variant="ghost" onClick={() => setShowProfiles(true)}>
                  {t("instant.memberPick")}
                </PillButton>
              </div>
            </>
          )}

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
