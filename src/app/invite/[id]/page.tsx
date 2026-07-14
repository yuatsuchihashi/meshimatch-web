"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Chip, PillButton } from "@/components/v2";
import { useLocale } from "@/lib/i18n";

export default function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: inviteCode } = use(params);
  const router = useRouter();
  const { t } = useLocale();
  const [groupName, setGroupName] = useState("グループ");
  const [memberCount, setMemberCount] = useState(0);
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
      <div className="v2-scope" style={{ backgroundColor: "var(--v2-canvas)", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="animate-spin-slow" style={{ width: 32, height: 32, border: "3px solid var(--v2-border)", borderTopColor: "var(--v2-accent)", borderRadius: "50%" }} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="v2-scope service-canvas" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 400, border: "1px solid var(--v2-border)", borderRadius: "var(--v2-radius-card)", background: "var(--v2-surface)", boxShadow: "var(--v2-shadow)", padding: "28px 24px", textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--v2-tint-honey)", color: "var(--v2-tint-honey-text)", fontSize: 20, fontWeight: 800, marginBottom: 14 }}>!</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--v2-ink)", marginBottom: 8 }}>
            {t("invite.groupNotFound")}
          </div>
          <div style={{ fontSize: 14, color: "var(--v2-muted)", lineHeight: 1.6 }}>
            {t("invite.invalidLink")}
          </div>
        </div>
      </div>
    );
  }

  function handleGoToSurvey() {
    router.push(`/invite/${inviteCode}/survey`);
  }

  return (
    <div
      className="v2-scope service-canvas"
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
      }}
    >
      <div style={{ marginBottom: 40, textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "var(--v2-ink)", letterSpacing: 0 }}>
          MeshiMatch
        </div>
      </div>

      <div
        style={{
          backgroundColor: "var(--v2-surface)",
          borderRadius: "var(--v2-radius-card)",
          padding: "28px 24px 24px",
          border: "1px solid var(--v2-border)",
          width: "100%",
          maxWidth: 400,
          textAlign: "center",
          boxShadow: "var(--v2-shadow)",
        }}
      >
        <div style={{ fontSize: 13, color: "var(--v2-faint)", marginBottom: 4, fontWeight: 700 }}>
          {t("invite.invited")}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--v2-ink)", marginBottom: 10, lineHeight: 1.3, letterSpacing: "var(--v2-tracking-display)" }}>
          {groupName}
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <Chip label={t("invite.members", { count: String(memberCount) })} />
        </div>

        <div
          style={{
            backgroundColor: "var(--v2-surface-soft)",
            border: "1px solid var(--v2-border)",
            borderRadius: 20,
            padding: "14px 16px",
            marginBottom: 28,
            textAlign: "left",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--v2-ink)", marginBottom: 6 }}>
            {t("invite.surveyHint")}
          </div>
          <div style={{ fontSize: 13, color: "var(--v2-muted)", lineHeight: 1.6 }}>
            {t("invite.surveyDesc")}
          </div>
        </div>

        <PillButton variant="cta" onClick={handleGoToSurvey} style={{ fontSize: 16 }}>
          {t("invite.answerSurvey")}
        </PillButton>

        <div style={{ fontSize: 12, color: "var(--v2-faint)", marginTop: 16 }}>
          {t("invite.loginRequired")}
        </div>
      </div>
    </div>
  );
}
