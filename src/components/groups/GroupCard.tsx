"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { MeshiGroup } from "@/lib/types";
import { useLocale } from "@/lib/i18n";
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
      color: "var(--success-deep)",
      bg: "rgba(168,198,134,0.16)",
      accent: "var(--success)",
    };
  }
  const totalCount = group.members.length;
  const respondedCount = countResponded(group);
  if (respondedCount === totalCount) {
    return {
      label: t("groupCard.allResponded"),
      color: "var(--primary)",
      bg: "rgba(240,90,40,0.08)",
      accent: "var(--primary)",
    };
  }
  if (respondedCount > 0) {
    return {
      label: t("groupCard.waitingResponses"),
      color: "#A87B1F",
      bg: "rgba(243,201,107,0.22)",
      accent: "var(--warning)",
    };
  }
  return {
    label: t("groupCard.noResponses"),
    color: "var(--text-tertiary)",
    bg: "var(--bg-secondary)",
    accent: "var(--border-strong)",
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
          className="card group-ticket-card"
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
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,250,245,0.94))",
            boxShadow:
              Math.abs(clampedDragX) > 12
                ? "0 10px 24px rgba(74,53,42,0.12)"
                : undefined,
          }}
        >
          <div
            aria-hidden
            className="service-deco"
            style={{
              position: "absolute",
              right: 96,
              top: 46,
              width: 74,
              height: 74,
              backgroundImage: "url('/img/service/08-ticket-stamp-deco.png')",
              backgroundSize: "220px 220px",
              backgroundPosition: "0 0",
              backgroundRepeat: "no-repeat",
              opacity: 0.13,
              transform: "rotate(-10deg)",
            }}
          />
          <div
            aria-hidden
            className="service-deco"
            style={{
              position: "absolute",
              right: 28,
              top: 46,
              width: 42,
              height: 42,
              backgroundImage: "url('/img/service/08-ticket-stamp-deco.png')",
              backgroundSize: "190px 190px",
              backgroundPosition: "-120px -6px",
              backgroundRepeat: "no-repeat",
              opacity: 0.2,
              transform: "rotate(7deg)",
            }}
          />
          <div
            style={{
              minHeight: 38,
              background:
                "linear-gradient(90deg, var(--primary), var(--primary-light))",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 16px",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 800 }}>
              {t("groupCard.ticketLabel")}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.92 }}>
              MeshiMatch
            </span>
          </div>

          <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 96px" }}>
            <Image
              src="/img/service/03-group-progress-avatars.webp"
              alt=""
              width={118}
              height={98}
              className="service-deco"
              style={{
                position: "absolute",
                right: 104,
                bottom: 4,
                width: 82,
                height: "auto",
                opacity: 0.09,
              }}
            />

            <div style={{ padding: "16px 14px 16px 16px", minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 800, letterSpacing: "0.04em", marginBottom: 4 }}>
                NO. {group.inviteCode || group.id.slice(0, 6).toUpperCase()}
              </div>
              <div
                style={{
                  fontSize: 19,
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  lineHeight: 1.25,
                  marginBottom: 10,
                }}
              >
                {group.name}
              </div>

              {group.decidedRestaurant ? (
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success-deep)", marginBottom: 10 }}>
                  {t("groupCard.decidedHere")} {group.decidedRestaurant}
                </div>
              ) : null}

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: status.color,
                    backgroundColor: status.bg,
                    borderRadius: 100,
                    padding: "4px 10px",
                  }}
                >
                  {status.label}
                </span>
                {group.resolvedAreas.slice(0, 2).map((area) => (
                  <span
                    key={area}
                    style={{
                      fontSize: 11,
                      backgroundColor: "var(--bg-secondary)",
                      color: "var(--text-secondary)",
                      borderRadius: 100,
                      padding: "4px 9px",
                      fontWeight: 700,
                    }}
                  >
                    {area}
                  </span>
                ))}
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); setShowMembersModal(true); }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "14px 0 0",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <MemberAvatarStack members={memberNames} size={26} />
                <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 700 }}>
                  {t("groupCard.memberCount", { count: totalCount })}
                </span>
              </button>
            </div>

            <div
              className="group-ticket-stub"
              style={{
                padding: "15px 12px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                textAlign: "center",
                background: "rgba(255,250,245,0.62)",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text-primary)" }}>
                {ticketDate}
              </div>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  border: `2px solid ${status.accent}`,
                  color: status.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 900,
                  backgroundColor: "var(--surface)",
                }}
              >
                {respondedCount}/{totalCount}
              </div>
              <div style={{ fontSize: 10, fontWeight: 900, color: "var(--text-tertiary)", letterSpacing: "0.04em" }}>
                ADMIT
                <br />
                {t("groupCard.memberCount", { count: totalCount })}
              </div>
              {onRestore && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRestore(); }}
                  style={{
                    background: "none",
                    border: "1px solid var(--primary)",
                    borderRadius: 100,
                    cursor: "pointer",
                    color: "var(--primary)",
                    padding: "3px 9px",
                    fontSize: 11,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("groupCard.restore")}
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
            style={{
              position: "relative",
              backgroundColor: "var(--bg)",
              borderRadius: "24px 24px 0 0",
              padding: "20px 20px 40px",
              maxHeight: "70dvh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div style={{ width: 40, height: 4, backgroundColor: "var(--border)", borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
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
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                        {member.displayName}
                        {member.role === "owner" && (
                          <span style={{ fontSize: 11, color: "var(--primary)", marginLeft: 6, fontWeight: 500 }}>
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
                        backgroundColor: hasResponded ? "rgba(168,198,134,0.16)" : "var(--bg-secondary)",
                        color: hasResponded ? "var(--success-deep)" : "var(--text-tertiary)",
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
