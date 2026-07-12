"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { Chip, PillButton } from "@/components/v2";
import { INITIAL_STATION_ZONE_MAP } from "@/lib/areas";
import { useLocale } from "@/lib/i18n";
import { instantZoneFromStation, nearestInstantZoneFromCoordinates } from "@/lib/instant/zones";
import type { InstantStartState, InstantZoneSelection } from "@/lib/instant/types";
import styles from "./instant.module.css";

const START_KEY = "meshimatch_instant_start";

export default function InstantStartPage() {
  const router = useRouter();
  const { t } = useLocale();
  const stations = useMemo(
    () => INITIAL_STATION_ZONE_MAP.map((entry) => entry.station),
    []
  );
  const [partySize, setPartySize] = useState(3);
  const [station, setStation] = useState(stations[0] ?? "渋谷駅");
  const [zone, setZone] = useState<InstantZoneSelection | null>(null);
  const [needsPicker, setNeedsPicker] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationTried, setLocationTried] = useState(false);

  function persistAndGo(selectedZone: InstantZoneSelection) {
    const state: InstantStartState = {
      zone: selectedZone,
      partySize,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(START_KEY, JSON.stringify(state));
    router.push("/instant/round");
  }

  function usePickerStation() {
    const selected = instantZoneFromStation(station);
    if (!selected) return;
    setZone(selected);
    persistAndGo(selected);
  }

  function startFromCurrentLocation() {
    if (locationTried || locating) {
      if (zone) persistAndGo(zone);
      else setNeedsPicker(true);
      return;
    }

    setLocationTried(true);
    setLocating(true);
    if (!("geolocation" in navigator)) {
      setNeedsPicker(true);
      setLocating(false);
      return;
    }

    // 端末がコールバックを一切返さないケース(権限ダイアログ放置など)への保険。
    // options.timeout だけに頼らず、JS側でも必ずフォールバックさせる (レビューP1)
    const fallbackTimer = window.setTimeout(() => {
      setNeedsPicker(true);
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
        setNeedsPicker(true);
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

          {needsPicker && (
            <div className={styles.stack}>
              <p className={styles.desc}>{t("instant.locationDenied")}</p>
              <label className={styles.stack}>
                <span className={styles.sectionTitle}>
                  {t("instant.locationPickerLabel")}
                </span>
                <input
                  className={styles.input}
                  list="instant-stations"
                  value={station}
                  placeholder={t("instant.locationPickerPlaceholder")}
                  onChange={(event) => setStation(event.target.value)}
                />
              </label>
              <datalist id="instant-stations">
                {stations.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>
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
            {needsPicker ? (
              <PillButton variant="cta" onClick={usePickerStation}>
                {t("instant.locationPickerButton")}
              </PillButton>
            ) : (
              <PillButton variant="cta" disabled={locating} onClick={startFromCurrentLocation}>
                {locating ? t("common.processing") : t("instant.locationGpsButton")}
              </PillButton>
            )}
            {/* GPS保留中でも駅選択に必ず抜けられる恒常エスケープ (レビューP1) */}
            {!needsPicker && (
              <button
                type="button"
                onClick={() => setNeedsPicker(true)}
                style={{ background: "none", border: 0, color: "var(--v2-muted)", fontSize: 12.5, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" }}
              >
                {t("instant.locationPickManually")}
              </button>
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
