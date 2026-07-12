"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MeshiGroup } from "@/lib/types";
import { useLocale } from "@/lib/i18n";
import { Chip, TicketStub, type ChipVariant } from "@/components/v2";
import { MemberAvatarStack, MemberAvatar } from "./MemberAvatar";

interface GroupCardProps {
  group: MeshiGroup;
  isHidden?: boolean;
  onToggleHide?: () => void;
  onRestore?: () => void;
  onSwipeArchive?: () => void;
  onSwipeDelete?: () => void;
}

const SWIPE_THRESHOLD = 92;
const SWIPE_MAX = 118;

// 一覧APIは survey_responses 本体を返さない (回答内容は本人とサービスのみ) ため、
// 回答数はメンバーの has_survey フラグから数える
function countResponded(group: MeshiGroup): number {
  return group.members.filter((member) => member.hasSurvey).length;
}

// ステータスごとの配色 (カード左のアクセントバーで一目で分かるように)
//   決定済み        → Sage (緑)
//   全員回答済み    → Primary Orange (次のアクションが幹事にある)
//   回答集め中      → Honey (黄)
//   未回答          → ニュートラル
function getStatusBadge(group: MeshiGroup, t: (key: string) => string) {
  if (group.decidedRestaurant) {
    return {
      label: t("groupCard.decided"),
      variant: "sage" as ChipVariant,
    };
  }
  const totalCount = group.members.length;
  const respondedCount = countResponded(group);
  if (respondedCount === totalCount) {
    return {
      label: t("groupCard.allResponded"),
      variant: "selected" as ChipVariant,
    };
  }
  if (respondedCount > 0) {
    return {
      label: t("groupCard.waitingResponses"),
      variant: "honey" as ChipVariant,
    };
  }
  return {
    label: t("groupCard.noResponses"),
    variant: "default" as ChipVariant,
  };
}

function formatTicketDate(date: Date | null | undefined, locale: string) {
  if (!date) return locale === "en" ? "TBD" : "未定";
  if (locale === "en") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function GroupCard({ group, onRestore, onSwipeArchive, onSwipeDelete }: GroupCardProps) {
  const router = useRouter();
  const { t, locale } = useLocale();
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [dragX, setDragX] = useState(0);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    currentX: number;
    dragging: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const respondedCount = countResponded(group);
  const totalCount = group.members.length;
  const memberNames = group.members.map((m) => m.displayName);
  const status = getStatusBadge(group, t);
  const canSwipe = Boolean(onSwipeArchive || onSwipeDelete);
  const clampedDragX = Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, dragX));
  const ticketDate = formatTicketDate(group.scheduledAt, locale);

  function commitSwipe(finalX: number) {
    if (finalX > SWIPE_THRESHOLD && onSwipeDelete) {
      suppressClickRef.current = true;
      onSwipeDelete();
    } else if (finalX < -SWIPE_THRESHOLD && onSwipeArchive) {
      suppressClickRef.current = true;
      onSwipeArchive();
    }
    setDragX(0);
  }

  return (
    <>
      <div className="group-ticket-shell">
        {canSwipe && (
          <>
            <div
              className="group-ticket-action group-ticket-action-delete"
              style={{ opacity: clampedDragX > 0 ? 1 : 0 }}
            >
              {t("groupCard.swipeDelete")}
            </div>
            <div
              className="group-ticket-action group-ticket-action-archive"
              style={{ opacity: clampedDragX < 0 ? 1 : 0 }}
            >
              {t("groupCard.swipeArchive")}
            </div>
          </>
        )}
        <div
          className="v2-scope"
          onClick={() => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false;
              return;
            }
            router.push(`/groups/${group.id}/results`);
          }}
          onPointerDown={(event) => {
            if (!canSwipe || event.button !== 0) return;
            dragRef.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              currentX: 0,
              dragging: false,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            const dx = event.clientX - drag.startX;
            const dy = event.clientY - drag.startY;
            if (!drag.dragging && Math.abs(dx) < 8) return;
            if (!drag.dragging && Math.abs(dy) > Math.abs(dx)) return;
            drag.dragging = true;
            drag.currentX = Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, dx));
            suppressClickRef.current = true;
            event.preventDefault();
            setDragX(drag.currentX);
          }}
          onPointerUp={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            dragRef.current = null;
            commitSwipe(drag.currentX);
          }}
          onPointerCancel={() => {
            dragRef.current = null;
            setDragX(0);
          }}
          style={{
            cursor: "pointer",
            touchAction: canSwipe ? "pan-y" : "auto",
            transform: `translateX(${clampedDragX}px)`,
            transition: "transform 0.18s ease",
            boxShadow:
              Math.abs(clampedDragX) > 12
                ? "0 10px 24px rgba(74,53,42,0.12)"
                : undefined,
          }}
        >
          <TicketStub
            heading={group.name}
            subtitle={t("groupCard.memberCount", { count: totalCount })}
            stamp={group.decidedRestaurant ? `${t("groupCard.decidedHere")} ${group.decidedRestaurant}` : status.label}
            items={[
              { label: "ADMIT", value: `${respondedCount}/${totalCount}` },
              { label: "DATE", value: ticketDate },
              { label: "PLACE", value: group.resolvedAreas[0] ?? (locale === "en" ? "TBD" : "未定") },
            ]}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "10px 4px 0",
            }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setShowMembersModal(true); }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: 7,
                minWidth: 0,
              }}
            >
              <MemberAvatarStack members={memberNames} size={26} />
              <span style={{ fontSize: 12, color: "var(--v2-muted)", fontWeight: 700 }}>
                {t("groupCard.memberCount", { count: totalCount })}
              </span>
            </button>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Chip variant={status.variant} label={status.label} />
              {group.resolvedAreas.slice(0, 1).map((area) => (
                <Chip key={area} label={area} />
              ))}
              {onRestore && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRestore(); }}
                  className="v2-chip"
                  style={{ cursor: "pointer" }}
                >
                  <span className="v2-chip__label">{t("groupCard.restore")}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Members modal */}
      {showMembersModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
            onClick={() => setShowMembersModal(false)}
          />
          <div
            className="v2-scope"
            style={{
              position: "relative",
              backgroundColor: "var(--v2-canvas)",
              borderRadius: "24px 24px 0 0",
              padding: "20px 20px 40px",
              maxHeight: "70dvh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div style={{ width: 40, height: 4, backgroundColor: "var(--v2-border)", borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--v2-ink)", marginBottom: 16 }}>
              {t("groupCard.membersOf", { name: group.name })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {group.members.map((member) => {
                const hasResponded = member.hasSurvey;
                return (
                  <div
                    key={member.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <MemberAvatar name={member.displayName} size={40} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--v2-ink)" }}>
                        {member.displayName}
                        {member.role === "owner" && (
                          <span style={{ fontSize: 11, color: "var(--v2-accent)", marginLeft: 6, fontWeight: 500 }}>
                            {t("groupCard.organizer")}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "3px 10px",
                        borderRadius: 20,
                        backgroundColor: hasResponded ? "var(--v2-tint-sage)" : "var(--v2-surface)",
                        color: hasResponded ? "var(--v2-tint-sage-text)" : "var(--v2-muted)",
                      }}
                    >
                      {hasResponded ? t("groupCard.answered") : t("groupCard.notAnswered")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
