"use client";

import { useState } from "react";
import { MOCK_CURRENT_USER, GENRES, ALLERGIES, DIETARY_RESTRICTIONS } from "@/lib/mockData";
import { MemberAvatar } from "@/components/groups/MemberAvatar";

export default function ProfilePage() {
  const user = MOCK_CURRENT_USER;
  const [displayName, setDisplayName] = useState(user.displayName);
  const [dislikedGenres, setDislikedGenres] = useState<string[]>(user.dislikedGenres);
  const [allergies, setAllergies] = useState<string[]>(user.allergies);
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>(user.dietaryRestrictions);
  const [editSection, setEditSection] = useState<null | "name" | "genres" | "allergies">(null);
  const [nameInput, setNameInput] = useState(displayName);

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
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
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
        {/* Disliked Genres */}
        <SectionCard
          title="苦手なジャンル"
          onEdit={() => setEditSection("genres")}
        >
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
        <SectionCard
          title="アレルギー・食の制限"
          onEdit={() => setEditSection("allergies")}
        >
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

        {/* Sign out (demo) */}
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

      {editSection === "genres" && (
        <EditSheet title="苦手なジャンル" onClose={() => setEditSection(null)}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 20,
            }}
          >
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
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
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
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 20,
          }}
        >
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}
