"use client";

import { InstantDiscoveryBoundary } from "@/components/instant/DiscoveryFlow";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { Chip, PillButton } from "@/components/v2";
import { AnalyticsEvent, track } from "@/lib/analytics";
import { useLocale } from "@/lib/i18n";
import { nearestInstantZoneFromCoordinates } from "@/lib/instant/zones";
import type { InstantStartState, InstantZoneSelection } from "@/lib/instant/types";
import styles from "./instant.module.css";

const START_KEY = "meshimatch_instant_start";

function InstantStartPageLegacy() {
  const router = useRouter();
  const { t } = useLocale();
  const [partySize, setPartySize] = useState(3);
  const [zone, setZone] = useState<InstantZoneSelection | null>(null);
  const [needsLocationless, setNeedsLocationless] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationTried, setLocationTried] = useState(false);

  function persistAndGo(selectedZone: InstantZoneSelection | null) {
    const state: InstantStartState = {
      zone: selectedZone,
      partySize,
      createdAt: new Date().toISOString(),
    };
    track(AnalyticsEvent.INSTANT_STARTED, {
      partySize,
      locationMode: selectedZone ? "gps_zone" : "locationless",
      zoneId: selectedZone?.zoneId ?? null,
    });
    localStorage.setItem(START_KEY, JSON.stringify(state));
    router.push("/instant/round");
  }

  function startFromCurrentLocation() {
    if (locationTried || locating) {
      if (zone) persistAndGo(zone);
      else setNeedsLocationless(true);
      return;
    }

    setLocationTried(true);
    setLocating(true);
    if (!("geolocation" in navigator)) {
      setNeedsLocationless(true);
      setLocating(false);
      return;
    }

    // 端末がコールバックを一切返さないケース(権限ダイアログ放置など)への保険。
    // options.timeout だけに頼らず、JS側でも必ずフォールバックさせる (レビューP1)
    const fallbackTimer = window.setTimeout(() => {
      setNeedsLocationless(true);
      setLocating(false);
    }, 5000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(fallbackTimer);
        const resolved = nearestInstantZoneFromCoordinates({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setZone(resolved);
        setLocating(false);
        persistAndGo(resolved);
      },
      () => {
        window.clearTimeout(fallbackTimer);
        setNeedsLocationless(true);
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 4500, maximumAge: 0 }
    );
  }

  return (
    <main className={styles.screen}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>{t("instant.startEyebrow")}</span>
          <h1 className={styles.title}>{t("instant.startTitle")}</h1>
          <p className={styles.desc}>{t("instant.startDesc")}</p>
        </header>

        <section className={`${styles.panel} ${styles.stack}`}>
          {zone && (
            <div className={styles.chipGrid}>
              <Chip variant="sage" icon="◎">
                {t("instant.locationReady", { zone: zone.name })}
              </Chip>
            </div>
          )}

          {needsLocationless && (
            <p className={styles.desc}>{t("instant.locationDenied")}</p>
          )}

          <div className={styles.stack}>
            <p className={styles.sectionTitle}>{t("instant.partySize")}</p>
            <div className={styles.stepper}>
              <button
                className={styles.iconButton}
                type="button"
                aria-label={t("instant.minus")}
                onClick={() => setPartySize((value) => Math.max(2, value - 1))}
              >
                <Minus size={18} />
              </button>
              <div className={styles.count}>
                {t("instant.people", { count: partySize })}
              </div>
              <button
                className={styles.iconButton}
                type="button"
                aria-label={t("instant.plus")}
                onClick={() => setPartySize((value) => Math.min(8, value + 1))}
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          <div className={styles.actions}>
            {needsLocationless ? (
              <PillButton variant="cta" onClick={() => persistAndGo(null)}>
                {t("instant.locationlessButton")}
              </PillButton>
            ) : (
              <>
                <PillButton variant="cta" disabled={locating} onClick={startFromCurrentLocation}>
                  {locating ? t("common.processing") : t("instant.locationGpsButton")}
                </PillButton>
                <PillButton variant="ghost" onClick={() => persistAndGo(null)}>
                  {t("instant.locationlessButton")}
                </PillButton>
              </>
            )}
            {zone && (
              <PillButton variant="ghost" onClick={() => persistAndGo(zone)}>
                {t("instant.startRound")}
              </PillButton>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function InstantStartPage() {
  return <InstantDiscoveryBoundary screen="start"><InstantStartPageLegacy /></InstantDiscoveryBoundary>;
}
