"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { MOCK_CURRENT_USER, GENRES, ALLERGIES, DIETARY_RESTRICTIONS } from "@/lib/mockData";
import { MemberAvatar } from "@/components/groups/MemberAvatar";

const MOCK_CONNECTIONS = [
  { id: "c1", displayName: "たろう", mutualGroups: 2 },
  { id: "c2", displayName: "はな", mutualGroups: 1 },
  { id: "c3", displayName: "さくら", mutualGroups: 3 },
  { id: "c4", displayName: "けんと", mutualGroups: 1 },
];

export default function ProfilePage() {
  const user = MOCK_CURRENT_USER;
  const [displayName, setDisplayName] = useState(user.displayName);
  const [dislikedGenres, setDislikedGenres] = useState<string[]>(user.dislikedGenres);
  const [allergies, setAllergies] = useState<string[]>(user.allergies);
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>(user.dietaryRestrictions);
  const [editSection, setEditSection] = useState<null | "name" | "genres" | "allergies" | "share">(null);
  const [nameInput, setNameInput] = useState(displayName);

  const profileUrl = `https://meshimatch.app/u/${user.id}`;

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
  function toggleRestriction(id: string) {
    setDietaryRestrictions((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  }

  return (
    <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh", paddingBottom: 80 }}>

      {/* ─── Hero Header ─── */}
      <div
        style={{
          background: "linear-gradient(160deg, var(--primary) 0%, var(--primary-light) 100%)",
          padding: "60px 20px 32px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* decorative circles */}
        <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.08)" }} />
        <div style={{ position: "absolute", bottom: -20, left: 10, width: 80, height: 80, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.06)" }} />

        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16 }}>
          {/* Avatar with edit button */}
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
                fontSize: 13,
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              }}
            >
              ✏️
            </button>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "white", lineHeight: 1.2 }}>
              {displayName}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>
              MeshiMatchユーザー
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ─── 基本情報 ─── */}
        <section>
          <SectionLabel>基本情報</SectionLabel>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {/* User ID row */}
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
                  {user.id}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(user.id).catch(() => {});
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
                  }}
                >
                  コピー
                </button>
              </div>
            </div>

            {/* Name row */}
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </section>

        {/* ─── 共有方法 ─── */}
        <section>
          <SectionLabel>友達に共有</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <ShareButton
              emoji="📷"
              label="QRコード"
              onClick={() => setEditSection("share")}
            />
            <ShareButton
              emoji="🔍"
              label="ID検索"
              onClick={() => alert("ID検索機能（デモ）")}
            />
            <ShareButton
              emoji="🔗"
              label="リンク共有"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: "MeshiMatch", url: profileUrl });
                } else {
                  navigator.clipboard?.writeText(profileUrl).catch(() => {});
                  alert("リンクをコピーしました");
                }
              }}
            />
          </div>
        </section>

        {/* ─── コネクション ─── */}
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <SectionLabel style={{ marginBottom: 0 }}>コネクション</SectionLabel>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--primary)",
                backgroundColor: "rgba(196,85,42,0.1)",
                padding: "2px 10px",
                borderRadius: 20,
              }}
            >
              {MOCK_CONNECTIONS.length}人
            </span>
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {MOCK_CONNECTIONS.map((conn, i) => (
              <div
                key={conn.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderBottom: i < MOCK_CONNECTIONS.length - 1 ? "1px solid var(--border-light)" : "none",
                }}
              >
                <MemberAvatar name={conn.displayName} size={44} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                    {conn.displayName}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                    共通グループ {conn.mutualGroups}件
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            ))}
          </div>
        </section>

        {/* ─── 食の好み ─── */}
        <section>
          <SectionLabel>食の好み</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>

            {/* Disliked genres */}
            <div
              className="card"
              style={{
                borderRadius: "14px 14px 0 0",
                padding: "14px 16px",
              }}
            >
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
                    backgroundColor: "rgba(196,85,42,0.08)",
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
                        {g.emoji} {g.name}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            {/* Allergies & dietary restrictions */}
            <div
              className="card"
              style={{
                borderRadius: "0 0 14px 14px",
                padding: "14px 16px",
              }}
            >
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
                    backgroundColor: "rgba(196,85,42,0.08)",
                  }}
                >
                  編集
                </button>
              </div>
              {allergies.length === 0 && dietaryRestrictions.length === 0 ? (
                <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>設定なし</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {allergies.map((id) => {
                    const a = ALLERGIES.find((x) => x.id === id);
                    return a ? (
                      <span key={id} className="chip chip-selected" style={{ fontSize: 13 }}>
                        {a.emoji} {a.name}
                      </span>
                    ) : null;
                  })}
                  {dietaryRestrictions.map((id) => {
                    const r = DIETARY_RESTRICTIONS.find((x) => x.id === id);
                    return r ? (
                      <span key={id} className="chip chip-selected" style={{ fontSize: 13 }}>
                        {r.emoji} {r.name}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ─── その他 ─── */}
        <section>
          <SectionLabel>その他</SectionLabel>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <button
              style={{
                width: "100%",
                padding: "16px 18px",
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 12,
                color: "#E05252",
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              <span style={{ fontSize: 18 }}>🚪</span>
              ログアウト（デモ）
            </button>
          </div>
        </section>

      </div>

      {/* ─── Edit sheets ─── */}
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
            onClick={() => { setDisplayName(nameInput); setEditSection(null); }}
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
              🔗 リンクを共有
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
                {g.emoji} {g.name}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={() => setEditSection(null)}>
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
                  {a.emoji} {a.name}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>
              食の制限
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {DIETARY_RESTRICTIONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => toggleRestriction(r.id)}
                  className={`chip ${dietaryRestrictions.includes(r.id) ? "chip-selected" : ""}`}
                >
                  {r.emoji} {r.name}
                </button>
              ))}
            </div>
          </div>
          <button className="btn-primary" onClick={() => setEditSection(null)}>
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
  emoji,
  label,
  onClick,
}: {
  emoji: string;
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
      <span style={{ fontSize: 24 }}>{emoji}</span>
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
