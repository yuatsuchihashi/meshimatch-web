"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { SURVEY_AREAS } from "@/lib/areas";
import { MemberAvatar } from "@/components/groups/MemberAvatar";
import { BudgetCapPicker } from "@/components/survey/GenreTiles";
import { MoodPickGrid, MoodAvoidSection } from "@/components/survey/MoodPills";
import { MOODS, buildGenrePreferencesFromMoods } from "@/lib/moods";
import { QrSheet } from "@/components/profile/QrSheet";
import { useUser } from "@/lib/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/actions/auth";
import { useLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

interface Connection {
  id: string;
  displayName: string;
  mutualGroups: number;
}

const MAX_MOODS = 2;

export default function ProfilePage() {
  const { t, locale, setLocale } = useLocale();
  const { user, userId, loading, refresh } = useUser();
  const [connections, setConnections] = useState<Connection[]>([]);

  const [editSection, setEditSection] =
    useState<null | "profile" | "notes" | "defaults">(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [connectionsVisible, setConnectionsVisible] = useState(false);
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);

  // --- editing buffers ---
  const [nameInput, setNameInput] = useState("");
  const [bioInput, setBioInput] = useState("");
  const [allergyNoteInput, setAllergyNoteInput] = useState("");
  const [dietaryNoteInput, setDietaryNoteInput] = useState("");
  const [likedMoods, setLikedMoods] = useState<string[]>([]);
  const [avoidMoods, setAvoidMoods] = useState<string[]>([]);
  const [budgetMax, setBudgetMax] = useState<number | null>(null);
  const [usualAreasBuf, setUsualAreasBuf] = useState<string[]>([]);

  const displayName = user?.displayName ?? "ユーザー";
  const bio = user?.bio?.trim() ?? "";
  const allergyNote = user?.allergyNote?.trim() ?? "";
  const dietaryNote = user?.dietaryNote?.trim() ?? "";
  const usualPreferMoods = user?.usualPreferMoods ?? [];
  const usualAvoidMoods = user?.usualAvoidMoods ?? [];
  const usualAreas = user?.usualAreas ?? [];

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

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (avatarCropSrc) URL.revokeObjectURL(avatarCropSrc);
    setAvatarCropSrc(URL.createObjectURL(file));
  }

  function closeAvatarCrop() {
    if (avatarCropSrc) URL.revokeObjectURL(avatarCropSrc);
    setAvatarCropSrc(null);
  }

  async function handleAvatarCropSave(dataUrl: string) {
    await saveProfile({ avatar_url: dataUrl });
    closeAvatarCrop();
  }

  async function saveProfile(updates: Record<string, unknown>) {
    if (!userId) return;
    const supabase = createClient();
    await supabase.from("profiles").update(updates).eq("id", userId);
    refresh();
  }

  function openProfileEditor() {
    setNameInput(displayName);
    setBioInput(bio);
    setEditSection("profile");
  }

  function openNotesEditor() {
    setAllergyNoteInput(allergyNote);
    setDietaryNoteInput(dietaryNote);
    setEditSection("notes");
  }

  function openDefaultsEditor() {
    setLikedMoods(usualPreferMoods);
    setAvoidMoods(usualAvoidMoods);
    setBudgetMax(user?.usualBudgetMaxYen ?? null);
    setUsualAreasBuf(usualAreas);
    setEditSection("defaults");
  }

  function toggleLiked(moodId: string) {
    setLikedMoods((current) => {
      if (current.includes(moodId)) {
        return current.filter((id) => id !== moodId);
      }
      if (current.length >= MAX_MOODS) {
        return current;
      }
      setAvoidMoods((avoid) => avoid.filter((id) => id !== moodId));
      return [...current, moodId];
    });
  }

  function toggleAvoid(moodId: string) {
    setAvoidMoods((current) => {
      if (current.includes(moodId)) {
        return current.filter((id) => id !== moodId);
      }
      if (current.length >= MAX_MOODS) {
        return current;
      }
      setLikedMoods((liked) => liked.filter((id) => id !== moodId));
      return [...current, moodId];
    });
  }

  function toggleUsualArea(area: string) {
    setUsualAreasBuf((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  }

  const moodName = (id: string) => {
    const fallback = MOODS.find((m) => m.id === id)?.label ?? id;
    const key = `survey.mood_${id}`;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

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
    <div className="service-canvas" style={{ minHeight: "100dvh", paddingBottom: 80 }}>

      {/* Profile banner */}
      <div
        style={{
          background:
            "radial-gradient(circle at 86% 20%, rgba(255,255,255,0.24), transparent 28%), linear-gradient(135deg, var(--primary), var(--primary-light))",
          padding: "56px 20px 28px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <button
          onClick={openProfileEditor}
          aria-label={t("profile.editProfile")}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 36,
            height: 36,
            borderRadius: "50%",
            backgroundColor: "rgba(255,255,255,0.2)",
            color: "white",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          </svg>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* アバター: タップで写真変更 (クライアント側で縮小して data URL 保存) */}
          <label style={{ flexShrink: 0, cursor: "pointer", position: "relative", display: "block" }}>
            <MemberAvatar name={displayName} size={72} imageUrl={user?.avatarUrl} />
            <span
              style={{
                position: "absolute", right: -2, bottom: -2, width: 24, height: 24,
                borderRadius: "50%", backgroundColor: "white", color: "var(--primary)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 1px 4px rgba(74,53,42,0.25)",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8h2.5l1.5-2h8l1.5 2H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
                <circle cx="12" cy="13" r="3.2" />
              </svg>
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ display: "none" }}
            />
          </label>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "white", lineHeight: 1.2 }}>
              {displayName}
            </div>
            <div
              style={{
                fontSize: 13,
                color: bio ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)",
                marginTop: 4,
                lineHeight: 1.4,
              }}
            >
              {bio || t("profile.bioEmpty")}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* 共有方法 – QR 統合 */}
        <section>
          <SectionLabel>{t("profile.shareWithFriends")}</SectionLabel>
          <button
            onClick={() => setQrOpen(true)}
            className="card service-card"
            style={{
              position: "relative",
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "16px 102px 16px 16px",
              cursor: "pointer",
              border: "none",
              textAlign: "left",
            }}
          >
            <Image
              src="/img/service/06-profile-qr-share.webp"
              alt=""
              width={104}
              height={90}
              className="service-deco"
              style={{
                position: "absolute",
                right: 8,
                bottom: -8,
                width: 94,
                height: "auto",
                opacity: 0.98,
              }}
            />
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: "rgba(240,90,40,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Image
                src="/icons/code_reader_line.svg"
                alt=""
                width={24}
                height={24}
                style={{ filter: "brightness(0) saturate(100%) invert(45%) sepia(80%) saturate(2500%) hue-rotate(340deg)" }}
              />
            </div>
            <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                {t("profile.qrCode")}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                {t("profile.qrMyCode")} · {t("profile.qrScan")}
              </div>
            </div>
            <Image src="/icons/arrow_right_line.svg" alt="" width={16} height={16} style={{ position: "relative", zIndex: 1, filter: "brightness(0) saturate(100%) invert(70%) sepia(5%) saturate(400%) hue-rotate(210deg)" }} />
          </button>
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

        {/* お気に入りのお店 */}
        <section>
          <SectionLabel>{t("favorites.title")}</SectionLabel>
          <Link
            href="/profile/favorites"
            className="card service-card"
            style={{
              position: "relative",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 16px", textDecoration: "none",
            }}
          >
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                {t("favorites.importTitle")}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                {t("favorites.subtitle")}
              </div>
            </div>
            <span style={{ position: "relative", zIndex: 1, color: "var(--primary)", fontWeight: 700 }}>→</span>
          </Link>
        </section>

        {/* 普段の設定 */}
        <section>
          <SectionLabel>{t("profile.defaultsTitle")}</SectionLabel>
          <div className="card service-card" style={{ position: "relative", padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                {t("profile.defaultsHint")}
              </div>
              <EditButton onClick={openDefaultsEditor} label={t("common.edit")} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <DefaultRow label={t("profile.likedMoods")}>
                {usualPreferMoods.length === 0 ? (
                  <NotSet t={t} />
                ) : (
                  <ChipRow>
                    {usualPreferMoods.map((id) => (
                      <span key={id} className="chip chip-selected" style={{ fontSize: 13 }}>
                        {moodName(id)}
                      </span>
                    ))}
                  </ChipRow>
                )}
              </DefaultRow>

              <DefaultRow label={t("profile.avoidMoods")}>
                {usualAvoidMoods.length === 0 ? (
                  <NotSet t={t} />
                ) : (
                  <ChipRow>
                    {usualAvoidMoods.map((id) => (
                      <span key={id} className="chip" style={{ fontSize: 13, textDecoration: "line-through" }}>
                        {moodName(id)}
                      </span>
                    ))}
                  </ChipRow>
                )}
              </DefaultRow>

              <DefaultRow label={t("profile.budgetLabel")}>
                {user?.usualBudgetMaxYen ? (
                  <ChipRow>
                    <span className="chip" style={{ fontSize: 13 }}>
                      〜{user.usualBudgetMaxYen.toLocaleString()}円
                    </span>
                  </ChipRow>
                ) : (
                  <NotSet t={t} />
                )}
              </DefaultRow>

              <DefaultRow label={t("profile.usualAreasLabel")}>
                {usualAreas.length === 0 ? (
                  <NotSet t={t} />
                ) : (
                  <ChipRow>
                    {usualAreas.map((area) => (
                      <span key={area} className="chip" style={{ fontSize: 13 }}>
                        {area}
                      </span>
                    ))}
                  </ChipRow>
                )}
              </DefaultRow>
            </div>
          </div>
        </section>

        {/* 食のこだわり – アレルギー / 食事制限 自由記入 */}
        <section>
          <SectionLabel>{t("profile.foodPreferences")}</SectionLabel>
          <div className="card" style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                {t("profile.allergies")}
              </div>
              <EditButton onClick={openNotesEditor} label={t("common.edit")} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <DefaultRow label={t("profile.allergyLabel")}>
                {allergyNote ? (
                  <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{allergyNote}</div>
                ) : (
                  <NotSet t={t} />
                )}
              </DefaultRow>
              <DefaultRow label={t("profile.dietaryLabel")}>
                {dietaryNote ? (
                  <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{dietaryNote}</div>
                ) : (
                  <NotSet t={t} />
                )}
              </DefaultRow>
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
                      backgroundColor: locale === lang ? "rgba(240,90,40,0.1)" : "var(--surface)",
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

      {/* QR 統合シート */}
      {qrOpen && (
        <QrSheet
          profileUrl={profileUrl}
          displayName={displayName}
          t={t}
          onClose={() => setQrOpen(false)}
        />
      )}

      {avatarCropSrc && (
        <AvatarCropSheet
          src={avatarCropSrc}
          t={t}
          onCancel={closeAvatarCrop}
          onSave={handleAvatarCropSave}
        />
      )}

      {/* プロフィール編集 (表示名 + ひとこと) */}
      {editSection === "profile" && (
        <EditSheet title={t("profile.editProfile")} onClose={() => setEditSection(null)}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>
            {t("profile.displayName")}
          </div>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            style={inputStyle}
            placeholder={t("profile.namePlaceholder")}
            onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            autoFocus
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 16, marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>
              {t("profile.bioLabel")}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              {bioInput.length}/60
            </span>
          </div>
          <textarea
            value={bioInput}
            maxLength={60}
            onChange={(e) => setBioInput(e.target.value)}
            style={{ ...inputStyle, minHeight: 72, resize: "none" }}
            placeholder={t("profile.bioPlaceholder")}
            onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
          <button
            className="btn-primary"
            style={{ marginTop: 16 }}
            onClick={() => {
              saveProfile({ display_name: nameInput.trim(), bio: bioInput.trim() || null });
              setEditSection(null);
            }}
            disabled={!nameInput.trim()}
          >
            {t("common.save")}
          </button>
        </EditSheet>
      )}

      {/* 食のこだわり編集 (自由記入) */}
      {editSection === "notes" && (
        <EditSheet title={t("profile.allergies")} onClose={() => setEditSection(null)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>
              {t("profile.allergyLabel")}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{allergyNoteInput.length}/50</span>
          </div>
          <input
            value={allergyNoteInput}
            maxLength={50}
            onChange={(e) => setAllergyNoteInput(e.target.value)}
            style={inputStyle}
            placeholder={t("profile.allergyNotePlaceholder")}
            onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            autoFocus
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 16, marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>
              {t("profile.dietaryLabel")}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{dietaryNoteInput.length}/50</span>
          </div>
          <input
            value={dietaryNoteInput}
            maxLength={50}
            onChange={(e) => setDietaryNoteInput(e.target.value)}
            style={inputStyle}
            placeholder={t("profile.dietaryNotePlaceholder")}
            onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
          <button
            className="btn-primary"
            style={{ marginTop: 16 }}
            onClick={() => {
              saveProfile({
                allergy_note: allergyNoteInput.trim() || null,
                dietary_note: dietaryNoteInput.trim() || null,
              });
              setEditSection(null);
            }}
          >
            {t("common.save")}
          </button>
        </EditSheet>
      )}

      {/* 普段の設定 編集 */}
      {editSection === "defaults" && (
        <EditSheet title={t("profile.defaultsTitle")} onClose={() => setEditSection(null)}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
            {t("profile.defaultsHint")}
          </div>

          <div style={{ marginBottom: 20 }}>
            <MoodPickGrid
              hint={t("profile.moodsHint")}
              remaining={
                likedMoods.length >= MAX_MOODS
                  ? t("survey.slotFull")
                  : t("survey.slotRemaining", { count: MAX_MOODS - likedMoods.length })
              }
              selected={likedMoods}
              onToggle={toggleLiked}
              maxReached={likedMoods.length >= MAX_MOODS}
              t={t}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <MoodAvoidSection
              selected={avoidMoods}
              onToggle={toggleAvoid}
              maxReached={avoidMoods.length >= MAX_MOODS}
              t={t}
            />
          </div>

          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>
            {t("profile.budgetLabel")}
          </div>
          <div style={{ marginBottom: 20 }}>
            <BudgetCapPicker value={budgetMax} onChange={setBudgetMax} t={t} />
          </div>

          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>
            {t("profile.usualAreasLabel")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {SURVEY_AREAS.map((area) => (
              <button
                key={area}
                onClick={() => toggleUsualArea(area)}
                className={`chip ${usualAreasBuf.includes(area) ? "chip-selected" : ""}`}
              >
                {area}
              </button>
            ))}
          </div>

          <button
            className="btn-primary"
            onClick={() => {
              saveProfile({
                usual_prefer_moods: likedMoods,
                usual_avoid_moods: avoidMoods,
                favorite_genres: buildGenrePreferencesFromMoods(likedMoods, avoidMoods),
                usual_budget_max_yen: budgetMax,
                usual_areas: usualAreasBuf,
              });
              setEditSection(null);
            }}
          >
            {t("common.save")}
          </button>
        </EditSheet>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 12,
  border: "1.5px solid var(--border)",
  fontSize: 16,
  color: "var(--text-primary)",
  backgroundColor: "var(--bg)",
  outline: "none",
  fontFamily: "inherit",
};

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

function EditButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 13,
        color: "var(--primary)",
        fontWeight: 600,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "4px 8px",
        borderRadius: 8,
        backgroundColor: "rgba(240,90,40,0.08)",
      }}
    >
      {label}
    </button>
  );
}

function DefaultRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600, marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{children}</div>;
}

function NotSet({ t }: { t: (key: string) => string }) {
  return <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>{t("common.notSet")}</div>;
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

const AVATAR_CROP_VIEW_SIZE = 260;
const AVATAR_OUTPUT_SIZE = 256;

function AvatarCropSheet({
  src,
  t,
  onCancel,
  onSave,
}: {
  src: string;
  t: (key: string) => string;
  onCancel: () => void;
  onSave: (dataUrl: string) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; startX: number; startY: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

  function clampOffset(nextOffset: { x: number; y: number }, nextZoom = zoom) {
    const image = imgRef.current;
    if (!image?.naturalWidth || !image?.naturalHeight) return nextOffset;

    const baseScale = Math.max(
      AVATAR_CROP_VIEW_SIZE / image.naturalWidth,
      AVATAR_CROP_VIEW_SIZE / image.naturalHeight
    );
    const scaledWidth = image.naturalWidth * baseScale * nextZoom;
    const scaledHeight = image.naturalHeight * baseScale * nextZoom;
    const maxX = Math.max(0, (scaledWidth - AVATAR_CROP_VIEW_SIZE) / 2);
    const maxY = Math.max(0, (scaledHeight - AVATAR_CROP_VIEW_SIZE) / 2);

    return {
      x: Math.max(-maxX, Math.min(maxX, nextOffset.x)),
      y: Math.max(-maxY, Math.min(maxY, nextOffset.y)),
    };
  }

  function handleZoomChange(value: number) {
    setZoom(value);
    setOffset((current) => clampOffset(current, value));
  }

  function saveCrop() {
    const image = imgRef.current;
    if (!image?.naturalWidth || !image?.naturalHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_OUTPUT_SIZE;
    canvas.height = AVATAR_OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const baseScale = Math.max(
      AVATAR_CROP_VIEW_SIZE / image.naturalWidth,
      AVATAR_CROP_VIEW_SIZE / image.naturalHeight
    );
    const outputScale = AVATAR_OUTPUT_SIZE / AVATAR_CROP_VIEW_SIZE;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
    ctx.translate(
      AVATAR_OUTPUT_SIZE / 2 + offset.x * outputScale,
      AVATAR_OUTPUT_SIZE / 2 + offset.y * outputScale
    );
    ctx.scale(baseScale * zoom * outputScale, baseScale * zoom * outputScale);
    ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

    onSave(canvas.toDataURL("image/jpeg", 0.86));
  }

  const previewBaseScale =
    naturalSize.width > 0 && naturalSize.height > 0
      ? Math.max(
          AVATAR_CROP_VIEW_SIZE / naturalSize.width,
          AVATAR_CROP_VIEW_SIZE / naturalSize.height
        )
      : 1;
  const previewScale = previewBaseScale * zoom;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 110,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <div
        style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.55)" }}
        onClick={onCancel}
      />
      <div
        style={{
          position: "relative",
          backgroundColor: "var(--bg)",
          borderRadius: "24px 24px 0 0",
          padding: "20px 20px 48px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div style={{ width: 40, height: 4, backgroundColor: "var(--border)", borderRadius: 2 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <button
            onClick={onCancel}
            style={{
              border: "none",
              background: "none",
              color: "var(--text-secondary)",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              padding: "8px 4px",
            }}
          >
            {t("common.cancel")}
          </button>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
            {t("profile.cropAvatar")}
          </div>
          <button
            onClick={saveCrop}
            disabled={!ready}
            style={{
              border: "none",
              background: "none",
              color: ready ? "var(--primary)" : "var(--text-tertiary)",
              fontSize: 14,
              fontWeight: 800,
              cursor: ready ? "pointer" : "default",
              padding: "8px 4px",
            }}
          >
            {t("common.save")}
          </button>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: AVATAR_CROP_VIEW_SIZE,
              height: AVATAR_CROP_VIEW_SIZE,
              borderRadius: "50%",
              overflow: "hidden",
              backgroundColor: "var(--bg-secondary)",
              position: "relative",
              touchAction: "none",
              cursor: "grab",
              boxShadow: "0 0 0 1px var(--border)",
            }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = {
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                startX: offset.x,
                startY: offset.y,
              };
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              setOffset(
                clampOffset({
                  x: drag.startX + event.clientX - drag.x,
                  y: drag.startY + event.clientY - drag.y,
                })
              );
            }}
            onPointerUp={(event) => {
              if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
            }}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt=""
              onLoad={() => {
                const image = imgRef.current;
                if (image) {
                  const baseScale = Math.max(
                    AVATAR_CROP_VIEW_SIZE / image.naturalWidth,
                    AVATAR_CROP_VIEW_SIZE / image.naturalHeight
                  );
                  const initialY =
                    image.naturalHeight > image.naturalWidth
                      ? -Math.min(48, Math.max(0, (image.naturalHeight * baseScale - AVATAR_CROP_VIEW_SIZE) / 2))
                      : 0;
                  setNaturalSize({
                    width: image.naturalWidth,
                    height: image.naturalHeight,
                  });
                  setZoom(1);
                  setOffset(clampOffset({ x: 0, y: initialY }, 1));
                }
                setReady(true);
              }}
              draggable={false}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${previewScale})`,
                transformOrigin: "center center",
                width: naturalSize.width || AVATAR_CROP_VIEW_SIZE,
                height: naturalSize.height || "auto",
                maxWidth: "none",
                maxHeight: "none",
                opacity: ready ? 1 : 0,
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>

        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>
          {t("profile.cropZoom")}
        </label>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(event) => handleZoomChange(Number(event.target.value))}
          style={{ width: "100%", accentColor: "var(--primary)" }}
        />
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", marginTop: 12 }}>
          {t("profile.cropHint")}
        </div>
      </div>
    </div>
  );
}
