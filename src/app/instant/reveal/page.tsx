"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PillButton } from "@/components/v2";
import { Confetti } from "@/components/ui/Confetti";
import { useLocale } from "@/lib/i18n";
import type {
  InstantAggregate,
  InstantZoneSelection,
} from "@/lib/instant/types";
import type { InstantWinningGenre } from "@/lib/instant/winner";
import styles from "../instant.module.css";

const GROUP_KEY = "meshimatch_instant_group";

type StoredGroup = {
  groupId: string;
  zone: InstantZoneSelection | null;
  partySize: number;
  aggregate: InstantAggregate;
  winner: InstantWinningGenre;
  previousWinner?: InstantWinningGenre | null;
  winnerChanged?: boolean;
};

export default function InstantRevealPage() {
  const { t } = useLocale();
  const [stored, setStored] = useState<StoredGroup | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(GROUP_KEY);
    setStored(raw ? (JSON.parse(raw) as StoredGroup) : null);
  }, []);

  if (!stored?.winner) {
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

  return (
    <main className={`${styles.screen} ${styles.revealScreen}`}>
      <Confetti count={48} />
      <div className={styles.shell}>
        <section className={styles.revealPanel}>
          <p className={styles.eyebrow}>
            {stored.winnerChanged
              ? t("instant.revealChangedEyebrow")
              : t("instant.revealEyebrow")}
          </p>
          <h1 className={styles.revealTitle}>
            {t("instant.revealTitle", {
              icon: stored.winner.icon,
              genre: stored.winner.name,
            })}
          </h1>
          <p className={styles.desc}>
            {stored.winnerChanged && stored.previousWinner
              ? t("instant.revealChangedDesc", {
                  previous: stored.previousWinner.name,
                  current: stored.winner.name,
                })
              : t("instant.revealDesc", { count: stored.winner.votes })}
          </p>
          <PillButton
            variant="cta"
            icon={<ChevronRight size={18} />}
            onClick={() => {
              window.location.href = "/instant/top3";
            }}
          >
            {t("instant.revealCta")}
          </PillButton>
        </section>
      </div>
    </main>
  );
}
