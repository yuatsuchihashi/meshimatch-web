"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import { nanoid } from "@/lib/utils/nanoid";
import { track, AnalyticsEvent } from "@/lib/analytics";
import { hasParticipated } from "@/lib/anon-id";
import type { SessionFocus } from "@/lib/types";
import { VerificationBadge } from "@/components/profile/VerificationBadge";
import { getVerifiedProfileIds, type VerificationClient } from "@/lib/verification";

type Step = "name" | "members" | "details" | "complete";

type DateChoice = number | "undecided"; // 今日からのオフセット日数 (0=今日)
type TimeChoice = "lunch" | "dinner";

type Connection = {
  id: string;
  displayName: string;
  mutualGroups: number;
  verified?: boolean;
};

type PendingMember = {
  id: string;
  displayName: string;
  profileId: string | null;
};

// 選ばれた日にちチップから実際の Date（0時基準）を返す。未定なら null。
function resolveChosenDate(choice: DateChoice): Date | null {
  if (choice === "undecided") {
    return null;
  }
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + choice);
  return base;
}

// 日にち + 時間帯を合成した ISO 文字列。未定なら null。
function resolveScheduledAt(
  dateChoice: DateChoice,
  timeChoice: TimeChoice
): string | null {
  const date = resolveChosenDate(dateChoice);
  if (!date) {
    return null;
  }
  date.setHours(timeChoice === "lunch" ? 12 : 19, 0, 0, 0);
  return date.toISOString();
}

function dateOffsetFromToday(date: Date): number {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - base.getTime()) / 86_400_000);
}

function formatDateChoice(choice: DateChoice): string {
  const date = resolveChosenDate(choice);
  if (!date) return "未定";
  const dayLabel = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${date.getMonth() + 1}/${date.getDate()}(${dayLabel})`;
}

export default function CreateGroupPage() {
  const router = useRouter();
  const { t } = useLocale();
  const { user, userId } = useUser();
  const [step, setStep] = useState<Step>("name");
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<PendingMember[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionQuery, setConnectionQuery] = useState("");
  const [dateChoice, setDateChoice] = useState<DateChoice>("undecided");
  const [timeChoice, setTimeChoice] = useState<TimeChoice>("dinner");
  const [sessionFocus, setSessionFocus] =
    useState<SessionFocus>("balanced");
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    if (!userId) {
      return;
    }

    async function fetchConnections() {
      const supabase = createClient();
      const connectionMap = new Map<
        string,
        { displayName: string; mutualGroups: number }
      >();

      const { data: follows } = await supabase
        .from("follows")
        .select("following_id, following:profiles!follows_following_id_fkey (display_name)")
        .eq("follower_id", userId);

      if (follows) {
        for (const follow of follows as {
          following_id: string;
          following?: { display_name?: string | null } | null;
        }[]) {
          const profileId = follow.following_id;
          if (!profileId) continue;
          connectionMap.set(profileId, {
            displayName: follow.following?.display_name ?? "ユーザー",
            mutualGroups: 0,
          });
        }
      }

      const { data: myMemberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("profile_id", userId);

      if (!myMemberships || myMemberships.length === 0) {
        const verifiedIds = await getVerifiedProfileIds(
          supabase as unknown as VerificationClient,
          Array.from(connectionMap.keys())
        );
        setConnections(
          Array.from(connectionMap.entries()).map(([id, connection]) => ({
            id,
            displayName: connection.displayName,
            mutualGroups: connection.mutualGroups,
            verified: verifiedIds.has(id),
          }))
        );
        return;
      }

      const groupIds = myMemberships.map((membership) => membership.group_id);
      const { data: allMembers } = await supabase
        .from("group_members")
        .select("profile_id, display_name, group_id")
        .in("group_id", groupIds)
        .not("profile_id", "is", null)
        .neq("profile_id", userId);

      if (!allMembers) {
        setConnections([]);
        return;
      }

      for (const member of allMembers) {
        const profileId = member.profile_id;
        if (!profileId) {
          continue;
        }

        const existing = connectionMap.get(profileId);
        if (existing) {
          existing.mutualGroups += 1;
        } else {
          connectionMap.set(profileId, {
            displayName: member.display_name,
            mutualGroups: 1,
          });
        }
      }

      const verifiedIds = await getVerifiedProfileIds(
        supabase as unknown as VerificationClient,
        Array.from(connectionMap.keys())
      );
      setConnections(
        Array.from(connectionMap.entries()).map(([id, connection]) => ({
          id,
          displayName: connection.displayName,
          mutualGroups: connection.mutualGroups,
          verified: verifiedIds.has(id),
        }))
      );
    }

    void fetchConnections();
  }, [userId]);

  const filteredConnections = connections.filter((connection) =>
    connection.displayName.toLowerCase().includes(connectionQuery.trim().toLowerCase())
  );

  function addConnectionMember(nameOverride: string, profileId: string) {
    const name = nameOverride.trim();
    const duplicate = members.some(
      (member) =>
        member.displayName === name ||
        member.profileId === profileId
    );

    if (!name || duplicate) {
      return;
    }

    setMembers((current) => [
      ...current,
      {
        id: profileId,
        displayName: name,
        profileId,
      },
    ]);
  }

  async function handleCreateGroup() {
    if (!userId) {
      return;
    }

    setStep("complete");

    try {
      const supabase = createClient();
      const inviteCode = nanoid(8);

      const scheduledAt = resolveScheduledAt(dateChoice, timeChoice);

      // 名前は任意。空なら日付ベース or デフォルト名を自動生成する。
      let resolvedName = groupName.trim();
      if (!resolvedName) {
        const chosenDate = resolveChosenDate(dateChoice);
        resolvedName = chosenDate
          ? t("createGroup.autoNameWithDate", {
              month: chosenDate.getMonth() + 1,
              day: chosenDate.getDate(),
            })
          : t("createGroup.autoNameDefault");
      }

      const { data: group, error: groupError } = await supabase
        .from("groups")
        .insert({
          name: resolvedName,
          invite_code: inviteCode,
          created_by: userId,
          scheduled_at: scheduledAt,
          group_size: null,
          session_atmosphere: null,
          session_focus: sessionFocus,
        })
        .select("id")
        .single();

      if (groupError || !group) {
        console.error("Group creation failed:", groupError);
        setStep("details");
        return;
      }

      // session_created + 参加者→幹事の転化計測（要件セクション6/7）
      track(AnalyticsEvent.SESSION_CREATED, { groupId: group.id, memberCount: members.length });
      if (hasParticipated()) {
        track(AnalyticsEvent.PARTICIPANT_CONVERTED, { groupId: group.id });
      }

      await supabase.from("group_members").insert({
        group_id: group.id,
        profile_id: userId,
        display_name: user?.displayName ?? "ホスト",
        role: "owner",
      });

      const guestMembers = members.filter((member) => member.profileId === null);
      if (guestMembers.length > 0) {
        await supabase.from("group_members").insert(
          guestMembers.map((member) => ({
            group_id: group.id,
            profile_id: null,
            display_name: member.displayName,
            role: "member" as const,
          }))
        );
      }

      const inviteeIds = members
        .map((member) => member.profileId)
        .filter((profileId): profileId is string => typeof profileId === "string");

      if (inviteeIds.length > 0) {
        await supabase.from("invitations").insert(
          inviteeIds.map((inviteeId) => ({
            group_id: group.id,
            inviter_id: userId,
            invitee_id: inviteeId,
            status: "pending" as const,
          }))
        );
      }

      window.setTimeout(() => {
        router.push(`/groups/${group.id}/survey`);
      }, 1400);
    } catch (error) {
      console.error("Error creating group:", error);
      setStep("details");
    }
  }

  if (showExitConfirm) {
    return (
      <div
        className="v2-scope service-canvas"
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
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(34,27,22,0.36)",
          }}
          onClick={() => setShowExitConfirm(false)}
        />
        <div
          style={{
            position: "relative",
            backgroundColor: "var(--v2-canvas)",
            borderRadius: "24px 24px 0 0",
            padding: "20px 20px 48px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <div
              style={{
                width: 40,
                height: 4,
                backgroundColor: "var(--border)",
                borderRadius: 2,
              }}
            />
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: "var(--text-primary)",
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            {t("createGroup.exitTitle")}
          </div>
          <div
            style={{
              fontSize: 14,
              color: "var(--text-secondary)",
              textAlign: "center",
              marginBottom: 28,
            }}
          >
            {t("createGroup.exitDesc")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={() => router.push("/home")}
              style={{
                width: "100%",
                padding: "15px",
                borderRadius: 14,
                backgroundColor: "#E05252",
                color: "white",
                fontSize: 16,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
              }}
            >
              {t("createGroup.exitConfirm")}
            </button>
            <button
              className="btn-secondary"
              onClick={() => setShowExitConfirm(false)}
            >
              {t("createGroup.continue")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "name") {
    return (
      <PageShell onExit={() => setShowExitConfirm(true)} showExit>
        <BackButton onClick={() => router.push("/home")} label={t("common.back")} />
        <div style={{ padding: "16px 20px 40px" }}>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "var(--text-primary)",
              marginBottom: 6,
            }}
          >
            グループ名を決める
          </div>
          <div
            style={{
              fontSize: 15,
              color: "var(--text-secondary)",
              marginBottom: 32,
            }}
          >
            まずは会の名前だけ決めれば大丈夫です
          </div>

          <label
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-secondary)",
              display: "block",
              marginBottom: 8,
            }}
          >
            グループ名
          </label>
          <input
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="例: 金曜ごはん"
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 14,
              border: "1.5px solid var(--border)",
              fontSize: 16,
              color: "var(--text-primary)",
              backgroundColor: "var(--surface)",
              outline: "none",
              marginBottom: 8,
            }}
          />
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 28 }}>
            {t("createGroup.nameSkipHint")}
          </div>

          <button
            className="btn-primary"
            onClick={() => setStep("members")}
          >
            {groupName.trim() ? t("common.next") : t("createGroup.skipName")}
          </button>
        </div>
      </PageShell>
    );
  }

  if (step === "members") {
    return (
      <PageShell onExit={() => setShowExitConfirm(true)} showExit>
        <BackButton onClick={() => setStep("name")} label={t("common.back")} />
        <div style={{ padding: "16px 20px 40px" }}>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "var(--text-primary)",
              marginBottom: 6,
            }}
          >
            誰と行くかを追加する
          </div>
          <div
            style={{
              fontSize: 15,
              color: "var(--text-secondary)",
              marginBottom: 24,
            }}
          >
            繋がりのある人はここで追加して、ゲストは作成後の招待リンクで呼べます
          </div>

          <div
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: 16,
              padding: 16,
              border: "1px solid var(--border-light)",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 10,
              }}
            >
              繋がりから検索
            </div>
            <input
              value={connectionQuery}
              onChange={(event) => setConnectionQuery(event.target.value)}
              placeholder="名前で検索"
              style={{
                width: "100%",
                padding: "13px 14px",
                borderRadius: 12,
                border: "1.5px solid var(--border)",
                fontSize: 15,
                color: "var(--text-primary)",
                backgroundColor: "var(--bg)",
                outline: "none",
                marginBottom: 12,
              }}
            />

            {connections.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
                まだ繋がりがありません。QRで追加した人や、過去に同じグループに入った人がここに出ます。
              </div>
            ) : filteredConnections.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                該当する繋がりが見つかりません
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
                {filteredConnections.map((connection) => {
                  const selected = members.some(
                    (member) => member.profileId === connection.id
                  );
                  return (
                    <button
                      key={connection.id}
                      type="button"
                      onClick={() =>
                        selected
                          ? setMembers((current) =>
                              current.filter((member) => member.profileId !== connection.id)
                            )
                          : addConnectionMember(connection.displayName, connection.id)
                      }
                      style={{
                        width: "100%",
                        minHeight: 54,
                        borderRadius: 14,
                        border: selected ? "2px solid var(--primary)" : "1px solid var(--border-light)",
                        backgroundColor: selected ? "rgba(240,90,40,0.1)" : "var(--surface)",
                        color: selected ? "var(--primary)" : "var(--text-primary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "10px 12px",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 15, fontWeight: 800 }}>
                          {connection.displayName}
                          {connection.verified && (
                            <VerificationBadge title={t("official.badgeTitle")} compact />
                          )}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                          {connection.mutualGroups > 0
                            ? `共通グループ ${connection.mutualGroups}件`
                            : "QRで追加済み"}
                        </span>
                      </span>
                      <span
                        style={{
                          flexShrink: 0,
                          minWidth: 54,
                          textAlign: "center",
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        {selected ? "選択中" : "追加"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {members.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {members.map((member) => (
                <div
                  key={member.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: "rgba(240,90,40,0.1)",
                    border: "1px solid var(--primary)",
                    borderRadius: 20,
                    padding: "6px 12px",
                    fontSize: 14,
                    color: "var(--primary)",
                    fontWeight: 600,
                  }}
                >
                  {member.displayName}
                  <button
                    onClick={() =>
                      setMembers((current) =>
                        current.filter((item) => item.id !== member.id)
                      )
                    }
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--primary)",
                      padding: 0,
                      fontSize: 16,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: 14,
              padding: 16,
              border: "1px solid var(--border-light)",
              marginBottom: 28,
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 8,
              }}
            >
              ゲスト参加もOK
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              グループ作成後の待機室で招待リンクをコピーできます。アカウントがない人はそのリンクから回答します。
            </div>
          </div>

          <button className="btn-primary" onClick={() => setStep("details")}>
            次へ
          </button>
        </div>
      </PageShell>
    );
  }

  if (step === "details") {
    return (
      <PageShell onExit={() => setShowExitConfirm(true)} showExit>
        <BackButton onClick={() => setStep("members")} label={t("common.back")} />
        <div style={{ padding: "16px 20px 40px" }}>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "var(--text-primary)",
              marginBottom: 6,
            }}
          >
            {t("createGroup.detailsTitle")}
          </div>
          <div
            style={{
              fontSize: 15,
              color: "var(--text-secondary)",
              marginBottom: 24,
            }}
          >
            {t("createGroup.detailsDesc")}
          </div>

          <div
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: 16,
              padding: 16,
              border: "1px solid var(--border-light)",
              marginBottom: 24,
            }}
          >
            <div style={{ marginBottom: dateChoice === "undecided" ? 0 : 18 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: 8,
                }}
              >
                {t("createGroup.dateLabel")}
              </div>
              {/* 日めくりカレンダー風の横スクロールストリップ */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  overflowX: "auto",
                  margin: "0 -16px",
                  padding: "2px 16px 6px",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                <button
                  type="button"
                  onClick={() => setDateChoice("undecided")}
                  style={{
                    flex: "0 0 64px",
                    height: 76,
                    borderRadius: 14,
                    border: dateChoice === "undecided" ? "2px solid var(--primary)" : "1.5px dashed var(--border-strong)",
                    backgroundColor: dateChoice === "undecided" ? "rgba(240,90,40,0.1)" : "var(--surface)",
                    color: dateChoice === "undecided" ? "var(--primary)" : "var(--text-tertiary)",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {t("createGroup.dateUndecided")}
                </button>
                {Array.from({ length: 14 }, (_, offset) => {
                  const date = new Date();
                  date.setDate(date.getDate() + offset);
                  const day = date.getDay();
                  const dayLabel = ["日", "月", "火", "水", "木", "金", "土"][day];
                  const tag = offset === 0 ? t("createGroup.dateToday") : offset === 1 ? t("createGroup.dateTomorrow") : dayLabel;
                  const selected = dateChoice === offset;
                  const weekend = day === 0 || day === 6;
                  return (
                    <button
                      key={offset}
                      type="button"
                      onClick={() => setDateChoice(offset)}
                      style={{
                        flex: "0 0 64px",
                        height: 76,
                        borderRadius: 14,
                        border: selected ? "2px solid var(--primary)" : "1.5px solid var(--border)",
                        backgroundColor: selected ? "var(--primary)" : "var(--surface)",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 2,
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: selected ? "rgba(255,255,255,0.85)" : weekend ? "var(--danger)" : "var(--text-tertiary)" }}>
                        {tag}
                      </span>
                      <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: selected ? "white" : "var(--text-primary)" }}>
                        {date.getDate()}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setCalendarOpen(true)}
                  style={{
                    flex: "0 0 118px",
                    height: 76,
                    borderRadius: 14,
                    border:
                      typeof dateChoice === "number" && dateChoice > 13
                        ? "2px solid var(--primary)"
                        : "1.5px solid var(--border)",
                    backgroundColor:
                      typeof dateChoice === "number" && dateChoice > 13
                        ? "rgba(240,90,40,0.1)"
                        : "var(--surface)",
                    color:
                      typeof dateChoice === "number" && dateChoice > 13
                        ? "var(--primary)"
                        : "var(--text-primary)",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                  }}
                >
                  <span>{t("createGroup.openCalendar")}</span>
                  {typeof dateChoice === "number" && dateChoice > 13 && (
                    <span style={{ fontSize: 15 }}>{formatDateChoice(dateChoice)}</span>
                  )}
                </button>
              </div>
            </div>

            {dateChoice !== "undecided" && (
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: 8,
                  }}
                >
                  {t("createGroup.timeLabel")}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  {(
                    [
                      { id: "lunch", label: t("createGroup.timeLunch") },
                      { id: "dinner", label: t("createGroup.timeDinner") },
                    ] as { id: TimeChoice; label: string }[]
                  ).map((option) => {
                    const selected = timeChoice === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setTimeChoice(option.id)}
                        style={{
                          flex: 1,
                          height: 64,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          borderRadius: 16,
                          border: selected ? "2px solid var(--primary)" : "1.5px solid var(--border)",
                          backgroundColor: selected ? "rgba(240,90,40,0.1)" : "var(--surface)",
                          color: selected ? "var(--primary)" : "var(--text-secondary)",
                          fontSize: 15,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {option.id === "lunch" ? (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                            <circle cx="12" cy="12" r="4.2" fill={selected ? "currentColor" : "none"} />
                            <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M18 6l-1.4 1.4M7.4 16.6L6 18" />
                          </svg>
                        ) : (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill={selected ? "currentColor" : "none"} />
                          </svg>
                        )}
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 8 }}>
                  {t("createGroup.timeHint")}
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginBottom: 10,
            }}
          >
            {t("createGroup.focusLabel")}
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            {(
              [
                { id: "drink_centered", label: t("createGroup.focusDrink") },
                { id: "food_centered", label: t("createGroup.focusFood") },
              ] as { id: SessionFocus; label: string }[]
            ).map((option) => {
              const selected = sessionFocus === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSessionFocus(option.id)}
                  style={{
                    flex: 1,
                    minHeight: 104,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    borderRadius: 20,
                    border: selected
                      ? "2px solid var(--primary)"
                      : "1.5px solid var(--border)",
                    backgroundColor: selected
                      ? "rgba(240,90,40,0.1)"
                      : "var(--surface)",
                    color: selected ? "var(--primary)" : "var(--text-primary)",
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {option.id === "drink_centered" ? (
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 5h9v14a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 7 19V5Z" />
                      <path d="M16 8h2.2a1.3 1.3 0 0 1 1.3 1.3v4.4a1.3 1.3 0 0 1-1.3 1.3H16" />
                      <path d="M7 5c0-1.1 1-2 2.2-2 .5-.9 1.6-1.4 2.7-1.2.8-.6 2-.6 2.8.1 1 .1 1.8.9 1.8 1.9 0 .4-.1.8-.4 1.2" />
                      <path d="M10 9.5v7M13 9.5v7" />
                    </svg>
                  ) : (
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 11h16a8 8 0 0 1-16 0Z" />
                      <path d="M8.5 15.5c2 1.4 5 1.4 7 0" />
                      <path d="M14.5 3.5 8 10M18 5l-5.5 5" />
                    </svg>
                  )}
                  {option.label}
                </button>
              );
            })}
          </div>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <button
              type="button"
              onClick={() => setSessionFocus("balanced")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                color:
                  sessionFocus === "balanced"
                    ? "var(--primary)"
                    : "var(--text-tertiary)",
                textDecoration: "underline",
                padding: 8,
              }}
            >
              {t("createGroup.focusBalanced")}
            </button>
          </div>

          <button className="btn-primary" onClick={handleCreateGroup}>
            グループを作成する
          </button>

          {calendarOpen && (
            <CalendarSheet
              dateChoice={dateChoice}
              timeChoice={timeChoice}
              t={t}
              onDateChange={setDateChoice}
              onTimeChange={setTimeChoice}
              onClose={() => setCalendarOpen(false)}
            />
          )}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "80dvh",
          padding: 40,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            backgroundColor: "rgba(74,138,90,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
          className="animate-bounce-in"
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--secondary)"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: "var(--text-primary)",
            marginBottom: 8,
          }}
        >
          グループを作成しました
        </div>
        <div style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          続けて、あなた自身の希望を回答します。
        </div>
        <div
          style={{
            marginTop: 24,
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--text-tertiary)",
            fontSize: 14,
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              border: "2px solid var(--border)",
              borderTopColor: "var(--text-tertiary)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          アンケートへ移動しています
        </div>
      </div>
    </PageShell>
  );
}

function PageShell({
  children,
  showExit = false,
  onExit,
}: {
  children: React.ReactNode;
  showExit?: boolean;
  onExit?: () => void;
}) {
  return (
    <div className="v2-scope service-canvas" style={{ backgroundColor: "var(--v2-canvas)", minHeight: "100dvh", position: "relative" }}>
      {showExit && onExit && (
        <button
          onClick={onExit}
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 50,
            width: 36,
            height: 36,
            borderRadius: "50%",
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--text-secondary)",
            fontSize: 18,
            boxShadow: "var(--v2-shadow)",
          }}
        >
          ✕
        </button>
      )}
      {children}
    </div>
  );
}

function CalendarSheet({
  dateChoice,
  timeChoice,
  t,
  onDateChange,
  onTimeChange,
  onClose,
}: {
  dateChoice: DateChoice;
  timeChoice: TimeChoice;
  t: (key: string) => string;
  onDateChange: (choice: DateChoice) => void;
  onTimeChange: (choice: TimeChoice) => void;
  onClose: () => void;
}) {
  const selectedDate = resolveChosenDate(dateChoice);
  const [visible, setVisible] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => {
    const seed = selectedDate ?? new Date();
    return new Date(seed.getFullYear(), seed.getMonth(), 1);
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  function close() {
    setVisible(false);
    window.setTimeout(onClose, 220);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const monthEnd = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
  const leadingBlanks = monthStart.getDay();
  const days = Array.from({ length: monthEnd.getDate() }, (_, index) => {
    return new Date(monthCursor.getFullYear(), monthCursor.getMonth(), index + 1);
  });
  const previousMonthDisabled =
    monthCursor.getFullYear() === today.getFullYear() &&
    monthCursor.getMonth() === today.getMonth();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={close}
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(34,27,22,0.36)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.18s ease",
        }}
      />
      <div
        style={{
          position: "relative",
          backgroundColor: "var(--v2-canvas)",
          borderRadius: "24px 24px 0 0",
          padding: "18px 20px 40px",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.24s cubic-bezier(0.34,1.1,0.64,1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div style={{ width: 40, height: 4, backgroundColor: "var(--border)", borderRadius: 2 }} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            disabled={previousMonthDisabled}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface)",
              color: previousMonthDisabled ? "var(--text-tertiary)" : "var(--text-primary)",
              cursor: previousMonthDisabled ? "default" : "pointer",
              fontSize: 18,
            }}
          >
            ‹
          </button>
          <div style={{ fontSize: 18, fontWeight: 850, color: "var(--text-primary)" }}>
            {monthCursor.getFullYear()}年 {monthCursor.getMonth() + 1}月
          </div>
          <button
            type="button"
            onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface)",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontSize: 18,
            }}
          >
            ›
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 6,
            marginBottom: 18,
          }}
        >
          {["日", "月", "火", "水", "木", "金", "土"].map((day) => (
            <div
              key={day}
              style={{
                textAlign: "center",
                fontSize: 12,
                color: "var(--text-tertiary)",
                fontWeight: 700,
                paddingBottom: 2,
              }}
            >
              {day}
            </div>
          ))}
          {Array.from({ length: leadingBlanks }, (_, index) => (
            <div key={`blank-${index}`} />
          ))}
          {days.map((date) => {
            const offset = dateOffsetFromToday(date);
            const disabled = offset < 0;
            const selected = typeof dateChoice === "number" && dateOffsetFromToday(date) === dateChoice;
            const weekend = date.getDay() === 0 || date.getDay() === 6;
            return (
              <button
                key={date.toISOString()}
                type="button"
                disabled={disabled}
                onClick={() => onDateChange(offset)}
                style={{
                  aspectRatio: "1 / 1",
                  borderRadius: 14,
                  border: selected ? "2px solid var(--primary)" : "1px solid var(--border-light)",
                  backgroundColor: selected ? "var(--primary)" : "var(--surface)",
                  color: selected
                    ? "white"
                    : disabled
                      ? "var(--text-tertiary)"
                      : weekend
                        ? "var(--danger)"
                        : "var(--text-primary)",
                  opacity: disabled ? 0.35 : 1,
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: disabled ? "default" : "pointer",
                }}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>
          {t("createGroup.timeLabel")}
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          {([
            { id: "lunch", label: t("createGroup.timeLunch") },
            { id: "dinner", label: t("createGroup.timeDinner") },
          ] as { id: TimeChoice; label: string }[]).map((option) => {
            const selected = timeChoice === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onTimeChange(option.id)}
                style={{
                  flex: 1,
                  minHeight: 52,
                  borderRadius: 14,
                  border: selected ? "2px solid var(--primary)" : "1.5px solid var(--border)",
                  backgroundColor: selected ? "rgba(240,90,40,0.1)" : "var(--surface)",
                  color: selected ? "var(--primary)" : "var(--text-primary)",
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => {
              onDateChange("undecided");
              close();
            }}
            className="btn-secondary"
            style={{ flex: 1 }}
          >
            {t("createGroup.dateUndecided")}
          </button>
          <button
            type="button"
            onClick={close}
            className="btn-primary"
            style={{ flex: 1 }}
          >
            {t("common.done")}
          </button>
        </div>
      </div>
    </div>
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <div style={{ padding: "56px 20px 0" }}>
      <button
        onClick={onClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--v2-ink)",
          fontSize: 16,
          fontWeight: 600,
          padding: 0,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {label}
      </button>
    </div>
  );
}
