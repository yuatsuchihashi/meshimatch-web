"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";

export default function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: inviteCode } = use(params);
  const router = useRouter();
  const { t } = useLocale();
  const [groupName, setGroupName] = useState("グループ");
  const [memberCount, setMemberCount] = useState(0);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchGroup() {
      const supabase = createClient();
      const { data } = await supabase
        .from("groups")
        .select(`
          id, name,
          group_members (id)
        `)
        .eq("invite_code", inviteCode)
        .single();

      if (data) {
        setGroupId(data.id);
        setGroupName(data.name);
        setMemberCount(data.group_members?.length ?? 0);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    }
    fetchGroup();
  }, [inviteCode]);

  if (loading) {
    return (
      <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="animate-spin-slow" style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%" }} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-tertiary)", marginBottom: 12 }}>!</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
          {t("invite.groupNotFound")}
        </div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          {t("invite.invalidLink")}
        </div>
      </div>
    );
  }

  function handleGoToSurvey() {
    router.push(`/invite/${inviteCode}/survey`);
  }

  return (
    <div
      style={{
        backgroundColor: "var(--bg)",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
      }}
    >
      <div style={{ marginBottom: 40, textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "var(--primary)", letterSpacing: "-0.5px" }}>
          MeshiMatch
        </div>
      </div>

      <div
        style={{
          backgroundColor: "var(--surface)",
          borderRadius: 24,
          padding: "28px 24px",
          border: "1px solid var(--border-light)",
          width: "100%",
          maxWidth: 400,
          textAlign: "center",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 4 }}>
          {t("invite.invited")}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
          {groupName}
        </div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 28 }}>
          {t("invite.members", { count: String(memberCount) })}
        </div>

        <div
          style={{
            backgroundColor: "rgba(240,90,40,0.06)",
            borderRadius: 14,
            padding: "14px 16px",
            marginBottom: 28,
            textAlign: "left",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)", marginBottom: 6 }}>
            {t("invite.surveyHint")}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {t("invite.surveyDesc")}
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={handleGoToSurvey}
          style={{ width: "100%", fontSize: 16 }}
        >
          {t("invite.answerSurvey")}
        </button>

        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 16 }}>
          {t("invite.loginRequired")}
        </div>
      </div>
    </div>
  );
}
