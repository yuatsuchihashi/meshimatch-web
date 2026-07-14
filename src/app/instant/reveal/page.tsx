"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Chip, PillButton } from "@/components/v2";
import { useLocale } from "@/lib/i18n";
import {
  resolveConsensus,
  type DerivedCandidateGenre,
  type InstantConsensusAnswer,
  type InstantConsensusResolution,
} from "@/lib/instant/consensus";
import type {
  InstantAggregate,
  InstantParticipantInput,
  InstantZoneSelection,
} from "@/lib/instant/types";
import type { InstantWinningGenre } from "@/lib/instant/winner";
import { GENRES } from "@/lib/restaurant-taxonomy";
import styles from "../instant.module.css";

const GROUP_KEY = "meshimatch_instant_group";

type StoredGroup = {
  groupId: string;
  zone: InstantZoneSelection | null;
  partySize: number;
  participants?: InstantParticipantInput[];
  aggregate: InstantAggregate;
  winner?: InstantWinningGenre;
};

type ProposalCardProps = {
  proposal: DerivedCandidateGenre;
  imageSrc?: string;
  onSelect: () => void;
  t: ReturnType<typeof useLocale>["t"];
};

function genreIcon(genreCode: string) {
  return GENRES.find((genre) => genre.code === genreCode)?.icon ?? "🍽️";
}

function proposalWinner(
  proposal: DerivedCandidateGenre,
  answeredCount: number
): InstantWinningGenre {
  return {
    genreId: proposal.genreCode,
    name: proposal.genreName,
    icon: genreIcon(proposal.genreCode),
    votes: answeredCount,
    isFallback: false,
  };
}

function ProposalCard({ proposal, imageSrc, onSelect, t }: ProposalCardProps) {
  return (
    <button type="button" className={styles.proposalCard} onClick={onSelect}>
      {imageSrc ? (
        <span
          className={styles.proposalImage}
          style={{ backgroundImage: `url(${imageSrc})` }}
          aria-hidden="true"
        />
      ) : (
        <span className={styles.proposalEmoji}>{genreIcon(proposal.genreCode)}</span>
      )}
      <span className={styles.proposalName}>{proposal.genreName}</span>
      {proposal.violations > 0 && (
        <Chip variant="honey">
          {t("instant.proposalViolation", { count: proposal.violations })}
        </Chip>
      )}
    </button>
  );
}

export default function InstantRevealPage() {
  const { t } = useLocale();
  const [stored, setStored] = useState<StoredGroup | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(GROUP_KEY);
    setStored(raw ? (JSON.parse(raw) as StoredGroup) : null);
  }, []);

  const answers = useMemo<InstantConsensusAnswer[]>(
    () =>
      (stored?.participants ?? [])
        .map((participant) => participant.consensusAnswer)
        .filter((answer): answer is InstantConsensusAnswer => Boolean(answer)),
    [stored?.participants]
  );

  const resolution = useMemo<InstantConsensusResolution | null>(
    () => (stored ? resolveConsensus(answers) : null),
    [answers, stored]
  );

  function selectProposal(proposal: DerivedCandidateGenre) {
    if (!stored || !resolution) return;
    const winner = proposalWinner(proposal, resolution.answeredCount);
    localStorage.setItem(
      GROUP_KEY,
      JSON.stringify({
        ...stored,
        winner,
      })
    );
    window.location.href = "/instant/top3";
  }

  if (!stored || !resolution || answers.length === 0) {
    return (
      <main className={styles.screen}>
        <div className={styles.shell}>
          <section className={styles.empty}>
            <p className={styles.desc}>{t("instant.revealMissing")}</p>
            <Link className={styles.anchorPill} href="/instant">
              {t("instant.startEyebrow")}
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const noAnswers = resolution.answeredCount === 0;
  const hardExcludedEmpty =
    !noAnswers &&
    resolution.candidates.length === 0 &&
    resolution.hardExcludedGenres.length > 0;
  const proposals = noAnswers || hardExcludedEmpty ? [] : resolution.proposals;
  const genericEmpty = !noAnswers && !hardExcludedEmpty && proposals.length === 0;
  const title =
    proposals.length === 1
      ? t("instant.revealSingleTitle")
      : t("instant.revealCompareTitle");

  return (
    <main className={`${styles.screen} ${styles.revealScreen}`}>
      <div className={styles.shell}>
        <section className={`${styles.revealPanel} ${styles.stack}`}>
          <p className={styles.eyebrow}>{t("instant.revealEyebrow")}</p>
          <h1 className={styles.revealChoiceTitle}>{title}</h1>

          {noAnswers && (
            <section className={`${styles.empty} ${styles.stack}`}>
              <h2 className={styles.restaurantName}>{t("instant.noAnswersTitle")}</h2>
              <p className={styles.desc}>{t("instant.noAnswersDesc")}</p>
              <EmptyActions />
            </section>
          )}

          {hardExcludedEmpty && (
            <section className={`${styles.empty} ${styles.stack}`}>
              <h2 className={styles.restaurantName}>{t("instant.hardExcludedTitle")}</h2>
              <p className={styles.desc}>{t("instant.hardExcludedDesc")}</p>
              <EmptyActions />
            </section>
          )}

          {genericEmpty && (
            <section className={`${styles.empty} ${styles.stack}`}>
              <h2 className={styles.restaurantName}>{t("instant.genericEmptyTitle")}</h2>
              <p className={styles.desc}>{t("instant.genericEmptyDesc")}</p>
              <EmptyActions />
            </section>
          )}

          {proposals.length > 0 && (
            <>
              <p className={styles.desc}>{t("instant.revealOralDesc")}</p>
              <div
                className={
                  proposals.length === 1
                    ? styles.proposalGridSingle
                    : styles.proposalGrid
                }
              >
                {proposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.genreCode}
                    proposal={proposal}
                    onSelect={() => selectProposal(proposal)}
                    t={t}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );

  function EmptyActions() {
    return (
      <div className={styles.actions}>
        <Link className={styles.anchorPill} href="/instant/round?add=1">
          {t("instant.addLater")}
        </Link>
        <PillButton
          variant="ghost"
          icon={<RotateCcw size={18} />}
          onClick={() => {
            window.location.href = "/instant/round";
          }}
        >
          {t("instant.restartRound")}
        </PillButton>
      </div>
    );
  }
}
