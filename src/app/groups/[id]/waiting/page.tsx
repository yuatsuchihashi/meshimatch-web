"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useLocale } from "@/lib/i18n";

interface GroupData {
  id: string;
  name: string;
  invite_code: string;
  members: { id: string; display_name: string; role: string; has_survey: boolean }[];
}

export default function WaitingRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useLocale();
  const [group, setGroup] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGroup() {
      const supabase = createClient();
      const { data } = await supabase
        .from("groups")
        .select(`
          id, name, invite_code,
          group_members (id, display_name, role, has_survey)
        `)
        .eq("id", id)
        .single();

      if (data) {
        setGroup({
          id: data.id,
          name: data.name,
          invite_code: data.invite_code,
          members: data.group_members ?? [],
        });
      }
      setLoading(false);
    }

    fetchGroup();
    const interval = setInterval(fetchGroup, 10000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          <div className="animate-spin-slow" style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", marginBottom: 12 }} />
          <div style={{ fontSize: 14 }}>{t("common.loading")}</div>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-tertiary)", marginBottom: 12 }}>!</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{t("waiting.groupNotFound")}</div>
          <Link href="/home" style={{ color: "var(--primary)", fontSize: 14, marginTop: 8, display: "block" }}>{t("waiting.backToHomeLink")}</Link>
        </div>
      </div>
    );
  }

  const respondedCount = group.members.filter((m) => m.has_survey).length;
  const totalCount = group.members.length;
  const canSearch = respondedCount >= 1;

  function handleSearch() {
    router.push(`/groups/${id}/searching`);
  }

  function handleShareLink() {
    const url = `${window.location.origin}/invite/${group!.invite_code}`;
    navigator.clipboard.writeText(url);
    alert(t("waiting.linkCopied"));
  }

  return (
    <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh" }}>
      {/* Header */}
      <div style={{ padding: "60px 20px 24px" }}>
        <Link
          href="/home"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--primary)",
            textDecoration: "none",
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 20,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t("waiting.backToHome")}
        </Link>

        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
          {group.name}
        </div>
      </div>

      <div style={{ padding: "0 20px 40px", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Response count circle */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 110,
              height: 110,
              borderRadius: "50%",
              border: "4px solid var(--primary)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(204,119,85,0.08)",
            }}
          >
            <span style={{ fontSize: 32, fontWeight: 800, color: "var(--primary)" }}>
              {respondedCount}
            </span>
            <span style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: -2 }}>
              / {totalCount}
            </span>
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 500 }}>
            {t("waiting.responseCount")}
          </div>
        </div>

        {/* Members list */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>
            {t("waiting.members")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {group.members.map((member) => (
              <div
                key={member.id}
                style={{ display: "flex", alignItems: "center", gap: 12 }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--primary), var(--primary-light))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontWeight: 700,
                    fontSize: 15,
                    flexShrink: 0,
                  }}
                >
                  {member.display_name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                    {member.display_name}
                  </div>
                  {member.role === "owner" && (
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{t("waiting.organizer")}</div>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: member.has_survey ? "var(--success)" : "var(--text-tertiary)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {member.has_survey ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t("waiting.answered")}
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t("waiting.notAnswered")}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Share button */}
        <button className="btn-secondary" onClick={handleShareLink}>
          {t("waiting.shareInviteLink")}
        </button>

        {/* Search button */}
        <div>
          <button
            className="btn-primary"
            onClick={handleSearch}
            disabled={!canSearch}
          >
            {t("waiting.searchRestaurants")}
          </button>
          {!canSearch && (
            <div
              style={{
                fontSize: 13,
                color: "var(--text-tertiary)",
                textAlign: "center",
                marginTop: 8,
              }}
            >
              {t("waiting.responseNeeded")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
