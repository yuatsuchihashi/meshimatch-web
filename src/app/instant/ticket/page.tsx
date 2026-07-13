"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Share2 } from "lucide-react";
import { PillButton, TicketStub } from "@/components/v2";
import { useLocale } from "@/lib/i18n";
import type { InstantAggregate, InstantZoneSelection } from "@/lib/instant/types";
import type { Restaurant } from "@/lib/types";
import styles from "../instant.module.css";

const TICKET_KEY = "meshimatch_instant_ticket";

type StoredTicket = {
  groupId: string;
  zone: InstantZoneSelection | null;
  partySize: number;
  aggregate: InstantAggregate;
  restaurant: Restaurant;
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

export default function InstantTicketPage() {
  const { t } = useLocale();
  const [ticket, setTicket] = useState<StoredTicket | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(TICKET_KEY);
    setTicket(raw ? (JSON.parse(raw) as StoredTicket) : null);
  }, []);

  const ngMemo = useMemo(() => {
    if (!ticket || ticket.aggregate.ng.length === 0) return t("instant.ticketNoNg");
    return ticket.aggregate.ng
      .slice(0, 4)
      .map((item) => `${item.label} ${item.count}`)
      .join(" / ");
  }, [ticket, t]);

  async function shareOnWay() {
    if (!ticket) return;
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

  return (
    <main className={styles.screen}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>{t("instant.ticketEyebrow")}</span>
          <h1 className={styles.title}>{ticket.restaurant.name}</h1>
        </header>

        <TicketStub
          heading={ticket.restaurant.name}
          subtitle={ticket.restaurant.area || ticket.zone?.name || t("instant.nearby")}
          stamp={t("instant.ticketStamp")}
          items={[
            {
              label: t("instant.ticketNow"),
              value: decidedAt.toLocaleTimeString("ja-JP", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
            {
              label: t("instant.ticketZone"),
              value: ticket.zone?.name ?? t("instant.locationlessTicket"),
            },
            {
              label: t("instant.ticketPeople"),
              value: t("instant.people", { count: ticket.partySize }),
            },
            { label: t("instant.ticketNg"), value: ngMemo },
          ]}
        />

        <div className={styles.actions} style={{ marginTop: 18 }}>
          <a className={styles.anchorPill} href={mapLink(ticket.restaurant)} target="_blank">
            <MapPin size={16} />
            {t("instant.openMap")}
          </a>
          <PillButton variant="ghost" icon={<Share2 size={16} />} onClick={shareOnWay}>
            {copied ? t("instant.shareCopied") : t("instant.shareOnWay")}
          </PillButton>
          <Link className={styles.anchorPill} href="/instant/round?add=1">
            {t("instant.addLater")}
          </Link>
        </div>

        <div className={styles.todo}>{t("instant.todoGuestConversion")}</div>
      </div>
    </main>
  );
}
