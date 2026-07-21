"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LocateFixed, Minus, Plus, UsersRound } from "lucide-react";
import { Chip, PillButton } from "@/components/v2";
import { useUser } from "@/lib/hooks/useUser";
import { useLocale } from "@/lib/i18n";
import { INITIAL_ZONES, SURVEY_AREAS } from "@/lib/areas";
import { nearestInstantZoneFromCoordinates } from "@/lib/instant/zones";
import type { InstantZoneSelection } from "@/lib/instant/types";
import styles from "./instant.module.css";

type CreatedRoom = {
  room: {
    code: string;
    groupId: string;
    partySize: number;
  };
  member: {
    id: string;
    displayName: string;
  };
};

function storeRoomMember(code: string, room: CreatedRoom) {
  sessionStorage.setItem(
    `meshimatch_instant_room_${code}`,
    JSON.stringify({
      groupId: room.room.groupId,
      memberId: room.member.id,
      displayName: room.member.displayName,
    })
  );
}

export default function InstantStartPage() {
  const router = useRouter();
  const { t } = useLocale();
  const { user, userId } = useUser();
  const [partySize, setPartySize] = useState(3);
  const [displayName, setDisplayName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [zone, setZone] = useState<InstantZoneSelection | null>(null);
  const [needsAreaPick, setNeedsAreaPick] = useState(false);
  const [locating, setLocating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const effectiveName = displayName.trim() || user?.displayName || t("instant.defaultGuestName");

  function resolveLocation(): Promise<InstantZoneSelection | null> {
    if (zone) return Promise.resolve(zone);
    if (!("geolocation" in navigator)) return Promise.resolve(null);

    setLocating(true);
    return new Promise((resolve) => {
      const finish = (selection: InstantZoneSelection | null) => {
        setLocating(false);
        if (selection) setZone(selection);
        resolve(selection);
      };
      const fallbackTimer = window.setTimeout(() => finish(null), 4500);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          window.clearTimeout(fallbackTimer);
          finish(
            nearestInstantZoneFromCoordinates({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            })
          );
        },
        () => {
          window.clearTimeout(fallbackTimer);
          finish(null);
        },
        { enableHighAccuracy: false, timeout: 4000, maximumAge: 60_000 }
      );
    });
  }

  async function createRoom() {
    setCreating(true);
    setError("");
    try {
      const selectedZone = await resolveLocation();
      if (!selectedZone) {
        setNeedsAreaPick(true);
        return;
      }
      const response = await fetch("/instant/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partySize,
          zone: selectedZone,
          displayName: effectiveName,
          profileId: userId,
        }),
      });
      const data = (await response.json()) as CreatedRoom & { error?: string };
      if (!response.ok) throw new Error(data.error || t("instant.roomCreateFailed"));
      storeRoomMember(data.room.code, data);
      router.push(`/instant/room/${data.room.code}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("instant.roomCreateFailed"));
    } finally {
      setCreating(false);
    }
  }

  function joinRoom() {
    const normalized = joinCode.trim().toUpperCase();
    if (!normalized) return;
    router.push(`/instant/room/${normalized}`);
  }

  return (
    <main className={`${styles.screen} ${styles.gardenScreen} ${styles.startGardenScreen}`}>
      <div className={styles.gardenBackdrop} aria-hidden>
        <span className={styles.gardenFence} />
        <span className={styles.gardenBush} />
        <span className={styles.gardenFlowers} />
      </div>
      <div className={`${styles.shell} ${styles.gardenShell}`}>
        <header className={`${styles.header} ${styles.gardenHeader}`}>
          <span className={styles.eyebrow}>{t("instant.startEyebrow")}</span>
          <h1 className={styles.title}>{t("instant.gatherStartTitle")}</h1>
          <p className={styles.desc}>{t("instant.gatherStartDesc")}</p>
        </header>

        <section className={`${styles.summonScene} ${styles.panel} ${styles.gardenPanel}`}>
          <div className={styles.summonFence} aria-hidden />
          <div className={styles.summonFlowers} aria-hidden>✿ · ✿</div>
          <div className={styles.picnicBlanket} aria-hidden />
          <div className={styles.summonGlow} aria-hidden />
          <div className={styles.miniTable} aria-hidden>
            <span className={styles.miniTableTop}>30</span>
            <span className={styles.miniTableFoot} />
            <span className={styles.miniChairLeft} />
            <span className={styles.miniChairRight} />
          </div>
          <div className={styles.summonCopy}>
            <Chip variant="selected" icon="⚡">
              {t("instant.quickFastFun")}
            </Chip>
            <strong>{t("instant.summonTable")}</strong>
            <span>{t("instant.everyPhonePlayer")}</span>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.stack} ${styles.gardenPanel} ${styles.setupPanel}`}>
          <label className={styles.stack}>
            <span className={styles.sectionTitle}>{t("instant.yourName")}</span>
            <input
              className={styles.input}
              value={displayName}
              maxLength={18}
              placeholder={user?.displayName || t("instant.defaultGuestName")}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>

          <div className={styles.stack}>
            <p className={styles.sectionTitle}>{t("instant.partySize")}</p>
            <div className={styles.stepper}>
              <button
                className={styles.iconButton}
                type="button"
                aria-label={t("instant.minus")}
                onClick={() => setPartySize((value) => Math.max(1, value - 1))}
              >
                <Minus size={18} />
              </button>
              <div className={styles.count}>
                <UsersRound size={20} />
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

          {zone && (
            <div className={styles.chipGrid}>
              <Chip variant="sage" icon="◎">
                {t("instant.locationReady", { zone: zone.name })}
              </Chip>
            </div>
          )}

          {needsAreaPick && !zone && (
            <div className={styles.manualAreaPicker}>
              <div>
                <strong>{t("instant.pickNearbyArea")}</strong>
                <span>{t("instant.pickNearbyAreaDesc")}</span>
              </div>
              <div className={styles.areaChoiceGrid}>
                {INITIAL_ZONES.filter((item) =>
                  (SURVEY_AREAS as readonly string[]).includes(item.name)
                ).map((item) => (
                  <button
                    type="button"
                    className={styles.areaChoice}
                    key={item.id}
                    onClick={() => {
                      setZone({
                        zoneId: item.id,
                        name: item.name,
                        station: item.station,
                        source: "manual",
                      });
                      setNeedsAreaPick(false);
                    }}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <PillButton
            variant="cta"
            icon={<LocateFixed size={17} />}
            disabled={creating || locating}
            onClick={() => void createRoom()}
          >
            {creating || locating
              ? t("common.processing")
              : zone?.source === "manual"
                ? t("instant.createFromSelectedArea")
                : t("instant.createGathering")}
          </PillButton>

          {error && <p className={styles.formError}>{error}</p>}
        </section>

        <section className={`${styles.panel} ${styles.joinStrip} ${styles.gardenPanel} ${styles.joinGardenPanel}`}>
          <div>
            <span className={styles.sectionTitle}>{t("instant.alreadyInvited")}</span>
            <p className={styles.desc}>{t("instant.enterRoomCode")}</p>
          </div>
          <div className={styles.joinControls}>
            <input
              className={styles.codeInput}
              value={joinCode}
              maxLength={8}
              inputMode="text"
              autoCapitalize="characters"
              placeholder="ABC123"
              aria-label={t("instant.roomCode")}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === "Enter") joinRoom();
              }}
            />
            <button
              type="button"
              className={styles.codeGo}
              aria-label={t("instant.joinRoom")}
              disabled={!joinCode.trim()}
              onClick={joinRoom}
            >
              <ArrowRight size={19} />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
