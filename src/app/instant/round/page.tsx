"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, RotateCcw, Utensils } from "lucide-react";
import { Chip, PillButton, TimerRing } from "@/components/v2";
import { DIETARY_PRESETS } from "@/lib/dietary-presets";
import { useLocale } from "@/lib/i18n";
import {
  buildInstantParticipantFromConsensus,
  emptyInstantConsensusAnswerDraft,
  toggleInstantDietaryRestriction,
  type InstantConsensusAnswerDraft,
} from "@/lib/instant/answers";
import { type InstantConsensusNg } from "@/lib/instant/consensus";
import {
  INSTANT_CONSENSUS_CONFIG,
  type InstantConsensusMood,
  type InstantConsensusStyle,
} from "@/lib/instant/consensus-config";
import {
  aggregateInstantParticipants,
  shouldRetryInstantFinalize,
} from "@/lib/instant/round";
import type {
  InstantAggregate,
  InstantParticipantInput,
  InstantStartState,
  InstantZoneSelection,
} from "@/lib/instant/types";
import { instantTurnAccent, type InstantWinningGenre } from "@/lib/instant/winner";
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
  participants?: InstantParticipantInput[];
  aggregate: InstantAggregate;
  winner?: InstantWinningGenre;
};

type QuestionIndex = 0 | 1 | 2;

const AVOID_OPTIONS = [
  { value: "none", labelKey: "instant.avoidNone" },
  { value: "no_heavy", labelKey: "instant.avoidHeavy" },
  { value: "no_spicy", labelKey: "instant.avoidSpicy" },
] as const satisfies readonly {
  value: InstantConsensusNg;
  labelKey: string;
}[];

function idFor(index: number) {
  return `instant-${Date.now()}-${index}`;
}

export default function InstantRoundPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [start, setStart] = useState<InstantStartState | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState<QuestionIndex>(0);
  const [seconds, setSeconds] = useState(10);
  const [draft, setDraft] = useState<InstantConsensusAnswerDraft>(() =>
    emptyInstantConsensusAnswerDraft()
  );
  const [dietaryOpen, setDietaryOpen] = useState(false);
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
    setPreviousWinner(storedRound?.winner ?? storedGroup?.winner ?? null);
    setCurrentIndex(existingParticipants.length);
    setStart({ ...parsed, partySize: existingParticipants.length + 1 });
  }, [router, t]);

  useEffect(() => {
    setSeconds(10);
    setQuestionIndex(0);
    setDraft(emptyInstantConsensusAnswerDraft());
    setDietaryOpen(false);
  }, [currentIndex]);

  useEffect(() => {
    if (!start || saving) return;
    if (seconds <= 0) {
      advanceCurrentDraft({ draft, source: "auto" });
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

  function ngLabelFor(value: InstantConsensusNg | null) {
    if (!value || value === "none") return null;
    const option = AVOID_OPTIONS.find((item) => item.value === value);
    return option ? t(option.labelKey) : null;
  }

  function advanceCurrentDraft(params: {
    draft: InstantConsensusAnswerDraft;
    source?: InstantParticipantInput["source"];
  }) {
    advance(
      buildInstantParticipantFromConsensus({
        id: idFor(currentIndex),
        label: t("instant.personLabel", { number: currentIndex + 1 }),
        draft: params.draft,
        source: params.source,
        ngLabel: ngLabelFor(params.draft.ng),
      })
    );
  }

  function resetCurrentDraft() {
    setDraft(emptyInstantConsensusAnswerDraft());
    setQuestionIndex(0);
    setDietaryOpen(false);
    setSeconds(10);
  }

  function answerAvoid(value: InstantConsensusNg) {
    setDraft((current) => ({ ...current, ng: value }));
    setQuestionIndex(1);
  }

  function answerMood(value: InstantConsensusMood) {
    setDraft((current) => ({ ...current, mood: value }));
    setQuestionIndex(2);
  }

  function answerStyle(value: InstantConsensusStyle) {
    const nextDraft = { ...draft, style: value };
    setDraft(nextDraft);
    advanceCurrentDraft({ draft: nextDraft });
  }

  function toggleDietary(restrictionId: string) {
    setDraft((current) => toggleInstantDietaryRestriction(current, restrictionId));
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
        JSON.stringify({
          participants: nextParticipants,
          aggregate: nextAggregate,
        })
      );
      localStorage.setItem(
        GROUP_KEY,
        JSON.stringify({
          groupId: data.group.id,
          zone: start.zone,
          partySize: nextParticipants.length,
          participants: nextParticipants,
          aggregate: nextAggregate,
          previousWinner,
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
    advanceCurrentDraft({ draft });
  }

  function consensusOptionLabel(axisId: string, value: string, fallback: string) {
    const key = `instant.consensusOptions.${axisId}.${value}`;
    const translated = t(key);
    return translated === key ? fallback : translated;
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
  const hasAggregate = aggregate.ng.length > 0 || aggregate.genres.length > 0;
  const personLabel = t("instant.personLabel", { number: currentIndex + 1 });
  const accentClass = styles[instantTurnAccent(currentIndex)];
  const selectedRestrictions = new Set(
    draft.dietaryRestrictions.map((item) => item.restrictionId)
  );
  const questionTitle =
    questionIndex === 0
      ? t("instant.avoidQuestion")
      : questionIndex === 1
      ? t(INSTANT_CONSENSUS_CONFIG.moodAxis.questionKey)
      : t(INSTANT_CONSENSUS_CONFIG.secondaryAxis.questionKey);

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
            <span className={styles.questionMeta}>
              {t("instant.questionProgress", { current: questionIndex + 1, total: 3 })}
            </span>
            <h2>{questionTitle}</h2>
          </div>

          {questionIndex === 0 && (
            <>
              <div className={styles.choiceGrid}>
                {AVOID_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.choiceButton} ${
                      draft.ng === option.value ? styles.choiceButtonSelected : ""
                    }`}
                    onClick={() => answerAvoid(option.value)}
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={styles.dietaryToggle}
                onClick={() => setDietaryOpen((value) => !value)}
              >
                <Utensils size={18} />
                {t("instant.dietaryPickerButton")}
              </button>

              {dietaryOpen && (
                <div className={styles.dietaryPicker}>
                  <p className={styles.desc}>{t("instant.dietaryPickerHint")}</p>
                  <div className={styles.dietaryGrid}>
                    {DIETARY_PRESETS.map((preset) => {
                      const selected = selectedRestrictions.has(preset.id);
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          className={`${styles.ngButton} ${
                            selected ? styles.ngButtonSelected : ""
                          }`}
                          onClick={() => toggleDietary(preset.id)}
                        >
                          {t(`instant.dietaryPreset.${preset.id}`)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {questionIndex === 1 && (
            <div className={styles.choiceGrid}>
              {INSTANT_CONSENSUS_CONFIG.moodAxis.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.choiceButton} ${
                    draft.mood === option.value ? styles.choiceButtonSelected : ""
                  }`}
                  onClick={() => answerMood(option.value)}
                >
                  {consensusOptionLabel("mood", option.value, option.label)}
                </button>
              ))}
            </div>
          )}

          {questionIndex === 2 && (
            <div className={styles.choiceGrid}>
              {INSTANT_CONSENSUS_CONFIG.secondaryAxis.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.choiceButton} ${
                    draft.style === option.value ? styles.choiceButtonSelected : ""
                  }`}
                  onClick={() => answerStyle(option.value)}
                >
                  {consensusOptionLabel("style", option.value, option.label)}
                </button>
              ))}
            </div>
          )}

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
