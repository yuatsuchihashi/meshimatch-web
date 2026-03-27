"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { MOCK_CURRENT_USER, GENRES, ALLERGIES, DIETARY_RESTRICTIONS } from "@/lib/mockData";
import { MemberAvatar } from "@/components/groups/MemberAvatar";

// Mock connections data
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
    <div style={{ backgroundColor: "var(--bg)", minHeight: "100dvh" }}>
      {/* Header */}
      <div style={{ padding: "60px 20px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 20 }}>
          プロフィール
        </div>

        {/* Avatar */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <div style={{ position: "relative" }}>
            <MemberAvatar name={displayName} size={80} />
            <button
              onClick={() => { setNameInput(displayName); setEditSection("name"); }}
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 26,
                height: 26,
                borderRadius: "50%",
                backgroundColor: "var(--primary)",
                color: "white",
                border: "2px solid var(--bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              ✏️
            </button>
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
          {displayName}
        </div>
      </div>

      <div style={{ padding: "0 20px 40px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* User ID section */}
        <div
          style={{
            backgroundColor: "var(--surface)",
            borderRadius: 16,
            border: "1px solid var(--border-light)",
            padding: 16,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
            ユーザーID
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text-primary)",
                backgroundColor: "var(--bg-secondary)",
                borderRadius: 8,
                padding: "8px 12px",
                flex: 1,
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

        {/* Profile share section */}
        <div
          style={{
            backgroundColor: "var(--surface)",
            borderRadius: 16,
            border: "1px solid var(--border-light)",
            padding: 16,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
            プロフィールを共有
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setEditSection("share")}
              style={{
                flex: 1,
                padding: "12px 8px",
                borderRadius: 12,
                border: "1.5px solid var(--border)",
                backgroundColor: "var(--bg)",
                color: "var(--text-primary)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 22 }}>📷</span>
              QRコード
            </button>
            <button
              onClick={() => alert("ID検索機能（デモ）")}
              style={{
                flex: 1,
                padding: "12px 8px",
                borderRadius: 12,
                border: "1.5px solid var(--border)",
                backgroundColor: "var(--bg)",
                color: "var(--text-primary)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 22 }}>🔍</span>
              ID検索
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: "MeshiMatch", url: profileUrl });
                } else {
                  navigator.clipboard?.writeText(profileUrl).catch(() => {});
                  alert("リンクをコピーしました");
                }
              }}
              style={{
                flex: 1,
                padding: "12px 8px",
                borderRadius: 12,
                border: "1.5px solid var(--border)",
                backgroundColor: "var(--bg)",
                color: "var(--text-primary)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 22 }}>🔗</span>
              リンク共有
            </button>
          </div>
        </div>

        {/* Connections */}
        <div
          style={{
            backgroundColor: "var(--surface)",
            borderRadius: 16,
            border: "1px solid var(--border-light)",
            padding: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              コネクション
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--primary)",
                backgroundColor: "rgba(196,85,42,0.1)",
                padding: "2px 10px",
                borderRadius: 20,
              }}
            >
              {MOCK_CONNECTIONS.length}人
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {MOCK_CONNECTIONS.map((conn) => (
              <div
                key={conn.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <MemberAvatar name={conn.displayName} size={40} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                    {conn.displayName}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                    共通グループ {conn.mutualGroups}件
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Disliked Genres */}
        <SectionCard title="苦手なジャンル" onEdit={() => setEditSection("genres")}>
          {dislikedGenres.length === 0 ? (
            <EmptyChipText>設定なし</EmptyChipText>
          ) : (
            <ChipRow>
              {dislikedGenres.map((id) => {
                const g = GENRES.find((x) => x.id === id);
                return g ? (
                  <span key={id} className="chip chip-selected" style={{ fontSize: 13 }}>
                    {g.emoji} {g.name}
                  </span>
                ) : null;
              })}
            </ChipRow>
          )}
        </SectionCard>

        {/* Allergies */}
        <SectionCard title="アレルギー・食の制限" onEdit={() => setEditSection("allergies")}>
          {allergies.length === 0 && dietaryRestrictions.length === 0 ? (
            <EmptyChipText>設定なし</EmptyChipText>
          ) : (
            <ChipRow>
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
            </ChipRow>
          )}
        </SectionCard>

        {/* Sign out */}
        <div
          style={{
            backgroundColor: "var(--surface)",
            borderRadius: 16,
            border: "1px solid var(--border-light)",
          }}
        >
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
              color: "var(--text-secondary)",
              fontSize: 15,
            }}
          >
            <span>🚪</span> ログアウト（デモ）
          </button>
        </div>
      </div>

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
        <EditSheet title="QRコード" onClose={() => setEditSection(null)}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div
              style={{
                padding: 20,
                backgroundColor: "white",
                borderRadius: 16,
                boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              }}
            >
              <QRCodeSVG value={profileUrl} size={180} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                {displayName}さんのプロフィール
              </div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                {profileUrl}
              </div>
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
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10 }}>
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
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10 }}>
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

function SectionCard({
  title,
  children,
  onEdit,
}: {
  title: string;
  children: React.ReactNode;
  onEdit: () => void;
}) {
  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        borderRadius: 16,
        border: "1px solid var(--border-light)",
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{title}</div>
        <button
          onClick={onEdit}
          style={{
            fontSize: 13,
            color: "var(--primary)",
            fontWeight: 600,
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          編集
        </button>
      </div>
      {children}
    </div>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{children}</div>;
}

function EmptyChipText({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>{children}</div>;
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
          padding: "20px 20px 40px",
          maxHeight: "85dvh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div style={{ width: 40, height: 4, backgroundColor: "var(--border)", borderRadius: 2 }} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}
