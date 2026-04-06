"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { ALLERGIES, DIETARY_RESTRICTIONS, GENRES } from "@/lib/mockData";
import { MemberAvatar } from "@/components/groups/MemberAvatar";
import { useUser } from "@/lib/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/actions/auth";
import { useLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { PriorityLevel } from "@/lib/types";

interface Connection {
  id: string;
  displayName: string;
  mutualGroups: number;
}

const PROFILE_AREAS = ["渋谷", "新宿", "池袋", "銀座", "六本木", "恵比寿", "表参道", "下北沢", "吉祥寺", "上野"];

export default function ProfilePage() {
  const { t, locale, setLocale } = useLocale();
  const { user, userId, loading, refresh } = useUser();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [editingAllergies, setEditingAllergies] = useState<string[]>([]);
  const [editingFavoriteGenres, setEditingFavoriteGenres] = useState<string[]>([]);
  const [editingDietaryRestrictions, setEditingDietaryRestrictions] = useState<string[]>([]);
  const [editingUsualAreas, setEditingUsualAreas] = useState<string[]>([]);
  const [editingBudgetIdeal, setEditingBudgetIdeal] = useState("");
  const [editingBudgetMax, setEditingBudgetMax] = useState("");
  const [editingBudgetPriority, setEditingBudgetPriority] =
    useState<PriorityLevel>("prefer");
  const [editSection, setEditSection] =
    useState<null | "name" | "allergies" | "share" | "favorites" | "defaults" | "dietary">(null);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [connectionsVisible, setConnectionsVisible] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const displayName = user?.displayName ?? "ユーザー";
  const allergies = user?.allergies ?? [];
  const favoriteGenres = user?.favoriteGenres ?? [];
  const favoriteGenreIds = favoriteGenres.map((genre) => genre.genreId);
  const usualAreas = user?.usualAreas ?? [];
  const dietaryRestrictions = user?.dietaryRestrictions ?? [];
  const dietaryRestrictionIds = dietaryRestrictions.map(
    (restriction) => restriction.restrictionId
  );
  const budgetPriorityLabels =
    locale === "en"
      ? {
          must: "Strict",
          prefer: "Prefer",
          optional: "Flexible",
        }
      : {
          must: "厳守したい",
          prefer: "できれば守りたい",
          optional: "参考程度",
        };
  const preferenceCopy =
    locale === "en"
      ? {
          sessionDefaults: "Session Defaults",
          favoriteGenres: "Favorite Genres",
          defaultBudget: "Usual Budget",
          usualAreas: "Usual Areas",
          dietaryRestrictions: "Dietary Restrictions",
          budgetHint: "Saved defaults are used when a session answer is empty",
          idealBudget: "Ideal",
          maxBudget: "Max",
          noDietaryRestrictions: "No dietary restrictions saved",
          noFavoriteGenres: "No favorite genres saved",
          noUsualAreas: "No usual areas saved",
        }
      : {
          sessionDefaults: "ふだんの設定",
          favoriteGenres: "よく選ぶジャンル",
          defaultBudget: "いつもの予算感",
          usualAreas: "よく使うエリア",
          dietaryRestrictions: "食事制限",
          budgetHint: "session 回答が空のときだけ、この設定を初期値として使います",
          idealBudget: "理想",
          maxBudget: "上限",
          noDietaryRestrictions: "食事制限は未設定です",
          noFavoriteGenres: "よく選ぶジャンルは未設定です",
          noUsualAreas: "よく使うエリアは未設定です",
        };
  const budgetPriorityOptions: { id: PriorityLevel; label: string }[] = [
    { id: "must", label: budgetPriorityLabels.must },
    { id: "prefer", label: budgetPriorityLabels.prefer },
    { id: "optional", label: budgetPriorityLabels.optional },
  ];

  useEffect(() => {
    if (!userId) return;
    async function fetchConnections() {
      const supabase = createClient();
      const { data: myMemberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("profile_id", userId);

      if (!myMemberships || myMemberships.length === 0) return;
      const groupIds = myMemberships.map((m) => m.group_id);

      const { data: allMembers } = await supabase
        .from("group_members")
        .select("profile_id, display_name, group_id")
        .in("group_id", groupIds)
        .not("profile_id", "is", null)
        .neq("profile_id", userId);

      if (!allMembers) return;
      const connectionMap = new Map<string, { displayName: string; groupCount: number }>();
      for (const m of allMembers) {
        const key = m.profile_id!;
        const existing = connectionMap.get(key);
        if (existing) existing.groupCount++;
        else connectionMap.set(key, { displayName: m.display_name, groupCount: 1 });
      }

      setConnections(
        Array.from(connectionMap.entries()).map(([pid, val]) => ({
          id: pid,
          displayName: val.displayName,
          mutualGroups: val.groupCount,
        }))
      );
    }
    fetchConnections();
  }, [userId]);

  function openConnections() {
    setConnectionsOpen(true);
    requestAnimationFrame(() => setConnectionsVisible(true));
  }

  function closeConnections() {
    setConnectionsVisible(false);
    setTimeout(() => setConnectionsOpen(false), 250);
  }

  const profileUrl = `https://meshimatch.app/u/${userId ?? ""}`;

  function toggleAllergy(id: string) {
    setEditingAllergies((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  function toggleFavoriteGenre(id: string) {
    setEditingFavoriteGenres((prev) =>
      prev.includes(id) ? prev.filter((genreId) => genreId !== id) : [...prev, id]
    );
  }

  function toggleDietaryRestriction(id: string) {
    setEditingDietaryRestrictions((prev) =>
      prev.includes(id) ? prev.filter((restrictionId) => restrictionId !== id) : [...prev, id]
    );
  }

  function toggleUsualArea(area: string) {
    setEditingUsualAreas((prev) =>
      prev.includes(area) ? prev.filter((current) => current !== area) : [...prev, area]
    );
  }

  async function saveProfile(updates: Record<string, unknown>) {
    if (!userId) return;
    const supabase = createClient();
    await supabase.from("profiles").update(updates).eq("id", userId);
    refresh();
  }

  function openDefaultsEditor() {
    setEditingUsualAreas(usualAreas);
    setEditingBudgetIdeal(
      user?.usualBudgetIdealYen ? String(user.usualBudgetIdealYen) : ""
    );
    setEditingBudgetMax(
      user?.usualBudgetMaxYen ? String(user.usualBudgetMaxYen) : ""
    );
    setEditingBudgetPriority(user?.usualBudgetPriority ?? "prefer");
    setEditSection("defaults");
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          <div className="animate-spin-slow" style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14 }}>{t("common.loading")}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh", paddingBottom: 80 }}>

      {/* Hero Header */}
      <div
        style={{
          background: "linear-gradient(160deg, var(--secondary) 0%, #3D3B6E 100%)",
          padding: "60px 20px 32px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.06)" }} />
        <div style={{ position: "absolute", bottom: -20, left: 10, width: 80, height: 80, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.04)" }} />

        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <MemberAvatar name={displayName} size={80} />
            <button
              onClick={() => { setNameInput(displayName); setEditSection("name"); }}
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 28,
                height: 28,
                borderRadius: "50%",
                backgroundColor: "white",
                color: "var(--primary)",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
            </button>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "white", lineHeight: 1.2 }}>
              {displayName}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
              {t("profile.subtitle")}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* 基本情報 */}
        <section>
          <SectionLabel>{t("profile.basicInfo")}</SectionLabel>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-light)" }}>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6, fontWeight: 600, letterSpacing: "0.04em" }}>
                {t("profile.userId")}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    flex: 1,
                    fontFamily: "monospace",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    backgroundColor: "var(--bg-secondary)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    letterSpacing: "0.05em",
                  }}
                >
                  {userId ?? ""}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(userId ?? "").catch(() => {});
                    alert(t("profile.idCopied"));
                  }}
                  style={{
                    padding: "8px 14px",
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Image src="/icons/copy_line.svg" alt="" width={14} height={14} style={{ filter: "brightness(0) saturate(100%) invert(45%) sepia(10%) saturate(500%) hue-rotate(210deg)" }} />
                  {t("common.copy")}
                </button>
              </div>
            </div>

            <button
              onClick={() => { setNameInput(displayName); setEditSection("name"); }}
              style={{
                width: "100%",
                padding: "14px 16px",
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600, letterSpacing: "0.04em", marginBottom: 2 }}>
                  {t("profile.displayName")}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                  {displayName}
                </div>
              </div>
              <Image src="/icons/arrow_right_line.svg" alt="" width={16} height={16} style={{ filter: "brightness(0) saturate(100%) invert(70%) sepia(5%) saturate(400%) hue-rotate(210deg)" }} />
            </button>
          </div>
        </section>

        {/* 共有方法 */}
        <section>
          <SectionLabel>{t("profile.shareWithFriends")}</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <ShareButton
              icon="/icons/code_reader_line.svg"
              label={t("profile.qrCode")}
              onClick={() => setEditSection("share")}
            />
            <ShareButton
              icon="/icons/search_line.svg"
              label={t("profile.idSearch")}
              onClick={() => alert(t("profile.idSearchDemo"))}
            />
          </div>
        </section>

        {/* 繋がり */}
        <section>
          <SectionLabel>{t("profile.connections")}</SectionLabel>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <button
              onClick={openConnections}
              style={{
                width: "100%",
                padding: "14px 16px",
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex" }}>
                  {connections.slice(0, 4).map((conn, i) => (
                    <div key={conn.id} style={{ marginLeft: i > 0 ? -8 : 0, zIndex: 4 - i }}>
                      <MemberAvatar name={conn.displayName} size={28} />
                    </div>
                  ))}
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                  {t("profile.connectionCount", { count: connections.length })}
                </span>
              </div>
              <Image src="/icons/arrow_right_line.svg" alt="" width={16} height={16} style={{ filter: "brightness(0) saturate(100%) invert(70%) sepia(5%) saturate(400%) hue-rotate(210deg)" }} />
            </button>
          </div>
        </section>

        {/* 食の好み */}
        <section>
          <SectionLabel>{t("profile.foodPreferences")}</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <div className="card" style={{ borderRadius: "14px 14px 0 0", padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                  {preferenceCopy.favoriteGenres}
                </div>
                <button
                  onClick={() => {
                    setEditingFavoriteGenres(favoriteGenreIds);
                    setEditSection("favorites");
                  }}
                  style={{
                    fontSize: 13,
                    color: "var(--primary)",
                    fontWeight: 600,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 8px",
                    borderRadius: 8,
                    backgroundColor: "rgba(204,119,85,0.08)",
                  }}
                >
                  {t("common.edit")}
                </button>
              </div>
              {favoriteGenreIds.length === 0 ? (
                <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>{preferenceCopy.noFavoriteGenres}</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {favoriteGenreIds.map((id) => {
                    const genre = GENRES.find((item) => item.id === id);
                    return genre ? (
                      <span key={id} className="chip chip-selected" style={{ fontSize: 13 }}>
                        {genre.name}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            <div className="card" style={{ borderRadius: 0, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                  {preferenceCopy.sessionDefaults}
                </div>
                <button
                  onClick={openDefaultsEditor}
                  style={{
                    fontSize: 13,
                    color: "var(--primary)",
                    fontWeight: 600,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 8px",
                    borderRadius: 8,
                    backgroundColor: "rgba(204,119,85,0.08)",
                  }}
                >
                  {t("common.edit")}
                </button>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 12 }}>
                {preferenceCopy.budgetHint}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {user?.usualBudgetIdealYen || user?.usualBudgetMaxYen ? (
                    <>
                      {user?.usualBudgetIdealYen ? (
                        <span className="chip" style={{ fontSize: 13 }}>
                          {preferenceCopy.idealBudget} {user.usualBudgetIdealYen}円
                        </span>
                      ) : null}
                      {user?.usualBudgetMaxYen ? (
                        <span className="chip" style={{ fontSize: 13 }}>
                          {preferenceCopy.maxBudget} {user.usualBudgetMaxYen}円
                        </span>
                      ) : null}
                      {user?.usualBudgetPriority ? (
                        <span className="chip" style={{ fontSize: 13 }}>
                          {budgetPriorityLabels[user.usualBudgetPriority]}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>{t("common.notSet")}</div>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {usualAreas.length === 0 ? (
                    <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>{preferenceCopy.noUsualAreas}</div>
                  ) : (
                    usualAreas.map((area) => (
                      <span key={area} className="chip" style={{ fontSize: 13 }}>
                        {area}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="card" style={{ borderRadius: 0, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                  {preferenceCopy.dietaryRestrictions}
                </div>
                <button
                  onClick={() => {
                    setEditingDietaryRestrictions(dietaryRestrictionIds);
                    setEditSection("dietary");
                  }}
                  style={{
                    fontSize: 13,
                    color: "var(--primary)",
                    fontWeight: 600,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 8px",
                    borderRadius: 8,
                    backgroundColor: "rgba(204,119,85,0.08)",
                  }}
                >
                  {t("common.edit")}
                </button>
              </div>
              {dietaryRestrictionIds.length === 0 ? (
                <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>{preferenceCopy.noDietaryRestrictions}</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {dietaryRestrictionIds.map((id) => {
                    const restriction = DIETARY_RESTRICTIONS.find((item) => item.id === id);
                    return restriction ? (
                      <span key={id} className="chip chip-selected" style={{ fontSize: 13 }}>
                        {restriction.name}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            <div className="card" style={{ borderRadius: "0 0 14px 14px", padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                  {t("profile.allergies")}
                </div>
                <button
                  onClick={() => {
                    setEditingAllergies(allergies);
                    setEditSection("allergies");
                  }}
                  style={{
                    fontSize: 13,
                    color: "var(--primary)",
                    fontWeight: 600,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 8px",
                    borderRadius: 8,
                    backgroundColor: "rgba(204,119,85,0.08)",
                  }}
                >
                  {t("common.edit")}
                </button>
              </div>
              {allergies.length === 0 ? (
                <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>{t("common.notSet")}</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {allergies.map((id) => {
                    const a = ALLERGIES.find((x) => x.id === id);
                    return a ? (
                      <span key={id} className="chip chip-selected" style={{ fontSize: 13 }}>
                        {a.name}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* その他 */}
        <section>
          <SectionLabel>{t("profile.other")}</SectionLabel>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>

            {/* 言語切り替え */}
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-light)" }}>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600, letterSpacing: "0.04em", marginBottom: 10 }}>
                {t("profile.language")}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {(["ja", "en"] as Locale[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLocale(lang)}
                    style={{
                      flex: 1,
                      padding: "9px 12px",
                      borderRadius: 10,
                      border: `1.5px solid ${locale === lang ? "var(--primary)" : "var(--border)"}`,
                      backgroundColor: locale === lang ? "rgba(204,119,85,0.1)" : "var(--surface)",
                      color: locale === lang ? "var(--primary)" : "var(--text-secondary)",
                      fontSize: 14,
                      fontWeight: locale === lang ? 700 : 500,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {lang === "ja" ? t("profile.japanese") : t("profile.english")}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => signOut()}
              style={{
                width: "100%",
                padding: "16px 18px",
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 12,
                color: "var(--danger)",
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              <Image
                src="/icons/arrow_left_line.svg"
                alt=""
                width={18}
                height={18}
                style={{ filter: "brightness(0) saturate(100%) invert(15%) sepia(70%) saturate(2000%) hue-rotate(350deg)" }}
              />
              {t("profile.logout")}
            </button>
          </div>
        </section>

      </div>

      {/* 繋がりシート */}
      {connectionsOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div
            style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", opacity: connectionsVisible ? 1 : 0, transition: "opacity 0.2s ease" }}
            onClick={closeConnections}
          />
          <div
            style={{
              position: "relative",
              backgroundColor: "var(--bg)",
              borderRadius: "24px 24px 0 0",
              maxHeight: "75dvh",
              overflowY: "auto",
              transform: connectionsVisible ? "translateY(0)" : "translateY(100%)",
              transition: "transform 0.25s cubic-bezier(0.34,1.1,0.64,1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
              <div style={{ width: 40, height: 4, backgroundColor: "var(--border)", borderRadius: 2 }} />
            </div>
            <div style={{ padding: "16px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>
                {t("profile.connectionsTitle")} <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-tertiary)" }}>{t("profile.connectionCount", { count: connections.length })}</span>
              </div>
              <button onClick={closeConnections} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 20, lineHeight: 1, padding: "4px 8px" }}>✕</button>
            </div>
            <div style={{ padding: "0 16px 40px" }}>
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                {connections.map((conn, i) => (
                  <div
                    key={conn.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 16px",
                      borderBottom: i < connections.length - 1 ? "1px solid var(--border-light)" : "none",
                    }}
                  >
                    <MemberAvatar name={conn.displayName} size={44} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{conn.displayName}</div>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{t("profile.mutualGroups", { count: conn.mutualGroups })}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit sheets */}
      {editSection === "name" && (
        <EditSheet title={t("profile.editName")} onClose={() => setEditSection(null)}>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 12,
              border: "1.5px solid var(--border)",
              fontSize: 16,
              color: "var(--text-primary)",
              backgroundColor: "var(--bg)",
              marginBottom: 16,
              outline: "none",
            }}
            placeholder={t("profile.namePlaceholder")}
            onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            autoFocus
          />
          <button
            className="btn-primary"
            onClick={() => { saveProfile({ display_name: nameInput }); setEditSection(null); }}
            disabled={!nameInput.trim()}
          >
            {t("common.save")}
          </button>
        </EditSheet>
      )}

      {editSection === "share" && (
        <EditSheet title={t("profile.shareQR")} onClose={() => setEditSection(null)}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <div
              style={{
                padding: 24,
                backgroundColor: "white",
                borderRadius: 20,
                boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              }}
            >
              <QRCodeSVG value={profileUrl} size={180} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                {t("profile.profileOf", { name: displayName })}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{profileUrl}</div>
            </div>
            <button
              className="btn-primary"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: "MeshiMatch", url: profileUrl });
                } else {
                  navigator.clipboard?.writeText(profileUrl).catch(() => {});
                  alert(t("profile.linkCopied"));
                }
              }}
            >
              {t("profile.shareLink")}
            </button>
          </div>
        </EditSheet>
      )}

      {editSection === "favorites" && (
        <EditSheet title={preferenceCopy.favoriteGenres} onClose={() => setEditSection(null)}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {GENRES.map((genre) => (
              <button
                key={genre.id}
                onClick={() => toggleFavoriteGenre(genre.id)}
                className={`chip ${editingFavoriteGenres.includes(genre.id) ? "chip-selected" : ""}`}
              >
                {genre.name}
              </button>
            ))}
          </div>
          <button
            className="btn-primary"
            onClick={() => {
              saveProfile({
                favorite_genres: editingFavoriteGenres.map((genreId) => ({
                  genreId,
                  priority: "prefer",
                })),
              });
              setEditSection(null);
            }}
          >
            {t("common.done")}
          </button>
        </EditSheet>
      )}

      {editSection === "defaults" && (
        <EditSheet title={preferenceCopy.sessionDefaults} onClose={() => setEditSection(null)}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
            {preferenceCopy.budgetHint}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <input
              inputMode="numeric"
              value={editingBudgetIdeal}
              onChange={(e) => setEditingBudgetIdeal(e.target.value.replace(/[^\d]/g, ""))}
              placeholder={`${preferenceCopy.idealBudget} 3500`}
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
            <input
              inputMode="numeric"
              value={editingBudgetMax}
              onChange={(e) => setEditingBudgetMax(e.target.value.replace(/[^\d]/g, ""))}
              placeholder={`${preferenceCopy.maxBudget} 5000`}
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {budgetPriorityOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setEditingBudgetPriority(option.id)}
                className={`chip ${editingBudgetPriority === option.id ? "chip-selected" : ""}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>
            {preferenceCopy.usualAreas}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {PROFILE_AREAS.map((area) => (
              <button
                key={area}
                onClick={() => toggleUsualArea(area)}
                className={`chip ${editingUsualAreas.includes(area) ? "chip-selected" : ""}`}
              >
                {area}
              </button>
            ))}
          </div>
          <button
            className="btn-primary"
            onClick={() => {
              saveProfile({
                usual_budget_ideal_yen: editingBudgetIdeal ? Number(editingBudgetIdeal) : null,
                usual_budget_max_yen: editingBudgetMax ? Number(editingBudgetMax) : null,
                usual_budget_priority: editingBudgetPriority,
                usual_areas: editingUsualAreas,
              });
              setEditSection(null);
            }}
          >
            {t("common.save")}
          </button>
        </EditSheet>
      )}

      {editSection === "dietary" && (
        <EditSheet title={preferenceCopy.dietaryRestrictions} onClose={() => setEditSection(null)}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {DIETARY_RESTRICTIONS.map((restriction) => (
              <button
                key={restriction.id}
                onClick={() => toggleDietaryRestriction(restriction.id)}
                className={`chip ${editingDietaryRestrictions.includes(restriction.id) ? "chip-selected" : ""}`}
              >
                {restriction.name}
              </button>
            ))}
          </div>
          <button
            className="btn-primary"
            onClick={() => {
              saveProfile({
                dietary_restrictions: editingDietaryRestrictions.map((restrictionId) => ({
                  restrictionId,
                  priority: "must",
                })),
              });
              setEditSection(null);
            }}
          >
            {t("common.done")}
          </button>
        </EditSheet>
      )}

      {editSection === "allergies" && (
        <EditSheet title={t("profile.allergies")} onClose={() => setEditSection(null)}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>
              {t("profile.allergyTitle")}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ALLERGIES.map((a) => (
                <button
                  key={a.id}
                  onClick={() => toggleAllergy(a.id)}
                  className={`chip ${editingAllergies.includes(a.id) ? "chip-selected" : ""}`}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </div>
          <button className="btn-primary" onClick={() => { saveProfile({ allergies: editingAllergies }); setEditSection(null); }}>
            {t("common.done")}
          </button>
        </EditSheet>
      )}
    </div>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: "var(--text-tertiary)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        marginBottom: 10,
        paddingLeft: 4,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function ShareButton({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "16px 8px",
        borderRadius: 14,
        border: "1.5px solid var(--border)",
        backgroundColor: "var(--surface)",
        color: "var(--text-primary)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        minHeight: 80,
        transition: "background-color 0.15s",
      }}
    >
      <Image
        src={icon}
        alt={label}
        width={24}
        height={24}
        style={{ filter: "brightness(0) saturate(100%) invert(25%) sepia(20%) saturate(600%) hue-rotate(210deg)" }}
      />
      <span style={{ lineHeight: 1.2 }}>{label}</span>
    </button>
  );
}

function EditSheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <div
        style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      />
      <div
        style={{
          position: "relative",
          backgroundColor: "var(--bg)",
          borderRadius: "24px 24px 0 0",
          padding: "20px 20px 48px",
          maxHeight: "85dvh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div style={{ width: 40, height: 4, backgroundColor: "var(--border)", borderRadius: 2 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
            {title}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: "var(--bg-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              color: "var(--text-secondary)",
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
