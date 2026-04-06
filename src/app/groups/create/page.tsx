"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import { nanoid } from "@/lib/utils/nanoid";
import type { SessionAtmosphere, SessionFocus } from "@/lib/types";

type Step = "name" | "members" | "details" | "complete";

type Connection = {
  id: string;
  displayName: string;
  mutualGroups: number;
};

type PendingMember = {
  id: string;
  displayName: string;
  profileId: string | null;
};

const SESSION_ATMOSPHERES: { id: SessionAtmosphere; label: string }[] = [
  { id: "casual", label: "カジュアル" },
  { id: "polished", label: "きれいめ" },
  { id: "lively", label: "にぎやか" },
  { id: "calm", label: "落ち着きたい" },
];

const SESSION_FOCUSES: { id: SessionFocus; label: string }[] = [
  { id: "balanced", label: "バランス重視" },
  { id: "food_centered", label: "食事メイン" },
  { id: "drink_centered", label: "飲みメイン" },
];

export default function CreateGroupPage() {
  const router = useRouter();
  const { t } = useLocale();
  const { user, userId } = useUser();
  const [step, setStep] = useState<Step>("name");
  const [groupName, setGroupName] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState<PendingMember[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [groupSizeInput, setGroupSizeInput] = useState("");
  const [sessionAtmosphere, setSessionAtmosphere] =
    useState<SessionAtmosphere>("casual");
  const [sessionFocus, setSessionFocus] =
    useState<SessionFocus>("balanced");
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const resolvedGroupSize =
    Number(groupSizeInput) > 0 ? Number(groupSizeInput) : members.length + 1;

  useEffect(() => {
    if (!userId) {
      return;
    }

    async function fetchConnections() {
      const supabase = createClient();
      const { data: myMemberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("profile_id", userId);

      if (!myMemberships || myMemberships.length === 0) {
        setConnections([]);
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

      const connectionMap = new Map<
        string,
        { displayName: string; mutualGroups: number }
      >();

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

      setConnections(
        Array.from(connectionMap.entries()).map(([id, connection]) => ({
          id,
          displayName: connection.displayName,
          mutualGroups: connection.mutualGroups,
        }))
      );
    }

    void fetchConnections();
  }, [userId]);

  function addMember(nameOverride?: string, profileId: string | null = null) {
    const name = (nameOverride ?? memberInput).trim();
    const duplicate = members.some(
      (member) =>
        member.displayName === name ||
        (profileId !== null && member.profileId === profileId)
    );

    if (!name || duplicate) {
      return;
    }

    setMembers((current) => [
      ...current,
      {
        id: profileId ?? `${name}-${current.length}`,
        displayName: name,
        profileId,
      },
    ]);
    setMemberInput("");
  }

  async function handleCreateGroup() {
    if (!userId) {
      return;
    }

    setStep("complete");

    try {
      const supabase = createClient();
      const inviteCode = nanoid(8);

      const { data: group, error: groupError } = await supabase
        .from("groups")
        .insert({
          name: groupName,
          invite_code: inviteCode,
          created_by: userId,
          scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          group_size: resolvedGroupSize,
          session_atmosphere: sessionAtmosphere,
          session_focus: sessionFocus,
        })
        .select("id")
        .single();

      if (groupError || !group) {
        console.error("Group creation failed:", groupError);
        setStep("details");
        return;
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
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
          onClick={() => setShowExitConfirm(false)}
        />
        <div
          style={{
            position: "relative",
            backgroundColor: "var(--bg)",
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
              marginBottom: 28,
            }}
          />

          <button
            className="btn-primary"
            onClick={() => setStep("members")}
            disabled={!groupName.trim()}
          >
            次へ
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

          {connections.length > 0 && (
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
                繋がりから追加
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {connections.map((connection) => {
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
                          : addMember(connection.displayName, connection.id)
                      }
                      className={`chip ${selected ? "chip-selected" : ""}`}
                      style={{ fontSize: 13 }}
                    >
                      {connection.displayName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {members.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {members.map((member) => (
                <div
                  key={member.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: "rgba(204,119,85,0.1)",
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

          <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            <input
              value={memberInput}
              onChange={(event) => setMemberInput(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && addMember()}
              placeholder="名前を入力"
              style={{
                flex: 1,
                padding: "14px 16px",
                borderRadius: 14,
                border: "1.5px solid var(--border)",
                fontSize: 16,
                color: "var(--text-primary)",
                backgroundColor: "var(--surface)",
                outline: "none",
              }}
            />
            <button
              onClick={() => addMember()}
              disabled={!memberInput.trim()}
              style={{
                padding: "0 20px",
                borderRadius: 14,
                backgroundColor: "var(--primary)",
                color: "white",
                fontWeight: 600,
                fontSize: 15,
                border: "none",
                cursor: "pointer",
                flexShrink: 0,
                opacity: !memberInput.trim() ? 0.4 : 1,
              }}
            >
              追加
            </button>
          </div>

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
            セッション条件を決める
          </div>
          <div
            style={{
              fontSize: 15,
              color: "var(--text-secondary)",
              marginBottom: 24,
            }}
          >
            ここでは日時と会の雰囲気だけ決めます。細かい希望はこのあと各自が回答します。
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
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: 8,
                }}
              >
                日時
              </div>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1.5px solid var(--border)",
                  fontSize: 15,
                  color: "var(--text-primary)",
                  backgroundColor: "var(--bg)",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: 8,
                }}
              >
                想定人数
              </div>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={groupSizeInput}
                onChange={(event) => setGroupSizeInput(event.target.value)}
                placeholder={`${members.length + 1}`}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1.5px solid var(--border)",
                  fontSize: 15,
                  color: "var(--text-primary)",
                  backgroundColor: "var(--bg)",
                  outline: "none",
                }}
              />
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-tertiary)",
                  marginTop: 6,
                }}
              >
                未入力ならいま追加した人数ベースで {members.length + 1} 人として扱います
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: 8,
                }}
              >
                雰囲気
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SESSION_ATMOSPHERES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSessionAtmosphere(option.id)}
                    className={`chip ${sessionAtmosphere === option.id ? "chip-selected" : ""}`}
                    style={{ fontSize: 13 }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: 8,
                }}
              >
                会の重心
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SESSION_FOCUSES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSessionFocus(option.id)}
                    className={`chip ${sessionFocus === option.id ? "chip-selected" : ""}`}
                    style={{ fontSize: 13 }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button className="btn-primary" onClick={handleCreateGroup}>
            グループを作成する
          </button>
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
    <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh", position: "relative" }}>
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
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          ✕
        </button>
      )}
      {children}
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
          color: "var(--primary)",
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
