"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, UserPlus } from "lucide-react";
import { MemberAvatar } from "@/components/groups/MemberAvatar";
import { useLocale } from "@/lib/i18n";
import { useUser } from "@/lib/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import { mapProfileRow } from "@/lib/session-data";
import type { UserProfile } from "@/lib/types";
import { VerificationBadge } from "@/components/profile/VerificationBadge";
import { isVerified, type VerificationClient } from "@/lib/verification";
import { GENRES } from "@/lib/mockData";

type FollowStatus = "idle" | "adding" | "added" | "self" | "login" | "error";

const PROFILE_SELECT = `
  id,
  display_name,
  bio,
  avatar_url,
  allergy_note,
  dietary_note,
  allergies,
  usual_budget_ideal_yen,
  usual_budget_max_yen,
  usual_budget_priority,
  usual_areas,
  usual_prefer_moods,
  usual_avoid_moods,
  favorite_genres,
  disliked_items,
  dietary_restrictions
`;

interface PublicRecommendation {
  id: string;
  note: string | null;
  pr: boolean;
  restaurants: {
    id: string;
    name: string;
    nearest_area: string | null;
    genre_id: string | null;
    price_band: string | null;
  } | null;
}

export default function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: targetUserId } = use(params);
  const { t } = useLocale();
  const { userId, loading: userLoading } = useUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [followStatus, setFollowStatus] = useState<FollowStatus>("idle");
  const [verified, setVerified] = useState(false);
  const [recommendations, setRecommendations] = useState<PublicRecommendation[]>([]);
  const genreName = new Map(GENRES.map((genre) => [genre.id, genre.name]));

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setProfileLoading(true);
      setNotFound(false);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("id", targetUserId)
        .single();

      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
        setProfile(null);
        setVerified(false);
        setRecommendations([]);
      } else {
        setProfile(mapProfileRow(data as Record<string, unknown>));
        const isOfficial = await isVerified(
          supabase as unknown as VerificationClient,
          targetUserId
        );
        if (cancelled) return;
        setVerified(isOfficial);
        if (isOfficial) {
          const { data: sourceRows } = await supabase
            .from("restaurant_sources")
            .select(`
              id, note, pr,
              restaurants (id, name, nearest_area, genre_id, price_band)
            `)
            .eq("added_by", targetUserId)
            .eq("visibility", "public")
            .in("source_type", ["user_favorite", "endorsement"])
            .order("created_at", { ascending: false });
          if (cancelled) return;
          setRecommendations(((sourceRows ?? []) as unknown as PublicRecommendation[]).filter((row) => row.restaurants));
        } else {
          setRecommendations([]);
        }
      }
      setProfileLoading(false);
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  const addConnection = useCallback(async () => {
    if (userLoading) return;
    if (!userId) {
      setFollowStatus("login");
      return;
    }
    if (userId === targetUserId) {
      setFollowStatus("self");
      return;
    }

    setFollowStatus("adding");
    const supabase = createClient();
    const { error } = await supabase.from("follows").upsert(
      {
        follower_id: userId,
        following_id: targetUserId,
      },
      { onConflict: "follower_id,following_id" }
    );

    setFollowStatus(error ? "error" : "added");
  }, [targetUserId, userId, userLoading]);

  useEffect(() => {
    if (!profile || profileLoading || followStatus !== "idle") return;
    const timer = window.setTimeout(() => {
      addConnection();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [addConnection, followStatus, profile, profileLoading]);

  const loading = userLoading || profileLoading;

  return (
    <main style={{ backgroundColor: "var(--bg)", minHeight: "100dvh", padding: "18px 16px 96px" }}>
      <Link
        href="/home"
        aria-label={t("common.back")}
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border-light)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-primary)",
          textDecoration: "none",
          marginBottom: 18,
        }}
      >
        <ArrowLeft size={18} />
      </Link>

      {loading ? (
        <div style={{ minHeight: 360, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: 14 }}>
          {t("common.loading")}
        </div>
      ) : notFound || !profile ? (
        <div className="card" style={{ padding: 22, textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
            {t("userProfile.notFound")}
          </div>
          <Link href="/home" className="btn-primary" style={{ marginTop: 14, textDecoration: "none" }}>
            {t("waiting.backToHome")}
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section
            style={{
              backgroundColor: "var(--primary)",
              borderRadius: 18,
              padding: "28px 20px",
              color: "white",
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              <MemberAvatar name={profile.displayName} imageUrl={profile.avatarUrl} size={88} />
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 24, fontWeight: 850, lineHeight: 1.2 }}>
              {profile.displayName}
              {verified && (
                <VerificationBadge
                  label={t("official.badge")}
                  title={t("official.badgeTitle")}
                  compact
                />
              )}
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.82)", marginTop: 8, lineHeight: 1.5 }}>
              {profile.bio?.trim() || t("profile.bioEmpty")}
            </div>
          </section>

          {verified && (
            <section className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 12 }}>
                {t("official.publicRecommendationsTitle")}
              </div>
              {recommendations.length === 0 ? (
                <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>
                  {t("official.publicRecommendationsEmpty")}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 340, overflowY: "auto", paddingRight: 2 }}>
                  {recommendations.map((source) => (
                    <div
                      key={source.id}
                      style={{
                        border: "1px solid var(--border-light)",
                        borderRadius: 14,
                        padding: "12px 14px",
                        background: "var(--surface)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 800, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {source.restaurants!.name}
                        </div>
                        {source.pr && (
                          <span style={{ fontSize: 11, fontWeight: 900, color: "var(--primary)", background: "rgba(240,90,40,0.12)", borderRadius: 999, padding: "4px 8px", flexShrink: 0 }}>
                            {t("official.prChip")}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 3 }}>
                        {[
                          source.restaurants!.nearest_area,
                          source.restaurants!.genre_id
                            ? genreName.get(source.restaurants!.genre_id) ?? source.restaurants!.genre_id
                            : null,
                          source.restaurants!.price_band,
                        ]
                          .filter(Boolean)
                          .join(" ・ ")}
                      </div>
                      {source.note?.trim() && (
                        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginTop: 8 }}>
                          {source.note.trim()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
              {t("userProfile.qrOpened")}
            </div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
              {statusText(followStatus, t)}
            </div>

            {followStatus === "added" || followStatus === "self" ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  width: "100%",
                  minHeight: 52,
                  borderRadius: 100,
                  backgroundColor: "rgba(92,139,82,0.12)",
                  color: "#4F7C46",
                  fontSize: 16,
                  fontWeight: 800,
                }}
              >
                <Check size={18} />
                {followStatus === "self" ? t("userProfile.selfProfile") : t("userProfile.added")}
              </div>
            ) : followStatus === "login" ? (
              <Link href="/login" className="btn-primary" style={{ textDecoration: "none" }}>
                {t("userProfile.loginToAdd")}
              </Link>
            ) : (
              <button className="btn-primary" onClick={addConnection} disabled={followStatus === "adding"}>
                <UserPlus size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />
                {followStatus === "adding" ? t("common.processing") : t("userProfile.addFriend")}
              </button>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function statusText(status: FollowStatus, t: (key: string) => string) {
  switch (status) {
    case "adding":
      return t("userProfile.adding");
    case "added":
      return t("userProfile.addedDesc");
    case "self":
      return t("userProfile.selfDesc");
    case "login":
      return t("userProfile.loginDesc");
    case "error":
      return t("userProfile.errorDesc");
    default:
      return t("userProfile.openedDesc");
  }
}
