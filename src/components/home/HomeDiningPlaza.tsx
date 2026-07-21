"use client";

import Link from "next/link";
import type { MeshiGroup } from "@/lib/types";
import { useLocale } from "@/lib/i18n";
import styles from "./HomeDiningPlaza.module.css";

interface HomeDiningPlazaProps {
  groups: MeshiGroup[];
  userName?: string | null;
}

const GROUP_POSITIONS = [styles.groupLeft, styles.groupRight, styles.groupBottom];
const OBJECT_VARIANTS = [styles.teaPicnic, styles.blanketPicnic, styles.benchPicnic];

function formatDate(date: Date | null | undefined, locale: string) {
  if (!date) return locale === "en" ? "DATE TBD" : "日程未定";
  if (locale === "en") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function respondedCount(group: MeshiGroup) {
  return group.members.filter((member) => member.hasSurvey).length;
}

function PicnicObject({
  group,
  variant,
  create = false,
}: {
  group?: MeshiGroup;
  variant: number;
  create?: boolean;
}) {
  const members = group?.members.slice(0, 4) ?? [];
  const decided = Boolean(group?.decidedRestaurant);

  return (
    <span
      className={`${styles.picnicObject} ${OBJECT_VARIANTS[variant]} ${
        create ? styles.createObject : ""
      }`}
      aria-hidden="true"
    >
      <span className={styles.objectShadow} />

      {variant === 0 && (
        <>
          <span className={styles.roundTableLeg} />
          <span className={styles.roundTableTop}>
            <span className={styles.teaPot} />
            <span className={styles.teaCup} />
            <span className={styles.vase}>
              <span className={styles.vaseFlowerOne} />
              <span className={styles.vaseFlowerTwo} />
              <span className={styles.vaseFlowerThree} />
            </span>
          </span>
        </>
      )}

      {variant === 1 && (
        <>
          <span className={styles.blanket} />
          <span className={styles.basket}>
            <span className={styles.basketHandle} />
            <span className={styles.basketRibbon} />
          </span>
          <span className={styles.picnicBook} />
          <span className={styles.picnicDrink} />
        </>
      )}

      {variant === 2 && (
        <>
          <span className={styles.benchBack}>
            <span />
            <span />
            <span />
          </span>
          <span className={styles.benchSeat} />
          <span className={styles.benchLegLeft} />
          <span className={styles.benchLegRight} />
          <span className={styles.benchCup} />
          <span className={styles.benchBook} />
        </>
      )}

      {members.map((member, index) => (
        <span
          key={member.id}
          className={`${styles.friend} ${styles[`friend${index}`]}`}
        >
          {member.displayName.charAt(0)}
        </span>
      ))}

      {create && <span className={styles.addMarker}>+</span>}

      {decided && (
        <span className={styles.ticket}>
          <span>M</span>
        </span>
      )}
    </span>
  );
}

export function HomeDiningPlaza({ groups, userName }: HomeDiningPlazaProps) {
  const { t, locale } = useLocale();
  const visibleGroups = groups.slice(0, 3);
  const initial = userName?.trim().charAt(0) || "M";

  return (
    <section className={styles.plaza} aria-label={t("home.defaultHeroTitle")}>
      <div className={styles.scene}>
        {visibleGroups.map((group, index) => {
          const answered = respondedCount(group);
          const total = group.members.length;
          const decided = Boolean(group.decidedRestaurant);
          const place = group.resolvedAreas[0];
          const meta = [
            formatDate(group.scheduledAt, locale),
            place,
            `${answered}/${total}`,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <Link
              key={group.id}
              href={`/groups/${group.id}/results`}
              className={`${styles.picnicLink} ${GROUP_POSITIONS[index]}`}
              aria-label={`${group.name}。${meta}${
                decided ? `。${t("groupCard.decided")}、${group.decidedRestaurant}` : ""
              }`}
            >
              <PicnicObject group={group} variant={index} />
              <span className={`${styles.woodLabel} ${styles[`labelTone${index}`]}`}>
                <b>{group.name}</b>
                <small>{decided ? group.decidedRestaurant : meta}</small>
              </span>
            </Link>
          );
        })}

        <Link
          href="/groups/create"
          className={`${styles.picnicLink} ${styles.createSpot}`}
          aria-label={`${t("home.planTitle")}。${t("home.planDesc")}`}
        >
          <PicnicObject variant={1} create />
          <span className={`${styles.woodLabel} ${styles.labelTone1}`}>
            <b>{t("home.planTitle")}</b>
            <small>{t("home.planDesc")}</small>
          </span>
        </Link>

        <div className={styles.player} aria-hidden="true">
          <span className={styles.playerShadow} />
          <span className={styles.playerHair} />
          <span className={styles.playerHead}>{initial}</span>
          <span className={styles.playerBody} />
          <span className={`${styles.playerFoot} ${styles.playerFootLeft}`} />
          <span className={`${styles.playerFoot} ${styles.playerFootRight}`} />
        </div>
      </div>

      <Link
        href="/instant"
        className={styles.instantButton}
        aria-label={`${t("home.instantTitle")}。${t("home.instantDesc")}`}
      >
        <span className={styles.buttonRays} aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span>{t("home.instantTitle")}</span>
        <span className={styles.buttonFlower} aria-hidden="true" />
      </Link>
    </section>
  );
}
