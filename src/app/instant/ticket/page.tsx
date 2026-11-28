"use client";

import { InstantDiscoveryBoundary } from "@/components/instant/DiscoveryFlow";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Clock3,
  Footprints,
  MapPin,
  Phone,
  Share2,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";
import { Chip, PillButton } from "@/components/v2";
import { AnalyticsEvent, track } from "@/lib/analytics";
import { useLocale } from "@/lib/i18n";
import type { InstantAggregate, InstantZoneSelection } from "@/lib/instant/types";
import { openingStateForRestaurant } from "@/lib/recommendation/ranking";
import type { Restaurant } from "@/lib/types";
import styles from "../instant.module.css";

const TICKET_KEY = "meshimatch_instant_ticket";
const FALLBACK_PHOTO = "/img/service/07-restaurant-sticker-sheet.webp";

type StoredTicket = {
  groupId: string;
  zone: InstantZoneSelection | null;
  partySize: number;
  aggregate: InstantAggregate;
  restaurant: Restaurant;
  approvalCount?: number;
  tied?: boolean;
  decidedAt: string;
};

function mapLink(restaurant: Restaurant) {
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

function InstantTicketPageLegacy() {
  const { locale, t } = useLocale();
  const [ticket, setTicket] = useState<StoredTicket | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const raw = localStorage.getItem(TICKET_KEY);
      setTicket(raw ? (JSON.parse(raw) as StoredTicket) : null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const ngMemo = useMemo(() => {
    if (!ticket || ticket.aggregate.ng.length === 0) return t("instant.ticketNoNg");
    return ticket.aggregate.ng
      .slice(0, 4)
      .map((item) => `${item.label} ${item.count}`)
      .join(" / ");
  }, [ticket, t]);

  const openingHoursText = useMemo(() => {
    if (!ticket) return null;
    if (ticket.restaurant.openHours?.trim()) return ticket.restaurant.openHours.trim();
    const raw = ticket.restaurant.openingHours;
    if (!raw) return null;
    const weekdayText = raw.weekdayText ?? raw.weekdayDescriptions;
    if (Array.isArray(weekdayText)) {
      return weekdayText.filter((item): item is string => typeof item === "string").join(" / ");
    }
    return null;
  }, [ticket]);

  async function shareOnWay() {
    if (!ticket) return;
    track(AnalyticsEvent.LINK_SHARED, {
      groupId: ticket.groupId,
      mode: "instant",
      restaurantId: ticket.restaurant.id,
    });
    const url = `${window.location.origin}/groups/${ticket.groupId}/results`;
    const text = `${ticket.restaurant.name} ${t("instant.ticketStamp")}`;
    if (navigator.share) {
      await navigator.share({ title: "MeshiMatch", text, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  if (!ticket) {
    return (
      <main className={styles.screen}>
        <div className={styles.shell}>
          <section className={styles.empty}>
            <p className={styles.desc}>{t("instant.ticketMissing")}</p>
            <Link className={styles.anchorPill} href="/instant">
              {t("instant.startEyebrow")}
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const decidedAt = new Date(ticket.decidedAt);
  const restaurant = ticket.restaurant;
  const openingState = openingStateForRestaurant(restaurant);
  const openingLabel =
    openingState === "open"
      ? t("instant.ticketOpen")
      : openingState === "closed"
        ? t("instant.ticketClosed")
        : t("instant.ticketCheckHours");
  const reasons = (restaurant.reasonTags ?? []).filter((tag) => tag !== "固定データ").slice(0, 3);
  const sourceLabel = restaurant.recommendationLabel ?? null;
  const isDemo = restaurant.id.startsWith("instant-demo-");
  const timeLocale = locale === "ja" ? "ja-JP" : "en-US";

  return (
    <main className={styles.screen}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>{t("instant.ticketEyebrow")}</span>
          <h1 className={styles.title}>{t("instant.ticketDecisionReady")}</h1>
        </header>

        <article className={styles.ticketCard}>
          <div className={styles.ticketPhoto}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={restaurant.photoUrl ?? FALLBACK_PHOTO} alt={restaurant.name} />
            <div className={styles.ticketPhotoBadges}>
              <Chip variant={openingState === "open" ? "sage" : "honey"}>
                {openingLabel}
              </Chip>
              {restaurant.pr && <Chip variant="blush">PR</Chip>}
            </div>
          </div>

          <div className={styles.ticketBody}>
            <div>
              <p className={styles.ticketKicker}>{t("instant.ticketStamp")}</p>
              <h2 className={styles.ticketRestaurantName}>{restaurant.name}</h2>
              <p className={styles.ticketRestaurantMeta}>
                {[restaurant.area || ticket.zone?.name, restaurant.genre]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>

            <div className={styles.ticketApproval}>
              <span className={styles.ticketApprovalIcon} aria-hidden="true">
                <Users size={20} />
              </span>
              <div>
                <strong>
                  {typeof ticket.approvalCount === "number"
                    ? t("instant.ticketApproval", {
                        count: ticket.approvalCount,
                        total: ticket.partySize,
                      })
                    : t("instant.ticketApprovalFallback")}
                </strong>
                {ticket.tied && <small>{t("instant.ticketTied")}</small>}
              </div>
            </div>

            {reasons.length > 0 && (
              <section className={styles.ticketReasons}>
                <span>{t("instant.ticketWhy")}</span>
                <div className={styles.chipGrid}>
                  {reasons.map((reason) => (
                    <Chip key={reason}>{reason}</Chip>
                  ))}
                </div>
              </section>
            )}

            <div className={styles.ticketFacts}>
              <div>
                <Footprints size={18} aria-hidden="true" />
                <span>{t("instant.ticketAccess")}</span>
                <strong>{restaurant.access || t("instant.ticketUnknownAccess")}</strong>
              </div>
              <div>
                <WalletCards size={18} aria-hidden="true" />
                <span>{t("instant.ticketBudget")}</span>
                <strong>{restaurant.budget || t("instant.ticketUnknownBudget")}</strong>
              </div>
              <div>
                <Clock3 size={18} aria-hidden="true" />
                <span>{t("instant.ticketHours")}</span>
                <strong>{openingLabel}</strong>
              </div>
            </div>

            <a
              className={styles.ticketPrimaryAction}
              href={mapLink(restaurant)}
              target="_blank"
              rel="noreferrer"
              onClick={() =>
                track(AnalyticsEvent.INSTANT_MAP_OPENED, {
                  groupId: ticket.groupId,
                  restaurantId: restaurant.id,
                })
              }
            >
              <MapPin size={19} />
              {t("instant.ticketGoMaps")}
            </a>

            {restaurant.phoneNumber?.trim() && (
              <a
                className={styles.ticketSecondaryAction}
                href={`tel:${restaurant.phoneNumber.trim()}`}
              >
                <Phone size={17} />
                {t("instant.ticketCall")}
              </a>
            )}

            <div className={styles.ticketSafety}>
              <ShieldCheck size={19} aria-hidden="true" />
              <div>
                <strong>{t("instant.ticketSafetyTitle")}</strong>
                <p>{t("instant.ticketSafetyNote")}</p>
              </div>
            </div>

            {isDemo && <p className={styles.ticketDemoNote}>{t("instant.ticketDemoNote")}</p>}

            <details className={styles.ticketDetails}>
              <summary>
                {t("instant.ticketDetails")}
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <dl>
                <div>
                  <dt>{t("instant.ticketAddress")}</dt>
                  <dd>{restaurant.address || restaurant.area || t("instant.ticketNoInfo")}</dd>
                </div>
                <div>
                  <dt>{t("instant.ticketHoursDetail")}</dt>
                  <dd>{openingHoursText || openingLabel}</dd>
                </div>
                {restaurant.phoneNumber?.trim() && (
                  <div>
                    <dt>{t("instant.ticketPhone")}</dt>
                    <dd>{restaurant.phoneNumber.trim()}</dd>
                  </div>
                )}
                {sourceLabel && (
                  <div>
                    <dt>{t("instant.ticketSource")}</dt>
                    <dd>{sourceLabel}</dd>
                  </div>
                )}
                <div>
                  <dt>{t("instant.ticketGroupMemo")}</dt>
                  <dd>{ngMemo}</dd>
                </div>
                <div>
                  <dt>{t("instant.ticketDecisionTime")}</dt>
                  <dd>
                    {decidedAt.toLocaleTimeString(timeLocale, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </dd>
                </div>
              </dl>
            </details>
          </div>
        </article>

        <div className={styles.ticketFooterActions}>
          <PillButton variant="ghost" icon={<Share2 size={16} />} onClick={shareOnWay}>
            {copied ? t("instant.shareCopied") : t("instant.shareOnWay")}
          </PillButton>
          <Link className={styles.ticketTextLink} href="/instant/round?add=1">
            {t("instant.addLater")}
          </Link>
          <Link className={styles.ticketTextLink} href="/home">
            {t("instant.ticketBackHome")}
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function InstantTicketPage() {
  return <InstantDiscoveryBoundary screen="ticket"><InstantTicketPageLegacy /></InstantDiscoveryBoundary>;
}
