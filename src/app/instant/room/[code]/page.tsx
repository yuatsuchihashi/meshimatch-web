"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Check, Clock3, Copy, MapPin, Share2, Sparkles } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { PillButton, TicketStub } from "@/components/v2";
import { useUser } from "@/lib/hooks/useUser";
import { useLocale } from "@/lib/i18n";
import {
  INSTANT_OPINIONS,
  buildInstantOpinionPayload,
  type InstantOpinionToken,
} from "@/lib/instant/opinions";
import type { Restaurant } from "@/lib/types";
import styles from "../../instant.module.css";

type RoomMember = {
  id: string;
  displayName: string;
  hasSurvey: boolean;
};

type AggregateItem = {
  token: InstantOpinionToken;
  count: number;
};

type RoomProposal = {
  restaurant: Restaurant;
  revision: number;
  proposedAt: string;
};

type RoomDecision = {
  restaurantId: string | null;
  restaurantName: string;
  genreId: string | null;
  decidedAt: string;
  restaurant?: Restaurant | null;
};

type InstantRoomState = {
  code: string;
  groupId: string;
  name: string;
  partySize: number;
  status: string;
  members: RoomMember[];
  answeredCount: number;
  aggregate: {
    wish: AggregateItem[];
    avoid: AggregateItem[];
  };
  proposal: RoomProposal | null;
  decision: RoomDecision | null;
  myObjection: boolean;
  objectionCount: number;
};

type StoredMember = {
  groupId: string;
  memberId: string;
  displayName: string;
};

const ROUND_SECONDS = 30;
const OBJECTION_SECONDS = 5;

function roomStorageKey(code: string) {
  return `meshimatch_instant_room_${code}`;
}

function opinionLabel(token: InstantOpinionToken, locale: "ja" | "en") {
  const opinion = INSTANT_OPINIONS.find((item) => item.id === token);
  return opinion ? (locale === "en" ? opinion.labelEn : opinion.labelJa) : token;
}

function restaurantMapLink(restaurant: Restaurant) {
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

function TableScene({
  room,
  myMemberId,
}: {
  room: InstantRoomState;
  myMemberId: string | null;
}) {
  const seats = Array.from({ length: room.partySize }, (_, index) => room.members[index] ?? null);
  return (
    <div className={styles.roomTableScene} aria-label={`${room.answeredCount}/${room.partySize}`}>
      <div className={styles.sceneFence} aria-hidden />
      <div className={styles.sceneBunting} aria-hidden />
      <div className={styles.sceneFlowerPatch} aria-hidden>✿</div>
      <div className={styles.scenePicnicRug} aria-hidden />
      <div className={styles.roomFloor} aria-hidden />
      <div className={styles.roomTable} aria-hidden>
        <span className={styles.roomTableSurface}>
          <span>{room.proposal ? "!" : room.answeredCount}</span>
        </span>
        <span className={styles.roomTableBase} />
      </div>
      <div className={styles.seatRing}>
        {seats.map((member, index) => (
          <div
            className={`${styles.seatAvatar} ${
              member?.id === myMemberId ? styles.seatAvatarMe : ""
            } ${member?.hasSurvey ? styles.seatAvatarReady : ""}`}
            key={member?.id ?? `empty-${index}`}
            style={{ "--seat-index": index, "--seat-count": room.partySize } as React.CSSProperties}
            title={member?.displayName ?? ""}
          >
            <span className={styles.avatarHead} />
            <span className={styles.avatarBody} />
            <span className={styles.avatarShadow} aria-hidden />
            {member?.hasSurvey && (
              <span className={styles.readySpark}>
                <Check size={9} strokeWidth={4} />
              </span>
            )}
          </div>
        ))}
      </div>
      <div className={styles.tableSceneCaption}>
        <strong>{room.answeredCount}/{room.partySize}</strong>
        <span>{room.proposal ? "MATCH" : "SEATED"}</span>
      </div>
    </div>
  );
}

export default function InstantRoomPage() {
  const params = useParams<{ code: string }>();
  const code = String(params.code || "").toUpperCase();
  const { locale, t } = useLocale();
  const { user, userId } = useUser();
  const [room, setRoom] = useState<InstantRoomState | null>(null);
  const [member, setMember] = useState<StoredMember | null>(null);
  const [joinName, setJoinName] = useState("");
  const [wish, setWish] = useState<InstantOpinionToken | null>(null);
  const [avoid, setAvoid] = useState<InstantOpinionToken | null>(null);
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [proposalSeconds, setProposalSeconds] = useState(OBJECTION_SECONDS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const proposalLock = useRef(false);
  const decisionLock = useRef(false);

  const inviteUrl =
    typeof window === "undefined" ? `/instant/room/${code}` : `${window.location.origin}/instant/room/${code}`;
  const myRoomMember = room?.members.find((item) => item.id === member?.memberId) ?? null;

  const loadRoom = useCallback(async () => {
    if (!code) return;
    const memberQuery = member?.memberId ? `?member_id=${encodeURIComponent(member.memberId)}` : "";
    const response = await fetch(`/instant/api/rooms/${encodeURIComponent(code)}${memberQuery}`, {
      cache: "no-store",
    });
    const data = (await response.json()) as { room?: InstantRoomState; error?: string };
    if (!response.ok || !data.room) {
      throw new Error(data.error || t("instant.roomNotFound"));
    }
    setRoom(data.room);
  }, [code, member?.memberId, t]);

  useEffect(() => {
    if (!code) return;
    const raw = sessionStorage.getItem(roomStorageKey(code));
    if (raw) {
      try {
        setMember(JSON.parse(raw) as StoredMember);
      } catch {
        sessionStorage.removeItem(roomStorageKey(code));
      }
    }
  }, [code]);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        await loadRoom();
        if (active) setError("");
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : t("instant.roomNotFound"));
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 1500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [loadRoom, t]);

  const submitOpinion = useCallback(async () => {
    if (!member || !room || busy || myRoomMember?.hasSurvey) return;
    setBusy(true);
    setError("");
    try {
      const opinion = buildInstantOpinionPayload({ wish, avoid });
      const response = await fetch(`/instant/api/rooms/${encodeURIComponent(code)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "survey",
          memberId: member.memberId,
          wish,
          avoid,
          ...opinion,
          dietaryRestrictions: user?.dietaryRestrictions ?? [],
          allergyNote: user?.allergyNote ?? null,
          dietaryNote: user?.dietaryNote ?? null,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || t("instant.opinionSaveFailed"));
      await loadRoom();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("instant.opinionSaveFailed"));
    } finally {
      setBusy(false);
    }
  }, [avoid, busy, code, loadRoom, member, myRoomMember?.hasSurvey, room, t, user, wish]);

  useEffect(() => {
    if (!member || !room || myRoomMember?.hasSurvey || room.decision || room.proposal) return;
    if (seconds <= 0) {
      void submitOpinion();
      return;
    }
    const timer = window.setTimeout(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [member, myRoomMember?.hasSurvey, room, seconds, submitOpinion]);

  const propose = useCallback(
    async (revision: number) => {
      if (!member || proposalLock.current) return;
      proposalLock.current = true;
      try {
        const response = await fetch(`/instant/api/rooms/${encodeURIComponent(code)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "propose", memberId: member.memberId, revision }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(data.error || t("instant.proposalFailed"));
        await loadRoom();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t("instant.proposalFailed"));
      } finally {
        proposalLock.current = false;
      }
    },
    [code, loadRoom, member, t]
  );

  useEffect(() => {
    if (
      !room ||
      !member ||
      room.proposal ||
      room.decision ||
      room.answeredCount === 0 ||
      room.answeredCount < room.partySize
    ) {
      return;
    }
    void propose(0);
  }, [member, propose, room]);

  useEffect(() => {
    if (!room?.proposal || room.decision) return;
    const elapsed = Math.floor((Date.now() - new Date(room.proposal.proposedAt).getTime()) / 1000);
    setProposalSeconds(Math.max(0, OBJECTION_SECONDS - elapsed));
    const interval = window.setInterval(() => {
      const nextElapsed = Math.floor(
        (Date.now() - new Date(room.proposal!.proposedAt).getTime()) / 1000
      );
      setProposalSeconds(Math.max(0, OBJECTION_SECONDS - nextElapsed));
    }, 250);
    return () => window.clearInterval(interval);
  }, [room?.decision, room?.proposal]);

  const decide = useCallback(async () => {
    if (!room?.proposal || decisionLock.current) return;
    decisionLock.current = true;
    try {
      const restaurant = room.proposal.restaurant;
      const response = await fetch("/api/groups/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: room.groupId,
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          genreId: restaurant.genreId,
          decidedBy: userId,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || t("instant.decisionFailed"));
      await loadRoom();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("instant.decisionFailed"));
    } finally {
      decisionLock.current = false;
    }
  }, [loadRoom, room, t, userId]);

  useEffect(() => {
    if (!room?.proposal || room.decision || proposalSeconds > 0) return;
    if (room.objectionCount > 0 && room.proposal.revision === 0) {
      void propose(1);
      return;
    }
    void decide();
  }, [decide, proposalSeconds, propose, room]);

  async function joinRoom() {
    const displayName = joinName.trim() || user?.displayName || t("instant.defaultGuestName");
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/instant/api/rooms/${encodeURIComponent(code)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", displayName, profileId: userId }),
      });
      const data = (await response.json()) as {
        member?: { id: string; displayName: string };
        room?: { groupId: string };
        error?: string;
      };
      if (!response.ok || !data.member) throw new Error(data.error || t("instant.joinFailed"));
      const stored = {
        groupId: data.room?.groupId || room?.groupId || "",
        memberId: data.member.id,
        displayName: data.member.displayName,
      };
      sessionStorage.setItem(roomStorageKey(code), JSON.stringify(stored));
      setMember(stored);
      setSeconds(ROUND_SECONDS);
      await loadRoom();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("instant.joinFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function shareRoom() {
    const shareData = { title: "MeshiMatch", text: t("instant.shareRoomText"), url: inviteUrl };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
  }

  async function objectPrivately() {
    if (!member || !room?.proposal || room.myObjection || room.proposal.revision > 0) return;
    setBusy(true);
    try {
      const restaurant = room.proposal.restaurant;
      const response = await fetch("/api/groups/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: room.groupId,
          memberId: member.memberId,
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          genreId: restaurant.genreId,
          vote: "no",
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || t("instant.objectionFailed"));
      await loadRoom();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("instant.objectionFailed"));
    } finally {
      setBusy(false);
    }
  }

  const aggregateChips = useMemo(
    () => [
      ...(room?.aggregate.wish ?? []).map((item) => ({
        ...item,
        kind: "wish" as const,
      })),
      ...(room?.aggregate.avoid ?? []).map((item) => ({
        ...item,
        kind: "avoid" as const,
      })),
    ],
    [room?.aggregate]
  );

  if (!room) {
    return (
      <main className={`${styles.screen} ${styles.gardenScreen} ${styles.roomGardenScreen}`}>
        <div className={`${styles.shell} ${styles.gardenShell}`}>
          <section className={`${styles.empty} ${styles.gardenPanel}`}>
            <div className={styles.loadingOrb} />
            <p className={styles.desc}>{error || t("instant.loadingRoom")}</p>
          </section>
        </div>
      </main>
    );
  }

  if (!member || !myRoomMember) {
    return (
      <main className={`${styles.screen} ${styles.gardenScreen} ${styles.roomGardenScreen}`}>
        <div className={`${styles.shell} ${styles.gardenShell}`}>
          <header className={`${styles.header} ${styles.gardenHeader}`}>
            <span className={styles.eyebrow}>{t("instant.invitedEyebrow")}</span>
            <h1 className={styles.title}>{t("instant.takeASeat")}</h1>
            <p className={styles.desc}>{t("instant.takeASeatDesc")}</p>
          </header>
          <TableScene room={room} myMemberId={null} />
          <section className={`${styles.panel} ${styles.stack} ${styles.gardenPanel}`}>
            <label className={styles.stack}>
              <span className={styles.sectionTitle}>{t("instant.yourName")}</span>
              <input
                className={styles.input}
                value={joinName}
                maxLength={18}
                placeholder={user?.displayName || t("instant.defaultGuestName")}
                onChange={(event) => setJoinName(event.target.value)}
              />
            </label>
            <PillButton variant="cta" disabled={busy} onClick={() => void joinRoom()}>
              {busy ? t("common.processing") : t("instant.takeThisSeat")}
            </PillButton>
            {error && <p className={styles.formError}>{error}</p>}
          </section>
        </div>
      </main>
    );
  }

  if (room.decision) {
    const restaurant =
      room.decision.restaurant ??
      (room.proposal?.restaurant.id === room.decision.restaurantId
        ? room.proposal.restaurant
        : null);
    return (
      <main className={`${styles.screen} ${styles.gardenScreen} ${styles.roomGardenScreen} ${styles.ticketStrikeScreen}`}>
        <div className={styles.ticketStrike} aria-hidden />
        <div className={styles.ticketLandingGarden} aria-hidden>
          <span className={styles.ticketLandingPost} />
          <span className={styles.ticketLandingFlowers}>✿ ✿</span>
        </div>
        <div className={`${styles.shell} ${styles.gardenShell}`}>
          <header className={`${styles.header} ${styles.gardenHeader} ${styles.ticketArrive}`}>
            <span className={styles.eyebrow}>{t("instant.ticketEyebrow")}</span>
            <h1 className={styles.title}>{room.decision.restaurantName}</h1>
            <p className={styles.desc}>{t("instant.everyoneGotTicket")}</p>
          </header>
          <div className={styles.ticketArrive}>
            <TicketStub
              heading={room.decision.restaurantName}
              subtitle={restaurant?.area || t("instant.nearby")}
              stamp={t("instant.ticketStamp")}
              items={[
                { label: "ADMIT", value: t("instant.people", { count: room.partySize }) },
                {
                  label: "TIME",
                  value: new Date(room.decision.decidedAt).toLocaleTimeString(locale === "en" ? "en-US" : "ja-JP", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                },
                { label: "STATUS", value: t("instant.conditionsApplied") },
              ]}
            />
          </div>
          <div className={`${styles.actions} ${styles.ticketArrive}`} style={{ marginTop: 18 }}>
            {restaurant && (
              <a
                className={styles.anchorPill}
                href={restaurantMapLink(restaurant)}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin size={16} />
                {t("instant.openMap")}
              </a>
            )}
            <PillButton variant="ghost" icon={<Share2 size={16} />} onClick={() => void shareRoom()}>
              {t("instant.shareOnWay")}
            </PillButton>
          </div>
        </div>
      </main>
    );
  }

  if (room.proposal) {
    const restaurant = room.proposal.restaurant;
    return (
      <main className={`${styles.screen} ${styles.gardenScreen} ${styles.roomGardenScreen}`}>
        <div className={`${styles.shell} ${styles.gardenShell}`}>
          <header className={`${styles.header} ${styles.gardenHeader}`}>
            <span className={styles.eyebrow}>
              {room.proposal.revision === 0 ? t("instant.oneAnswer") : t("instant.reconsideredOnce")}
            </span>
            <h1 className={styles.title}>{restaurant.name}</h1>
            <p className={styles.desc}>{restaurant.reasonExplanation || t("instant.oneAnswerDesc")}</p>
          </header>
          <section className={`${styles.panel} ${styles.restaurantAnswer} ${styles.gardenPanel} ${styles.proposalGardenPanel}`}>
            {restaurant.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={restaurant.photoUrl} alt="" className={styles.answerPhoto} />
            ) : (
              <div className={styles.answerPhotoFallback}>🍽️</div>
            )}
            <div className={styles.answerMeta}>
              <strong>{restaurant.name}</strong>
              <span>{[restaurant.genre, restaurant.area, restaurant.budget].filter(Boolean).join(" · ")}</span>
            </div>
            <div className={styles.objectionWindow}>
              <div className={styles.objectionTimer}>
                <Clock3 size={17} />
                <strong>{proposalSeconds}</strong>
              </div>
              <div>
                <strong>{t("instant.privateCheck")}</strong>
                <p>{room.proposal.revision === 0 ? t("instant.privateCheckDesc") : t("instant.finalCheckDesc")}</p>
              </div>
            </div>
            {room.proposal.revision === 0 && (
              <PillButton
                variant="ghost"
                disabled={busy || room.myObjection || proposalSeconds === 0}
                onClick={() => void objectPrivately()}
              >
                {room.myObjection ? t("instant.objectionReceived") : t("instant.oneReconsideration")}
              </PillButton>
            )}
            {error && <p className={styles.formError}>{error}</p>}
          </section>
        </div>
      </main>
    );
  }

  if (myRoomMember.hasSurvey) {
    return (
      <main className={`${styles.screen} ${styles.gardenScreen} ${styles.roomGardenScreen}`}>
        <div className={`${styles.shell} ${styles.gardenShell}`}>
          <header className={styles.roomHeader}>
            <div>
              <span className={styles.eyebrow}>{t("instant.answersGathering")}</span>
              <h1 className={styles.title}>{t("instant.tableBecomingOne")}</h1>
            </div>
            <button type="button" className={styles.shareCircle} onClick={() => void shareRoom()}>
              {copied ? <Check size={18} /> : <Share2 size={18} />}
            </button>
          </header>
          <TableScene room={room} myMemberId={member.memberId} />
          <section className={`${styles.panel} ${styles.stack} ${styles.gardenPanel}`}>
            <div className={styles.progressTrack}>
              <span style={{ width: `${Math.min(100, (room.answeredCount / room.partySize) * 100)}%` }} />
            </div>
            <div className={styles.waitingCount}>
              <strong>{room.answeredCount}/{room.partySize}</strong>
              <span>{t("instant.answersReady")}</span>
            </div>
            {aggregateChips.length > 0 && (
              <div className={styles.floatingOpinions}>
                {aggregateChips.map((item) => (
                  <span className={item.kind === "wish" ? styles.wishBubble : styles.avoidBubble} key={`${item.kind}-${item.token}`}>
                    {item.kind === "wish" ? "♡" : "−"} {opinionLabel(item.token, locale)}
                    {item.count > 1 ? ` ×${item.count}` : ""}
                  </span>
                ))}
              </div>
            )}
            <div className={styles.qrInvite}>
              <QRCodeSVG value={inviteUrl} size={108} bgColor="#fff" fgColor="#221b16" />
              <div>
                <span>{t("instant.roomCode")}</span>
                <strong>{room.code}</strong>
                <button type="button" onClick={() => void shareRoom()}>
                  <Copy size={14} />
                  {copied ? t("instant.copied") : t("instant.inviteOthers")}
                </button>
              </div>
            </div>
            {room.answeredCount > 0 && room.answeredCount < room.partySize && (
              <PillButton variant="ghost" onClick={() => void propose(0)}>
                {t("instant.decideWithHere")}
              </PillButton>
            )}
            {error && <p className={styles.formError}>{error}</p>}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={`${styles.screen} ${styles.gardenScreen} ${styles.roomGardenScreen}`}>
      <div className={`${styles.shell} ${styles.gardenShell}`}>
        <header className={styles.roomHeader}>
          <div>
            <span className={styles.eyebrow}>
              {room.partySize <= 4 ? t("instant.conversationFirst") : t("instant.privateSimultaneous")}
            </span>
            <h1 className={styles.title}>{t("instant.throwYourFeeling")}</h1>
          </div>
          <div className={`${styles.roundCountdown} ${seconds <= 5 ? styles.roundCountdownUrgent : ""}`}>
            {seconds}
          </div>
        </header>
        <TableScene room={room} myMemberId={member.memberId} />
        <section className={`${styles.panel} ${styles.stack} ${styles.gardenPanel} ${styles.opinionGardenPanel}`}>
          <div className={styles.opinionSection}>
            <div>
              <span className={styles.opinionKicker}>WISH</span>
              <strong>{t("instant.whatWant")}</strong>
            </div>
            <div className={styles.opinionGrid}>
              {INSTANT_OPINIONS.map((opinion) => (
                <button
                  className={`${styles.opinionChip} ${wish === opinion.id ? styles.opinionChipWish : ""}`}
                  key={`wish-${opinion.id}`}
                  type="button"
                  aria-pressed={wish === opinion.id}
                  onClick={() => {
                    setWish((current) => (current === opinion.id ? null : opinion.id));
                    if (avoid === opinion.id) setAvoid(null);
                  }}
                >
                  <span>{opinion.emoji}</span>
                  {locale === "en" ? opinion.labelEn : opinion.labelJa}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.opinionSection}>
            <div>
              <span className={styles.opinionKicker}>AVOID</span>
              <strong>{t("instant.whatAvoid")}</strong>
              <small>{t("instant.optional")}</small>
            </div>
            <div className={styles.opinionGrid}>
              {INSTANT_OPINIONS.map((opinion) => (
                <button
                  className={`${styles.opinionChip} ${avoid === opinion.id ? styles.opinionChipAvoid : ""}`}
                  key={`avoid-${opinion.id}`}
                  type="button"
                  aria-pressed={avoid === opinion.id}
                  disabled={wish === opinion.id}
                  onClick={() => setAvoid((current) => (current === opinion.id ? null : opinion.id))}
                >
                  <span>{opinion.emoji}</span>
                  {locale === "en" ? opinion.labelEn : opinion.labelJa}
                </button>
              ))}
            </div>
          </div>
          <p className={styles.profileConditionNote}>
            <Sparkles size={15} />
            {user ? t("instant.profileConditionsAutomatic") : t("instant.guestConditionsNote")}
          </p>
          <PillButton variant="cta" disabled={busy} onClick={() => void submitOpinion()}>
            {busy
              ? t("common.processing")
              : wish || avoid
                ? t("instant.throwOntoTable")
                : t("instant.omakase")}
          </PillButton>
          {error && <p className={styles.formError}>{error}</p>}
        </section>
      </div>
    </main>
  );
}
