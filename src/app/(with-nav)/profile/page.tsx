"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { GENRES, ALLERGIES } from "@/lib/mockData";
import { MemberAvatar } from "@/components/groups/MemberAvatar";
import { useUser } from "@/lib/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/actions/auth";

interface Connection {
  id: string;
  displayName: string;
  mutualGroups: number;
}

export default function ProfilePage() {
  const { user, userId, loading, refresh } = useUser();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [dislikedGenres, setDislikedGenres] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [editSection, setEditSection] = useState<null | "name" | "genres" | "allergies" | "share">(null);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [connectionsVisible, setConnectionsVisible] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setDislikedGenres(user.dislikedGenres);
      setAllergies(user.allergies);
    }
  }, [user]);

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
  const [nameInput, setNameInput] = useState(displayName);

  const profileUrl = `https://meshimatch.app/u/${userId ?? ""}`;

  function toggleGenre(id: string) {
    setDislikedGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }
  function toggleAllergy(id: string) {
    setAllergies((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  async function saveProfile(updates: { display_name?: string; disliked_genres?: string[]; allergies?: string[] }) {
    if (!userId) return;
    const supabase = createClient();
    await supabase.from("profiles").update(updates).eq("id", userId);
    refresh();
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          <div className="animate-spin-slow" style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14 }}>読み込み中...</div>
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
              MeshiMatchユーザー
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* 基本情報 */}
        <section>
          <SectionLabel>基本情報</SectionLabel>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-light)" }}>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6, fontWeight: 600, letterSpacing: "0.04em" }}>
                ユーザーID
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
                    alert("IDをコピーしました");
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
                  コピー
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
                  表示名
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
          <SectionLabel>友達に共有</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <ShareButton
              icon="/icons/code_reader_line.svg"
              label="QRコード"
              onClick={() => setEditSection("share")}
            />
            <ShareButton
              icon="/icons/search_line.svg"
              label="ID検索"
              onClick={() => alert("ID検索機能（デモ）")}
            />
          </div>
        </section>

        {/* 繋がり */}
        <section>
          <SectionLabel>繋がり</SectionLabel>
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
                  {connections.length}人
                </span>
              </div>
              <Image src="/icons/arrow_right_line.svg" alt="" width={16} height={16} style={{ filter: "brightness(0) saturate(100%) invert(70%) sepia(5%) saturate(400%) hue-rotate(210deg)" }} />
            </button>
          </div>
        </section>

        {/* 食の好み */}
        <section>
          <SectionLabel>食の好み</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <div className="card" style={{ borderRadius: "14px 14px 0 0", padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                  苦手なジャンル
                </div>
                <button
                  onClick={() => setEditSection("genres")}
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
                  編集
                </button>
              </div>
              {dislikedGenres.length === 0 ? (
                <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>設定なし</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {dislikedGenres.map((id) => {
                    const g = GENRES.find((x) => x.id === id);
                    return g ? (
                      <span key={id} className="chip chip-selected" style={{ fontSize: 13 }}>
                        {g.name}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            <div className="card" style={{ borderRadius: "0 0 14px 14px", padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                  アレルギー・食の制限
                </div>
                <button
                  onClick={() => setEditSection("allergies")}
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
                  編集
                </button>
              </div>
              {allergies.length === 0 ? (
                <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>設定なし</div>
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
          <SectionLabel>その他</SectionLabel>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
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
              ログアウト
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
                繋がり <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-tertiary)" }}>{connections.length}人</span>
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
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>共通グループ {conn.mutualGroups}件</div>
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
        <EditSheet title="名前を変更" onClose={() => setEditSection(null)}>
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
            placeholder="名前を入力"
            onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            autoFocus
          />
          <button
            className="btn-primary"
            onClick={() => { setDisplayName(nameInput); saveProfile({ display_name: nameInput }); setEditSection(null); }}
            disabled={!nameInput.trim()}
          >
            保存
          </button>
        </EditSheet>
      )}

      {editSection === "share" && (
        <EditSheet title="QRコードで共有" onClose={() => setEditSection(null)}>
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
                {displayName}さんのプロフィール
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
                  alert("リンクをコピーしました");
                }
              }}
            >
              リンクを共有
            </button>
          </div>
        </EditSheet>
      )}

      {editSection === "genres" && (
        <EditSheet title="苦手なジャンル" onClose={() => setEditSection(null)}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
            苦手なジャンルをタップして選択してください
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {GENRES.map((g) => (
              <button
                key={g.id}
                onClick={() => toggleGenre(g.id)}
                className={`chip ${dislikedGenres.includes(g.id) ? "chip-selected" : ""}`}
              >
                {g.name}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={() => { saveProfile({ disliked_genres: dislikedGenres }); setEditSection(null); }}>
            完了
          </button>
        </EditSheet>
      )}

      {editSection === "allergies" && (
        <EditSheet title="アレルギー・食の制限" onClose={() => setEditSection(null)}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>
              アレルギー
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ALLERGIES.map((a) => (
                <button
                  key={a.id}
                  onClick={() => toggleAllergy(a.id)}
                  className={`chip ${allergies.includes(a.id) ? "chip-selected" : ""}`}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </div>
          <button className="btn-primary" onClick={() => { saveProfile({ allergies }); setEditSection(null); }}>
            完了
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
