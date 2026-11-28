"use client";

import { InstantDiscoveryBoundary } from "@/components/instant/DiscoveryFlow";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, ShieldCheck, Utensils } from "lucide-react";
import { PillButton } from "@/components/v2";
import { AnalyticsEvent, track } from "@/lib/analytics";
import { DIETARY_PRESETS } from "@/lib/dietary-presets";
import { useLocale } from "@/lib/i18n";
import { buildInstantParticipantFromWishAvoid } from "@/lib/instant/answers";
import { aggregateInstantParticipants } from "@/lib/instant/round";
import type {
  InstantAggregate,
  InstantParticipantInput,
  InstantStartState,
  InstantZoneSelection,
} from "@/lib/instant/types";
import type { DietaryRestrictionInput } from "@/lib/types";
import styles from "../instant.module.css";

const START_KEY = "meshimatch_instant_start";
const GROUP_KEY = "meshimatch_instant_group";
const ROUND_KEY = "meshimatch_instant_round";
const TICKET_KEY = "meshimatch_instant_ticket";
const MAX_INSTANT_PARTY_SIZE = 8;
const OMAKASE = "__omakase__";

type StoredRound = {
  participants: InstantParticipantInput[];
  aggregate: InstantAggregate;
};

type StoredGroup = {
  groupId: string;
  zone: InstantZoneSelection | null;
  partySize: number;
  participants?: InstantParticipantInput[];
  aggregate: InstantAggregate;
};

const WISH_OPTIONS = [
  { value: "G004", labelKey: "instant.wishJapanese", icon: "🍚" },
  { value: "G013", labelKey: "instant.wishNoodles", icon: "🍜" },
  { value: "G009", labelKey: "instant.wishCurry", icon: "🍛" },
  { value: "G008", labelKey: "instant.wishMeat", icon: "🥩" },
  { value: "G014", labelKey: "instant.wishLight", icon: "🥗" },
  { value: OMAKASE, labelKey: "instant.wishOmakase", icon: "✨" },
] as const;

const AVOID_OPTIONS = [
  {
    value: "none",
    labelKey: "instant.avoidNone",
    restrictionId: null,
    genreIds: [],
  },
  {
    value: "no_heavy",
    labelKey: "instant.avoidHeavy",
    restrictionId: null,
    genreIds: ["G008", "G005"],
  },
  {
    value: "no_spicy",
    labelKey: "instant.avoidSpicy",
    restrictionId: null,
    genreIds: ["G009", "G017"],
  },
  {
    value: "no_alcohol",
    labelKey: "instant.avoidAlcoholCentered",
    restrictionId: "no_alcohol",
    genreIds: ["G001", "G002", "G012"],
  },
] as const;

function idFor(index: number) {
  return `instant-${Date.now()}-${index}`;
}

function InstantRoundPageLegacy() {
  const router = useRouter();
  const { t } = useLocale();
  const [start, setStart] = useState<InstantStartState | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [wishChoices, setWishChoices] = useState<string[]>([]);
  const [avoidChoices, setAvoidChoices] = useState<string[]>([]);
  const [dietaryRestrictions, setDietaryRestrictions] = useState<
    DietaryRestrictionInput[]
  >([]);
  const [participants, setParticipants] = useState<InstantParticipantInput[]>([]);
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
    const existingParticipants =
      storedRound?.participants ?? storedGroup?.participants ?? [];
    if (existingParticipants.length === 0) {
      setStart(parsed);
      return;
    }
    if (existingParticipants.length >= MAX_INSTANT_PARTY_SIZE) {
      setBlockedMessage(t("instant.addLimitReached"));
      return;
    }
    setParticipants(existingParticipants);
    setCurrentIndex(existingParticipants.length);
    setStart({ ...parsed, partySize: existingParticipants.length + 1 });
  }, [router, t]);

  const aggregate = useMemo(
    () => aggregateInstantParticipants(participants),
    [participants]
  );

  function resetDraft() {
    setWishChoices([]);
    setAvoidChoices([]);
    setDietaryRestrictions([]);
    setError(null);
  }

  function toggleWish(value: string) {
    setWishChoices((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      if (value === OMAKASE) return [OMAKASE];
      return [...current.filter((item) => item !== OMAKASE), value];
    });
  }

  function toggleAvoid(value: string) {
    setAvoidChoices((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      if (value === "none") return ["none"];
      return [...current.filter((item) => item !== "none"), value];
    });
  }

  function toggleDietary(restrictionId: string) {
    setDietaryRestrictions((current) => {
      const selected = current.some((item) => item.restrictionId === restrictionId);
      return selected
        ? current.filter((item) => item.restrictionId !== restrictionId)
        : [...current, { restrictionId, priority: "must" }];
    });
  }

  async function finalize(nextParticipants: InstantParticipantInput[]) {
    if (!start) return;
    setSaving(true);
    setError(null);
    const nextAggregate = aggregateInstantParticipants(nextParticipants);
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
        JSON.stringify({ participants: nextParticipants, aggregate: nextAggregate })
      );
      localStorage.setItem(
        GROUP_KEY,
        JSON.stringify({
          groupId: data.group.id,
          zone: start.zone,
          partySize: nextParticipants.length,
          participants: nextParticipants,
          aggregate: nextAggregate,
        })
      );
      localStorage.removeItem(TICKET_KEY);
      track(AnalyticsEvent.INSTANT_ANSWERS_COMPLETED, {
        groupId: data.group.id,
        partySize: nextParticipants.length,
        locationMode: start.zone ? "gps_zone" : "locationless",
      });
      router.push("/instant/top3");
    } catch {
      setError(t("instant.saveFailed"));
      setSaving(false);
    }
  }

  function submitAnswer() {
    if (!start || saving || wishChoices.length === 0 || avoidChoices.length === 0) {
      return;
    }
    if (participants.length >= start.partySize) {
      void finalize(participants);
      return;
    }

    const selectedAvoids = AVOID_OPTIONS.filter((option) =>
      avoidChoices.includes(option.value)
    );
    const participant = buildInstantParticipantFromWishAvoid({
      id: idFor(currentIndex),
      label: t("instant.personLabel", { number: currentIndex + 1 }),
      wishGenreIds: wishChoices.filter((value) => value !== OMAKASE),
      avoidLabels: selectedAvoids
        .filter((option) => option.value !== "none")
        .map((option) => t(option.labelKey)),
      avoidGenreIds: selectedAvoids.flatMap((option) => option.genreIds),
      avoidRestrictionIds: selectedAvoids.flatMap((option) =>
        option.restrictionId ? [option.restrictionId] : []
      ),
      dietaryRestrictions,
    });
    const nextParticipants = [...participants, participant];
    setParticipants(nextParticipants);

    if (nextParticipants.length >= start.partySize) {
      void finalize(nextParticipants);
      return;
    }

    setCurrentIndex((value) => value + 1);
    resetDraft();
    setRevealed(false);
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

  if (!start) return <main className={styles.screen} />;

  const total = start.partySize;
  const personLabel = t("instant.personLabel", { number: currentIndex + 1 });
  const selectedRestrictions = new Set(
    dietaryRestrictions.map((item) => item.restrictionId)
  );
  const canSubmit = wishChoices.length > 0 && avoidChoices.length > 0;
  const completedPercent = Math.round((participants.length / total) * 100);

  if (!revealed) {
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
            <h1 className={styles.title}>{t("instant.handoffTitle")}</h1>
          </header>
          <section className={`${styles.panel} ${styles.stack}`}>
            <div className={styles.privateCover}>
              <span className={styles.privateIcon} aria-hidden="true">
                <ShieldCheck size={30} />
              </span>
              <h2>{t("instant.handoffPerson", { person: personLabel })}</h2>
              <p className={styles.desc}>{t("instant.handoffDesc")}</p>
            </div>
            <div className={styles.roundProgress} aria-label={`${participants.length}/${total}`}>
              <span style={{ width: `${completedPercent}%` }} />
            </div>
            <PillButton
              variant="cta"
              icon={<Eye size={18} />}
              onClick={() => setRevealed(true)}
            >
              {t("instant.openPrivateAnswer")}
            </PillButton>
          </section>
        </div>
      </main>
    );
  }

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
          <p className={styles.desc}>{t("instant.roundPrivateDesc")}</p>
        </header>

        <section className={`${styles.panel} ${styles.stack}`}>
          <div className={styles.answerSection}>
            <div className={styles.answerHeading}>
              <h2>{t("instant.safetyQuestion")}</h2>
              <span>{t("instant.safetyOptional")}</span>
            </div>
            <p className={styles.desc}>{t("instant.dietaryPickerHint")}</p>
            <div className={styles.choiceChipGrid}>
              {DIETARY_PRESETS.map((preset) => {
                const selected = selectedRestrictions.has(preset.id);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={selected}
                    className={`${styles.answerChip} ${
                      selected ? styles.answerChipSelected : ""
                    }`}
                    onClick={() => toggleDietary(preset.id)}
                  >
                    {t(`instant.dietaryPreset.${preset.id}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.answerSection}>
            <div className={styles.answerHeading}>
              <h2>{t("instant.wishQuestion")}</h2>
              <span>{t("instant.chooseMultiple")}</span>
            </div>
            <div className={styles.choiceChipGrid}>
              {WISH_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={wishChoices.includes(option.value)}
                  className={`${styles.answerChip} ${
                    wishChoices.includes(option.value) ? styles.answerChipSelected : ""
                  }`}
                  onClick={() => toggleWish(option.value)}
                >
                  <span aria-hidden="true">{option.icon}</span>
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.answerSection}>
            <div className={styles.answerHeading}>
              <h2>{t("instant.avoidQuestion")}</h2>
              <span>{t("instant.chooseMultiple")}</span>
            </div>
            <div className={styles.choiceChipGrid}>
              {AVOID_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={avoidChoices.includes(option.value)}
                  className={`${styles.answerChip} ${
                    avoidChoices.includes(option.value) ? styles.answerChipSelected : ""
                  }`}
                  onClick={() => toggleAvoid(option.value)}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {error && <p className={styles.desc}>{error}</p>}
          <PillButton
            variant="cta"
            icon={<Utensils size={18} />}
            disabled={!canSubmit || saving}
            onClick={submitAnswer}
          >
            {saving
              ? t("instant.saving")
              : currentIndex + 1 >= total
                ? t("instant.finishAnswers")
                : t("instant.hideAndPass")}
          </PillButton>

          {aggregate.ng.length > 0 && (
            <p className={styles.privateMemo}>{t("instant.privateAggregateMemo")}</p>
          )}
        </section>
      </div>
    </main>
  );
}

export default function InstantRoundPage() {
  return <InstantDiscoveryBoundary screen="round"><InstantRoundPageLegacy /></InstantDiscoveryBoundary>;
}
